package com.tracex.model;

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
