package com.tracex.dto;

import com.tracex.model.ProductReport;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

/** Staff view of a shopper report. The IP hash stays on the server. */
public class ProductReportDto {

    private String id;
    private String batchId;
    private String batchCode;
    private String category;
    private String message;
    @Schema(nullable = true)
    private String contact;
    private String status;
    private Instant createdAt;
    @Schema(nullable = true)
    private Instant resolvedAt;
    @Schema(nullable = true)
    private String resolvedByName;
    @Schema(nullable = true)
    private String resolutionNote;

    public ProductReportDto() {
    }

    public static ProductReportDto from(ProductReport r) {
        ProductReportDto dto = new ProductReportDto();
        dto.id = r.getId();
        dto.batchId = r.getBatchId();
        dto.batchCode = r.getBatchCode();
        dto.category = r.getCategory();
        dto.message = r.getMessage();
        dto.contact = r.getContact();
        dto.status = r.getStatus();
        dto.createdAt = r.getCreatedAt();
        dto.resolvedAt = r.getResolvedAt();
        dto.resolvedByName = r.getResolvedByName();
        dto.resolutionNote = r.getResolutionNote();
        return dto;
    }

    public String getId() { return id; }
    public String getBatchId() { return batchId; }
    public String getBatchCode() { return batchCode; }
    public String getCategory() { return category; }
    public String getMessage() { return message; }
    public String getContact() { return contact; }
    public String getStatus() { return status; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getResolvedAt() { return resolvedAt; }
    public String getResolvedByName() { return resolvedByName; }
    public String getResolutionNote() { return resolutionNote; }
}
