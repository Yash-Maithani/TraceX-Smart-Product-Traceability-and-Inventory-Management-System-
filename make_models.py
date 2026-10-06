import os
import io

base = "backend/src/main/java/com/tracex/"
test_base = "backend/src/test/java/com/tracex/"

# Product.java
with io.open(base + "model/Product.java", "w", encoding="utf-8") as f:
    f.write("""package com.tracex.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "products")
public class Product {
    @Id
    private String id;
    private String productName;
    private String sku;
    private String category;
    private Integer baseShelfLifeDays;
    private Integer predictedShelfLifeDays;
    private String predictedExpiryTemplate;
    private String riskLevel;
    
    @CreatedDate
    private Instant createdAt;
    
    @LastModifiedDate
    private Instant updatedAt;
    
    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getProductName() { return productName; }
    public void setProductName(String productName) { this.productName = productName; }
    public String getSku() { return sku; }
    public void setSku(String sku) { this.sku = sku; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public Integer getBaseShelfLifeDays() { return baseShelfLifeDays; }
    public void setBaseShelfLifeDays(Integer baseShelfLifeDays) { this.baseShelfLifeDays = baseShelfLifeDays; }
    public Integer getPredictedShelfLifeDays() { return predictedShelfLifeDays; }
    public void setPredictedShelfLifeDays(Integer predictedShelfLifeDays) { this.predictedShelfLifeDays = predictedShelfLifeDays; }
    public String getPredictedExpiryTemplate() { return predictedExpiryTemplate; }
    public void setPredictedExpiryTemplate(String predictedExpiryTemplate) { this.predictedExpiryTemplate = predictedExpiryTemplate; }
    public String getRiskLevel() { return riskLevel; }
    public void setRiskLevel(String riskLevel) { this.riskLevel = riskLevel; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
""")

# Counter.java
with io.open(base + "model/Counter.java", "w", encoding="utf-8") as f:
    f.write("""package com.tracex.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "counters")
public class Counter {
    @Id
    private String id;
    private long seq;
    
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public long getSeq() { return seq; }
    public void setSeq(long seq) { this.seq = seq; }
}
""")

# Batch.java
with io.open(base + "model/Batch.java", "w", encoding="utf-8") as f:
    f.write("""package com.tracex.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
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
    private Instant packDate;
    private Instant expiryDate;
    private String dataSource;
    private String shelfLifeSource;
    private String lifecycleState = "ACTIVE";
    private double priorityScore;
    private Instant dispatchDate;
    private String buyerName;
    private String traceabilityNote;
    private String createdBy;
    
    private List<NoteHistoryEntry> noteHistory = new ArrayList<>();
    
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
    public Instant getPackDate() { return packDate; }
    public void setPackDate(Instant packDate) { this.packDate = packDate; }
    public Instant getExpiryDate() { return expiryDate; }
    public void setExpiryDate(Instant expiryDate) { this.expiryDate = expiryDate; }
    public String getDataSource() { return dataSource; }
    public void setDataSource(String dataSource) { this.dataSource = dataSource; }
    public String getShelfLifeSource() { return shelfLifeSource; }
    public void setShelfLifeSource(String shelfLifeSource) { this.shelfLifeSource = shelfLifeSource; }
    public String getLifecycleState() { return lifecycleState; }
    public void setLifecycleState(String lifecycleState) { this.lifecycleState = lifecycleState; }
    public double getPriorityScore() { return priorityScore; }
    public void setPriorityScore(double priorityScore) { this.priorityScore = priorityScore; }
    public Instant getDispatchDate() { return dispatchDate; }
    public void setDispatchDate(Instant dispatchDate) { this.dispatchDate = dispatchDate; }
    public String getBuyerName() { return buyerName; }
    public void setBuyerName(String buyerName) { this.buyerName = buyerName; }
    public String getTraceabilityNote() { return traceabilityNote; }
    public void setTraceabilityNote(String traceabilityNote) { this.traceabilityNote = traceabilityNote; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public List<NoteHistoryEntry> getNoteHistory() { return noteHistory; }
    public void setNoteHistory(List<NoteHistoryEntry> noteHistory) { this.noteHistory = noteHistory; }
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
}
""")
