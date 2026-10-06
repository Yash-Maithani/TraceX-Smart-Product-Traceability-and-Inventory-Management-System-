package com.tracex.dto;

public class RejectRequestDto {

    private String note;

    public RejectRequestDto() {
    }

    public RejectRequestDto(String note) {
        this.note = note;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }
}
