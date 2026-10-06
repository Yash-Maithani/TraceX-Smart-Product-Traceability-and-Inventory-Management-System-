import os
import io

base = "backend/src/main/java/com/tracex/"
os.makedirs(base + "dto", exist_ok=True)

# BatchCreateDto
with io.open(base + "dto/BatchCreateDto.java", "w", encoding="utf-8") as f:
    f.write("""package com.tracex.dto;

import jakarta.validation.constraints.*;
import java.time.Instant;

public class BatchCreateDto {
    @NotBlank
    private String productId;
    @NotBlank @Size(max=100)
    private String sourceLotCode;
    @NotBlank @Size(max=200)
    private String farmerName;
    @NotBlank @Size(max=200)
    private String village;
    @Min(1)
    private int quantityProduced;
    @NotBlank @Pattern(regexp="Kg|Units|Liters")
    private String unit;
    @DecimalMin("0.0") @DecimalMax("100.0")
    private double yieldPercent;
    @NotNull
    private Instant packDate;
    @Size(max=2000)
    private String traceabilityNote;

    public String getProductId() { return productId; }
    public void setProductId(String productId) { this.productId = productId; }
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
    public Instant getPackDate() { return packDate; }
    public void setPackDate(Instant packDate) { this.packDate = packDate; }
    public String getTraceabilityNote() { return traceabilityNote; }
    public void setTraceabilityNote(String traceabilityNote) { this.traceabilityNote = traceabilityNote; }
}
""")

# BatchNoteDto
with io.open(base + "dto/BatchNoteDto.java", "w", encoding="utf-8") as f:
    f.write("""package com.tracex.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class BatchNoteDto {
    @NotBlank @Size(max=2000)
    private String note;

    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
}
""")

# BatchRawMaterialDto
with io.open(base + "dto/BatchRawMaterialDto.java", "w", encoding="utf-8") as f:
    f.write("""package com.tracex.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public class BatchRawMaterialDto {
    @Size(max=200)
    private String farmerName;
    @Size(max=200)
    private String village;
    @Size(max=100)
    private String sourceLotCode;
    @Min(1)
    private Integer quantityProduced;
    @Pattern(regexp="Kg|Units|Liters")
    private String unit;
    @DecimalMin("0.0") @DecimalMax("100.0")
    private Double yieldPercent;

    public String getFarmerName() { return farmerName; }
    public void setFarmerName(String farmerName) { this.farmerName = farmerName; }
    public String getVillage() { return village; }
    public void setVillage(String village) { this.village = village; }
    public String getSourceLotCode() { return sourceLotCode; }
    public void setSourceLotCode(String sourceLotCode) { this.sourceLotCode = sourceLotCode; }
    public Integer getQuantityProduced() { return quantityProduced; }
    public void setQuantityProduced(Integer quantityProduced) { this.quantityProduced = quantityProduced; }
    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }
    public Double getYieldPercent() { return yieldPercent; }
    public void setYieldPercent(Double yieldPercent) { this.yieldPercent = yieldPercent; }
}
""")

# BatchSummaryDto
with io.open(base + "dto/BatchSummaryDto.java", "w", encoding="utf-8") as f:
    f.write("""package com.tracex.dto;

import java.time.Instant;

public class BatchSummaryDto {
    private String id;
    private String batchCode;
    private String productName;
    private String sku;
    private String sourceLotCode;
    private String farmerName;
    private String village;
    private int quantityProduced;
    private String unit;
    private double yieldPercent;
    private Instant packDate;
    private Instant expiryDate;
    private String dataSource;
    private String shelfLifeSource;
    private String lifecycleState;
    private String status;
    private long daysUntilExpiry;
    private double priorityScore;
    private String createdBy;
    private boolean isDeleted;
    private Instant createdAt;
    private Instant updatedAt;

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
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public long getDaysUntilExpiry() { return daysUntilExpiry; }
    public void setDaysUntilExpiry(long daysUntilExpiry) { this.daysUntilExpiry = daysUntilExpiry; }
    public double getPriorityScore() { return priorityScore; }
    public void setPriorityScore(double priorityScore) { this.priorityScore = priorityScore; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public boolean isDeleted() { return isDeleted; }
    public void setDeleted(boolean deleted) { isDeleted = deleted; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
""")

# BatchDetailDto
with io.open(base + "dto/BatchDetailDto.java", "w", encoding="utf-8") as f:
    f.write("""package com.tracex.dto;

import com.tracex.model.Batch.NoteHistoryEntry;
import java.time.Instant;
import java.util.List;

public class BatchDetailDto extends BatchSummaryDto {
    private String traceabilityNote;
    private List<NoteHistoryEntry> noteHistory;
    private Instant deletedAt;
    private String deletedBy;
    private String deleteNote;
    private Instant dispatchDate;
    private String buyerName;

    public String getTraceabilityNote() { return traceabilityNote; }
    public void setTraceabilityNote(String traceabilityNote) { this.traceabilityNote = traceabilityNote; }
    public List<NoteHistoryEntry> getNoteHistory() { return noteHistory; }
    public void setNoteHistory(List<NoteHistoryEntry> noteHistory) { this.noteHistory = noteHistory; }
    public Instant getDeletedAt() { return deletedAt; }
    public void setDeletedAt(Instant deletedAt) { this.deletedAt = deletedAt; }
    public String getDeletedBy() { return deletedBy; }
    public void setDeletedBy(String deletedBy) { this.deletedBy = deletedBy; }
    public String getDeleteNote() { return deleteNote; }
    public void setDeleteNote(String deleteNote) { this.deleteNote = deleteNote; }
    public Instant getDispatchDate() { return dispatchDate; }
    public void setDispatchDate(Instant dispatchDate) { this.dispatchDate = dispatchDate; }
    public String getBuyerName() { return buyerName; }
    public void setBuyerName(String buyerName) { this.buyerName = buyerName; }
}
""")
