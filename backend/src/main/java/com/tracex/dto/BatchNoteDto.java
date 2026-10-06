package com.tracex.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class BatchNoteDto {
    @NotBlank @Size(max=2000)
    private String note;

    public BatchNoteDto() {}

    public BatchNoteDto(String note) {
        this.note = note;
    }

    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
}
