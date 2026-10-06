package com.tracex.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.tracex.model.Batch.DispatchHistoryEntry;
import com.tracex.model.Batch.NoteHistoryEntry;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public class BatchDetailDto extends BatchSummaryDto {
    private String traceabilityNote;
    private List<NoteHistoryEntry> noteHistory;
    private List<DispatchHistoryEntry> dispatchHistory;
    private Instant deletedAt;
    private String deletedBy;
    private String deleteNote;
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    @Schema(type = "string", format = "date", example = "2026-10-09")
    private LocalDate dispatchDate;
    private String buyerName;
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private String warning;
    private String qrAbsoluteUrl;

    public String getTraceabilityNote() { return traceabilityNote; }
    public void setTraceabilityNote(String traceabilityNote) { this.traceabilityNote = traceabilityNote; }
    public List<NoteHistoryEntry> getNoteHistory() { return noteHistory; }
    public void setNoteHistory(List<NoteHistoryEntry> noteHistory) { this.noteHistory = noteHistory; }
    public List<DispatchHistoryEntry> getDispatchHistory() { return dispatchHistory; }
    public void setDispatchHistory(List<DispatchHistoryEntry> dispatchHistory) { this.dispatchHistory = dispatchHistory; }
    public Instant getDeletedAt() { return deletedAt; }
    public void setDeletedAt(Instant deletedAt) { this.deletedAt = deletedAt; }
    public String getDeletedBy() { return deletedBy; }
    public void setDeletedBy(String deletedBy) { this.deletedBy = deletedBy; }
    public String getDeleteNote() { return deleteNote; }
    public void setDeleteNote(String deleteNote) { this.deleteNote = deleteNote; }
    public LocalDate getDispatchDate() { return dispatchDate; }
    public void setDispatchDate(LocalDate dispatchDate) { this.dispatchDate = dispatchDate; }
    public String getBuyerName() { return buyerName; }
    public void setBuyerName(String buyerName) { this.buyerName = buyerName; }
    public String getWarning() { return warning; }
    public void setWarning(String warning) { this.warning = warning; }
    public String getQrAbsoluteUrl() { return qrAbsoluteUrl; }
    public void setQrAbsoluteUrl(String qrAbsoluteUrl) { this.qrAbsoluteUrl = qrAbsoluteUrl; }
}
