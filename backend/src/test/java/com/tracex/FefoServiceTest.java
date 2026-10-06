package com.tracex;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tracex.dto.BatchDispatchDto;
import com.tracex.dto.BatchSummaryDto;
import com.tracex.exception.ApiException;
import com.tracex.exception.ErrorCode;
import com.tracex.model.Batch;
import com.tracex.model.Product;
import com.tracex.model.Role;
import com.tracex.model.User;
import com.tracex.repository.BatchRepository;
import com.tracex.repository.ProductRepository;
import com.tracex.repository.UserRepository;
import com.tracex.security.JwtService;
import com.tracex.service.BatchService;
import com.tracex.service.FefoService;
import com.tracex.service.FefoService.FefoResult;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class FefoServiceTest {

    @Autowired private FefoService fefoService;
    @Autowired private BatchService batchService;
    @Autowired private BatchRepository batchRepository;
    @Autowired private ProductRepository productRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private MongoTemplate mongoTemplate;
    @Autowired private JwtService jwtService;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;

    private static final Instant FIXED_NOW = Instant.parse("2026-06-15T10:00:00Z");
    private static final Clock FIXED_CLOCK = Clock.fixed(FIXED_NOW, ZoneOffset.UTC);

    private User coordinator;
    private User admin;
    private User factoryMgr;
    private String coordinatorToken;
    private String adminToken;
    private String factoryMgrToken;

    @org.junit.jupiter.api.AfterAll
    static void restoreSeedAfterClass(
            @Autowired BatchRepository batchRepository,
            @Autowired ProductRepository productRepository,
            @Autowired UserRepository userRepository,
            @Autowired com.tracex.service.SeedRunner seedRunner) {
        batchRepository.deleteAll();
        productRepository.deleteAll();
        userRepository.deleteAll();
        seedRunner.run();
    }

    @BeforeEach
    void setUp() {
        batchRepository.deleteAll();
        productRepository.deleteAll();
        userRepository.deleteAll();

        coordinator = new User("coord_fefo", passwordEncoder.encode("TestPass123456!"),
                "Coord FEFO", "coord_fefo@tracex.demo", Role.DISPATCH_COORDINATOR, false);
        coordinator.setActive(true);
        coordinator = userRepository.save(coordinator);
        coordinatorToken = jwtService.generateToken(coordinator.getId(), coordinator.getTokenVersion());

        admin = new User("admin_fefo", passwordEncoder.encode("TestPass123456!"),
                "Admin FEFO", "admin_fefo@tracex.demo", Role.ADMIN, false);
        admin.setActive(true);
        admin = userRepository.save(admin);
        adminToken = jwtService.generateToken(admin.getId(), admin.getTokenVersion());

        factoryMgr = new User("fm_fefo", passwordEncoder.encode("TestPass123456!"),
                "FM FEFO", "fm_fefo@tracex.demo", Role.FACTORY_MANAGER, false);
        factoryMgr.setActive(true);
        factoryMgr = userRepository.save(factoryMgr);
        factoryMgrToken = jwtService.generateToken(factoryMgr.getId(), factoryMgr.getTokenVersion());

        saveProduct("KMGC", "Kashmiri Garlic Cloves", "Spices", "HIGH", 180);
        saveProduct("RHSLT", "Raw Himalayan Salt", "Minerals", "LOW", 365);
        saveProduct("ALPH", "Alphonso Mango Pulp", "Fruits", "MEDIUM", 30);
    }

    private Product saveProduct(String sku, String name, String category, String riskLevel, int shelfLifeDays) {
        Product p = new Product();
        p.setSku(sku);
        p.setProductName(name);
        p.setCategory(category);
        p.setRiskLevel(riskLevel);
        p.setBaseShelfLifeDays(shelfLifeDays);
        return productRepository.save(p);
    }

    private Batch saveBatch(String code, String sku, String productName, Instant expiryDate,
                            Instant createdAt, String lifecycleState, boolean isDeleted, double priorityScore) {
        LocalDate expiryLocal = expiryDate != null ? expiryDate.atZone(ZoneOffset.UTC).toLocalDate() : null;
        return saveBatchLocalDate(code, sku, productName, expiryLocal, createdAt, lifecycleState, isDeleted, priorityScore);
    }

    private Batch saveBatchLocalDate(String code, String sku, String productName, LocalDate expiryDate,
                                     Instant createdAt, String lifecycleState, boolean isDeleted, double priorityScore) {
        Batch b = new Batch();
        b.setBatchCode(code);
        b.setSku(sku);
        b.setProductName(productName);
        b.setSourceLotCode("LOT-" + code);
        b.setFarmerName("Farmer " + code);
        b.setVillage("Village " + code);
        b.setQuantityProduced(100);
        b.setUnit("Kg");
        b.setYieldPercent(85.0);
        b.setPackDate(FIXED_NOW.minus(10, ChronoUnit.DAYS).atZone(ZoneOffset.UTC).toLocalDate());
        b.setExpiryDate(expiryDate);
        b.setDataSource("fallback");
        b.setShelfLifeSource("base");
        b.setLifecycleState(lifecycleState);
        b.setDeleted(isDeleted);
        b.setPriorityScore(priorityScore);
        Batch saved = batchRepository.save(b);
        if (createdAt != null) {
            mongoTemplate.getCollection("batches").updateOne(
                    new Document("_id", new ObjectId(saved.getId())),
                    new Document("$set", new Document("createdAt", Date.from(createdAt)))
            );
            saved.setCreatedAt(createdAt);
        }
        return saved;
    }

    @Test
    @DisplayName("1. Three groups: future expiry -> queue, daysUntilExpiry <= 0 -> expired, null or unparseable expiryDate -> exceptions")
    void testThreeGroupsClassification() {
        saveBatch("TX-Q-001", "KMGC", "Kashmiri Garlic Cloves",
                FIXED_NOW.plus(5, ChronoUnit.DAYS), FIXED_NOW.minus(2, ChronoUnit.DAYS), "ACTIVE", false, 0);
        saveBatch("TX-EXP-001", "KMGC", "Kashmiri Garlic Cloves",
                FIXED_NOW, FIXED_NOW.minus(10, ChronoUnit.DAYS), "ACTIVE", false, 0);
        saveBatch("TX-EXP-002", "KMGC", "Kashmiri Garlic Cloves",
                FIXED_NOW.minus(3, ChronoUnit.DAYS), FIXED_NOW.minus(13, ChronoUnit.DAYS), "ACTIVE", false, 0);
        saveBatch("TX-NULL-EXP", "KMGC", "Kashmiri Garlic Cloves",
                null, FIXED_NOW.minus(5, ChronoUnit.DAYS), "ACTIVE", false, 0);

        // Insert a raw document with an unparseable string expiryDate
        Document corrupted = new Document("batchCode", "TX-BAD-EXP")
                .append("sku", "KMGC")
                .append("productName", "Kashmiri Garlic Cloves")
                .append("sourceLotCode", "LOT-BAD")
                .append("quantityProduced", 50)
                .append("unit", "Kg")
                .append("packDate", "2026-06-10")
                .append("expiryDate", "NOT-A-VALID-ISO-DATE")
                .append("lifecycleState", "ACTIVE")
                .append("isDeleted", false)
                .append("createdAt", Date.from(FIXED_NOW.minus(1, ChronoUnit.DAYS)));
        mongoTemplate.getCollection("batches").insertOne(corrupted);

        FefoResult result = fefoService.getFefoQueue(null, null, FIXED_CLOCK);

        assertEquals(1, result.getQueue().size());
        assertEquals("TX-Q-001", result.getQueue().get(0).getBatchCode());
        assertEquals(1, result.getQueue().get(0).getRank());
        assertNull(result.getQueue().get(0).getExceptionReason());

        assertEquals(2, result.getExpired().size());
        List<String> expiredCodes = result.getExpired().stream().map(BatchSummaryDto::getBatchCode).toList();
        assertTrue(expiredCodes.containsAll(List.of("TX-EXP-001", "TX-EXP-002")));
        assertNull(result.getExpired().get(0).getRank());
        assertNull(result.getExpired().get(0).getExceptionReason());

        assertEquals(2, result.getExceptions().size());
        List<String> exceptionCodes = result.getExceptions().stream().map(BatchSummaryDto::getBatchCode).toList();
        assertTrue(exceptionCodes.containsAll(List.of("TX-NULL-EXP", "TX-BAD-EXP")));
        assertNull(result.getExceptions().get(0).getRank());
        for (BatchSummaryDto exc : result.getExceptions()) {
            assertEquals("EXCEPTION", exc.getStatus());
            assertNull(exc.getDaysUntilExpiry(), "EXCEPTION batches must have daysUntilExpiry == null (R3)");
            assertNotNull(exc.getExceptionReason());
        }
    }

    @Test
    @DisplayName("2. Excluded states: DISPATCHED and archived (isDeleted = true) batches appear in none of the three groups")
    void testExcludedStatesNotInAnyGroup() {
        saveBatch("TX-ACT-001", "KMGC", "Kashmiri Garlic Cloves",
                FIXED_NOW.plus(10, ChronoUnit.DAYS), FIXED_NOW.minus(1, ChronoUnit.DAYS), "ACTIVE", false, 0);
        saveBatch("TX-DISP-001", "KMGC", "Kashmiri Garlic Cloves",
                FIXED_NOW.plus(5, ChronoUnit.DAYS), FIXED_NOW.minus(2, ChronoUnit.DAYS), "DISPATCHED", false, 0);
        saveBatch("TX-DISP-EXP", "KMGC", "Kashmiri Garlic Cloves",
                FIXED_NOW.minus(5, ChronoUnit.DAYS), FIXED_NOW.minus(10, ChronoUnit.DAYS), "DISPATCHED", false, 0);
        saveBatch("TX-DEL-ACT", "KMGC", "Kashmiri Garlic Cloves",
                FIXED_NOW.plus(3, ChronoUnit.DAYS), FIXED_NOW.minus(2, ChronoUnit.DAYS), "ACTIVE", true, 0);
        saveBatch("TX-DEL-EXP", "KMGC", "Kashmiri Garlic Cloves",
                FIXED_NOW.minus(2, ChronoUnit.DAYS), FIXED_NOW.minus(10, ChronoUnit.DAYS), "ACTIVE", true, 0);
        saveBatch("TX-DEL-NULL", "KMGC", "Kashmiri Garlic Cloves",
                null, FIXED_NOW.minus(2, ChronoUnit.DAYS), "ACTIVE", true, 0);

        FefoResult result = fefoService.getFefoQueue(null, null, FIXED_CLOCK);

        assertEquals(1, result.getQueue().size());
        assertEquals("TX-ACT-001", result.getQueue().get(0).getBatchCode());
        assertTrue(result.getExpired().isEmpty());
        assertTrue(result.getExceptions().isEmpty());
    }

    @Test
    @DisplayName("3. Ordering & 1-based rank: tier (URGENT -> WARNING -> READY), daysUntilExpiry asc, createdAt asc, batchCode asc")
    void testOrderingAndOneBasedRank() {
        Instant t1 = FIXED_NOW.minus(5, ChronoUnit.HOURS);
        Instant t2 = FIXED_NOW.minus(2, ChronoUnit.HOURS);

        // READY tier (days = 45)
        saveBatch("TX-READY-01", "RHSLT", "Raw Himalayan Salt",
                FIXED_NOW.plus(45, ChronoUnit.DAYS), t1, "ACTIVE", false, 0);

        // WARNING tier (days = 15) - two batches with identical daysUntilExpiry & createdAt, different batchCode
        saveBatch("TX-WARN-B", "KMGC", "Kashmiri Garlic Cloves",
                FIXED_NOW.plus(15, ChronoUnit.DAYS), t1, "ACTIVE", false, 0);
        saveBatch("TX-WARN-A", "KMGC", "Kashmiri Garlic Cloves",
                FIXED_NOW.plus(15, ChronoUnit.DAYS), t1, "ACTIVE", false, 0);

        // URGENT tier (days = 4) - two batches with identical daysUntilExpiry, different createdAt
        saveBatch("TX-URG-LATER-CREATED", "ALPH", "Alphonso Mango Pulp",
                FIXED_NOW.plus(4, ChronoUnit.DAYS), t2, "ACTIVE", false, 0);
        saveBatch("TX-URG-EARLIER-CREATED", "ALPH", "Alphonso Mango Pulp",
                FIXED_NOW.plus(4, ChronoUnit.DAYS), t1, "ACTIVE", false, 0);

        // URGENT tier (days = 2)
        saveBatch("TX-URG-SOONEST", "ALPH", "Alphonso Mango Pulp",
                FIXED_NOW.plus(2, ChronoUnit.DAYS), t2, "ACTIVE", false, 0);

        FefoResult result = fefoService.getFefoQueue(null, null, FIXED_CLOCK);
        List<BatchSummaryDto> q = result.getQueue();
        assertEquals(6, q.size());

        List<String> expectedOrder = List.of(
                "TX-URG-SOONEST",
                "TX-URG-EARLIER-CREATED",
                "TX-URG-LATER-CREATED",
                "TX-WARN-A",
                "TX-WARN-B",
                "TX-READY-01"
        );
        assertEquals(expectedOrder, q.stream().map(BatchSummaryDto::getBatchCode).toList());

        for (int i = 0; i < q.size(); i++) {
            assertEquals(i + 1, q.get(i).getRank(), "Expected 1-based rank at index " + i);
        }
    }

    @Test
    @DisplayName("4. Boundary days with fixed Clock: <= 0 (expired), 1 (URGENT), 7 (URGENT), 8 (WARNING), 30 (WARNING), 31 (READY)")
    void testBoundaryDaysWithFixedClock() {
        saveBatch("B-MINUS-1", "KMGC", "Kashmiri Garlic Cloves",
                FIXED_NOW.minus(1, ChronoUnit.DAYS), FIXED_NOW, "ACTIVE", false, 0);
        saveBatch("B-ZERO", "KMGC", "Kashmiri Garlic Cloves",
                FIXED_NOW, FIXED_NOW, "ACTIVE", false, 0);
        saveBatch("B-DAY-1", "KMGC", "Kashmiri Garlic Cloves",
                FIXED_NOW.plus(1, ChronoUnit.DAYS), FIXED_NOW, "ACTIVE", false, 0);
        saveBatch("B-DAY-7", "KMGC", "Kashmiri Garlic Cloves",
                FIXED_NOW.plus(7, ChronoUnit.DAYS), FIXED_NOW, "ACTIVE", false, 0);
        saveBatch("B-DAY-8", "KMGC", "Kashmiri Garlic Cloves",
                FIXED_NOW.plus(8, ChronoUnit.DAYS), FIXED_NOW, "ACTIVE", false, 0);
        saveBatch("B-DAY-30", "KMGC", "Kashmiri Garlic Cloves",
                FIXED_NOW.plus(30, ChronoUnit.DAYS), FIXED_NOW, "ACTIVE", false, 0);
        saveBatch("B-DAY-31", "KMGC", "Kashmiri Garlic Cloves",
                FIXED_NOW.plus(31, ChronoUnit.DAYS), FIXED_NOW, "ACTIVE", false, 0);

        FefoResult result = fefoService.getFefoQueue(null, null, FIXED_CLOCK);

        assertEquals(2, result.getExpired().size());
        for (BatchSummaryDto exp : result.getExpired()) {
            assertTrue(exp.getDaysUntilExpiry() <= 0);
            assertEquals("EXPIRED", exp.getStatus());
        }

        List<BatchSummaryDto> q = result.getQueue();
        assertEquals(5, q.size());

        assertEquals("B-DAY-1", q.get(0).getBatchCode());
        assertEquals(1L, q.get(0).getDaysUntilExpiry());
        assertEquals("URGENT", q.get(0).getStatus());

        assertEquals("B-DAY-7", q.get(1).getBatchCode());
        assertEquals(7L, q.get(1).getDaysUntilExpiry());
        assertEquals("URGENT", q.get(1).getStatus());

        assertEquals("B-DAY-8", q.get(2).getBatchCode());
        assertEquals(8L, q.get(2).getDaysUntilExpiry());
        assertEquals("WARNING", q.get(2).getStatus());

        assertEquals("B-DAY-30", q.get(3).getBatchCode());
        assertEquals(30L, q.get(3).getDaysUntilExpiry());
        assertEquals("WARNING", q.get(3).getStatus());

        assertEquals("B-DAY-31", q.get(4).getBatchCode());
        assertEquals(31L, q.get(4).getDaysUntilExpiry());
        assertEquals("READY", q.get(4).getStatus());
    }

    @Test
    @DisplayName("5. Advancing the clock moves a batch across READY -> WARNING -> URGENT -> expired with zero DB writes")
    void testAdvancingClockMovesBatchWithZeroDbWrites() {
        Instant expiry = FIXED_NOW.plus(35, ChronoUnit.DAYS);
        Batch saved = saveBatch("TX-CLOCK-MOVE", "KMGC", "Kashmiri Garlic Cloves",
                expiry, FIXED_NOW, "ACTIVE", false, 0);
        Instant initialUpdatedAt = batchRepository.findById(saved.getId()).orElseThrow().getUpdatedAt();

        // Day 0: 35 days remaining -> READY
        FefoResult r1 = fefoService.getFefoQueue(null, null, FIXED_CLOCK);
        assertEquals("READY", r1.getQueue().get(0).getStatus());
        assertEquals(35L, r1.getQueue().get(0).getDaysUntilExpiry());

        // Advance 10 days: 25 days remaining -> WARNING
        Clock clockPlus10 = Clock.fixed(FIXED_NOW.plus(10, ChronoUnit.DAYS), ZoneOffset.UTC);
        FefoResult r2 = fefoService.getFefoQueue(null, null, clockPlus10);
        assertEquals("WARNING", r2.getQueue().get(0).getStatus());
        assertEquals(25L, r2.getQueue().get(0).getDaysUntilExpiry());

        // Advance 30 days: 5 days remaining -> URGENT
        Clock clockPlus30 = Clock.fixed(FIXED_NOW.plus(30, ChronoUnit.DAYS), ZoneOffset.UTC);
        FefoResult r3 = fefoService.getFefoQueue(null, null, clockPlus30);
        assertEquals("URGENT", r3.getQueue().get(0).getStatus());
        assertEquals(5L, r3.getQueue().get(0).getDaysUntilExpiry());

        // Advance 35 days: 0 days remaining -> expired
        Clock clockPlus35 = Clock.fixed(FIXED_NOW.plus(35, ChronoUnit.DAYS), ZoneOffset.UTC);
        FefoResult r4 = fefoService.getFefoQueue(null, null, clockPlus35);
        assertTrue(r4.getQueue().isEmpty());
        assertEquals(1, r4.getExpired().size());
        assertEquals("EXPIRED", r4.getExpired().get(0).getStatus());

        // Verify zero DB writes occurred
        Batch after = batchRepository.findById(saved.getId()).orElseThrow();
        assertEquals(initialUpdatedAt, after.getUpdatedAt());
    }

    @Test
    @DisplayName("6. category and sku filters apply before ordering and 1-based rank")
    void testCategoryAndSkuFiltersAppliedBeforeOrderingAndRank() throws Exception {
        Instant now = Instant.now();
        saveBatch("TX-SPICE-1", "KMGC", "Kashmiri Garlic Cloves",
                now.plus(3, ChronoUnit.DAYS), now.minus(2, ChronoUnit.DAYS), "ACTIVE", false, 0);
        saveBatch("TX-MINERAL-1", "RHSLT", "Raw Himalayan Salt",
                now.plus(5, ChronoUnit.DAYS), now.minus(2, ChronoUnit.DAYS), "ACTIVE", false, 0);
        saveBatch("TX-MINERAL-2", "RHSLT", "Raw Himalayan Salt",
                now.plus(12, ChronoUnit.DAYS), now.minus(1, ChronoUnit.DAYS), "ACTIVE", false, 0);

        // Filter by category=Minerals via HTTP endpoint -> ranks re-indexed 1..2
        mockMvc.perform(get("/api/v1/dispatch/fefo")
                        .param("category", "Minerals")
                        .header("Authorization", "Bearer " + coordinatorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.queue.length()").value(2))
                .andExpect(jsonPath("$.data.queue[0].batchCode").value("TX-MINERAL-1"))
                .andExpect(jsonPath("$.data.queue[0].rank").value(1))
                .andExpect(jsonPath("$.data.queue[1].batchCode").value("TX-MINERAL-2"))
                .andExpect(jsonPath("$.data.queue[1].rank").value(2));

        // Filter by sku=RHSLT via HTTP endpoint -> ranks 1..2
        mockMvc.perform(get("/api/v1/dispatch/fefo")
                        .param("sku", "RHSLT")
                        .header("Authorization", "Bearer " + coordinatorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.queue.length()").value(2))
                .andExpect(jsonPath("$.data.queue[0].rank").value(1))
                .andExpect(jsonPath("$.data.queue[1].rank").value(2));
    }

    @Test
    @DisplayName("7. priorityScore is computed and returned, and never changes FEFO queue order")
    void testPriorityScoreComputedAndDoesNotAffectQueueOrder() {
        // LOW risk product expiring in 6 days (URGENT): priorityScore = (365 - 6) + 0 = 359.0
        saveBatch("TX-URG-LOW-SCORE", "RHSLT", "Raw Himalayan Salt",
                FIXED_NOW.plus(6, ChronoUnit.DAYS), FIXED_NOW, "ACTIVE", false, 0);

        // HIGH risk product expiring in 40 days (READY): priorityScore = (365 - 40) + 100 = 425.0
        saveBatch("TX-READY-HIGH-SCORE", "KMGC", "Kashmiri Garlic Cloves",
                FIXED_NOW.plus(40, ChronoUnit.DAYS), FIXED_NOW, "ACTIVE", false, 0);

        FefoResult result = fefoService.getFefoQueue(null, null, FIXED_CLOCK);
        List<BatchSummaryDto> q = result.getQueue();
        assertEquals(2, q.size());

        // Even though TX-READY-HIGH-SCORE has a higher priorityScore (425.0 > 359.0),
        // TX-URG-LOW-SCORE is ranked #1 because FEFO orders strictly by tier and daysUntilExpiry!
        assertEquals("TX-URG-LOW-SCORE", q.get(0).getBatchCode());
        assertEquals(1, q.get(0).getRank());
        assertEquals(359.0, q.get(0).getPriorityScore(), 0.001);

        assertEquals("TX-READY-HIGH-SCORE", q.get(1).getBatchCode());
        assertEquals(2, q.get(1).getRank());
        assertEquals(425.0, q.get(1).getPriorityScore(), 0.001);
    }

    @Test
    @DisplayName("8. Empty queue: when no eligible batches exist, GET /api/v1/dispatch/fefo returns empty queue, expired, and exceptions lists")
    void testEmptyFefoQueue() throws Exception {
        mockMvc.perform(get("/api/v1/dispatch/fefo")
                        .header("Authorization", "Bearer " + coordinatorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.queue").isArray())
                .andExpect(jsonPath("$.data.queue.length()").value(0))
                .andExpect(jsonPath("$.data.expired").isArray())
                .andExpect(jsonPath("$.data.expired.length()").value(0))
                .andExpect(jsonPath("$.data.exceptions").isArray())
                .andExpect(jsonPath("$.data.exceptions.length()").value(0));
    }

    @Test
    @DisplayName("9. Order after edit, dispatch, archive, and restore: FEFO queue re-ranks dynamically after raw-material edit, dispatch, archive, and restore")
    void testOrderAfterEditDispatchArchiveAndRestore() throws Exception {
        Instant now = Instant.now();
        Batch bA = saveBatch("TX-LIFE-A", "KMGC", "Kashmiri Garlic Cloves",
                now.plus(10, ChronoUnit.DAYS), now.minus(3, ChronoUnit.DAYS), "ACTIVE", false, 0);
        Batch bB = saveBatch("TX-LIFE-B", "KMGC", "Kashmiri Garlic Cloves",
                now.plus(20, ChronoUnit.DAYS), now.minus(2, ChronoUnit.DAYS), "ACTIVE", false, 0);
        Batch bC = saveBatch("TX-LIFE-C", "KMGC", "Kashmiri Garlic Cloves",
                now.plus(35, ChronoUnit.DAYS), now.minus(1, ChronoUnit.DAYS), "ACTIVE", false, 0);

        // Initial order: A (rank 1), B (rank 2), C (rank 3)
        FefoResult init = fefoService.getFefoQueue(null, "KMGC");
        assertEquals(List.of("TX-LIFE-A", "TX-LIFE-B", "TX-LIFE-C"),
                init.getQueue().stream().map(BatchSummaryDto::getBatchCode).toList());

        // 1. Edit bC's expiryDate via PATCH /api/v1/batches/{id}/raw-material to +3 days (URGENT)
        Map<String, Object> editBody = Map.of("expiryDate", now.plus(3, ChronoUnit.DAYS).toString());
        mockMvc.perform(patch("/api/v1/batches/" + bC.getId() + "/raw-material")
                        .header("Authorization", "Bearer " + factoryMgrToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(editBody)))
                .andExpect(status().isOk());

        FefoResult afterEdit = fefoService.getFefoQueue(null, "KMGC");
        assertEquals(List.of("TX-LIFE-C", "TX-LIFE-A", "TX-LIFE-B"),
                afterEdit.getQueue().stream().map(BatchSummaryDto::getBatchCode).toList());
        assertEquals(List.of(1, 2, 3),
                afterEdit.getQueue().stream().map(BatchSummaryDto::getRank).toList());

        // 2. Dispatch head batch bC via PATCH /api/v1/batches/{id}/dispatch -> removed from queue
        BatchDispatchDto dispReq = new BatchDispatchDto("Lifecycle Buyer", null, null);
        mockMvc.perform(patch("/api/v1/batches/" + bC.getId() + "/dispatch")
                        .header("Authorization", "Bearer " + coordinatorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dispReq)))
                .andExpect(status().isOk());

        FefoResult afterDispatch = fefoService.getFefoQueue(null, "KMGC");
        assertEquals(List.of("TX-LIFE-A", "TX-LIFE-B"),
                afterDispatch.getQueue().stream().map(BatchSummaryDto::getBatchCode).toList());
        assertEquals(List.of(1, 2),
                afterDispatch.getQueue().stream().map(BatchSummaryDto::getRank).toList());

        // 3. Archive bA via DELETE /api/v1/batches/{id} -> removed from queue
        mockMvc.perform(delete("/api/v1/batches/" + bA.getId())
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("reason", "Temporary hold"))))
                .andExpect(status().isOk());

        FefoResult afterArchive = fefoService.getFefoQueue(null, "KMGC");
        assertEquals(List.of("TX-LIFE-B"),
                afterArchive.getQueue().stream().map(BatchSummaryDto::getBatchCode).toList());
        assertEquals(List.of(1),
                afterArchive.getQueue().stream().map(BatchSummaryDto::getRank).toList());

        // 4. Restore bA via PATCH /api/v1/batches/{id}/restore -> returns to rank 1 ahead of bB
        mockMvc.perform(patch("/api/v1/batches/" + bA.getId() + "/restore")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        FefoResult afterRestore = fefoService.getFefoQueue(null, "KMGC");
        assertEquals(List.of("TX-LIFE-A", "TX-LIFE-B"),
                afterRestore.getQueue().stream().map(BatchSummaryDto::getBatchCode).toList());
        assertEquals(List.of(1, 2),
                afterRestore.getQueue().stream().map(BatchSummaryDto::getRank).toList());
    }

    @Test
    @DisplayName("10. Business timezone 23:30 UTC case (D-17 Asia/Kolkata): 2026-06-15T23:30:00Z is 2026-06-16 05:00 IST, so expiry on 2026-06-16 is expired today (409 BATCH_EXPIRED) while 2026-06-17 is URGENT (+1d) and dispatches")
    void testBusinessTimezone2330UtcBoundaryInFefoAndDispatch() {
        // At 2026-06-15T23:30:00Z, UTC date is 2026-06-15, but Asia/Kolkata (UTC+5:30) is 2026-06-16T05:00:00+05:30!
        Instant utc2330 = Instant.parse("2026-06-15T23:30:00Z");
        Clock istClockAt2330Utc = Clock.fixed(utc2330, ZoneId.of("Asia/Kolkata"));

        // Batch 1 expires on 2026-06-16 (same local date in Asia/Kolkata, daysUntilExpiry == 0)
        Batch expTodayIst = saveBatchLocalDate("TX-IST-TODAY", "KMGC", "Kashmiri Garlic Cloves",
                LocalDate.of(2026, 6, 16), utc2330.minus(5, ChronoUnit.DAYS), "ACTIVE", false, 0);

        // Batch 2 expires on 2026-06-17 (tomorrow in Asia/Kolkata, daysUntilExpiry == 1)
        Batch expTomorrowIst = saveBatchLocalDate("TX-IST-TOMORROW", "KMGC", "Kashmiri Garlic Cloves",
                LocalDate.of(2026, 6, 17), utc2330.minus(5, ChronoUnit.DAYS), "ACTIVE", false, 0);

        FefoResult fefo = fefoService.getFefoQueue(null, "KMGC", istClockAt2330Utc);

        // TX-IST-TODAY must be in expired (daysUntilExpiry == 0)
        assertEquals(1, fefo.getExpired().size());
        assertEquals("TX-IST-TODAY", fefo.getExpired().get(0).getBatchCode());
        assertEquals(0L, fefo.getExpired().get(0).getDaysUntilExpiry());
        assertEquals("EXPIRED", fefo.getExpired().get(0).getStatus());

        // TX-IST-TOMORROW must be in queue at rank 1 (daysUntilExpiry == 1, URGENT)
        assertEquals(1, fefo.getQueue().size());
        assertEquals("TX-IST-TOMORROW", fefo.getQueue().get(0).getBatchCode());
        assertEquals(1L, fefo.getQueue().get(0).getDaysUntilExpiry());
        assertEquals("URGENT", fefo.getQueue().get(0).getStatus());
        assertEquals(1, fefo.getQueue().get(0).getRank());

        // Dispatching TX-IST-TODAY at 23:30 UTC under Asia/Kolkata clock must fail with 409 BATCH_EXPIRED
        BatchDispatchDto req = new BatchDispatchDto("IST Buyer", null, null);
        ApiException ex = assertThrows(ApiException.class, () ->
                batchService.dispatchBatch(expTodayIst.getId(), req, coordinator, "req-ist-today", istClockAt2330Utc));
        assertEquals(ErrorCode.BATCH_EXPIRED.name(), ex.getErrorCode());
        assertEquals(409, ex.getStatus().value());

        // Dispatching TX-IST-TOMORROW at 23:30 UTC under Asia/Kolkata clock succeeds
        var dispatched = batchService.dispatchBatch(expTomorrowIst.getId(), req, coordinator, "req-ist-tmrw", istClockAt2330Utc);
        assertEquals("DISPATCHED", dispatched.getLifecycleState());
    }

    @Test
    @DisplayName("11. V2 & R3 Corrupted data tolerance: raw batches with missing, null, and 'not-a-date' expiryDate return status=EXCEPTION, daysUntilExpiry=null, and exceptionReason on FEFO, batch list, and batch detail")
    void testCorruptedExpiryDateDoesNotBreakFefoOrBatchReads() throws Exception {
        Instant now = Instant.now();
        Batch validBatch = saveBatch("TX-VALID-READ", "KMGC", "Kashmiri Garlic Cloves",
                now.plus(14, ChronoUnit.DAYS), now.minus(2, ChronoUnit.DAYS), "ACTIVE", false, 0);

        List<ObjectId> rawInsertedIds = new ArrayList<>();
        try {
            // (a) expiryDate field omitted (missing)
            Document docMissing = new Document("batchCode", "TX-CORR-MISSING")
                    .append("sku", "KMGC")
                    .append("productName", "Kashmiri Garlic Cloves")
                    .append("sourceLotCode", "LOT-MISS")
                    .append("farmerName", "Farmer Miss")
                    .append("village", "Village M")
                    .append("quantityProduced", 80)
                    .append("unit", "Kg")
                    .append("yieldPercent", 80.0)
                    .append("packDate", "2026-09-29")
                    .append("lifecycleState", "ACTIVE")
                    .append("isDeleted", false)
                    .append("createdAt", Date.from(now.minus(3, ChronoUnit.HOURS)));
            mongoTemplate.getCollection("batches").insertOne(docMissing);
            ObjectId idMissing = docMissing.getObjectId("_id");
            rawInsertedIds.add(idMissing);

            // (b) expiryDate explicitly null
            Document docNull = new Document("batchCode", "TX-CORR-NULL")
                    .append("sku", "KMGC")
                    .append("productName", "Kashmiri Garlic Cloves")
                    .append("sourceLotCode", "LOT-NULL")
                    .append("farmerName", "Farmer Null")
                    .append("village", "Village N")
                    .append("quantityProduced", 90)
                    .append("unit", "Kg")
                    .append("yieldPercent", 82.0)
                    .append("packDate", "2026-09-29")
                    .append("expiryDate", null)
                    .append("lifecycleState", "ACTIVE")
                    .append("isDeleted", false)
                    .append("createdAt", Date.from(now.minus(2, ChronoUnit.HOURS)));
            mongoTemplate.getCollection("batches").insertOne(docNull);
            ObjectId idNull = docNull.getObjectId("_id");
            rawInsertedIds.add(idNull);

            // (c) expiryDate is the string "not-a-date"
            Document docBadStr = new Document("batchCode", "TX-CORR-NOTADATE")
                    .append("sku", "KMGC")
                    .append("productName", "Kashmiri Garlic Cloves")
                    .append("sourceLotCode", "LOT-STR")
                    .append("farmerName", "Farmer Str")
                    .append("village", "Village S")
                    .append("quantityProduced", 95)
                    .append("unit", "Kg")
                    .append("yieldPercent", 84.0)
                    .append("packDate", "2026-09-29")
                    .append("expiryDate", "not-a-date")
                    .append("lifecycleState", "ACTIVE")
                    .append("isDeleted", false)
                    .append("createdAt", Date.from(now.minus(1, ChronoUnit.HOURS)));
            mongoTemplate.getCollection("batches").insertOne(docBadStr);
            ObjectId idBadStr = docBadStr.getObjectId("_id");
            rawInsertedIds.add(idBadStr);

            // 1. Call GET /api/v1/dispatch/fefo -> 200 OK; corrupted batches in exceptions with daysUntilExpiry=null and exceptionReason, never in queue
            MvcResult fefoRes = mockMvc.perform(get("/api/v1/dispatch/fefo")
                            .header("Authorization", "Bearer " + coordinatorToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.success").value(true))
                    .andExpect(jsonPath("$.data.queue.length()").value(1))
                    .andExpect(jsonPath("$.data.queue[0].batchCode").value("TX-VALID-READ"))
                    .andExpect(jsonPath("$.data.exceptions.length()").value(3))
                    .andReturn();

            JsonNode exceptionsNode = objectMapper.readTree(fefoRes.getResponse().getContentAsString())
                    .path("data").path("exceptions");
            System.out.println("V2 FEFO exceptions JSON: " + exceptionsNode.toString());
            for (JsonNode exc : exceptionsNode) {
                assertEquals("EXCEPTION", exc.path("status").asText());
                assertTrue(exc.path("daysUntilExpiry").isNull(), "daysUntilExpiry must be null on EXCEPTION batches (R3)");
                assertTrue(exc.path("expiryDate").isNull() || exc.path("expiryDate").isMissingNode());
                assertFalse(exc.path("exceptionReason").asText().isBlank(), "Each exception item must include an exceptionReason");
            }

            // 2. Call GET /api/v1/batches -> 200 OK (no 500 error)
            MvcResult listRes = mockMvc.perform(get("/api/v1/batches")
                            .header("Authorization", "Bearer " + coordinatorToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.success").value(true))
                    .andExpect(jsonPath("$.data.total").value(4))
                    .andReturn();

            JsonNode listData = objectMapper.readTree(listRes.getResponse().getContentAsString())
                    .path("data").path("data");
            int exceptionCountInList = 0;
            for (JsonNode item : listData) {
                String code = item.path("batchCode").asText();
                if (code.startsWith("TX-CORR-")) {
                    exceptionCountInList++;
                    System.out.println("V2 Batch List Corrupted Item: batchCode=" + code
                            + ", status=" + item.path("status").asText()
                            + ", expiryDate=" + item.path("expiryDate")
                            + ", daysUntilExpiry=" + item.path("daysUntilExpiry")
                            + ", exceptionReason=" + item.path("exceptionReason").asText());
                    assertEquals("EXCEPTION", item.path("status").asText());
                    assertTrue(item.path("daysUntilExpiry").isNull());
                    assertTrue(item.path("expiryDate").isNull());
                    assertFalse(item.path("exceptionReason").asText().isBlank());
                } else {
                    assertFalse(item.has("exceptionReason"), "Non-EXCEPTION batch must not have exceptionReason (R3)");
                }
            }
            assertEquals(3, exceptionCountInList, "All 3 corrupted batches must be returned with status=EXCEPTION in GET /api/v1/batches");

            // 3. Call GET /api/v1/batches/{id} for each of (a) missing, (b) null, and (c) "not-a-date" -> 200 OK
            for (ObjectId corruptedId : rawInsertedIds) {
                MvcResult detailRes = mockMvc.perform(get("/api/v1/batches/" + corruptedId.toHexString())
                                .header("Authorization", "Bearer " + coordinatorToken))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.success").value(true))
                        .andExpect(jsonPath("$.data.status").value("EXCEPTION"))
                        .andExpect(jsonPath("$.data.daysUntilExpiry").value(org.hamcrest.Matchers.nullValue()))
                        .andExpect(jsonPath("$.data.expiryDate").isEmpty())
                        .andExpect(jsonPath("$.data.exceptionReason").isNotEmpty())
                        .andReturn();
                JsonNode detailNode = objectMapper.readTree(detailRes.getResponse().getContentAsString()).path("data");
                System.out.println("V2 Batch Detail HTTP 200: id=" + corruptedId.toHexString()
                        + ", batchCode=" + detailNode.path("batchCode").asText()
                        + ", status=" + detailNode.path("status").asText()
                        + ", daysUntilExpiry=" + detailNode.path("daysUntilExpiry")
                        + ", expiryDate=" + detailNode.path("expiryDate")
                        + ", exceptionReason=" + detailNode.path("exceptionReason").asText());
            }
        } finally {
            // Clean up the inserted raw documents
            for (ObjectId id : rawInsertedIds) {
                mongoTemplate.getCollection("batches").deleteOne(new Document("_id", id));
            }
        }

        // Verify cleanup left only the valid batch
        assertEquals(1, batchRepository.count());
        assertTrue(batchRepository.findById(validBatch.getId()).isPresent());
    }
}
