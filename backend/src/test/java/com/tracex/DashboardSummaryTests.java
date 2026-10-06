package com.tracex;

import com.tracex.exception.ErrorCode;
import com.tracex.model.AccessRequest;
import com.tracex.model.AccessRequestStatus;
import com.tracex.model.Batch;
import com.tracex.model.Role;
import com.tracex.model.User;
import com.tracex.repository.UserRepository;
import com.tracex.security.JwtService;
import com.tracex.service.FefoService;
import com.tracex.service.SeedRunner;
import com.tracex.util.BatchFreshness;
import com.tracex.util.TestDatabaseSafetyGuard;
import org.bson.Document;
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

import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class DashboardSummaryTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private MongoTemplate mongoTemplate;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private SeedRunner seedRunner;

    @Autowired
    private FefoService fefoService;

    @Autowired
    private Clock clock;

    @BeforeEach
    void setUp() throws Exception {
        TestDatabaseSafetyGuard.checkTestDatabase(mongoTemplate);
        seedRunner.run();
    }

    private String tokenForUser(String username, Role role, boolean isSuperAdmin) {
        User user = userRepository.findByUsername(username).orElseGet(() -> {
            User u = new User(
                    username,
                    passwordEncoder.encode("TestPass123456!"),
                    "Test " + username,
                    username + "@tracex.demo",
                    role,
                    isSuperAdmin
            );
            return userRepository.save(u);
        });
        user.setRole(role);
        user.setSuperAdmin(isSuperAdmin);
        user.setActive(true);
        user.setDeleted(false);
        user = userRepository.save(user);
        return jwtService.generateToken(user.getId(), user.getTokenVersion());
    }

    private long directMongoStatusCount(String status) {
        Query q = new Query(Criteria.where("isDeleted").is(false));
        BatchFreshness.applyStatusFilter(q, status, clock);
        return mongoTemplate.count(q, Batch.class);
    }

    @Test
    @DisplayName("GET /api/v1/dashboard/summary equals direct MongoDB counts, FefoService top 5, and businessDate")
    void testDashboardSummaryEqualsDirectMongoDbCountsAndFefoTop5() throws Exception {
        String adminToken = tokenForUser("dash_admin", Role.ADMIN, false);

        long expectedExpired = directMongoStatusCount("EXPIRED");
        long expectedUrgent = directMongoStatusCount("URGENT");
        long expectedWarning = directMongoStatusCount("WARNING");
        long expectedReady = directMongoStatusCount("READY");
        long expectedException = directMongoStatusCount("EXCEPTION");
        long expectedDispatched = directMongoStatusCount("DISPATCHED");
        long expectedTotalActive = expectedExpired + expectedUrgent + expectedWarning + expectedReady + expectedException;

        long expectedPassed = mongoTemplate.count(
                new Query(Criteria.where("isDeleted").is(false).and("qualityCheck.status").is("PASSED")),
                Batch.class
        );
        long expectedFailed = mongoTemplate.count(
                new Query(Criteria.where("isDeleted").is(false).and("qualityCheck.status").is("FAILED")),
                Batch.class
        );
        long expectedFlagged = mongoTemplate.count(
                new Query(Criteria.where("isDeleted").is(false).and("qualityCheck.status").is("FLAGGED")),
                Batch.class
        );
        long totalNonDeleted = mongoTemplate.count(
                new Query(Criteria.where("isDeleted").is(false)),
                Batch.class
        );
        long expectedNone = totalNonDeleted - (expectedPassed + expectedFailed + expectedFlagged);

        List<com.tracex.dto.BatchSummaryDto> expectedTop5 = fefoService.getFefoQueue(null, null, clock)
                .getQueue()
                .stream()
                .limit(5)
                .toList();
        assertThat(expectedTop5).isNotEmpty();

        String expectedBusinessDate = LocalDate.now(clock).toString();

        mockMvc.perform(get("/api/v1/dashboard/summary")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.businessDate").value(expectedBusinessDate))
                .andExpect(jsonPath("$.data.expired").value(expectedExpired))
                .andExpect(jsonPath("$.data.urgent").value(expectedUrgent))
                .andExpect(jsonPath("$.data.warning").value(expectedWarning))
                .andExpect(jsonPath("$.data.ready").value(expectedReady))
                .andExpect(jsonPath("$.data.exception").value(expectedException))
                .andExpect(jsonPath("$.data.dispatched").value(expectedDispatched))
                .andExpect(jsonPath("$.data.totalActive").value(expectedTotalActive))
                .andExpect(jsonPath("$.data.statusCounts.EXPIRED").value(expectedExpired))
                .andExpect(jsonPath("$.data.statusCounts.URGENT").value(expectedUrgent))
                .andExpect(jsonPath("$.data.statusCounts.WARNING").value(expectedWarning))
                .andExpect(jsonPath("$.data.statusCounts.READY").value(expectedReady))
                .andExpect(jsonPath("$.data.statusCounts.EXCEPTION").value(expectedException))
                .andExpect(jsonPath("$.data.statusCounts.DISPATCHED").value(expectedDispatched))
                .andExpect(jsonPath("$.data.inspectionVerdicts.PASSED").value(expectedPassed))
                .andExpect(jsonPath("$.data.inspectionVerdicts.FAILED").value(expectedFailed))
                .andExpect(jsonPath("$.data.inspectionVerdicts.FLAGGED").value(expectedFlagged))
                .andExpect(jsonPath("$.data.inspectionVerdicts.none").value(expectedNone))
                .andExpect(jsonPath("$.data.topExpiring", hasSize(expectedTop5.size())))
                .andExpect(jsonPath("$.data.topExpiring[0].batchCode").value(expectedTop5.get(0).getBatchCode()))
                .andExpect(jsonPath("$.data.topExpiring[0].rank").value(1));
    }

    @Test
    @DisplayName("GET /api/v1/dashboard/summary counts corrupted-date batches only under EXCEPTION")
    void testCorruptedDateBatchCountsOnlyUnderException() throws Exception {
        String adminToken = tokenForUser("dash_admin_exc", Role.ADMIN, false);

        long baseExpired = directMongoStatusCount("EXPIRED");
        long baseUrgent = directMongoStatusCount("URGENT");
        long baseWarning = directMongoStatusCount("WARNING");
        long baseReady = directMongoStatusCount("READY");
        long baseException = directMongoStatusCount("EXCEPTION");
        long baseDispatched = directMongoStatusCount("DISPATCHED");

        List<String> insertedCodes = new ArrayList<>();
        try {
            // 1. Missing expiryDate
            String codeMissing = "TX-DASH-CORRUPT-MISSING";
            insertedCodes.add(codeMissing);
            mongoTemplate.getCollection("batches").insertOne(new Document()
                    .append("batchCode", codeMissing)
                    .append("productName", "Corrupt Missing Expiry")
                    .append("sku", "WBJC")
                    .append("packDate", "2026-10-01")
                    .append("lifecycleState", "ACTIVE")
                    .append("isDeleted", false));

            // 2. Null expiryDate
            String codeNull = "TX-DASH-CORRUPT-NULL";
            insertedCodes.add(codeNull);
            mongoTemplate.getCollection("batches").insertOne(new Document()
                    .append("batchCode", codeNull)
                    .append("productName", "Corrupt Null Expiry")
                    .append("sku", "WBJC")
                    .append("packDate", "2026-10-01")
                    .append("expiryDate", null)
                    .append("lifecycleState", "ACTIVE")
                    .append("isDeleted", false));

            // 3. Unparseable string "not-a-date"
            String codeInvalid = "TX-DASH-CORRUPT-STR";
            insertedCodes.add(codeInvalid);
            mongoTemplate.getCollection("batches").insertOne(new Document()
                    .append("batchCode", codeInvalid)
                    .append("productName", "Corrupt String Expiry")
                    .append("sku", "WBJC")
                    .append("packDate", "2026-10-01")
                    .append("expiryDate", "not-a-date")
                    .append("lifecycleState", "ACTIVE")
                    .append("isDeleted", false));

            // 4. Impossible calendar date "2026-02-31"
            String codeImpossible = "TX-DASH-CORRUPT-FEB31";
            insertedCodes.add(codeImpossible);
            mongoTemplate.getCollection("batches").insertOne(new Document()
                    .append("batchCode", codeImpossible)
                    .append("productName", "Corrupt Impossible Calendar Date")
                    .append("sku", "WBJC")
                    .append("packDate", "2026-10-01")
                    .append("expiryDate", "2026-02-31")
                    .append("lifecycleState", "ACTIVE")
                    .append("isDeleted", false));

            mockMvc.perform(get("/api/v1/dashboard/summary")
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.expired").value(baseExpired))
                    .andExpect(jsonPath("$.data.urgent").value(baseUrgent))
                    .andExpect(jsonPath("$.data.warning").value(baseWarning))
                    .andExpect(jsonPath("$.data.ready").value(baseReady))
                    .andExpect(jsonPath("$.data.dispatched").value(baseDispatched))
                    .andExpect(jsonPath("$.data.exception").value(baseException + 4))
                    .andExpect(jsonPath("$.data.statusCounts.EXCEPTION").value(baseException + 4));
        } finally {
            mongoTemplate.remove(
                    new Query(Criteria.where("batchCode").in(insertedCodes)),
                    Batch.class
            );
        }
    }

    @Test
    @DisplayName("GET /api/v1/dashboard/summary scopes pendingAccessRequests to manager, admin, and super-admin only")
    void testDashboardSummaryRoleScopingForPendingAccessRequests() throws Exception {
        long expectedPending = mongoTemplate.count(
                new Query(Criteria.where("status").is(AccessRequestStatus.PENDING)),
                AccessRequest.class
        );
        assertThat(expectedPending).isGreaterThanOrEqualTo(1L);

        String superAdminToken = tokenForUser("dash_superadmin", Role.ADMIN, true);
        String adminToken = tokenForUser("dash_admin_role", Role.ADMIN, false);
        String managerToken = tokenForUser("dash_manager_role", Role.MANAGER, false);
        String factoryToken = tokenForUser("dash_factory_role", Role.FACTORY_MANAGER, false);
        String inspectorToken = tokenForUser("dash_inspector_role", Role.QUALITY_INSPECTOR, false);
        String coordinatorToken = tokenForUser("dash_coord_role", Role.DISPATCH_COORDINATOR, false);

        for (String privilegedToken : List.of(superAdminToken, adminToken, managerToken)) {
            mockMvc.perform(get("/api/v1/dashboard/summary")
                            .header("Authorization", "Bearer " + privilegedToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.pendingAccessRequests").value(expectedPending));
        }

        for (String nonAdminToken : List.of(factoryToken, inspectorToken, coordinatorToken)) {
            mockMvc.perform(get("/api/v1/dashboard/summary")
                            .header("Authorization", "Bearer " + nonAdminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.pendingAccessRequests").value(nullValue()));
        }
    }

    @Test
    @DisplayName("GET /api/v1/dashboard/summary returns 401 AUTH_NO_TOKEN when unauthenticated")
    void testDashboardSummaryAnonymousReturns401() throws Exception {
        mockMvc.perform(get("/api/v1/dashboard/summary"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value(ErrorCode.AUTH_NO_TOKEN.name()))
                .andExpect(jsonPath("$.requestId").isNotEmpty());
    }
}
