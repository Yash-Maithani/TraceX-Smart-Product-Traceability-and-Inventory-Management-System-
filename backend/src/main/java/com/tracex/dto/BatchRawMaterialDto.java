package com.tracex.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.tracex.util.FlexibleLocalDateDeserializer;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

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
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    @JsonDeserialize(using = FlexibleLocalDateDeserializer.class)
    @Schema(type = "string", format = "date", example = "2026-10-09")
    private LocalDate expiryDate;

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
    public LocalDate getExpiryDate() { return expiryDate; }
    public void setExpiryDate(LocalDate expiryDate) { this.expiryDate = expiryDate; }
}
