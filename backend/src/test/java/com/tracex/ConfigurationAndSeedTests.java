package com.tracex;

import com.tracex.config.AppConfig;
import com.tracex.repository.UserRepository;
import com.tracex.service.SeedRunner;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.lang.reflect.Field;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ConfigurationAndSeedTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private SeedRunner seedRunner;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private com.tracex.repository.AccessRequestRepository accessRequestRepository;

    @Autowired
    private com.tracex.repository.ProductRepository productRepository;

    @Autowired
    private com.tracex.repository.BatchRepository batchRepository;

    @Autowired
    private org.springframework.data.mongodb.core.MongoTemplate mongoTemplate;

    @org.junit.jupiter.api.BeforeEach
    void setUpSeed() {
        seedRunner.run();
    }

    @Test
    @DisplayName("Prod profile fails fast when JWT_SECRET is missing or shorter than 32 characters")
    void testProdProfileFailsFastWithoutValidJwtSecret() throws Exception {
        MockEnvironment prodEnv = new MockEnvironment();
        prodEnv.setActiveProfiles("prod");

        AppConfig appConfig = new AppConfig(prodEnv);

        Field jwtSecretField = AppConfig.class.getDeclaredField("jwtSecret");
        jwtSecretField.setAccessible(true);
        jwtSecretField.set(appConfig, "short_secret");

        Field frontendUrlField = AppConfig.class.getDeclaredField("frontendUrl");
        frontendUrlField.setAccessible(true);
        frontendUrlField.set(appConfig, "https://tracex.example.com");

        assertThatThrownBy(appConfig::validateConfiguration)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("JWT_SECRET");
    }

    @Test
    @DisplayName("Prod profile fails fast when FRONTEND_URL is missing")
    void testProdProfileFailsFastWithoutFrontendUrl() throws Exception {
        MockEnvironment prodEnv = new MockEnvironment();
        prodEnv.setActiveProfiles("prod");

        AppConfig appConfig = new AppConfig(prodEnv);

        Field jwtSecretField = AppConfig.class.getDeclaredField("jwtSecret");
        jwtSecretField.setAccessible(true);
        jwtSecretField.set(appConfig, "valid_production_secret_key_that_is_at_least_32_bytes_long_123456");

        Field traceTokenSecretField = AppConfig.class.getDeclaredField("traceTokenSecret");
        traceTokenSecretField.setAccessible(true);
        traceTokenSecretField.set(appConfig, "valid_production_secret_key_that_is_at_least_32_bytes_long_123456");

        Field frontendUrlField = AppConfig.class.getDeclaredField("frontendUrl");
        frontendUrlField.setAccessible(true);
        frontendUrlField.set(appConfig, "");

        assertThatThrownBy(appConfig::validateConfiguration)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("FRONTEND_URL");
    }

    @Test
    @DisplayName("Prod profile with SEED_ENABLED=true fails fast when SEED_DEFAULT_PASSWORD is missing or shorter than 12 characters")
    void testProdProfileFailsFastWithoutValidSeedDefaultPasswordWhenSeedEnabled() throws Exception {
        MockEnvironment prodEnv = new MockEnvironment();
        prodEnv.setActiveProfiles("prod");

        AppConfig appConfig = new AppConfig(prodEnv);

        Field jwtSecretField = AppConfig.class.getDeclaredField("jwtSecret");
        jwtSecretField.setAccessible(true);
        jwtSecretField.set(appConfig, "valid_production_secret_key_that_is_at_least_32_bytes_long_123456");

        Field traceTokenSecretField = AppConfig.class.getDeclaredField("traceTokenSecret");
        traceTokenSecretField.setAccessible(true);
        traceTokenSecretField.set(appConfig, "valid_production_secret_key_that_is_at_least_32_bytes_long_123456");

        Field frontendUrlField = AppConfig.class.getDeclaredField("frontendUrl");
        frontendUrlField.setAccessible(true);
        frontendUrlField.set(appConfig, "https://tracex.example.com");

        Field publicTraceBaseUrlField = AppConfig.class.getDeclaredField("publicTraceBaseUrl");
        publicTraceBaseUrlField.setAccessible(true);
        publicTraceBaseUrlField.set(appConfig, "https://trace.example.com");

        Field seedEnabledField = AppConfig.class.getDeclaredField("seedEnabled");
        seedEnabledField.setAccessible(true);
        seedEnabledField.set(appConfig, true);

        Field seedDefaultPasswordField = AppConfig.class.getDeclaredField("seedDefaultPassword");
        seedDefaultPasswordField.setAccessible(true);
        seedDefaultPasswordField.set(appConfig, "short123");

        assertThatThrownBy(appConfig::validateConfiguration)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("SEED_DEFAULT_PASSWORD");

        // Also test completely empty password
        seedDefaultPasswordField.set(appConfig, "");
        assertThatThrownBy(appConfig::validateConfiguration)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("SEED_DEFAULT_PASSWORD");
    }

    @Test
    @DisplayName("Safety guard aborts execution when connected database name does not end with _test")
    void testSafetyGuardAbortsWhenDatabaseNameDoesNotEndWithTest() {
        org.springframework.data.mongodb.core.MongoTemplate mockDevTemplate = org.mockito.Mockito.mock(org.springframework.data.mongodb.core.MongoTemplate.class);
        com.mongodb.client.MongoDatabase mockDb = org.mockito.Mockito.mock(com.mongodb.client.MongoDatabase.class);
        org.mockito.Mockito.when(mockDevTemplate.getDb()).thenReturn(mockDb);
        org.mockito.Mockito.when(mockDb.getName()).thenReturn("tracex_fresh_dev");

        assertThatThrownBy(() -> com.tracex.util.TestDatabaseSafetyGuard.checkTestDatabase(mockDevTemplate))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("tracex_fresh_dev")
                .hasMessageContaining("_test");
    }

    @Test
    @DisplayName("Seed runner is idempotent: seeding twice leaves identical document counts")
    void testSeedTwiceGivesIdenticalCounts() {
        userRepository.deleteAll();

        seedRunner.seedUsers();
        long countAfterFirstSeed = userRepository.count();
        assertThat(countAfterFirstSeed).isEqualTo(6);

        // Run seed a second time
        seedRunner.seedUsers();
        long countAfterSecondSeed = userRepository.count();
        assertThat(countAfterSecondSeed).isEqualTo(countAfterFirstSeed);
    }

    @Test
    @DisplayName("Wrong HTTP method returns 405 with code METHOD_NOT_ALLOWED and requestId")
    void testWrongHttpMethodReturns405MethodNotAllowed() throws Exception {
        mockMvc.perform(get("/api/v1/auth/login"))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(header().exists("X-Request-Id"))
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value("METHOD_NOT_ALLOWED"))
                .andExpect(jsonPath("$.error").value("HTTP method not supported for this endpoint"))
                .andExpect(jsonPath("$.requestId").isNotEmpty());
    }

    @Test
    @DisplayName("Request ID header is present on every response, including /actuator/health")
    void testRequestIdOnEveryResponse() throws Exception {
        // /actuator/health sets X-Request-Id header (via RequestIdFilter) but uses Actuator's own body format
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(header().exists("X-Request-Id"));

        // TraceX-envelope endpoints also embed requestId in the body
        mockMvc.perform(get("/api/v1/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().exists("X-Request-Id"))
                .andExpect(jsonPath("$.requestId").isNotEmpty());
    }

    @Test
    @DisplayName("No error response body contains 'Exception' or 'at com.'")
    void testNoErrorResponseBodyContainsExceptionOrStack() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType("application/json")
                        .content("{malformed: json"))
                .andExpect(status().isUnprocessableEntity())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        assertThat(body).doesNotContain("Exception");
        assertThat(body).doesNotContain("at com.");
        assertThat(body).doesNotContain("org.springframework");
    }

    @Test
    @DisplayName("Actuator health reports database UP")
    void testActuatorHealthReportsDatabaseUp() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.components.mongo.status").value("UP"));
    }

    @Test
    @DisplayName("MongoHealthIndicator reports DOWN when database is unavailable")
    void testMongoHealthIndicatorDownWhenUnavailable() {
        org.springframework.data.mongodb.core.MongoTemplate mockTemplate = org.mockito.Mockito.mock(org.springframework.data.mongodb.core.MongoTemplate.class);
        org.mockito.Mockito.when(mockTemplate.executeCommand(org.mockito.ArgumentMatchers.any(org.bson.Document.class)))
                .thenThrow(new org.springframework.data.mongodb.UncategorizedMongoDbException("Connection refused", new RuntimeException()));

        org.springframework.boot.actuate.data.mongo.MongoHealthIndicator indicator =
                new org.springframework.boot.actuate.data.mongo.MongoHealthIndicator(mockTemplate);

        org.springframework.boot.actuate.health.Health health = indicator.health();
        assertThat(health.getStatus()).isEqualTo(org.springframework.boot.actuate.health.Status.DOWN);
    }

    @Test
    @DisplayName("Seed-dependent tests assert non-zero expected counts (5 products, 12 demo batches, demo users, access requests) and current year-month batchCode prefix")
    void testSeedDependentCollectionsHaveNonZeroCounts() {
        assertThat(userRepository.count()).isGreaterThanOrEqualTo(6);
        assertThat(accessRequestRepository.count()).isGreaterThanOrEqualTo(3);
        assertThat(productRepository.count()).isGreaterThanOrEqualTo(5);
        assertThat(batchRepository.count()).isGreaterThanOrEqualTo(12);

        java.time.LocalDate today = java.time.LocalDate.now(java.time.ZoneId.of("Asia/Kolkata"));
        String expectedPrefix = String.format("TX-%04d-%02d-", today.getYear(), today.getMonthValue());
        java.util.List<com.tracex.model.Batch> demoBatches = batchRepository.findAll().stream()
                .filter(b -> b.getSourceLotCode() != null && b.getSourceLotCode().startsWith("DEMO-LOT-"))
                .sorted(java.util.Comparator.comparing(com.tracex.model.Batch::getSourceLotCode))
                .toList();
        assertThat(demoBatches).hasSize(12);
        for (com.tracex.model.Batch b : demoBatches) {
            System.out.println(String.format("SEEDED_BATCH: sourceLotCode=%s, batchCode=%s, packDate=%s, expiryDate=%s, lifecycleState=%s",
                    b.getSourceLotCode(), b.getBatchCode(), b.getPackDate(), b.getExpiryDate(), b.getLifecycleState()));
            assertThat(b.getBatchCode())
                    .as("Seeded batch " + b.getSourceLotCode() + " must start with current year and month " + expectedPrefix)
                    .startsWith(expectedPrefix);
        }
    }

    @Test
    @DisplayName("Regression F2: Seeding fails loudly naming SEED_DEFAULT_PASSWORD whenever enabled and password is missing in every profile")
    void testSeedRunnerFailsLoudlyWhenSeedEnabledAndPasswordMissing() throws Exception {
        String[] profiles = {"dev", "test", "prod"};
        for (String profile : profiles) {
            MockEnvironment env = new MockEnvironment();
            env.setActiveProfiles(profile);

            SeedRunner runner = new SeedRunner(
                    userRepository,
                    org.mockito.Mockito.mock(org.springframework.security.crypto.password.PasswordEncoder.class),
                    accessRequestRepository,
                    org.mockito.Mockito.mock(com.tracex.service.AuditService.class),
                    productRepository,
                    batchRepository,
                    java.time.Clock.systemUTC(),
                    mongoTemplate,
                    env
            );

            Field seedEnabledField = SeedRunner.class.getDeclaredField("seedEnabled");
            seedEnabledField.setAccessible(true);
            seedEnabledField.set(runner, true);

            Field defaultPasswordField = SeedRunner.class.getDeclaredField("defaultPassword");
            defaultPasswordField.setAccessible(true);
            defaultPasswordField.set(runner, "");

            assertThatThrownBy(runner::run)
                    .as("Profile " + profile + " must fail loudly when SEED_DEFAULT_PASSWORD is missing")
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("SEED_DEFAULT_PASSWORD");

            assertThatThrownBy(runner::seedUsers)
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("SEED_DEFAULT_PASSWORD");
        }
    }

    @Test
    @DisplayName("Regression SeedRunner: running seed twice against _test database causes no duplicate-key error and preserves exactly 12 demo batches")
    void testSeedTwiceDoesNotThrowDuplicateKeyAndPreserves12DemoBatches() {
        // Run full seed first time
        seedRunner.run();
        java.util.List<com.tracex.model.Batch> firstRun = batchRepository.findAll().stream()
                .filter(b -> b.getSourceLotCode() != null && b.getSourceLotCode().startsWith("DEMO-LOT-"))
                .toList();
        assertThat(firstRun).hasSize(12);

        // Run full seed second time - must not throw DuplicateKeyException on batchCode or sourceLotCode
        seedRunner.run();
        java.util.List<com.tracex.model.Batch> secondRun = batchRepository.findAll().stream()
                .filter(b -> b.getSourceLotCode() != null && b.getSourceLotCode().startsWith("DEMO-LOT-"))
                .toList();
        assertThat(secondRun).hasSize(12);

        // All 12 have distinct lot codes and batch codes
        java.util.Set<String> lotCodes = secondRun.stream().map(com.tracex.model.Batch::getSourceLotCode).collect(java.util.stream.Collectors.toSet());
        java.util.Set<String> batchCodes = secondRun.stream().map(com.tracex.model.Batch::getBatchCode).collect(java.util.stream.Collectors.toSet());
        assertThat(lotCodes).hasSize(12);
        assertThat(batchCodes).hasSize(12);
    }
}
