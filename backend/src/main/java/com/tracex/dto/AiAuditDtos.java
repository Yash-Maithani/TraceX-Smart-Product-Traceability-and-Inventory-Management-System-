package com.tracex.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * AI features (Phase 11, reworked in the AI phase). The dispatch advisor's facts come from fixed server
 * rules and are always present; only {@link AiInsight} comes from a language model.
 */
public final class AiAuditDtos {

    private AiAuditDtos() {
    }

    /* ---------- Dispatch advisor ---------- */

    /** The batch to ship next for one product, in FEFO order, skipping batches on hold. */
    public record NextBatch(String batchCode, String productName, String sku, Long daysUntilExpiry, String status,
                            String verdict) {
    }

    /** A batch that needs attention, with the rule that flagged it in plain words. */
    public record FlaggedBatch(String batchCode, String productName, String reason) {
    }

    public record SupplyChainRisk(String risk, String severity, String recommendation) {
    }

    /** The model's part: a plain summary and patterns the rules cannot see. Advisory only. */
    public record AiInsight(String summary, List<SupplyChainRisk> risks, String provider, Instant generatedAt,
                            boolean fromCache) {

        public AiInsight withFromCache(boolean cached) {
            return new AiInsight(summary, risks, provider, generatedAt, cached);
        }
    }

    /**
     * Dispatch advice. {@code aiNote} explains a missing {@code ai} part: "off" (no key), "not-requested" (facts only were asked for),
     * "unavailable" (the providers failed) or "limit" (too many requests); it is null when {@code ai} is present.
     */
    public record DispatchAdvice(
            List<NextBatch> nextToShip,
            List<FlaggedBatch> urgent,
            List<FlaggedBatch> onHold,
            List<FlaggedBatch> expired,
            List<FlaggedBatch> qualityWarnings,
            int totalAnalyzed,
            Instant generatedAt,
            AiInsight ai,
            String aiNote) {
    }

    /** Whether the AI features can run, so the UI can hide them when no provider key is set. */
    public record AiStatus(boolean enabled, List<String> providers) {
    }

    /* ---------- Ask TraceX ---------- */

    public record AskRequest(String question) {
    }

    /** The checked filter the model proposed; every field is validated against the server's own values. */
    public record AskFilter(List<String> statuses, String sku, String search, LocalDate expiryFrom, LocalDate expiryTo,
                            String verdict) {
    }

    /** Batches that matched, the filter in plain words, and the provider that read the question. */
    public record AskAnswer(String question, AskFilter filter, String description, long total,
                            List<BatchSummaryDto> batches, String provider) {
    }

    /* ---------- Inspection assistant ---------- */

    public record InspectionDraftRequest(String notes) {
    }

    /** {@code passed} is true, false or null (not checked). */
    public record ChecklistDraft(String label, Boolean passed, String note) {
    }

    /** A draft the inspector reviews before saving. {@code adjustments} lists what the server corrected. */
    public record InspectionDraft(List<ChecklistDraft> checklist, String verdict, int rating, String findings,
                                  String recommendation, List<String> adjustments, String provider) {
    }
}
