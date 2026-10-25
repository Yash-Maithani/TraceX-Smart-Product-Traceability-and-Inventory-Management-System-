package com.tracex;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tracex.model.Batch;
import com.tracex.model.Product;
import com.tracex.model.Role;
import com.tracex.model.User;
import com.tracex.repository.BatchRepository;
import com.tracex.repository.ProductRepository;
import com.tracex.repository.UserRepository;
import com.tracex.security.JwtService;
import com.tracex.security.RateLimiter;
import com.tracex.service.ai.GeminiProvider;
import com.tracex.service.ai.NvidiaProvider;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * AI phase: Ask TraceX (question to a checked filter) and the inspection assistant (notes to a draft).
 * The model is a mock; the tests prove the server checks everything it proposes.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class AiAskAndDraftTests {

    private static final String SKU = "AIASK-JAM";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private BatchRepository batchRepository;
    @Autowired private ProductRepository productRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtService jwtService;
    @Autowired private RateLimiter rateLimiter;

    @MockBean private GeminiProvider gemini;
    @MockBean private NvidiaProvider nvidia;

    private final List<String> userIds = new ArrayList<>();
    private final List<String> batchIds = new ArrayList<>();
    private String productId;
    private User coordinator;
    private User inspector;

    @BeforeEach
    void setUp() {
        rateLimiter.resetAll();
        when(gemini.name()).thenReturn("gemini");
        when(nvidia.name()).thenReturn("nvidia");
        when(gemini.isConfigured()).thenReturn(true);
        when(nvidia.isConfigured()).thenReturn(false);

        Product p = new Product();
        p.setSku(SKU);
        p.setProductName("Ask Apricot Jam");
        p.setCategory("Preserves");
        p.setBaseShelfLifeDays(180);
        p.setRiskLevel("LOW");
        productId = productRepository.save(p).getId();

        coordinator = user("aiaskcoord", Role.DISPATCH_COORDINATOR);
        inspector = user("aiaskinsp", Role.QUALITY_INSPECTOR);

        saveBatch("TX-ASK-SOON", 3, null);
        saveBatch("TX-ASK-SOON-OK", 4, "PASSED");
        saveBatch("TX-ASK-LATER", 60, null);
    }

    @AfterEach
    void tearDown() {
        batchRepository.deleteAllById(batchIds);
        userRepository.deleteAllById(userIds);
        productRepository.deleteById(productId);
        rateLimiter.resetAll();
    }

    private User user(String username, Role role) {
        User u = new User(username, passwordEncoder.encode("TestPass123456!"), username, username + "@example.com", role, false);
        u.setEmailVerified(true);
        User saved = userRepository.save(u);
        userIds.add(saved.getId());
        return saved;
    }

    private void saveBatch(String code, int daysToExpiry, String verdict) {
        Batch b = new Batch();
        b.setBatchCode(code);
        b.setSku(SKU);
        b.setProductName("Ask Apricot Jam");
        b.setFarmerName("SecretFarmerAsk");
        b.setVillage("Ranikhet");
        b.setQuantityProduced(40);
        b.setUnit("Kg");
        b.setYieldPercent(90);
        b.setDataSource("predicted");
        b.setPackDate(LocalDate.now().minusDays(5));
        b.setExpiryDate(LocalDate.now().plusDays(daysToExpiry));
        b.setLifecycleState("ACTIVE");
        if (verdict != null) b.setQualityCheck(new Batch.QualityCheck(verdict, 5, Instant.now(), "Inspector"));
        batchIds.add(batchRepository.save(b).getId());
    }

    private String bearer(User u) {
        return "Bearer " + jwtService.generateToken(u.getId(), u.getTokenVersion());
    }

    private JsonNode ask(String question) throws Exception {
        String body = mockMvc.perform(post("/api/v1/ai/ask").header("Authorization", bearer(coordinator))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(java.util.Map.of("question", question))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("data");
    }

    @Test
    @DisplayName("Ask: the model's filter is checked, the server runs it, and the answer only holds real matching batches")
    void askRunsACheckedFilter() throws Exception {
        String today = LocalDate.now().toString();
        String inAWeek = LocalDate.now().plusDays(7).toString();
        when(gemini.complete(anyString())).thenReturn("""
                {"statuses": ["URGENT", "BOGUS"], "sku": "aiask-jam", "search": null,
                 "expiryFrom": "%s", "expiryTo": "%s", "verdict": "NONE"}""".formatted(today, inAWeek));

        JsonNode answer = ask("Which apricot jam batches expire this week and are not inspected?");
        ArgumentCaptor<String> prompt = ArgumentCaptor.forClass(String.class);
        verify(gemini).complete(prompt.capture());
        assertThat(prompt.getValue()).contains(SKU).doesNotContain("SecretFarmerAsk");

        assertThat(answer.at("/filter/statuses")).hasSize(1); // BOGUS dropped
        assertThat(answer.at("/filter/sku").asText()).isEqualTo(SKU); // matched to the real SKU
        assertThat(answer.get("total").asLong()).isEqualTo(1);
        assertThat(answer.at("/batches/0/batchCode").asText()).isEqualTo("TX-ASK-SOON");
        assertThat(answer.get("description").asText()).contains("expiring soon").contains("Ask Apricot Jam").contains("not inspected");
        assertThat(answer.get("provider").asText()).isEqualTo("gemini");
    }

    @Test
    @DisplayName("Ask: an unknown SKU, bad dates and an unknown verdict are ignored instead of trusted")
    void askIgnoresUnknownValues() throws Exception {
        when(gemini.complete(anyString())).thenReturn("""
                {"statuses": [], "sku": "NOT-A-SKU", "search": null, "expiryFrom": "tomorrow", "expiryTo": null, "verdict": "MAYBE"}""");
        JsonNode answer = ask("show me everything");
        assertThat(answer.at("/filter/sku").isNull()).isTrue();
        assertThat(answer.at("/filter/expiryFrom").isNull()).isTrue();
        assertThat(answer.at("/filter/verdict").isNull()).isTrue();
        assertThat(answer.get("description").asText()).isEqualTo("Batches.");
    }

    @Test
    @DisplayName("Ask: an empty question is 422, no key is 503, and the 21st question in 15 minutes is 429")
    void askLimits() throws Exception {
        mockMvc.perform(post("/api/v1/ai/ask").header("Authorization", bearer(coordinator))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"question\": \"  \"}"))
                .andExpect(status().isUnprocessableEntity());

        when(gemini.isConfigured()).thenReturn(false);
        mockMvc.perform(post("/api/v1/ai/ask").header("Authorization", bearer(coordinator))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"question\": \"expired batches\"}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("AI_UNAVAILABLE"));

        when(gemini.isConfigured()).thenReturn(true);
        when(gemini.complete(anyString())).thenReturn("{\"statuses\": [\"EXPIRED\"]}");
        rateLimiter.resetAll();
        for (int i = 0; i < 20; i++) ask("expired batches");
        mockMvc.perform(post("/api/v1/ai/ask").header("Authorization", bearer(coordinator))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"question\": \"expired batches\"}"))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    @DisplayName("Draft: the 8 fixed checks always come back, unmentioned checks stay null, and Passed with a failed check becomes Flagged")
    void draftIsCorrected() throws Exception {
        when(gemini.complete(anyString())).thenReturn("""
                {"checklist": [
                   {"label": "Packaging integrity", "passed": false, "note": "Cap seal broken on 3 of 20 jars"},
                   {"label": "Label accuracy & legibility", "passed": true, "note": ""},
                   {"label": "Made up check", "passed": true, "note": "ignored"}],
                 "verdict": "PASSED", "rating": 9, "findings": "Three jars had broken seals.", "recommendation": "Re-seal or reject the affected jars."}""");

        String body = mockMvc.perform(post("/api/v1/ai/inspection-draft").header("Authorization", bearer(inspector))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"notes\": \"Cap seal broken on 3 of 20 jars, labels fine.\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        JsonNode draft = objectMapper.readTree(body).get("data");

        assertThat(draft.get("checklist")).hasSize(8);
        assertThat(draft.at("/checklist/0/label").asText()).isEqualTo("Packaging integrity");
        assertThat(draft.at("/checklist/0/passed").asBoolean()).isFalse();
        assertThat(draft.at("/checklist/1/passed").asBoolean()).isTrue();
        assertThat(draft.at("/checklist/2/passed").isNull()).isTrue();
        assertThat(draft.get("verdict").asText()).isEqualTo("FLAGGED");
        assertThat(draft.get("rating").asInt()).isEqualTo(5);
        assertThat(draft.get("adjustments").toString()).contains("Changed Passed to Flagged");
        assertThat(draft.get("provider").asText()).isEqualTo("gemini");
    }

    @Test
    @DisplayName("Draft: only inspectors and admins may ask (dispatch coordinator 403), and short notes are 422")
    void draftAccessAndValidation() throws Exception {
        mockMvc.perform(post("/api/v1/ai/inspection-draft").header("Authorization", bearer(coordinator))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"notes\": \"Everything looked fine today.\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/ai/inspection-draft").header("Authorization", bearer(inspector))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"notes\": \"ok\"}"))
                .andExpect(status().isUnprocessableEntity());
        verify(gemini, never()).complete(anyString());
    }
}
