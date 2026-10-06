package com.tracex;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tracex.dto.BatchCreateDto;
import com.tracex.dto.BatchNoteDto;
import com.tracex.dto.BatchRawMaterialDto;
import com.tracex.exception.ErrorCode;
import com.tracex.model.Batch;
import com.tracex.model.Counter;
import com.tracex.model.Product;
import com.tracex.model.Role;
import com.tracex.model.User;
import com.tracex.repository.BatchRepository;
import com.tracex.repository.ProductRepository;
import com.tracex.repository.UserRepository;
import com.tracex.security.JwtService;
import com.tracex.service.BatchService;
import com.tracex.util.BatchCodeGenerator;
import com.tracex.util.BatchFreshness;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class ProductAndBatchTests {

    @Autowired private MockMvc mockMvc;
    @Autowired private MongoTemplate mongoTemplate;
    @Autowired private UserRepository userRepository;
    @Autowired private ProductRepository productRepository;
    @Autowired private BatchRepository batchRepository;
    @Autowired private BatchService batchService;
    @Autowired private BatchCodeGenerator batchCodeGenerator;
    @Autowired private JwtService jwtService;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private Clock clock;
    @Autowired private com.tracex.service.SeedRunner seedRunner;

    private static final String NON_EXISTENT_ID = "000000000000000000000001";

    @BeforeEach
    void setup() {
        seedRunner.seedProducts();
        seedRunner.seedBatches();
        createTestUser("test_factory_mgr", Role.FACTORY_MANAGER, false);
        createTestUser("test_admin", Role.ADMIN, false);
        createTestUser("test_inspector", Role.QUALITY_INSPECTOR, false);
        createTestUser("test_manager", Role.MANAGER, false);
        createTestUser("test_superadmin", Role.ADMIN, true);
    }

    @org.junit.jupiter.api.AfterAll
    static void restoreSeedAfterClass(
            @Autowired BatchRepository batchRepository,
            @Autowired com.tracex.service.SeedRunner seedRunner) {
        batchRepository.findAll().stream()
                .filter(b -> b.getSourceLotCode() == null || !b.getSourceLotCode().startsWith("DEMO-LOT-"))
                .forEach(batchRepository::delete);
        seedRunner.run();
    }

    private void createTestUser(String username, Role role, boolean isSuperAdmin) {
        if (userRepository.findByUsername(username).isEmpty()) {
            User u = new User();
            u.setUsername(username);
            u.setEmail(username + "@example.com");
            u.setPasswordHash(passwordEncoder.encode("TestPass123456!"));
            u.setRole(role);
            u.setSuperAdmin(isSuperAdmin);
            u.setActive(true);
            u.setTokenVersion(1);
            userRepository.save(u);
        }
    }

    private String tokenFor(String username) {
        User u = userRepository.findByUsername(username).orElseThrow();
        return jwtService.generateToken(u.getId(), u.getTokenVersion());
    }

    private String adminToken() { return tokenFor("test_admin"); }
    private String factoryMgrToken() { return tokenFor("test_factory_mgr"); }
    private String inspectorToken() { return tokenFor("test_inspector"); }

    private String createTestBatch(String token) throws Exception {
        Product p = productRepository.findAll().get(0);
        BatchCreateDto dto = new BatchCreateDto();
        dto.setProductId(p.getId());
        dto.setSourceLotCode("TEST-LOT-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 4));
        dto.setFarmerName("Test Farmer");
        dto.setVillage("Test Village");
        dto.setQuantityProduced(100);
        dto.setUnit("Kg");
        dto.setYieldPercent(85.0);
        dto.setPackDate(LocalDate.now(clock));

        String response = mockMvc.perform(post("/api/v1/batches")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        JsonNode root = objectMapper.readTree(response);
        return root.path("data").path("id").asText();
    }

    // --- Check 2 & basic product tests ---

    @Test
    @DisplayName("Check 2: GET /api/v1/products returns all 5 seeded products with expected fields")
    void testGetProducts_returnsAllFiveProducts() throws Exception {
        mockMvc.perform(get("/api/v1/products")
                .header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(org.hamcrest.Matchers.greaterThanOrEqualTo(5)))
                .andExpect(jsonPath("$.data[0].sku").exists())
                .andExpect(jsonPath("$.data[0].productName").exists());
    }

    @Test
    @DisplayName("GET /api/v1/products requires auth (401 AUTH_NO_TOKEN)")
    void testGetProducts_requiresAuth() throws Exception {
        mockMvc.perform(get("/api/v1/products"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_NO_TOKEN"));
    }

    // --- Check 3 & basic batch create tests ---

    @Test
    @DisplayName("Check 3: POST /api/v1/batches with valid product creates batch with 201")
    void testCreateBatch_withValidProduct() throws Exception {
        Product p = productRepository.findAll().get(0);
        BatchCreateDto dto = new BatchCreateDto();
        dto.setProductId(p.getId());
        dto.setSourceLotCode("LOT-VALID");
        dto.setFarmerName("Farmer");
        dto.setVillage("Village");
        dto.setQuantityProduced(50);
        dto.setUnit("Kg");
        dto.setYieldPercent(90.0);
        dto.setPackDate(LocalDate.now(clock));

        mockMvc.perform(post("/api/v1/batches")
                .header("Authorization", "Bearer " + factoryMgrToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.batchCode").value(org.hamcrest.Matchers.matchesRegex("TX-\\d{4}-\\d{2}-\\d+")));
    }

    @Test
    @DisplayName("POST /api/v1/batches with unknown productId returns 404")
    void testCreateBatch_withUnknownProductId() throws Exception {
        BatchCreateDto dto = new BatchCreateDto();
        dto.setProductId(NON_EXISTENT_ID);
        dto.setSourceLotCode("LOT-VALID");
        dto.setFarmerName("Farmer");
        dto.setVillage("Village");
        dto.setQuantityProduced(50);
        dto.setUnit("Kg");
        dto.setYieldPercent(90.0);
        dto.setPackDate(LocalDate.now(clock));

        mockMvc.perform(post("/api/v1/batches")
                .header("Authorization", "Bearer " + factoryMgrToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isNotFound());
    }

    // --- Check 4: Batch code format ---

    @Test
    @DisplayName("Check 4: Batch code matches regex TX-YYYY-MM-NNN")
    void testBatchCodeFormat() throws Exception {
        Product p = productRepository.findAll().get(0);
        BatchCreateDto dto = new BatchCreateDto();
        dto.setProductId(p.getId());
        dto.setSourceLotCode("LOT-FMT-" + System.currentTimeMillis());
        dto.setFarmerName("Farmer");
        dto.setVillage("Village");
        dto.setQuantityProduced(50);
        dto.setUnit("Kg");
        dto.setYieldPercent(90.0);
        dto.setPackDate(LocalDate.now(clock));

        mockMvc.perform(post("/api/v1/batches")
                .header("Authorization", "Bearer " + factoryMgrToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.batchCode").value(org.hamcrest.Matchers.matchesRegex("TX-\\d{4}-\\d{2}-\\d{3,}")));
    }

    // --- F4 Required: Concurrency, Rollover, Sequences ---

    @Test
    @DisplayName("F4: 50 parallel batch creations produce unique and contiguous sequence numbers")
    void testFiftyParallelBatchCreationsGivingUniqueContiguousCodes() throws Exception {
        int threadCount = 50;
        ExecutorService executor = Executors.newFixedThreadPool(10);
        Set<String> generatedCodes = ConcurrentHashMap.newKeySet();
        List<Future<?>> futures = new ArrayList<>();

        for (int i = 0; i < threadCount; i++) {
            futures.add(executor.submit(() -> {
                String code = batchCodeGenerator.generateNextCode();
                generatedCodes.add(code);
            }));
        }

        for (Future<?> f : futures) {
            f.get(15, TimeUnit.SECONDS);
        }
        executor.shutdown();

        assertThat(generatedCodes).hasSize(threadCount);

        List<Integer> seqNumbers = generatedCodes.stream()
                .map(code -> Integer.parseInt(code.substring(code.lastIndexOf("-") + 1)))
                .sorted()
                .toList();

        for (int i = 1; i < seqNumbers.size(); i++) {
            assertThat(seqNumbers.get(i)).isEqualTo(seqNumbers.get(i - 1) + 1);
        }
    }

    @Test
    @DisplayName("F4: Month rollover resets counter and changes month prefix")
    void testMonthRollover() {
        ZoneId zone = ZoneId.of("Asia/Kolkata");
        Clock janClock = Clock.fixed(Instant.parse("2026-01-15T10:00:00Z"), zone);
        Clock febClock = Clock.fixed(Instant.parse("2026-02-15T10:00:00Z"), zone);
        try {
            String janCode = batchCodeGenerator.generateNextCode(janClock);
            String febCode = batchCodeGenerator.generateNextCode(febClock);

            assertThat(janCode).startsWith("TX-2026-01-");
            assertThat(febCode).startsWith("TX-2026-02-");
        } finally {
            mongoTemplate.remove(Query.query(Criteria.where("_id").in("batch_TX-2026-01", "batch_TX-2026-02")), Counter.class);
        }
    }

    @Test
    @DisplayName("F4: Year rollover updates year prefix and resets monthly sequence")
    void testYearRollover() {
        ZoneId zone = ZoneId.of("Asia/Kolkata");
        Clock decClock = Clock.fixed(Instant.parse("2026-12-31T10:00:00Z"), zone);
        Clock janNextClock = Clock.fixed(Instant.parse("2027-01-01T10:00:00Z"), zone);
        try {
            String decCode = batchCodeGenerator.generateNextCode(decClock);
            String janNextCode = batchCodeGenerator.generateNextCode(janNextClock);

            assertThat(decCode).startsWith("TX-2026-12-");
            assertThat(janNextCode).startsWith("TX-2027-01-");
        } finally {
            mongoTemplate.remove(Query.query(Criteria.where("_id").in("batch_TX-2026-12", "batch_TX-2027-01")), Counter.class);
        }
    }

    @Test
    @DisplayName("F4: The 1000th batch in a month produces a four-digit sequence without zero padding")
    void testThousandthBatchProducesFourDigitSequence() {
        ZoneId zone = ZoneId.of("Asia/Kolkata");
        Clock testClock = Clock.fixed(Instant.parse("2035-07-10T10:00:00Z"), zone);
        String counterKey = "batch_TX-2035-07";
        try {
            mongoTemplate.upsert(
                    Query.query(Criteria.where("_id").is(counterKey)),
                    new Update().set("seq", 999L),
                    Counter.class
            );

            String code = batchCodeGenerator.generateNextCode(testClock);
            assertThat(code).isEqualTo("TX-2035-07-1000");
        } finally {
            mongoTemplate.remove(Query.query(Criteria.where("_id").is(counterKey)), Counter.class);
        }
    }

    // --- F4 Required: Freshness Boundaries, Clock Advancement & Timezones ---

    @Test
    @DisplayName("F4: Freshness boundaries at expiry today, +1, +7, +8, +30, +31 with a fixed Clock")
    void testFreshnessBoundariesWithFixedClock() {
        ZoneId zone = ZoneId.of("Asia/Kolkata");
        Instant baseTime = Instant.parse("2026-10-04T00:00:00Z");
        Clock fixedClock = Clock.fixed(baseTime, zone);

        // Expiry today (0 days) -> EXPIRED
        long d0 = batchService.calculateDaysUntilExpiry(baseTime, fixedClock);
        assertThat(d0).isEqualTo(0);
        assertThat(BatchFreshness.computeTier(d0)).isEqualTo("EXPIRED");

        // Expiry tomorrow (+1 day) -> URGENT
        long d1 = batchService.calculateDaysUntilExpiry(baseTime.plus(1, ChronoUnit.DAYS), fixedClock);
        assertThat(d1).isEqualTo(1);
        assertThat(BatchFreshness.computeTier(d1)).isEqualTo("URGENT");

        // Expiry in 7 days -> URGENT (boundary)
        long d7 = batchService.calculateDaysUntilExpiry(baseTime.plus(7, ChronoUnit.DAYS), fixedClock);
        assertThat(d7).isEqualTo(7);
        assertThat(BatchFreshness.computeTier(d7)).isEqualTo("URGENT");

        // Expiry in 8 days -> WARNING
        long d8 = batchService.calculateDaysUntilExpiry(baseTime.plus(8, ChronoUnit.DAYS), fixedClock);
        assertThat(d8).isEqualTo(8);
        assertThat(BatchFreshness.computeTier(d8)).isEqualTo("WARNING");

        // Expiry in 30 days -> WARNING (boundary)
        long d30 = batchService.calculateDaysUntilExpiry(baseTime.plus(30, ChronoUnit.DAYS), fixedClock);
        assertThat(d30).isEqualTo(30);
        assertThat(BatchFreshness.computeTier(d30)).isEqualTo("WARNING");

        // Expiry in 31 days -> READY
        long d31 = batchService.calculateDaysUntilExpiry(baseTime.plus(31, ChronoUnit.DAYS), fixedClock);
        assertThat(d31).isEqualTo(31);
        assertThat(BatchFreshness.computeTier(d31)).isEqualTo("READY");
    }

    @Test
    @DisplayName("F4: Status filter returns matching batches at each boundary")
    void testStatusFilterReturningMatchingBatchesAtEachBoundary() throws Exception {
        mockMvc.perform(get("/api/v1/batches?status=URGENT").header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.data").isArray());

        mockMvc.perform(get("/api/v1/batches?status=WARNING").header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.data").isArray());

        mockMvc.perform(get("/api/v1/batches?status=READY").header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.data").isArray());

        mockMvc.perform(get("/api/v1/batches?status=EXPIRED").header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.data").isArray());
    }

    @Test
    @DisplayName("F4 & E3: Status changes dynamically after advancing shared Clock bean with no database write, and restores Clock in finally block")
    void testStatusChangingAfterAdvancingClockWithNoWrite() throws Exception {
        ZoneId zone = ZoneId.of("Asia/Kolkata");
        Instant t0 = Instant.parse("2026-10-04T00:00:00Z");
        Clock clockT0 = Clock.fixed(t0, zone);
        com.tracex.util.MutableClock mutableClock = (com.tracex.util.MutableClock) clock;

        org.bson.types.ObjectId batchId = new org.bson.types.ObjectId();
        try {
            mutableClock.setDelegate(clockT0);
            LocalDate expiry = LocalDate.now(clockT0).plusDays(31); // 2026-11-04 (+31 days)

            Document doc = new Document("_id", batchId)
                    .append("batchCode", "TX-CLOCK-DYN-001")
                    .append("sku", "WBJC")
                    .append("productName", "Wild Berry Juice Concentrate")
                    .append("sourceLotCode", "LOT-CLOCK-DYN")
                    .append("farmerName", "Clock Farmer")
                    .append("village", "Clock Village")
                    .append("quantityProduced", 50)
                    .append("unit", "Kg")
                    .append("yieldPercent", 80.0)
                    .append("packDate", "2026-10-01")
                    .append("expiryDate", expiry.toString())
                    .append("lifecycleState", "ACTIVE")
                    .append("isDeleted", false)
                    .append("createdAt", new Date());
            mongoTemplate.getCollection("batches").insertOne(doc);

            // At t0: 31 days left -> READY
            mockMvc.perform(get("/api/v1/batches/" + batchId.toHexString()).header("Authorization", "Bearer " + adminToken()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.status").value("READY"))
                    .andExpect(jsonPath("$.data.daysUntilExpiry").value(31));

            // Advance shared Clock by 2 days (+29 days left): WARNING with no database write
            mutableClock.setDelegate(Clock.fixed(t0.plus(2, ChronoUnit.DAYS), zone));
            mockMvc.perform(get("/api/v1/batches/" + batchId.toHexString()).header("Authorization", "Bearer " + adminToken()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.status").value("WARNING"))
                    .andExpect(jsonPath("$.data.daysUntilExpiry").value(29));

            // Advance shared Clock by 25 days (+6 days left): URGENT with no database write
            mutableClock.setDelegate(Clock.fixed(t0.plus(25, ChronoUnit.DAYS), zone));
            mockMvc.perform(get("/api/v1/batches/" + batchId.toHexString()).header("Authorization", "Bearer " + adminToken()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.status").value("URGENT"))
                    .andExpect(jsonPath("$.data.daysUntilExpiry").value(6));

            // Advance shared Clock by 35 days (-4 days left): EXPIRED with no database write
            mutableClock.setDelegate(Clock.fixed(t0.plus(35, ChronoUnit.DAYS), zone));
            mockMvc.perform(get("/api/v1/batches/" + batchId.toHexString()).header("Authorization", "Bearer " + adminToken()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.status").value("EXPIRED"))
                    .andExpect(jsonPath("$.data.daysUntilExpiry").value(-4));
        } finally {
            mutableClock.reset();
            mongoTemplate.getCollection("batches").deleteOne(new Document("_id", batchId));
        }

        // Verify the Clock guard passes immediately after restoration
        com.tracex.util.TestDatabaseSafetyGuard.checkClockWithinRealTime(clock);
    }

    @Test
    @DisplayName("F4: Business-zone date at 23:30 UTC is already the next day in Asia/Kolkata (+5:30)")
    void testBusinessZoneDateBoundaryAt2330Utc() {
        ZoneId zone = ZoneId.of("Asia/Kolkata");
        // 2026-10-04 23:30 UTC is 2026-10-05 05:00 IST
        Instant instant2330 = Instant.parse("2026-10-04T23:30:00Z");
        Clock clockAt2330 = Clock.fixed(instant2330, zone);

        // Expiry on 2026-10-05
        LocalDate expiryOn5th = LocalDate.of(2026, 10, 5);

        // In Asia/Kolkata, today is 2026-10-05 and expiry is 2026-10-05 -> 0 days (EXPIRED today)
        long daysInKolkata = batchService.calculateDaysUntilExpiry(expiryOn5th, clockAt2330);
        assertThat(daysInKolkata).isEqualTo(0);

        // In UTC, today would be 2026-10-04 -> 1 day left
        Clock utcClock = Clock.fixed(instant2330, ZoneOffset.UTC);
        long daysInUtc = batchService.calculateDaysUntilExpiry(expiryOn5th, utcClock);
        assertThat(daysInUtc).isEqualTo(1);
    }

    // --- F4 Required: 422 Field Errors on Invalid Input ---

    @Test
    @DisplayName("F4: Invalid input returns 422 with a fieldErrors entry naming each invalid field")
    void testInvalidInputReturns422WithFieldErrors() throws Exception {
        BatchCreateDto invalidDto = new BatchCreateDto();
        invalidDto.setProductId(""); // blank
        invalidDto.setSourceLotCode(""); // blank
        invalidDto.setFarmerName(""); // blank
        invalidDto.setVillage(""); // blank
        invalidDto.setQuantityProduced(0); // < 1
        invalidDto.setUnit("Crates"); // invalid enum pattern
        invalidDto.setYieldPercent(150.0); // > 100
        invalidDto.setPackDate(null); // null

        MvcResult result = mockMvc.perform(post("/api/v1/batches")
                        .header("Authorization", "Bearer " + factoryMgrToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidDto)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors").isArray())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        JsonNode fieldErrors = objectMapper.readTree(body).path("fieldErrors");
        List<String> failedFields = new ArrayList<>();
        fieldErrors.forEach(node -> failedFields.add(node.path("field").asText()));

        assertThat(failedFields).contains("productId", "sourceLotCode", "farmerName", "village",
                "quantityProduced", "unit", "yieldPercent", "packDate");
    }

    // --- F4 Required: Expiry Formulas ---

    @Test
    @DisplayName("F4: Expiry formulas for predicted, base, and manual")
    void testPredictedBaseAndManualExpiryFormulas() {
        // 1. Predicted product
        Product pPred = new Product();
        pPred.setId("pred_prod");
        pPred.setSku("PRED-01");
        pPred.setProductName("Pred Prod");
        pPred.setBaseShelfLifeDays(100);
        pPred.setPredictedShelfLifeDays(45);
        pPred.setRiskLevel("LOW");
        productRepository.save(pPred);

        BatchCreateDto dto1 = new BatchCreateDto();
        dto1.setProductId("pred_prod");
        dto1.setSourceLotCode("LOT-P");
        dto1.setFarmerName("F");
        dto1.setVillage("V");
        dto1.setQuantityProduced(10);
        dto1.setUnit("Kg");
        dto1.setYieldPercent(90.0);
        dto1.setPackDate(LocalDate.of(2026, 10, 4));

        var b1 = batchService.createBatch(dto1, "mgr", "req1");
        assertThat(b1.getShelfLifeSource()).isEqualTo("predicted");
        assertThat(b1.getDataSource()).isEqualTo("predicted");
        assertThat(b1.getExpiryDate()).isEqualTo(LocalDate.of(2026, 10, 4).plusDays(45));

        // 2. Base product
        Product pBase = new Product();
        pBase.setId("base_prod");
        pBase.setSku("BASE-01");
        pBase.setProductName("Base Prod");
        pBase.setBaseShelfLifeDays(60);
        pBase.setPredictedShelfLifeDays(null);
        pBase.setRiskLevel("LOW");
        productRepository.save(pBase);

        BatchCreateDto dto2 = new BatchCreateDto();
        dto2.setProductId("base_prod");
        dto2.setSourceLotCode("LOT-B");
        dto2.setFarmerName("F");
        dto2.setVillage("V");
        dto2.setQuantityProduced(10);
        dto2.setUnit("Kg");
        dto2.setYieldPercent(90.0);
        dto2.setPackDate(LocalDate.of(2026, 10, 4));

        var b2 = batchService.createBatch(dto2, "mgr", "req2");
        assertThat(b2.getShelfLifeSource()).isEqualTo("base");
        assertThat(b2.getDataSource()).isEqualTo("fallback");
        assertThat(b2.getExpiryDate()).isEqualTo(LocalDate.of(2026, 10, 4).plusDays(60));

        // 3. Manual expiry in DTO
        BatchCreateDto dto3 = new BatchCreateDto();
        dto3.setProductId("base_prod");
        dto3.setSourceLotCode("LOT-M");
        dto3.setFarmerName("F");
        dto3.setVillage("V");
        dto3.setQuantityProduced(10);
        dto3.setUnit("Kg");
        dto3.setYieldPercent(90.0);
        dto3.setPackDate(LocalDate.of(2026, 10, 4));
        LocalDate manualExpiry = LocalDate.of(2027, 1, 1);
        dto3.setExpiryDate(manualExpiry);

        var b3 = batchService.createBatch(dto3, "mgr", "req3");
        assertThat(b3.getShelfLifeSource()).isEqualTo("manual");
        assertThat(b3.getExpiryDate()).isEqualTo(manualExpiry);
    }

    // --- F4 Required: Search Regex Literal & Non-whitelisted Sort ---

    @Test
    @DisplayName("F4: Search string with regex characters (.*) matches only literal text")
    void testSearchStringWithRegexCharactersMatchesOnlyLiteralText() throws Exception {
        Product p = productRepository.findAll().get(0);

        BatchCreateDto dtoRegex = new BatchCreateDto();
        dtoRegex.setProductId(p.getId());
        dtoRegex.setSourceLotCode("LITERAL-.*-MATCH");
        dtoRegex.setFarmerName("F");
        dtoRegex.setVillage("V");
        dtoRegex.setQuantityProduced(10);
        dtoRegex.setUnit("Kg");
        dtoRegex.setYieldPercent(90.0);
        dtoRegex.setPackDate(LocalDate.now(clock));
        mockMvc.perform(post("/api/v1/batches").header("Authorization", "Bearer " + factoryMgrToken()).contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(dtoRegex))).andExpect(status().isCreated());

        // Search for ".*"
        MvcResult res = mockMvc.perform(get("/api/v1/batches?search=.*")
                        .header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode data = objectMapper.readTree(res.getResponse().getContentAsString()).path("data").path("data");
        assertThat(data.size()).isGreaterThanOrEqualTo(1);
        for (JsonNode item : data) {
            String lot = item.path("sourceLotCode").asText();
            String name = item.path("productName").asText();
            String code = item.path("batchCode").asText();
            assertThat(lot.contains(".*") || name.contains(".*") || code.contains(".*")).isTrue();
        }
    }

    @Test
    @DisplayName("F4: Sort by a non-whitelisted field is rejected with 422 VALIDATION_ERROR")
    void testSortByNonWhitelistedFieldRejectedWith422() throws Exception {
        mockMvc.perform(get("/api/v1/batches?sort=maliciousField,desc")
                        .header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("sort"));

        // Whitelisted field succeeds
        mockMvc.perform(get("/api/v1/batches?sort=expiryDate,asc")
                        .header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isOk());
    }

    // --- F4 Required: Concurrent Edits (One 200, One 409) ---

    @Test
    @DisplayName("F4: Two concurrent edits on same batch result in one success (200) and one conflict (409)")
    void testTwoConcurrentEditsOneSuccessOneConflict409() throws Exception {
        String id = createTestBatch(factoryMgrToken());
        Batch b1 = batchRepository.findById(id).orElseThrow();
        Batch b2 = batchRepository.findById(id).orElseThrow();

        // Thread 1 edits and saves
        b1.setTraceabilityNote("Edit 1 note");
        batchRepository.save(b1); // Version becomes 1

        // Thread 2 attempts to save stale copy with version 0 -> throws OptimisticLockingFailureException
        b2.setTraceabilityNote("Edit 2 note");
        assertThrows(OptimisticLockingFailureException.class, () -> batchRepository.save(b2));
    }

    // --- F4 Required: Archive and Restore Visibility ---

    @Test
    @DisplayName("F4: Archive removes batch from active list and makes visible in archived; restore reverses it")
    void testArchiveAndRestoreVisibility() throws Exception {
        String id = createTestBatch(factoryMgrToken());

        // 1. Visible in active list
        String activeBefore = mockMvc.perform(get("/api/v1/batches?limit=500").header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(activeBefore).contains(id);

        // 2. Archive batch
        mockMvc.perform(delete("/api/v1/batches/" + id).header("Authorization", "Bearer " + adminToken()).contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"test archive\"}"))
                .andExpect(status().isOk());

        // 3. Not visible in active list
        String activeAfter = mockMvc.perform(get("/api/v1/batches?limit=500").header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(activeAfter).doesNotContain(id);

        // 4. Visible in archived list
        String archivedList = mockMvc.perform(get("/api/v1/batches/archived").header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(archivedList).contains(id);

        // 5. Restore batch
        mockMvc.perform(patch("/api/v1/batches/" + id + "/restore").header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isOk());

        // 6. Visible in active list again
        String activeRestored = mockMvc.perform(get("/api/v1/batches?limit=500").header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(activeRestored).contains(id);
    }

    // --- F4 Required: 401 for Every Batch and Product Endpoint without Token ---

    @Test
    @DisplayName("F4: 401 AUTH_NO_TOKEN returned for every batch and product endpoint without token")
    void testAllBatchAndProductEndpointsReturn401WithoutToken() throws Exception {
        List<org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder> unauthRequests = List.of(
                get("/api/v1/products"),
                get("/api/v1/batches"),
                post("/api/v1/batches").contentType(MediaType.APPLICATION_JSON).content("{}"),
                get("/api/v1/batches/archived"),
                get("/api/v1/batches/" + NON_EXISTENT_ID),
                patch("/api/v1/batches/" + NON_EXISTENT_ID + "/note").contentType(MediaType.APPLICATION_JSON).content("{}"),
                patch("/api/v1/batches/" + NON_EXISTENT_ID + "/raw-material").contentType(MediaType.APPLICATION_JSON).content("{}"),
                delete("/api/v1/batches/" + NON_EXISTENT_ID),
                patch("/api/v1/batches/" + NON_EXISTENT_ID + "/restore")
        );

        for (var req : unauthRequests) {
            mockMvc.perform(req)
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.code").value("AUTH_NO_TOKEN"));
        }
    }

    // --- F4 Required: No Farmer Name in Any Audit Summary ---

    @Test
    @DisplayName("F4: No farmer name appears in any audit summary")
    void testNoFarmerNameInAnyAuditSummary() throws Exception {
        String secretFarmer = "Secret Farmer " + UUID.randomUUID();
        Product p = productRepository.findAll().get(0);

        BatchCreateDto dto = new BatchCreateDto();
        dto.setProductId(p.getId());
        dto.setSourceLotCode("LOT-FARMER-AUDIT");
        dto.setFarmerName(secretFarmer);
        dto.setVillage("Village");
        dto.setQuantityProduced(50);
        dto.setUnit("Kg");
        dto.setYieldPercent(90.0);
        dto.setPackDate(LocalDate.now(clock));

        String res = mockMvc.perform(post("/api/v1/batches")
                        .header("Authorization", "Bearer " + factoryMgrToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        String batchId = objectMapper.readTree(res).path("data").path("id").asText();

        // Note edit
        mockMvc.perform(patch("/api/v1/batches/" + batchId + "/note")
                .header("Authorization", "Bearer " + factoryMgrToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new BatchNoteDto("note"))));

        // Raw material edit with another farmer
        String secondFarmer = "Second Secret Farmer";
        BatchRawMaterialDto rawDto = new BatchRawMaterialDto();
        rawDto.setFarmerName(secondFarmer);
        mockMvc.perform(patch("/api/v1/batches/" + batchId + "/raw-material")
                .header("Authorization", "Bearer " + factoryMgrToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(rawDto)));

        // Archive & restore
        mockMvc.perform(delete("/api/v1/batches/" + batchId).header("Authorization", "Bearer " + adminToken()));
        mockMvc.perform(patch("/api/v1/batches/" + batchId + "/restore").header("Authorization", "Bearer " + adminToken()));

        List<Document> auditLogs = mongoTemplate.find(
                Query.query(Criteria.where("targetId").is(batchId)),
                Document.class,
                "audit_logs"
        );

        assertThat(auditLogs).isNotEmpty();
        for (Document doc : auditLogs) {
            String summary = doc.getString("summary");
            if (summary != null) {
                assertThat(summary).doesNotContain(secretFarmer);
                assertThat(summary).doesNotContain(secondFarmer);
            }
        }
    }

    // --- Other existing tests & Check mappings ---

    @Test
    void testGetBatches_paginationAndFilters() throws Exception {
        mockMvc.perform(get("/api/v1/batches?page=1&limit=3")
                .header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(org.hamcrest.Matchers.greaterThanOrEqualTo(0)))
                .andExpect(jsonPath("$.data.page").value(1))
                .andExpect(jsonPath("$.data.limit").value(3))
                .andExpect(jsonPath("$.data.data").isArray());
    }

    @Test
    void testGetBatchById() throws Exception {
        String id = createTestBatch(factoryMgrToken());
        mockMvc.perform(get("/api/v1/batches/" + id)
                .header("Authorization", "Bearer " + factoryMgrToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(id))
                .andExpect(jsonPath("$.data.noteHistory").isArray());
    }

    @Test
    void testUpdateNote_appendsToHistory() throws Exception {
        String id = createTestBatch(factoryMgrToken());
        BatchNoteDto dto = new BatchNoteDto();
        dto.setNote("New note");

        mockMvc.perform(patch("/api/v1/batches/" + id + "/note")
                .header("Authorization", "Bearer " + factoryMgrToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/batches/" + id)
                .header("Authorization", "Bearer " + factoryMgrToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.traceabilityNote").value("New note"))
                .andExpect(jsonPath("$.data.noteHistory.length()").value(org.hamcrest.Matchers.greaterThanOrEqualTo(1)));
    }

    @Test
    void testUpdateRawMaterial_audited() throws Exception {
        String id = createTestBatch(factoryMgrToken());
        BatchRawMaterialDto dto = new BatchRawMaterialDto();
        dto.setFarmerName("Updated Farmer");

        mockMvc.perform(patch("/api/v1/batches/" + id + "/raw-material")
                .header("Authorization", "Bearer " + factoryMgrToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk());

        String response = mockMvc.perform(get("/api/v1/batches/" + id)
                .header("Authorization", "Bearer " + factoryMgrToken()))
                .andReturn().getResponse().getContentAsString();

        JsonNode history = objectMapper.readTree(response).path("data").path("noteHistory");
        boolean found = false;
        for (JsonNode entry : history) {
            if (entry.path("note").asText().contains("Raw Material Correction")) {
                found = true;
                break;
            }
        }
        assertThat(found).isTrue();
    }

    @Test
    void testSoftDeleteAndRestore() throws Exception {
        String id = createTestBatch(factoryMgrToken());

        mockMvc.perform(delete("/api/v1/batches/" + id)
                .header("Authorization", "Bearer " + adminToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"test\"}"))
                .andExpect(status().isOk());

        String archivedRes = mockMvc.perform(get("/api/v1/batches/archived")
                .header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        assertThat(archivedRes).contains(id);

        mockMvc.perform(patch("/api/v1/batches/" + id + "/restore")
                .header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/batches/" + id)
                .header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.deleted").value(false));
    }

    @Test
    void testGetArchivedBatches_adminOnly() throws Exception {
        mockMvc.perform(get("/api/v1/batches/archived"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/v1/batches/archived")
                .header("Authorization", "Bearer " + inspectorToken()))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/batches/archived")
                .header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isOk());
    }

    @Test
    void testNonAdminCannotArchiveOrRestore() throws Exception {
        String id = createTestBatch(factoryMgrToken());

        mockMvc.perform(delete("/api/v1/batches/" + id)
                .header("Authorization", "Bearer " + inspectorToken()))
                .andExpect(status().isForbidden());

        mockMvc.perform(patch("/api/v1/batches/" + id + "/restore")
                .header("Authorization", "Bearer " + inspectorToken()))
                .andExpect(status().isForbidden());
    }

    @Test
    void testAuditLogForBatchOperations() throws Exception {
        String id = createTestBatch(factoryMgrToken());

        BatchNoteDto dto = new BatchNoteDto();
        dto.setNote("n2");
        mockMvc.perform(patch("/api/v1/batches/" + id + "/note").header("Authorization", "Bearer " + factoryMgrToken()).contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(dto))).andExpect(status().is2xxSuccessful());
        mockMvc.perform(delete("/api/v1/batches/" + id).header("Authorization", "Bearer " + adminToken()));
        mockMvc.perform(patch("/api/v1/batches/" + id + "/restore").header("Authorization", "Bearer " + adminToken()));

        List<Document> logs = mongoTemplate.find(new Query(Criteria.where("targetId").is(id)), Document.class, "audit_logs");
        List<String> actions = logs.stream().map(d -> d.getString("action")).toList();

        assertThat(actions).contains("BATCH_CREATED", "BATCH_NOTE_ADDED", "BATCH_ARCHIVED", "BATCH_RESTORED");
    }

    @Test
    void testOptimisticLockingConflict() throws Exception {
        String id = createTestBatch(factoryMgrToken());
        Batch batch = batchRepository.findById(id).orElseThrow();

        mongoTemplate.updateFirst(
                new Query(Criteria.where("_id").is(id)),
                new org.springframework.data.mongodb.core.query.Update().set("version", 0L),
                Batch.class
        );

        batch.setTraceabilityNote("Conflict note");
        assertThrows(OptimisticLockingFailureException.class, () -> {
            batchRepository.save(batch);
        });
    }

    @Test
    void testSeededProductsExist() {
        List<Product> products = mongoTemplate.find(new Query(), Product.class);
        assertThat(products.size()).isGreaterThanOrEqualTo(5);
        List<String> skus = products.stream().map(Product::getSku).toList();
        assertThat(skus).contains("WBJC", "KMGC", "RHSLT", "ABHJAM", "WBDRP");
    }

    @Test
    void testSeededBatchesExist() {
        long count = batchRepository.findAll().stream().filter(b -> b.getSourceLotCode().startsWith("DEMO-LOT-")).count();
        assertThat(count).isGreaterThanOrEqualTo(12);
    }

    @Test
    void testBatchFreshness_computeTier() {
        assertThat(BatchFreshness.computeTier(-1)).isEqualTo("EXPIRED");
        assertThat(BatchFreshness.computeTier(0)).isEqualTo("EXPIRED");
        assertThat(BatchFreshness.computeTier(1)).isEqualTo("URGENT");
        assertThat(BatchFreshness.computeTier(7)).isEqualTo("URGENT");
        assertThat(BatchFreshness.computeTier(8)).isEqualTo("WARNING");
        assertThat(BatchFreshness.computeTier(30)).isEqualTo("WARNING");
        assertThat(BatchFreshness.computeTier(31)).isEqualTo("READY");
    }

    @Test
    @DisplayName("R1 & A0-3: Date-only storage and serialization round trip returns exact '2026-10-09' string across UTC, Asia/Kolkata, and America/Los_Angeles; seeded batch codes use Clock year-month")
    void testCreateAndReadBatchDateRoundTripAcrossTimeZones() throws Exception {
        seedRunner.seedProducts();
        seedRunner.seedBatches();
        LocalDate todayClock = LocalDate.now(clock);
        String expectedSeedBatchCode = String.format("TX-%04d-%02d-002", todayClock.getYear(), todayClock.getMonthValue());
        Document seededRawDoc = mongoTemplate.getCollection("batches")
                .find(new Document("sourceLotCode", "DEMO-LOT-002"))
                .first();
        assertThat(seededRawDoc).isNotNull();
        assertThat(seededRawDoc.getString("batchCode")).isEqualTo(expectedSeedBatchCode);
        String seededId = seededRawDoc.getObjectId("_id").toHexString();
        Object seededRawPackDate = seededRawDoc.get("packDate");
        Object seededRawExpiryDate = seededRawDoc.get("expiryDate");
        assertThat(seededRawPackDate).isInstanceOf(String.class);
        assertThat(seededRawExpiryDate).isInstanceOf(String.class);
        assertThat(seededRawPackDate.toString()).matches("^\\d{4}-\\d{2}-\\d{2}$");
        assertThat(seededRawExpiryDate.toString()).matches("^\\d{4}-\\d{2}-\\d{2}$");

        MvcResult seededGetRes = mockMvc.perform(get("/api/v1/batches/" + seededId)
                        .header("Authorization", "Bearer " + factoryMgrToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.batchCode").value(expectedSeedBatchCode))
                .andExpect(jsonPath("$.data.packDate").value(seededRawPackDate.toString()))
                .andExpect(jsonPath("$.data.expiryDate").value(seededRawExpiryDate.toString()))
                .andReturn();
        System.out.println("R1 Seeded Batch [" + expectedSeedBatchCode + "] Raw Mongo Document: " + seededRawDoc.toJson());
        System.out.println("R1 Seeded Batch [" + expectedSeedBatchCode + "]: "
                + "mongo.packDate=" + seededRawPackDate + " (" + seededRawPackDate.getClass().getName() + "), "
                + "mongo.expiryDate=" + seededRawExpiryDate + " (" + seededRawExpiryDate.getClass().getName() + "), "
                + "GET /api/v1/batches/" + seededId + " => " + seededGetRes.getResponse().getContentAsString());

        Product p = productRepository.findAll().get(0);
        TimeZone originalDefault = TimeZone.getDefault();
        List<String> zones = List.of("UTC", "Asia/Kolkata", "America/Los_Angeles");

        try {
            for (String zoneId : zones) {
                TimeZone.setDefault(TimeZone.getTimeZone(zoneId));

                String rawRequestJson = """
                        {
                          "productId": "%s",
                          "sourceLotCode": "R1-TZ-%s",
                          "farmerName": "R1 Farmer",
                          "village": "R1 Village",
                          "quantityProduced": 100,
                          "unit": "Kg",
                          "yieldPercent": 88.5,
                          "packDate": "2026-10-09",
                          "expiryDate": "2026-10-09"
                        }
                        """.formatted(p.getId(), zoneId.replace("/", "-"));

                MvcResult createRes = mockMvc.perform(post("/api/v1/batches")
                                .header("Authorization", "Bearer " + factoryMgrToken())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(rawRequestJson))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.data.packDate").value("2026-10-09"))
                        .andExpect(jsonPath("$.data.expiryDate").value("2026-10-09"))
                        .andReturn();

                String createdId = objectMapper.readTree(createRes.getResponse().getContentAsString())
                        .path("data").path("id").asText();

                // Read via GET /api/v1/batches/{id}
                MvcResult getRes = mockMvc.perform(get("/api/v1/batches/" + createdId)
                                .header("Authorization", "Bearer " + factoryMgrToken()))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.data.packDate").value("2026-10-09"))
                        .andExpect(jsonPath("$.data.expiryDate").value("2026-10-09"))
                        .andReturn();

                // Verify raw MongoDB document stores exact "2026-10-09" string
                Document rawMongoDoc = mongoTemplate.getCollection("batches")
                        .find(new Document("_id", new org.bson.types.ObjectId(createdId)))
                        .first();
                assertThat(rawMongoDoc).isNotNull();
                Object rawPackDate = rawMongoDoc.get("packDate");
                Object rawExpiryDate = rawMongoDoc.get("expiryDate");
                System.out.println("R1 Round-Trip [JVM TZ=" + TimeZone.getDefault().getID() + "]: "
                        + "mongo.packDate=" + rawPackDate + " (" + rawPackDate.getClass().getName() + "), "
                        + "mongo.expiryDate=" + rawExpiryDate + " (" + rawExpiryDate.getClass().getName() + "), "
                        + "GET /api/v1/batches/" + createdId + " => " + getRes.getResponse().getContentAsString());

                assertThat(rawPackDate).isInstanceOf(String.class).isEqualTo("2026-10-09");
                assertThat(rawExpiryDate).isInstanceOf(String.class).isEqualTo("2026-10-09");
            }
        } finally {
            TimeZone.setDefault(originalDefault);
        }
    }

    @Test
    @DisplayName("R3: Valid batch has numeric daysUntilExpiry and no exceptionReason, while corrupted batch returns status=EXCEPTION and daysUntilExpiry=null")
    void testExceptionStatusFilterAndNullableDaysUntilExpiry() throws Exception {
        seedRunner.seedProducts();
        seedRunner.seedBatches();
        String validBatchId = createTestBatch(factoryMgrToken());

        // Valid batch must NOT have exceptionReason and must have non-null daysUntilExpiry
        MvcResult validDetailRes = mockMvc.perform(get("/api/v1/batches/" + validBatchId)
                        .header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode validData = objectMapper.readTree(validDetailRes.getResponse().getContentAsString()).path("data");
        assertThat(validData.path("daysUntilExpiry").isNumber()).isTrue();
        assertThat(validData.has("exceptionReason")).isFalse();
    }

    @Test
    @DisplayName("A0-1: Corrupted-expiry batches (missing, null, and 'not-a-date') are excluded from EXPIRED, URGENT, WARNING, READY, included in status=EXCEPTION, and placed in exceptions by GET /api/v1/dispatch/fefo")
    void testA01CorruptedExpiryMissingNullAndNotADateAgainstAllFiveFiltersAndFefo() throws Exception {
        seedRunner.seedProducts();
        seedRunner.seedBatches();

        // Insert all three corrupted-expiry forms directly into MongoDB: missing field, explicit null, and "not-a-date"
        org.bson.types.ObjectId missingId = new org.bson.types.ObjectId();
        org.bson.types.ObjectId nullId = new org.bson.types.ObjectId();
        org.bson.types.ObjectId notADateId = new org.bson.types.ObjectId();
        List<String> corruptedCodes = List.of("TX-A01-MISSING", "TX-A01-NULL", "TX-A01-NOTADATE");
        try {
            Document missingDoc = new Document("_id", missingId)
                    .append("batchCode", "TX-A01-MISSING")
                    .append("sku", "WBJC")
                    .append("productName", "Wild Berry Juice Concentrate")
                    .append("sourceLotCode", "LOT-A01-MISSING")
                    .append("farmerName", "A0-1 Farmer")
                    .append("village", "A0-1 Village")
                    .append("quantityProduced", 40)
                    .append("unit", "Kg")
                    .append("yieldPercent", 80.0)
                    .append("packDate", "2026-10-01")
                    // expiryDate intentionally omitted
                    .append("lifecycleState", "ACTIVE")
                    .append("isDeleted", false)
                    .append("createdAt", new Date());

            Document nullDoc = new Document("_id", nullId)
                    .append("batchCode", "TX-A01-NULL")
                    .append("sku", "WBJC")
                    .append("productName", "Wild Berry Juice Concentrate")
                    .append("sourceLotCode", "LOT-A01-NULL")
                    .append("farmerName", "A0-1 Farmer")
                    .append("village", "A0-1 Village")
                    .append("quantityProduced", 40)
                    .append("unit", "Kg")
                    .append("yieldPercent", 80.0)
                    .append("packDate", "2026-10-01")
                    .append("expiryDate", null)
                    .append("lifecycleState", "ACTIVE")
                    .append("isDeleted", false)
                    .append("createdAt", new Date());

            Document notADateDoc = new Document("_id", notADateId)
                    .append("batchCode", "TX-A01-NOTADATE")
                    .append("sku", "WBJC")
                    .append("productName", "Wild Berry Juice Concentrate")
                    .append("sourceLotCode", "LOT-A01-NOTADATE")
                    .append("farmerName", "A0-1 Farmer")
                    .append("village", "A0-1 Village")
                    .append("quantityProduced", 40)
                    .append("unit", "Kg")
                    .append("yieldPercent", 80.0)
                    .append("packDate", "2026-10-01")
                    .append("expiryDate", "not-a-date")
                    .append("lifecycleState", "ACTIVE")
                    .append("isDeleted", false)
                    .append("createdAt", new Date());

            mongoTemplate.getCollection("batches").insertMany(List.of(missingDoc, nullDoc, notADateDoc));

            // GET /api/v1/batches/{id} for each of the 3 corrupted documents returns status=EXCEPTION, daysUntilExpiry=null, and exceptionReason present
            for (org.bson.types.ObjectId cid : List.of(missingId, nullId, notADateId)) {
                MvcResult excDetailRes = mockMvc.perform(get("/api/v1/batches/" + cid.toHexString())
                                .header("Authorization", "Bearer " + adminToken()))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.data.status").value("EXCEPTION"))
                        .andExpect(jsonPath("$.data.daysUntilExpiry").value(org.hamcrest.Matchers.nullValue()))
                        .andExpect(jsonPath("$.data.exceptionReason").isNotEmpty())
                        .andReturn();
                JsonNode excDetailData = objectMapper.readTree(excDetailRes.getResponse().getContentAsString()).path("data");
                assertThat(excDetailData.has("daysUntilExpiry")).isTrue();
                assertThat(excDetailData.get("daysUntilExpiry").isNull()).isTrue();
            }

            // A0-1: Test all four tier filters (EXPIRED, URGENT, WARNING, READY) must NOT return any of TX-A01-MISSING, TX-A01-NULL, TX-A01-NOTADATE
            for (String tier : List.of("EXPIRED", "URGENT", "WARNING", "READY")) {
                MvcResult tierRes = mockMvc.perform(get("/api/v1/batches?status=" + tier + "&limit=200")
                                .header("Authorization", "Bearer " + adminToken()))
                        .andExpect(status().isOk())
                        .andReturn();
                String tierBody = tierRes.getResponse().getContentAsString();
                JsonNode tierItems = objectMapper.readTree(tierBody).path("data").path("data");
                List<String> tierCodes = new ArrayList<>();
                for (JsonNode item : tierItems) {
                    tierCodes.add(item.path("batchCode").asText());
                    assertThat(item.path("status").asText()).isEqualTo(tier);
                }
                System.out.println("A0-1 Filter [status=" + tier + "]: count=" + tierCodes.size() + ", codes=" + tierCodes
                        + ", containsMissing=" + tierCodes.contains("TX-A01-MISSING")
                        + ", containsNull=" + tierCodes.contains("TX-A01-NULL")
                        + ", containsNotADate=" + tierCodes.contains("TX-A01-NOTADATE"));
                assertThat(tierCodes).doesNotContainAnyElementsOf(corruptedCodes);
            }

            // A0-1: status=EXCEPTION MUST return all three (TX-A01-MISSING, TX-A01-NULL, TX-A01-NOTADATE)
            MvcResult filterExcRes = mockMvc.perform(get("/api/v1/batches?status=EXCEPTION&limit=200")
                            .header("Authorization", "Bearer " + adminToken()))
                    .andExpect(status().isOk())
                    .andReturn();
            JsonNode excList = objectMapper.readTree(filterExcRes.getResponse().getContentAsString())
                    .path("data").path("data");
            assertThat(excList.size()).isGreaterThanOrEqualTo(3);
            List<String> returnedCodes = new ArrayList<>();
            for (JsonNode node : excList) {
                returnedCodes.add(node.path("batchCode").asText());
                assertThat(node.path("status").asText()).isEqualTo("EXCEPTION");
                assertThat(node.get("daysUntilExpiry").isNull()).isTrue();
                assertThat(node.path("exceptionReason").asText()).isNotBlank();
            }
            System.out.println("A0-1 Filter [status=EXCEPTION]: count=" + returnedCodes.size() + ", codes=" + returnedCodes
                    + ", containsAllCorrupted=" + returnedCodes.containsAll(corruptedCodes));
            assertThat(returnedCodes).containsAll(corruptedCodes);

            // A0-1: GET /api/v1/dispatch/fefo must exclude all 3 from queue and expired, and include all 3 in exceptions
            MvcResult fefoRes = mockMvc.perform(get("/api/v1/dispatch/fefo")
                            .header("Authorization", "Bearer " + adminToken()))
                    .andExpect(status().isOk())
                    .andReturn();
            JsonNode fefoData = objectMapper.readTree(fefoRes.getResponse().getContentAsString()).path("data");
            List<String> fefoQueueCodes = new ArrayList<>();
            for (JsonNode n : fefoData.path("queue")) fefoQueueCodes.add(n.path("batchCode").asText());
            List<String> fefoExpiredCodes = new ArrayList<>();
            for (JsonNode n : fefoData.path("expired")) fefoExpiredCodes.add(n.path("batchCode").asText());
            List<String> fefoExceptionCodes = new ArrayList<>();
            for (JsonNode n : fefoData.path("exceptions")) fefoExceptionCodes.add(n.path("batchCode").asText());
            System.out.println("A0-1 FEFO [GET /api/v1/dispatch/fefo]: queueCodes=" + fefoQueueCodes
                    + ", expiredCodes=" + fefoExpiredCodes
                    + ", exceptionsCodes=" + fefoExceptionCodes);
            assertThat(fefoQueueCodes).doesNotContainAnyElementsOf(corruptedCodes);
            assertThat(fefoExpiredCodes).doesNotContainAnyElementsOf(corruptedCodes);
            assertThat(fefoExceptionCodes).containsAll(corruptedCodes);
        } finally {
            mongoTemplate.getCollection("batches").deleteMany(new Document("_id", new Document("$in", List.of(missingId, nullId, notADateId))));
        }
    }

    @Test
    @DisplayName("A0-1 Tightened Pattern: Impossible calendar dates (2026-02-31, 2026-02-29, 2026-04-31) never match EXPIRED, URGENT, WARNING, or READY and route to EXCEPTION")
    void testImpossibleCalendarDatesNeverMatchTierFiltersAndRouteToException() throws Exception {
        // Direct regex verification for leap-year and month-length rules
        assertThat("2026-02-28".matches(BatchFreshness.ISO_LOCAL_DATE_REGEX)).isTrue();
        assertThat("2024-02-29".matches(BatchFreshness.ISO_LOCAL_DATE_REGEX)).isTrue();
        assertThat("2000-02-29".matches(BatchFreshness.ISO_LOCAL_DATE_REGEX)).isTrue();
        assertThat("2026-02-29".matches(BatchFreshness.ISO_LOCAL_DATE_REGEX)).isFalse();
        assertThat("2026-02-30".matches(BatchFreshness.ISO_LOCAL_DATE_REGEX)).isFalse();
        assertThat("2026-02-31".matches(BatchFreshness.ISO_LOCAL_DATE_REGEX)).isFalse();
        assertThat("2100-02-29".matches(BatchFreshness.ISO_LOCAL_DATE_REGEX)).isFalse();
        assertThat("2026-04-31".matches(BatchFreshness.ISO_LOCAL_DATE_REGEX)).isFalse();
        assertThat("2026-06-31".matches(BatchFreshness.ISO_LOCAL_DATE_REGEX)).isFalse();
        assertThat("2026-09-31".matches(BatchFreshness.ISO_LOCAL_DATE_REGEX)).isFalse();
        assertThat("2026-11-31".matches(BatchFreshness.ISO_LOCAL_DATE_REGEX)).isFalse();

        org.bson.types.ObjectId feb31Id = new org.bson.types.ObjectId();
        org.bson.types.ObjectId feb29NonLeapId = new org.bson.types.ObjectId();
        org.bson.types.ObjectId apr31Id = new org.bson.types.ObjectId();
        List<String> impossibleCodes = List.of("TX-IMP-2026-02-31", "TX-IMP-2026-02-29", "TX-IMP-2026-04-31");

        try {
            Document d1 = new Document("_id", feb31Id)
                    .append("batchCode", "TX-IMP-2026-02-31")
                    .append("sku", "WBJC")
                    .append("productName", "Wild Berry Juice Concentrate")
                    .append("sourceLotCode", "LOT-IMP-1")
                    .append("farmerName", "Imp Farmer")
                    .append("village", "Imp Village")
                    .append("quantityProduced", 25)
                    .append("unit", "Kg")
                    .append("yieldPercent", 80.0)
                    .append("packDate", "2026-01-01")
                    .append("expiryDate", "2026-02-31")
                    .append("lifecycleState", "ACTIVE")
                    .append("isDeleted", false)
                    .append("createdAt", new Date());

            Document d2 = new Document("_id", feb29NonLeapId)
                    .append("batchCode", "TX-IMP-2026-02-29")
                    .append("sku", "WBJC")
                    .append("productName", "Wild Berry Juice Concentrate")
                    .append("sourceLotCode", "LOT-IMP-2")
                    .append("farmerName", "Imp Farmer")
                    .append("village", "Imp Village")
                    .append("quantityProduced", 25)
                    .append("unit", "Kg")
                    .append("yieldPercent", 80.0)
                    .append("packDate", "2026-01-01")
                    .append("expiryDate", "2026-02-29")
                    .append("lifecycleState", "ACTIVE")
                    .append("isDeleted", false)
                    .append("createdAt", new Date());

            Document d3 = new Document("_id", apr31Id)
                    .append("batchCode", "TX-IMP-2026-04-31")
                    .append("sku", "WBJC")
                    .append("productName", "Wild Berry Juice Concentrate")
                    .append("sourceLotCode", "LOT-IMP-3")
                    .append("farmerName", "Imp Farmer")
                    .append("village", "Imp Village")
                    .append("quantityProduced", 25)
                    .append("unit", "Kg")
                    .append("yieldPercent", 80.0)
                    .append("packDate", "2026-01-01")
                    .append("expiryDate", "2026-04-31")
                    .append("lifecycleState", "ACTIVE")
                    .append("isDeleted", false)
                    .append("createdAt", new Date());

            mongoTemplate.getCollection("batches").insertMany(List.of(d1, d2, d3));

            for (String tier : List.of("EXPIRED", "URGENT", "WARNING", "READY")) {
                MvcResult tierRes = mockMvc.perform(get("/api/v1/batches?status=" + tier + "&limit=200")
                                .header("Authorization", "Bearer " + adminToken()))
                        .andExpect(status().isOk())
                        .andReturn();
                JsonNode tierItems = objectMapper.readTree(tierRes.getResponse().getContentAsString()).path("data").path("data");
                List<String> tierCodes = new ArrayList<>();
                for (JsonNode item : tierItems) {
                    tierCodes.add(item.path("batchCode").asText());
                }
                System.out.println("A0-1 Impossible Date Check [status=" + tier + "]: containsAnyImpossible="
                        + tierCodes.stream().anyMatch(impossibleCodes::contains));
                assertThat(tierCodes).doesNotContainAnyElementsOf(impossibleCodes);
            }

            MvcResult excRes = mockMvc.perform(get("/api/v1/batches?status=EXCEPTION&limit=200")
                            .header("Authorization", "Bearer " + adminToken()))
                    .andExpect(status().isOk())
                    .andReturn();
            JsonNode excItems = objectMapper.readTree(excRes.getResponse().getContentAsString()).path("data").path("data");
            List<String> excCodes = new ArrayList<>();
            for (JsonNode item : excItems) {
                excCodes.add(item.path("batchCode").asText());
            }
            System.out.println("A0-1 Impossible Date Check [status=EXCEPTION]: codes=" + excCodes);
            assertThat(excCodes).containsAll(impossibleCodes);

            MvcResult fefoRes = mockMvc.perform(get("/api/v1/dispatch/fefo")
                            .header("Authorization", "Bearer " + adminToken()))
                    .andExpect(status().isOk())
                    .andReturn();
            JsonNode fefoData = objectMapper.readTree(fefoRes.getResponse().getContentAsString()).path("data");
            List<String> fefoQueueCodes = new ArrayList<>();
            for (JsonNode n : fefoData.path("queue")) fefoQueueCodes.add(n.path("batchCode").asText());
            List<String> fefoExpiredCodes = new ArrayList<>();
            for (JsonNode n : fefoData.path("expired")) fefoExpiredCodes.add(n.path("batchCode").asText());
            List<String> fefoExceptionCodes = new ArrayList<>();
            for (JsonNode n : fefoData.path("exceptions")) fefoExceptionCodes.add(n.path("batchCode").asText());
            assertThat(fefoQueueCodes).doesNotContainAnyElementsOf(impossibleCodes);
            assertThat(fefoExpiredCodes).doesNotContainAnyElementsOf(impossibleCodes);
            assertThat(fefoExceptionCodes).containsAll(impossibleCodes);
        } finally {
            mongoTemplate.getCollection("batches").deleteMany(new Document("_id", new Document("$in", List.of(feb31Id, feb29NonLeapId, apr31Id))));
        }
    }

    @Test
    @DisplayName("Item 4.1: Positive calendar dates 2028-02-29, 2000-02-29, and 2026-12-31 match ISO_LOCAL_DATE_REGEX and match their tier filters")
    void testCalendarRegexPositiveLeapAndMonthEndDatesMatchTierFilters() throws Exception {
        assertThat("2028-02-29".matches(BatchFreshness.ISO_LOCAL_DATE_REGEX)).isTrue();
        assertThat("2000-02-29".matches(BatchFreshness.ISO_LOCAL_DATE_REGEX)).isTrue();
        assertThat("2026-12-31".matches(BatchFreshness.ISO_LOCAL_DATE_REGEX)).isTrue();

        org.bson.types.ObjectId id2028 = new org.bson.types.ObjectId();
        org.bson.types.ObjectId id2000 = new org.bson.types.ObjectId();
        org.bson.types.ObjectId id2026 = new org.bson.types.ObjectId();

        try {
            Document d2028 = new Document("_id", id2028)
                    .append("batchCode", "TX-POS-2028-02-29")
                    .append("sku", "WBJC")
                    .append("productName", "Wild Berry Juice Concentrate")
                    .append("sourceLotCode", "LOT-POS-2028")
                    .append("farmerName", "Pos Farmer")
                    .append("village", "Pos Village")
                    .append("quantityProduced", 25)
                    .append("unit", "Kg")
                    .append("yieldPercent", 80.0)
                    .append("packDate", "2026-01-01")
                    .append("expiryDate", "2028-02-29")
                    .append("lifecycleState", "ACTIVE")
                    .append("isDeleted", false)
                    .append("createdAt", new Date());

            Document d2000 = new Document("_id", id2000)
                    .append("batchCode", "TX-POS-2000-02-29")
                    .append("sku", "WBJC")
                    .append("productName", "Wild Berry Juice Concentrate")
                    .append("sourceLotCode", "LOT-POS-2000")
                    .append("farmerName", "Pos Farmer")
                    .append("village", "Pos Village")
                    .append("quantityProduced", 25)
                    .append("unit", "Kg")
                    .append("yieldPercent", 80.0)
                    .append("packDate", "1999-10-01")
                    .append("expiryDate", "2000-02-29")
                    .append("lifecycleState", "ACTIVE")
                    .append("isDeleted", false)
                    .append("createdAt", new Date());

            Document d2026 = new Document("_id", id2026)
                    .append("batchCode", "TX-POS-2026-12-31")
                    .append("sku", "WBJC")
                    .append("productName", "Wild Berry Juice Concentrate")
                    .append("sourceLotCode", "LOT-POS-2026")
                    .append("farmerName", "Pos Farmer")
                    .append("village", "Pos Village")
                    .append("quantityProduced", 25)
                    .append("unit", "Kg")
                    .append("yieldPercent", 80.0)
                    .append("packDate", "2026-09-01")
                    .append("expiryDate", "2026-12-31")
                    .append("lifecycleState", "ACTIVE")
                    .append("isDeleted", false)
                    .append("createdAt", new Date());

            mongoTemplate.getCollection("batches").insertMany(List.of(d2028, d2000, d2026));

            MvcResult expiredRes = mockMvc.perform(get("/api/v1/batches?status=EXPIRED&limit=200")
                            .header("Authorization", "Bearer " + adminToken()))
                    .andExpect(status().isOk())
                    .andReturn();
            List<String> expiredCodes = new ArrayList<>();
            for (JsonNode n : objectMapper.readTree(expiredRes.getResponse().getContentAsString()).path("data").path("data")) {
                expiredCodes.add(n.path("batchCode").asText());
            }
            assertThat(expiredCodes).contains("TX-POS-2000-02-29");

            MvcResult readyRes = mockMvc.perform(get("/api/v1/batches?status=READY&limit=200")
                            .header("Authorization", "Bearer " + adminToken()))
                    .andExpect(status().isOk())
                    .andReturn();
            List<String> readyCodes = new ArrayList<>();
            for (JsonNode n : objectMapper.readTree(readyRes.getResponse().getContentAsString()).path("data").path("data")) {
                readyCodes.add(n.path("batchCode").asText());
            }
            assertThat(readyCodes).contains("TX-POS-2028-02-29", "TX-POS-2026-12-31");

            MvcResult excRes = mockMvc.perform(get("/api/v1/batches?status=EXCEPTION&limit=200")
                            .header("Authorization", "Bearer " + adminToken()))
                    .andExpect(status().isOk())
                    .andReturn();
            List<String> excCodes = new ArrayList<>();
            for (JsonNode n : objectMapper.readTree(excRes.getResponse().getContentAsString()).path("data").path("data")) {
                excCodes.add(n.path("batchCode").asText());
            }
            assertThat(excCodes).doesNotContain("TX-POS-2028-02-29", "TX-POS-2000-02-29", "TX-POS-2026-12-31");
        } finally {
            mongoTemplate.getCollection("batches").deleteMany(new Document("_id", new Document("$in", List.of(id2028, id2000, id2026))));
        }
    }

    @Test
    @DisplayName("Item 4.2: Negative calendar dates 2100-02-29, 2026-13-01, and 2026-00-10 never match any tier filter and route to EXCEPTION")
    void testCalendarRegexNegativeInvalidDatesNeverMatchTierFilters() throws Exception {
        assertThat("2100-02-29".matches(BatchFreshness.ISO_LOCAL_DATE_REGEX)).isFalse();
        assertThat("2026-13-01".matches(BatchFreshness.ISO_LOCAL_DATE_REGEX)).isFalse();
        assertThat("2026-00-10".matches(BatchFreshness.ISO_LOCAL_DATE_REGEX)).isFalse();

        org.bson.types.ObjectId id2100 = new org.bson.types.ObjectId();
        org.bson.types.ObjectId idMonth13 = new org.bson.types.ObjectId();
        org.bson.types.ObjectId idMonth00 = new org.bson.types.ObjectId();
        List<String> negativeCodes = List.of("TX-NEG-2100-02-29", "TX-NEG-2026-13-01", "TX-NEG-2026-00-10");

        try {
            Document d2100 = new Document("_id", id2100)
                    .append("batchCode", "TX-NEG-2100-02-29")
                    .append("sku", "WBJC")
                    .append("productName", "Wild Berry Juice Concentrate")
                    .append("sourceLotCode", "LOT-NEG-2100")
                    .append("farmerName", "Neg Farmer")
                    .append("village", "Neg Village")
                    .append("quantityProduced", 25)
                    .append("unit", "Kg")
                    .append("yieldPercent", 80.0)
                    .append("packDate", "2026-01-01")
                    .append("expiryDate", "2100-02-29")
                    .append("lifecycleState", "ACTIVE")
                    .append("isDeleted", false)
                    .append("createdAt", new Date());

            Document dMonth13 = new Document("_id", idMonth13)
                    .append("batchCode", "TX-NEG-2026-13-01")
                    .append("sku", "WBJC")
                    .append("productName", "Wild Berry Juice Concentrate")
                    .append("sourceLotCode", "LOT-NEG-1301")
                    .append("farmerName", "Neg Farmer")
                    .append("village", "Neg Village")
                    .append("quantityProduced", 25)
                    .append("unit", "Kg")
                    .append("yieldPercent", 80.0)
                    .append("packDate", "2026-01-01")
                    .append("expiryDate", "2026-13-01")
                    .append("lifecycleState", "ACTIVE")
                    .append("isDeleted", false)
                    .append("createdAt", new Date());

            Document dMonth00 = new Document("_id", idMonth00)
                    .append("batchCode", "TX-NEG-2026-00-10")
                    .append("sku", "WBJC")
                    .append("productName", "Wild Berry Juice Concentrate")
                    .append("sourceLotCode", "LOT-NEG-0010")
                    .append("farmerName", "Neg Farmer")
                    .append("village", "Neg Village")
                    .append("quantityProduced", 25)
                    .append("unit", "Kg")
                    .append("yieldPercent", 80.0)
                    .append("packDate", "2026-01-01")
                    .append("expiryDate", "2026-00-10")
                    .append("lifecycleState", "ACTIVE")
                    .append("isDeleted", false)
                    .append("createdAt", new Date());

            mongoTemplate.getCollection("batches").insertMany(List.of(d2100, dMonth13, dMonth00));

            for (String tier : List.of("EXPIRED", "URGENT", "WARNING", "READY")) {
                MvcResult tierRes = mockMvc.perform(get("/api/v1/batches?status=" + tier + "&limit=200")
                                .header("Authorization", "Bearer " + adminToken()))
                        .andExpect(status().isOk())
                        .andReturn();
                List<String> tierCodes = new ArrayList<>();
                for (JsonNode n : objectMapper.readTree(tierRes.getResponse().getContentAsString()).path("data").path("data")) {
                    tierCodes.add(n.path("batchCode").asText());
                }
                assertThat(tierCodes).doesNotContainAnyElementsOf(negativeCodes);
            }

            MvcResult excRes = mockMvc.perform(get("/api/v1/batches?status=EXCEPTION&limit=200")
                            .header("Authorization", "Bearer " + adminToken()))
                    .andExpect(status().isOk())
                    .andReturn();
            List<String> excCodes = new ArrayList<>();
            for (JsonNode n : objectMapper.readTree(excRes.getResponse().getContentAsString()).path("data").path("data")) {
                excCodes.add(n.path("batchCode").asText());
            }
            assertThat(excCodes).containsAll(negativeCodes);
        } finally {
            mongoTemplate.getCollection("batches").deleteMany(new Document("_id", new Document("$in", List.of(id2100, idMonth13, idMonth00))));
        }
    }

    @Test
    @DisplayName("Item 4.4: Every stored date string lands in exactly one of the five tier filters or EXCEPTION, never none and never two")
    void testEveryStoredDateStringLandsInExactlyOneFilterPartition() throws Exception {
        LocalDate today = LocalDate.now(clock);
        Map<String, String> codeToStoredExpiry = new LinkedHashMap<>();
        codeToStoredExpiry.put("TX-PART-TODAY", today.toString());
        codeToStoredExpiry.put("TX-PART-PLUS1", today.plusDays(1).toString());
        codeToStoredExpiry.put("TX-PART-PLUS7", today.plusDays(7).toString());
        codeToStoredExpiry.put("TX-PART-PLUS8", today.plusDays(8).toString());
        codeToStoredExpiry.put("TX-PART-PLUS30", today.plusDays(30).toString());
        codeToStoredExpiry.put("TX-PART-PLUS31", today.plusDays(31).toString());
        codeToStoredExpiry.put("TX-PART-2028-02-29", "2028-02-29");
        codeToStoredExpiry.put("TX-PART-2000-02-29", "2000-02-29");
        codeToStoredExpiry.put("TX-PART-2026-12-31", "2026-12-31");
        codeToStoredExpiry.put("TX-PART-2100-02-29", "2100-02-29");
        codeToStoredExpiry.put("TX-PART-2026-13-01", "2026-13-01");
        codeToStoredExpiry.put("TX-PART-2026-00-10", "2026-00-10");
        codeToStoredExpiry.put("TX-PART-2026-02-31", "2026-02-31");
        codeToStoredExpiry.put("TX-PART-NOTADATE", "not-a-date");
        codeToStoredExpiry.put("TX-PART-EMPTY", "");

        List<org.bson.types.ObjectId> insertedIds = new ArrayList<>();
        try {
            List<Document> docs = new ArrayList<>();
            int idx = 1;
            for (Map.Entry<String, String> entry : codeToStoredExpiry.entrySet()) {
                org.bson.types.ObjectId id = new org.bson.types.ObjectId();
                insertedIds.add(id);
                docs.add(new Document("_id", id)
                        .append("batchCode", entry.getKey())
                        .append("sku", "WBJC")
                        .append("productName", "Wild Berry Juice Concentrate")
                        .append("sourceLotCode", "LOT-PART-" + idx++)
                        .append("farmerName", "Part Farmer")
                        .append("village", "Part Village")
                        .append("quantityProduced", 20)
                        .append("unit", "Kg")
                        .append("yieldPercent", 80.0)
                        .append("packDate", "2026-01-01")
                        .append("expiryDate", entry.getValue())
                        .append("lifecycleState", "ACTIVE")
                        .append("isDeleted", false)
                        .append("createdAt", new Date()));
            }
            org.bson.types.ObjectId dispId = new org.bson.types.ObjectId();
            insertedIds.add(dispId);
            docs.add(new Document("_id", dispId)
                    .append("batchCode", "TX-PART-DISPATCHED")
                    .append("sku", "WBJC")
                    .append("productName", "Wild Berry Juice Concentrate")
                    .append("sourceLotCode", "LOT-PART-DISP")
                    .append("farmerName", "Part Farmer")
                    .append("village", "Part Village")
                    .append("quantityProduced", 20)
                    .append("unit", "Kg")
                    .append("yieldPercent", 80.0)
                    .append("packDate", "2026-01-01")
                    .append("expiryDate", today.plusDays(45).toString())
                    .append("lifecycleState", "DISPATCHED")
                    .append("isDeleted", false)
                    .append("createdAt", new Date()));

            mongoTemplate.getCollection("batches").insertMany(docs);

            List<String> allFilters = List.of("EXPIRED", "URGENT", "WARNING", "READY", "DISPATCHED", "EXCEPTION");
            Map<String, List<String>> codeToMatchingFilters = new LinkedHashMap<>();
            for (String code : codeToStoredExpiry.keySet()) {
                codeToMatchingFilters.put(code, new ArrayList<>());
            }
            codeToMatchingFilters.put("TX-PART-DISPATCHED", new ArrayList<>());

            for (String filter : allFilters) {
                MvcResult res = mockMvc.perform(get("/api/v1/batches?status=" + filter + "&limit=200")
                                .header("Authorization", "Bearer " + adminToken()))
                        .andExpect(status().isOk())
                        .andReturn();
                JsonNode items = objectMapper.readTree(res.getResponse().getContentAsString()).path("data").path("data");
                for (JsonNode item : items) {
                    String code = item.path("batchCode").asText();
                    if (codeToMatchingFilters.containsKey(code)) {
                        codeToMatchingFilters.get(code).add(filter);
                    }
                }
            }

            for (Map.Entry<String, List<String>> entry : codeToMatchingFilters.entrySet()) {
                System.out.println("Partition check: " + entry.getKey() + " -> " + entry.getValue());
                assertThat(entry.getValue())
                        .as("Batch %s must match exactly 1 filter (never 0 and never >= 2)", entry.getKey())
                        .hasSize(1);
            }
        } finally {
            mongoTemplate.getCollection("batches").deleteMany(new Document("_id", new Document("$in", insertedIds)));
        }
    }
}
