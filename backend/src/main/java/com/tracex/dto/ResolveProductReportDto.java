package com.tracex.dto;

import jakarta.validation.constraints.Size;

public class ResolveProductReportDto {

    @Size(max = 500, message = "Note must be at most 500 characters")
    private String note;

    public ResolveProductReportDto() {
    }

    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
}
