package com.tracex.service.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tracex.dto.AiAuditDtos.AiInsight;
import com.tracex.dto.AiAuditDtos.AiStatus;
import com.tracex.dto.AiAuditDtos.DispatchAdvice;
import com.tracex.dto.AiAuditDtos.FlaggedBatch;
import com.tracex.dto.AiAuditDtos.NextBatch;
import com.tracex.dto.AiAuditDtos.SupplyChainRisk;
import com.tracex.dto.BatchSummaryDto;
import com.tracex.exception.ApiException;
import com.tracex.model.User;
import com.tracex.security.RateLimiter;
import com.tracex.service.FefoService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Dispatch advisor (Phase 11, S-01; reworked in the AI phase).
 *
 * The facts (what to ship next, urgent, on hold, expired, quality warnings) come from fixed server rules,
 * so they are always correct, free, and shown even without an AI key. The language model only adds a
 * plain summary and supply risks the rules cannot see. Its answer is checked: a risk that names a batch
 * code not in the data is dropped. The cached insight is reused only while the batch data is unchanged
 * (a fingerprint of codes, statuses and verdicts), so dispatching or inspecting a batch makes it stale.
 * Privacy (D-9): batches are sent with `village` but never `farmerName`.
 */
@Service
public class AiAuditService {

    private static final Duration RATE_WINDOW = Duration.ofMinutes(15);
    private static final int MAX_TEXT = 300;
    private static final int MAX_SUMMARY = 600;
    private static final double LOW_YIELD = 70.0;
    private static final Pattern BATCH_CODE = Pattern.compile("TX-[A-Z0-9-]+");

    private final AiGateway gateway;
    private final FefoService fefoService;
    private final RateLimiter rateLimiter;
    private final ObjectMapper objectMapper;
    private final Clock clock;
    private final AtomicReference<CachedInsight> cache = new AtomicReference<>();

    private record CachedInsight(String fingerprint, AiInsight insight) {
    }

    @Value("${tracex.ai.cache-ttl-hours:4}")
    private long cacheTtlHours = 4;

    @Value("${tracex.rate-limit.ai-audit:5}")
    private int maxPerWindow = 5;

    public AiAuditService(AiGateway gateway, FefoService fefoService, RateLimiter rateLimiter, ObjectMapper objectMapper,
                          Clock clock) {
        this.gateway = gateway;
        this.fefoService = fefoService;
        this.rateLimiter = rateLimiter;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    public AiStatus status() {
        List<String> configured = gateway.configuredProviders();
        return new AiStatus(!configured.isEmpty(), configured);
    }

    public void clearCache() {
        cache.set(null);
    }

    /**
     * Facts are always computed. The AI insight is added when a provider is configured: from the cache
     * if the data is unchanged and {@code refresh} is false, otherwise from a new model call (rate-limited
     * per user). A failed or limited model call never hides the facts.
     */
    public DispatchAdvice advise(User user, boolean refresh) {
        return advise(user, refresh, true);
    }

    /** {@code withAi} false returns the rule-based facts only, with no model call and no rate limit. */
    public DispatchAdvice advise(User user, boolean refresh, boolean withAi) {
        Instant now = clock.instant();
        FefoService.FefoResult fefo = fefoService.getFefoQueue(null, null);
        List<BatchSummaryDto> queue = fefo.getQueue() != null ? fefo.getQueue() : List.of();
        List<BatchSummaryDto> expiredList = fefo.getExpired() != null ? fefo.getExpired() : List.of();

        List<NextBatch> nextToShip = new ArrayList<>();
        List<FlaggedBatch> urgent = new ArrayList<>();
        List<FlaggedBatch> onHold = new ArrayList<>();
        List<FlaggedBatch> quality = new ArrayList<>();
        Set<String> skusSeen = new HashSet<>();
        for (BatchSummaryDto b : queue) {
            boolean held = isHeld(b);
            if (held) {
                onHold.add(new FlaggedBatch(b.getBatchCode(), b.getProductName(), "Latest inspection failed. Record a new inspection to release it."));
            }
            String sku = b.getSku() == null ? "" : b.getSku().toUpperCase(Locale.ROOT);
            if (!held && skusSeen.add(sku)) {
                nextToShip.add(new NextBatch(b.getBatchCode(), b.getProductName(), b.getSku(), b.getDaysUntilExpiry(),
                        b.getStatus(), verdict(b)));
            }
            if ("URGENT".equals(b.getStatus())) {
                urgent.add(new FlaggedBatch(b.getBatchCode(), b.getProductName(), "Expires in " + days(b.getDaysUntilExpiry()) + "."));
            }
            if (b.getYieldPercent() > 0 && b.getYieldPercent() < LOW_YIELD) {
                quality.add(new FlaggedBatch(b.getBatchCode(), b.getProductName(),
                        "Yield " + Math.round(b.getYieldPercent()) + "%, below the usual 70%."));
            } else if ("fallback".equals(b.getDataSource())) {
                quality.add(new FlaggedBatch(b.getBatchCode(), b.getProductName(),
                        "Expiry date was entered by hand or taken from the standard shelf life, not predicted."));
            }
        }
        List<FlaggedBatch> expired = expiredList.stream()
                .map(b -> new FlaggedBatch(b.getBatchCode(), b.getProductName(),
                        "Expired " + days(b.getDaysUntilExpiry() == null ? null : Long.valueOf(Math.abs(b.getDaysUntilExpiry()))) + " ago. Archive it or correct the date."))
                .toList();

        List<BatchSummaryDto> analysed = new ArrayList<>(queue);
        analysed.addAll(expiredList);

        AiInsight insight = null;
        String aiNote = null;
        if (!gateway.enabled()) {
            aiNote = "off";
        } else if (!withAi) {
            CachedInsight cached = cache.get();
            if (cached != null && cached.fingerprint().equals(fingerprint(analysed))
                    && cached.insight().generatedAt().plus(Duration.ofHours(cacheTtlHours)).isAfter(now)) {
                insight = cached.insight().withFromCache(true);
            } else {
                aiNote = "not-requested";
            }
        } else if (analysed.isEmpty()) {
            aiNote = null;
        } else {
            String fingerprint = fingerprint(analysed);
            CachedInsight cached = cache.get();
            boolean fresh = cached != null && cached.fingerprint().equals(fingerprint)
                    && cached.insight().generatedAt().plus(Duration.ofHours(cacheTtlHours)).isAfter(now);
            if (fresh && !refresh) {
                insight = cached.insight().withFromCache(true);
            } else if (!rateLimiter.allowRequest("ai-audit:" + user.getId(), maxPerWindow, RATE_WINDOW)) {
                aiNote = "limit";
                if (cached != null && cached.fingerprint().equals(fingerprint)) insight = cached.insight().withFromCache(true);
            } else {
                try {
                    String prompt = buildPrompt(analysed, nextToShip);
                    Set<String> codes = new HashSet<>();
                    analysed.forEach(b -> codes.add(b.getBatchCode()));
                    AiGateway.Answer<AiInsightParts> answer = gateway.askJson(prompt, json -> readInsight(json, codes));
                    insight = new AiInsight(answer.value().summary(), answer.value().risks(), answer.provider(), now, false);
                    cache.set(new CachedInsight(fingerprint, insight));
                } catch (ApiException e) {
                    aiNote = "unavailable";
                }
            }
        }
        return new DispatchAdvice(nextToShip, urgent, onHold, expired, quality, analysed.size(), now, insight, aiNote);
    }

    private static boolean isHeld(BatchSummaryDto b) {
        return b.getQualityCheck() != null && "FAILED".equalsIgnoreCase(b.getQualityCheck().getStatus());
    }

    private static String verdict(BatchSummaryDto b) {
        return b.getQualityCheck() != null && b.getQualityCheck().getStatus() != null ? b.getQualityCheck().getStatus() : "NOT_INSPECTED";
    }

    private static String days(Long n) {
        if (n == null) return "an unknown number of days";
        return n == 1 ? "1 day" : n + " days";
    }

    /** Changes whenever a batch is added, dispatched, archived, inspected or moves tier. */
    static String fingerprint(List<BatchSummaryDto> batches) {
        StringBuilder sb = new StringBuilder();
        batches.stream()
                .map(b -> b.getBatchCode() + "|" + b.getStatus() + "|" + verdict(b) + "|" + b.getDaysUntilExpiry())
                .sorted()
                .forEach(s -> sb.append(s).append(';'));
        return Integer.toHexString(sb.toString().hashCode()) + ":" + batches.size();
    }

    /** Only the fields the advice needs; no farmerName (D-9). Package-private for tests. */
    String buildPrompt(List<BatchSummaryDto> batches, List<NextBatch> nextToShip) {
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
            m.put("latestInspection", verdict(b));
            return m;
        }).toList();
        String json;
        String next;
        try {
            json = objectMapper.writeValueAsString(summary);
            next = objectMapper.writeValueAsString(nextToShip.stream().map(NextBatch::batchCode).toList());
        } catch (Exception e) {
            throw new IllegalStateException("Could not serialise batches", e);
        }
        return """
                You advise the warehouse team of TraceX Technologies, an organic food company in Uttarakhand, India.
                The dispatch order is already fixed by rules (first expired, first out, skipping batches whose latest
                inspection FAILED). Do not change it. The batches to ship next are: %s
                Active and expired batches:
                %s

                Respond ONLY with valid JSON, no Markdown, using exactly this schema:
                { "summary": "", "risks": [{ "risk": "", "severity": "HIGH|MEDIUM|LOW", "recommendation": "" }] }
                Rules:
                - summary: one factual paragraph under 80 words for a non-technical manager: what needs attention
                  today and why, using the data only.
                - risks: at most 4 patterns the rules above do not cover, such as most stock coming from one village,
                  one product making up most of the stock, many batches expiring in the same few days, or several
                  failed inspections for one product. Each with a practical recommendation. Empty array if none.
                - Mention batch codes only if they appear in the data. Do not invent numbers.
                - Describe inspections exactly as given: PASSED, FLAGGED, FAILED or NOT_INSPECTED. Never call an
                  uninspected batch approved or cleared.
                - Plain, specific sentences. No filler such as "immediate attention is required".
                """.formatted(next, json);
    }

    record AiInsightParts(String summary, List<SupplyChainRisk> risks) {
    }

    /** Parses and cleans the model's JSON. Package-private for tests. */
    static AiInsightParts readInsight(JsonNode root, Set<String> knownCodes) {
        if (!root.isObject() || !root.has("summary")) {
            throw new IllegalArgumentException("Unexpected answer shape");
        }
        List<SupplyChainRisk> risks = new ArrayList<>();
        for (JsonNode n : root.path("risks")) {
            if (risks.size() == 4) break;
            String risk = AiGateway.cap(n.path("risk").asText(), MAX_TEXT);
            String recommendation = AiGateway.cap(n.path("recommendation").asText(), MAX_TEXT);
            if (risk.isBlank() || mentionsUnknownCode(risk + " " + recommendation, knownCodes)) continue;
            String severity = n.path("severity").asText("").toUpperCase(Locale.ROOT);
            if (!Set.of("HIGH", "MEDIUM", "LOW").contains(severity)) severity = "MEDIUM";
            risks.add(new SupplyChainRisk(risk, severity, recommendation));
        }
        String summary = AiGateway.cap(root.path("summary").asText(""), MAX_SUMMARY);
        if (mentionsUnknownCode(summary, knownCodes)) {
            throw new IllegalArgumentException("Summary names a batch that does not exist");
        }
        return new AiInsightParts(summary, risks);
    }

    private static boolean mentionsUnknownCode(String text, Set<String> knownCodes) {
        Matcher m = BATCH_CODE.matcher(text);
        while (m.find()) {
            String code = m.group().replaceAll("-+$", "");
            if (!knownCodes.contains(code)) return true;
        }
        return false;
    }
}
