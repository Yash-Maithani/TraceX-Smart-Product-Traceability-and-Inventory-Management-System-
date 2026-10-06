# -*- coding: utf-8 -*-
import re

with open('backend/src/main/java/com/tracex/service/SeedRunner.java', 'r', encoding='utf-8') as f:
    text = f.read()

import_lines = '''
import com.tracex.model.Product;
import com.tracex.model.Batch;
import com.tracex.repository.ProductRepository;
import com.tracex.repository.BatchRepository;
import org.springframework.beans.factory.annotation.Value;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
'''
text = text.replace('import org.springframework.stereotype.Service;', 'import org.springframework.stereotype.Service;' + import_lines)

text = re.sub(
    r'private final UserRepository userRepository;.*?\n\s*public SeedRunner\(.*?\) \{.*?\}',
    '''private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AccessRequestRepository accessRequestRepository;
    private final AuditService auditService;
    private final ProductRepository productRepository;
    private final BatchRepository batchRepository;
    private final Clock clock;
    private final MongoTemplate mongoTemplate;

    @Value("${tracex.business.timezone:Asia/Kolkata}")
    private String businessTimezone;

    public SeedRunner(UserRepository userRepository, PasswordEncoder passwordEncoder,
                      AccessRequestRepository accessRequestRepository, AuditService auditService,
                      ProductRepository productRepository, BatchRepository batchRepository,
                      Clock clock, MongoTemplate mongoTemplate) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.accessRequestRepository = accessRequestRepository;
        this.auditService = auditService;
        this.productRepository = productRepository;
        this.batchRepository = batchRepository;
        this.clock = clock;
        this.mongoTemplate = mongoTemplate;
    }''', text, flags=re.DOTALL)

run_method_add = '''
        seedProducts();
        seedBatches();
'''
text = text.replace('seedAccessRequests();', 'seedAccessRequests();' + run_method_add)

seed_methods = '''
    private void seedProducts() {
        logger.info("Seeding products...");
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

    private void seedBatches() {
        logger.info("Seeding batches...");
        Instant now = clock.instant();

        // 1. expired
        upsertBatch("DEMO-LOT-001", "WBJC", now.minus(200, ChronoUnit.DAYS), now.minus(5, ChronoUnit.DAYS), "ACTIVE", null, null, false, "TX-2000-01-001");
        // 2. urgent 1d
        upsertBatch("DEMO-LOT-002", "KMGC", now.minus(89, ChronoUnit.DAYS), now.plus(1, ChronoUnit.DAYS), "ACTIVE", null, null, false, "TX-2000-01-002");
        // 3. urgent 7d
        upsertBatch("DEMO-LOT-003", "ABHJAM", now.minus(358, ChronoUnit.DAYS), now.plus(7, ChronoUnit.DAYS), "ACTIVE", null, null, false, "TX-2000-01-003");
        // 4. warning 8d
        upsertBatch("DEMO-LOT-004", "WBDRP", now.minus(262, ChronoUnit.DAYS), now.plus(8, ChronoUnit.DAYS), "ACTIVE", null, null, false, "TX-2000-01-004");
        // 5. warning 30d
        upsertBatch("DEMO-LOT-005", "KMGC", now.minus(60, ChronoUnit.DAYS), now.plus(30, ChronoUnit.DAYS), "ACTIVE", null, null, false, "TX-2000-01-005");
        // 6. ready 31d
        upsertBatch("DEMO-LOT-006", "WBJC", now.minus(149, ChronoUnit.DAYS), now.plus(31, ChronoUnit.DAYS), "ACTIVE", null, null, false, "TX-2000-01-006");
        // 7. ready later
        upsertBatch("DEMO-LOT-007", "RHSLT", now.minus(10, ChronoUnit.DAYS), now.plus(720, ChronoUnit.DAYS), "ACTIVE", null, null, false, "TX-2000-01-007");
        // 8. dispatched
        upsertBatch("DEMO-LOT-008", "ABHJAM", now.minus(200, ChronoUnit.DAYS), now.plus(165, ChronoUnit.DAYS), "DISPATCHED", "Demo Buyer A", now.minus(5, ChronoUnit.DAYS), false, "TX-2000-01-008");
        // 9. dispatched
        upsertBatch("DEMO-LOT-009", "WBJC", now.minus(50, ChronoUnit.DAYS), now.plus(130, ChronoUnit.DAYS), "DISPATCHED", "Demo Buyer B", now.minus(2, ChronoUnit.DAYS), false, "TX-2000-01-009");
        // 10. archived
        upsertBatch("DEMO-LOT-010", "KMGC", now.minus(100, ChronoUnit.DAYS), now.minus(10, ChronoUnit.DAYS), "ACTIVE", null, null, true, "TX-2000-01-010");
        // 11. ready 60d
        upsertBatch("DEMO-LOT-011", "WBDRP", now.minus(210, ChronoUnit.DAYS), now.plus(60, ChronoUnit.DAYS), "ACTIVE", null, null, false, "TX-2000-01-011");
        // 12. ready 90d
        upsertBatch("DEMO-LOT-012", "RHSLT", now.minus(640, ChronoUnit.DAYS), now.plus(90, ChronoUnit.DAYS), "ACTIVE", null, null, false, "TX-2000-01-012");
    }

    private void upsertBatch(String lotCode, String sku, Instant packDate, Instant expiryDate, String lifecycle, String buyerName, Instant dispatchDate, boolean isDeleted, String batchCode) {
        Optional<Product> opt = productRepository.findBySku(sku);
        if (opt.isEmpty()) {
            logger.warn("Skipping batch seed for " + lotCode + ", product not found: " + sku);
            return;
        }
        Product p = opt.get();
        
        org.springframework.data.mongodb.core.query.Query q = new org.springframework.data.mongodb.core.query.Query(
            org.springframework.data.mongodb.core.query.Criteria.where("sourceLotCode").is(lotCode)
        );
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
        
        long daysUntilExpiry = ChronoUnit.DAYS.between(clock.instant().atZone(ZoneId.of(businessTimezone)).toLocalDate(), expiryDate.atZone(ZoneId.of(businessTimezone)).toLocalDate());
        double riskBonus = 0;
        if ("HIGH".equals(p.getRiskLevel())) riskBonus = 100;
        else if ("MEDIUM".equals(p.getRiskLevel())) riskBonus = 50;
        batch.setPriorityScore(Math.max(0, 365 - daysUntilExpiry) + riskBonus);
        
        batch.setDispatchDate(dispatchDate);
        batch.setBuyerName(buyerName);
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
'''

last_brace = text.rfind('}')
text = text[:last_brace] + seed_methods + '\n}'

with open('backend/src/main/java/com/tracex/service/SeedRunner.java', 'w', encoding='utf-8') as f:
    f.write(text)
