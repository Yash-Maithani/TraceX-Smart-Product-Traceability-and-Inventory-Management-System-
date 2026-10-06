package com.tracex;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tracex.dto.BatchDispatchDto;
import com.tracex.dto.InspectionCreateDto;
import com.tracex.exception.ApiException;
import com.tracex.exception.ErrorCode;
import com.tracex.model.*;
import com.tracex.model.Inspection.ChecklistItem;
import com.tracex.repository.*;
import com.tracex.security.JwtService;
import com.tracex.service.BatchService;
import com.tracex.service.FefoService;
import com.tracex.service.InspectionService;
import org.bson.Document;
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

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TimeZone;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class InspectionAndDispatchTests {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private MongoTemplate mongoTemplate;
    @Autowired private BatchRepository batchRepository;
    @Autowired private ProductRepository productRepository;
    @Autowired private InspectionRepository inspectionRepository;
    @Autowired private AuditLogRepository auditLogRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private InspectionService inspectionService;
    @Autowired private BatchService batchService;
    @Autowired private FefoService fefoService;
    @Autowired private JwtService jwtService;
    @Autowired private PasswordEncoder passwordEncoder;

    private User superAdmin;
    private User admin;
    private User manager;
    private User factoryManager;
    private User inspector1;
    private User inspector2;
    private User coordinator;

    private String superAdminToken;
    private String adminToken;
    private String managerToken;
    private String factoryManagerToken;
    private String inspector1Token;
    private String inspector2Token;
    private String coordinatorToken;

    @org.junit.jupiter.api.AfterAll
    static void restoreSeedAfterClass(
            @Autowired InspectionRepository inspectionRepository,
            @Autowired BatchRepository batchRepository,
            @Autowired ProductRepository productRepository,
            @Autowired UserRepository userRepository,
            @Autowired com.tracex.service.SeedRunner seedRunner) {
        inspectionRepository.deleteAll();
        batchRepository.deleteAll();
        productRepository.deleteAll();
        userRepository.deleteAll();
        seedRunner.run();
    }

    @BeforeEach
    void setUp() {
        inspectionRepository.deleteAll();
        batchRepository.deleteAll();
        productRepository.deleteAll();
        auditLogRepository.deleteAll();
        userRepository.deleteAll();

        superAdmin = createUser("sa_p4", Role.ADMIN, true);
        admin = createUser("admin_p4", Role.ADMIN, false);
        manager = createUser("mgr_p4", Role.MANAGER, false);
        factoryManager = createUser("fm_p4", Role.FACTORY_MANAGER, false);
        inspector1 = createUser("insp1_p4", Role.QUALITY_INSPECTOR, false);
        inspector2 = createUser("insp2_p4", Role.QUALITY_INSPECTOR, false);
        coordinator = createUser("coord_p4", Role.DISPATCH_COORDINATOR, false);

        superAdminToken = jwtService.generateToken(superAdmin.getId(), superAdmin.getTokenVersion());
        adminToken = jwtService.generateToken(admin.getId(), admin.getTokenVersion());
        managerToken = jwtService.generateToken(manager.getId(), manager.getTokenVersion());
        factoryManagerToken = jwtService.generateToken(factoryManager.getId(), factoryManager.getTokenVersion());
        inspector1Token = jwtService.generateToken(inspector1.getId(), inspector1.getTokenVersion());
        inspector2Token = jwtService.generateToken(inspector2.getId(), inspector2.getTokenVersion());
        coordinatorToken = jwtService.generateToken(coordinator.getId(), coordinator.getTokenVersion());

        saveProduct("KMGC", "Kashmiri Garlic Cloves", "Spices", "HIGH", 180);
        saveProduct("RHSLT", "Raw Himalayan Salt", "Minerals", "LOW", 365);
    }

    private User createUser(String username, Role role, boolean isSuperAdmin) {
        User u = new User(username, passwordEncoder.encode("TestPass123456!"),
                username + " FullName", username + "@tracex.demo", role, isSuperAdmin);
        u.setActive(true);
        return userRepository.save(u);
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

    private Batch saveBatch(String code, String sku, String productName, Instant packDate, Instant expiryDate,
                            String lifecycleState, boolean isDeleted) {
        Batch b = new Batch();
        b.setBatchCode(code);
        b.setSku(sku);
        b.setProductName(productName);
        b.setSourceLotCode("LOT-" + code);
        b.setFarmerName("Sensitive Farmer PII");
        b.setVillage("Village A");
        b.setQuantityProduced(120);
        b.setUnit("kg");
        java.time.ZoneId ist = java.time.ZoneId.of("Asia/Kolkata");
        b.setPackDate(packDate != null ? packDate.atZone(ist).toLocalDate() : null);
        b.setExpiryDate(expiryDate != null ? expiryDate.atZone(ist).toLocalDate() : null);
        b.setDataSource("FACTORY");
        b.setShelfLifeSource("ACTUAL");
        b.setLifecycleState(lifecycleState);
        b.setDeleted(isDeleted);
        return batchRepository.save(b);
    }

    private List<ChecklistItem> defaultChecklist(Boolean overrideFirstItem) {
        List<ChecklistItem> items = new ArrayList<>();
        for (int i = 0; i < InspectionService.FIXED_CHECKLIST_LABELS.size(); i++) {
            Boolean passedVal = (i == 0 && overrideFirstItem != null) ? overrideFirstItem : Boolean.TRUE;
            items.add(new ChecklistItem(InspectionService.FIXED_CHECKLIST_LABELS.get(i), passedVal, "Checked ok"));
        }
        return items;
    }

    // =========================================================================
    // INSPECTIONS TESTS
    // =========================================================================

    @Test
    @DisplayName("Inspection 1 & 2: Valid inspection sets isLatest=true, snapshots qualityCheck on Batch, writes PII-free audit; second inspection supersedes first and batch history returns both newest-first")
    void testCreateInspectionAndSupersedeLatest() throws Exception {
        Instant now = Instant.now();
        Batch b = saveBatch("TX-INSP-001", "KMGC", "Kashmiri Garlic Cloves",
                now.minus(5, ChronoUnit.DAYS), now.plus(20, ChronoUnit.DAYS), "ACTIVE", false);

        InspectionCreateDto req1 = new InspectionCreateDto();
        req1.setBatchId(b.getId());
        req1.setStatus("FLAGGED");
        req1.setRating(3);
        req1.setChecklist(defaultChecklist(false));
        req1.setFindings("Minor moisture variance");
        req1.setRecommendation("Re-check in 24h");

        MvcResult res1 = mockMvc.perform(post("/api/v1/inspections")
                        .header("Authorization", "Bearer " + inspector1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req1)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.isLatest").value(true))
                .andExpect(jsonPath("$.data.status").value("FLAGGED"))
                .andExpect(jsonPath("$.data.rating").value(3))
                .andReturn();

        String firstInspectionId = objectMapper.readTree(res1.getResponse().getContentAsString())
                .path("data").path("id").asText();

        // Check Batch.qualityCheck snapshot after first inspection
        Batch afterFirst = batchRepository.findById(b.getId()).orElseThrow();
        assertNotNull(afterFirst.getQualityCheck());
        assertEquals("FLAGGED", afterFirst.getQualityCheck().getStatus());
        assertEquals(3, afterFirst.getQualityCheck().getRating());
        assertEquals(inspector1.getName(), afterFirst.getQualityCheck().getInspectorName());

        // Check audit log has INSPECTION_CREATED and no PII (no email, no fullName, no farmerName)
        List<AuditLog> audits = auditLogRepository.findAll();
        AuditLog inspAudit = audits.stream()
                .filter(a -> "INSPECTION_CREATED".equals(a.getAction()))
                .findFirst().orElseThrow();
        String auditJson = objectMapper.writeValueAsString(inspAudit);
        assertFalse(auditJson.contains("Sensitive Farmer PII"));
        assertFalse(auditJson.contains("FullName"));
        assertFalse(auditJson.contains("@tracex.demo"));

        // Second inspection on same batch -> first becomes isLatest=false, second is isLatest=true
        InspectionCreateDto req2 = new InspectionCreateDto();
        req2.setBatchId(b.getId());
        req2.setStatus("PASSED");
        req2.setRating(5);
        req2.setChecklist(defaultChecklist(true));
        req2.setFindings("All checks passed on re-inspection");
        req2.setRecommendation("Clear for dispatch");

        MvcResult res2 = mockMvc.perform(post("/api/v1/inspections")
                        .header("Authorization", "Bearer " + inspector2Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req2)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.isLatest").value(true))
                .andExpect(jsonPath("$.data.status").value("PASSED"))
                .andReturn();

        String secondInspectionId = objectMapper.readTree(res2.getResponse().getContentAsString())
                .path("data").path("id").asText();

        Inspection firstInDb = inspectionRepository.findById(firstInspectionId).orElseThrow();
        Inspection secondInDb = inspectionRepository.findById(secondInspectionId).orElseThrow();
        assertFalse(firstInDb.isLatest(), "First inspection must have isLatest=false after second inspection");
        assertTrue(secondInDb.isLatest(), "Second inspection must have isLatest=true");

        Batch afterSecond = batchRepository.findById(b.getId()).orElseThrow();
        assertEquals("PASSED", afterSecond.getQualityCheck().getStatus());
        assertEquals(5, afterSecond.getQualityCheck().getRating());
        assertEquals(inspector2.getName(), afterSecond.getQualityCheck().getInspectorName());

        // GET /api/v1/inspections/batch/{batchId} returns both, newest first
        mockMvc.perform(get("/api/v1/inspections/batch/" + b.getId())
                        .header("Authorization", "Bearer " + managerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].id").value(secondInspectionId))
                .andExpect(jsonPath("$.data[0].isLatest").value(true))
                .andExpect(jsonPath("$.data[1].id").value(firstInspectionId))
                .andExpect(jsonPath("$.data[1].isLatest").value(false));
    }

    @Test
    @DisplayName("Inspection 3 & 4: GET /api/v1/inspections returns only isLatest=true and filters by status; GET /api/v1/inspections/my returns only caller's inspections")
    void testGetLatestInspectionsAndMyInspections() throws Exception {
        Instant now = Instant.now();
        Batch b1 = saveBatch("TX-INSP-B1", "KMGC", "Kashmiri Garlic Cloves",
                now.minus(5, ChronoUnit.DAYS), now.plus(20, ChronoUnit.DAYS), "ACTIVE", false);
        Batch b2 = saveBatch("TX-INSP-B2", "RHSLT", "Raw Himalayan Salt",
                now.minus(5, ChronoUnit.DAYS), now.plus(30, ChronoUnit.DAYS), "ACTIVE", false);

        // Inspector 1 creates FAILED on b1, then PASSED on b1
        InspectionCreateDto r1 = new InspectionCreateDto();
        r1.setBatchId(b1.getId());
        r1.setStatus("FAILED");
        r1.setRating(1);
        r1.setChecklist(defaultChecklist(false));
        mockMvc.perform(post("/api/v1/inspections")
                        .header("Authorization", "Bearer " + inspector1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(r1)))
                .andExpect(status().isCreated());

        InspectionCreateDto r2 = new InspectionCreateDto();
        r2.setBatchId(b1.getId());
        r2.setStatus("PASSED");
        r2.setRating(5);
        r2.setChecklist(defaultChecklist(true));
        mockMvc.perform(post("/api/v1/inspections")
                        .header("Authorization", "Bearer " + inspector1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(r2)))
                .andExpect(status().isCreated());

        // Inspector 2 creates FAILED on b2
        InspectionCreateDto r3 = new InspectionCreateDto();
        r3.setBatchId(b2.getId());
        r3.setStatus("FAILED");
        r3.setRating(2);
        r3.setChecklist(defaultChecklist(false));
        mockMvc.perform(post("/api/v1/inspections")
                        .header("Authorization", "Bearer " + inspector2Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(r3)))
                .andExpect(status().isCreated());

        // GET /api/v1/inspections returns only 2 (latest per batch)
        mockMvc.perform(get("/api/v1/inspections")
                        .header("Authorization", "Bearer " + inspector1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.count").value(2));

        // GET /api/v1/inspections?status=FAILED returns only b2's latest inspection
        mockMvc.perform(get("/api/v1/inspections")
                        .param("status", "FAILED")
                        .header("Authorization", "Bearer " + inspector1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.count").value(1))
                .andExpect(jsonPath("$.data.data[0].batchId").value(b2.getId()));

        // GET /api/v1/inspections/my for inspector1 returns 2; for inspector2 returns 1
        mockMvc.perform(get("/api/v1/inspections/my")
                        .header("Authorization", "Bearer " + inspector1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.count").value(2));

        mockMvc.perform(get("/api/v1/inspections/my")
                        .header("Authorization", "Bearer " + inspector2Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.count").value(1));
    }

    @Test
    @DisplayName("Inspection 5, 6, 7: D-13 PASSED validation, field bounds validation, and ignoring client-supplied isLatest=false")
    void testInspectionValidationsAndClientIsLatestIgnored() throws Exception {
        Instant now = Instant.now();
        Batch b = saveBatch("TX-INSP-VAL", "KMGC", "Kashmiri Garlic Cloves",
                now.minus(5, ChronoUnit.DAYS), now.plus(20, ChronoUnit.DAYS), "ACTIVE", false);

        // D-13: PASSED with a checklist item passed=false -> 422 VALIDATION_ERROR with fieldErrors on status
        InspectionCreateDto badPass = new InspectionCreateDto();
        badPass.setBatchId(b.getId());
        badPass.setStatus("PASSED");
        badPass.setRating(4);
        badPass.setChecklist(defaultChecklist(false));

        mockMvc.perform(post("/api/v1/inspections")
                        .header("Authorization", "Bearer " + inspector1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(badPass)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value(ErrorCode.VALIDATION_ERROR.name()))
                .andExpect(jsonPath("$.fieldErrors[?(@.field == 'status')]").exists());

        // D-13: PASSED with passed=null succeeds (201) AND client-supplied isLatest=false is ignored
        List<ChecklistItem> checklistWithNull = new ArrayList<>();
        for (int i = 0; i < InspectionService.FIXED_CHECKLIST_LABELS.size(); i++) {
            checklistWithNull.add(new ChecklistItem(InspectionService.FIXED_CHECKLIST_LABELS.get(i), i == 0 ? null : Boolean.TRUE, "ok"));
        }
        Map<String, Object> rawBodyWithNullPassedAndIsLatestFalse = Map.of(
                "batchId", b.getId(),
                "status", "PASSED",
                "rating", 4,
                "checklist", checklistWithNull,
                "isLatest", false
        );
        mockMvc.perform(post("/api/v1/inspections")
                        .header("Authorization", "Bearer " + inspector1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(rawBodyWithNullPassedAndIsLatestFalse)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.isLatest").value(true));

        // Rating 0 -> 422
        InspectionCreateDto rating0 = new InspectionCreateDto();
        rating0.setBatchId(b.getId());
        rating0.setStatus("FLAGGED");
        rating0.setRating(0);
        mockMvc.perform(post("/api/v1/inspections")
                        .header("Authorization", "Bearer " + inspector1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(rating0)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.fieldErrors[?(@.field == 'rating')]").exists());

        // Rating 6 -> 422
        rating0.setRating(6);
        mockMvc.perform(post("/api/v1/inspections")
                        .header("Authorization", "Bearer " + inspector1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(rating0)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.fieldErrors[?(@.field == 'rating')]").exists());

        // Unknown checklist label -> 422
        InspectionCreateDto badLabel = new InspectionCreateDto();
        badLabel.setBatchId(b.getId());
        badLabel.setStatus("FLAGGED");
        badLabel.setRating(3);
        badLabel.setChecklist(List.of(new ChecklistItem("Unknown Custom Check", true, "ok")));
        mockMvc.perform(post("/api/v1/inspections")
                        .header("Authorization", "Bearer " + inspector1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(badLabel)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.fieldErrors[?(@.field == 'checklist')]").exists());

        // Note > 200, findings > 1000, recommendation > 400 -> 422
        InspectionCreateDto overLengths = new InspectionCreateDto();
        overLengths.setBatchId(b.getId());
        overLengths.setStatus("FLAGGED");
        overLengths.setRating(3);
        overLengths.setChecklist(List.of(new ChecklistItem(
                InspectionService.FIXED_CHECKLIST_LABELS.get(0), true, "x".repeat(201))));
        overLengths.setFindings("f".repeat(1001));
        overLengths.setRecommendation("r".repeat(401));

        mockMvc.perform(post("/api/v1/inspections")
                        .header("Authorization", "Bearer " + inspector1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(overLengths)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.fieldErrors[?(@.field == 'checklist')]").exists())
                .andExpect(jsonPath("$.fieldErrors[?(@.field == 'findings')]").exists())
                .andExpect(jsonPath("$.fieldErrors[?(@.field == 'recommendation')]").exists());
    }

    @Test
    @DisplayName("Inspection 8 & 9: Inspecting unknown/archived batch -> 404, DISPATCHED batch -> 409 CONFLICT; PUT/PATCH/DELETE -> 405 METHOD_NOT_ALLOWED")
    void testInspectionBatchEligibilityAndImmutability405() throws Exception {
        Instant now = Instant.now();
        Batch archived = saveBatch("TX-INSP-ARCH", "KMGC", "Kashmiri Garlic Cloves",
                now.minus(5, ChronoUnit.DAYS), now.plus(20, ChronoUnit.DAYS), "ACTIVE", true);
        Batch dispatched = saveBatch("TX-INSP-DISP", "KMGC", "Kashmiri Garlic Cloves",
                now.minus(5, ChronoUnit.DAYS), now.plus(20, ChronoUnit.DAYS), "DISPATCHED", false);

        InspectionCreateDto dto = new InspectionCreateDto();
        dto.setStatus("PASSED");
        dto.setRating(5);

        // Unknown batch -> 404
        dto.setBatchId("660000000000000000000099");
        mockMvc.perform(post("/api/v1/inspections")
                        .header("Authorization", "Bearer " + inspector1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(ErrorCode.NOT_FOUND.name()));

        // Archived batch -> 404
        dto.setBatchId(archived.getId());
        mockMvc.perform(post("/api/v1/inspections")
                        .header("Authorization", "Bearer " + inspector1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(ErrorCode.NOT_FOUND.name()));

        // Dispatched batch -> 409 CONFLICT
        dto.setBatchId(dispatched.getId());
        mockMvc.perform(post("/api/v1/inspections")
                        .header("Authorization", "Bearer " + inspector1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(ErrorCode.CONFLICT.name()));

        // Immutability: PUT, PATCH, DELETE on /api/v1/inspections and /api/v1/inspections/{id} -> 405 METHOD_NOT_ALLOWED
        mockMvc.perform(put("/api/v1/inspections").header("Authorization", "Bearer " + superAdminToken))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.code").value(ErrorCode.METHOD_NOT_ALLOWED.name()));
        mockMvc.perform(patch("/api/v1/inspections").header("Authorization", "Bearer " + superAdminToken))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.code").value(ErrorCode.METHOD_NOT_ALLOWED.name()));
        mockMvc.perform(delete("/api/v1/inspections").header("Authorization", "Bearer " + superAdminToken))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.code").value(ErrorCode.METHOD_NOT_ALLOWED.name()));

        mockMvc.perform(put("/api/v1/inspections/660000000000000000000001").header("Authorization", "Bearer " + superAdminToken))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.code").value(ErrorCode.METHOD_NOT_ALLOWED.name()));
        mockMvc.perform(patch("/api/v1/inspections/660000000000000000000001").header("Authorization", "Bearer " + superAdminToken))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.code").value(ErrorCode.METHOD_NOT_ALLOWED.name()));
        mockMvc.perform(delete("/api/v1/inspections/660000000000000000000001").header("Authorization", "Bearer " + superAdminToken))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.code").value(ErrorCode.METHOD_NOT_ALLOWED.name()));
    }

    @Test
    @DisplayName("Check 9: Concurrency - 10 parallel inspections on one batch leave all 10 saved, exactly one isLatest=true, and Batch.qualityCheck matching newest")
    void testTenConcurrentInspectionsSingleIsLatest() throws Exception {
        Instant now = Instant.now();
        Batch b = saveBatch("TX-INSP-CONC", "KMGC", "Kashmiri Garlic Cloves",
                now.minus(5, ChronoUnit.DAYS), now.plus(20, ChronoUnit.DAYS), "ACTIVE", false);

        int threads = 10;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch startLatch = new CountDownLatch(1);
        List<Future<Inspection>> futures = new ArrayList<>();

        String[] statuses = {"PASSED", "FLAGGED", "FAILED", "PASSED", "FLAGGED", "PASSED", "FAILED", "PASSED", "FLAGGED", "PASSED"};
        for (int i = 0; i < threads; i++) {
            final int idx = i;
            futures.add(pool.submit(() -> {
                startLatch.await(5, TimeUnit.SECONDS);
                InspectionCreateDto dto = new InspectionCreateDto();
                dto.setBatchId(b.getId());
                dto.setStatus(statuses[idx]);
                dto.setRating((idx % 5) + 1);
                dto.setChecklist(defaultChecklist("PASSED".equals(statuses[idx]) ? true : false));
                dto.setFindings("Concurrent inspection #" + idx);
                return inspectionService.createInspection(dto, inspector1);
            }));
        }

        startLatch.countDown();
        for (Future<Inspection> f : futures) {
            assertNotNull(f.get(15, TimeUnit.SECONDS));
        }
        pool.shutdown();

        List<Inspection> history = inspectionService.listByBatchId(b.getId());
        assertEquals(10, history.size(), "All 10 parallel inspections must be saved");

        List<Inspection> latestRecords = history.stream().filter(Inspection::isLatest).toList();
        assertEquals(1, latestRecords.size(), "Exactly one inspection must have isLatest=true");

        Inspection newest = history.get(0);
        assertTrue(newest.isLatest(), "Newest inspection (index 0) must be the one with isLatest=true");

        Batch updatedBatch = batchRepository.findById(b.getId()).orElseThrow();
        assertNotNull(updatedBatch.getQualityCheck());
        assertEquals(newest.getStatus(), updatedBatch.getQualityCheck().getStatus());
        assertEquals(newest.getRating(), updatedBatch.getQualityCheck().getRating());
        assertEquals(newest.getCreatedAt(), updatedBatch.getQualityCheck().getInspectedAt());
        System.out.println("V5 10-Thread Parallel Inspection Result: totalSaved=" + history.size()
                + ", isLatestCount=" + latestRecords.size()
                + ", newestInspection={id=" + newest.getId() + ", status=" + newest.getStatus()
                + ", rating=" + newest.getRating() + ", createdAt=" + newest.getCreatedAt() + "}"
                + ", batchQualityCheck={status=" + updatedBatch.getQualityCheck().getStatus()
                + ", rating=" + updatedBatch.getQualityCheck().getRating()
                + ", inspectedAt=" + updatedBatch.getQualityCheck().getInspectedAt()
                + ", inspectorName=" + updatedBatch.getQualityCheck().getInspectorName() + "}");
    }

    @Test
    @DisplayName("Check 10: Index check on inspections collection - no TTL (expireAfterSeconds) and partial unique index on { batchId: 1 } where { isLatest: true }")
    void testInspectionsIndexesNoTtlAndPartialUniqueIndexPresent() {
        List<Document> indexes = new ArrayList<>();
        mongoTemplate.getCollection("inspections").listIndexes().into(indexes);

        assertFalse(indexes.isEmpty(), "inspections collection must have indexes");
        boolean foundPartialUnique = false;

        for (Document idx : indexes) {
            System.out.println("V5 Inspection Index: " + idx.toJson());
            assertFalse(idx.containsKey("expireAfterSeconds"),
                    "inspections must have no TTL index (found expireAfterSeconds in " + idx.toJson() + ")");
            Document key = idx.get("key", Document.class);
            Boolean unique = idx.getBoolean("unique", false);
            Document partial = idx.get("partialFilterExpression", Document.class);
            if (unique && key != null && Integer.valueOf(1).equals(key.getInteger("batchId"))
                    && partial != null && Boolean.TRUE.equals(partial.getBoolean("isLatest"))) {
                foundPartialUnique = true;
            }
        }
        assertTrue(foundPartialUnique,
                "Expected partial unique index on { batchId: 1 } with partialFilterExpression { isLatest: true }, found: " + indexes);
    }

    // =========================================================================
    // DISPATCH TESTS
    // =========================================================================

    @Test
    @DisplayName("Dispatch 1 & 2: Dispatch earliest batch succeeds (200), sets DISPATCHED, records history, removes from FEFO queue, writes PII-free audit; re-dispatch -> 409 CONFLICT; archived/unknown -> 404")
    void testDispatchEarliestSuccessAndReDispatchConflict() throws Exception {
        Instant now = Instant.now();
        Batch b = saveBatch("TX-DISP-EARLY", "KMGC", "Kashmiri Garlic Cloves",
                now.minus(5, ChronoUnit.DAYS), now.plus(10, ChronoUnit.DAYS), "ACTIVE", false);
        Batch archived = saveBatch("TX-DISP-ARCH", "KMGC", "Kashmiri Garlic Cloves",
                now.minus(5, ChronoUnit.DAYS), now.plus(10, ChronoUnit.DAYS), "ACTIVE", true);

        BatchDispatchDto req = new BatchDispatchDto("Secret Buyer Corp", LocalDate.now(), null);

        mockMvc.perform(patch("/api/v1/batches/" + b.getId() + "/dispatch")
                        .header("Authorization", "Bearer " + coordinatorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.lifecycleState").value("DISPATCHED"))
                .andExpect(jsonPath("$.data.status").value("DISPATCHED"))
                .andExpect(jsonPath("$.data.buyerName").value("Secret Buyer Corp"))
                .andExpect(jsonPath("$.data.dispatchHistory.length()").value(1))
                .andExpect(jsonPath("$.data.dispatchHistory[0].outOfOrder").value(false));

        // Removed from FEFO queue
        FefoService.FefoResult fefo = fefoService.getFefoQueue(null, "KMGC");
        assertTrue(fefo.getQueue().isEmpty());

        // Audit entry has BATCH_DISPATCHED and does NOT contain buyerName or farmerName
        AuditLog dispAudit = auditLogRepository.findAll().stream()
                .filter(a -> "BATCH_DISPATCHED".equals(a.getAction()))
                .findFirst().orElseThrow();
        String auditJson = objectMapper.writeValueAsString(dispAudit);
        assertFalse(auditJson.contains("Secret Buyer Corp"), "Audit log must not contain buyerName");
        assertFalse(auditJson.contains("Sensitive Farmer PII"), "Audit log must not contain farmerName");

        // Re-dispatching already-dispatched batch -> 409 CONFLICT
        mockMvc.perform(patch("/api/v1/batches/" + b.getId() + "/dispatch")
                        .header("Authorization", "Bearer " + coordinatorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(ErrorCode.CONFLICT.name()));

        // Archived batch -> 404 NOT_FOUND
        mockMvc.perform(patch("/api/v1/batches/" + archived.getId() + "/dispatch")
                        .header("Authorization", "Bearer " + coordinatorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(ErrorCode.NOT_FOUND.name()));

        // Unknown batch -> 404 NOT_FOUND
        mockMvc.perform(patch("/api/v1/batches/660000000000000000000099/dispatch")
                        .header("Authorization", "Bearer " + coordinatorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(ErrorCode.NOT_FOUND.name()));
    }

    @Test
    @DisplayName("Check 5: Dispatching batch expiring today (daysUntilExpiry == 0) and yesterday (daysUntilExpiry == -1) both return 409 BATCH_EXPIRED and appear in expired, never queue; expiring tomorrow (+1 day) succeeds (200)")
    void testDispatchExpiredTodayAndYesterdayReturnsBatchExpired() throws Exception {
        Instant now = Instant.now();
        Batch expToday = saveBatch("TX-EXP-TODAY", "KMGC", "Kashmiri Garlic Cloves",
                now.minus(10, ChronoUnit.DAYS), now, "ACTIVE", false);
        Batch expYesterday = saveBatch("TX-EXP-YEST", "KMGC", "Kashmiri Garlic Cloves",
                now.minus(10, ChronoUnit.DAYS), now.minus(1, ChronoUnit.DAYS), "ACTIVE", false);
        Batch expTomorrow = saveBatch("TX-EXP-TOMORROW", "KMGC", "Kashmiri Garlic Cloves",
                now.minus(10, ChronoUnit.DAYS), now.plus(1, ChronoUnit.DAYS), "ACTIVE", false);

        BatchDispatchDto req = new BatchDispatchDto("FreshMart", null, null);

        mockMvc.perform(patch("/api/v1/batches/" + expToday.getId() + "/dispatch")
                        .header("Authorization", "Bearer " + coordinatorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(ErrorCode.BATCH_EXPIRED.name()));

        mockMvc.perform(patch("/api/v1/batches/" + expYesterday.getId() + "/dispatch")
                        .header("Authorization", "Bearer " + coordinatorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(ErrorCode.BATCH_EXPIRED.name()));

        FefoService.FefoResult fefoBefore = fefoService.getFefoQueue(null, "KMGC");
        assertEquals(1, fefoBefore.getQueue().size(), "Only expiring-tomorrow batch appears in FEFO queue");
        assertEquals("TX-EXP-TOMORROW", fefoBefore.getQueue().get(0).getBatchCode());
        assertEquals(2, fefoBefore.getExpired().size(), "Both expired batches must appear in expired");

        // Expiring tomorrow (+1 day) succeeds with 200 OK
        mockMvc.perform(patch("/api/v1/batches/" + expTomorrow.getId() + "/dispatch")
                        .header("Authorization", "Bearer " + coordinatorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.lifecycleState").value("DISPATCHED"));
    }

    @Test
    @DisplayName("Check 7: Quality hold (D-19) - FAILED inspection blocks dispatch with 409 QUALITY_HOLD; new PASSED inspection unblocks dispatch (200); FLAGGED dispatches with warning")
    void testQualityHoldFailedBlocksAndPassedUnblocksAndFlaggedWarns() throws Exception {
        Instant now = Instant.now();
        Batch bFailThenPass = saveBatch("TX-QH-01", "KMGC", "Kashmiri Garlic Cloves",
                now.minus(5, ChronoUnit.DAYS), now.plus(10, ChronoUnit.DAYS), "ACTIVE", false);
        Batch bFlagged = saveBatch("TX-QH-02", "RHSLT", "Raw Himalayan Salt",
                now.minus(5, ChronoUnit.DAYS), now.plus(10, ChronoUnit.DAYS), "ACTIVE", false);

        // Create FAILED inspection on bFailThenPass
        InspectionCreateDto failDto = new InspectionCreateDto();
        failDto.setBatchId(bFailThenPass.getId());
        failDto.setStatus("FAILED");
        failDto.setRating(1);
        failDto.setChecklist(defaultChecklist(false));
        inspectionService.createInspection(failDto, inspector1);

        // Attempt dispatch -> 409 QUALITY_HOLD
        BatchDispatchDto dispReq = new BatchDispatchDto("Quality Buyer", null, null);
        mockMvc.perform(patch("/api/v1/batches/" + bFailThenPass.getId() + "/dispatch")
                        .header("Authorization", "Bearer " + coordinatorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dispReq)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(ErrorCode.QUALITY_HOLD.name()));

        // Create PASSED inspection on bFailThenPass -> unblocks dispatch
        InspectionCreateDto passDto = new InspectionCreateDto();
        passDto.setBatchId(bFailThenPass.getId());
        passDto.setStatus("PASSED");
        passDto.setRating(5);
        passDto.setChecklist(defaultChecklist(true));
        inspectionService.createInspection(passDto, inspector1);

        mockMvc.perform(patch("/api/v1/batches/" + bFailThenPass.getId() + "/dispatch")
                        .header("Authorization", "Bearer " + coordinatorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dispReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.lifecycleState").value("DISPATCHED"));

        // Create FLAGGED inspection on bFlagged -> dispatches with warning
        InspectionCreateDto flagDto = new InspectionCreateDto();
        flagDto.setBatchId(bFlagged.getId());
        flagDto.setStatus("FLAGGED");
        flagDto.setRating(3);
        flagDto.setChecklist(defaultChecklist(false));
        inspectionService.createInspection(flagDto, inspector1);

        mockMvc.perform(patch("/api/v1/batches/" + bFlagged.getId() + "/dispatch")
                        .header("Authorization", "Bearer " + coordinatorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dispReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.lifecycleState").value("DISPATCHED"))
                .andExpect(jsonPath("$.data.warning").isNotEmpty());
    }

    @Test
    @DisplayName("Check 8: Out-of-order (D-18) per-SKU, overrideReason behavior, cross-SKU independence, and identical expiryDate tie rule")
    void testOutOfOrderPerSkuOverrideAndTieRule() throws Exception {
        Instant now = Instant.now();
        // SKU KMGC: earlier (5 days) and later (15 days)
        Batch kmgcEarly = saveBatch("TX-KMGC-EARLY", "KMGC", "Kashmiri Garlic Cloves",
                now.minus(5, ChronoUnit.DAYS), now.plus(5, ChronoUnit.DAYS), "ACTIVE", false);
        Batch kmgcLate = saveBatch("TX-KMGC-LATE", "KMGC", "Kashmiri Garlic Cloves",
                now.minus(5, ChronoUnit.DAYS), now.plus(15, ChronoUnit.DAYS), "ACTIVE", false);

        // SKU RHSLT: two batches with identical expiryDate (25 days) — later than KMGC's 5 days!
        Instant sharedExpiry = now.plus(25, ChronoUnit.DAYS).truncatedTo(ChronoUnit.MILLIS);
        Batch rhsltTie1 = saveBatch("TX-RHSLT-TIE1", "RHSLT", "Raw Himalayan Salt",
                now.minus(5, ChronoUnit.DAYS), sharedExpiry, "ACTIVE", false);
        Batch rhsltTie2 = saveBatch("TX-RHSLT-TIE2", "RHSLT", "Raw Himalayan Salt",
                now.minus(4, ChronoUnit.DAYS), sharedExpiry, "ACTIVE", false);

        // 1. Cross-SKU independence: RHSLT dispatches without override even though KMGC has an earlier-expiring batch (5d < 25d)
        // AND Tie rule: rhsltTie2 (created later, rank #2 within RHSLT) dispatches before rhsltTie1 without override because expiryDate is identical!
        BatchDispatchDto noOverrideReq = new BatchDispatchDto("Buyer Salt", null, "   ");
        mockMvc.perform(patch("/api/v1/batches/" + rhsltTie2.getId() + "/dispatch")
                        .header("Authorization", "Bearer " + coordinatorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(noOverrideReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.lifecycleState").value("DISPATCHED"))
                .andExpect(jsonPath("$.data.dispatchHistory[0].outOfOrder").value(false));

        // Dispatch rhsltTie1 as well without override
        mockMvc.perform(patch("/api/v1/batches/" + rhsltTie1.getId() + "/dispatch")
                        .header("Authorization", "Bearer " + coordinatorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(noOverrideReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.lifecycleState").value("DISPATCHED"));

        // 2. Same SKU out-of-order without overrideReason (or blank overrideReason) -> 409 DISPATCH_OUT_OF_ORDER naming TX-KMGC-EARLY
        mockMvc.perform(patch("/api/v1/batches/" + kmgcLate.getId() + "/dispatch")
                        .header("Authorization", "Bearer " + coordinatorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(noOverrideReq)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(ErrorCode.DISPATCH_OUT_OF_ORDER.name()))
                .andExpect(jsonPath("$.error").value(org.hamcrest.Matchers.containsString("TX-KMGC-EARLY")));

        // 3. Same SKU out-of-order WITH overrideReason -> 200 OK, sets outOfOrder=true in dispatchHistory, appends to noteHistory, audits reason
        BatchDispatchDto withOverrideReq = new BatchDispatchDto("Buyer Garlic", null, "Customer requested specific lot TX-KMGC-LATE");
        mockMvc.perform(patch("/api/v1/batches/" + kmgcLate.getId() + "/dispatch")
                        .header("Authorization", "Bearer " + coordinatorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(withOverrideReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.lifecycleState").value("DISPATCHED"))
                .andExpect(jsonPath("$.data.dispatchHistory[0].outOfOrder").value(true))
                .andExpect(jsonPath("$.data.dispatchHistory[0].overrideReason").value("Customer requested specific lot TX-KMGC-LATE"))
                .andExpect(jsonPath("$.data.noteHistory.length()").value(1));

        AuditLog overrideAudit = auditLogRepository.findAll().stream()
                .filter(a -> "BATCH_DISPATCHED".equals(a.getAction()) && kmgcLate.getId().equals(a.getTargetId()))
                .findFirst().orElseThrow();
        assertEquals(true, overrideAudit.getAfter().get("outOfOrder"));
        assertEquals("Customer requested specific lot TX-KMGC-LATE", overrideAudit.getReason());
    }

    @Test
    @DisplayName("Check 4: Race test - 2-thread concurrent dispatch on the same batch repeated 100 times: every iteration produces one 200, one 409 CONFLICT, and 1 dispatchHistory entry")
    void testConcurrentDispatchRaceRepeated100Times() throws Exception {
        Instant now = Instant.now();
        ExecutorService pool = Executors.newFixedThreadPool(2);
        int totalSuccess = 0;
        int totalConflict = 0;

        try {
            for (int iter = 1; iter <= 100; iter++) {
                Batch b = saveBatch("TX-RACE-" + iter, "KMGC", "Kashmiri Garlic Cloves",
                        now.minus(5, ChronoUnit.DAYS), now.plus(30, ChronoUnit.DAYS), "ACTIVE", false);

                CountDownLatch ready = new CountDownLatch(2);
                CountDownLatch start = new CountDownLatch(1);
                AtomicInteger successCount = new AtomicInteger(0);
                AtomicInteger conflictCount = new AtomicInteger(0);

                Callable<Void> task = () -> {
                    ready.countDown();
                    start.await(5, TimeUnit.SECONDS);
                    try {
                        BatchDispatchDto dto = new BatchDispatchDto("Race Buyer", null, "Concurrent test override");
                        batchService.dispatchBatch(b.getId(), dto, coordinator, "req-race");
                        successCount.incrementAndGet();
                    } catch (ApiException ex) {
                        if (ErrorCode.CONFLICT.name().equals(ex.getErrorCode()) && ex.getStatus().value() == 409) {
                            conflictCount.incrementAndGet();
                        } else {
                            throw ex;
                        }
                    }
                    return null;
                };

                Future<Void> f1 = pool.submit(task);
                Future<Void> f2 = pool.submit(task);
                assertTrue(ready.await(5, TimeUnit.SECONDS));
                start.countDown();
                f1.get(10, TimeUnit.SECONDS);
                f2.get(10, TimeUnit.SECONDS);

                assertEquals(1, successCount.get(), "Iteration " + iter + " must have exactly 1 success (200)");
                assertEquals(1, conflictCount.get(), "Iteration " + iter + " must have exactly 1 409 CONFLICT");
                totalSuccess += successCount.get();
                totalConflict += conflictCount.get();

                Batch reloaded = batchRepository.findById(b.getId()).orElseThrow();
                assertEquals("DISPATCHED", reloaded.getLifecycleState());
                assertEquals(1, reloaded.getDispatchHistory().size(),
                        "Iteration " + iter + " must have exactly 1 dispatchHistory entry");

                // Clean up batch so next iteration is fast and isolated
                batchRepository.deleteById(b.getId());
            }
            System.out.println("V4 Race Summary: runs=100, success200=" + totalSuccess + ", conflict409=" + totalConflict);
            assertEquals(100, totalSuccess);
            assertEquals(100, totalConflict);
        } finally {
            pool.shutdown();
        }
    }

    @Test
    @DisplayName("Check 12 & Field Validation: Unauthorized roles get 403 RBAC_INSUFFICIENT even for non-existent batch id; invalid buyerName and dispatchDate return 422 with fieldErrors")
    void testDispatchRoleCheckFirstAndFieldValidation() throws Exception {
        BatchDispatchDto validReq = new BatchDispatchDto("Valid Buyer", null, null);
        String nonExistentBatchId = "660000000000000000000099";

        // Unauthorized roles: factory-manager, quality-inspector, manager -> 403 RBAC_INSUFFICIENT even for non-existent id
        for (String token : List.of(factoryManagerToken, inspector1Token, managerToken)) {
            mockMvc.perform(patch("/api/v1/batches/" + nonExistentBatchId + "/dispatch")
                            .header("Authorization", "Bearer " + token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(validReq)))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.code").value(ErrorCode.RBAC_INSUFFICIENT.name()));
        }

        // dispatch-coordinator on /api/v1/inspections endpoints -> 403 RBAC_INSUFFICIENT even for non-existent id
        mockMvc.perform(get("/api/v1/inspections").header("Authorization", "Bearer " + coordinatorToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(ErrorCode.RBAC_INSUFFICIENT.name()));
        mockMvc.perform(get("/api/v1/inspections/" + nonExistentBatchId).header("Authorization", "Bearer " + coordinatorToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(ErrorCode.RBAC_INSUFFICIENT.name()));

        // Field validation on dispatch
        Instant now = Instant.now();
        Batch b = saveBatch("TX-DISP-VAL", "KMGC", "Kashmiri Garlic Cloves",
                now.minus(5, ChronoUnit.DAYS), now.plus(20, ChronoUnit.DAYS), "ACTIVE", false);

        // Blank buyerName & dispatchDate before packDate -> 422
        BatchDispatchDto badReq1 = new BatchDispatchDto("   ", LocalDate.now().minusDays(10), null);
        mockMvc.perform(patch("/api/v1/batches/" + b.getId() + "/dispatch")
                        .header("Authorization", "Bearer " + coordinatorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(badReq1)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value(ErrorCode.VALIDATION_ERROR.name()))
                .andExpect(jsonPath("$.fieldErrors[?(@.field == 'buyerName')]").exists())
                .andExpect(jsonPath("$.fieldErrors[?(@.field == 'dispatchDate')]").exists());

        // buyerName > 200 chars & dispatchDate in future -> 422
        BatchDispatchDto badReq2 = new BatchDispatchDto("B".repeat(201), LocalDate.now().plusDays(2), null);
        mockMvc.perform(patch("/api/v1/batches/" + b.getId() + "/dispatch")
                        .header("Authorization", "Bearer " + coordinatorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(badReq2)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value(ErrorCode.VALIDATION_ERROR.name()))
                .andExpect(jsonPath("$.fieldErrors[?(@.field == 'buyerName')]").exists())
                .andExpect(jsonPath("$.fieldErrors[?(@.field == 'dispatchDate')]").exists());
    }

    @Test
    @DisplayName("A0-2: dispatchDate and dispatchHistory[].dispatchDate are stored and returned as exact 'YYYY-MM-DD' strings across UTC, Asia/Kolkata, and America/Los_Angeles")
    void testDispatchDateRoundTripAcrossTimeZones() throws Exception {
        TimeZone originalDefault = TimeZone.getDefault();
        List<String> zones = List.of("UTC", "Asia/Kolkata", "America/Los_Angeles");

        try {
            for (String zoneId : zones) {
                TimeZone.setDefault(TimeZone.getTimeZone(zoneId));

                Batch b = new Batch();
                b.setBatchCode("TX-A02-DISP-" + zoneId.replace("/", "-"));
                b.setProductId("prod-1");
                b.setProductName("Wild Berry Juice Concentrate");
                b.setSku("WBJC");
                b.setSourceLotCode("LOT-A02-" + zoneId.replace("/", "-"));
                b.setFarmerName("A02 Farmer");
                b.setVillage("A02 Village");
                b.setQuantityProduced(100);
                b.setUnit("Kg");
                b.setYieldPercent(85.0);
                b.setPackDate(LocalDate.of(2026, 9, 25));
                b.setExpiryDate(LocalDate.now().plusDays(30));
                b.setDataSource("manual");
                b.setShelfLifeSource("manual");
                b.setLifecycleState("ACTIVE");
                b.setDeleted(false);
                b.setCreatedAt(Instant.now());
                b.setUpdatedAt(Instant.now());
                Batch saved = batchRepository.save(b);

                String rawDispatchBody = """
                        {
                          "buyerName": "A02 Buyer (%s)",
                          "dispatchDate": "2026-10-01",
                          "overrideReason": "Timezone round-trip test"
                        }
                        """.formatted(zoneId);

                MvcResult dispRes = mockMvc.perform(patch("/api/v1/batches/" + saved.getId() + "/dispatch")
                                .header("Authorization", "Bearer " + coordinatorToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(rawDispatchBody))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.data.dispatchDate").value("2026-10-01"))
                        .andExpect(jsonPath("$.data.dispatchHistory[0].dispatchDate").value("2026-10-01"))
                        .andReturn();

                MvcResult getRes = mockMvc.perform(get("/api/v1/batches/" + saved.getId())
                                .header("Authorization", "Bearer " + coordinatorToken))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.data.dispatchDate").value("2026-10-01"))
                        .andExpect(jsonPath("$.data.dispatchHistory[0].dispatchDate").value("2026-10-01"))
                        .andReturn();

                Document rawMongoDoc = mongoTemplate.getCollection("batches")
                        .find(new Document("_id", new org.bson.types.ObjectId(saved.getId())))
                        .first();
                assertNotNull(rawMongoDoc);
                Object rawDispatchDate = rawMongoDoc.get("dispatchDate");
                List<Document> rawHistory = rawMongoDoc.getList("dispatchHistory", Document.class);
                Object rawHistDispatchDate = rawHistory.get(0).get("dispatchDate");

                System.out.println("A0-2 Dispatch Round-Trip [JVM TZ=" + TimeZone.getDefault().getID() + "]: "
                        + "mongo.dispatchDate=" + rawDispatchDate + " (" + rawDispatchDate.getClass().getName() + "), "
                        + "mongo.dispatchHistory[0].dispatchDate=" + rawHistDispatchDate + " (" + rawHistDispatchDate.getClass().getName() + "), "
                        + "PATCH => " + dispRes.getResponse().getContentAsString()
                        + ", GET => " + getRes.getResponse().getContentAsString());

                assertEquals("2026-10-01", rawDispatchDate);
                assertEquals("2026-10-01", rawHistDispatchDate);
            }
        } finally {
            TimeZone.setDefault(originalDefault);
        }
    }

    @Test
    @DisplayName("A0-2: dispatchHistory[].dispatchDate across UTC, Asia/Kolkata, and America/Los_Angeles preserves exact YYYY-MM-DD in MongoDB and API responses")
    void testDispatchHistoryDispatchDateAcrossThreeTimeZones() throws Exception {
        TimeZone originalDefault = TimeZone.getDefault();
        List<String> zones = List.of("UTC", "Asia/Kolkata", "America/Los_Angeles");

        try {
            for (String zoneId : zones) {
                TimeZone.setDefault(TimeZone.getTimeZone(zoneId));

                Batch b = new Batch();
                b.setBatchCode("TX-A02-HIST-" + zoneId.replace("/", "-"));
                b.setProductId("prod-1");
                b.setProductName("Wild Berry Juice Concentrate");
                b.setSku("WBJC");
                b.setSourceLotCode("LOT-A02-HIST-" + zoneId.replace("/", "-"));
                b.setFarmerName("A02 Hist Farmer");
                b.setVillage("A02 Hist Village");
                b.setQuantityProduced(100);
                b.setUnit("Kg");
                b.setYieldPercent(85.0);
                b.setPackDate(LocalDate.of(2026, 9, 20));
                b.setExpiryDate(LocalDate.now().plusDays(45));
                b.setDataSource("manual");
                b.setShelfLifeSource("manual");
                b.setLifecycleState("ACTIVE");
                b.setDeleted(false);
                b.setCreatedAt(Instant.now());
                b.setUpdatedAt(Instant.now());
                Batch saved = batchRepository.save(b);

                String rawDispatchBody = """
                        {
                          "buyerName": "A02 History Buyer (%s)",
                          "dispatchDate": "2026-09-29",
                          "overrideReason": "dispatchHistory timezone verification"
                        }
                        """.formatted(zoneId);

                mockMvc.perform(patch("/api/v1/batches/" + saved.getId() + "/dispatch")
                                .header("Authorization", "Bearer " + coordinatorToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(rawDispatchBody))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.data.dispatchHistory").isArray())
                        .andExpect(jsonPath("$.data.dispatchHistory[0].dispatchDate").value("2026-09-29"))
                        .andExpect(jsonPath("$.data.dispatchHistory[0].buyerName").value("A02 History Buyer (" + zoneId + ")"))
                        .andExpect(jsonPath("$.data.dispatchHistory[0].outOfOrder").isBoolean());

                MvcResult getRes = mockMvc.perform(get("/api/v1/batches/" + saved.getId())
                                .header("Authorization", "Bearer " + coordinatorToken))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.data.dispatchHistory[0].dispatchDate").value("2026-09-29"))
                        .andReturn();

                Document rawMongoDoc = mongoTemplate.getCollection("batches")
                        .find(new Document("_id", new org.bson.types.ObjectId(saved.getId())))
                        .first();
                assertNotNull(rawMongoDoc);
                List<Document> rawHistory = rawMongoDoc.getList("dispatchHistory", Document.class);
                assertNotNull(rawHistory);
                assertEquals(1, rawHistory.size());
                Object rawHistDispatchDate = rawHistory.get(0).get("dispatchDate");
                Object rawHistDispatchedAt = rawHistory.get(0).get("dispatchedAt");
                assertEquals(String.class, rawHistDispatchDate.getClass());
                assertEquals("2026-09-29", rawHistDispatchDate);
                assertEquals(java.util.Date.class, rawHistDispatchedAt.getClass());

                System.out.println("A0-2 dispatchHistory[].dispatchDate [JVM TZ=" + TimeZone.getDefault().getID() + "]: "
                        + "mongo.dispatchHistory[0].dispatchDate=" + rawHistDispatchDate + " (" + rawHistDispatchDate.getClass().getName() + "), "
                        + "mongo.dispatchHistory[0].dispatchedAt=" + rawHistDispatchedAt + " (" + rawHistDispatchedAt.getClass().getName() + "), "
                        + "GET dispatchHistory[0] => " + objectMapper.readTree(getRes.getResponse().getContentAsString()).path("data").path("dispatchHistory").get(0));
            }
        } finally {
            TimeZone.setDefault(originalDefault);
        }
    }
}
