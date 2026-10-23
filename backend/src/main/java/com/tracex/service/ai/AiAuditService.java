package com.tracex.service.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tracex.dto.AiAuditDtos.AiStatus;
import com.tracex.dto.AiAuditDtos.AuditReport;
import com.tracex.dto.AiAuditDtos.Priority;
import com.tracex.dto.AiAuditDtos.QualityWarning;
import com.tracex.dto.AiAuditDtos.SupplyChainRisk;
import com.tracex.dto.AiAuditDtos.UrgentBatch;
import com.tracex.dto.BatchSummaryDto;
import com.tracex.exception.ApiException;
import com.tracex.exception.ErrorCode;
import com.tracex.exception.RateLimitException;
import com.tracex.model.User;
import com.tracex.security.RateLimiter;
import com.tracex.service.FefoService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * AI dispatch audit (Phase 11, S-01), ported from the reference `aiService.js`.
 *
 * Privacy (D-9): batches are sent with `village` but never `farmerName`. Hardening over the reference:
 * the model's answer is checked against the input, so a batch code the model invents is dropped;
 * text is length-capped; the rate limit is per user (the reference used per IP); provider errors and
 * raw model output are never logged or returned, only the exception class.
 */
@Service
public class AiAuditService {

    private static final Logger log = LoggerFactory.getLogger(AiAuditService.class);
    private static final Duration RATE_WINDOW = Duration.ofMinutes(15);
    private static final int MAX_TEXT = 300;
    private static final int MAX_SUMMARY = 600;

    private final List<AiProvider> providers;
    private final FefoService fefoService;
    private final RateLimiter rateLimiter;
    private final ObjectMapper objectMapper;
    private final Clock clock;
    private final AtomicReference<AuditReport> cache = new AtomicReference<>();

    @Value("${tracex.ai.cache-ttl-hours:4}")
    private long cacheTtlHours = 4;

    @Value("${tracex.rate-limit.ai-audit:5}")
    private int maxPerWindow = 5;

    public AiAuditService(List<AiProvider> providers, FefoService fefoService, RateLimiter rateLimiter,
                          ObjectMapper objectMapper, Clock clock) {
        this.providers = providers; // ordered by @Order: Gemini first, NVIDIA second
        this.fefoService = fefoService;
        this.rateLimiter = rateLimiter;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    public AiStatus status() {
        List<String> configured = providers.stream().filter(AiProvider::isConfigured).map(AiProvider::name).toList();
        return new AiStatus(!configured.isEmpty(), configured);
    }

    public void clearCache() {
        cache.set(null);
    }

    public AuditReport runAudit(User user, boolean refresh) {
        if (!rateLimiter.allowRequest("ai-audit:" + user.getId(), maxPerWindow, RATE_WINDOW)) {
            throw new RateLimitException("AI audit limit reached. Please try again in a few minutes.");
        }
        if (!status().enabled()) {
            throw new ApiException(ErrorCode.AI_UNAVAILABLE, "The AI audit is not available on this server.", HttpStatus.SERVICE_UNAVAILABLE);
        }

        AuditReport cached = cache.get();
        Instant now = clock.instant();
        if (!refresh && cached != null && cached.generatedAt().plus(Duration.ofHours(cacheTtlHours)).isAfter(now)) {
            return cached.withFromCache(true);
        }

        FefoService.FefoResult fefo = fefoService.getFefoQueue(null, null);
        List<BatchSummaryDto> batches = new ArrayList<>();
        if (fefo.getQueue() != null) batches.addAll(fefo.getQueue());
        if (fefo.getExpired() != null) batches.addAll(fefo.getExpired());
        if (batches.isEmpty()) {
            AuditReport empty = new AuditReport(List.of(), List.of(), List.of(), List.of(),
                    "There are no active batches to analyse.", 0, "none", now, false);
            cache.set(empty);
            return empty;
        }

        String prompt = buildPrompt(batches);
        for (AiProvider provider : providers) {
            if (!provider.isConfigured()) continue;
            try {
                String raw = provider.complete(prompt);
                AuditReport report = parse(raw, batches, provider.name(), now);
                cache.set(report);
                return report;
            } catch (Exception e) {
                log.warn("AI provider {} failed: exceptionClass={}", provider.name(), e.getClass().getName());
            }
        }
        throw new ApiException(ErrorCode.AI_UNAVAILABLE, "The AI providers are unavailable right now. Please try again later.",
                HttpStatus.SERVICE_UNAVAILABLE);
    }

    /** Only the fields the advice needs; no farmerName (D-9). Package-private for tests. */
    String buildPrompt(List<BatchSummaryDto> batches) {
        List<Map<String, Object>> summary = batches.stream().map(b -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("batchCode", b.getBatchCode());
            m.put("productName", b.getProductName());
            m.put("sku", b.getSku());
            m.put("status", b.getStatus());
            m.put("daysUntilExpiry", b.getDaysUntilExpiry());
            m.put("quantity", b.getQuantityProduced());
            m.put("unit", b.getUnit());
            m.put("yieldPercent", b.getYieldPercent());
            m.put("village", b.getVillage());
            m.put("dataSource", b.getDataSource());
            return m;
        }).toList();
        String json;
        try {
            json = objectMapper.writeValueAsString(summary);
        } catch (Exception e) {
            throw new IllegalStateException("Could not serialise batches", e);
        }
        return """
                You are a supply chain advisor for TraceX Technologies, an organic food company in Uttarakhand, India.
                Analyse the following active warehouse batches:
                %s

                Respond ONLY with valid JSON, no Markdown, no prose, no code fences, using this exact schema:
                {
                  "urgentBatches": [{ "batchCode": "", "reason": "" }],
                  "qualityWarnings": [{ "batchCode": "", "concern": "" }],
                  "top3Priorities": [{ "rank": 1, "batchCode": "", "productName": "", "action": "", "reasoning": "" }],
                  "supplyChainRisks": [{ "risk": "", "severity": "HIGH|MEDIUM|LOW", "recommendation": "" }],
                  "summary": "",
                  "totalAnalyzed": 0
                }
                Rules:
                - urgentBatches: only batches with status URGENT or EXPIRED. Empty array if none.
                - qualityWarnings: batches with yieldPercent < 70 or dataSource "fallback". Empty array if none.
                - top3Priorities: the 3 batches to dispatch next, ranked by urgency, with reasoning tied to the data. Never an EXPIRED batch.
                - supplyChainRisks: systemic risks such as single-product dependency or single-village sourcing. At most 4.
                - summary: one factual paragraph under 80 words for a non-technical factory manager.
                - Use only batch codes from the input. Do not invent data.
                """.formatted(json);
    }

    /** Parses and cleans the model's JSON. Package-private for tests. */
    AuditReport parse(String raw, List<BatchSummaryDto> batches, String provider, Instant at) throws Exception {
        String cleaned = raw.replace("```json", "").replace("```", "").trim();
        JsonNode root = objectMapper.readTree(cleaned);
        Map<String, BatchSummaryDto> byCode = batches.stream()
                .collect(Collectors.toMap(BatchSummaryDto::getBatchCode, Function.identity(), (a, b) -> a));
        Set<String> expired = batches.stream().filter(b -> "EXPIRED".equals(b.getStatus()))
                .map(BatchSummaryDto::getBatchCode).collect(Collectors.toSet());

        List<UrgentBatch> urgent = new ArrayList<>();
        for (JsonNode n : root.path("urgentBatches")) {
            String code = n.path("batchCode").asText();
            if (byCode.containsKey(code)) urgent.add(new UrgentBatch(code, cap(n.path("reason").asText(), MAX_TEXT)));
        }
        List<QualityWarning> warnings = new ArrayList<>();
        for (JsonNode n : root.path("qualityWarnings")) {
            String code = n.path("batchCode").asText();
            if (byCode.containsKey(code)) warnings.add(new QualityWarning(code, cap(n.path("concern").asText(), MAX_TEXT)));
        }
        List<Priority> priorities = new ArrayList<>();
        for (JsonNode n : root.path("top3Priorities")) {
            String code = n.path("batchCode").asText();
            if (!byCode.containsKey(code) || expired.contains(code) || priorities.size() == 3) continue;
            priorities.add(new Priority(priorities.size() + 1, code, byCode.get(code).getProductName(),
                    cap(n.path("action").asText(), MAX_TEXT), cap(n.path("reasoning").asText(), MAX_TEXT)));
        }
        List<SupplyChainRisk> risks = new ArrayList<>();
        for (JsonNode n : root.path("supplyChainRisks")) {
            if (risks.size() == 4) break;
            String severity = n.path("severity").asText("").toUpperCase();
            if (!Set.of("HIGH", "MEDIUM", "LOW").contains(severity)) severity = "MEDIUM";
            String risk = cap(n.path("risk").asText(), MAX_TEXT);
            if (!risk.isBlank()) risks.add(new SupplyChainRisk(risk, severity, cap(n.path("recommendation").asText(), MAX_TEXT)));
        }
        String summary = cap(root.path("summary").asText(""), MAX_SUMMARY);
        return new AuditReport(urgent, warnings, priorities, risks, summary, batches.size(), provider, at, false);
    }

    private static String cap(String s, int max) {
        if (s == null) return "";
        String t = s.trim();
        return t.length() <= max ? t : t.substring(0, max - 1) + "…";
    }
}
