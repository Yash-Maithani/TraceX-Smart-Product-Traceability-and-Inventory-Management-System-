package com.tracex.service;

import com.tracex.dto.*;
import com.tracex.exception.ApiException;
import com.tracex.exception.ErrorCode;
import com.tracex.exception.ResourceNotFoundException;
import com.tracex.exception.ValidationException;
import com.tracex.model.Batch;
import com.tracex.model.Batch.NoteHistoryEntry;
import com.tracex.model.Product;
import com.tracex.model.User;
import com.tracex.repository.BatchRepository;
import com.tracex.repository.ProductRepository;
import com.tracex.util.BatchCodeGenerator;
import com.tracex.util.BatchFreshness;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class BatchService {

    private static final Set<String> WHITELISTED_SORT_FIELDS = Set.of(
            "expirydate", "createdat", "batchcode", "productname", "quantityproduced"
    );

    private static final Map<String, String> SORT_FIELD_MAPPING = Map.of(
            "expirydate", "expiryDate",
            "createdat", "createdAt",
            "batchcode", "batchCode",
            "productname", "productName",
            "quantityproduced", "quantityProduced"
    );

    private final BatchRepository batchRepository;
    private final ProductRepository productRepository;
    private final MongoTemplate mongoTemplate;
    private final BatchCodeGenerator batchCodeGenerator;
    private final AuditService auditService;
    private final FefoService fefoService;
    private final Clock clock;
    private final TraceTokenService traceTokenService;
    private final String publicTraceBaseUrl;

    public BatchService(BatchRepository batchRepository, ProductRepository productRepository,
                        MongoTemplate mongoTemplate, BatchCodeGenerator batchCodeGenerator,
                        AuditService auditService, FefoService fefoService, Clock clock,
                        TraceTokenService traceTokenService,
                        @org.springframework.beans.factory.annotation.Value("${tracex.security.public-trace-base-url:http://localhost:5174}") String publicTraceBaseUrl) {
        this.batchRepository = batchRepository;
        this.productRepository = productRepository;
        this.mongoTemplate = mongoTemplate;
        this.batchCodeGenerator = batchCodeGenerator;
        this.auditService = auditService;
        this.fefoService = fefoService;
        this.clock = clock;
        this.traceTokenService = traceTokenService;
        this.publicTraceBaseUrl = (publicTraceBaseUrl != null && publicTraceBaseUrl.endsWith("/"))
                ? publicTraceBaseUrl.substring(0, publicTraceBaseUrl.length() - 1)
                : (publicTraceBaseUrl != null ? publicTraceBaseUrl : "http://localhost:5174");
    }

    public static class BatchPageResult {
        public List<BatchSummaryDto> data;
        public long total;
        public int page;
        public int limit;
        public int count;

        public BatchPageResult(List<BatchSummaryDto> data, long total, int page, int limit) {
            this.data = data;
            this.total = total;
            this.page = page;
            this.limit = limit;
            this.count = data.size();
        }
    }

    public BatchPageResult getAllBatches(int page, int limit, String statusFilter, String sku) {
        return getAllBatches(page, limit, statusFilter, sku, null, null);
    }

    public BatchPageResult getAllBatches(int page, int limit, String statusFilter, String sku, String search, String sortParam) {
        Query query = new Query();
        query.addCriteria(Criteria.where("isDeleted").is(false));

        if (sku != null && !sku.trim().isEmpty()) {
            query.addCriteria(Criteria.where("sku").is(sku.trim().toUpperCase()));
        }

        if (search != null && !search.trim().isEmpty()) {
            String literalPattern = Pattern.quote(search.trim());
            Criteria searchCriteria = new Criteria().orOperator(
                    Criteria.where("batchCode").regex(literalPattern, "i"),
                    Criteria.where("productName").regex(literalPattern, "i"),
                    Criteria.where("sourceLotCode").regex(literalPattern, "i"),
                    Criteria.where("farmerName").regex(literalPattern, "i")
            );
            query.addCriteria(searchCriteria);
        }

        BatchFreshness.applyStatusFilter(query, statusFilter, clock);

        long total = mongoTemplate.count(query, Batch.class);

        Sort sort = BatchFreshness.defaultBatchSort();
        if (sortParam != null && !sortParam.trim().isEmpty()) {
            String[] parts = sortParam.trim().split("[,:]");
            String requestedField = parts[0].trim().toLowerCase();
            if (!WHITELISTED_SORT_FIELDS.contains(requestedField)) {
                throw new ValidationException("sort", "Sort field '" + parts[0].trim() + "' is not permitted");
            }
            String mappedField = SORT_FIELD_MAPPING.get(requestedField);
            Sort.Direction direction = Sort.Direction.ASC;
            if (parts.length > 1 && "desc".equalsIgnoreCase(parts[1].trim())) {
                direction = Sort.Direction.DESC;
            }
            sort = Sort.by(direction, mappedField);
        }

        Pageable pageable = PageRequest.of(page - 1, limit, sort);
        query.with(pageable);

        List<Batch> batches = mongoTemplate.find(query, Batch.class);
        List<BatchSummaryDto> dtos = batches.stream().map(this::mapToSummary).collect(Collectors.toList());

        return new BatchPageResult(dtos, total, page, limit);
    }

    public BatchDetailDto getBatchById(String id) {
        Batch batch = batchRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Batch not found"));
        return mapToDetail(batch);
    }

    public BatchDetailDto createBatch(BatchCreateDto dto, String createdByUsername, String requestId) {
        return createBatch(dto, createdByUsername, requestId, null);
    }

    public BatchDetailDto createBatch(BatchCreateDto dto, String createdByUsername, String requestId, String initialNoteHistory) {
        Product product = productRepository.findById(dto.getProductId())
                .orElseThrow(() -> new ResourceNotFoundException("Product not found"));
        return createBatchForProduct(product, dto, createdByUsername, requestId, initialNoteHistory);
    }

    public BatchDetailDto createBatchForProduct(Product product, BatchCreateDto dto, String createdByUsername, String requestId, String initialNoteHistory) {
        LocalDate expiryDate;
        String dataSource;
        String shelfLifeSource;

        if (dto.getExpiryDate() != null) {
            expiryDate = dto.getExpiryDate();
            dataSource = "fallback";
            shelfLifeSource = "manual";
        } else if (product.getPredictedShelfLifeDays() != null) {
            expiryDate = dto.getPackDate().plusDays(product.getPredictedShelfLifeDays());
            dataSource = "predicted";
            shelfLifeSource = "predicted";
        } else {
            expiryDate = dto.getPackDate().plusDays(product.getBaseShelfLifeDays());
            dataSource = "fallback";
            shelfLifeSource = "base";
        }

        double priorityScore = fefoService.computePriorityScore(expiryDate, product.getRiskLevel(), clock);

        Batch batch = new Batch();
        batch.setProductId(product.getId());
        batch.setProductName(product.getProductName());
        batch.setSku(product.getSku());
        batch.setSourceLotCode(dto.getSourceLotCode().trim().toUpperCase());
        batch.setFarmerName(dto.getFarmerName().trim());
        batch.setVillage(dto.getVillage().trim());
        batch.setQuantityProduced(dto.getQuantityProduced());
        batch.setUnit(dto.getUnit());
        batch.setYieldPercent(dto.getYieldPercent());
        batch.setPackDate(dto.getPackDate());
        batch.setExpiryDate(expiryDate);
        batch.setDataSource(dataSource);
        batch.setShelfLifeSource(shelfLifeSource);
        batch.setPriorityScore(priorityScore);
        batch.setLifecycleState("ACTIVE");

        if (dto.getTraceabilityNote() != null && !dto.getTraceabilityNote().trim().isEmpty()) {
            batch.setTraceabilityNote(dto.getTraceabilityNote().trim());
        } else {
            batch.setTraceabilityNote("Best before " + expiryDate.toString());
        }

        if (initialNoteHistory != null && !initialNoteHistory.trim().isEmpty()) {
            batch.getNoteHistory().add(new NoteHistoryEntry(initialNoteHistory.trim(), createdByUsername, clock.instant()));
        }

        batch.setCreatedBy(createdByUsername);
        batch.setBatchCode(batchCodeGenerator.generateNextCode());
        batch.setTraceToken(traceTokenService.generateToken());

        Batch saved = batchRepository.save(batch);

        auditService.record(null, createdByUsername, "BATCH_CREATED", "BATCH", saved.getId(), "Batch created: " + saved.getBatchCode());

        return mapToDetail(saved);
    }

    public BatchDetailDto dispatchBatch(String id, BatchDispatchDto dto, User actor, String requestId) {
        return dispatchBatch(id, dto, actor, requestId, this.clock);
    }

    public BatchDetailDto dispatchBatch(String id, BatchDispatchDto dto, User actor, String requestId, Clock clockToUse) {
        // 1. Exists and is not soft-deleted (else 404 NOT_FOUND)
        Batch batch = batchRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Batch not found"));
        if (batch.isDeleted()) {
            throw new ResourceNotFoundException("Batch not found");
        }

        // 2. Not already DISPATCHED (else 409 CONFLICT)
        if ("DISPATCHED".equals(batch.getLifecycleState())) {
            throw new ApiException(ErrorCode.CONFLICT, "Batch is already dispatched", HttpStatus.CONFLICT);
        }

        // 3. Not expired (daysUntilExpiry > 0, else 409 BATCH_EXPIRED)
        long daysUntilExpiry = BatchFreshness.calculateDaysUntilExpiry(batch.getExpiryDate(), clockToUse);
        if (batch.getExpiryDate() == null || daysUntilExpiry <= 0) {
            throw new ApiException(ErrorCode.BATCH_EXPIRED, "Expired batch cannot be dispatched", HttpStatus.CONFLICT);
        }

        // 4. Quality hold per D-19 (409 QUALITY_HOLD when latest verdict is FAILED)
        String latestVerdict = batch.getQualityCheck() != null ? batch.getQualityCheck().getStatus() : null;
        if ("FAILED".equalsIgnoreCase(latestVerdict)) {
            throw new ApiException(ErrorCode.QUALITY_HOLD, "Batch cannot be dispatched: latest inspection verdict is FAILED", HttpStatus.CONFLICT);
        }

        // Validate request fields (buyerName, dispatchDate, overrideReason)
        List<FieldErrorDto> fieldErrors = new ArrayList<>();
        String trimmedBuyerName = (dto != null && dto.getBuyerName() != null) ? dto.getBuyerName().trim() : "";
        if (trimmedBuyerName.isEmpty()) {
            fieldErrors.add(new FieldErrorDto("buyerName", "buyerName is required"));
        } else if (trimmedBuyerName.length() > 200) {
            fieldErrors.add(new FieldErrorDto("buyerName", "buyerName cannot exceed 200 characters"));
        }

        Instant now = clockToUse.instant();
        LocalDate todayLocal = LocalDate.now(clockToUse);
        LocalDate effectiveDispatchDate = (dto != null && dto.getDispatchDate() != null) ? dto.getDispatchDate() : todayLocal;

        if (dto != null && dto.getDispatchDate() != null) {
            LocalDate dispatchLocal = dto.getDispatchDate();
            if (batch.getPackDate() != null) {
                LocalDate packLocal = batch.getPackDate();
                if (dispatchLocal.isBefore(packLocal)) {
                    fieldErrors.add(new FieldErrorDto("dispatchDate", "dispatchDate cannot be before packDate"));
                }
            }
            if (dispatchLocal.isAfter(todayLocal)) {
                fieldErrors.add(new FieldErrorDto("dispatchDate", "dispatchDate cannot be in the future"));
            }
        }

        if (dto != null && dto.getOverrideReason() != null && dto.getOverrideReason().length() > 500) {
            fieldErrors.add(new FieldErrorDto("overrideReason", "overrideReason cannot exceed 500 characters"));
        }

        if (!fieldErrors.isEmpty()) {
            throw new ValidationException("Validation failed", fieldErrors);
        }

        // 5. Out-of-order check per D-18 (per-SKU)
        Optional<BatchSummaryDto> earlierBatchOpt = fefoService.findEarlierEligibleBatchForSameSku(batch, clockToUse);
        boolean outOfOrder = earlierBatchOpt.isPresent();
        String trimmedOverrideReason = (dto != null && dto.getOverrideReason() != null && !dto.getOverrideReason().trim().isEmpty())
                ? dto.getOverrideReason().trim()
                : null;

        if (outOfOrder && trimmedOverrideReason == null) {
            String earlierCode = earlierBatchOpt.get().getBatchCode();
            throw new ApiException(
                    ErrorCode.DISPATCH_OUT_OF_ORDER,
                    "Batch " + batch.getBatchCode() + " is out of FEFO order for SKU " + batch.getSku()
                            + "; batch " + earlierCode + " expires earlier and must be dispatched first unless overrideReason is provided",
                    HttpStatus.CONFLICT
            );
        }

        String actorUsername = actor != null ? actor.getUsername() : "system";
        String actorId = actor != null ? actor.getId() : "system";

        // Atomic conditional update: _id, isDeleted=false, lifecycleState=ACTIVE, and non-expired valid ISO date
        String tomorrowDateStr = BatchFreshness.tomorrowDateString(clockToUse);
        Query atomicQuery = new Query(new Criteria().andOperator(
                Criteria.where("_id").is(batch.getId()),
                Criteria.where("isDeleted").is(false),
                Criteria.where("lifecycleState").is("ACTIVE"),
                Criteria.where("expiryDate").gte(tomorrowDateStr),
                Criteria.where("expiryDate").regex(BatchFreshness.ISO_LOCAL_DATE_REGEX)
        ));

        Batch.DispatchHistoryEntry historyEntry = new Batch.DispatchHistoryEntry(
                actorUsername,
                now,
                trimmedBuyerName,
                effectiveDispatchDate,
                outOfOrder ? trimmedOverrideReason : null,
                outOfOrder
        );

        Update update = new Update()
                .set("lifecycleState", "DISPATCHED")
                .set("buyerName", trimmedBuyerName)
                .set("dispatchDate", effectiveDispatchDate.toString())
                .set("updatedAt", now)
                .push("dispatchHistory", historyEntry);

        if (outOfOrder) {
            String earlierCode = earlierBatchOpt.get().getBatchCode();
            Batch.NoteHistoryEntry overrideNote = new Batch.NoteHistoryEntry(
                    "[FEFO Override] Dispatched out of order ahead of " + earlierCode + ": " + trimmedOverrideReason,
                    actorUsername,
                    now
            );
            update.push("noteHistory", overrideNote);
        }

        Batch updated = mongoTemplate.findAndModify(
                atomicQuery,
                update,
                FindAndModifyOptions.options().returnNew(true),
                Batch.class
        );

        if (updated == null) {
            Batch reloaded = batchRepository.findById(id)
                    .orElseThrow(() -> new ResourceNotFoundException("Batch not found"));
            if (reloaded.isDeleted()) {
                throw new ResourceNotFoundException("Batch not found");
            }
            if ("DISPATCHED".equals(reloaded.getLifecycleState())) {
                throw new ApiException(ErrorCode.CONFLICT, "Batch is already dispatched", HttpStatus.CONFLICT);
            }
            if (reloaded.getExpiryDate() == null || BatchFreshness.calculateDaysUntilExpiry(reloaded.getExpiryDate(), clockToUse) <= 0) {
                throw new ApiException(ErrorCode.BATCH_EXPIRED, "Expired batch cannot be dispatched", HttpStatus.CONFLICT);
            }
            throw new ApiException(ErrorCode.CONFLICT, "Batch state changed concurrently", HttpStatus.CONFLICT);
        }

        // Audit BATCH_DISPATCHED with batchCode, outOfOrder flag, and overrideReason (no buyerName or farmerName PII)
        String auditSummary = outOfOrder
                ? "Batch dispatched with FEFO override: " + updated.getBatchCode() + " (override=true, reason=" + trimmedOverrideReason + ")"
                : "Batch dispatched: " + updated.getBatchCode() + " (override=false)";
        auditService.record(
                actorId,
                actorUsername,
                "BATCH_DISPATCHED",
                "BATCH",
                updated.getId(),
                auditSummary,
                null,
                Map.of("batchCode", updated.getBatchCode(), "outOfOrder", outOfOrder),
                outOfOrder ? trimmedOverrideReason : null
        );

        BatchDetailDto detailDto = mapToDetail(updated, clockToUse);
        if ("FLAGGED".equalsIgnoreCase(latestVerdict)) {
            detailDto.setWarning("Warning: batch dispatched with FLAGGED quality inspection verdict");
        }
        return detailDto;
    }

    public BatchDetailDto updateNote(String id, String note, String editorUsername, String requestId) {
        Batch batch = batchRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Batch not found"));
        if (batch.isDeleted()) {
            throw new ResourceNotFoundException("Batch has been archived");
        }

        if (batch.getTraceabilityNote() != null && !batch.getTraceabilityNote().isEmpty()) {
            batch.getNoteHistory().add(new NoteHistoryEntry(batch.getTraceabilityNote(), editorUsername, clock.instant()));
        }
        batch.setTraceabilityNote(note);
        Batch saved = batchRepository.save(batch);

        auditService.record(null, editorUsername, "BATCH_NOTE_ADDED", "BATCH", saved.getId(), "Batch note updated for: " + saved.getBatchCode());
        return mapToDetail(saved);
    }

    public BatchDetailDto updateRawMaterial(String id, BatchRawMaterialDto dto, String editorUsername, String requestId) {
        Batch batch = batchRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Batch not found"));
        if (batch.isDeleted()) {
            throw new ResourceNotFoundException("Batch has been archived");
        }

        StringBuilder changes = new StringBuilder("[Raw Material Correction] Fields updated:");
        if (dto.getFarmerName() != null) { batch.setFarmerName(dto.getFarmerName().trim()); changes.append(" farmerName"); }
        if (dto.getVillage() != null) { batch.setVillage(dto.getVillage().trim()); changes.append(" village"); }
        if (dto.getSourceLotCode() != null) { batch.setSourceLotCode(dto.getSourceLotCode().trim().toUpperCase()); changes.append(" sourceLotCode"); }
        if (dto.getQuantityProduced() != null) { batch.setQuantityProduced(dto.getQuantityProduced()); changes.append(" quantityProduced"); }
        if (dto.getUnit() != null) { batch.setUnit(dto.getUnit()); changes.append(" unit"); }
        if (dto.getYieldPercent() != null) { batch.setYieldPercent(dto.getYieldPercent()); changes.append(" yieldPercent"); }
        if (dto.getExpiryDate() != null) {
            batch.setExpiryDate(dto.getExpiryDate());
            batch.setShelfLifeSource("manual");
            changes.append(" expiryDate");
        }

        batch.getNoteHistory().add(new NoteHistoryEntry(changes.toString(), editorUsername, clock.instant()));
        Batch saved = batchRepository.save(batch);

        auditService.record(null, editorUsername, "BATCH_RAW_MATERIAL_UPDATED", "BATCH", saved.getId(), "Batch raw material updated for: " + saved.getBatchCode());
        return mapToDetail(saved);
    }

    public BatchDetailDto archiveBatch(String id, String reason, String actorUsername, String requestId) {
        Batch batch = batchRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Batch not found"));
        if (batch.isDeleted()) {
            throw new IllegalStateException("Batch is already archived");
        }
        batch.setDeleted(true);
        batch.setDeletedAt(clock.instant());
        batch.setDeletedBy(actorUsername);
        batch.setDeleteNote(reason);
        Batch saved = batchRepository.save(batch);

        auditService.record(null, actorUsername, "BATCH_ARCHIVED", "BATCH", saved.getId(), "Batch archived: " + saved.getBatchCode());
        return mapToDetail(saved);
    }

    public BatchDetailDto restoreBatch(String id, String actorUsername, String requestId) {
        Batch batch = batchRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Batch not found"));
        if (!batch.isDeleted()) {
            throw new IllegalStateException("Batch is not archived");
        }
        batch.setDeleted(false);
        batch.setDeletedAt(null);
        batch.setDeletedBy(null);
        batch.setDeleteNote(null);
        Batch saved = batchRepository.save(batch);

        auditService.record(null, actorUsername, "BATCH_RESTORED", "BATCH", saved.getId(), "Batch restored: " + saved.getBatchCode());
        return mapToDetail(saved);
    }

    public List<BatchDetailDto> getArchivedBatches() {
        return batchRepository.findByIsDeletedTrue().stream()
                .sorted((a, b) -> {
                    Instant tA = a.getDeletedAt();
                    Instant tB = b.getDeletedAt();
                    if (tA == null && tB == null) return 0;
                    if (tA == null) return 1;
                    if (tB == null) return -1;
                    return tB.compareTo(tA);
                })
                .map(this::mapToDetail)
                .collect(Collectors.toList());
    }

    public long calculateDaysUntilExpiry(LocalDate expiryDate) {
        return calculateDaysUntilExpiry(expiryDate, this.clock);
    }

    public long calculateDaysUntilExpiry(LocalDate expiryDate, Clock clockToUse) {
        return BatchFreshness.calculateDaysUntilExpiry(expiryDate, clockToUse);
    }

    public long calculateDaysUntilExpiry(Instant expiryDate) {
        return calculateDaysUntilExpiry(expiryDate, this.clock);
    }

    public long calculateDaysUntilExpiry(Instant expiryDate, Clock clockToUse) {
        return BatchFreshness.calculateDaysUntilExpiry(expiryDate, clockToUse);
    }

    public String calculateStatus(Batch batch, Clock clockToUse) {
        return BatchFreshness.calculateStatus(batch.getLifecycleState(), batch.getExpiryDate(), clockToUse);
    }

    public void enrichSummary(Batch batch, BatchSummaryDto dto, Clock clockToUse) {
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
        dto.setPriorityScore(batch.getPriorityScore());
        dto.setQualityCheck(batch.getQualityCheck());
        dto.setCreatedBy(batch.getCreatedBy());
        dto.setDeleted(batch.isDeleted());
        dto.setCreatedAt(batch.getCreatedAt());
        dto.setUpdatedAt(batch.getUpdatedAt());

        String status = calculateStatus(batch, clockToUse);
        dto.setStatus(status);
        if (batch.getExpiryDate() == null) {
            dto.setDaysUntilExpiry(null);
            if ("EXCEPTION".equals(status)) {
                dto.setExceptionReason("Missing, null, or unparseable expiryDate");
            } else {
                dto.setExceptionReason(null);
            }
        } else {
            long daysUntilExpiry = calculateDaysUntilExpiry(batch.getExpiryDate(), clockToUse);
            dto.setDaysUntilExpiry(daysUntilExpiry);
            dto.setExceptionReason(null);
        }
    }

    public BatchSummaryDto mapToSummary(Batch batch) {
        return mapToSummary(batch, this.clock);
    }

    public BatchSummaryDto mapToSummary(Batch batch, Clock clockToUse) {
        BatchSummaryDto dto = new BatchSummaryDto();
        enrichSummary(batch, dto, clockToUse);
        return dto;
    }

    public BatchDetailDto mapToDetail(Batch batch) {
        return mapToDetail(batch, this.clock);
    }

    public BatchDetailDto mapToDetail(Batch batch, Clock clockToUse) {
        BatchDetailDto dto = new BatchDetailDto();
        enrichSummary(batch, dto, clockToUse);
        dto.setTraceabilityNote(batch.getTraceabilityNote());
        dto.setNoteHistory(batch.getNoteHistory());
        dto.setDispatchHistory(batch.getDispatchHistory());
        dto.setDeletedAt(batch.getDeletedAt());
        dto.setDeletedBy(batch.getDeletedBy());
        dto.setDeleteNote(batch.getDeleteNote());
        dto.setDispatchDate(batch.getDispatchDate());
        dto.setBuyerName(batch.getBuyerName());
        if (batch.getTraceToken() != null && !batch.getTraceToken().isBlank()) {
            dto.setQrAbsoluteUrl(publicTraceBaseUrl + "/trace/t/" + batch.getTraceToken());
        }
        return dto;
    }
}

