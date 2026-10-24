package com.tracex;

import com.tracex.model.Role;
import com.tracex.model.User;
import com.tracex.repository.UserRepository;
import com.tracex.security.JwtService;
import com.tracex.security.RateLimiter;
import com.tracex.util.TestDatabaseSafetyGuard;
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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * UI/UX redesign backend request B-2 (inspections part): inclusive `from` / `to` business dates on
 * GET /api/v1/inspections and GET /api/v1/inspections/my, on the date the inspection was recorded.
 * Dates are in the business timezone (Asia/Kolkata in tests), so 18:45 UTC counts as the next day.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class InspectionDateRangeTests {

    private static final String PREFIX = "TX-IRANGE-";

    @Autowired private MockMvc mockMvc;
    @Autowired private MongoTemplate mongoTemplate;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtService jwtService;
    @Autowired private RateLimiter rateLimiter;

    private final List<String> createdUserIds = new ArrayList<>();
    private String token;
    private String userId;

    @BeforeEach
    void setUp() {
        TestDatabaseSafetyGuard.checkTestDatabase(mongoTemplate);
        rateLimiter.resetAll();
        User u = new User("irangeinspector", passwordEncoder.encode("TestPass123456!"), "Range Inspector",
                "irangeinspector@example.com", Role.QUALITY_INSPECTOR, false);
        u.setActive(true);
        u.setEmailVerified(true);
        u = userRepository.save(u);
        createdUserIds.add(u.getId());
        userId = u.getId();
        token = jwtService.generateToken(u.getId(), u.getTokenVersion());

        // 2031-03-10 10:00 IST, 2031-03-11 00:15 IST (18:45 UTC on the 10th), 2031-03-12 23:59 IST
        insert("A", "2031-03-10T04:30:00Z", "PASSED", true);
        insert("B", "2031-03-10T18:45:00Z", "FAILED", true);
        insert("C", "2031-03-12T18:29:00Z", "PASSED", true);
        insert("OLD", "2031-03-11T05:00:00Z", "FLAGGED", false);
    }

    @AfterEach
    void tearDown() {
        mongoTemplate.remove(new Query(Criteria.where("batchCode").regex("^" + PREFIX)), "inspections");
        userRepository.deleteAllById(createdUserIds);
        rateLimiter.resetAll();
    }

    private void insert(String suffix, String createdAt, String verdict, boolean latest) {
        mongoTemplate.getCollection("inspections").insertOne(new Document()
                .append("batchId", "irange-" + suffix)
                .append("batchCode", PREFIX + suffix)
                .append("status", verdict)
                .append("isLatest", latest)
                .append("inspectedBy", new Document("userId", userId).append("username", "irangeinspector"))
                .append("createdAt", Date.from(Instant.parse(createdAt))));
    }

    @Test
    @DisplayName("B-2: from and to are inclusive business dates on the recorded time")
    void inclusiveBusinessDates() throws Exception {
        mockMvc.perform(get("/api/v1/inspections")
                        .param("from", "2031-03-10")
                        .param("to", "2031-03-10")
                        .param("limit", "200")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.data[*].batchCode", containsInAnyOrder(PREFIX + "A")));

        mockMvc.perform(get("/api/v1/inspections")
                        .param("from", "2031-03-11")
                        .param("to", "2031-03-12")
                        .param("limit", "200")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.data[*].batchCode", containsInAnyOrder(PREFIX + "B", PREFIX + "C")));
    }

    @Test
    @DisplayName("B-2: the range combines with the verdict filter and the My inspections list")
    void combinesWithVerdictAndMine() throws Exception {
        mockMvc.perform(get("/api/v1/inspections")
                        .param("status", "PASSED")
                        .param("from", "2031-03-01")
                        .param("limit", "200")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.data[*].batchCode", containsInAnyOrder(PREFIX + "A", PREFIX + "C")));

        // My inspections include older (not latest) records too
        mockMvc.perform(get("/api/v1/inspections/my")
                        .param("from", "2031-03-11")
                        .param("to", "2031-03-11")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.data[*].batchCode", containsInAnyOrder(PREFIX + "B", PREFIX + "OLD")));
    }

    @Test
    @DisplayName("B-2: a reversed range or a malformed date returns 422")
    void invalidRangeIs422() throws Exception {
        mockMvc.perform(get("/api/v1/inspections")
                        .param("from", "2031-03-12")
                        .param("to", "2031-03-10")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isUnprocessableEntity());

        mockMvc.perform(get("/api/v1/inspections/my")
                        .param("to", "12-03-2031")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isUnprocessableEntity());
    }
}
