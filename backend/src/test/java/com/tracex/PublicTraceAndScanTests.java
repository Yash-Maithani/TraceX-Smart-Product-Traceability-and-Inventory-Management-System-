package com.tracex;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tracex.model.Batch;
import com.tracex.model.Product;
import com.tracex.model.ScanEvent;
import com.tracex.repository.BatchRepository;
import com.tracex.repository.ProductRepository;
import com.tracex.repository.ScanEventRepository;
import com.tracex.security.RateLimiter;
import com.tracex.service.TraceTokenService;
import com.tracex.util.MutableClock;
import com.tracex.util.TestDatabaseSafetyGuard;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import java.util.concurrent.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class PublicTraceAndScanTests {

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
    private ScanEventRepository scanEventRepository;

    @Autowired
    private TraceTokenService traceTokenService;

    @Autowired
    private RateLimiter rateLimiter;

    @Autowired
    private MutableClock mutableClock;

    private Product testProduct;
    private final List<String> createdBatchIds = Collections.synchronizedList(new ArrayList<>());

    @BeforeEach
    void setUp() {
        TestDatabaseSafetyGuard.checkTestDatabase(mongoTemplate);
        rateLimiter.resetAll();
        scanEventRepository.deleteAll();

        testProduct = productRepository.findBySku("TEST-TRACE-SKU").orElseGet(() -> {
            Product p = new Product();
            p.setSku("TEST-TRACE-SKU");
            p.setProductName("Test Trace Organic Jam");
            p.setCategory("Preserves");
            p.setBaseShelfLifeDays(180);
            p.setRiskLevel("LOW");
            return productRepository.save(p);
        });
    }

    @AfterEach
    void tearDown() {
        mutableClock.reset();
        rateLimiter.resetAll();
        if (!createdBatchIds.isEmpty()) {
            batchRepository.deleteAllById(createdBatchIds);
            createdBatchIds.clear();
        }
        scanEventRepository.deleteAll();
    }

    private Batch createTestBatch(LocalDate packDate, LocalDate expiryDate, String lifecycleState, String token) {
        Batch b = new Batch();
        b.setProductId(testProduct.getId());
        b.setProductName(testProduct.getProductName());
        b.setSku(testProduct.getSku());
        b.setSourceLotCode("LOT-" + UUID.randomUUID().toString().substring(0, 8));
        b.setFarmerName("Private Secret Farmer");
        b.setVillage("Sunny Valley");
        b.setQuantityProduced(100);
        b.setUnit("Jar");
        b.setYieldPercent(95.0);
        b.setBatchCode("TX-2026-10-" + UUID.randomUUID().toString().substring(0, 4));
        b.setPackDate(packDate);
        b.setExpiryDate(expiryDate);
        b.setLifecycleState(lifecycleState);
        b.setTraceabilityNote("Authentic organic batch note");
        b.setTraceToken(token != null ? token : traceTokenService.generateToken());
        b.setCreatedBy("test-user");
        b.setDeleted(false);
        Batch saved = batchRepository.save(b);
        createdBatchIds.add(saved.getId());
        return saved;
    }

    @Test
    @DisplayName("Public trace: whitelist asserted by exact JSON key set, no farmerName, no traceToken")
    void testPublicTraceWhitelistAndPrivacy() throws Exception {
        Batch batch = createTestBatch(LocalDate.of(2026, 9, 1), LocalDate.of(2026, 12, 1), "ACTIVE", null);

        MvcResult result = mockMvc.perform(get("/api/v1/qr/trace/t/" + batch.getTraceToken()))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andExpect(header().string("Referrer-Policy", "no-referrer"))
                .andReturn();

        JsonNode root = objectMapper.readTree(result.getResponse().getContentAsString());
        assertThat(root.path("success").asBoolean()).isTrue();
        JsonNode data = root.path("data");

        // Exact whitelisted top-level data keys
        List<String> fieldNames = new ArrayList<>();
        data.fieldNames().forEachRemaining(fieldNames::add);

        List<String> expectedKeys = List.of(
                "batchCode", "productName", "sku", "village",
                "packDate", "expiryDate", "status", "qualityCheck", "traceabilityNote"
        );
        assertThat(fieldNames).containsExactlyInAnyOrderElementsOf(expectedKeys);

        // Explicitly assert forbidden fields are absent
        assertThat(data.has("farmerName")).isFalse();
        assertThat(data.has("traceToken")).isFalse();
        assertThat(data.has("id")).isFalse();
        assertThat(data.has("_id")).isFalse();
        assertThat(data.has("createdBy")).isFalse();
        assertThat(data.has("yieldPercent")).isFalse();
        assertThat(data.has("quantityProduced")).isFalse();

        // Values match
        assertThat(data.path("batchCode").asText()).isEqualTo(batch.getBatchCode());
        assertThat(data.path("productName").asText()).isEqualTo("Test Trace Organic Jam");
        assertThat(data.path("village").asText()).isEqualTo("Sunny Valley");
        assertThat(data.path("traceabilityNote").asText()).isEqualTo("Authentic organic batch note");
    }

    @Test
    @DisplayName("Public trace: qualityCheck null vs populated cases, inspectorName never present")
    void testQualityCheckFieldHandling() throws Exception {
        // 1. Quality check null
        Batch b1 = createTestBatch(LocalDate.of(2026, 9, 1), LocalDate.of(2026, 12, 1), "ACTIVE", null);
        b1.setQualityCheck(null);
        batchRepository.save(b1);

        MvcResult r1 = mockMvc.perform(get("/api/v1/qr/trace/t/" + b1.getTraceToken()))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode data1 = objectMapper.readTree(r1.getResponse().getContentAsString()).path("data");
        assertThat(data1.path("qualityCheck").isNull()).isTrue();

        // 2. Quality check populated
        Batch.QualityCheck qc = new Batch.QualityCheck("PASSED", 5, Instant.now(), "Secret Inspector");
        b1.setQualityCheck(qc);
        batchRepository.save(b1);

        MvcResult r2 = mockMvc.perform(get("/api/v1/qr/trace/t/" + b1.getTraceToken()))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode data2 = objectMapper.readTree(r2.getResponse().getContentAsString()).path("data");
        JsonNode qcNode = data2.path("qualityCheck");
        assertThat(qcNode.isNull()).isFalse();

        List<String> qcKeys = new ArrayList<>();
        qcNode.fieldNames().forEachRemaining(qcKeys::add);
        assertThat(qcKeys).containsExactlyInAnyOrder("status", "rating", "inspectedAt");
        assertThat(qcNode.path("status").asText()).isEqualTo("PASSED");
        assertThat(qcNode.path("rating").asInt()).isEqualTo(5);
        assertThat(qcNode.has("inspectorName")).isFalse();
        assertThat(qcNode.has("inspectorId")).isFalse();
    }

    @Test
    @DisplayName("Public trace status derived with fixed Clock for READY, WARNING, URGENT, EXPIRED, DISPATCHED and EXCEPTION")
    void testPublicTraceStatusDerivationsWithClock() throws Exception {
        LocalDate baseDate = LocalDate.of(2026, 10, 6);
        ZoneId zone = ZoneId.of("Asia/Kolkata");
        Instant baseInstant = baseDate.atStartOfDay(zone).toInstant();
        mutableClock.setDelegate(Clock.fixed(baseInstant, zone));

        // READY: expiry > 30 days ahead (e.g. 45 days)
        Batch readyBatch = createTestBatch(baseDate.minusDays(10), baseDate.plusDays(45), "ACTIVE", null);
        assertStatus(readyBatch.getTraceToken(), "READY", baseDate.plusDays(45));

        // WARNING: expiry 8 to 30 days ahead (e.g. 15 days)
        Batch warningBatch = createTestBatch(baseDate.minusDays(10), baseDate.plusDays(15), "ACTIVE", null);
        assertStatus(warningBatch.getTraceToken(), "WARNING", baseDate.plusDays(15));

        // URGENT: expiry 1 to 7 days ahead (e.g. 3 days)
        Batch urgentBatch = createTestBatch(baseDate.minusDays(10), baseDate.plusDays(3), "ACTIVE", null);
        assertStatus(urgentBatch.getTraceToken(), "URGENT", baseDate.plusDays(3));

        // EXPIRED: expiry in past (e.g. -1 day)
        Batch expiredBatch = createTestBatch(baseDate.minusDays(20), baseDate.minusDays(1), "ACTIVE", null);
        assertStatus(expiredBatch.getTraceToken(), "EXPIRED", baseDate.minusDays(1));

        // DISPATCHED: lifecycleState = DISPATCHED, status is DISPATCHED regardless of expiry
        Batch dispatchedBatch = createTestBatch(baseDate.minusDays(10), baseDate.plusDays(45), "DISPATCHED", null);
        assertStatus(dispatchedBatch.getTraceToken(), "DISPATCHED", baseDate.plusDays(45));

        // EXCEPTION: expiryDate is null
        Batch exceptionBatch = createTestBatch(baseDate.minusDays(10), null, "ACTIVE", null);
        assertStatus(exceptionBatch.getTraceToken(), "EXCEPTION", null);
    }

    private void assertStatus(String token, String expectedStatus, LocalDate expectedExpiry) throws Exception {
        MvcResult res = mockMvc.perform(get("/api/v1/qr/trace/t/" + token))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode data = objectMapper.readTree(res.getResponse().getContentAsString()).path("data");
        assertThat(data.path("status").asText()).isEqualTo(expectedStatus);
        if (expectedExpiry != null) {
            assertThat(data.path("expiryDate").asText()).isEqualTo(expectedExpiry.toString());
        } else {
            assertThat(data.path("expiryDate").isNull()).isTrue();
        }
    }

    @Test
    @DisplayName("Archived batch returns identical 404 body as unknown token; restore brings it back")
    void testArchivedAndRestoredBehavior() throws Exception {
        Batch batch = createTestBatch(LocalDate.of(2026, 9, 1), LocalDate.of(2026, 12, 1), "ACTIVE", null);
        String token = batch.getTraceToken();

        // 1. Active batch returns 200
        mockMvc.perform(get("/api/v1/qr/trace/t/" + token)).andExpect(status().isOk());

        // 2. Archive batch
        batch.setDeleted(true);
        batch.setDeletedAt(Instant.now());
        batchRepository.save(batch);

        MvcResult archivedRes = mockMvc.perform(get("/api/v1/qr/trace/t/" + token))
                .andExpect(status().isNotFound())
                .andReturn();
        JsonNode archivedJson = objectMapper.readTree(archivedRes.getResponse().getContentAsString());

        // Compare against unknown token response
        String unknownToken = traceTokenService.generateToken();
        MvcResult unknownRes = mockMvc.perform(get("/api/v1/qr/trace/t/" + unknownToken))
                .andExpect(status().isNotFound())
                .andReturn();
        JsonNode unknownJson = objectMapper.readTree(unknownRes.getResponse().getContentAsString());

        assertThat(archivedJson.path("success").asBoolean()).isEqualTo(unknownJson.path("success").asBoolean()).isFalse();
        assertThat(archivedJson.path("code").asText())
                .isEqualTo(unknownJson.path("code").asText())
                .isEqualTo("NOT_FOUND");
        assertThat(archivedJson.path("error").asText())
                .isEqualTo(unknownJson.path("error").asText())
                .isEqualTo("Batch not found or unavailable");

        // Archived 404 body is identical to unknown token 404 body with requestId removed
        com.fasterxml.jackson.databind.node.ObjectNode archivedClone = (com.fasterxml.jackson.databind.node.ObjectNode) archivedJson.deepCopy();
        com.fasterxml.jackson.databind.node.ObjectNode unknownClone = (com.fasterxml.jackson.databind.node.ObjectNode) unknownJson.deepCopy();
        archivedClone.remove("requestId");
        unknownClone.remove("requestId");
        assertThat(archivedClone).isEqualTo(unknownClone);

        // 3. Restore batch
        batch.setDeleted(false);
        batch.setDeletedAt(null);
        batchRepository.save(batch);

        mockMvc.perform(get("/api/v1/qr/trace/t/" + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.batchCode").value(batch.getBatchCode()));
    }

    @Test
    @DisplayName("Valid scan stores one ScanEvent with correct deviceType, and unknown source gives 422")
    void testScanEventRecordingAndValidation() throws Exception {
        Batch batch = createTestBatch(LocalDate.of(2026, 9, 1), LocalDate.of(2026, 12, 1), "ACTIVE", null);
        String token = batch.getTraceToken();

        // Unknown source -> 422
        mockMvc.perform(post("/api/v1/qr/scan")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"" + token + "\", \"source\":\"unknown_actor\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

        assertThat(scanEventRepository.findByBatchId(batch.getId())).isEmpty();

        // Valid scan (Mobile)
        mockMvc.perform(post("/api/v1/qr/scan")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("User-Agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)")
                        .content("{\"token\":\"" + token + "\", \"source\":\"buyer\"}"))
                .andExpect(status().isOk());

        List<ScanEvent> events = scanEventRepository.findByBatchId(batch.getId());
        assertThat(events).hasSize(1);
        ScanEvent e1 = events.get(0);
        assertThat(e1.getBatchCode()).isEqualTo(batch.getBatchCode());
        assertThat(e1.getSource()).isEqualTo("buyer");
        assertThat(e1.getDeviceType()).isEqualTo("Mobile");
        assertThat(e1.getScannedAt()).isNotNull();
    }

    @Test
    @DisplayName("DeviceType parsing correctly classifies Mobile, Tablet, Desktop and Unknown")
    void testDeviceTypeParsing() throws Exception {
        Batch batch = createTestBatch(LocalDate.of(2026, 9, 1), LocalDate.of(2026, 12, 1), "ACTIVE", null);
        String token = batch.getTraceToken();

        // Tablet
        mockMvc.perform(post("/api/v1/qr/scan")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("User-Agent", "Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X)")
                        .content("{\"token\":\"" + token + "\", \"source\":\"QA\"}"))
                .andExpect(status().isOk());

        // Desktop
        mockMvc.perform(post("/api/v1/qr/scan")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
                        .content("{\"token\":\"" + token + "\", \"source\":\"factory\"}"))
                .andExpect(status().isOk());

        // Unknown
        mockMvc.perform(post("/api/v1/qr/scan")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"" + token + "\", \"source\":\"buyer\"}"))
                .andExpect(status().isOk());

        List<ScanEvent> events = scanEventRepository.findByBatchId(batch.getId());
        assertThat(events).hasSize(3);
        assertThat(events.stream().map(ScanEvent::getDeviceType).toList())
                .containsExactlyInAnyOrder("Tablet", "Desktop", "Unknown");
    }

    @Test
    @DisplayName("Stored ipHash does not contain raw IP, is consistent for same IP and distinct for different IP")
    void testIpHashPrivacyAndConsistency() throws Exception {
        Batch batch = createTestBatch(LocalDate.of(2026, 9, 1), LocalDate.of(2026, 12, 1), "ACTIVE", null);
        String token = batch.getTraceToken();

        String ip1 = "198.51.100.22";
        String ip2 = "203.0.113.88";

        // Two scans from IP 1
        mockMvc.perform(post("/api/v1/qr/scan")
                        .contentType(MediaType.APPLICATION_JSON)
                        .with(req -> { req.setRemoteAddr(ip1); return req; })
                        .content("{\"token\":\"" + token + "\", \"source\":\"buyer\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/qr/scan")
                        .contentType(MediaType.APPLICATION_JSON)
                        .with(req -> { req.setRemoteAddr(ip1); return req; })
                        .content("{\"token\":\"" + token + "\", \"source\":\"buyer\"}"))
                .andExpect(status().isOk());

        // One scan from IP 2
        mockMvc.perform(post("/api/v1/qr/scan")
                        .contentType(MediaType.APPLICATION_JSON)
                        .with(req -> { req.setRemoteAddr(ip2); return req; })
                        .content("{\"token\":\"" + token + "\", \"source\":\"buyer\"}"))
                .andExpect(status().isOk());

        List<ScanEvent> events = scanEventRepository.findByBatchId(batch.getId());
        assertThat(events).hasSize(3);

        String hash1a = events.get(0).getIpHash();
        String hash1b = events.get(1).getIpHash();
        String hash2 = events.get(2).getIpHash();

        // Hex format 64 chars
        assertThat(hash1a).matches("^[a-f0-9]{64}$");
        assertThat(hash2).matches("^[a-f0-9]{64}$");

        // Never contains or equals raw IP
        assertThat(hash1a).isNotEqualTo(ip1);
        assertThat(hash1a).doesNotContain(ip1);
        assertThat(hash2).isNotEqualTo(ip2);
        assertThat(hash2).doesNotContain(ip2);

        // Same IP yields identical hash
        assertThat(hash1a).isEqualTo(hash1b);

        // Different IP yields different hash
        assertThat(hash1a).isNotEqualTo(hash2);
    }

    @Test
    @DisplayName("20 concurrent scans record exactly 20 ScanEvents")
    void testConcurrentScans() throws Exception {
        Batch batch = createTestBatch(LocalDate.of(2026, 9, 1), LocalDate.of(2026, 12, 1), "ACTIVE", null);
        String token = batch.getTraceToken();

        int threadCount = 20;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(threadCount);

        for (int i = 0; i < threadCount; i++) {
            final int index = i;
            executor.submit(() -> {
                try {
                    startLatch.await();
                    mockMvc.perform(post("/api/v1/qr/scan")
                            .contentType(MediaType.APPLICATION_JSON)
                            .with(req -> { req.setRemoteAddr("10.10.10." + index); return req; })
                            .content("{\"token\":\"" + token + "\", \"source\":\"buyer\"}"));
                } catch (Exception e) {
                    throw new RuntimeException(e);
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        startLatch.countDown();
        boolean completed = doneLatch.await(10, TimeUnit.SECONDS);
        executor.shutdown();
        assertThat(completed).isTrue();

        List<ScanEvent> events = scanEventRepository.findByBatchId(batch.getId());
        assertThat(events).hasSize(20);
    }

    @Test
    @DisplayName("Archived batch records nothing on scan attempt")
    void testArchivedBatchScanRecordsNothing() throws Exception {
        Batch batch = createTestBatch(LocalDate.of(2026, 9, 1), LocalDate.of(2026, 12, 1), "ACTIVE", null);
        String token = batch.getTraceToken();

        batch.setDeleted(true);
        batch.setDeletedAt(Instant.now());
        batchRepository.save(batch);

        mockMvc.perform(post("/api/v1/qr/scan")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"" + token + "\", \"source\":\"buyer\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));

        assertThat(scanEventRepository.findByBatchId(batch.getId())).isEmpty();
    }

    @Test
    @DisplayName("Rate limits return 429 on the 61st request in the window and trace/scan buckets are independent")
    void testRateLimiterIndependentBucketsAndLimits() throws Exception {
        Batch batch = createTestBatch(LocalDate.of(2026, 9, 1), LocalDate.of(2026, 12, 1), "ACTIVE", null);
        String token = batch.getTraceToken();
        String testIp = "198.51.100.99";

        // First 60 trace requests succeed
        for (int i = 1; i <= 60; i++) {
            mockMvc.perform(get("/api/v1/qr/trace/t/" + token)
                            .with(req -> { req.setRemoteAddr(testIp); return req; }))
                    .andExpect(status().isOk());
        }

        // 61st trace request returns 429
        mockMvc.perform(get("/api/v1/qr/trace/t/" + token)
                        .with(req -> { req.setRemoteAddr(testIp); return req; }))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("RATE_LIMITED"));

        // Scan bucket is independent: first scan request from same IP succeeds
        mockMvc.perform(post("/api/v1/qr/scan")
                        .contentType(MediaType.APPLICATION_JSON)
                        .with(req -> { req.setRemoteAddr(testIp); return req; })
                        .content("{\"token\":\"" + token + "\", \"source\":\"buyer\"}"))
                .andExpect(status().isOk());

        // 59 more scan requests succeed (reaching 60)
        for (int i = 2; i <= 60; i++) {
            mockMvc.perform(post("/api/v1/qr/scan")
                            .contentType(MediaType.APPLICATION_JSON)
                            .with(req -> { req.setRemoteAddr(testIp); return req; })
                            .content("{\"token\":\"" + token + "\", \"source\":\"buyer\"}"))
                    .andExpect(status().isOk());
        }

        // 61st scan request returns 429
        mockMvc.perform(post("/api/v1/qr/scan")
                        .contentType(MediaType.APPLICATION_JSON)
                        .with(req -> { req.setRemoteAddr(testIp); return req; })
                        .content("{\"token\":\"" + token + "\", \"source\":\"buyer\"}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("RATE_LIMITED"));
    }

    @Test
    @DisplayName("Spoofed X-Forwarded-For does not bypass rate limit")
    void testSpoofedXForwardedForDoesNotBypassRateLimit() throws Exception {
        Batch batch = createTestBatch(LocalDate.of(2026, 9, 1), LocalDate.of(2026, 12, 1), "ACTIVE", null);
        String token = batch.getTraceToken();
        String remoteIp = "203.0.113.50";

        // Exhaust limit using remoteAddr
        for (int i = 1; i <= 60; i++) {
            mockMvc.perform(get("/api/v1/qr/trace/t/" + token)
                            .with(req -> { req.setRemoteAddr(remoteIp); return req; }))
                    .andExpect(status().isOk());
        }

        // Sending spoofed X-Forwarded-For header still gets 429
        mockMvc.perform(get("/api/v1/qr/trace/t/" + token)
                        .header("X-Forwarded-For", "8.8.8.8, 1.1.1.1")
                        .with(req -> { req.setRemoteAddr(remoteIp); return req; }))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("RATE_LIMITED"));
    }
}
