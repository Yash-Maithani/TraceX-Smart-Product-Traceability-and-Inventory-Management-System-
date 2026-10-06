package com.tracex.dto;

import com.tracex.model.ImportJob;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class ImportDtos {

    public static class ImportColumnDto {
        private String key;
        private String label;
        private boolean required;
        private String type;
        private String example;
        private String hint;
        private List<String> enumValues;

        public ImportColumnDto() {
        }

        public ImportColumnDto(String key, String label, boolean required, String type, String example, String hint, List<String> enumValues) {
            this.key = key;
            this.label = label;
            this.required = required;
            this.type = type;
            this.example = example;
            this.hint = hint;
            this.enumValues = enumValues;
        }

        public String getKey() { return key; }
        public void setKey(String key) { this.key = key; }
        public String getLabel() { return label; }
        public void setLabel(String label) { this.label = label; }
        public boolean isRequired() { return required; }
        public void setRequired(boolean required) { this.required = required; }
        public String getType() { return type; }
        public void setType(String type) { this.type = type; }
        public String getExample() { return example; }
        public void setExample(String example) { this.example = example; }
        public String getHint() { return hint; }
        public void setHint(String hint) { this.hint = hint; }
        public List<String> getEnumValues() { return enumValues; }
        public void setEnumValues(List<String> enumValues) { this.enumValues = enumValues; }
    }

    public static class ImportSchemaDto {
        private List<ImportColumnDto> columns;
        private int maxChunkRows;
        private String dedupeRule;

        public ImportSchemaDto() {
        }

        public ImportSchemaDto(List<ImportColumnDto> columns, int maxChunkRows, String dedupeRule) {
            this.columns = columns;
            this.maxChunkRows = maxChunkRows;
            this.dedupeRule = dedupeRule;
        }

        public List<ImportColumnDto> getColumns() { return columns; }
        public void setColumns(List<ImportColumnDto> columns) { this.columns = columns; }
        public int getMaxChunkRows() { return maxChunkRows; }
        public void setMaxChunkRows(int maxChunkRows) { this.maxChunkRows = maxChunkRows; }
        public String getDedupeRule() { return dedupeRule; }
        public void setDedupeRule(String dedupeRule) { this.dedupeRule = dedupeRule; }
    }

    public static class ImportMapHeadersRequestDto {
        private List<String> headers = new ArrayList<>();

        public List<String> getHeaders() { return headers; }
        public void setHeaders(List<String> headers) { this.headers = headers; }
    }

    public static class ImportMapHeadersResponseDto {
        private Map<String, String> mapping;
        private List<String> unmappedRequired;

        public ImportMapHeadersResponseDto() {
        }

        public ImportMapHeadersResponseDto(Map<String, String> mapping, List<String> unmappedRequired) {
            this.mapping = mapping;
            this.unmappedRequired = unmappedRequired;
        }

        public Map<String, String> getMapping() { return mapping; }
        public void setMapping(Map<String, String> mapping) { this.mapping = mapping; }
        public List<String> getUnmappedRequired() { return unmappedRequired; }
        public void setUnmappedRequired(List<String> unmappedRequired) { this.unmappedRequired = unmappedRequired; }
    }

    public static class ImportValidateRequestDto {
        private List<Map<String, Object>> rows;
        private Integer rowOffset;
        private List<String> priorKeys;

        public List<Map<String, Object>> getRows() { return rows; }
        public void setRows(List<Map<String, Object>> rows) { this.rows = rows; }
        public Integer getRowOffset() { return rowOffset; }
        public void setRowOffset(Integer rowOffset) { this.rowOffset = rowOffset; }
        public List<String> getPriorKeys() { return priorKeys; }
        public void setPriorKeys(List<String> priorKeys) { this.priorKeys = priorKeys; }
    }

    public static class ImportValidateSummaryDto {
        private int total;
        private int insert;
        private int skip;
        private int error;

        public ImportValidateSummaryDto() {
        }

        public ImportValidateSummaryDto(int total, int insert, int skip, int error) {
            this.total = total;
            this.insert = insert;
            this.skip = skip;
            this.error = error;
        }

        public int getTotal() { return total; }
        public void setTotal(int total) { this.total = total; }
        public int getInsert() { return insert; }
        public void setInsert(int insert) { this.insert = insert; }
        public int getSkip() { return skip; }
        public void setSkip(int skip) { this.skip = skip; }
        public int getError() { return error; }
        public void setError(int error) { this.error = error; }
    }

    public static class ImportPreviewProductDto {
        private String sku;
        private String productName;

        public ImportPreviewProductDto() {
        }

        public ImportPreviewProductDto(String sku, String productName) {
            this.sku = sku;
            this.productName = productName;
        }

        public String getSku() { return sku; }
        public void setSku(String sku) { this.sku = sku; }
        public String getProductName() { return productName; }
        public void setProductName(String productName) { this.productName = productName; }
    }

    public static class ImportFieldErrorDto {
        private String field;
        private String message;

        public ImportFieldErrorDto() {
        }

        public ImportFieldErrorDto(String field, String message) {
            this.field = field;
            this.message = message;
        }

        public String getField() { return field; }
        public void setField(String field) { this.field = field; }
        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }
    }

    public static class ImportPreviewRowDto {
        private int rowNumber;
        private String verdict;
        private String reason;
        private ImportPreviewProductDto product;
        private String sourceLotCode;
        private String village;
        private Integer quantityProduced;
        private String unit;
        private Double yieldPercent;
        private String packDate;
        private String insertKey;
        private List<ImportFieldErrorDto> errors = new ArrayList<>();

        public int getRowNumber() { return rowNumber; }
        public void setRowNumber(int rowNumber) { this.rowNumber = rowNumber; }
        public String getVerdict() { return verdict; }
        public void setVerdict(String verdict) { this.verdict = verdict; }
        public String getReason() { return reason; }
        public void setReason(String reason) { this.reason = reason; }
        public ImportPreviewProductDto getProduct() { return product; }
        public void setProduct(ImportPreviewProductDto product) { this.product = product; }
        public String getSourceLotCode() { return sourceLotCode; }
        public void setSourceLotCode(String sourceLotCode) { this.sourceLotCode = sourceLotCode; }
        public String getVillage() { return village; }
        public void setVillage(String village) { this.village = village; }
        public Integer getQuantityProduced() { return quantityProduced; }
        public void setQuantityProduced(Integer quantityProduced) { this.quantityProduced = quantityProduced; }
        public String getUnit() { return unit; }
        public void setUnit(String unit) { this.unit = unit; }
        public Double getYieldPercent() { return yieldPercent; }
        public void setYieldPercent(Double yieldPercent) { this.yieldPercent = yieldPercent; }
        public String getPackDate() { return packDate; }
        public void setPackDate(String packDate) { this.packDate = packDate; }
        public String getInsertKey() { return insertKey; }
        public void setInsertKey(String insertKey) { this.insertKey = insertKey; }
        public List<ImportFieldErrorDto> getErrors() { return errors; }
        public void setErrors(List<ImportFieldErrorDto> errors) { this.errors = errors; }
    }

    public static class ImportValidateResponseDto {
        private ImportValidateSummaryDto summary;
        private List<ImportPreviewRowDto> preview;

        public ImportValidateResponseDto() {
        }

        public ImportValidateResponseDto(ImportValidateSummaryDto summary, List<ImportPreviewRowDto> preview) {
            this.summary = summary;
            this.preview = preview;
        }

        public ImportValidateSummaryDto getSummary() { return summary; }
        public void setSummary(ImportValidateSummaryDto summary) { this.summary = summary; }
        public List<ImportPreviewRowDto> getPreview() { return preview; }
        public void setPreview(List<ImportPreviewRowDto> preview) { this.preview = preview; }
    }

    public static class ImportCommitRequestDto {
        private String jobId;
        private String fileName;
        private List<Map<String, Object>> rows;
        private Integer rowOffset;
        private Integer totalRows;
        private Boolean isFinal;

        public String getJobId() { return jobId; }
        public void setJobId(String jobId) { this.jobId = jobId; }
        public String getFileName() { return fileName; }
        public void setFileName(String fileName) { this.fileName = fileName; }
        public List<Map<String, Object>> getRows() { return rows; }
        public void setRows(List<Map<String, Object>> rows) { this.rows = rows; }
        public Integer getRowOffset() { return rowOffset; }
        public void setRowOffset(Integer rowOffset) { this.rowOffset = rowOffset; }
        public Integer getTotalRows() { return totalRows; }
        public void setTotalRows(Integer totalRows) { this.totalRows = totalRows; }
        public Boolean getIsFinal() { return isFinal; }
        public void setIsFinal(Boolean isFinal) { this.isFinal = isFinal; }
    }

    public static class ImportCommitTotalsDto {
        private int processedRows;
        private int totalRows;
        private int inserted;
        private int skipped;
        private int errored;

        public ImportCommitTotalsDto() {
        }

        public ImportCommitTotalsDto(int processedRows, int totalRows, int inserted, int skipped, int errored) {
            this.processedRows = processedRows;
            this.totalRows = totalRows;
            this.inserted = inserted;
            this.skipped = skipped;
            this.errored = errored;
        }

        public int getProcessedRows() { return processedRows; }
        public void setProcessedRows(int processedRows) { this.processedRows = processedRows; }
        public int getTotalRows() { return totalRows; }
        public void setTotalRows(int totalRows) { this.totalRows = totalRows; }
        public int getInserted() { return inserted; }
        public void setInserted(int inserted) { this.inserted = inserted; }
        public int getSkipped() { return skipped; }
        public void setSkipped(int skipped) { this.skipped = skipped; }
        public int getErrored() { return errored; }
        public void setErrored(int errored) { this.errored = errored; }
    }

    public static class ImportedBatchSummaryDto {
        private String id;
        private String batchCode;
        private String productName;
        private String sku;
        private String sourceLotCode;
        private String packDate;
        private String expiryDate;
        private String status;

        public ImportedBatchSummaryDto() {
        }

        public ImportedBatchSummaryDto(String id, String batchCode, String productName, String sku, String sourceLotCode, String packDate, String expiryDate, String status) {
            this.id = id;
            this.batchCode = batchCode;
            this.productName = productName;
            this.sku = sku;
            this.sourceLotCode = sourceLotCode;
            this.packDate = packDate;
            this.expiryDate = expiryDate;
            this.status = status;
        }

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public String getBatchCode() { return batchCode; }
        public void setBatchCode(String batchCode) { this.batchCode = batchCode; }
        public String getProductName() { return productName; }
        public void setProductName(String productName) { this.productName = productName; }
        public String getSku() { return sku; }
        public void setSku(String sku) { this.sku = sku; }
        public String getSourceLotCode() { return sourceLotCode; }
        public void setSourceLotCode(String sourceLotCode) { this.sourceLotCode = sourceLotCode; }
        public String getPackDate() { return packDate; }
        public void setPackDate(String packDate) { this.packDate = packDate; }
        public String getExpiryDate() { return expiryDate; }
        public void setExpiryDate(String expiryDate) { this.expiryDate = expiryDate; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
    }

    public static class ImportCommitResponseDto {
        private String jobId;
        private String status;
        private int chunkInserted;
        private int chunkSkipped;
        private int chunkErrored;
        private ImportCommitTotalsDto totals;
        private List<ImportedBatchSummaryDto> batches;
        private List<ImportJob.RowError> errors;
        private boolean rowErrorsTruncated;

        public ImportCommitResponseDto() {
        }

        public String getJobId() { return jobId; }
        public void setJobId(String jobId) { this.jobId = jobId; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        public int getChunkInserted() { return chunkInserted; }
        public void setChunkInserted(int chunkInserted) { this.chunkInserted = chunkInserted; }
        public int getChunkSkipped() { return chunkSkipped; }
        public void setChunkSkipped(int chunkSkipped) { this.chunkSkipped = chunkSkipped; }
        public int getChunkErrored() { return chunkErrored; }
        public void setChunkErrored(int chunkErrored) { this.chunkErrored = chunkErrored; }
        public ImportCommitTotalsDto getTotals() { return totals; }
        public void setTotals(ImportCommitTotalsDto totals) { this.totals = totals; }
        public List<ImportedBatchSummaryDto> getBatches() { return batches; }
        public void setBatches(List<ImportedBatchSummaryDto> batches) { this.batches = batches; }
        public List<ImportJob.RowError> getErrors() { return errors; }
        public void setErrors(List<ImportJob.RowError> errors) { this.errors = errors; }
        public boolean isRowErrorsTruncated() { return rowErrorsTruncated; }
        public void setRowErrorsTruncated(boolean rowErrorsTruncated) { this.rowErrorsTruncated = rowErrorsTruncated; }
    }

    public static class ImportJobSummaryDto {
        private String id;
        private String fileName;
        private String entity;
        private String status;
        private int totalRows;
        private int processedRows;
        private int inserted;
        private int updated;
        private int skipped;
        private int errored;
        private boolean rowErrorsTruncated;
        private String createdBy;
        private String createdByRole;
        private Instant createdAt;
        private Instant updatedAt;
        private Instant finishedAt;
        private Instant rolledBackAt;
        private String rolledBackBy;

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public String getFileName() { return fileName; }
        public void setFileName(String fileName) { this.fileName = fileName; }
        public String getEntity() { return entity; }
        public void setEntity(String entity) { this.entity = entity; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        public int getTotalRows() { return totalRows; }
        public void setTotalRows(int totalRows) { this.totalRows = totalRows; }
        public int getProcessedRows() { return processedRows; }
        public void setProcessedRows(int processedRows) { this.processedRows = processedRows; }
        public int getInserted() { return inserted; }
        public void setInserted(int inserted) { this.inserted = inserted; }
        public int getUpdated() { return updated; }
        public void setUpdated(int updated) { this.updated = updated; }
        public int getSkipped() { return skipped; }
        public void setSkipped(int skipped) { this.skipped = skipped; }
        public int getErrored() { return errored; }
        public void setErrored(int errored) { this.errored = errored; }
        public boolean isRowErrorsTruncated() { return rowErrorsTruncated; }
        public void setRowErrorsTruncated(boolean rowErrorsTruncated) { this.rowErrorsTruncated = rowErrorsTruncated; }
        public String getCreatedBy() { return createdBy; }
        public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
        public String getCreatedByRole() { return createdByRole; }
        public void setCreatedByRole(String createdByRole) { this.createdByRole = createdByRole; }
        public Instant getCreatedAt() { return createdAt; }
        public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
        public Instant getUpdatedAt() { return updatedAt; }
        public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
        public Instant getFinishedAt() { return finishedAt; }
        public void setFinishedAt(Instant finishedAt) { this.finishedAt = finishedAt; }
        public Instant getRolledBackAt() { return rolledBackAt; }
        public void setRolledBackAt(Instant rolledBackAt) { this.rolledBackAt = rolledBackAt; }
        public String getRolledBackBy() { return rolledBackBy; }
        public void setRolledBackBy(String rolledBackBy) { this.rolledBackBy = rolledBackBy; }
    }

    public static class ImportJobDetailDto extends ImportJobSummaryDto {
        private List<String> insertedBatchIds = new ArrayList<>();
        private List<ImportJob.RowError> rowErrors = new ArrayList<>();

        public List<String> getInsertedBatchIds() { return insertedBatchIds; }
        public void setInsertedBatchIds(List<String> insertedBatchIds) { this.insertedBatchIds = insertedBatchIds; }
        public List<ImportJob.RowError> getRowErrors() { return rowErrors; }
        public void setRowErrors(List<ImportJob.RowError> rowErrors) { this.rowErrors = rowErrors; }
    }

    public static class ImportRollbackResponseDto {
        private String jobId;
        private String status;
        private int archived;
        private int alreadyArchived;
        private Instant rolledBackAt;
        private String rolledBackBy;

        public ImportRollbackResponseDto() {
        }

        public ImportRollbackResponseDto(String jobId, String status, int archived, int alreadyArchived, Instant rolledBackAt, String rolledBackBy) {
            this.jobId = jobId;
            this.status = status;
            this.archived = archived;
            this.alreadyArchived = alreadyArchived;
            this.rolledBackAt = rolledBackAt;
            this.rolledBackBy = rolledBackBy;
        }

        public String getJobId() { return jobId; }
        public void setJobId(String jobId) { this.jobId = jobId; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        public int getArchived() { return archived; }
        public void setArchived(int archived) { this.archived = archived; }
        public int getAlreadyArchived() { return alreadyArchived; }
        public void setAlreadyArchived(int alreadyArchived) { this.alreadyArchived = alreadyArchived; }
        public Instant getRolledBackAt() { return rolledBackAt; }
        public void setRolledBackAt(Instant rolledBackAt) { this.rolledBackAt = rolledBackAt; }
        public String getRolledBackBy() { return rolledBackBy; }
        public void setRolledBackBy(String rolledBackBy) { this.rolledBackBy = rolledBackBy; }
    }
}
