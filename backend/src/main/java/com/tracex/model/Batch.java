package com.tracex.model;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.tracex.util.BatchLocalDateValueConverter;
import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.annotation.Version;
import org.springframework.data.convert.ValueConverter;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Document(collection = "batches")
@CompoundIndexes({
    @CompoundIndex(name = "isDeleted_lifecycleState_expiryDate_idx", def = "{'isDeleted': 1, 'lifecycleState': 1, 'expiryDate': 1}")
})
public class Batch {
    @Id
    private String id;
    private String productId;
    private String productName;
    
    @Indexed
    private String sku;
    private String sourceLotCode;
    private String farmerName;
    private String village;
    private int quantityProduced;
    private String unit;
    private double yieldPercent;
    
    @Indexed(unique = true)
    private String batchCode;
    @Indexed(unique = true, sparse = true)
    private String traceToken;
    @ValueConverter(BatchLocalDateValueConverter.class)
    private LocalDate packDate;
    @ValueConverter(BatchLocalDateValueConverter.class)
    private LocalDate expiryDate;
    private String dataSource;
    private String shelfLifeSource;
    private String lifecycleState = "ACTIVE";
    private double priorityScore;
    @ValueConverter(BatchLocalDateValueConverter.class)
    private LocalDate dispatchDate;
    private String buyerName;
    private String traceabilityNote;
    private String createdBy;
    
    private List<NoteHistoryEntry> noteHistory = new ArrayList<>();
    private QualityCheck qualityCheck;
    private List<DispatchHistoryEntry> dispatchHistory = new ArrayList<>();
    
    private boolean isDeleted = false;
    private Instant deletedAt;
    private String deletedBy;
    private String deleteNote;
    
    @Version
    private long version;
    
    @CreatedDate
    private Instant createdAt;
    
    @LastModifiedDate
    private Instant updatedAt;
    
    public static class NoteHistoryEntry {
        private String note;
        private String editedBy;
        private Instant editedAt;
        
        public NoteHistoryEntry() {}
        public NoteHistoryEntry(String note, String editedBy, Instant editedAt) {
            this.note = note;
            this.editedBy = editedBy;
            this.editedAt = editedAt;
        }
        
        public String getNote() { return note; }
        public void setNote(String note) { this.note = note; }
        public String getEditedBy() { return editedBy; }
        public void setEditedBy(String editedBy) { this.editedBy = editedBy; }
        public Instant getEditedAt() { return editedAt; }
        public void setEditedAt(Instant editedAt) { this.editedAt = editedAt; }
    }

    public static class QualityCheck {
        private String status;
        private Integer rating;
        private Instant inspectedAt;
        private String inspectorName;

        public QualityCheck() {}
        public QualityCheck(String status, Integer rating, Instant inspectedAt, String inspectorName) {
            this.status = status;
            this.rating = rating;
            this.inspectedAt = inspectedAt;
            this.inspectorName = inspectorName;
        }

        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        public Integer getRating() { return rating; }
        public void setRating(Integer rating) { this.rating = rating; }
        public Instant getInspectedAt() { return inspectedAt; }
        public void setInspectedAt(Instant inspectedAt) { this.inspectedAt = inspectedAt; }
        public String getInspectorName() { return inspectorName; }
        public void setInspectorName(String inspectorName) { this.inspectorName = inspectorName; }
    }

    public static class DispatchHistoryEntry {
        private String dispatchedBy;
        private Instant dispatchedAt;
        private String buyerName;
        @ValueConverter(BatchLocalDateValueConverter.class)
        @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
        @Schema(type = "string", format = "date", example = "2026-10-09")
        private LocalDate dispatchDate;
        private String overrideReason;
        private boolean outOfOrder;

        public DispatchHistoryEntry() {}
        public DispatchHistoryEntry(String dispatchedBy, Instant dispatchedAt, String buyerName,
                                    LocalDate dispatchDate, String overrideReason, boolean outOfOrder) {
            this.dispatchedBy = dispatchedBy;
            this.dispatchedAt = dispatchedAt;
            this.buyerName = buyerName;
            this.dispatchDate = dispatchDate;
            this.overrideReason = overrideReason;
            this.outOfOrder = outOfOrder;
        }

        public String getDispatchedBy() { return dispatchedBy; }
        public void setDispatchedBy(String dispatchedBy) { this.dispatchedBy = dispatchedBy; }
        public Instant getDispatchedAt() { return dispatchedAt; }
        public void setDispatchedAt(Instant dispatchedAt) { this.dispatchedAt = dispatchedAt; }
        public String getBuyerName() { return buyerName; }
        public void setBuyerName(String buyerName) { this.buyerName = buyerName; }
        public LocalDate getDispatchDate() { return dispatchDate; }
        public void setDispatchDate(LocalDate dispatchDate) { this.dispatchDate = dispatchDate; }
        public String getOverrideReason() { return overrideReason; }
        public void setOverrideReason(String overrideReason) { this.overrideReason = overrideReason; }
        public boolean isOutOfOrder() { return outOfOrder; }
        public void setOutOfOrder(boolean outOfOrder) { this.outOfOrder = outOfOrder; }
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getProductId() { return productId; }
    public void setProductId(String productId) { this.productId = productId; }
    public String getProductName() { return productName; }
    public void setProductName(String productName) { this.productName = productName; }
    public String getSku() { return sku; }
    public void setSku(String sku) { this.sku = sku; }
    public String getSourceLotCode() { return sourceLotCode; }
    public void setSourceLotCode(String sourceLotCode) { this.sourceLotCode = sourceLotCode; }
    public String getFarmerName() { return farmerName; }
    public void setFarmerName(String farmerName) { this.farmerName = farmerName; }
    public String getVillage() { return village; }
    public void setVillage(String village) { this.village = village; }
    public int getQuantityProduced() { return quantityProduced; }
    public void setQuantityProduced(int quantityProduced) { this.quantityProduced = quantityProduced; }
    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }
    public double getYieldPercent() { return yieldPercent; }
    public void setYieldPercent(double yieldPercent) { this.yieldPercent = yieldPercent; }
    public String getBatchCode() { return batchCode; }
    public void setBatchCode(String batchCode) { this.batchCode = batchCode; }
    public LocalDate getPackDate() { return packDate; }
    public void setPackDate(LocalDate packDate) { this.packDate = packDate; }
    public LocalDate getExpiryDate() { return expiryDate; }
    public void setExpiryDate(LocalDate expiryDate) { this.expiryDate = expiryDate; }
    public String getDataSource() { return dataSource; }
    public void setDataSource(String dataSource) { this.dataSource = dataSource; }
    public String getShelfLifeSource() { return shelfLifeSource; }
    public void setShelfLifeSource(String shelfLifeSource) { this.shelfLifeSource = shelfLifeSource; }
    public String getLifecycleState() { return lifecycleState; }
    public void setLifecycleState(String lifecycleState) { this.lifecycleState = lifecycleState; }
    public double getPriorityScore() { return priorityScore; }
    public void setPriorityScore(double priorityScore) { this.priorityScore = priorityScore; }
    public LocalDate getDispatchDate() { return dispatchDate; }
    public void setDispatchDate(LocalDate dispatchDate) { this.dispatchDate = dispatchDate; }
    public String getBuyerName() { return buyerName; }
    public void setBuyerName(String buyerName) { this.buyerName = buyerName; }
    public String getTraceabilityNote() { return traceabilityNote; }
    public void setTraceabilityNote(String traceabilityNote) { this.traceabilityNote = traceabilityNote; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public List<NoteHistoryEntry> getNoteHistory() { return noteHistory; }
    public void setNoteHistory(List<NoteHistoryEntry> noteHistory) { this.noteHistory = noteHistory; }
    public QualityCheck getQualityCheck() { return qualityCheck; }
    public void setQualityCheck(QualityCheck qualityCheck) { this.qualityCheck = qualityCheck; }
    public List<DispatchHistoryEntry> getDispatchHistory() { return dispatchHistory; }
    public void setDispatchHistory(List<DispatchHistoryEntry> dispatchHistory) { this.dispatchHistory = dispatchHistory; }
    public boolean isDeleted() { return isDeleted; }
    public void setDeleted(boolean deleted) { isDeleted = deleted; }
    public Instant getDeletedAt() { return deletedAt; }
    public void setDeletedAt(Instant deletedAt) { this.deletedAt = deletedAt; }
    public String getDeletedBy() { return deletedBy; }
    public void setDeletedBy(String deletedBy) { this.deletedBy = deletedBy; }
    public String getDeleteNote() { return deleteNote; }
    public void setDeleteNote(String deleteNote) { this.deleteNote = deleteNote; }
    public long getVersion() { return version; }
    public void setVersion(long version) { this.version = version; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
    public String getTraceToken() { return traceToken; }
    public void setTraceToken(String traceToken) { this.traceToken = traceToken; }
}
