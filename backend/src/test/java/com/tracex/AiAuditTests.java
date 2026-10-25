package com.tracex;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tracex.model.Batch;
import com.tracex.model.Role;
import com.tracex.model.User;
import com.tracex.repository.BatchRepository;
import com.tracex.repository.UserRepository;
import com.tracex.security.JwtService;
import com.tracex.security.RateLimiter;
import com.tracex.service.ai.AiAuditService;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Dispatch advisor (Phase 11, reworked in the AI phase). Facts come from rules and work without a key;
 * the model only adds a summary and risks. Both providers are mocks, so no test calls the internet.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class AiAuditTests {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private BatchRepository batchRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtService jwtService;
    @Autowired private RateLimiter rateLimiter;
    @Autowired private AiAuditService aiAuditService;

    @MockBean private GeminiProvider gemini;
    @MockBean private NvidiaProvider nvidia;

    private final List<String> userIds = new ArrayList<>();
    private final List<String> batchIds = new ArrayList<>();
    private User manager;

    private static final String GOOD_JSON = """
            {
              "summary": "TX-AI-URG expires first; one batch is on hold.",
              "risks": [{"risk": "All honey comes from Almora", "severity": "high", "recommendation": "Add a second village"},
                        {"risk": "Odd severity", "severity": "SEVERE", "recommendation": "n/a"},
                        {"risk": "TX-MADE-UP is risky", "severity": "LOW", "recommendation": "Invented batch"}]
            }""";

    @BeforeEach
    void setUp() {
        rateLimiter.resetAll();
        aiAuditService.clearCache();
        when(gemini.name()).thenReturn("gemini");
        when(nvidia.name()).thenReturn("nvidia");
        User u = new User("ai11manager", passwordEncoder.encode("TestPass123456!"), "AI Manager", "ai11@example.com", Role.MANAGER, false);
        u.setEmailVerified(true);
        manager = userRepository.save(u);
        userIds.add(manager.getId());
        saveBatch("TX-AI-HOLD", 1, 90, "FAILED");
        saveBatch("TX-AI-URG", 2, 90, null);
        saveBatch("TX-AI-LOW", 20, 55, "PASSED");
        saveBatch("TX-AI-EXP", -1, 90, null);
    }

    @AfterEach
    void tearDown() {
        batchRepository.deleteAllById(batchIds);
        userRepository.deleteAllById(userIds);
        aiAuditService.clearCache();
        rateLimiter.resetAll();
    }

    private void saveBatch(String code, int daysToExpiry, double yield, String verdict) {
        Batch b = new Batch();
        b.setBatchCode(code);
        b.setSku("AI-SKU");
        b.setProductName("AI Test Honey");
        b.setFarmerName("SecretFarmerAI");
        b.setVillage("Almora");
        b.setQuantityProduced(50);
        b.setUnit("Kg");
        b.setYieldPercent(yield);
        b.setDataSource("predicted");
        b.setPackDate(LocalDate.now().minusDays(10));
        b.setExpiryDate(LocalDate.now().plusDays(daysToExpiry));
        b.setLifecycleState("ACTIVE");
        if (verdict != null) b.setQualityCheck(new Batch.QualityCheck(verdict, 3, Instant.now(), "Inspector"));
        batchIds.add(batchRepository.save(b).getId());
    }

    private String bearer() {
        return "Bearer " + jwtService.generateToken(manager.getId(), manager.getTokenVersion());
    }

    private JsonNode advise(String query) throws Exception {
        String body = mockMvc.perform(post("/api/v1/ai/dispatch-audit" + query).header("Authorization", bearer()))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("data");
    }

    private static List<String> codes(JsonNode list) {
        List<String> out = new ArrayList<>();
        list.forEach(n -> out.add(n.get("batchCode").asText()));
        return out;
    }

    @Test
    @DisplayName("Without any key the facts still come back from the rules; the AI part is marked off")
    void factsWithoutKeys() throws Exception {
        when(gemini.isConfigured()).thenReturn(false);
        when(nvidia.isConfigured()).thenReturn(false);

        mockMvc.perform(get("/api/v1/ai/status").header("Authorization", bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.enabled").value(false));

        JsonNode advice = advise("");
        assertThat(advice.get("aiNote").asText()).isEqualTo("off");
        assertThat(advice.get("ai").isNull()).isTrue();
        // The held batch expires first but is skipped; the next batch of the product is the pick
        assertThat(codes(advice.get("nextToShip"))).contains("TX-AI-URG").doesNotContain("TX-AI-HOLD", "TX-AI-EXP");
        assertThat(codes(advice.get("onHold"))).contains("TX-AI-HOLD");
        assertThat(codes(advice.get("urgent"))).contains("TX-AI-URG", "TX-AI-HOLD");
        assertThat(codes(advice.get("expired"))).contains("TX-AI-EXP");
        assertThat(codes(advice.get("qualityWarnings"))).contains("TX-AI-LOW");
        verify(gemini, never()).complete(anyString());
    }

    @Test
    @DisplayName("Gemini adds a summary and risks: the prompt has village and verdicts but no farmer name; invented codes are dropped")
    void insightIsChecked() throws Exception {
        when(gemini.isConfigured()).thenReturn(true);
        when(gemini.complete(anyString())).thenReturn("```json\n" + GOOD_JSON + "\n```");

        JsonNode advice = advise("");
        ArgumentCaptor<String> prompt = ArgumentCaptor.forClass(String.class);
        verify(gemini).complete(prompt.capture());
        assertThat(prompt.getValue()).contains("TX-AI-URG").contains("Almora").contains("FAILED")
                .doesNotContain("SecretFarmerAI").doesNotContain("farmerName");

        JsonNode ai = advice.get("ai");
        assertThat(advice.get("aiNote").isNull()).isTrue();
        assertThat(ai.get("provider").asText()).isEqualTo("gemini");
        assertThat(ai.get("summary").asText()).contains("TX-AI-URG");
        assertThat(ai.get("risks")).hasSize(2); // the risk naming TX-MADE-UP is dropped
        assertThat(ai.at("/risks/0/severity").asText()).isEqualTo("HIGH");
        assertThat(ai.at("/risks/1/severity").asText()).isEqualTo("MEDIUM");
        verify(nvidia, never()).complete(anyString());
    }

    @Test
    @DisplayName("ai=false returns the facts without a model call; once an insight exists it comes back from the cache")
    void factsOnlyMode() throws Exception {
        when(gemini.isConfigured()).thenReturn(true);
        when(gemini.complete(anyString())).thenReturn(GOOD_JSON);

        JsonNode factsOnly = advise("?ai=false");
        assertThat(factsOnly.get("aiNote").asText()).isEqualTo("not-requested");
        assertThat(codes(factsOnly.get("nextToShip"))).contains("TX-AI-URG");
        verify(gemini, never()).complete(anyString());

        advise("");
        assertThat(advise("?ai=false").at("/ai/fromCache").asBoolean()).isTrue();
        verify(gemini, times(1)).complete(anyString());
    }

    @Test
    @DisplayName("Gemini fails: NVIDIA answers; both fail: the facts still come back with aiNote unavailable and no provider detail")
    void fallbackAndTotalFailure() throws Exception {
        when(gemini.isConfigured()).thenReturn(true);
        when(nvidia.isConfigured()).thenReturn(true);
        when(gemini.complete(anyString())).thenThrow(new IllegalStateException("Gemini returned HTTP 429 secret-detail"));
        when(nvidia.complete(anyString())).thenReturn(GOOD_JSON);
        assertThat(advise("").at("/ai/provider").asText()).isEqualTo("nvidia");

        aiAuditService.clearCache();
        when(nvidia.complete(anyString())).thenThrow(new IllegalStateException("NVIDIA returned HTTP 500 secret-detail"));
        String body = mockMvc.perform(post("/api/v1/ai/dispatch-audit").header("Authorization", bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.aiNote").value("unavailable"))
                .andReturn().getResponse().getContentAsString();
        assertThat(body).doesNotContain("secret-detail").contains("TX-AI-URG");
    }

    @Test
    @DisplayName("The insight is reused while the data is unchanged; a change in the batches or refresh=true asks again")
    void cacheFollowsTheData() throws Exception {
        when(gemini.isConfigured()).thenReturn(true);
        when(gemini.complete(anyString())).thenReturn(GOOD_JSON);

        advise("");
        assertThat(advise("").at("/ai/fromCache").asBoolean()).isTrue();
        verify(gemini, times(1)).complete(anyString());

        saveBatch("TX-AI-NEW", 40, 90, null); // new stock changes the fingerprint
        assertThat(advise("").at("/ai/fromCache").asBoolean()).isFalse();
        verify(gemini, times(2)).complete(anyString());

        assertThat(advise("?refresh=true").at("/ai/fromCache").asBoolean()).isFalse();
        verify(gemini, times(3)).complete(anyString());
    }

    @Test
    @DisplayName("Unreadable model output or a summary naming an unknown batch leaves the facts and marks the AI unavailable")
    void unparseableOutput() throws Exception {
        when(gemini.isConfigured()).thenReturn(true);
        when(gemini.complete(anyString())).thenReturn("Sure! Here is my analysis in prose.");
        assertThat(advise("").get("aiNote").asText()).isEqualTo("unavailable");

        when(gemini.complete(anyString())).thenReturn("{\"summary\": \"Ship TX-NOT-REAL now\", \"risks\": []}");
        assertThat(advise("?refresh=true").get("aiNote").asText()).isEqualTo("unavailable");
    }

    @Test
    @DisplayName("Each user may ask the model 5 times per 15 minutes; after that the facts still come back with aiNote limit")
    void perUserRateLimit() throws Exception {
        when(gemini.isConfigured()).thenReturn(true);
        when(gemini.complete(anyString())).thenReturn(GOOD_JSON);
        for (int i = 0; i < 5; i++) {
            advise("?refresh=true");
        }
        JsonNode sixth = advise("?refresh=true");
        assertThat(sixth.get("aiNote").asText()).isEqualTo("limit");
        assertThat(sixth.get("nextToShip").size()).isGreaterThan(0);
        verify(gemini, times(5)).complete(anyString());
    }
}
