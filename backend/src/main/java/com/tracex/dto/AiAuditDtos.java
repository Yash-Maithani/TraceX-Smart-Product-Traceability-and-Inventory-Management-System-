package com.tracex.dto;

import java.time.Instant;
import java.util.List;

/** Dispatch audit report (Phase 11, S-01). Shape follows the reference `aiService.js` schema. */
public final class AiAuditDtos {

    private AiAuditDtos() {
    }

    public record UrgentBatch(String batchCode, String reason) {
    }

    public record QualityWarning(String batchCode, String concern) {
    }

    public record Priority(int rank, String batchCode, String productName, String action, String reasoning) {
    }

    public record SupplyChainRisk(String risk, String severity, String recommendation) {
    }

    public record AuditReport(
            List<UrgentBatch> urgentBatches,
            List<QualityWarning> qualityWarnings,
            List<Priority> top3Priorities,
            List<SupplyChainRisk> supplyChainRisks,
            String summary,
            int totalAnalyzed,
            String provider,
            Instant generatedAt,
            boolean fromCache) {

        public AuditReport withFromCache(boolean cached) {
            return new AuditReport(urgentBatches, qualityWarnings, top3Priorities, supplyChainRisks,
                    summary, totalAnalyzed, provider, generatedAt, cached);
        }
    }

    /** Whether the audit can run, so the UI can hide it when no provider key is set. */
    public record AiStatus(boolean enabled, List<String> providers) {
    }
}
