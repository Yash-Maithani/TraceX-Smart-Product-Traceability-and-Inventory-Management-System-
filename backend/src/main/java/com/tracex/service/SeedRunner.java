package com.tracex.service;

import com.tracex.model.AccessRequest;
import com.tracex.model.AccessRequestStatus;
import com.tracex.model.Batch;
import com.tracex.model.Inspection;
import com.tracex.model.Product;
import com.tracex.model.Role;
import com.tracex.model.User;
import com.tracex.repository.AccessRequestRepository;
import com.tracex.repository.BatchRepository;
import com.tracex.repository.ProductRepository;
import com.tracex.repository.UserRepository;
import com.tracex.util.HashUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.env.Environment;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

@Component
public class SeedRunner implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(SeedRunner.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AccessRequestRepository accessRequestRepository;
    private final AuditService auditService;
    private final ProductRepository productRepository;
    private final BatchRepository batchRepository;
    private final Clock clock;
    private final MongoTemplate mongoTemplate;
    private final Environment environment;
    private final FefoService fefoService;
    private final TraceTokenService traceTokenService;

    @Value("${tracex.seed.enabled:false}")
    private boolean seedEnabled;

    @Value("${tracex.seed.default-password:}")
    private String defaultPassword;

    public SeedRunner(UserRepository userRepository, PasswordEncoder passwordEncoder,
                      AccessRequestRepository accessRequestRepository, AuditService auditService,
                      ProductRepository productRepository, BatchRepository batchRepository,
                      Clock clock, MongoTemplate mongoTemplate, Environment environment) {
        this(userRepository, passwordEncoder, accessRequestRepository, auditService,
                productRepository, batchRepository, clock, mongoTemplate, environment, null, null);
    }

    @Autowired
    public SeedRunner(UserRepository userRepository, PasswordEncoder passwordEncoder,
                      AccessRequestRepository accessRequestRepository, AuditService auditService,
                      ProductRepository productRepository, BatchRepository batchRepository,
                      Clock clock, MongoTemplate mongoTemplate, Environment environment,
                      FefoService fefoService, TraceTokenService traceTokenService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.accessRequestRepository = accessRequestRepository;
        this.auditService = auditService;
        this.productRepository = productRepository;
        this.batchRepository = batchRepository;
        this.clock = clock;
        this.mongoTemplate = mongoTemplate;
        this.environment = environment;
        this.fefoService = fefoService;
        this.traceTokenService = traceTokenService;
    }

    @Override
    public void run(String... args) {
        boolean isProd = Arrays.asList(environment.getActiveProfiles()).contains("prod");

        if (isProd && !seedEnabled) {
            log.info("Seed runner skipped in production profile (SEED_ENABLED is false).");
            return;
        }

        if (!seedEnabled) {
            log.info("Seed runner is disabled.");
            return;
        }

        if (defaultPassword == null || defaultPassword.trim().isEmpty()) {
            String msg = "Missing SEED_DEFAULT_PASSWORD. SEED_DEFAULT_PASSWORD is required whenever seeding runs.";
            log.error(msg);
            throw new IllegalStateException(msg);
        }

        log.info("Executing idempotent database seed for demo users, access requests, products, batches, and inspections...");
        seedUsers();
        seedAccessRequests();
        seedProducts();
        seedBatches();
        seedInspections();

        log.info("Database seeding completed.");
    }

    public synchronized void seedUsers() {
        if (defaultPassword == null || defaultPassword.trim().isEmpty()) {
            throw new IllegalStateException("Missing SEED_DEFAULT_PASSWORD. SEED_DEFAULT_PASSWORD is required whenever seeding runs.");
        }
        String encodedPassword = passwordEncoder.encode(defaultPassword);

        List<UserSeedDefinition> seeds = List.of(
                new UserSeedDefinition("superadmin", "[DEMO] Super Administrator", "superadmin@tracex.demo", Role.ADMIN, true),
                new UserSeedDefinition("admin", "[DEMO] Staff Administrator", "admin@tracex.demo", Role.ADMIN, false),
                new UserSeedDefinition("manager", "[DEMO] Operations Manager", "manager@tracex.demo", Role.MANAGER, false),
                new UserSeedDefinition("factory_mgr", "[DEMO] Factory Manager", "factory@tracex.demo", Role.FACTORY_MANAGER, false),
                new UserSeedDefinition("inspector", "[DEMO] Quality Inspector", "inspector@tracex.demo", Role.QUALITY_INSPECTOR, false),
                new UserSeedDefinition("coordinator", "[DEMO] Dispatch Coordinator", "coordinator@tracex.demo", Role.DISPATCH_COORDINATOR, false)
        );

        for (UserSeedDefinition def : seeds) {
            userRepository.findByUsername(def.username()).ifPresentOrElse(
                    existing -> {
                        existing.setName(def.name());
                        existing.setEmail(def.email());
                        existing.setRole(def.role());
                        existing.setSuperAdmin(def.isSuperAdmin());
                        existing.setSynthetic(true);
                        existing.setPasswordHash(encodedPassword);
                        existing.setActive(true);
                        existing.setDeleted(false);
                        userRepository.save(existing);
                    },
                    () -> {
                        User newUser = new User(
                                def.username(),
                                encodedPassword,
                                def.name(),
                                def.email(),
                                def.role(),
                                def.isSuperAdmin()
                        );
                        newUser.setSynthetic(true);
                        userRepository.save(newUser);
                    }
            );
        }
    }

    public synchronized void seedAccessRequests() {
        List<AccessRequestSeedDefinition> reqSeeds = List.of(
                new AccessRequestSeedDefinition(
                        "[DEMO] Pending Applicant",
                        "pending.applicant@tracex.demo",
                        Role.MANAGER,
                        AccessRequestStatus.PENDING,
                        null,
                        null,
                        null
                ),
                new AccessRequestSeedDefinition(
                        "[DEMO] Approved Applicant",
                        "approved.applicant@tracex.demo",
                        Role.QUALITY_INSPECTOR,
                        AccessRequestStatus.APPROVED,
                        "superadmin",
                        HashUtil.sha256("demo_seeded_invite_token_hash_value_12345678"),
                        Instant.now().plus(Duration.ofHours(48))
                ),
                new AccessRequestSeedDefinition(
                        "[DEMO] Rejected Applicant",
                        "rejected.applicant@tracex.demo",
                        Role.DISPATCH_COORDINATOR,
                        AccessRequestStatus.REJECTED,
                        null,
                        null,
                        null
                )
        );

        for (AccessRequestSeedDefinition def : reqSeeds) {
            accessRequestRepository.findByEmail(def.email()).ifPresentOrElse(
                    existing -> {
                        existing.setName(def.name());
                        existing.setRole(def.role());
                        existing.setStatus(def.status());
                        existing.setApprovedBy(def.approvedBy());
                        existing.setInviteToken(def.inviteToken());
                        existing.setInviteExpiry(def.inviteExpiry());
                        existing.setSynthetic(true);
                        accessRequestRepository.save(existing);
                    },
                    () -> {
                        AccessRequest newReq = new AccessRequest(def.name(), def.email(), def.role());
                        newReq.setStatus(def.status());
                        newReq.setApprovedBy(def.approvedBy());
                        newReq.setInviteToken(def.inviteToken());
                        newReq.setInviteExpiry(def.inviteExpiry());
                        newReq.setSynthetic(true);
                        accessRequestRepository.save(newReq);
                    }
            );
        }
    }

    private record UserSeedDefinition(String username, String name, String email, Role role, boolean isSuperAdmin) {}
    private record AccessRequestSeedDefinition(String name, String email, Role role, AccessRequestStatus status, String approvedBy, String inviteToken, Instant inviteExpiry) {}

    public synchronized void seedProducts() {
        upsertProduct("WBJC", "Wild Berry Juice Concentrate", "Beverages", 180, null, null, "LOW");
        upsertProduct("KMGC", "Kumaon Royal Multigrain Crackers", "Snacks", 90, null, null, "MEDIUM");
        upsertProduct("RHSLT", "Himalayan Rock Salt (Sendha Namak)", "Condiments", 730, null, null, "LOW");
        upsertProduct("ABHJAM", "Apricot & Berry Himalayan Jam", "Spreads", 365, null, null, "MEDIUM");
        upsertProduct("WBDRP", "Wild Berry Dried Pulp (Tray-Dried)", "Ingredients", 270, null, null, "LOW");
    }

    private void upsertProduct(String sku, String name, String category, Integer baseDays, Integer predDays, String template, String riskLevel) {
        Optional<Product> opt = productRepository.findBySku(sku);
        Product p = opt.orElseGet(Product::new);
        p.setSku(sku);
        p.setProductName(name);
        p.setCategory(category);
        p.setBaseShelfLifeDays(baseDays);
        p.setPredictedShelfLifeDays(predDays);
        p.setPredictedExpiryTemplate(template);
        p.setRiskLevel(riskLevel);
        productRepository.save(p);
    }

    /**
     * Seeds 12 demo batches (DEMO-LOT-001 through DEMO-LOT-012) across all freshness tiers and lifecycle states.
     */
    public synchronized void seedBatches() {
        Instant now = clock.instant();
        java.time.LocalDate today = java.time.LocalDate.now(clock);
        java.time.LocalDate sharedTieExpiry = today.plusDays(90);
        String ym = String.format("%04d-%02d", today.getYear(), today.getMonthValue());
        String prefix = "TX-" + ym + "-";

        // 1. expired
        upsertBatch("DEMO-LOT-001", "WBJC", today.minusDays(200), today.minusDays(5), "ACTIVE", null, null, null, false, prefix + "001");
        // 2. urgent 1d (same SKU KMGC as DEMO-LOT-005 with different expiry -> exercises out-of-order)
        upsertBatch("DEMO-LOT-002", "KMGC", today.minusDays(89), today.plusDays(1), "ACTIVE", null, null, null, false, prefix + "002");
        // 3. urgent 7d
        upsertBatch("DEMO-LOT-003", "ABHJAM", today.minusDays(358), today.plusDays(7), "ACTIVE", null, null, null, false, prefix + "003");
        // 4. warning 8d
        upsertBatch("DEMO-LOT-004", "WBDRP", today.minusDays(262), today.plusDays(8), "ACTIVE", null, null, null, false, prefix + "004");
        // 5. warning 30d (same SKU KMGC as DEMO-LOT-002 with different expiry)
        upsertBatch("DEMO-LOT-005", "KMGC", today.minusDays(60), today.plusDays(30), "ACTIVE", null, null, null, false, prefix + "005");
        // 6. ready 31d
        upsertBatch("DEMO-LOT-006", "WBJC", today.minusDays(149), today.plusDays(31), "ACTIVE", null, null, null, false, prefix + "006");
        // 7. ready later (paired with DEMO-LOT-012 on same SKU RHSLT and identical expiryDate to exercise D-18 tie rule within 12 batches)
        upsertBatch("DEMO-LOT-007", "RHSLT", today.minusDays(640), sharedTieExpiry, "ACTIVE", null, null, null, false, prefix + "007");
        // 8. dispatched with dispatchHistory
        upsertBatch("DEMO-LOT-008", "ABHJAM", today.minusDays(200), today.plusDays(165), "DISPATCHED", "Demo Buyer A", today.minusDays(5), now.minus(5, ChronoUnit.DAYS), false, prefix + "008");
        // 9. dispatched with dispatchHistory
        upsertBatch("DEMO-LOT-009", "WBJC", today.minusDays(50), today.plusDays(130), "DISPATCHED", "Demo Buyer B", today.minusDays(2), now.minus(2, ChronoUnit.DAYS), false, prefix + "009");
        // 10. archived
        upsertBatch("DEMO-LOT-010", "KMGC", today.minusDays(100), today.minusDays(10), "ACTIVE", null, null, null, true, prefix + "010");
        // 11. ready 60d
        upsertBatch("DEMO-LOT-011", "WBDRP", today.minusDays(210), today.plusDays(60), "ACTIVE", null, null, null, false, prefix + "011");
        // 12. second active batch of SKU RHSLT with identical expiryDate as DEMO-LOT-007 (exercises D-18 tie rule)
        upsertBatch("DEMO-LOT-012", "RHSLT", today.minusDays(640), sharedTieExpiry, "ACTIVE", null, null, null, false, prefix + "012");

        // Remove any legacy DEMO-LOT-013 document from earlier runs so exactly 12 demo batches remain
        mongoTemplate.remove(Query.query(Criteria.where("sourceLotCode").is("DEMO-LOT-013")), Batch.class);

        String counterKey = "batch_TX-" + ym;
        com.tracex.model.Counter existingCounter = mongoTemplate.findById(counterKey, com.tracex.model.Counter.class);
        if (existingCounter != null && existingCounter.getSeq() == 13L
                && !mongoTemplate.exists(Query.query(Criteria.where("batchCode").is(prefix + "013")), Batch.class)) {
            mongoTemplate.updateFirst(
                    Query.query(Criteria.where("_id").is(counterKey)),
                    new org.springframework.data.mongodb.core.query.Update().set("seq", 12L),
                    com.tracex.model.Counter.class
            );
        } else {
            mongoTemplate.upsert(
                    Query.query(Criteria.where("_id").is(counterKey)),
                    new org.springframework.data.mongodb.core.query.Update().max("seq", 12L).setOnInsert("_id", counterKey),
                    com.tracex.model.Counter.class
            );
        }
    }

    private void upsertBatch(String lotCode, String sku, java.time.LocalDate packDate, java.time.LocalDate expiryDate, String lifecycle, String buyerName, java.time.LocalDate dispatchDate, Instant dispatchedAt, boolean isDeleted, String batchCode) {
        Optional<Product> opt = productRepository.findBySku(sku);
        if (opt.isEmpty()) {
            return;
        }
        Product p = opt.get();

        Query q = new Query(new Criteria().orOperator(
                Criteria.where("sourceLotCode").is(lotCode),
                Criteria.where("batchCode").is(batchCode)
        ));
        Batch batch = mongoTemplate.findOne(q, Batch.class);
        if (batch == null) {
            batch = new Batch();
        }

        batch.setProductId(p.getId());
        batch.setProductName(p.getProductName());
        batch.setSku(p.getSku());
        batch.setSourceLotCode(lotCode);
        batch.setFarmerName("Demo Farmer");
        batch.setVillage("Demo Village");
        batch.setQuantityProduced(150);
        batch.setUnit("Kg");
        batch.setYieldPercent(82.0);
        batch.setBatchCode(batchCode);
        batch.setPackDate(packDate);
        batch.setExpiryDate(expiryDate);
        batch.setDataSource("predicted");
        batch.setShelfLifeSource("predicted");
        batch.setLifecycleState(lifecycle);
        batch.setQualityCheck(null);

        if ((batch.getTraceToken() == null || batch.getTraceToken().isBlank()) && traceTokenService != null) {
            batch.setTraceToken(traceTokenService.generateToken());
        }

        if (fefoService != null) {
            batch.setPriorityScore(fefoService.computePriorityScore(expiryDate, p.getRiskLevel(), clock));
        }

        batch.setDispatchDate(dispatchDate);
        batch.setBuyerName(buyerName);
        if ("DISPATCHED".equals(lifecycle) && buyerName != null && dispatchDate != null) {
            batch.setDispatchHistory(new ArrayList<>(List.of(
                    new Batch.DispatchHistoryEntry("coordinator", dispatchedAt != null ? dispatchedAt : clock.instant(), buyerName, dispatchDate, null, false)
            )));
        }
        batch.setTraceabilityNote("Demo batch - " + lotCode);
        batch.setCreatedBy("[DEMO] Seed");
        batch.setDeleted(isDeleted);
        if (isDeleted) {
            batch.setDeletedAt(clock.instant());
            batch.setDeletedBy("[DEMO] Seed");
            batch.setDeleteNote("Demo archived batch");
        }

        mongoTemplate.save(batch);
    }

    public synchronized void seedInspections() {
        Optional<User> inspectorOpt = userRepository.findByUsername("inspector");
        String inspectorId = inspectorOpt.map(User::getId).orElse("seed_inspector");
        String inspectorName = inspectorOpt.map(User::getName).orElse("[DEMO] Quality Inspector");
        String inspectorUsername = inspectorOpt.map(User::getUsername).orElse("inspector");

        java.time.LocalDate today = java.time.LocalDate.now(clock);
        String prefix = String.format("TX-%04d-%02d-", today.getYear(), today.getMonthValue());

        upsertSeedInspection(
                prefix + "002",
                "PASSED",
                5,
                true,
                "[DEMO] All quality checks passed for urgent multigrain crackers batch.",
                "Cleared for priority FEFO dispatch.",
                inspectorId,
                inspectorName,
                inspectorUsername
        );

        upsertSeedInspection(
                prefix + "003",
                "FAILED",
                2,
                false,
                "[DEMO] Seal integrity compromised on sample jars; placed on quality hold.",
                "Hold batch from dispatch and quarantine affected cartons.",
                inspectorId,
                inspectorName,
                inspectorUsername
        );

        upsertSeedInspection(
                prefix + "004",
                "FLAGGED",
                3,
                true,
                "[DEMO] Minor label alignment variance observed; product quality unaffected.",
                "Dispatch permitted with advisory note to buyer.",
                inspectorId,
                inspectorName,
                inspectorUsername
        );
    }

    private void upsertSeedInspection(String batchCode, String status, int rating, boolean firstItemPassed,
                                      String findings, String recommendation,
                                      String inspectorId, String inspectorName, String inspectorUsername) {
        Batch batch = mongoTemplate.findOne(new Query(Criteria.where("batchCode").is(batchCode)), Batch.class);
        if (batch == null) {
            return;
        }

        Instant inspectedAt = clock.instant().minus(1, ChronoUnit.DAYS);
        List<Inspection.ChecklistItem> checklist = new ArrayList<>();
        for (int i = 0; i < InspectionService.FIXED_CHECKLIST_LABELS.size(); i++) {
            String label = InspectionService.FIXED_CHECKLIST_LABELS.get(i);
            Boolean passed = (i == 0) ? firstItemPassed : Boolean.TRUE;
            checklist.add(new Inspection.ChecklistItem(label, passed, i == 0 && !firstItemPassed ? "Failed seal check" : "OK"));
        }

        Query q = new Query(Criteria.where("batchId").is(batch.getId()).and("isLatest").is(true));
        Inspection inspection = mongoTemplate.findOne(q, Inspection.class);
        if (inspection == null) {
            inspection = new Inspection();
        }
        inspection.setBatchId(batch.getId());
        inspection.setBatchCode(batch.getBatchCode());
        inspection.setProductName(batch.getProductName());
        inspection.setSku(batch.getSku());
        inspection.setStatus(status);
        inspection.setRating(rating);
        inspection.setChecklist(checklist);
        inspection.setFindings(findings);
        inspection.setRecommendation(recommendation);
        inspection.setInspectedBy(new Inspection.InspectedBy(inspectorId, inspectorName, inspectorUsername));
        inspection.setLatest(true);
        if (inspection.getCreatedAt() == null) {
            inspection.setCreatedAt(inspectedAt);
        }
        mongoTemplate.save(inspection, "inspections");

        batch.setQualityCheck(new Batch.QualityCheck(status, rating, inspection.getCreatedAt(), inspectorName));
        mongoTemplate.save(batch);
    }
}