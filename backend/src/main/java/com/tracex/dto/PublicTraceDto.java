package com.tracex.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.time.LocalDate;

public class PublicTraceDto {

    private String batchCode;
    private String productName;
    private String sku;
    private String village;

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    @Schema(type = "string", format = "date", example = "2026-09-15")
    private LocalDate packDate;

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    @Schema(type = "string", format = "date", example = "2026-12-15", nullable = true)
    private LocalDate expiryDate;

    private String status;
    private QualityCheckPublicDto qualityCheck;
    private String traceabilityNote;

    public PublicTraceDto() {
    }

    public static class QualityCheckPublicDto {
        private String status;
        private Integer rating;
        private Instant inspectedAt;

        public QualityCheckPublicDto() {
        }

        public QualityCheckPublicDto(String status, Integer rating, Instant inspectedAt) {
            this.status = status;
            this.rating = rating;
            this.inspectedAt = inspectedAt;
        }

        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }

        public Integer getRating() { return rating; }
        public void setRating(Integer rating) { this.rating = rating; }

        public Instant getInspectedAt() { return inspectedAt; }
        public void setInspectedAt(Instant inspectedAt) { this.inspectedAt = inspectedAt; }
    }

    public String getBatchCode() { return batchCode; }
    public void setBatchCode(String batchCode) { this.batchCode = batchCode; }

    public String getProductName() { return productName; }
    public void setProductName(String productName) { this.productName = productName; }

    public String getSku() { return sku; }
    public void setSku(String sku) { this.sku = sku; }

    public String getVillage() { return village; }
    public void setVillage(String village) { this.village = village; }

    public LocalDate getPackDate() { return packDate; }
    public void setPackDate(LocalDate packDate) { this.packDate = packDate; }

    public LocalDate getExpiryDate() { return expiryDate; }
    public void setExpiryDate(LocalDate expiryDate) { this.expiryDate = expiryDate; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public QualityCheckPublicDto getQualityCheck() { return qualityCheck; }
    public void setQualityCheck(QualityCheckPublicDto qualityCheck) { this.qualityCheck = qualityCheck; }

    public String getTraceabilityNote() { return traceabilityNote; }
    public void setTraceabilityNote(String traceabilityNote) { this.traceabilityNote = traceabilityNote; }
}
