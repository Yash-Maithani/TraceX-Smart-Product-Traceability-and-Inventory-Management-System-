package com.tracex;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tracex.model.Batch;
import com.tracex.model.Inspection;
import com.tracex.model.Message;
import com.tracex.model.Role;
import com.tracex.model.User;
import com.tracex.repository.BatchRepository;
import com.tracex.repository.InspectionRepository;
import com.tracex.repository.UserRepository;
import com.tracex.security.JwtService;
import com.tracex.security.RateLimiter;
import org.bson.Document;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Phase 10.1: role channels and record comments (S-05).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class MessageTests {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private BatchRepository batchRepository;
    @Autowired private InspectionRepository inspectionRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtService jwtService;
    @Autowired private RateLimiter rateLimiter;
    @Autowired private MongoTemplate mongoTemplate;

    private final List<String> userIds = new ArrayList<>();
    private User factory;
    private User factory2;
    private User inspector;
    private User coordinator;
    private User admin;
    private User superFm;
    private Batch batch;
    private Inspection inspection;

    @BeforeEach
    void setUp() {
        rateLimiter.resetAll();
        mongoTemplate.remove(new Query(), Message.class);
        factory = save("m10factory", Role.FACTORY_MANAGER, false);
        factory2 = save("m10factory2", Role.FACTORY_MANAGER, false);
        inspector = save("m10inspector", Role.QUALITY_INSPECTOR, false);
        coordinator = save("m10coord", Role.DISPATCH_COORDINATOR, false);
        admin = save("m10admin", Role.ADMIN, false);
        superFm = save("m10superfm", Role.FACTORY_MANAGER, true);

        Batch b = new Batch();
        b.setBatchCode("TX-M10-001");
        b.setSku("M10");
        b.setProductName("Message Test Honey");
        b.setPackDate(LocalDate.now());
        b.setExpiryDate(LocalDate.now().plusDays(30));
        b.setLifecycleState("ACTIVE");
        batch = batchRepository.save(b);

        Inspection i = new Inspection();
        i.setBatchId(batch.getId());
        i.setBatchCode(batch.getBatchCode());
        i.setStatus("PASSED");
        inspection = inspectionRepository.save(i);
    }

    @AfterEach
    void tearDown() {
        mongoTemplate.remove(new Query(), Message.class);
        inspectionRepository.deleteById(inspection.getId());
        batchRepository.deleteById(batch.getId());
        userRepository.deleteAllById(userIds);
    }

    private User save(String username, Role role, boolean superAdmin) {
        User u = new User(username, passwordEncoder.encode("TestPass123456!"), "Name " + username, username + "@example.com", role, superAdmin);
        u.setEmailVerified(true);
        u = userRepository.save(u);
        userIds.add(u.getId());
        return u;
    }

    private String bearer(User u) {
        return "Bearer " + jwtService.generateToken(u.getId(), u.getTokenVersion());
    }

    private String postBody(User u, String path, String body, int expected) throws Exception {
        return mockMvc.perform(post(path).header("Authorization", bearer(u)).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("body", body))))
                .andExpect(status().is(expected))
                .andReturn().getResponse().getContentAsString();
    }

    private JsonNode getData(User u, String path) throws Exception {
        String res = mockMvc.perform(get(path).header("Authorization", bearer(u)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(res).get("data");
    }

    @Test
    @DisplayName("Channels: each role sees only its own channel; a super-admin sees all five")
    void channelVisibility() throws Exception {
        assertThat(getData(factory, "/api/v1/messages/channels").get("channels")).hasSize(1);
        assertThat(getData(factory, "/api/v1/messages/channels").at("/channels/0").asText()).isEqualTo("factory-manager");
        assertThat(getData(superFm, "/api/v1/messages/channels").get("channels")).hasSize(5);

        postBody(factory, "/api/v1/messages/channel/quality-inspector", "Can you check lot 7?", 403);
        mockMvc.perform(get("/api/v1/messages/channel/quality-inspector").header("Authorization", bearer(factory)))
                .andExpect(status().isForbidden());
        postBody(superFm, "/api/v1/messages/channel/quality-inspector", "Super admin can post anywhere", 201);
        mockMvc.perform(get("/api/v1/messages/channel/not-a-role").header("Authorization", bearer(factory)))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Channels: messages come back oldest first, carry a 90-day expiry, and the channel list shows activity")
    void channelFeedAndRetention() throws Exception {
        postBody(factory, "/api/v1/messages/channel/factory-manager", "First", 201);
        postBody(factory2, "/api/v1/messages/channel/factory-manager", "Second", 201);

        JsonNode feed = getData(factory, "/api/v1/messages/channel/factory-manager");
        assertThat(feed).hasSize(2);
        assertThat(feed.get(0).get("body").asText()).isEqualTo("First");
        assertThat(feed.get(0).get("mine").asBoolean()).isTrue();
        assertThat(feed.get(1).get("mine").asBoolean()).isFalse();
        Instant expires = Instant.parse(feed.get(0).get("expiresAt").asText());
        assertThat(Duration.between(Instant.now(), expires).toDays()).isBetween(89L, 90L);

        JsonNode channels = getData(factory, "/api/v1/messages/channels");
        assertThat(channels.at("/activity/factory-manager/lastBody").asText()).isEqualTo("Second");
        assertThat(channels.at("/activity/factory-manager/total").asLong()).isEqualTo(2);
        assertThat(channels.at("/memberCounts/factory-manager").asLong()).isGreaterThanOrEqualTo(3);
    }

    @Test
    @DisplayName("Record comments: anyone can comment on a batch; comments never expire")
    void batchCommentsArePermanent() throws Exception {
        String path = "/api/v1/messages/record/batch/" + batch.getId();
        postBody(coordinator, path, "Buyer asked for this one first", 201);
        postBody(inspector, path, "Seal looked fine", 201);

        JsonNode thread = getData(factory, path);
        assertThat(thread).hasSize(2);
        assertThat(thread.get(0).get("authorRole").asText()).isEqualTo("dispatch-coordinator");
        assertThat(mongoTemplate.findAll(Message.class)).allMatch(m -> m.getExpiresAt() == null);
    }

    @Test
    @DisplayName("Record comments: dispatch coordinators cannot read or post on inspections; unknown records are 404")
    void inspectionThreadFollowsInspectionAccess() throws Exception {
        String path = "/api/v1/messages/record/inspection/" + inspection.getId();
        postBody(inspector, path, "Rating 4 because of the label", 201);
        postBody(coordinator, path, "Let me see", 403);
        mockMvc.perform(get(path).header("Authorization", bearer(coordinator))).andExpect(status().isForbidden());
        assertThat(getData(factory, path)).hasSize(1);

        postBody(factory, "/api/v1/messages/record/batch/6a0000000000000000000000", "No such batch", 404);
        postBody(factory, "/api/v1/messages/record/product/" + batch.getId(), "Wrong type", 422);
    }

    @Test
    @DisplayName("Validation: an empty or over-long body is a 422 with a field error")
    void bodyValidation() throws Exception {
        String path = "/api/v1/messages/channel/factory-manager";
        postBody(factory, path, "   ", 422);
        String res = postBody(factory, path, "x".repeat(2001), 422);
        assertThat(objectMapper.readTree(res).at("/fieldErrors/0/field").asText()).isEqualTo("body");
    }

    @Test
    @DisplayName("Edits: author only, not even an admin; the previous text is kept in editHistory")
    void editKeepsHistory() throws Exception {
        String res = postBody(factory, "/api/v1/messages/record/batch/" + batch.getId(), "Moisture 12%", 201);
        String id = objectMapper.readTree(res).at("/data/id").asText();

        mockMvc.perform(patch("/api/v1/messages/" + id).header("Authorization", bearer(admin)).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("body", "Moisture 9%"))))
                .andExpect(status().isForbidden());

        mockMvc.perform(patch("/api/v1/messages/" + id).header("Authorization", bearer(factory)).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("body", "Moisture 11%"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.body").value("Moisture 11%"))
                .andExpect(jsonPath("$.data.editCount").value(1));

        Message stored = mongoTemplate.findById(id, Message.class);
        assertThat(stored.getEditHistory()).hasSize(1);
        assertThat(stored.getEditHistory().get(0).getBody()).isEqualTo("Moisture 12%");
    }

    @Test
    @DisplayName("Deletes: author or admin; soft delete keeps the slot and hides the body; others get 403")
    void softDeleteRules() throws Exception {
        String res = postBody(factory, "/api/v1/messages/channel/factory-manager", "Wrong shift posted", 201);
        String id = objectMapper.readTree(res).at("/data/id").asText();

        mockMvc.perform(delete("/api/v1/messages/" + id).header("Authorization", bearer(factory2)))
                .andExpect(status().isForbidden());

        String recordRes = postBody(inspector, "/api/v1/messages/record/batch/" + batch.getId(), "Off-topic", 201);
        String recordId = objectMapper.readTree(recordRes).at("/data/id").asText();
        mockMvc.perform(delete("/api/v1/messages/" + recordId).header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.deleted").value(true))
                .andExpect(jsonPath("$.data.body").doesNotExist());

        mockMvc.perform(delete("/api/v1/messages/" + id).header("Authorization", bearer(factory)))
                .andExpect(status().isOk());
        JsonNode feed = getData(factory2, "/api/v1/messages/channel/factory-manager");
        assertThat(feed).hasSize(1);
        assertThat(feed.get(0).get("deleted").asBoolean()).isTrue();
        assertThat(feed.get(0).has("body") && !feed.get(0).get("body").isNull()).isFalse();
        assertThat(mongoTemplate.findById(id, Message.class)).isNotNull();

        mockMvc.perform(patch("/api/v1/messages/" + id).header("Authorization", bearer(factory)).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("body", "Back again"))))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("Someone who cannot see a channel gets 404 for its messages, so ids reveal nothing")
    void editDeleteNeedChannelAccess() throws Exception {
        String res = postBody(inspector, "/api/v1/messages/channel/quality-inspector", "Inspectors only", 201);
        String id = objectMapper.readTree(res).at("/data/id").asText();
        mockMvc.perform(delete("/api/v1/messages/" + id).header("Authorization", bearer(admin)))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("messages has a TTL index on expiresAt with expireAfterSeconds 0")
    void ttlIndex() throws Exception {
        postBody(factory, "/api/v1/messages/channel/factory-manager", "Index check", 201);
        List<Document> indexes = mongoTemplate.getCollection("messages").listIndexes().into(new ArrayList<>());
        Document ttl = indexes.stream().filter(i -> "expiresAt_ttl_idx".equals(i.getString("name"))).findFirst().orElseThrow();
        assertThat(((Number) ttl.get("expireAfterSeconds")).longValue()).isZero();
    }
}
