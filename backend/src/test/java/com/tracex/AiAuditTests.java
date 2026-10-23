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
 * Phase 11: AI dispatch audit (S-01). Both providers are mocks, so no test calls the internet or needs a key.
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
              "urgentBatches": [{"batchCode": "TX-AI-URG", "reason": "Expires in 2 days"},
                                {"batchCode": "TX-MADE-UP", "reason": "Invented by the model"}],
              "qualityWarnings": [{"batchCode": "TX-AI-LOW", "concern": "Yield 55%"}],
              "top3Priorities": [{"rank": 1, "batchCode": "TX-AI-EXP", "productName": "x", "action": "Dispatch", "reasoning": "Expired"},
                                 {"rank": 2, "batchCode": "TX-AI-URG", "productName": "x", "action": "Dispatch today", "reasoning": "Shortest shelf life"}],
              "supplyChainRisks": [{"risk": "One village supplies most honey", "severity": "high", "recommendation": "Add suppliers"},
                                   {"risk": "Odd severity", "severity": "SEVERE", "recommendation": "n/a"}],
              "summary": "Dispatch TX-AI-URG first."
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
        saveBatch("TX-AI-URG", 2, 90);
        saveBatch("TX-AI-LOW", 20, 55);
        saveBatch("TX-AI-EXP", -1, 90);
    }

    @AfterEach
    void tearDown() {
        batchRepository.deleteAllById(batchIds);
        userRepository.deleteAllById(userIds);
        aiAuditService.clearCache();
        rateLimiter.resetAll();
    }

    private void saveBatch(String code, int daysToExpiry, double yield) {
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
        batchIds.add(batchRepository.save(b).getId());
    }

    private String bearer() {
        return "Bearer " + jwtService.generateToken(manager.getId(), manager.getTokenVersion());
    }

    @Test
    @DisplayName("Without any key the status says disabled and the audit answers 503 AI_UNAVAILABLE")
    void disabledWithoutKeys() throws Exception {
        when(gemini.isConfigured()).thenReturn(false);
        when(nvidia.isConfigured()).thenReturn(false);

        mockMvc.perform(get("/api/v1/ai/status").header("Authorization", bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.enabled").value(false));
        mockMvc.perform(post("/api/v1/ai/dispatch-audit").header("Authorization", bearer()))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("AI_UNAVAILABLE"));
    }

    @Test
    @DisplayName("Gemini answers: the prompt has village but no farmer name, and invented or expired picks are dropped")
    void geminiReportIsCleaned() throws Exception {
        when(gemini.isConfigured()).thenReturn(true);
        when(gemini.complete(anyString())).thenReturn("```json\n" + GOOD_JSON + "\n```");

        String body = mockMvc.perform(post("/api/v1/ai/dispatch-audit").header("Authorization", bearer()))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        JsonNode report = objectMapper.readTree(body).get("data");

        ArgumentCaptor<String> prompt = ArgumentCaptor.forClass(String.class);
        verify(gemini).complete(prompt.capture());
        assertThat(prompt.getValue()).contains("TX-AI-URG").contains("Almora").doesNotContain("SecretFarmerAI").doesNotContain("farmerName");

        assertThat(report.get("provider").asText()).isEqualTo("gemini");
        assertThat(report.get("fromCache").asBoolean()).isFalse();
        assertThat(report.get("urgentBatches")).hasSize(1);
        assertThat(report.at("/urgentBatches/0/batchCode").asText()).isEqualTo("TX-AI-URG");
        assertThat(report.get("top3Priorities")).hasSize(1); // the expired batch is never a dispatch pick
        assertThat(report.at("/top3Priorities/0/rank").asInt()).isEqualTo(1);
        assertThat(report.at("/top3Priorities/0/productName").asText()).isEqualTo("AI Test Honey");
        assertThat(report.at("/supplyChainRisks/0/severity").asText()).isEqualTo("HIGH");
        assertThat(report.at("/supplyChainRisks/1/severity").asText()).isEqualTo("MEDIUM");
        verify(nvidia, never()).complete(anyString());
    }

    @Test
    @DisplayName("Gemini fails: NVIDIA answers instead; both fail: 503 without any provider detail in the response")
    void fallbackAndTotalFailure() throws Exception {
        when(gemini.isConfigured()).thenReturn(true);
        when(nvidia.isConfigured()).thenReturn(true);
        when(gemini.complete(anyString())).thenThrow(new IllegalStateException("Gemini returned HTTP 429 secret-detail"));
        when(nvidia.complete(anyString())).thenReturn(GOOD_JSON);

        mockMvc.perform(post("/api/v1/ai/dispatch-audit").header("Authorization", bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.provider").value("nvidia"));

        aiAuditService.clearCache();
        when(nvidia.complete(anyString())).thenThrow(new IllegalStateException("NVIDIA returned HTTP 500 secret-detail"));
        String body = mockMvc.perform(post("/api/v1/ai/dispatch-audit").header("Authorization", bearer()))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("AI_UNAVAILABLE"))
                .andReturn().getResponse().getContentAsString();
        assertThat(body).doesNotContain("secret-detail");
    }

    @Test
    @DisplayName("A second call is served from the cache; refresh=true asks the provider again")
    void cacheAndRefresh() throws Exception {
        when(gemini.isConfigured()).thenReturn(true);
        when(gemini.complete(anyString())).thenReturn(GOOD_JSON);

        mockMvc.perform(post("/api/v1/ai/dispatch-audit").header("Authorization", bearer())).andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/ai/dispatch-audit").header("Authorization", bearer()))
                .andExpect(jsonPath("$.data.fromCache").value(true));
        verify(gemini, times(1)).complete(anyString());

        mockMvc.perform(post("/api/v1/ai/dispatch-audit?refresh=true").header("Authorization", bearer()))
                .andExpect(jsonPath("$.data.fromCache").value(false));
        verify(gemini, times(2)).complete(anyString());
    }

    @Test
    @DisplayName("Unreadable model output is a 503, not a 500")
    void unparseableOutput() throws Exception {
        when(gemini.isConfigured()).thenReturn(true);
        when(gemini.complete(anyString())).thenReturn("Sure! Here is my analysis in prose.");
        mockMvc.perform(post("/api/v1/ai/dispatch-audit").header("Authorization", bearer()))
                .andExpect(status().isServiceUnavailable());
    }

    @Test
    @DisplayName("Each user may run the audit 5 times per 15 minutes; the 6th is 429")
    void perUserRateLimit() throws Exception {
        when(gemini.isConfigured()).thenReturn(true);
        when(gemini.complete(anyString())).thenReturn(GOOD_JSON);
        for (int i = 0; i < 5; i++) {
            mockMvc.perform(post("/api/v1/ai/dispatch-audit").header("Authorization", bearer())).andExpect(status().isOk());
        }
        mockMvc.perform(post("/api/v1/ai/dispatch-audit").header("Authorization", bearer()))
                .andExpect(status().isTooManyRequests());
    }
}
