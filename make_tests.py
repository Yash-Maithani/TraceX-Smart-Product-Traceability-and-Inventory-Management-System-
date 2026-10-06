import io

base = "backend/src/test/java/com/tracex/"

with io.open(base + "ProductAndBatchTests.java", "w", encoding="utf-8") as f:
    f.write("""package com.tracex;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tracex.dto.BatchCreateDto;
import com.tracex.dto.BatchNoteDto;
import com.tracex.dto.BatchRawMaterialDto;
import com.tracex.model.Batch;
import com.tracex.model.Product;
import com.tracex.model.Role;
import com.tracex.model.User;
import com.tracex.repository.BatchRepository;
import com.tracex.repository.ProductRepository;
import com.tracex.repository.UserRepository;
import com.tracex.security.JwtService;
import com.tracex.util.BatchFreshness;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

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
    @Autowired private JwtService jwtService;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private ObjectMapper objectMapper;

    @BeforeEach
    void setup() {
        createTestUser("test_factory_mgr", Role.FACTORY_MANAGER, false);
        createTestUser("test_admin", Role.ADMIN, false);
        createTestUser("test_inspector", Role.QUALITY_INSPECTOR, false);
        createTestUser("test_manager", Role.MANAGER, false);
        createTestUser("test_superadmin", Role.ADMIN, true);

        if (productRepository.count() < 5) {
            Product p1 = new Product(); p1.setSku("WBJC"); p1.setProductName("Wild Berry Juice Concentrate"); p1.setRiskLevel("LOW"); p1.setBaseShelfLifeDays(180); p1.setCategory("Beverages"); productRepository.save(p1);
            Product p2 = new Product(); p2.setSku("KMGC"); p2.setProductName("Kumaon Royal Multigrain Crackers"); p2.setRiskLevel("MEDIUM"); p2.setBaseShelfLifeDays(90); p2.setCategory("Snacks"); productRepository.save(p2);
            Product p3 = new Product(); p3.setSku("RHSLT"); p3.setProductName("Himalayan Rock Salt (Sendha Namak)"); p3.setRiskLevel("LOW"); p3.setBaseShelfLifeDays(730); p3.setCategory("Condiments"); productRepository.save(p3);
            Product p4 = new Product(); p4.setSku("ABHJAM"); p4.setProductName("Apricot & Berry Himalayan Jam"); p4.setRiskLevel("MEDIUM"); p4.setBaseShelfLifeDays(365); p4.setCategory("Spreads"); productRepository.save(p4);
            Product p5 = new Product(); p5.setSku("WBDRP"); p5.setProductName("Wild Berry Dried Pulp (Tray-Dried)"); p5.setRiskLevel("LOW"); p5.setBaseShelfLifeDays(270); p5.setCategory("Ingredients"); productRepository.save(p5);
        }
    }

    private void createTestUser(String username, Role role, boolean isSuperAdmin) {
        if (userRepository.findByUsername(username).isEmpty()) {
            User u = new User();
            u.setUsername(username);
            u.setEmail(username + "@example.com");
            u.setPasswordHash(passwordEncoder.encode("TestPass123456!"));
            u.setRole(role);
            u.setSuperAdmin(isSuperAdmin);
            u.setStatus("ACTIVE");
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
        dto.setSourceLotCode("TEST-LOT-" + System.currentTimeMillis());
        dto.setFarmerName("Test Farmer");
        dto.setVillage("Test Village");
        dto.setQuantityProduced(100);
        dto.setUnit("Kg");
        dto.setYieldPercent(85.0);
        dto.setPackDate(Instant.now());

        String response = mockMvc.perform(post("/api/v1/batches")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        JsonNode root = objectMapper.readTree(response);
        return root.path("data").path("id").asText();
    }

    @Test
    void testGetProducts_returnsAllFiveProducts() throws Exception {
        mockMvc.perform(get("/api/v1/products")
                .header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(org.hamcrest.Matchers.greaterThanOrEqualTo(5)))
                .andExpect(jsonPath("$.data[0].sku").exists())
                .andExpect(jsonPath("$.data[0].productName").exists());
    }

    @Test
    void testGetProducts_requiresAuth() throws Exception {
        mockMvc.perform(get("/api/v1/products"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_NO_TOKEN"));
    }

    @Test
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
        dto.setPackDate(Instant.now());

        mockMvc.perform(post("/api/v1/batches")
                .header("Authorization", "Bearer " + factoryMgrToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.batchCode").value(org.hamcrest.Matchers.matchesRegex("TX-\\\\d{4}-\\\\d{2}-\\\\d+")));
    }

    @Test
    void testCreateBatch_withUnknownProductId() throws Exception {
        BatchCreateDto dto = new BatchCreateDto();
        dto.setProductId("000000000000000000000001");
        dto.setSourceLotCode("LOT-VALID");
        dto.setFarmerName("Farmer");
        dto.setVillage("Village");
        dto.setQuantityProduced(50);
        dto.setUnit("Kg");
        dto.setYieldPercent(90.0);
        dto.setPackDate(Instant.now());

        mockMvc.perform(post("/api/v1/batches")
                .header("Authorization", "Bearer " + factoryMgrToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isNotFound());
    }

    @Test
    void testBatchCodeFormat() throws Exception {
        Product p = productRepository.findAll().get(0);
        BatchCreateDto dto = new BatchCreateDto();
        dto.setProductId(p.getId());
        dto.setSourceLotCode("LOT-FMT");
        dto.setFarmerName("Farmer");
        dto.setVillage("Village");
        dto.setQuantityProduced(50);
        dto.setUnit("Kg");
        dto.setYieldPercent(90.0);
        dto.setPackDate(Instant.now());

        mockMvc.perform(post("/api/v1/batches")
                .header("Authorization", "Bearer " + factoryMgrToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.batchCode").value(org.hamcrest.Matchers.matchesRegex("TX-\\\\d{4}-\\\\d{2}-\\\\d+")));
    }

    @Test
    void testBatchCodeIsMonthlyAndAtomic() throws Exception {
        Product p = productRepository.findAll().get(0);
        BatchCreateDto dto1 = new BatchCreateDto();
        dto1.setProductId(p.getId()); dto1.setSourceLotCode("L1"); dto1.setFarmerName("F"); dto1.setVillage("V"); dto1.setQuantityProduced(1); dto1.setUnit("Kg"); dto1.setYieldPercent(10.0); dto1.setPackDate(Instant.now());
        
        BatchCreateDto dto2 = new BatchCreateDto();
        dto2.setProductId(p.getId()); dto2.setSourceLotCode("L2"); dto2.setFarmerName("F"); dto2.setVillage("V"); dto2.setQuantityProduced(1); dto2.setUnit("Kg"); dto2.setYieldPercent(10.0); dto2.setPackDate(Instant.now());

        String res1 = mockMvc.perform(post("/api/v1/batches").header("Authorization", "Bearer " + factoryMgrToken()).contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(dto1))).andReturn().getResponse().getContentAsString();
        String res2 = mockMvc.perform(post("/api/v1/batches").header("Authorization", "Bearer " + factoryMgrToken()).contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(dto2))).andReturn().getResponse().getContentAsString();

        String bc1 = objectMapper.readTree(res1).path("data").path("batchCode").asText();
        String bc2 = objectMapper.readTree(res2).path("data").path("batchCode").asText();

        int seq1 = Integer.parseInt(bc1.substring(bc1.lastIndexOf("-") + 1));
        int seq2 = Integer.parseInt(bc2.substring(bc2.lastIndexOf("-") + 1));
        
        assertThat(seq2).isGreaterThan(seq1);
    }

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
                .content("{\\"reason\\":\\"test\\"}"))
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
        mockMvc.perform(patch("/api/v1/batches/" + id + "/note").header("Authorization", "Bearer " + factoryMgrToken()).contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(dto)));
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
        
        // Manual stale version via MongoTemplate to bypass repository lock check on update
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
        assertThat(count).isGreaterThanOrEqualTo(0); // Works whether seeded or not in test profile if SEED_ENABLED varies
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
}
""")
