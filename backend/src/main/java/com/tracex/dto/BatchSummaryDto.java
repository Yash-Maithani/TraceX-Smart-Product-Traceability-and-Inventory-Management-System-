package com.tracex.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.tracex.model.Batch;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.time.LocalDate;

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
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    @Schema(type = "string", format = "date", example = "2026-10-09")
    private LocalDate packDate;
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    @Schema(type = "string", format = "date", example = "2026-10-09")
    private LocalDate expiryDate;
    private String dataSource;
    private String shelfLifeSource;
    private String lifecycleState;
    @Schema(
            description = "Computed batch freshness or lifecycle status",
            allowableValues = {"EXPIRED", "URGENT", "WARNING", "READY", "EXCEPTION", "DISPATCHED"}
    )
    private String status;
    private Long daysUntilExpiry;
    private double priorityScore;
    private Batch.QualityCheck qualityCheck;
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private Integer rank;
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private String exceptionReason;
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
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Long getDaysUntilExpiry() { return daysUntilExpiry; }
    public void setDaysUntilExpiry(Long daysUntilExpiry) { this.daysUntilExpiry = daysUntilExpiry; }
    public double getPriorityScore() { return priorityScore; }
    public void setPriorityScore(double priorityScore) { this.priorityScore = priorityScore; }
    public Batch.QualityCheck getQualityCheck() { return qualityCheck; }
    public void setQualityCheck(Batch.QualityCheck qualityCheck) { this.qualityCheck = qualityCheck; }
    public Integer getRank() { return rank; }
    public void setRank(Integer rank) { this.rank = rank; }
    public String getExceptionReason() { return exceptionReason; }
    public void setExceptionReason(String exceptionReason) { this.exceptionReason = exceptionReason; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public boolean isDeleted() { return isDeleted; }
    public void setDeleted(boolean deleted) { isDeleted = deleted; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
