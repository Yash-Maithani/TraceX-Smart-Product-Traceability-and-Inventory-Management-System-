package com.tracex;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tracex.model.AuditLog;
import com.tracex.model.Product;
import com.tracex.model.Role;
import com.tracex.model.User;
import com.tracex.repository.AuditLogRepository;
import com.tracex.repository.BatchRepository;
import com.tracex.repository.ProductRepository;
import com.tracex.repository.UserRepository;
import com.tracex.security.JwtService;
import com.tracex.service.SeedRunner;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Product catalogue: create and edit products (POST and PATCH /api/v1/products). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class ProductCatalogueTests {

    private static final String SKU_PREFIX = "PCT";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private ProductRepository productRepository;
    @Autowired private BatchRepository batchRepository;
    @Autowired private AuditLogRepository auditLogRepository;
    @Autowired private JwtService jwtService;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private SeedRunner seedRunner;

    @BeforeEach
    void setUp() {
        seedRunner.seedProducts();
        ensureUser("pct_manager", Role.MANAGER);
        ensureUser("pct_factory", Role.FACTORY_MANAGER);
    }

    @AfterEach
    void cleanUp() {
        batchRepository.findAll().stream()
                .filter(b -> "PCT-LOT".equals(b.getSourceLotCode()))
                .forEach(batchRepository::delete);
        productRepository.findAll().stream()
                .filter(p -> p.getSku() != null && p.getSku().startsWith(SKU_PREFIX))
                .forEach(productRepository::delete);
    }

    private void ensureUser(String username, Role role) {
        if (userRepository.findByUsername(username).isEmpty()) {
            User u = new User();
            u.setUsername(username);
            u.setEmail(username + "@example.com");
            u.setPasswordHash(passwordEncoder.encode("TestPass123456!"));
            u.setRole(role);
            u.setActive(true);
            u.setTokenVersion(1);
            userRepository.save(u);
        }
    }

    private String token(String username) {
        User u = userRepository.findByUsername(username).orElseThrow();
        return jwtService.generateToken(u.getId(), u.getTokenVersion());
    }

    private Map<String, Object> body(String sku, int shelfLifeDays) {
        Map<String, Object> m = new HashMap<>();
        m.put("productName", "Rhododendron Squash");
        m.put("sku", sku);
        m.put("category", "Beverages");
        m.put("shelfLifeDays", shelfLifeDays);
        m.put("riskLevel", "MEDIUM");
        m.put("ingredients", "Rhododendron flower extract, sugar, water, citric acid");
        m.put("allergens", List.of("None declared", " None declared "));
        m.put("storageInstructions", "Refrigerate after opening.");
        return m;
    }

    private JsonNode createAsManager(String sku, int days) throws Exception {
        String res = mockMvc.perform(post("/api/v1/products")
                        .header("Authorization", "Bearer " + token("pct_manager"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body(sku, days))))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(res).get("data");
    }

    @Test
    @DisplayName("A manager adds a product: SKU upper-cased, allergens de-duplicated, audit log written")
    void managerCreatesProduct() throws Exception {
        JsonNode created = createAsManager("pct-rsq", 240);
        assertThat(created.get("sku").asText()).isEqualTo("PCT-RSQ");
        assertThat(created.get("baseShelfLifeDays").asInt()).isEqualTo(240);
        assertThat(created.get("allergens").size()).isEqualTo(1);
        assertThat(created.get("storageInstructions").asText()).isEqualTo("Refrigerate after opening.");

        List<AuditLog> logs = auditLogRepository.findByTargetIdOrderByCreatedAtDesc(created.get("id").asText());
        assertThat(logs).anyMatch(l -> "PRODUCT_CREATED".equals(l.getAction()));
    }

    @Test
    @DisplayName("A duplicate SKU is refused with a field error on sku")
    void duplicateSkuRefused() throws Exception {
        createAsManager("PCT-DUP", 100);
        mockMvc.perform(post("/api/v1/products")
                        .header("Authorization", "Bearer " + token("pct_manager"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body("pct-dup", 100))))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("sku"));
    }

    @Test
    @DisplayName("Out-of-range shelf life and unknown risk level fail validation")
    void invalidValuesRefused() throws Exception {
        Map<String, Object> bad = body("PCT-BAD", 0);
        bad.put("riskLevel", "EXTREME");
        mockMvc.perform(post("/api/v1/products")
                        .header("Authorization", "Bearer " + token("pct_manager"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(bad)))
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    @DisplayName("A factory manager cannot add products")
    void factoryManagerForbidden() throws Exception {
        mockMvc.perform(post("/api/v1/products")
                        .header("Authorization", "Bearer " + token("pct_factory"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body("PCT-FM", 100))))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Editing changes the shelf life new batches get, and the SKU cannot change")
    void editShelfLifeAndKeepSku() throws Exception {
        JsonNode created = createAsManager("PCT-EDT", 100);
        String id = created.get("id").asText();

        Map<String, Object> edit = body("PCT-EDT", 30);
        mockMvc.perform(patch("/api/v1/products/" + id)
                        .header("Authorization", "Bearer " + token("pct_manager"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(edit)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.baseShelfLifeDays").value(30));

        Map<String, Object> batch = Map.of(
                "productId", id, "sourceLotCode", "PCT-LOT", "farmerName", "Test Farmer", "village", "Pauri",
                "quantityProduced", 10, "unit", "Units", "yieldPercent", 90.0, "packDate", "2026-10-01");
        mockMvc.perform(post("/api/v1/batches")
                        .header("Authorization", "Bearer " + token("pct_manager"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(batch)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.expiryDate").value(LocalDate.of(2026, 10, 31).toString()));

        Map<String, Object> skuChange = body("PCT-NEW", 30);
        mockMvc.perform(patch("/api/v1/products/" + id)
                        .header("Authorization", "Bearer " + token("pct_manager"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(skuChange)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("sku"));

        Product saved = productRepository.findById(id).orElseThrow();
        assertThat(saved.getSku()).isEqualTo("PCT-EDT");
    }

    @Test
    @DisplayName("Seeding again does not undo a catalogue edit")
    void seedDoesNotOverwriteEdits() {
        Product jam = productRepository.findBySku("ABHJAM").orElseThrow();
        Integer original = jam.getBaseShelfLifeDays();
        jam.setBaseShelfLifeDays(original + 1);
        productRepository.save(jam);
        try {
            seedRunner.seedProducts();
            assertThat(productRepository.findBySku("ABHJAM").orElseThrow().getBaseShelfLifeDays()).isEqualTo(original + 1);
        } finally {
            jam = productRepository.findBySku("ABHJAM").orElseThrow();
            jam.setBaseShelfLifeDays(original);
            productRepository.save(jam);
        }
    }
}
