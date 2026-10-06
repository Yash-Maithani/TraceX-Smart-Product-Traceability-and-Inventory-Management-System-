package com.tracex.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.IndexDirection;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Document(collection = "importjobs")
public class ImportJob {

    @Id
    private String id;

    private String fileName = "upload.csv";

    private String entity = "batch";

    @Indexed
    private String status = "running";

    private int totalRows = 0;

    private int processedRows = 0;

    private int inserted = 0;

    private int updated = 0;

    private int skipped = 0;

    private int errored = 0;

    @Indexed
    private List<String> insertedBatchIds = new ArrayList<>();

    private List<RowError> rowErrors = new ArrayList<>();

    private boolean rowErrorsTruncated = false;

    private String createdBy;

    private String createdByRole;

    @Indexed(direction = IndexDirection.DESCENDING)
    private Instant createdAt;

    private Instant updatedAt;

    private Instant finishedAt;

    private Instant rolledBackAt;

    private String rolledBackBy;

    public static class RowError {
        private int rowNumber;
        private String field;
        private String message;
        private String sourceLotCode;

        public RowError() {
        }

        public RowError(int rowNumber, String field, String message, String sourceLotCode) {
            this.rowNumber = rowNumber;
            this.field = field;
            this.message = message;
            this.sourceLotCode = sourceLotCode;
        }

        public int getRowNumber() {
            return rowNumber;
        }

        public void setRowNumber(int rowNumber) {
            this.rowNumber = rowNumber;
        }

        public String getField() {
            return field;
        }

        public void setField(String field) {
            this.field = field;
        }

        public String getMessage() {
            return message;
        }

        public void setMessage(String message) {
            this.message = message;
        }

        public String getSourceLotCode() {
            return sourceLotCode;
        }

        public void setSourceLotCode(String sourceLotCode) {
            this.sourceLotCode = sourceLotCode;
        }
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public String getEntity() {
        return entity;
    }

    public void setEntity(String entity) {
        this.entity = entity;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public int getTotalRows() {
        return totalRows;
    }

    public void setTotalRows(int totalRows) {
        this.totalRows = totalRows;
    }

    public int getProcessedRows() {
        return processedRows;
    }

    public void setProcessedRows(int processedRows) {
        this.processedRows = processedRows;
    }

    public int getInserted() {
        return inserted;
    }

    public void setInserted(int inserted) {
        this.inserted = inserted;
    }

    public int getUpdated() {
        return updated;
    }

    public void setUpdated(int updated) {
        this.updated = updated;
    }

    public int getSkipped() {
        return skipped;
    }

    public void setSkipped(int skipped) {
        this.skipped = skipped;
    }

    public int getErrored() {
        return errored;
    }

    public void setErrored(int errored) {
        this.errored = errored;
    }

    public List<String> getInsertedBatchIds() {
        return insertedBatchIds;
    }

    public void setInsertedBatchIds(List<String> insertedBatchIds) {
        this.insertedBatchIds = insertedBatchIds;
    }

    public List<RowError> getRowErrors() {
        return rowErrors;
    }

    public void setRowErrors(List<RowError> rowErrors) {
        this.rowErrors = rowErrors;
    }

    public boolean isRowErrorsTruncated() {
        return rowErrorsTruncated;
    }

    public void setRowErrorsTruncated(boolean rowErrorsTruncated) {
        this.rowErrorsTruncated = rowErrorsTruncated;
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(String createdBy) {
        this.createdBy = createdBy;
    }

    public String getCreatedByRole() {
        return createdByRole;
    }

    public void setCreatedByRole(String createdByRole) {
        this.createdByRole = createdByRole;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Instant getFinishedAt() {
        return finishedAt;
    }

    public void setFinishedAt(Instant finishedAt) {
        this.finishedAt = finishedAt;
    }

    public Instant getRolledBackAt() {
        return rolledBackAt;
    }

    public void setRolledBackAt(Instant rolledBackAt) {
        this.rolledBackAt = rolledBackAt;
    }

    public String getRolledBackBy() {
        return rolledBackBy;
    }

    public void setRolledBackBy(String rolledBackBy) {
        this.rolledBackBy = rolledBackBy;
    }
}
