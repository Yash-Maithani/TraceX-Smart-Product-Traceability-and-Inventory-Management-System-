package com.tracex;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tracex.model.Batch;
import com.tracex.model.Notification;
import com.tracex.model.ProductReport;
import com.tracex.model.Role;
import com.tracex.model.User;
import com.tracex.repository.BatchRepository;
import com.tracex.repository.ProductReportRepository;
import com.tracex.repository.UserRepository;
import com.tracex.security.JwtService;
import com.tracex.security.RateLimiter;
import com.tracex.service.TraceTokenService;
import com.tracex.util.TestDatabaseSafetyGuard;
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

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Shopper problem reports: public POST /api/v1/qr/report, staff list and resolve. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class ProductReportTests {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private MongoTemplate mongoTemplate;
    @Autowired private BatchRepository batchRepository;
    @Autowired private ProductReportRepository reportRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private TraceTokenService traceTokenService;
    @Autowired private RateLimiter rateLimiter;
    @Autowired private JwtService jwtService;
    @Autowired private PasswordEncoder passwordEncoder;

    private Batch batch;

    @BeforeEach
    void setUp() {
        TestDatabaseSafetyGuard.checkTestDatabase(mongoTemplate);
        rateLimiter.resetAll();
        ensureUser("prt_inspector", Role.QUALITY_INSPECTOR);

        Batch b = new Batch();
        b.setProductName("Report Test Pickle");
        b.setSku("PRT-SKU");
        b.setSourceLotCode("PRT-LOT");
        b.setFarmerName("Private Farmer");
        b.setVillage("Hill Village");
        b.setQuantityProduced(50);
        b.setUnit("Jar");
        b.setYieldPercent(90.0);
        b.setBatchCode("TX-PRT-" + UUID.randomUUID().toString().substring(0, 6));
        b.setPackDate(LocalDate.of(2026, 9, 1));
        b.setExpiryDate(LocalDate.of(2027, 3, 1));
        b.setLifecycleState("ACTIVE");
        b.setTraceToken(traceTokenService.generateToken());
        batch = batchRepository.save(b);
    }

    @AfterEach
    void tearDown() {
        rateLimiter.resetAll();
        reportRepository.deleteAll(reportRepository.findByBatchIdOrderByCreatedAtDesc(batch.getId()));
        mongoTemplate.remove(Query.query(Criteria.where("refId").is(batch.getId())), Notification.class);
        batchRepository.delete(batch);
    }

    private void ensureUser(String username, Role role) {
        if (userRepository.findByUsername(username).isEmpty()) {
            User u = new User();
            u.setUsername(username);
            u.setName("Report Inspector");
            u.setEmail(username + "@example.com");
            u.setPasswordHash(passwordEncoder.encode("TestPass123456!"));
            u.setRole(role);
            u.setActive(true);
            u.setTokenVersion(1);
            userRepository.save(u);
        }
    }

    private String token(String username) {
        User u = userRepository.findByUsername(username).orElseThrow();
        return jwtService.generateToken(u.getId(), u.getTokenVersion());
    }

    private String reportBody(String category, String message, String contact) throws Exception {
        Map<String, Object> m = new HashMap<>();
        m.put("token", batch.getTraceToken());
        m.put("category", category);
        m.put("message", message);
        if (contact != null) m.put("contact", contact);
        return objectMapper.writeValueAsString(m);
    }

    @Test
    @DisplayName("A shopper report is stored, notifies the quality team without personal data, and staff can read it")
    void shopperReportIsStoredAndNotified() throws Exception {
        mockMvc.perform(post("/api/v1/qr/report").contentType(MediaType.APPLICATION_JSON)
                        .content(reportBody("FOREIGN_OBJECT", "Found a small stone in the jar.", "shopper@example.com")))
                .andExpect(status().isCreated());

        List<ProductReport> stored = reportRepository.findByBatchIdOrderByCreatedAtDesc(batch.getId());
        assertThat(stored).hasSize(1);
        assertThat(stored.get(0).getStatus()).isEqualTo("OPEN");
        assertThat(stored.get(0).getIpHash()).isNotBlank();

        List<Notification> notes = mongoTemplate.find(
                Query.query(Criteria.where("refId").is(batch.getId()).and("type").is("product_report")), Notification.class);
        assertThat(notes).hasSize(1);
        assertThat(notes.get(0).getRecipientRoles()).containsExactlyInAnyOrder("quality-inspector", "manager", "admin");
        assertThat(notes.get(0).getMessage()).contains("Something in the product").doesNotContain("stone", "shopper@example.com");

        String res = mockMvc.perform(get("/api/v1/batches/" + batch.getId() + "/reports")
                        .header("Authorization", "Bearer " + token("prt_inspector")))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        JsonNode data = objectMapper.readTree(res).path("data");
        assertThat(data).hasSize(1);
        assertThat(data.get(0).path("message").asText()).isEqualTo("Found a small stone in the jar.");
        assertThat(data.get(0).path("contact").asText()).isEqualTo("shopper@example.com");
        assertThat(data.get(0).has("ipHash")).isFalse();
    }

    @Test
    @DisplayName("Illness reports are flagged urgent in the notification title")
    void illnessReportIsUrgent() throws Exception {
        mockMvc.perform(post("/api/v1/qr/report").contentType(MediaType.APPLICATION_JSON)
                        .content(reportBody("ILLNESS", "Stomach ache after eating this.", null)))
                .andExpect(status().isCreated());
        Notification n = mongoTemplate.findOne(
                Query.query(Criteria.where("refId").is(batch.getId()).and("type").is("product_report")), Notification.class);
        assertThat(n).isNotNull();
        assertThat(n.getTitle()).startsWith("Urgent shopper report");
    }

    @Test
    @DisplayName("Bad token, unknown category, short message and archived batch are rejected")
    void invalidReportsAreRejected() throws Exception {
        mockMvc.perform(post("/api/v1/qr/report").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"not.a.token\",\"category\":\"OTHER\",\"message\":\"Something is wrong here.\"}"))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/v1/qr/report").contentType(MediaType.APPLICATION_JSON)
                        .content(reportBody("BAD_CATEGORY", "Something is wrong here.", null)))
                .andExpect(status().isUnprocessableEntity());
        mockMvc.perform(post("/api/v1/qr/report").contentType(MediaType.APPLICATION_JSON)
                        .content(reportBody("OTHER", "short", null)))
                .andExpect(status().isUnprocessableEntity());

        batch.setDeleted(true);
        batchRepository.save(batch);
        mockMvc.perform(post("/api/v1/qr/report").contentType(MediaType.APPLICATION_JSON)
                        .content(reportBody("OTHER", "Something is wrong here.", null)))
                .andExpect(status().isNotFound());
        assertThat(reportRepository.findByBatchIdOrderByCreatedAtDesc(batch.getId())).isEmpty();
    }

    @Test
    @DisplayName("Reports are rate-limited per device")
    void reportsAreRateLimited() throws Exception {
        for (int i = 0; i < 5; i++) {
            mockMvc.perform(post("/api/v1/qr/report").contentType(MediaType.APPLICATION_JSON)
                            .content(reportBody("PACKAGING", "Lid was loose on purchase " + i, null)))
                    .andExpect(status().isCreated());
        }
        mockMvc.perform(post("/api/v1/qr/report").contentType(MediaType.APPLICATION_JSON)
                        .content(reportBody("PACKAGING", "Lid was loose on purchase again", null)))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    @DisplayName("An inspector resolves a report once, with an optional note")
    void inspectorResolvesReport() throws Exception {
        mockMvc.perform(post("/api/v1/qr/report").contentType(MediaType.APPLICATION_JSON)
                        .content(reportBody("TASTE_OR_SMELL", "Tasted sour, not like usual.", null)))
                .andExpect(status().isCreated());
        String reportId = reportRepository.findByBatchIdOrderByCreatedAtDesc(batch.getId()).get(0).getId();

        mockMvc.perform(patch("/api/v1/product-reports/" + reportId + "/resolve")
                        .header("Authorization", "Bearer " + token("prt_inspector"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"note\":\"Retained sample tasted normal; shopper contacted.\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("RESOLVED"))
                .andExpect(jsonPath("$.data.resolvedByName").value("Report Inspector"))
                .andExpect(jsonPath("$.data.resolutionNote").value("Retained sample tasted normal; shopper contacted."));

        mockMvc.perform(patch("/api/v1/product-reports/" + reportId + "/resolve")
                        .header("Authorization", "Bearer " + token("prt_inspector"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnprocessableEntity());
    }
}
