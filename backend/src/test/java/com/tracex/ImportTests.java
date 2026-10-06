package com.tracex;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tracex.exception.ErrorCode;
import com.tracex.model.*;
import com.tracex.repository.*;
import com.tracex.security.JwtService;
import com.tracex.service.ImportService;
import com.tracex.util.MutableClock;
import com.tracex.util.TestDatabaseSafetyGuard;
import org.bson.Document;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class ImportTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private MongoTemplate mongoTemplate;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private BatchRepository batchRepository;

    @Autowired
    private ImportJobRepository importJobRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private MutableClock mutableClock;

    @Autowired
    private ImportService importService;

    private Product testProduct;
    private String adminToken;
    private String factoryManagerToken;
    private final List<String> createdBatchIds = new ArrayList<>();
    private final List<String> createdJobIds = new ArrayList<>();

    @BeforeEach
    void setUp() {
        TestDatabaseSafetyGuard.checkTestDatabase(mongoTemplate);
        mutableClock.reset();
        importService.setStaleRunningMinutes(15);

        testProduct = productRepository.findBySku("TEST-IMP-SKU").orElseGet(() -> {
            Product p = new Product();
            p.setSku("TEST-IMP-SKU");
            p.setProductName("Test Import Himalayan Honey");
            p.setCategory("Honey");
            p.setBaseShelfLifeDays(180);
            p.setPredictedShelfLifeDays(200);
            p.setRiskLevel("LOW");
            return productRepository.save(p);
        });

        User admin = ensureUser("import_test_admin", Role.ADMIN, false);
        User fm = ensureUser("import_test_fm", Role.FACTORY_MANAGER, false);
        adminToken = jwtService.generateToken(admin.getId(), admin.getTokenVersion());
        factoryManagerToken = jwtService.generateToken(fm.getId(), fm.getTokenVersion());
    }

    @AfterEach
    void tearDown() {
        mutableClock.reset();
        importService.setStaleRunningMinutes(15);

        for (String jobId : createdJobIds) {
            importJobRepository.findById(jobId).ifPresent(job -> {
                if (job.getInsertedBatchIds() != null) {
                    createdBatchIds.addAll(job.getInsertedBatchIds());
                }
            });
        }
        if (!createdBatchIds.isEmpty()) {
            batchRepository.deleteAllById(createdBatchIds);
            createdBatchIds.clear();
        }
        if (!createdJobIds.isEmpty()) {
            importJobRepository.deleteAllById(createdJobIds);
            createdJobIds.clear();
        }
    }

    private User ensureUser(String username, Role role, boolean isSuperAdmin) {
        User u = userRepository.findByUsername(username).orElseGet(() -> new User(
                username,
                passwordEncoder.encode("TestPass123456!"),
                "Import Test " + username,
                username + "@tracex.demo",
                role,
                isSuperAdmin
        ));
        u.setRole(role);
        u.setSuperAdmin(isSuperAdmin);
        u.setActive(true);
        u.setDeleted(false);
        return userRepository.save(u);
    }

    private Map<String, Object> validRow(String lotCode, String packDate) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("productSku", "TEST-IMP-SKU");
        row.put("productName", "");
        row.put("sourceLotCode", lotCode);
        row.put("farmerName", "Ramesh Negi");
        row.put("village", "Mukteshwar");
        row.put("quantityProduced", "150");
        row.put("unit", "Kg");
        row.put("yieldPercent", "88.5");
        row.put("packDate", packDate);
        return row;
    }

    @Test
    @DisplayName("1. GET /api/v1/import/schema and POST /api/v1/import/map-headers: 9 columns, alias matching, no duplicate sheet header reuse, productName satisfies productSku")
    void testGetSchemaAndMapHeaders() throws Exception {
        mockMvc.perform(get("/api/v1/import/schema")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.maxChunkRows").value(500))
                .andExpect(jsonPath("$.data.dedupeRule").value("Source Lot Code + Product SKU + Pack Date"))
                .andExpect(jsonPath("$.data.columns.length()").value(9))
                .andExpect(jsonPath("$.data.columns[0].key").value("productSku"));

        // Map headers using aliases where Product Name is provided instead of SKU
        Map<String, Object> body = Map.of(
                "headers", List.of("Item Name", "Raw Lot", "Grower", "Origin", "Qty", "UOM", "Recovery", "Packed On", "Extra Ignored Column")
        );

        mockMvc.perform(post("/api/v1/import/map-headers")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.mapping.productName").value("Item Name"))
                .andExpect(jsonPath("$.data.mapping.sourceLotCode").value("Raw Lot"))
                .andExpect(jsonPath("$.data.mapping.farmerName").value("Grower"))
                .andExpect(jsonPath("$.data.mapping.village").value("Origin"))
                .andExpect(jsonPath("$.data.mapping.quantityProduced").value("Qty"))
                .andExpect(jsonPath("$.data.mapping.unit").value("UOM"))
                .andExpect(jsonPath("$.data.mapping.yieldPercent").value("Recovery"))
                .andExpect(jsonPath("$.data.mapping.packDate").value("Packed On"))
                .andExpect(jsonPath("$.data.unmappedRequired.length()").value(0));

        // Missing packDate and village -> reported in unmappedRequired
        Map<String, Object> incompleteBody = Map.of(
                "headers", List.of("SKU", "Lot Code", "Farmer", "Quantity", "Unit", "Yield")
        );
        mockMvc.perform(post("/api/v1/import/map-headers")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(incompleteBody)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.unmappedRequired.length()").value(2))
                .andExpect(jsonPath("$.data.unmappedRequired[0]").value("village"))
                .andExpect(jsonPath("$.data.unmappedRequired[1]").value("packDate"));
    }

    @Test
    @DisplayName("2. POST /api/v1/import/validate verdicts: insert, skip existing active batch, skip in-file duplicate, and error")
    void testValidateVerdictsInsertSkipExistingSkipInFileDuplicateAndError() throws Exception {
        // First commit 1 active batch for LOT-EXISTING-01
        Map<String, Object> commitReq = Map.of(
                "fileName", "seed-existing.csv",
                "rows", List.of(validRow("LOT-EXISTING-01", "2026-10-01")),
                "isFinal", true
        );
        MvcResult commitRes = mockMvc.perform(post("/api/v1/import/commit")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(commitReq)))
                .andExpect(status().isOk())
                .andReturn();
        createdJobIds.add(objectMapper.readTree(commitRes.getResponse().getContentAsString()).at("/data/jobId").asText());

        // Now validate 4 rows:
        // Row 2: brand new -> insert
        // Row 3: matches LOT-EXISTING-01 -> skip (already imported)
        // Row 4: duplicate of Row 2 in same chunk -> skip (in-file duplicate)
        // Row 5: missing village & invalid yield -> error
        Map<String, Object> badRow = validRow("LOT-BAD-01", "2026-10-01");
        badRow.put("village", "");
        badRow.put("yieldPercent", "150");

        Map<String, Object> validateReq = Map.of(
                "rows", List.of(
                        validRow("LOT-NEW-01", "2026-10-02"),
                        validRow("LOT-EXISTING-01", "2026-10-01"),
                        validRow("LOT-NEW-01", "2026-10-02"),
                        badRow
                ),
                "rowOffset", 2
        );

        mockMvc.perform(post("/api/v1/import/validate")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validateReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.summary.total").value(4))
                .andExpect(jsonPath("$.data.summary.insert").value(1))
                .andExpect(jsonPath("$.data.summary.skip").value(2))
                .andExpect(jsonPath("$.data.summary.error").value(1))
                .andExpect(jsonPath("$.data.preview[0].rowNumber").value(2))
                .andExpect(jsonPath("$.data.preview[0].verdict").value("insert"))
                .andExpect(jsonPath("$.data.preview[0].insertKey").value("TEST-IMP-SKU|LOT-NEW-01|2026-10-02"))
                .andExpect(jsonPath("$.data.preview[1].rowNumber").value(3))
                .andExpect(jsonPath("$.data.preview[1].verdict").value("skip"))
                .andExpect(jsonPath("$.data.preview[1].reason").value("Already imported — lot LOT-EXISTING-01 / TEST-IMP-SKU / 2026-10-01"))
                .andExpect(jsonPath("$.data.preview[1].insertKey").isEmpty())
                .andExpect(jsonPath("$.data.preview[2].rowNumber").value(4))
                .andExpect(jsonPath("$.data.preview[2].verdict").value("skip"))
                .andExpect(jsonPath("$.data.preview[2].reason").value("Duplicate of an earlier row in this file (same lot, product and pack date)"))
                .andExpect(jsonPath("$.data.preview[3].rowNumber").value(5))
                .andExpect(jsonPath("$.data.preview[3].verdict").value("error"))
                .andExpect(jsonPath("$.data.preview[3].errors.length()").value(2));
    }

    @Test
    @DisplayName("3. Strict packDate parsing: accepts YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY and rejects 31/02/2026 without rollover")
    void testStrictPackDateFormatsAndInvalidCalendarRejection() throws Exception {
        Map<String, Object> validateReq = Map.of(
                "rows", List.of(
                        validRow("LOT-DATE-ISO", "2026-10-05"),
                        validRow("LOT-DATE-SLASH", "05/10/2026"),
                        validRow("LOT-DATE-DASH", "05-10-2026"),
                        validRow("LOT-DATE-DOT", "05.10.2026"),
                        validRow("LOT-DATE-FEB31", "31/02/2026"),
                        validRow("LOT-DATE-FEB29-NONLEAP", "29-02-2026"),
                        validRow("LOT-DATE-APR31", "31.04.2026"),
                        validRow("LOT-DATE-ISO-FEB31", "2026-02-31")
                )
        );

        mockMvc.perform(post("/api/v1/import/validate")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validateReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.summary.total").value(8))
                .andExpect(jsonPath("$.data.summary.insert").value(4))
                .andExpect(jsonPath("$.data.summary.error").value(4))
                .andExpect(jsonPath("$.data.preview[0].packDate").value("2026-10-05"))
                .andExpect(jsonPath("$.data.preview[1].packDate").value("2026-10-05"))
                .andExpect(jsonPath("$.data.preview[2].packDate").value("2026-10-05"))
                .andExpect(jsonPath("$.data.preview[3].packDate").value("2026-10-05"))
                .andExpect(jsonPath("$.data.preview[4].verdict").value("error"))
                .andExpect(jsonPath("$.data.preview[4].errors[0].field").value("packDate"))
                .andExpect(jsonPath("$.data.preview[5].verdict").value("error"))
                .andExpect(jsonPath("$.data.preview[6].verdict").value("error"))
                .andExpect(jsonPath("$.data.preview[7].verdict").value("error"));
    }

    @Test
    @DisplayName("4. Unit aliases normalise to Kg, Units, or Liters and reject unknown units")
    void testUnitAliasesNormalisationAndInvalidUnitRejection() throws Exception {
        Map<String, Object> r1 = validRow("LOT-UNIT-1", "2026-10-01");
        r1.put("unit", "kgs");
        Map<String, Object> r2 = validRow("LOT-UNIT-2", "2026-10-01");
        r2.put("unit", "pcs");
        Map<String, Object> r3 = validRow("LOT-UNIT-3", "2026-10-01");
        r3.put("unit", "litres");
        Map<String, Object> r4 = validRow("LOT-UNIT-4", "2026-10-01");
        r4.put("unit", "gallons");

        mockMvc.perform(post("/api/v1/import/validate")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("rows", List.of(r1, r2, r3, r4)))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.summary.insert").value(3))
                .andExpect(jsonPath("$.data.summary.error").value(1))
                .andExpect(jsonPath("$.data.preview[0].unit").value("Kg"))
                .andExpect(jsonPath("$.data.preview[1].unit").value("Units"))
                .andExpect(jsonPath("$.data.preview[2].unit").value("Liters"))
                .andExpect(jsonPath("$.data.preview[3].verdict").value("error"))
                .andExpect(jsonPath("$.data.preview[3].errors[0].field").value("unit"));
    }

    @Test
    @DisplayName("5. Commit creates batches via BatchService (TX- code, traceToken, lifecycleState ACTIVE, no stored status in Mongo, noteHistory entry)")
    void testCommitCreatesBatchesThroughBatchServiceWithTxCodeTraceTokenActiveLifecycleNoStoredStatusAndNoteHistory() throws Exception {
        Map<String, Object> bySku = validRow("LOT-COMMIT-SKU", "2026-10-03");
        Map<String, Object> byName = validRow("LOT-COMMIT-NAME", "2026-10-03");
        byName.put("productSku", "");
        byName.put("productName", "Test Import Himalayan Honey");

        Map<String, Object> commitReq = Map.of(
                "fileName", "october-harvest.csv",
                "rows", List.of(bySku, byName),
                "totalRows", 2,
                "isFinal", true
        );

        MvcResult res = mockMvc.perform(post("/api/v1/import/commit")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(commitReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("done"))
                .andExpect(jsonPath("$.data.chunkInserted").value(2))
                .andExpect(jsonPath("$.data.batches.length()").value(2))
                .andReturn();

        JsonNode data = objectMapper.readTree(res.getResponse().getContentAsString()).get("data");
        String jobId = data.get("jobId").asText();
        createdJobIds.add(jobId);

        String batchId = data.at("/batches/0/id").asText();
        Document rawBatch = mongoTemplate.getCollection("batches")
                .find(new Document("_id", new org.bson.types.ObjectId(batchId)))
                .first();

        assertThat(rawBatch).isNotNull();
        assertThat(rawBatch.getString("batchCode")).matches("^TX-\\d{4}-\\d{2}-\\d{3,}$");
        assertThat(rawBatch.getString("traceToken")).matches("^[A-Za-z0-9_-]{22}\\.[A-Za-z0-9_-]{22}$");
        assertThat(rawBatch.getString("lifecycleState")).isEqualTo("ACTIVE");
        assertThat(rawBatch.containsKey("status")).isFalse();
        assertThat(rawBatch.get("packDate")).isEqualTo("2026-10-03");
        assertThat(rawBatch.get("expiryDate")).isEqualTo("2027-04-21");

        Batch batch = batchRepository.findById(batchId).orElseThrow();
        assertThat(batch.getNoteHistory()).hasSize(1);
        assertThat(batch.getNoteHistory().get(0).getNote())
                .isEqualTo("Bulk imported from october-harvest.csv (import #" + jobId + ")");
    }

    @Test
    @DisplayName("6. Counters and final-status rules: all-duplicate file finishes 'done', all-error file finishes 'failed', mixed finishes 'done'")
    void testCountersAndFinalStatusRulesIncludingAllDuplicateFileAndAllErrorFile() throws Exception {
        // Seed 1 batch
        MvcResult seedRes = mockMvc.perform(post("/api/v1/import/commit")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "fileName", "initial.csv",
                                "rows", List.of(validRow("LOT-DUP-RULE", "2026-10-01")),
                                "isFinal", true
                        ))))
                .andExpect(status().isOk())
                .andReturn();
        createdJobIds.add(objectMapper.readTree(seedRes.getResponse().getContentAsString()).at("/data/jobId").asText());

        // All-duplicate file -> inserted=0, skipped=2, errored=0 -> status="done"
        MvcResult allDupRes = mockMvc.perform(post("/api/v1/import/commit")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "fileName", "all-duplicates.csv",
                                "rows", List.of(
                                        validRow("LOT-DUP-RULE", "2026-10-01"),
                                        validRow("LOT-DUP-RULE", "2026-10-01")
                                ),
                                "isFinal", true
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("done"))
                .andExpect(jsonPath("$.data.totals.inserted").value(0))
                .andExpect(jsonPath("$.data.totals.skipped").value(2))
                .andExpect(jsonPath("$.data.totals.errored").value(0))
                .andReturn();
        createdJobIds.add(objectMapper.readTree(allDupRes.getResponse().getContentAsString()).at("/data/jobId").asText());

        // All-error file -> inserted=0, skipped=0, errored=1 -> status="failed"
        Map<String, Object> bad = validRow("LOT-ERR-ONLY", "31/02/2026");
        MvcResult allErrRes = mockMvc.perform(post("/api/v1/import/commit")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "fileName", "all-errors.csv",
                                "rows", List.of(bad),
                                "isFinal", true
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("failed"))
                .andExpect(jsonPath("$.data.totals.inserted").value(0))
                .andExpect(jsonPath("$.data.totals.errored").value(1))
                .andReturn();
        createdJobIds.add(objectMapper.readTree(allErrRes.getResponse().getContentAsString()).at("/data/jobId").asText());
    }

    @Test
    @DisplayName("7. rowErrors cap at 200 with rowErrorsTruncated=true, and list endpoint omits rowErrors and insertedBatchIds")
    void testRowErrorsCap200AndTruncatedFlag() throws Exception {
        List<Map<String, Object>> badRows = new ArrayList<>();
        for (int i = 1; i <= 205; i++) {
            badRows.add(validRow("LOT-CAP-" + i, "invalid-date"));
        }

        MvcResult res = mockMvc.perform(post("/api/v1/import/commit")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "fileName", "205-errors.csv",
                                "rows", badRows,
                                "isFinal", true
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("failed"))
                .andExpect(jsonPath("$.data.totals.errored").value(205))
                .andExpect(jsonPath("$.data.rowErrorsTruncated").value(true))
                .andReturn();

        String jobId = objectMapper.readTree(res.getResponse().getContentAsString()).at("/data/jobId").asText();
        createdJobIds.add(jobId);

        // Detail endpoint has 200 rowErrors and rowErrorsTruncated=true
        mockMvc.perform(get("/api/v1/import/" + jobId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.rowErrors.length()").value(200))
                .andExpect(jsonPath("$.data.rowErrorsTruncated").value(true));

        // List endpoint omits rowErrors and insertedBatchIds
        MvcResult listRes = mockMvc.perform(get("/api/v1/import")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode firstSummary = objectMapper.readTree(listRes.getResponse().getContentAsString()).at("/data/0");
        assertThat(firstSummary.has("rowErrors")).isFalse();
        assertThat(firstSummary.has("insertedBatchIds")).isFalse();
    }

    @Test
    @DisplayName("8. Cross-chunk priorKeys in /validate marks duplicates from earlier preview chunks as skip")
    void testCrossChunkPriorKeysInValidate() throws Exception {
        MvcResult chunk1Res = mockMvc.perform(post("/api/v1/import/validate")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "rows", List.of(validRow("LOT-CROSS-01", "2026-10-04")),
                                "rowOffset", 2
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.preview[0].verdict").value("insert"))
                .andReturn();

        String insertKey = objectMapper.readTree(chunk1Res.getResponse().getContentAsString())
                .at("/data/preview/0/insertKey").asText();
        assertThat(insertKey).isEqualTo("TEST-IMP-SKU|LOT-CROSS-01|2026-10-04");

        // Chunk 2 sends priorKeys containing insertKey
        mockMvc.perform(post("/api/v1/import/validate")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "rows", List.of(validRow("LOT-CROSS-01", "2026-10-04")),
                                "rowOffset", 202,
                                "priorKeys", List.of(insertKey)
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.summary.skip").value(1))
                .andExpect(jsonPath("$.data.preview[0].verdict").value("skip"))
                .andExpect(jsonPath("$.data.preview[0].reason").value("Duplicate of an earlier row in this file (same lot, product and pack date)"));
    }

    @Test
    @DisplayName("9. Multi-chunk job join enforces job.createdBy == actor.username (404 NOT_FOUND) and status == running (409 CONFLICT)")
    void testMultiChunkCommitOwnership404AndNonRunning409() throws Exception {
        // Admin creates chunk 1 with isFinal=false
        MvcResult chunk1 = mockMvc.perform(post("/api/v1/import/commit")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "fileName", "multi-chunk.csv",
                                "rows", List.of(validRow("LOT-MC-01", "2026-10-01")),
                                "totalRows", 2,
                                "isFinal", false
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("running"))
                .andReturn();

        String jobId = objectMapper.readTree(chunk1.getResponse().getContentAsString()).at("/data/jobId").asText();
        createdJobIds.add(jobId);

        // Factory manager attempts to join admin's jobId -> 404 NOT_FOUND
        mockMvc.perform(post("/api/v1/import/commit")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + factoryManagerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "jobId", jobId,
                                "rows", List.of(validRow("LOT-MC-02", "2026-10-01")),
                                "isFinal", true
                        ))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(ErrorCode.NOT_FOUND.name()));

        // Admin finishes chunk 2 with isFinal=true -> status="done"
        mockMvc.perform(post("/api/v1/import/commit")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "jobId", jobId,
                                "rows", List.of(validRow("LOT-MC-02", "2026-10-01")),
                                "isFinal", true
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("done"))
                .andExpect(jsonPath("$.data.totals.inserted").value(2));

        // Admin attempts to append a 3rd chunk to the finished ("done") job -> 409 CONFLICT
        mockMvc.perform(post("/api/v1/import/commit")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "jobId", jobId,
                                "rows", List.of(validRow("LOT-MC-03", "2026-10-01")),
                                "isFinal", true
                        ))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(ErrorCode.CONFLICT.name()));
    }

    @Test
    @DisplayName("10. Stuck 'running' jobs lazily transition to 'failed' (with finishedAt set) on list, detail, commit, and rollback using Clock")
    void testStaleRunningJobLazilyMarkedFailedOnListDetailCommitAndRollbackUsingClock() throws Exception {
        Instant t0 = Instant.parse("2026-10-06T08:00:00Z");
        mutableClock.setDelegate(java.time.Clock.fixed(t0, mutableClock.getDefaultZoneId()));

        List<String> staleJobIds = new ArrayList<>();
        for (int i = 1; i <= 4; i++) {
            MvcResult r = mockMvc.perform(post("/api/v1/import/commit")
                            .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of(
                                    "fileName", "stale-" + i + ".csv",
                                    "rows", List.of(validRow("LOT-STALE-" + i, "2026-10-01")),
                                    "totalRows", 2,
                                    "isFinal", false
                            ))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.status").value("running"))
                    .andReturn();
            String id = objectMapper.readTree(r.getResponse().getContentAsString()).at("/data/jobId").asText();
            staleJobIds.add(id);
            createdJobIds.add(id);
        }

        // Advance clock by 16 minutes (> default 15 minutes stale window)
        mutableClock.setDelegate(java.time.Clock.fixed(t0.plus(Duration.ofMinutes(16)), mutableClock.getDefaultZoneId()));

        // 1) Detail on staleJobIds[0] lazily marks it failed with finishedAt set
        mockMvc.perform(get("/api/v1/import/" + staleJobIds.get(0))
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("failed"))
                .andExpect(jsonPath("$.data.finishedAt").isNotEmpty());

        // 2) Commit on staleJobIds[1] lazily marks it failed and returns 409 CONFLICT
        mockMvc.perform(post("/api/v1/import/commit")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "jobId", staleJobIds.get(1),
                                "rows", List.of(validRow("LOT-STALE-APPEND", "2026-10-01")),
                                "isFinal", true
                        ))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(ErrorCode.CONFLICT.name()));
        assertThat(importJobRepository.findById(staleJobIds.get(1)).orElseThrow().getStatus()).isEqualTo("failed");

        // 3) Rollback on staleJobIds[2] lazily marks it failed and rolls back its inserted batch!
        mockMvc.perform(post("/api/v1/import/" + staleJobIds.get(2) + "/rollback")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("rolled_back"))
                .andExpect(jsonPath("$.data.archived").value(1))
                .andExpect(jsonPath("$.data.alreadyArchived").value(0));

        // 4) List lazily marks remaining staleJobIds[3] as failed
        mockMvc.perform(get("/api/v1/import")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
                .andExpect(status().isOk());
        ImportJob job4 = importJobRepository.findById(staleJobIds.get(3)).orElseThrow();
        assertThat(job4.getStatus()).isEqualTo("failed");
        assertThat(job4.getFinishedAt()).isNotNull();
    }

    @Test
    @DisplayName("11. Empty rows, > 500 rows per chunk, and > 10,000 rows per job return 422 VALIDATION_ERROR on field 'rows'")
    void testChunkAndJobCapsReturn422ValidationErrorOnRows() throws Exception {
        // Empty rows on /validate
        mockMvc.perform(post("/api/v1/import/validate")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("rows", List.of()))))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value(ErrorCode.VALIDATION_ERROR.name()))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("rows"));

        // > 500 rows on /validate and /commit
        List<Map<String, Object>> rows501 = new ArrayList<>();
        for (int i = 0; i < 501; i++) {
            rows501.add(validRow("LOT-501-" + i, "2026-10-01"));
        }
        mockMvc.perform(post("/api/v1/import/validate")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("rows", rows501))))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value(ErrorCode.VALIDATION_ERROR.name()))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("rows"));

        mockMvc.perform(post("/api/v1/import/commit")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("rows", rows501))))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value(ErrorCode.VALIDATION_ERROR.name()))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("rows"));

        // Job whose processedRows + chunk rows would push over 10,000 -> 422 on "rows"
        ImportJob nearCapJob = new ImportJob();
        nearCapJob.setFileName("near-cap.csv");
        nearCapJob.setEntity("batch");
        nearCapJob.setStatus("running");
        nearCapJob.setTotalRows(10000);
        nearCapJob.setProcessedRows(9999);
        nearCapJob.setCreatedBy("import_test_admin");
        nearCapJob.setCreatedByRole("admin");
        nearCapJob.setCreatedAt(mutableClock.instant());
        nearCapJob.setUpdatedAt(mutableClock.instant());
        nearCapJob = importJobRepository.save(nearCapJob);
        createdJobIds.add(nearCapJob.getId());

        mockMvc.perform(post("/api/v1/import/commit")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "jobId", nearCapJob.getId(),
                                "rows", List.of(
                                        validRow("LOT-10000", "2026-10-01"),
                                        validRow("LOT-10001", "2026-10-01")
                                ),
                                "isFinal", true
                        ))))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value(ErrorCode.VALIDATION_ERROR.name()))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("rows"));
    }

    @Test
    @DisplayName("12. Rollback happy path archives batches with 'Import rollback <jobId>' and allows re-importing the same CSV rows")
    void testRollbackHappyPathAndReImportAllowedAfterRollback() throws Exception {
        List<Map<String, Object>> csvRows = List.of(
                validRow("LOT-RB-HAPPY-1", "2026-10-05"),
                validRow("LOT-RB-HAPPY-2", "2026-10-05")
        );

        MvcResult commitRes = mockMvc.perform(post("/api/v1/import/commit")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "fileName", "rollback-happy.csv",
                                "rows", csvRows,
                                "isFinal", true
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totals.inserted").value(2))
                .andReturn();

        String jobId = objectMapper.readTree(commitRes.getResponse().getContentAsString()).at("/data/jobId").asText();
        createdJobIds.add(jobId);

        // Rollback
        mockMvc.perform(post("/api/v1/import/" + jobId + "/rollback")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("rolled_back"))
                .andExpect(jsonPath("$.data.archived").value(2))
                .andExpect(jsonPath("$.data.alreadyArchived").value(0));

        ImportJob rolledBackJob = importJobRepository.findById(jobId).orElseThrow();
        for (String batchId : rolledBackJob.getInsertedBatchIds()) {
            Batch b = batchRepository.findById(batchId).orElseThrow();
            assertThat(b.isDeleted()).isTrue();
            assertThat(b.getDeleteNote()).isEqualTo("Import rollback " + jobId);
        }

        // Re-validate and re-commit the exact same rows -> must be allowed (verdict = "insert")
        mockMvc.perform(post("/api/v1/import/validate")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("rows", csvRows))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.summary.insert").value(2))
                .andExpect(jsonPath("$.data.summary.skip").value(0));

        MvcResult reCommitRes = mockMvc.perform(post("/api/v1/import/commit")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "fileName", "rollback-happy-reimport.csv",
                                "rows", csvRows,
                                "isFinal", true
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totals.inserted").value(2))
                .andExpect(jsonPath("$.data.totals.skipped").value(0))
                .andReturn();
        createdJobIds.add(objectMapper.readTree(reCommitRes.getResponse().getContentAsString()).at("/data/jobId").asText());
    }

    @Test
    @DisplayName("13. Rollback when ANY inserted batch is DISPATCHED returns 409 CONFLICT and changes nothing")
    void testRollbackWhenAnyBatchDispatchedReturns409AndChangesNothing() throws Exception {
        MvcResult commitRes = mockMvc.perform(post("/api/v1/import/commit")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "fileName", "dispatched-guard.csv",
                                "rows", List.of(
                                        validRow("LOT-DISP-1", "2026-10-05"),
                                        validRow("LOT-DISP-2", "2026-10-05")
                                ),
                                "isFinal", true
                        ))))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode data = objectMapper.readTree(commitRes.getResponse().getContentAsString()).get("data");
        String jobId = data.get("jobId").asText();
        createdJobIds.add(jobId);

        String batch1Id = data.at("/batches/0/id").asText();
        String batch2Id = data.at("/batches/1/id").asText();

        // Mark batch2 as DISPATCHED (leaving batch1 ACTIVE so we verify batch1 is NOT archived if batch2 is DISPATCHED)
        Batch batch2 = batchRepository.findById(batch2Id).orElseThrow();
        batch2.setLifecycleState("DISPATCHED");
        batchRepository.save(batch2);

        mockMvc.perform(post("/api/v1/import/" + jobId + "/rollback")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(ErrorCode.CONFLICT.name()));

        // Verify NOTHING changed: batch1 and batch2 are both still isDeleted=false, and job status is still "done"
        assertThat(batchRepository.findById(batch1Id).orElseThrow().isDeleted()).isFalse();
        assertThat(batchRepository.findById(batch2Id).orElseThrow().isDeleted()).isFalse();
        assertThat(importJobRepository.findById(jobId).orElseThrow().getStatus()).isEqualTo("done");
    }

    @Test
    @DisplayName("14. Rollback with a manually archived batch skips the already-archived batch and archives the remaining active ones")
    void testRollbackSkipsAlreadyArchivedBatchAndArchivesRemaining() throws Exception {
        MvcResult commitRes = mockMvc.perform(post("/api/v1/import/commit")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "fileName", "partial-archive.csv",
                                "rows", List.of(
                                        validRow("LOT-PART-1", "2026-10-05"),
                                        validRow("LOT-PART-2", "2026-10-05")
                                ),
                                "isFinal", true
                        ))))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode data = objectMapper.readTree(commitRes.getResponse().getContentAsString()).get("data");
        String jobId = data.get("jobId").asText();
        createdJobIds.add(jobId);
        String batch1Id = data.at("/batches/0/id").asText();
        String batch2Id = data.at("/batches/1/id").asText();

        // Manually archive batch1 via DELETE /api/v1/batches/{id}
        mockMvc.perform(delete("/api/v1/batches/" + batch1Id)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("reason", "Manually archived before rollback"))))
                .andExpect(status().isOk());

        // Rollback job -> archived=1, alreadyArchived=1
        mockMvc.perform(post("/api/v1/import/" + jobId + "/rollback")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.archived").value(1))
                .andExpect(jsonPath("$.data.alreadyArchived").value(1))
                .andExpect(jsonPath("$.data.status").value("rolled_back"));

        assertThat(batchRepository.findById(batch1Id).orElseThrow().getDeleteNote())
                .isEqualTo("Manually archived before rollback");
        assertThat(batchRepository.findById(batch2Id).orElseThrow().getDeleteNote())
                .isEqualTo("Import rollback " + jobId);
    }

    @Test
    @DisplayName("15. Rollback returns 409 CONFLICT when job is already rolled_back, still running, or has empty insertedBatchIds")
    void testRollbackAlreadyRolledBackRunningOrEmptyInsertedBatchesReturns409() throws Exception {
        // 1) Active running job -> 409
        MvcResult runningRes = mockMvc.perform(post("/api/v1/import/commit")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "fileName", "running.csv",
                                "rows", List.of(validRow("LOT-RUN-409", "2026-10-05")),
                                "isFinal", false
                        ))))
                .andExpect(status().isOk())
                .andReturn();
        String runningJobId = objectMapper.readTree(runningRes.getResponse().getContentAsString()).at("/data/jobId").asText();
        createdJobIds.add(runningJobId);

        mockMvc.perform(post("/api/v1/import/" + runningJobId + "/rollback")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(ErrorCode.CONFLICT.name()));

        // 2) Finish and roll back once (200), then roll back again -> 409
        mockMvc.perform(post("/api/v1/import/commit")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "jobId", runningJobId,
                                "rows", List.of(validRow("LOT-RUN-409-2", "2026-10-05")),
                                "isFinal", true
                        ))))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/import/" + runningJobId + "/rollback")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/import/" + runningJobId + "/rollback")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(ErrorCode.CONFLICT.name()));

        // 3) Job with empty insertedBatchIds -> 409
        MvcResult errOnlyRes = mockMvc.perform(post("/api/v1/import/commit")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "fileName", "empty-inserted.csv",
                                "rows", List.of(validRow("LOT-EMPTY-INS", "31/02/2026")),
                                "isFinal", true
                        ))))
                .andExpect(status().isOk())
                .andReturn();
        String emptyJobId = objectMapper.readTree(errOnlyRes.getResponse().getContentAsString()).at("/data/jobId").asText();
        createdJobIds.add(emptyJobId);

        mockMvc.perform(post("/api/v1/import/" + emptyJobId + "/rollback")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(ErrorCode.CONFLICT.name()));
    }

    @Test
    @DisplayName("16. PII protection: farmerName never appears in /validate preview, rowErrors, audit_logs, or application logs")
    void testNoFarmerNameInPreviewRowErrorsAuditOrCapturedLogs() throws Exception {
        Logger rootLogger = (Logger) LoggerFactory.getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME);
        ListAppender<ILoggingEvent> listAppender = new ListAppender<>();
        listAppender.start();
        rootLogger.addAppender(listAppender);

        String secretFarmer = "PII_SECRET_FARMER_KUNDAN_998877";
        try {
            Map<String, Object> goodRow = validRow("LOT-PII-GOOD", "2026-10-06");
            goodRow.put("farmerName", secretFarmer);

            Map<String, Object> badRow = validRow("LOT-PII-BAD", "31/02/2026");
            badRow.put("farmerName", secretFarmer + "_OVERLONG_" + "X".repeat(205));

            // 1) Validate preview must NOT contain farmerName or secretFarmer
            MvcResult valRes = mockMvc.perform(post("/api/v1/import/validate")
                            .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of("rows", List.of(goodRow, badRow)))))
                    .andExpect(status().isOk())
                    .andReturn();

            String valBody = valRes.getResponse().getContentAsString();
            assertThat(valBody).doesNotContain(secretFarmer);
            JsonNode preview0 = objectMapper.readTree(valBody).at("/data/preview/0");
            assertThat(preview0.has("farmerName")).isFalse();
            assertThat(preview0.has("farmer")).isFalse();

            // 2) Commit and check response & stored ImportJob.rowErrors
            MvcResult commitRes = mockMvc.perform(post("/api/v1/import/commit")
                            .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of(
                                    "fileName", "pii-check.csv",
                                    "rows", List.of(goodRow, badRow),
                                    "isFinal", true
                            ))))
                    .andExpect(status().isOk())
                    .andReturn();

            String commitBody = commitRes.getResponse().getContentAsString();
            assertThat(commitBody).doesNotContain(secretFarmer);

            String jobId = objectMapper.readTree(commitBody).at("/data/jobId").asText();
            createdJobIds.add(jobId);

            MvcResult detailRes = mockMvc.perform(get("/api/v1/import/" + jobId)
                            .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andReturn();

            String detailBody = detailRes.getResponse().getContentAsString();
            assertThat(detailBody).doesNotContain(secretFarmer);
            JsonNode rowError0 = objectMapper.readTree(detailBody).at("/data/rowErrors/0");
            assertThat(rowError0.has("value")).isFalse();
            Set<String> rowErrorKeys = new HashSet<>();
            rowError0.fieldNames().forEachRemaining(rowErrorKeys::add);
            assertThat(rowErrorKeys).containsExactlyInAnyOrder("rowNumber", "field", "message", "sourceLotCode");

            // 3) Rollback and check audit_logs
            mockMvc.perform(post("/api/v1/import/" + jobId + "/rollback")
                            .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
                    .andExpect(status().isOk());

            Query auditQuery = new Query(Criteria.where("targetId").is(jobId));
            List<Document> jobAuditDocs = mongoTemplate.find(auditQuery, Document.class, "audit_logs");
            assertThat(jobAuditDocs).hasSize(2);
            for (Document doc : jobAuditDocs) {
                assertThat(doc.toJson()).doesNotContain(secretFarmer);
            }

            // 4) Check captured application logs
            for (ILoggingEvent ev : listAppender.list) {
                assertThat(ev.getFormattedMessage()).doesNotContain(secretFarmer);
            }
        } finally {
            rootLogger.detachAppender(listAppender);
            listAppender.stop();
        }
    }
}
