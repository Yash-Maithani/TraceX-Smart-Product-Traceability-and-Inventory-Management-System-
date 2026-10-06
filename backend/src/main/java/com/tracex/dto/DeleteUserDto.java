package com.tracex.dto;

public class DeleteUserDto {

    private String deleteNote;

    public DeleteUserDto() {
    }

    public DeleteUserDto(String deleteNote) {
        this.deleteNote = deleteNote;
    }

    public String getDeleteNote() {
        return deleteNote;
    }

    public void setDeleteNote(String deleteNote) {
        this.deleteNote = deleteNote;
    }
}
