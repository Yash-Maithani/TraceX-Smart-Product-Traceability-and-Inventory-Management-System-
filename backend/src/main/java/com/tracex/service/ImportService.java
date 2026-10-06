package com.tracex.service;

import com.tracex.dto.BatchCreateDto;
import com.tracex.dto.BatchDetailDto;
import com.tracex.dto.ImportDtos.*;
import com.tracex.exception.ApiException;
import com.tracex.exception.ErrorCode;
import com.tracex.exception.ResourceNotFoundException;
import com.tracex.exception.ValidationException;
import com.tracex.model.Batch;
import com.tracex.model.ImportJob;
import com.tracex.model.Product;
import com.tracex.model.User;
import com.tracex.repository.BatchRepository;
import com.tracex.repository.ImportJobRepository;
import com.tracex.repository.ProductRepository;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.DateTimeException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class ImportService {

    public static final int MAX_CHUNK_ROWS = 500;
    public static final int MAX_JOB_ROWS = 10000;
    public static final int MAX_STORED_ERRORS = 200;
    public static final int MAX_PREVIEW_ROWS = 500;
    public static final int MAX_HISTORY_JOBS = 25;
    public static final String DEDUPE_RULE = "Source Lot Code + Product SKU + Pack Date";

    private static final Pattern ISO_DATE_PATTERN = Pattern.compile("^(\\d{4})-(\\d{2})-(\\d{2})$");
    private static final Pattern DAY_FIRST_PATTERN = Pattern.compile("^(\\d{1,2})([/\\-.])(\\d{1,2})\\2(\\d{4})$");

    private static final Map<String, String> UNIT_ALIASES = Map.ofEntries(
            Map.entry("kg", "Kg"),
            Map.entry("kgs", "Kg"),
            Map.entry("kilogram", "Kg"),
            Map.entry("kilograms", "Kg"),
            Map.entry("unit", "Units"),
            Map.entry("units", "Units"),
            Map.entry("pcs", "Units"),
            Map.entry("pieces", "Units"),
            Map.entry("pack", "Units"),
            Map.entry("packs", "Units"),
            Map.entry("jar", "Units"),
            Map.entry("jars", "Units"),
            Map.entry("bottle", "Units"),
            Map.entry("bottles", "Units"),
            Map.entry("l", "Liters"),
            Map.entry("lt", "Liters"),
            Map.entry("ltr", "Liters"),
            Map.entry("liter", "Liters"),
            Map.entry("liters", "Liters"),
            Map.entry("litre", "Liters"),
            Map.entry("litres", "Liters")
    );

    private static class ColumnSpec {
        final String key;
        final String label;
        final boolean required;
        final String type;
        final String example;
        final String hint;
        final List<String> enumValues;
        final List<String> aliases;

        ColumnSpec(String key, String label, boolean required, String type, String example, String hint, List<String> enumValues, List<String> aliases) {
            this.key = key;
            this.label = label;
            this.required = required;
            this.type = type;
            this.example = example;
            this.hint = hint;
            this.enumValues = enumValues;
            this.aliases = aliases;
        }
    }

    private static final List<ColumnSpec> IMPORT_COLUMNS = List.of(
            new ColumnSpec(
                    "productSku",
                    "Product SKU",
                    true,
                    "string",
                    "WBJC",
                    "Matches Product.sku (preferred) or falls back to Product Name",
                    null,
                    List.of("sku", "productsku", "productcode", "itemsku", "itemcode", "batchsku", "skucode")
            ),
            new ColumnSpec(
                    "productName",
                    "Product Name",
                    false,
                    "string",
                    "Wild Berry Juice Concentrate",
                    "Used only if Product SKU is omitted; must match an active catalogue product",
                    null,
                    List.of("product", "productname", "itemname", "item")
            ),
            new ColumnSpec(
                    "sourceLotCode",
                    "Source Lot Code",
                    true,
                    "string",
                    "LOT-UK-2026-104",
                    "Raw-material lot identifier from the supplier or farm",
                    null,
                    List.of("lot", "lotcode", "sourcelot", "sourcelotcode", "rawlot", "lotno", "lotnumber")
            ),
            new ColumnSpec(
                    "farmerName",
                    "Farmer Name",
                    true,
                    "string",
                    "Kundan Bisht",
                    "Primary producer or supplier name",
                    null,
                    List.of("farmer", "farmername", "supplier", "suppliername", "grower")
            ),
            new ColumnSpec(
                    "village",
                    "Village",
                    true,
                    "string",
                    "Almora",
                    "Source village or collection centre",
                    null,
                    List.of("village", "source", "origin", "location")
            ),
            new ColumnSpec(
                    "quantityProduced",
                    "Quantity Produced",
                    true,
                    "number",
                    "120",
                    "Whole or decimal quantity >= 1",
                    null,
                    List.of("quantity", "qty", "quantityproduced", "output", "produced")
            ),
            new ColumnSpec(
                    "unit",
                    "Unit",
                    true,
                    "enum",
                    "Kg",
                    "One of Kg, Units, Liters (common aliases like kgs, pcs, ltr are normalised)",
                    List.of("Kg", "Units", "Liters"),
                    List.of("unit", "uom", "units", "measure")
            ),
            new ColumnSpec(
                    "yieldPercent",
                    "Yield %",
                    true,
                    "number",
                    "86",
                    "Processing yield percentage between 0 and 100",
                    null,
                    List.of("yield", "yieldpercent", "yieldpct", "yieldpercentage", "recovery")
            ),
            new ColumnSpec(
                    "packDate",
                    "Pack Date",
                    true,
                    "date",
                    "2026-10-01",
                    "ISO (YYYY-MM-DD) or DD/MM/YYYY",
                    null,
                    List.of("packdate", "packed", "packedon", "productiondate", "date", "mfgdate", "manufactured")
            )
    );

    private final ImportJobRepository importJobRepository;
    private final ProductRepository productRepository;
    private final BatchRepository batchRepository;
    private final BatchService batchService;
    private final AuditService auditService;
    private final MongoTemplate mongoTemplate;
    private final Validator validator;
    private final Clock clock;
    private long staleRunningMinutes;

    public ImportService(
            ImportJobRepository importJobRepository,
            ProductRepository productRepository,
            BatchRepository batchRepository,
            BatchService batchService,
            AuditService auditService,
            MongoTemplate mongoTemplate,
            Validator validator,
            Clock clock,
            @Value("${tracex.import.stale-running-minutes:15}") long staleRunningMinutes
    ) {
        this.importJobRepository = importJobRepository;
        this.productRepository = productRepository;
        this.batchRepository = batchRepository;
        this.batchService = batchService;
        this.auditService = auditService;
        this.mongoTemplate = mongoTemplate;
        this.validator = validator;
        this.clock = clock;
        this.staleRunningMinutes = staleRunningMinutes;
    }

    public long getStaleRunningMinutes() {
        return staleRunningMinutes;
    }

    public void setStaleRunningMinutes(long staleRunningMinutes) {
        this.staleRunningMinutes = staleRunningMinutes;
    }

    public ImportSchemaDto getSchema() {
        List<ImportColumnDto> cols = IMPORT_COLUMNS.stream()
                .map(c -> new ImportColumnDto(c.key, c.label, c.required, c.type, c.example, c.hint, c.enumValues))
                .collect(Collectors.toList());
        return new ImportSchemaDto(cols, MAX_CHUNK_ROWS, DEDUPE_RULE);
    }

    public ImportMapHeadersResponseDto mapHeaders(List<String> rawHeaders) {
        List<String> cleaned = new ArrayList<>();
        if (rawHeaders != null) {
            for (String h : rawHeaders) {
                if (h != null) {
                    String trimmed = h.trim();
                    if (!trimmed.isEmpty()) {
                        cleaned.add(trimmed);
                    }
                }
            }
        }

        Map<String, String> mapping = new LinkedHashMap<>();
        List<String> unmappedRequired = new ArrayList<>();
        Set<String> taken = new HashSet<>();

        for (ColumnSpec col : IMPORT_COLUMNS) {
            String hit = null;
            for (String h : cleaned) {
                if (taken.contains(h)) {
                    continue;
                }
                String tok = headerToken(h);
                if (tok.equals(headerToken(col.key)) || tok.equals(headerToken(col.label)) || col.aliases.contains(tok)) {
                    hit = h;
                    break;
                }
            }
            if (hit != null) {
                mapping.put(col.key, hit);
                taken.add(hit);
            } else if (col.required) {
                unmappedRequired.add(col.key);
            }
        }

        if (mapping.containsKey("productName")) {
            unmappedRequired.remove("productSku");
        }

        return new ImportMapHeadersResponseDto(mapping, unmappedRequired);
    }

    public ImportValidateResponseDto validate(ImportValidateRequestDto req) {
        List<Map<String, Object>> rows = req != null ? req.getRows() : null;
        validateChunkSize(rows);

        int rowOffset = (req.getRowOffset() != null && req.getRowOffset() >= 1) ? req.getRowOffset() : 2;
        Set<String> priorKeys = new HashSet<>();
        if (req.getPriorKeys() != null) {
            for (String k : req.getPriorKeys()) {
                if (k != null && !k.trim().isEmpty()) {
                    priorKeys.add(k.trim());
                }
            }
        }

        List<AnalysedRow> results = analyseRows(rows, rowOffset, priorKeys);

        int insertCount = 0;
        int skipCount = 0;
        int errorCount = 0;
        List<ImportPreviewRowDto> preview = new ArrayList<>();

        for (AnalysedRow r : results) {
            if ("insert".equals(r.verdict)) {
                insertCount++;
            } else if ("skip".equals(r.verdict)) {
                skipCount++;
            } else {
                errorCount++;
            }

            if (preview.size() < MAX_PREVIEW_ROWS) {
                ImportPreviewRowDto p = new ImportPreviewRowDto();
                p.setRowNumber(r.rowNumber);
                p.setVerdict(r.verdict);
                p.setReason(r.reason);
                if (r.product != null) {
                    p.setProduct(new ImportPreviewProductDto(r.product.getSku(), r.product.getProductName()));
                }
                p.setSourceLotCode(r.sourceLotCode);
                p.setVillage(r.village);
                p.setQuantityProduced(r.quantityProduced);
                p.setUnit(r.unit);
                p.setYieldPercent(r.yieldPercent);
                p.setPackDate(r.packDate != null ? r.packDate.toString() : null);
                p.setInsertKey("insert".equals(r.verdict) ? r.insertKey : null);
                p.setErrors(r.errors);
                preview.add(p);
            }
        }

        ImportValidateSummaryDto summary = new ImportValidateSummaryDto(results.size(), insertCount, skipCount, errorCount);
        return new ImportValidateResponseDto(summary, preview);
    }

    public ImportCommitResponseDto commit(ImportCommitRequestDto req, User actor, String requestId) {
        List<Map<String, Object>> rows = req != null ? req.getRows() : null;
        validateChunkSize(rows);

        int effectiveTotalRows = (req.getTotalRows() != null && req.getTotalRows() > 0)
                ? req.getTotalRows()
                : rows.size();
        if (effectiveTotalRows > MAX_JOB_ROWS) {
            throw new ValidationException("rows", "Import job exceeds the maximum of 10,000 rows per job");
        }

        int rowOffset = (req.getRowOffset() != null && req.getRowOffset() >= 1) ? req.getRowOffset() : 2;
        boolean isFinal = req.getIsFinal() == null || req.getIsFinal();

        ImportJob job;
        String requestedJobId = req.getJobId() != null ? req.getJobId().trim() : "";
        if (!requestedJobId.isEmpty()) {
            job = importJobRepository.findById(requestedJobId)
                    .orElseThrow(() -> new ResourceNotFoundException("Import job not found"));
            // Part A.1: Job join requires job.createdBy == actor.username, else 404 NOT_FOUND
            if (!Objects.equals(job.getCreatedBy(), actor.getUsername())) {
                throw new ResourceNotFoundException("Import job not found");
            }
            // Part A.2: Lazily mark stale running jobs as failed
            markJobFailedIfStale(job);
            // Part A.1: Status must be "running", else 409 CONFLICT
            if (!"running".equals(job.getStatus())) {
                throw new ApiException(ErrorCode.CONFLICT, "Import job is not running (status: " + job.getStatus() + ")", HttpStatus.CONFLICT);
            }
            // Part A.1 & A.4: Pushing total over 10,000 rows returns 422 on "rows"
            if (job.getProcessedRows() + rows.size() > MAX_JOB_ROWS) {
                throw new ValidationException("rows", "Import job exceeds the maximum of 10,000 rows per job");
            }
        } else {
            Instant now = clock.instant();
            job = new ImportJob();
            String rawFileName = req.getFileName() != null ? req.getFileName().trim() : "";
            job.setFileName(rawFileName.isEmpty() ? "upload.csv" : rawFileName.substring(0, Math.min(200, rawFileName.length())));
            job.setEntity("batch");
            job.setStatus("running");
            job.setTotalRows(effectiveTotalRows);
            job.setCreatedBy(actor.getUsername());
            job.setCreatedByRole(actor.isSuperAdmin() ? "super-admin" : actor.getRole().getValue());
            job.setCreatedAt(now);
            job.setUpdatedAt(now);
            job = importJobRepository.save(job);
        }

        List<AnalysedRow> results = analyseRows(rows, rowOffset, Set.of());

        List<String> chunkInsertedIds = new ArrayList<>();
        List<ImportedBatchSummaryDto> chunkBatches = new ArrayList<>();
        List<ImportJob.RowError> chunkErrors = new ArrayList<>();
        int chunkSkippedCount = 0;
        int chunkErroredRowCount = 0;

        String initialNote = "Bulk imported from " + job.getFileName() + " (import #" + job.getId() + ")";

        for (AnalysedRow r : results) {
            if ("error".equals(r.verdict)) {
                chunkErroredRowCount++;
                for (ImportFieldErrorDto err : r.errors) {
                    chunkErrors.add(new ImportJob.RowError(
                            r.rowNumber,
                            err.getField(),
                            err.getMessage(),
                            r.sourceLotCode
                    ));
                }
            } else if ("skip".equals(r.verdict)) {
                chunkSkippedCount++;
            } else if ("insert".equals(r.verdict)) {
                try {
                    BatchDetailDto created = batchService.createBatchForProduct(
                            r.product,
                            r.batchCreateDto,
                            actor.getUsername(),
                            requestId,
                            initialNote
                    );
                    chunkInsertedIds.add(created.getId());
                    chunkBatches.add(new ImportedBatchSummaryDto(
                            created.getId(),
                            created.getBatchCode(),
                            created.getProductName(),
                            created.getSku(),
                            created.getSourceLotCode(),
                            created.getPackDate() != null ? created.getPackDate().toString() : null,
                            created.getExpiryDate() != null ? created.getExpiryDate().toString() : null,
                            created.getStatus()
                    ));
                } catch (Exception ex) {
                    chunkErroredRowCount++;
                    chunkErrors.add(new ImportJob.RowError(
                            r.rowNumber,
                            "database",
                            "Failed to create batch for row",
                            r.sourceLotCode
                    ));
                }
            }
        }

        job.setInserted(job.getInserted() + chunkInsertedIds.size());
        job.setSkipped(job.getSkipped() + chunkSkippedCount);
        job.setErrored(job.getErrored() + chunkErroredRowCount);
        job.setProcessedRows(job.getProcessedRows() + rows.size());
        job.getInsertedBatchIds().addAll(chunkInsertedIds);

        for (ImportJob.RowError err : chunkErrors) {
            if (job.getRowErrors().size() < MAX_STORED_ERRORS) {
                job.getRowErrors().add(err);
            } else {
                job.setRowErrorsTruncated(true);
                break;
            }
        }

        Instant now = clock.instant();
        job.setUpdatedAt(now);

        if (isFinal) {
            // Part A.5: Final status is "failed" only when inserted == 0 and errored > 0.
            String finalStatus = (job.getInserted() == 0 && job.getErrored() > 0) ? "failed" : "done";
            job.setStatus(finalStatus);
            job.setFinishedAt(now);
        }

        job = importJobRepository.save(job);

        if (isFinal) {
            auditService.record(
                    actor.getId(),
                    actor.getUsername(),
                    "IMPORT_FINISHED",
                    "IMPORT_JOB",
                    job.getId(),
                    String.format("Bulk import %s finished (%s): inserted=%d, skipped=%d, errored=%d",
                            job.getId(), job.getStatus(), job.getInserted(), job.getSkipped(), job.getErrored()),
                    null,
                    Map.of(
                            "jobId", job.getId(),
                            "status", job.getStatus(),
                            "inserted", job.getInserted(),
                            "skipped", job.getSkipped(),
                            "errored", job.getErrored(),
                            "totalRows", job.getTotalRows()
                    ),
                    null
            );
        }

        ImportCommitResponseDto resp = new ImportCommitResponseDto();
        resp.setJobId(job.getId());
        resp.setStatus(job.getStatus());
        resp.setChunkInserted(chunkInsertedIds.size());
        resp.setChunkSkipped(chunkSkippedCount);
        resp.setChunkErrored(chunkErroredRowCount);
        resp.setTotals(new ImportCommitTotalsDto(
                job.getProcessedRows(),
                job.getTotalRows(),
                job.getInserted(),
                job.getSkipped(),
                job.getErrored()
        ));
        resp.setBatches(chunkBatches);
        resp.setErrors(chunkErrors.size() > 50 ? chunkErrors.subList(0, 50) : chunkErrors);
        resp.setRowErrorsTruncated(job.isRowErrorsTruncated());
        return resp;
    }

    public List<ImportJobSummaryDto> listJobs() {
        markAllStaleRunningJobsFailed();
        List<ImportJob> jobs = importJobRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(0, MAX_HISTORY_JOBS));
        return jobs.stream().map(this::toSummaryDto).collect(Collectors.toList());
    }

    public ImportJobDetailDto getJobDetail(String id) {
        ImportJob job = importJobRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Import job not found"));
        markJobFailedIfStale(job);
        return toDetailDto(job);
    }

    public ImportRollbackResponseDto rollback(String id, User actor, String requestId) {
        ImportJob job = importJobRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Import job not found"));

        // Part A.2: Lazily mark stale running jobs as failed before checking status
        markJobFailedIfStale(job);

        if ("rolled_back".equals(job.getStatus())) {
            throw new ApiException(ErrorCode.CONFLICT, "This import has already been rolled back", HttpStatus.CONFLICT);
        }
        if ("running".equals(job.getStatus())) {
            throw new ApiException(ErrorCode.CONFLICT, "Cannot roll back an import that is still running", HttpStatus.CONFLICT);
        }
        if (!"done".equals(job.getStatus()) && !"failed".equals(job.getStatus())) {
            throw new ApiException(ErrorCode.CONFLICT, "Cannot roll back import in status: " + job.getStatus(), HttpStatus.CONFLICT);
        }
        if (job.getInsertedBatchIds() == null || job.getInsertedBatchIds().isEmpty()) {
            throw new ApiException(ErrorCode.CONFLICT, "This import did not create any batches to roll back", HttpStatus.CONFLICT);
        }

        List<Batch> batches = batchRepository.findAllById(job.getInsertedBatchIds());

        // Precondition pass: if ANY inserted batch is dispatched, return 409 CONFLICT and change nothing
        for (Batch batch : batches) {
            if ("DISPATCHED".equals(batch.getLifecycleState())) {
                throw new ApiException(
                        ErrorCode.CONFLICT,
                        "Cannot roll back import because batch " + batch.getBatchCode() + " has already been dispatched",
                        HttpStatus.CONFLICT
                );
            }
        }

        int archived = 0;
        int alreadyArchived = 0;
        String reason = "Import rollback " + job.getId();

        for (Batch batch : batches) {
            if (batch.isDeleted()) {
                alreadyArchived++;
            } else {
                batchService.archiveBatch(batch.getId(), reason, actor.getUsername(), requestId);
                archived++;
            }
        }

        Instant now = clock.instant();
        job.setStatus("rolled_back");
        job.setRolledBackAt(now);
        job.setRolledBackBy(actor.getUsername());
        job.setUpdatedAt(now);
        importJobRepository.save(job);

        auditService.record(
                actor.getId(),
                actor.getUsername(),
                "IMPORT_ROLLED_BACK",
                "IMPORT_JOB",
                job.getId(),
                String.format("Import job %s rolled back: archived=%d, alreadyArchived=%d", job.getId(), archived, alreadyArchived),
                null,
                Map.of(
                        "jobId", job.getId(),
                        "archived", archived,
                        "alreadyArchived", alreadyArchived
                ),
                reason
        );

        return new ImportRollbackResponseDto(
                job.getId(),
                job.getStatus(),
                archived,
                alreadyArchived,
                job.getRolledBackAt(),
                job.getRolledBackBy()
        );
    }

    private void markAllStaleRunningJobsFailed() {
        List<ImportJob> runningJobs = importJobRepository.findByStatus("running");
        for (ImportJob job : runningJobs) {
            markJobFailedIfStale(job);
        }
    }

    private void markJobFailedIfStale(ImportJob job) {
        if (job == null || !"running".equals(job.getStatus())) {
            return;
        }
        Instant now = clock.instant();
        Instant lastUpdate = job.getUpdatedAt() != null ? job.getUpdatedAt() : job.getCreatedAt();
        if (lastUpdate == null) {
            lastUpdate = now;
        }
        Instant cutoff = now.minus(Duration.ofMinutes(staleRunningMinutes));
        if (!lastUpdate.isAfter(cutoff)) {
            job.setStatus("failed");
            job.setFinishedAt(now);
            job.setUpdatedAt(now);
            importJobRepository.save(job);
        }
    }

    private void validateChunkSize(List<Map<String, Object>> rows) {
        if (rows == null || rows.isEmpty()) {
            throw new ValidationException("rows", "No rows supplied");
        }
        if (rows.size() > MAX_CHUNK_ROWS) {
            throw new ValidationException("rows", "Too many rows in one request — send at most 500 per chunk");
        }
    }

    private static class AnalysedRow {
        int rowNumber;
        String verdict;
        String reason;
        Product product;
        String sourceLotCode;
        String farmerName;
        String village;
        Integer quantityProduced;
        String unit;
        Double yieldPercent;
        LocalDate packDate;
        String insertKey;
        BatchCreateDto batchCreateDto;
        List<ImportFieldErrorDto> errors = new ArrayList<>();
    }

    private List<AnalysedRow> analyseRows(List<Map<String, Object>> rawRows, int rowOffset, Set<String> priorKeys) {
        List<AnalysedRow> parsed = new ArrayList<>(rawRows.size());
        Set<String> candidateSkus = new HashSet<>();
        Set<String> candidateNamesLower = new HashSet<>();

        for (int idx = 0; idx < rawRows.size(); idx++) {
            Map<String, Object> raw = rawRows.get(idx) != null ? rawRows.get(idx) : Map.of();
            AnalysedRow row = new AnalysedRow();
            row.rowNumber = rowOffset + idx;

            String sku = cleanString(raw.get("productSku")).toUpperCase(Locale.ROOT);
            String name = cleanString(raw.get("productName"));
            if (sku.isEmpty() && name.isEmpty()) {
                row.errors.add(new ImportFieldErrorDto("productSku", "Needs a Product SKU or a Product Name"));
            } else {
                if (!sku.isEmpty()) candidateSkus.add(sku);
                if (!name.isEmpty()) candidateNamesLower.add(name.toLowerCase(Locale.ROOT));
            }

            String lot = cleanString(raw.get("sourceLotCode")).toUpperCase(Locale.ROOT);
            if (lot.isEmpty()) {
                row.errors.add(new ImportFieldErrorDto("sourceLotCode", "Source lot code is required"));
            } else if (lot.length() > 100) {
                row.errors.add(new ImportFieldErrorDto("sourceLotCode", "Source lot code must be at most 100 characters"));
                row.sourceLotCode = lot.substring(0, 100);
            } else {
                row.sourceLotCode = lot;
            }

            String farmer = cleanString(raw.get("farmerName"));
            if (farmer.isEmpty()) {
                row.errors.add(new ImportFieldErrorDto("farmerName", "Farmer name is required"));
            } else if (farmer.length() > 200) {
                row.errors.add(new ImportFieldErrorDto("farmerName", "Farmer name must be at most 200 characters"));
            } else {
                row.farmerName = farmer;
            }

            String village = cleanString(raw.get("village"));
            if (village.isEmpty()) {
                row.errors.add(new ImportFieldErrorDto("village", "Village is required"));
            } else if (village.length() > 200) {
                row.errors.add(new ImportFieldErrorDto("village", "Village must be at most 200 characters"));
            } else {
                row.village = village;
            }

            Double qtyDouble = parseNumber(raw.get("quantityProduced"));
            if (qtyDouble == null) {
                row.errors.add(new ImportFieldErrorDto("quantityProduced", "Quantity must be a number"));
            } else if (qtyDouble < 1.0 || qtyDouble > Integer.MAX_VALUE) {
                row.errors.add(new ImportFieldErrorDto("quantityProduced", "Quantity must be at least 1"));
            } else {
                row.quantityProduced = (int) Math.round(qtyDouble);
            }

            String unit = normaliseUnit(raw.get("unit"));
            if (unit == null) {
                row.errors.add(new ImportFieldErrorDto("unit", "Unit must be Kg, Units or Liters"));
            } else {
                row.unit = unit;
            }

            Double yld = parseNumber(raw.get("yieldPercent"));
            if (yld == null) {
                row.errors.add(new ImportFieldErrorDto("yieldPercent", "Yield must be a number"));
            } else if (yld < 0.0 || yld > 100.0) {
                row.errors.add(new ImportFieldErrorDto("yieldPercent", "Yield must be between 0 and 100"));
            } else {
                row.yieldPercent = yld;
            }

            LocalDate packDate = parseStrictPackDate(raw.get("packDate"));
            if (packDate == null) {
                row.errors.add(new ImportFieldErrorDto("packDate", "Pack date must be DD/MM/YYYY or YYYY-MM-DD"));
            } else {
                row.packDate = packDate;
            }

            parsed.add(row);
        }

        // Resolve products from catalogue
        List<Product> allProducts = productRepository.findAll();
        Map<String, Product> bySku = new HashMap<>();
        Map<String, Product> byNameLower = new HashMap<>();
        for (Product p : allProducts) {
            if (p.getSku() != null) {
                bySku.put(p.getSku().trim().toUpperCase(Locale.ROOT), p);
            }
            if (p.getProductName() != null) {
                byNameLower.put(p.getProductName().trim().toLowerCase(Locale.ROOT), p);
            }
        }

        Set<String> candidateLotsForDedupe = new HashSet<>();
        for (int idx = 0; idx < parsed.size(); idx++) {
            AnalysedRow row = parsed.get(idx);
            Map<String, Object> raw = rawRows.get(idx) != null ? rawRows.get(idx) : Map.of();
            String sku = cleanString(raw.get("productSku")).toUpperCase(Locale.ROOT);
            String name = cleanString(raw.get("productName"));

            if (!sku.isEmpty() || !name.isEmpty()) {
                Product product = !sku.isEmpty() ? bySku.get(sku) : null;
                if (product == null && !name.isEmpty()) {
                    product = byNameLower.get(name.toLowerCase(Locale.ROOT));
                }
                if (product == null) {
                    String label = !sku.isEmpty() ? sku : name;
                    row.errors.add(new ImportFieldErrorDto("productSku", "No catalogue product matches \"" + label + "\""));
                } else if (!isValidProductContract(product)) {
                    row.errors.add(new ImportFieldErrorDto("productSku", "Product \"" + product.getProductName() + "\" failed the catalogue contract"));
                } else {
                    row.product = product;
                }
            }

            if (row.errors.isEmpty() && row.product != null) {
                // Validate constructed BatchCreateDto with existing Jakarta Bean Validator (D-23)
                BatchCreateDto dto = new BatchCreateDto();
                dto.setProductId(row.product.getId());
                dto.setSourceLotCode(row.sourceLotCode);
                dto.setFarmerName(row.farmerName);
                dto.setVillage(row.village);
                dto.setQuantityProduced(row.quantityProduced);
                dto.setUnit(row.unit);
                dto.setYieldPercent(row.yieldPercent);
                dto.setPackDate(row.packDate);

                Set<ConstraintViolation<BatchCreateDto>> violations = validator.validate(dto);
                for (ConstraintViolation<BatchCreateDto> v : violations) {
                    row.errors.add(new ImportFieldErrorDto(v.getPropertyPath().toString(), v.getMessage()));
                }

                if (row.errors.isEmpty()) {
                    row.batchCreateDto = dto;
                    candidateLotsForDedupe.add(row.sourceLotCode);
                }
            }
        }

        Set<String> existingKeys = findExistingActiveKeys(candidateLotsForDedupe);
        Set<String> seenInFile = new HashSet<>(priorKeys);

        for (AnalysedRow row : parsed) {
            if (!row.errors.isEmpty()) {
                row.verdict = "error";
                continue;
            }
            String key = buildDedupeKey(row.product.getSku(), row.sourceLotCode, row.packDate);
            row.insertKey = key;

            if (existingKeys.contains(key)) {
                row.verdict = "skip";
                row.reason = "Already imported — lot " + row.sourceLotCode + " / " + row.product.getSku() + " / " + row.packDate;
            } else if (seenInFile.contains(key)) {
                row.verdict = "skip";
                row.reason = "Duplicate of an earlier row in this file (same lot, product and pack date)";
            } else {
                seenInFile.add(key);
                row.verdict = "insert";
            }
        }

        return parsed;
    }

    private Set<String> findExistingActiveKeys(Set<String> candidateLots) {
        if (candidateLots.isEmpty()) {
            return Set.of();
        }
        Query query = new Query();
        query.addCriteria(Criteria.where("isDeleted").is(false));
        query.addCriteria(Criteria.where("sourceLotCode").in(candidateLots));
        List<Batch> existingBatches = mongoTemplate.find(query, Batch.class);

        Set<String> keys = new HashSet<>();
        for (Batch b : existingBatches) {
            if (b.getSku() != null && b.getSourceLotCode() != null && b.getPackDate() != null) {
                keys.add(buildDedupeKey(b.getSku(), b.getSourceLotCode(), b.getPackDate()));
            }
        }
        return keys;
    }

    public static String buildDedupeKey(String sku, String sourceLotCode, LocalDate packDate) {
        return sku.trim().toUpperCase(Locale.ROOT) + "|" + sourceLotCode.trim().toUpperCase(Locale.ROOT) + "|" + packDate.toString();
    }

    private boolean isValidProductContract(Product p) {
        if (p == null || p.getProductName() == null || p.getProductName().isBlank() || p.getSku() == null || p.getSku().isBlank()) {
            return false;
        }
        Integer shelfLife = p.getPredictedShelfLifeDays() != null ? p.getPredictedShelfLifeDays() : p.getBaseShelfLifeDays();
        return shelfLife != null && shelfLife >= 1;
    }

    public static String headerToken(String h) {
        if (h == null) return "";
        return h.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
    }

    private static String cleanString(Object v) {
        if (v == null) return "";
        return String.valueOf(v).trim();
    }

    private static Double parseNumber(Object v) {
        if (v == null) return null;
        if (v instanceof Number n) {
            double d = n.doubleValue();
            return Double.isFinite(d) ? d : null;
        }
        String s = String.valueOf(v).replace(",", "").replace("%", "").trim();
        if (s.isEmpty()) return null;
        try {
            double d = Double.parseDouble(s);
            return Double.isFinite(d) ? d : null;
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    public static String normaliseUnit(Object v) {
        String key = cleanString(v).toLowerCase(Locale.ROOT).replaceAll("[^a-z]", "");
        if (key.isEmpty()) return null;
        return UNIT_ALIASES.get(key);
    }

    public static LocalDate parseStrictPackDate(Object v) {
        String s = cleanString(v);
        if (s.isEmpty()) return null;

        Matcher iso = ISO_DATE_PATTERN.matcher(s);
        if (iso.matches()) {
            try {
                int year = Integer.parseInt(iso.group(1));
                int month = Integer.parseInt(iso.group(2));
                int day = Integer.parseInt(iso.group(3));
                if (year < 1970 || year > 2100) return null;
                return LocalDate.of(year, month, day);
            } catch (DateTimeException | NumberFormatException ex) {
                return null;
            }
        }

        Matcher dmy = DAY_FIRST_PATTERN.matcher(s);
        if (dmy.matches()) {
            try {
                int day = Integer.parseInt(dmy.group(1));
                int month = Integer.parseInt(dmy.group(3));
                int year = Integer.parseInt(dmy.group(4));
                if (year < 1970 || year > 2100) return null;
                return LocalDate.of(year, month, day);
            } catch (DateTimeException | NumberFormatException ex) {
                return null;
            }
        }

        return null;
    }

    private ImportJobSummaryDto toSummaryDto(ImportJob job) {
        ImportJobSummaryDto dto = new ImportJobSummaryDto();
        populateSummaryFields(job, dto);
        return dto;
    }

    private ImportJobDetailDto toDetailDto(ImportJob job) {
        ImportJobDetailDto dto = new ImportJobDetailDto();
        populateSummaryFields(job, dto);
        dto.setInsertedBatchIds(job.getInsertedBatchIds() != null ? new ArrayList<>(job.getInsertedBatchIds()) : List.of());
        dto.setRowErrors(job.getRowErrors() != null ? new ArrayList<>(job.getRowErrors()) : List.of());
        return dto;
    }

    private void populateSummaryFields(ImportJob job, ImportJobSummaryDto dto) {
        dto.setId(job.getId());
        dto.setFileName(job.getFileName());
        dto.setEntity(job.getEntity());
        dto.setStatus(job.getStatus());
        dto.setTotalRows(job.getTotalRows());
        dto.setProcessedRows(job.getProcessedRows());
        dto.setInserted(job.getInserted());
        dto.setUpdated(job.getUpdated());
        dto.setSkipped(job.getSkipped());
        dto.setErrored(job.getErrored());
        dto.setRowErrorsTruncated(job.isRowErrorsTruncated());
        dto.setCreatedBy(job.getCreatedBy());
        dto.setCreatedByRole(job.getCreatedByRole());
        dto.setCreatedAt(job.getCreatedAt());
        dto.setUpdatedAt(job.getUpdatedAt());
        dto.setFinishedAt(job.getFinishedAt());
        dto.setRolledBackAt(job.getRolledBackAt());
        dto.setRolledBackBy(job.getRolledBackBy());
    }
}
