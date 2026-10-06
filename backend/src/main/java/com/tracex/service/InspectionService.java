package com.tracex.service;

import com.mongodb.MongoWriteException;
import com.mongodb.client.model.IndexOptions;
import com.mongodb.client.model.Indexes;
import com.tracex.dto.FieldErrorDto;
import com.tracex.dto.InspectionCreateDto;
import com.tracex.exception.ApiException;
import com.tracex.exception.ErrorCode;
import com.tracex.exception.ResourceNotFoundException;
import com.tracex.exception.ValidationException;
import com.tracex.model.Batch;
import com.tracex.model.Inspection;
import com.tracex.model.User;
import com.tracex.repository.BatchRepository;
import com.tracex.repository.InspectionRepository;
import jakarta.annotation.PostConstruct;
import org.bson.Document;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class InspectionService {

    /**
     * 8 fixed checklist labels from reference backend/src/models/Inspection.model.js lines 17-26.
     */
    public static final List<String> FIXED_CHECKLIST_LABELS = List.of(
            "Packaging integrity",
            "Label accuracy & legibility",
            "Expiry date visible & correct",
            "Weight / quantity correct",
            "No visible contamination",
            "Colour & texture acceptable",
            "Odour within acceptable range",
            "Storage conditions met"
    );

    private static final Set<String> VALID_STATUSES = Set.of("PASSED", "FAILED", "FLAGGED");

    private final InspectionRepository inspectionRepository;
    private final BatchRepository batchRepository;
    private final MongoTemplate mongoTemplate;
    private final AuditService auditService;
    private final Clock clock;

    private final ConcurrentHashMap<String, Object> batchLocks = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Instant> batchLastTimestamp = new ConcurrentHashMap<>();

    public InspectionService(InspectionRepository inspectionRepository,
                             BatchRepository batchRepository,
                             MongoTemplate mongoTemplate,
                             AuditService auditService,
                             Clock clock) {
        this.inspectionRepository = inspectionRepository;
        this.batchRepository = batchRepository;
        this.mongoTemplate = mongoTemplate;
        this.auditService = auditService;
        this.clock = clock;
    }

    @PostConstruct
    public void ensureIndexes() {
        var collection = mongoTemplate.getCollection("inspections");
        // Drop any legacy TTL index if one ever existed
        for (Document idx : collection.listIndexes()) {
            if (idx.containsKey("expireAfterSeconds")) {
                String name = idx.getString("name");
                if (name != null && !"_id_".equals(name)) {
                    collection.dropIndex(name);
                }
            }
        }
        // Partial unique index on { batchId: 1 } where { isLatest: true } (SPEC §4)
        collection.createIndex(
                Indexes.ascending("batchId"),
                new IndexOptions()
                        .name("batchId_isLatest_unique_idx")
                        .unique(true)
                        .partialFilterExpression(new Document("isLatest", true))
        );
        // Supporting query indexes (permanent, no TTL per D-15)
        collection.createIndex(
                Indexes.compoundIndex(Indexes.ascending("batchId"), Indexes.descending("createdAt")),
                new IndexOptions().name("batchId_createdAt_desc_idx")
        );
        collection.createIndex(
                Indexes.compoundIndex(Indexes.ascending("inspectedBy.userId"), Indexes.descending("createdAt")),
                new IndexOptions().name("inspectedBy_userId_createdAt_desc_idx")
        );
        collection.createIndex(
                Indexes.compoundIndex(Indexes.ascending("status"), Indexes.ascending("isLatest"), Indexes.descending("createdAt")),
                new IndexOptions().name("status_isLatest_createdAt_desc_idx")
        );
    }

    public static class InspectionPageResult {
        public List<Inspection> data;
        public long total;
        public int page;
        public int limit;
        public int count;

        public InspectionPageResult(List<Inspection> data, long total, int page, int limit) {
            this.data = data;
            this.total = total;
            this.page = page;
            this.limit = limit;
            this.count = data.size();
        }
    }

    public Inspection createInspection(InspectionCreateDto dto, User actor) {
        List<FieldErrorDto> fieldErrors = new ArrayList<>();

        if (dto == null) {
            fieldErrors.add(new FieldErrorDto("body", "Request body is required"));
            throw new ValidationException("Validation failed", fieldErrors);
        }

        if (dto.getBatchId() == null || dto.getBatchId().trim().isEmpty()) {
            fieldErrors.add(new FieldErrorDto("batchId", "batchId is required"));
        }

        String normalizedStatus = dto.getStatus() != null ? dto.getStatus().trim().toUpperCase() : "";
        if (!VALID_STATUSES.contains(normalizedStatus)) {
            fieldErrors.add(new FieldErrorDto("status", "status must be PASSED, FAILED, or FLAGGED"));
        }

        if (dto.getRating() == null || dto.getRating() < 1 || dto.getRating() > 5) {
            fieldErrors.add(new FieldErrorDto("rating", "rating must be an integer between 1 and 5"));
        }

        if (dto.getFindings() != null && dto.getFindings().length() > 1000) {
            fieldErrors.add(new FieldErrorDto("findings", "findings cannot exceed 1000 characters"));
        }

        if (dto.getRecommendation() != null && dto.getRecommendation().length() > 400) {
            fieldErrors.add(new FieldErrorDto("recommendation", "recommendation cannot exceed 400 characters"));
        }

        Map<String, Inspection.ChecklistItem> providedItemsByLabel = new LinkedHashMap<>();
        boolean anyChecklistFailed = false;

        if (dto.getChecklist() != null) {
            for (int i = 0; i < dto.getChecklist().size(); i++) {
                Inspection.ChecklistItem item = dto.getChecklist().get(i);
                if (item == null || item.getLabel() == null || item.getLabel().trim().isEmpty()) {
                    fieldErrors.add(new FieldErrorDto("checklist", "Checklist item label is required"));
                    continue;
                }
                String label = item.getLabel().trim();
                if (!FIXED_CHECKLIST_LABELS.contains(label)) {
                    fieldErrors.add(new FieldErrorDto("checklist", "Unknown checklist label: " + label));
                    continue;
                }
                if (providedItemsByLabel.containsKey(label)) {
                    fieldErrors.add(new FieldErrorDto("checklist", "Duplicate checklist label: " + label));
                    continue;
                }
                String note = item.getNote() != null ? item.getNote().trim() : "";
                if (note.length() > 200) {
                    fieldErrors.add(new FieldErrorDto("checklist", "Checklist note for '" + label + "' cannot exceed 200 characters"));
                }
                if (Boolean.FALSE.equals(item.getPassed())) {
                    anyChecklistFailed = true;
                }
                providedItemsByLabel.put(label, new Inspection.ChecklistItem(label, item.getPassed(), note));
            }
        }

        // D-13: Server rejects PASSED verdict if any checklist item has passed == false (null does not block PASSED)
        if ("PASSED".equals(normalizedStatus) && anyChecklistFailed) {
            fieldErrors.add(new FieldErrorDto("status", "Cannot submit PASSED verdict when one or more checklist items have passed=false"));
        }

        if (!fieldErrors.isEmpty()) {
            throw new ValidationException("Validation failed", fieldErrors);
        }

        // Build canonical 8-item checklist
        List<Inspection.ChecklistItem> normalizedChecklist = new ArrayList<>(FIXED_CHECKLIST_LABELS.size());
        for (String fixedLabel : FIXED_CHECKLIST_LABELS) {
            Inspection.ChecklistItem item = providedItemsByLabel.get(fixedLabel);
            if (item != null) {
                normalizedChecklist.add(item);
            } else {
                normalizedChecklist.add(new Inspection.ChecklistItem(fixedLabel, null, ""));
            }
        }

        // Verify batch exists, is not soft-deleted (404), and is not DISPATCHED (409)
        // Reference citation: backend/src/controllers/inspection.controller.js lines 39-42
        Batch batch = batchRepository.findById(dto.getBatchId().trim())
                .orElseThrow(() -> new ResourceNotFoundException("Batch not found"));
        if (batch.isDeleted()) {
            throw new ResourceNotFoundException("Batch not found");
        }
        if ("DISPATCHED".equals(batch.getLifecycleState())) {
            throw new ApiException(ErrorCode.CONFLICT, "Cannot inspect a dispatched batch", HttpStatus.CONFLICT);
        }

        String inspectorDisplayName = (actor.getName() != null && !actor.getName().isBlank())
                ? actor.getName()
                : actor.getUsername();

        Object lock = batchLocks.computeIfAbsent(batch.getId(), k -> new Object());
        Inspection savedInspection = null;

        synchronized (lock) {
            int attempts = 0;
            while (attempts < 5) {
                attempts++;
                try {
                    Instant now = clock.instant();
                    Instant prev = batchLastTimestamp.get(batch.getId());
                    if (prev != null && !now.isAfter(prev)) {
                        now = prev.plusMillis(1);
                    }
                    batchLastTimestamp.put(batch.getId(), now);

                    // Step 1: Clear previous isLatest=true for this batch
                    mongoTemplate.updateMulti(
                            Query.query(Criteria.where("batchId").is(batch.getId()).and("isLatest").is(true)),
                            new Update().set("isLatest", false),
                            Inspection.class
                    );

                    // Step 2: Insert new inspection with isLatest=true (client-supplied isLatest is ignored)
                    Inspection inspection = new Inspection();
                    inspection.setBatchId(batch.getId());
                    inspection.setBatchCode(batch.getBatchCode());
                    inspection.setProductName(batch.getProductName());
                    inspection.setSku(batch.getSku());
                    inspection.setStatus(normalizedStatus);
                    inspection.setRating(dto.getRating());
                    inspection.setChecklist(normalizedChecklist);
                    inspection.setFindings(dto.getFindings() != null ? dto.getFindings().trim() : "");
                    inspection.setRecommendation(dto.getRecommendation() != null ? dto.getRecommendation().trim() : "");
                    inspection.setInspectedBy(new Inspection.InspectedBy(actor.getId(), inspectorDisplayName, actor.getUsername()));
                    inspection.setLatest(true);
                    inspection.setCreatedAt(now);

                    savedInspection = mongoTemplate.insert(inspection, "inspections");

                    // Step 3: Denormalize qualityCheck snapshot onto Batch document
                    Batch.QualityCheck snapshot = new Batch.QualityCheck(
                            savedInspection.getStatus(),
                            savedInspection.getRating(),
                            savedInspection.getCreatedAt(),
                            inspectorDisplayName
                    );
                    mongoTemplate.updateFirst(
                            Query.query(Criteria.where("_id").is(batch.getId())),
                            new Update().set("qualityCheck", snapshot).set("updatedAt", now),
                            Batch.class
                    );
                    break;
                } catch (DuplicateKeyException e) {
                    if (attempts >= 5) {
                        throw e;
                    }
                } catch (RuntimeException e) {
                    if (e.getCause() instanceof MongoWriteException mwe && mwe.getError().getCode() == 11000 && attempts < 5) {
                        continue;
                    }
                    throw e;
                }
            }
        }

        // Audit log: INSPECTION_CREATED with batchCode and verdict (no PII)
        auditService.record(
                actor.getId(),
                actor.getUsername(),
                "INSPECTION_CREATED",
                "INSPECTION",
                savedInspection.getId(),
                "Inspection created for batch " + batch.getBatchCode() + " with verdict " + savedInspection.getStatus()
        );

        return savedInspection;
    }

    public InspectionPageResult listLatestInspections(int page, int limit, String status) {
        int safePage = Math.max(1, page);
        int safeLimit = Math.max(1, Math.min(limit, 200));

        Query query = new Query();
        query.addCriteria(Criteria.where("isLatest").is(true));
        if (status != null && !status.trim().isEmpty()) {
            query.addCriteria(Criteria.where("status").is(status.trim().toUpperCase()));
        }

        long total = mongoTemplate.count(query, Inspection.class);
        Pageable pageable = PageRequest.of(safePage - 1, safeLimit, Sort.by(Sort.Direction.DESC, "createdAt"));
        query.with(pageable);

        List<Inspection> docs = mongoTemplate.find(query, Inspection.class);
        return new InspectionPageResult(docs, total, safePage, safeLimit);
    }

    public InspectionPageResult listMyInspections(String userId, int page, int limit) {
        int safePage = Math.max(1, page);
        int safeLimit = Math.max(1, Math.min(limit, 200));

        Query query = new Query(Criteria.where("inspectedBy.userId").is(userId));
        long total = mongoTemplate.count(query, Inspection.class);
        Pageable pageable = PageRequest.of(safePage - 1, safeLimit, Sort.by(Sort.Direction.DESC, "createdAt"));
        query.with(pageable);

        List<Inspection> docs = mongoTemplate.find(query, Inspection.class);
        return new InspectionPageResult(docs, total, safePage, safeLimit);
    }

    public List<Inspection> listByBatchId(String batchId) {
        return inspectionRepository.findByBatchIdOrderByCreatedAtDesc(batchId);
    }

    public Inspection getById(String id) {
        return inspectionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Inspection not found"));
    }
}
