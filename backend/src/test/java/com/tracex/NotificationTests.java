package com.tracex;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tracex.model.Notification;
import com.tracex.model.Product;
import com.tracex.model.Role;
import com.tracex.model.User;
import com.tracex.repository.BatchRepository;
import com.tracex.repository.ProductRepository;
import com.tracex.repository.UserRepository;
import com.tracex.security.JwtService;
import com.tracex.security.RateLimiter;
import com.tracex.service.NotificationService;
import com.tracex.service.NotificationStreamRegistry;
import org.bson.Document;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Phase 10: notifications (M-09) and the SSE stream (D-4, TEST-M-09).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class NotificationTests {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private ProductRepository productRepository;
    @Autowired private BatchRepository batchRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtService jwtService;
    @Autowired private RateLimiter rateLimiter;
    @Autowired private MongoTemplate mongoTemplate;
    @Autowired private NotificationService notificationService;
    @Autowired private NotificationStreamRegistry streamRegistry;

    private final List<String> userIds = new ArrayList<>();
    private final List<String> productIds = new ArrayList<>();
    private User factory;
    private User inspector;
    private User coordinator;
    private User superFm;

    @BeforeEach
    void setUp() {
        rateLimiter.resetAll();
        mongoTemplate.remove(new Query(), Notification.class);
        factory = save("n10factory", Role.FACTORY_MANAGER, false);
        inspector = save("n10inspector", Role.QUALITY_INSPECTOR, false);
        coordinator = save("n10coord", Role.DISPATCH_COORDINATOR, false);
        superFm = save("n10superfm", Role.FACTORY_MANAGER, true);
    }

    @AfterEach
    void tearDown() {
        mongoTemplate.remove(new Query(), Notification.class);
        for (String pid : productIds) {
            batchRepository.deleteAll(mongoTemplate.find(Query.query(Criteria.where("productId").is(pid)), com.tracex.model.Batch.class));
        }
        productRepository.deleteAllById(productIds);
        userRepository.deleteAllById(userIds);
    }

    private User save(String username, Role role, boolean superAdmin) {
        User u = new User(username, passwordEncoder.encode("TestPass123456!"), "Name " + username, username + "@example.com", role, superAdmin);
        u.setEmailVerified(true);
        u = userRepository.save(u);
        userIds.add(u.getId());
        return u;
    }

    private String token(User u) {
        return jwtService.generateToken(u.getId(), u.getTokenVersion());
    }

    private JsonNode list(User u) throws Exception {
        String body = mockMvc.perform(get("/api/v1/notifications").header("Authorization", "Bearer " + token(u)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("data");
    }

    private String createBatchAs(User actor) throws Exception {
        Product p = new Product();
        p.setSku("N10-" + System.nanoTime());
        p.setProductName("Notification Test Honey");
        p.setCategory("Honey");
        p.setBaseShelfLifeDays(60);
        p.setRiskLevel("low");
        p = productRepository.save(p);
        productIds.add(p.getId());
        Map<String, Object> body = Map.of(
                "productId", p.getId(), "sourceLotCode", "N10-LOT", "farmerName", "PrivateFarmerN10",
                "village", "Almora", "quantityProduced", 10, "unit", "Kg", "yieldPercent", 90.0,
                "packDate", LocalDate.now().toString());
        String res = mockMvc.perform(post("/api/v1/batches").header("Authorization", "Bearer " + token(actor))
                        .contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(res).at("/data/batchCode").asText();
    }

    @Test
    @DisplayName("Creating a batch notifies inspectors and coordinators, never the person who created it")
    void batchCreatedReachesWatchersButNotTheCreator() throws Exception {
        String code = createBatchAs(factory);

        JsonNode inspectorList = list(inspector);
        assertThat(inspectorList.get("unreadCount").asLong()).isEqualTo(1);
        assertThat(inspectorList.at("/items/0/type").asText()).isEqualTo("batch_created");
        assertThat(inspectorList.at("/items/0/title").asText()).contains(code);
        assertThat(inspectorList.at("/items/0/read").asBoolean()).isFalse();
        assertThat(list(coordinator).get("unreadCount").asLong()).isEqualTo(1);
        assertThat(list(factory).get("unreadCount").asLong()).isZero();
        // No farmer name anywhere in stored notifications (D-9)
        assertThat(mongoTemplate.getCollection("notifications").find().into(new ArrayList<>()).toString())
                .doesNotContain("PrivateFarmerN10");
    }

    @Test
    @DisplayName("Read state is per person: one inspector reading it leaves it unread for the coordinator")
    void readStateIsPerUser() throws Exception {
        notificationService.batchCreated(factory, "b-1", "TX-N10-001", "Honey");
        String id = list(inspector).at("/items/0/id").asText();

        mockMvc.perform(patch("/api/v1/notifications/" + id + "/read").header("Authorization", "Bearer " + token(inspector)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.read").value(true));

        assertThat(list(inspector).get("unreadCount").asLong()).isZero();
        assertThat(list(coordinator).get("unreadCount").asLong()).isEqualTo(1);
    }

    @Test
    @DisplayName("Read-all marks only the caller's notifications; someone else's personal notification is a 404")
    void readAllAndOwnershipChecks() throws Exception {
        notificationService.batchCreated(factory, "b-1", "TX-N10-002", "Honey");
        notificationService.batchCreated(factory, "b-2", "TX-N10-003", "Honey");
        notificationService.importFinished(factory, "job-1", "done", 2, 0, 0);

        mockMvc.perform(patch("/api/v1/notifications/read-all").header("Authorization", "Bearer " + token(inspector)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.marked").value(3)); // two batch_created + one batch_imported
        assertThat(list(inspector).get("unreadCount").asLong()).isZero();
        assertThat(list(coordinator).get("unreadCount").asLong()).isEqualTo(3);

        JsonNode mine = list(factory);
        assertThat(mine.at("/items/0/type").asText()).isEqualTo("import_finished");
        String personalId = mine.at("/items/0/id").asText();
        mockMvc.perform(patch("/api/v1/notifications/" + personalId + "/read").header("Authorization", "Bearer " + token(inspector)))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("A failed inspection tells the factory manager the batch is on quality hold")
    void failedInspectionMentionsQualityHold() throws Exception {
        notificationService.inspectionCompleted(inspector, "i-1", "b-9", "TX-N10-009", "FAILED");
        JsonNode items = list(factory).get("items");
        assertThat(items.get(0).get("title").asText()).isEqualTo("Inspection FAILED: TX-N10-009");
        assertThat(items.get(0).get("message").asText()).contains("quality hold");
    }

    @Test
    @DisplayName("A super-admin with a non-admin role receives notifications addressed to admins")
    void superAdminReceivesAdminNotifications() throws Exception {
        mockMvc.perform(post("/api/v1/auth/request-access").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", "N Ten", "email", "n10-applicant@example.com", "role", "manager"))))
                .andExpect(status().isOk());
        try {
            JsonNode items = list(superFm).get("items");
            assertThat(items).anyMatch(n -> "admin_action".equals(n.get("type").asText()));
            assertThat(list(factory).get("unreadCount").asLong()).isZero();
        } finally {
            mongoTemplate.remove(Query.query(Criteria.where("email").is("n10-applicant@example.com")), "accessrequests");
        }
    }

    @Test
    @DisplayName("TEST-M-09: a connected SSE stream receives batch:created when a batch is created")
    void streamDeliversBatchCreated() throws Exception {
        MvcResult stream = mockMvc.perform(get("/api/v1/notifications/stream")
                        .header("Authorization", "Bearer " + token(inspector))
                        .accept(MediaType.TEXT_EVENT_STREAM))
                .andExpect(request().asyncStarted())
                .andReturn();

        String code = createBatchAs(factory);

        String content = "";
        for (int i = 0; i < 50 && !content.contains("event:batch:created"); i++) {
            Thread.sleep(50);
            content = stream.getResponse().getContentAsString();
        }
        assertThat(content).contains("event:ready");
        assertThat(content).contains("event:batch:created");
        assertThat(content).contains(code);
        assertThat(content).doesNotContain("PrivateFarmerN10");
    }

    @Test
    @DisplayName("The stream closes on the next heartbeat after the user's sessions are revoked")
    void streamClosesAfterSessionRevocation() throws Exception {
        MvcResult stream = mockMvc.perform(get("/api/v1/notifications/stream")
                        .header("Authorization", "Bearer " + token(coordinator))
                        .accept(MediaType.TEXT_EVENT_STREAM))
                .andExpect(request().asyncStarted())
                .andReturn();
        assertThat(streamRegistry.openConnectionCount(coordinator.getId())).isEqualTo(1);

        User revoked = userRepository.findById(coordinator.getId()).orElseThrow();
        revoked.setTokenVersion(revoked.getTokenVersion() + 1);
        userRepository.save(revoked);
        streamRegistry.sendHeartbeats();

        assertThat(streamRegistry.openConnectionCount(coordinator.getId())).isZero();
        assertThat(stream.getAsyncResult(1000)).isNull();
    }

    @Test
    @DisplayName("notifications has a 7-day TTL index on createdAt")
    void notificationTtlIndex() {
        notificationService.batchCreated(factory, "b-1", "TX-N10-TTL", "Honey");
        List<Document> indexes = mongoTemplate.getCollection("notifications").listIndexes().into(new ArrayList<>());
        Document ttl = indexes.stream().filter(i -> "createdAt_ttl_idx".equals(i.getString("name"))).findFirst().orElseThrow();
        assertThat(((Number) ttl.get("expireAfterSeconds")).longValue()).isEqualTo(Notification.TTL_SECONDS);
        assertThat(mongoTemplate.findAll(Notification.class).get(0).getCreatedAt()).isBefore(Instant.now().plusSeconds(1));
    }
}
