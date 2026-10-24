package com.tracex;

import com.tracex.model.Batch;
import com.tracex.model.Role;
import com.tracex.model.User;
import com.tracex.repository.BatchRepository;
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

import java.util.ArrayList;
import java.util.List;

import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * UI/UX redesign backend request B-2: inclusive expiry date range on GET /api/v1/batches
 * (expiryFrom, expiryTo, ISO dates). Missing or broken expiry dates never match a range.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class BatchExpiryRangeTests {

    private static final String SKU = "RANGE-SKU";

    @Autowired private MockMvc mockMvc;
    @Autowired private MongoTemplate mongoTemplate;
    @Autowired private UserRepository userRepository;
    @Autowired private BatchRepository batchRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtService jwtService;
    @Autowired private RateLimiter rateLimiter;

    private final List<String> createdUserIds = new ArrayList<>();
    private String token;

    @BeforeEach
    void setUp() {
        TestDatabaseSafetyGuard.checkTestDatabase(mongoTemplate);
        rateLimiter.resetAll();
        User u = new User("rangeadmin", passwordEncoder.encode("TestPass123456!"), "Range Admin",
                "rangeadmin@example.com", Role.ADMIN, false);
        u.setActive(true);
        u.setEmailVerified(true);
        u = userRepository.save(u);
        createdUserIds.add(u.getId());
        token = jwtService.generateToken(u.getId(), u.getTokenVersion());

        insert("TX-RANGE-A", "2030-01-10", false);
        insert("TX-RANGE-B", "2030-01-20", false);
        insert("TX-RANGE-C", "2030-02-01", false);
        insert("TX-RANGE-ARCH", "2030-01-15", true);
        insert("TX-RANGE-BAD", "not-a-date", false);
        insert("TX-RANGE-NULL", null, false);
    }

    @AfterEach
    void tearDown() {
        mongoTemplate.remove(new Query(Criteria.where("sku").is(SKU)), Batch.class);
        userRepository.deleteAllById(createdUserIds);
        rateLimiter.resetAll();
    }

    private void insert(String code, String expiry, boolean archived) {
        mongoTemplate.getCollection("batches").insertOne(new Document()
                .append("batchCode", code)
                .append("productName", "Range Product")
                .append("sku", SKU)
                .append("packDate", "2029-12-01")
                .append("expiryDate", expiry)
                .append("lifecycleState", "ACTIVE")
                .append("isDeleted", archived));
    }

    @Test
    @DisplayName("B-2: expiryFrom and expiryTo are inclusive and skip archived batches")
    void inclusiveRange() throws Exception {
        mockMvc.perform(get("/api/v1/batches")
                        .param("sku", SKU)
                        .param("expiryFrom", "2030-01-10")
                        .param("expiryTo", "2030-01-20")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(2))
                .andExpect(jsonPath("$.data.data[*].batchCode", containsInAnyOrder("TX-RANGE-A", "TX-RANGE-B")));
    }

    @Test
    @DisplayName("B-2: one-sided ranges never match missing or broken expiry dates")
    void oneSidedRangesExcludeBrokenDates() throws Exception {
        mockMvc.perform(get("/api/v1/batches")
                        .param("sku", SKU)
                        .param("expiryFrom", "2030-01-15")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.data[*].batchCode", containsInAnyOrder("TX-RANGE-B", "TX-RANGE-C")));

        mockMvc.perform(get("/api/v1/batches")
                        .param("sku", SKU)
                        .param("expiryTo", "2030-01-15")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.data[*].batchCode", containsInAnyOrder("TX-RANGE-A")));
    }

    @Test
    @DisplayName("B-2: the range combines with the status filter")
    void combinesWithStatusFilter() throws Exception {
        mockMvc.perform(get("/api/v1/batches")
                        .param("sku", SKU)
                        .param("status", "READY")
                        .param("expiryFrom", "2030-01-01")
                        .param("expiryTo", "2030-01-31")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(2));
    }

    @Test
    @DisplayName("B-2: a reversed range or a malformed date returns 422")
    void invalidRangeIs422() throws Exception {
        mockMvc.perform(get("/api/v1/batches")
                        .param("expiryFrom", "2030-02-01")
                        .param("expiryTo", "2030-01-01")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isUnprocessableEntity());

        mockMvc.perform(get("/api/v1/batches")
                        .param("expiryFrom", "01-02-2030")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isUnprocessableEntity());
    }
}
