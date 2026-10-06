package com.tracex.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.tracex.util.FlexibleLocalDateDeserializer;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

public class BatchDispatchDto {
    @NotBlank(message = "buyerName is required")
    @Size(max = 200, message = "buyerName cannot exceed 200 characters")
    private String buyerName;

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    @JsonDeserialize(using = FlexibleLocalDateDeserializer.class)
    @Schema(type = "string", format = "date", example = "2026-10-09")
    private LocalDate dispatchDate;

    @Size(max = 500, message = "overrideReason cannot exceed 500 characters")
    private String overrideReason;

    public BatchDispatchDto() {}

    public BatchDispatchDto(String buyerName, LocalDate dispatchDate, String overrideReason) {
        this.buyerName = buyerName;
        this.dispatchDate = dispatchDate;
        this.overrideReason = overrideReason;
    }

    public String getBuyerName() { return buyerName; }
    public void setBuyerName(String buyerName) { this.buyerName = buyerName; }
    public LocalDate getDispatchDate() { return dispatchDate; }
    public void setDispatchDate(LocalDate dispatchDate) { this.dispatchDate = dispatchDate; }
    public String getOverrideReason() { return overrideReason; }
    public void setOverrideReason(String overrideReason) { this.overrideReason = overrideReason; }
}
