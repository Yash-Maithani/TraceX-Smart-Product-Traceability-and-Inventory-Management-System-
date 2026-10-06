package com.tracex.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.tracex.util.FlexibleLocalDateDeserializer;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.*;
import java.time.LocalDate;

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
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    @JsonDeserialize(using = FlexibleLocalDateDeserializer.class)
    @Schema(type = "string", format = "date", example = "2026-10-09")
    private LocalDate packDate;
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    @JsonDeserialize(using = FlexibleLocalDateDeserializer.class)
    @Schema(type = "string", format = "date", example = "2026-10-09")
    private LocalDate expiryDate;
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
    public LocalDate getPackDate() { return packDate; }
    public void setPackDate(LocalDate packDate) { this.packDate = packDate; }
    public LocalDate getExpiryDate() { return expiryDate; }
    public void setExpiryDate(LocalDate expiryDate) { this.expiryDate = expiryDate; }
    public String getTraceabilityNote() { return traceabilityNote; }
    public void setTraceabilityNote(String traceabilityNote) { this.traceabilityNote = traceabilityNote; }
}
