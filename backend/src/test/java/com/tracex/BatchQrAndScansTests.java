package com.tracex;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tracex.config.AppConfig;
import com.tracex.dto.BatchCreateDto;
import com.tracex.dto.BatchDetailDto;
import com.tracex.model.Batch;
import com.tracex.model.Product;
import com.tracex.model.Role;
import com.tracex.model.User;
import com.tracex.repository.BatchRepository;
import com.tracex.repository.ProductRepository;
import com.tracex.repository.UserRepository;
import com.tracex.security.JwtService;
import com.tracex.service.BatchService;
import com.tracex.service.BatchTraceTokenBackfillRunner;
import com.tracex.service.QrService;
import com.tracex.service.TraceTokenService;
import com.tracex.util.TestDatabaseSafetyGuard;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.lang.reflect.Field;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class BatchQrAndScansTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private MongoTemplate mongoTemplate;

    @Autowired
    private BatchRepository batchRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private BatchService batchService;

    @Autowired
    private QrService qrService;

    @Autowired
    private TraceTokenService traceTokenService;

    @Autowired
    private BatchTraceTokenBackfillRunner backfillRunner;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Value("${tracex.security.public-trace-base-url:http://localhost:5174}")
    private String publicTraceBaseUrl;

    private Product testProduct;
    private final Map<String, String> roleTokens = new HashMap<>();
    private final List<String> createdBatchIds = Collections.synchronizedList(new ArrayList<>());

    @BeforeEach
    void setUp() {
        TestDatabaseSafetyGuard.checkTestDatabase(mongoTemplate);

        testProduct = productRepository.findBySku("TEST-QR-SKU").orElseGet(() -> {
            Product p = new Product();
            p.setSku("TEST-QR-SKU");
            p.setProductName("Test Honey");
            p.setCategory("Preserves");
            p.setBaseShelfLifeDays(365);
            p.setRiskLevel("LOW");
            return productRepository.save(p);
        });

        setupRoleUsers();
    }

    @org.junit.jupiter.api.AfterEach
    void tearDown() {
        if (!createdBatchIds.isEmpty()) {
            batchRepository.deleteAllById(createdBatchIds);
            createdBatchIds.clear();
        }
    }

    private void setupRoleUsers() {
        createUserIfNotExists("qr_sa", Role.ADMIN, true, "super-admin");
        createUserIfNotExists("qr_admin", Role.ADMIN, false, "admin");
        createUserIfNotExists("qr_mgr", Role.MANAGER, false, "manager");
        createUserIfNotExists("qr_fm", Role.FACTORY_MANAGER, false, "factory-manager");
        createUserIfNotExists("qr_qi", Role.QUALITY_INSPECTOR, false, "quality-inspector");
        createUserIfNotExists("qr_dc", Role.DISPATCH_COORDINATOR, false, "dispatch-coordinator");
    }

    private void createUserIfNotExists(String username, Role role, boolean isSuperAdmin, String roleKey) {
        User user = userRepository.findByUsername(username).orElseGet(() -> {
            User u = new User(username, passwordEncoder.encode("Password123!"), "Test " + roleKey, username + "@example.com", role, isSuperAdmin);
            u.setActive(true);
            return userRepository.save(u);
        });
        String token = jwtService.generateToken(user.getId(), user.getTokenVersion());
        roleTokens.put(roleKey, token);
    }

    private Batch createTestBatch() {
        Batch b = new Batch();
        b.setProductId(testProduct.getId());
        b.setProductName(testProduct.getProductName());
        b.setSku(testProduct.getSku());
        b.setSourceLotCode("LOT-" + UUID.randomUUID().toString().substring(0, 8));
        b.setFarmerName("Test Farmer");
        b.setVillage("Valley");
        b.setQuantityProduced(50);
        b.setUnit("Jar");
        b.setYieldPercent(90.0);
        b.setBatchCode("TX-2026-10-" + UUID.randomUUID().toString().substring(0, 4));
        b.setPackDate(LocalDate.now());
        b.setExpiryDate(LocalDate.now().plusDays(60));
        b.setLifecycleState("ACTIVE");
        b.setTraceToken(traceTokenService.generateToken());
        b.setCreatedBy("qr_fm");
        b.setDeleted(false);
        Batch saved = batchRepository.save(b);
        createdBatchIds.add(saved.getId());
        return saved;
    }

    @Test
    @DisplayName("All six roles can access /qr and /scans endpoints")
    void testAllSixRolesCanAccessQrAndScansEndpoints() throws Exception {
        Batch batch = createTestBatch();

        for (Map.Entry<String, String> entry : roleTokens.entrySet()) {
            String roleName = entry.getKey();
            String token = entry.getValue();

            // GET /qr
            MvcResult qrRes = mockMvc.perform(get("/api/v1/batches/" + batch.getId() + "/qr")
                            .header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk())
                    .andReturn();

            JsonNode qrJson = objectMapper.readTree(qrRes.getResponse().getContentAsString());
            assertThat(qrJson.path("success").asBoolean()).as("QR success for role " + roleName).isTrue();
            assertThat(qrJson.path("data").path("qrCodeDataUrl").asText())
                    .startsWith("data:image/png;base64,");
            assertThat(qrJson.path("data").path("qrAbsoluteUrl").asText())
                    .contains("/trace/t/" + batch.getTraceToken());

            // GET /scans
            MvcResult scansRes = mockMvc.perform(get("/api/v1/batches/" + batch.getId() + "/scans")
                            .header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk())
                    .andReturn();

            JsonNode scansJson = objectMapper.readTree(scansRes.getResponse().getContentAsString());
            assertThat(scansJson.path("success").asBoolean()).as("Scans success for role " + roleName).isTrue();
            assertThat(scansJson.path("data").path("total").asLong()).isGreaterThanOrEqualTo(0);
            assertThat(scansJson.path("data").path("byDevice").isObject()).isTrue();
            assertThat(scansJson.path("data").path("bySource").isObject()).isTrue();
        }
    }

    @Test
    @DisplayName("Unauthenticated request to /qr and /scans returns 401 AUTH_NO_TOKEN")
    void testUnauthenticatedAccessReturns401AuthNoToken() throws Exception {
        Batch batch = createTestBatch();

        mockMvc.perform(get("/api/v1/batches/" + batch.getId() + "/qr"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_NO_TOKEN"));

        mockMvc.perform(get("/api/v1/batches/" + batch.getId() + "/scans"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_NO_TOKEN"));
    }

    @Test
    @DisplayName("Missing or archived batch id returns 404 for /qr and /scans")
    void testMissingOrArchivedBatchReturns404() throws Exception {
        String token = roleTokens.get("admin");
        String nonExistentId = "662f6b8a8b1a8d001c2a3b4c";

        mockMvc.perform(get("/api/v1/batches/" + nonExistentId + "/qr")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));

        mockMvc.perform(get("/api/v1/batches/" + nonExistentId + "/scans")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));

        // Archived batch
        Batch batch = createTestBatch();
        batch.setDeleted(true);
        batchRepository.save(batch);

        mockMvc.perform(get("/api/v1/batches/" + batch.getId() + "/qr")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));

        mockMvc.perform(get("/api/v1/batches/" + batch.getId() + "/scans")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    @DisplayName("Scans response never contains ipHash")
    void testScansResponseNeverContainsIpHash() throws Exception {
        Batch batch = createTestBatch();
        qrService.recordScan(batch.getTraceToken(), "buyer", null);

        String token = roleTokens.get("manager");
        MvcResult res = mockMvc.perform(get("/api/v1/batches/" + batch.getId() + "/scans")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();

        String content = res.getResponse().getContentAsString();
        assertThat(content).doesNotContain("ipHash");
        assertThat(content).doesNotContain("ip_hash");
    }

    @Test
    @DisplayName("TEST-M-01: createBatch returns qrAbsoluteUrl starting with PUBLIC_TRACE_BASE_URL")
    void testCreateBatchReturnsQrAbsoluteUrlStartingWithPublicTraceBaseUrl() {
        BatchCreateDto dto = new BatchCreateDto();
        dto.setProductId(testProduct.getId());
        dto.setSourceLotCode("LOT-M01-" + UUID.randomUUID().toString().substring(0, 6));
        dto.setFarmerName("TEST-M01 Farmer");
        dto.setVillage("TEST-M01 Village");
        dto.setQuantityProduced(75);
        dto.setUnit("Jar");
        dto.setYieldPercent(85.0);
        dto.setPackDate(LocalDate.now());

        BatchDetailDto created = batchService.createBatch(dto, "qr_fm", "req-m01");
        createdBatchIds.add(created.getId());
        assertThat(created.getQrAbsoluteUrl()).isNotNull();
        String expectedPrefix = publicTraceBaseUrl.endsWith("/")
                ? publicTraceBaseUrl.substring(0, publicTraceBaseUrl.length() - 1)
                : publicTraceBaseUrl;
        assertThat(created.getQrAbsoluteUrl()).startsWith(expectedPrefix);
        assertThat(created.getQrAbsoluteUrl()).contains("/trace/t/");
    }

    @Test
    @DisplayName("Tokens are unique across 50 concurrent batch creations")
    void testTokensUniqueAcross50ConcurrentCreates() throws Exception {
        int count = 50;
        ExecutorService executor = Executors.newFixedThreadPool(10);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(count);
        List<String> createdTokens = Collections.synchronizedList(new ArrayList<>());

        for (int i = 0; i < count; i++) {
            final int index = i;
            executor.submit(() -> {
                try {
                    startLatch.await();
                    BatchCreateDto dto = new BatchCreateDto();
                    dto.setProductId(testProduct.getId());
                    dto.setSourceLotCode("LOT-CONC-" + index + "-" + UUID.randomUUID().toString().substring(0, 4));
                    dto.setFarmerName("Farmer " + index);
                    dto.setVillage("Village " + index);
                    dto.setQuantityProduced(10);
                    dto.setUnit("Jar");
                    dto.setYieldPercent(80.0);
                    dto.setPackDate(LocalDate.now());

                    BatchDetailDto created = batchService.createBatch(dto, "qr_fm", "req-conc-" + index);
                    createdBatchIds.add(created.getId());
                    String url = created.getQrAbsoluteUrl();
                    String token = url.substring(url.lastIndexOf('/') + 1);
                    createdTokens.add(token);
                } catch (Exception e) {
                    throw new RuntimeException(e);
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        startLatch.countDown();
        boolean completed = doneLatch.await(15, TimeUnit.SECONDS);
        executor.shutdown();
        assertThat(completed).isTrue();

        assertThat(createdTokens).hasSize(count);
        Set<String> uniqueTokens = new HashSet<>(createdTokens);
        assertThat(uniqueTokens).hasSize(count);

        for (String token : uniqueTokens) {
            assertThat(traceTokenService.isValidToken(token)).isTrue();
        }
    }

    @Test
    @DisplayName("Startup backfill sets tokens only where missing, is no-op on second run, does not change existing tokens")
    void testBackfillMissingTokens() {
        // Insert batch without traceToken
        Batch missing = new Batch();
        missing.setProductId(testProduct.getId());
        missing.setProductName(testProduct.getProductName());
        missing.setSku(testProduct.getSku());
        missing.setSourceLotCode("LOT-MISSING-" + UUID.randomUUID().toString().substring(0, 6));
        missing.setBatchCode("TX-2026-10-M" + UUID.randomUUID().toString().substring(0, 6));
        missing.setPackDate(LocalDate.now());
        missing.setExpiryDate(LocalDate.now().plusDays(30));
        missing.setTraceToken(null);
        missing = batchRepository.save(missing);
        createdBatchIds.add(missing.getId());

        // Insert batch with existing token
        String existingToken = traceTokenService.generateToken();
        Batch existing = new Batch();
        existing.setProductId(testProduct.getId());
        existing.setProductName(testProduct.getProductName());
        existing.setSku(testProduct.getSku());
        existing.setSourceLotCode("LOT-EXISTING-" + UUID.randomUUID().toString().substring(0, 6));
        existing.setBatchCode("TX-2026-10-E" + UUID.randomUUID().toString().substring(0, 6));
        existing.setPackDate(LocalDate.now());
        existing.setExpiryDate(LocalDate.now().plusDays(30));
        existing.setTraceToken(existingToken);
        existing = batchRepository.save(existing);
        createdBatchIds.add(existing.getId());

        // First run backfills the missing one
        int updatedCount = backfillRunner.backfillMissingTokens();
        assertThat(updatedCount).isGreaterThanOrEqualTo(1);

        Batch updatedMissing = batchRepository.findById(missing.getId()).orElseThrow();
        assertThat(updatedMissing.getTraceToken()).isNotBlank();
        assertThat(traceTokenService.isValidToken(updatedMissing.getTraceToken())).isTrue();

        Batch unchangedExisting = batchRepository.findById(existing.getId()).orElseThrow();
        assertThat(unchangedExisting.getTraceToken()).isEqualTo(existingToken);

        // Second run is a no-op
        int secondRunCount = backfillRunner.backfillMissingTokens();
        assertThat(secondRunCount).isEqualTo(0);

        Batch finalExisting = batchRepository.findById(existing.getId()).orElseThrow();
        assertThat(finalExisting.getTraceToken()).isEqualTo(existingToken);
    }

    @Test
    @DisplayName("Prod profile fails fast when TRACE_TOKEN_SECRET is missing or shorter than 32 characters")
    void testProdProfileFailsFastWithoutValidTraceTokenSecret() throws Exception {
        MockEnvironment prodEnv = new MockEnvironment();
        prodEnv.setActiveProfiles("prod");

        AppConfig appConfig = new AppConfig(prodEnv);

        setField(appConfig, "jwtSecret", "a_very_long_valid_jwt_secret_that_is_at_least_32_characters_long");
        setField(appConfig, "frontendUrl", "https://tracex.example.com");
        setField(appConfig, "publicTraceBaseUrl", "https://trace.example.com");

        // Missing TRACE_TOKEN_SECRET
        setField(appConfig, "traceTokenSecret", "");
        assertThatThrownBy(appConfig::validateConfiguration)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("TRACE_TOKEN_SECRET");

        // Short TRACE_TOKEN_SECRET (10 chars)
        setField(appConfig, "traceTokenSecret", "0123456789");
        assertThatThrownBy(appConfig::validateConfiguration)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("TRACE_TOKEN_SECRET");
    }

    @Test
    @DisplayName("Prod profile refuses a localhost or loopback PUBLIC_TRACE_BASE_URL")
    void testProdProfileRefusesLocalhostPublicTraceBaseUrl() throws Exception {
        MockEnvironment prodEnv = new MockEnvironment();
        prodEnv.setActiveProfiles("prod");

        AppConfig appConfig = new AppConfig(prodEnv);

        setField(appConfig, "jwtSecret", "a_very_long_valid_jwt_secret_that_is_at_least_32_characters_long");
        setField(appConfig, "traceTokenSecret", "a_very_long_valid_trace_token_secret_that_is_at_least_32_chars");
        setField(appConfig, "frontendUrl", "https://tracex.example.com");

        // Localhost
        setField(appConfig, "publicTraceBaseUrl", "http://localhost:5174");
        assertThatThrownBy(appConfig::validateConfiguration)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("PUBLIC_TRACE_BASE_URL");

        // 127.0.0.1
        setField(appConfig, "publicTraceBaseUrl", "http://127.0.0.1:5174");
        assertThatThrownBy(appConfig::validateConfiguration)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("PUBLIC_TRACE_BASE_URL");
    }

    @Test
    @DisplayName("Two concurrent GETs on a batch with no traceToken end with exactly one stored token and both responses use it")
    void testTwoConcurrentGetsOnBatchWithNoTokenEndWithExactlyOneStoredTokenAndBothResponsesUseIt() throws Exception {
        Batch batch = new Batch();
        batch.setProductId(testProduct.getId());
        batch.setProductName(testProduct.getProductName());
        batch.setSku(testProduct.getSku());
        batch.setBatchCode("TX-CONCURRENT-NO-TOKEN");
        batch.setPackDate(LocalDate.now());
        batch.setExpiryDate(LocalDate.now().plusDays(60));
        batch.setLifecycleState("ACTIVE");
        batch.setTraceToken(null);
        batch = batchRepository.save(batch);
        createdBatchIds.add(batch.getId());

        String adminToken = roleTokens.get("admin");
        String batchId = batch.getId();

        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch startLatch = new CountDownLatch(1);

        Callable<String> callGetQr = () -> {
            startLatch.await();
            MvcResult res = mockMvc.perform(get("/api/v1/batches/" + batchId + "/qr")
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andReturn();
            JsonNode root = objectMapper.readTree(res.getResponse().getContentAsString());
            return root.path("data").path("qrAbsoluteUrl").asText();
        };

        Future<String> f1 = executor.submit(callGetQr);
        Future<String> f2 = executor.submit(callGetQr);

        startLatch.countDown();

        String url1 = f1.get(10, TimeUnit.SECONDS);
        String url2 = f2.get(10, TimeUnit.SECONDS);
        executor.shutdown();

        assertThat(url1).isNotBlank();
        assertThat(url2).isNotBlank();
        assertThat(url1).isEqualTo(url2);

        Batch storedBatch = batchRepository.findById(batchId).orElseThrow();
        assertThat(storedBatch.getTraceToken()).isNotBlank();
        assertThat(url1).endsWith("/trace/t/" + storedBatch.getTraceToken());
    }

    private void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = AppConfig.class.getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}
