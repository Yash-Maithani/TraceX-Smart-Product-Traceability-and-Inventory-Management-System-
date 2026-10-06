package com.tracex.service;

import com.tracex.dto.BatchSummaryDto;
import com.tracex.model.Batch;
import com.tracex.model.Product;
import com.tracex.repository.ProductRepository;
import com.tracex.util.BatchFreshness;
import com.tracex.util.BatchLocalDateValueConverter;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class FefoService {

    private final MongoTemplate mongoTemplate;
    private final ProductRepository productRepository;
    private final Clock clock;

    public FefoService(MongoTemplate mongoTemplate, ProductRepository productRepository, Clock clock) {
        this.mongoTemplate = mongoTemplate;
        this.productRepository = productRepository;
        this.clock = clock;
    }

    public static class FefoResult {
        private List<BatchSummaryDto> queue;
        private List<BatchSummaryDto> expired;
        private List<BatchSummaryDto> exceptions;

        public FefoResult() {}

        public FefoResult(List<BatchSummaryDto> queue, List<BatchSummaryDto> expired, List<BatchSummaryDto> exceptions) {
            this.queue = queue;
            this.expired = expired;
            this.exceptions = exceptions;
        }

        public List<BatchSummaryDto> getQueue() { return queue; }
        public void setQueue(List<BatchSummaryDto> queue) { this.queue = queue; }
        public List<BatchSummaryDto> getExpired() { return expired; }
        public void setExpired(List<BatchSummaryDto> expired) { this.expired = expired; }
        public List<BatchSummaryDto> getExceptions() { return exceptions; }
        public void setExceptions(List<BatchSummaryDto> exceptions) { this.exceptions = exceptions; }
    }

    /**
     * Display-only priorityScore formula from reference backend/src/services/expiryCalculator.js lines 29-33.
     * Never used for FEFO queue ordering.
     */
    public double computePriorityScore(LocalDate expiryDate, String riskLevel, Clock clockToUse) {
        if (expiryDate == null) {
            return 0.0;
        }
        long daysUntilExpiry = BatchFreshness.calculateDaysUntilExpiry(expiryDate, clockToUse);
        double riskBonus = 0.0;
        if ("HIGH".equalsIgnoreCase(riskLevel)) {
            riskBonus = 100.0;
        } else if ("MEDIUM".equalsIgnoreCase(riskLevel)) {
            riskBonus = 50.0;
        }
        return Math.max(0.0, 365.0 - daysUntilExpiry) + riskBonus;
    }

    public double computePriorityScore(LocalDate expiryDate, String riskLevel) {
        return computePriorityScore(expiryDate, riskLevel, this.clock);
    }

    public double computePriorityScore(Instant expiryDate, String riskLevel, Clock clockToUse) {
        if (expiryDate == null) {
            return 0.0;
        }
        return computePriorityScore(expiryDate.atZone(clockToUse.getZone()).toLocalDate(), riskLevel, clockToUse);
    }

    public double computePriorityScore(Instant expiryDate, String riskLevel) {
        return computePriorityScore(expiryDate, riskLevel, this.clock);
    }

    public FefoResult getFefoQueue(String category, String sku) {
        return getFefoQueue(category, sku, this.clock);
    }

    public FefoResult getFefoQueue(String category, String sku, Clock clockToUse) {
        List<Product> allProducts = productRepository.findAll();
        Map<String, String> skuToRiskLevel = new HashMap<>();
        for (Product p : allProducts) {
            if (p.getSku() != null && p.getRiskLevel() != null) {
                skuToRiskLevel.put(p.getSku().toUpperCase(), p.getRiskLevel());
            }
        }

        Set<String> allowedSkus = null;
        if (category != null && !category.trim().isEmpty()) {
            String targetCategory = category.trim();
            allowedSkus = allProducts.stream()
                    .filter(p -> p.getCategory() != null && p.getCategory().equalsIgnoreCase(targetCategory))
                    .map(p -> p.getSku().toUpperCase())
                    .collect(Collectors.toSet());
        }

        String targetSku = (sku != null && !sku.trim().isEmpty()) ? sku.trim().toUpperCase() : null;

        List<BatchWithValidity> activeBatches = loadActiveNonDeletedBatches();

        List<BatchSummaryDto> queue = new ArrayList<>();
        List<BatchSummaryDto> expired = new ArrayList<>();
        List<BatchSummaryDto> exceptions = new ArrayList<>();

        for (BatchWithValidity item : activeBatches) {
            Batch batch = item.batch();
            String batchSku = batch.getSku() != null ? batch.getSku().toUpperCase() : "";

            // Apply category and sku filters BEFORE grouping and ordering (D-18)
            if (targetSku != null && !targetSku.equals(batchSku)) {
                continue;
            }
            if (allowedSkus != null && !allowedSkus.contains(batchSku)) {
                continue;
            }

            if (!item.validExpiry() || batch.getExpiryDate() == null) {
                BatchSummaryDto dto = toSummaryDto(batch, clockToUse, false, skuToRiskLevel);
                dto.setExceptionReason(item.exceptionReason() != null ? item.exceptionReason() : "Missing or invalid expiryDate");
                exceptions.add(dto);
                continue;
            }

            BatchSummaryDto dto = toSummaryDto(batch, clockToUse, true, skuToRiskLevel);
            if (dto.getDaysUntilExpiry() != null && dto.getDaysUntilExpiry() <= 0) {
                expired.add(dto);
            } else {
                queue.add(dto);
            }
        }

        // Sort queue by: (1) tier URGENT -> WARNING -> READY, (2) daysUntilExpiry asc, (3) createdAt asc, (4) batchCode asc
        queue.sort(fefoComparator());

        // Assign 1-based rank to each queue item
        for (int i = 0; i < queue.size(); i++) {
            queue.get(i).setRank(i + 1);
        }

        // Deterministic sort for expired and exceptions lists
        expired.sort(Comparator
                .comparing(BatchSummaryDto::getDaysUntilExpiry, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(BatchSummaryDto::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(BatchSummaryDto::getBatchCode, Comparator.nullsLast(Comparator.naturalOrder())));

        exceptions.sort(Comparator
                .comparing(BatchSummaryDto::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(BatchSummaryDto::getBatchCode, Comparator.nullsLast(Comparator.naturalOrder())));

        return new FefoResult(queue, expired, exceptions);
    }

    /**
     * Evaluates D-18 per-SKU out-of-order rule:
     * Returns an Optional containing the earliest eligible batch of the same SKU that has a strictly earlier
     * expiryDate than targetBatch. Batches with equal expiryDate are a tie and neither is out of order.
     */
    public Optional<BatchSummaryDto> findEarlierEligibleBatchForSameSku(Batch targetBatch, Clock clockToUse) {
        if (targetBatch.getSku() == null || targetBatch.getExpiryDate() == null) {
            return Optional.empty();
        }
        FefoResult skuFefo = getFefoQueue(null, targetBatch.getSku(), clockToUse);
        LocalDate targetExpiry = targetBatch.getExpiryDate();

        for (BatchSummaryDto candidate : skuFefo.getQueue()) {
            if (candidate.getId() != null && candidate.getId().equals(targetBatch.getId())) {
                continue;
            }
            if (candidate.getExpiryDate() != null) {
                if (candidate.getExpiryDate().isBefore(targetExpiry)) {
                    return Optional.of(candidate);
                }
            }
        }
        return Optional.empty();
    }

    public Comparator<BatchSummaryDto> fefoComparator() {
        return Comparator
                .comparingInt((BatchSummaryDto b) -> BatchFreshness.tierPriority(b.getStatus()))
                .thenComparing(BatchSummaryDto::getDaysUntilExpiry, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(BatchSummaryDto::getExpiryDate, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(BatchSummaryDto::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(BatchSummaryDto::getBatchCode, Comparator.nullsLast(Comparator.naturalOrder()));
    }

    private record BatchWithValidity(Batch batch, boolean validExpiry, String exceptionReason) {}

    private List<BatchWithValidity> loadActiveNonDeletedBatches() {
        Document filter = new Document("isDeleted", false).append("lifecycleState", "ACTIVE");
        List<BatchWithValidity> results = new ArrayList<>();

        for (Document rawDoc : mongoTemplate.getCollection("batches").find(filter)) {
            boolean validExpiry = true;
            String exceptionReason = null;
            if (!rawDoc.containsKey("expiryDate")) {
                validExpiry = false;
                exceptionReason = "Missing expiryDate";
            } else {
                Object rawExpiry = rawDoc.get("expiryDate");
                if (rawExpiry == null) {
                    validExpiry = false;
                    exceptionReason = "Null expiryDate";
                } else if (BatchLocalDateValueConverter.tryParseLocalDate(rawExpiry) == null) {
                    validExpiry = false;
                    exceptionReason = "Unparseable expiryDate: " + rawExpiry;
                }
            }
            Batch batch = mongoTemplate.getConverter().read(Batch.class, rawDoc);
            results.add(new BatchWithValidity(batch, validExpiry && batch.getExpiryDate() != null, exceptionReason));
        }
        return results;
    }

    private BatchSummaryDto toSummaryDto(Batch batch, Clock clockToUse, boolean validExpiry, Map<String, String> skuToRiskLevel) {
        BatchSummaryDto dto = new BatchSummaryDto();
        dto.setId(batch.getId());
        dto.setBatchCode(batch.getBatchCode());
        dto.setProductName(batch.getProductName());
        dto.setSku(batch.getSku());
        dto.setSourceLotCode(batch.getSourceLotCode());
        dto.setFarmerName(batch.getFarmerName());
        dto.setVillage(batch.getVillage());
        dto.setQuantityProduced(batch.getQuantityProduced());
        dto.setUnit(batch.getUnit());
        dto.setYieldPercent(batch.getYieldPercent());
        dto.setPackDate(batch.getPackDate());
        dto.setExpiryDate(batch.getExpiryDate());
        dto.setDataSource(batch.getDataSource());
        dto.setShelfLifeSource(batch.getShelfLifeSource());
        dto.setLifecycleState(batch.getLifecycleState());
        String riskLevel = batch.getSku() != null ? skuToRiskLevel.get(batch.getSku().toUpperCase()) : null;
        double score = batch.getPriorityScore() > 0.0
                ? batch.getPriorityScore()
                : (validExpiry ? computePriorityScore(batch.getExpiryDate(), riskLevel, clockToUse) : 0.0);
        dto.setPriorityScore(score);
        dto.setQualityCheck(batch.getQualityCheck());
        dto.setCreatedBy(batch.getCreatedBy());
        dto.setDeleted(batch.isDeleted());
        dto.setCreatedAt(batch.getCreatedAt());
        dto.setUpdatedAt(batch.getUpdatedAt());

        if (validExpiry && batch.getExpiryDate() != null) {
            long days = BatchFreshness.calculateDaysUntilExpiry(batch.getExpiryDate(), clockToUse);
            dto.setDaysUntilExpiry(days);
            dto.setStatus(BatchFreshness.calculateStatus(batch.getLifecycleState(), batch.getExpiryDate(), clockToUse));
            dto.setExceptionReason(null);
        } else {
            dto.setDaysUntilExpiry(null);
            dto.setStatus("EXCEPTION");
        }
        return dto;
    }
}
