package com.tracex.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;
import java.util.List;

public class DashboardSummaryDto {

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    @Schema(type = "string", format = "date", example = "2026-10-06")
    private LocalDate businessDate;

    private long expired;
    private long urgent;
    private long warning;
    private long ready;
    private long exception;
    private long dispatched;
    private long totalActive;

    private StatusCounts statusCounts;
    private InspectionVerdictCounts inspectionVerdicts;
    private List<BatchSummaryDto> topExpiring;
    private Long pendingAccessRequests;

    public static class StatusCounts {
        @JsonProperty("EXPIRED")
        private long expired;

        @JsonProperty("URGENT")
        private long urgent;

        @JsonProperty("WARNING")
        private long warning;

        @JsonProperty("READY")
        private long ready;

        @JsonProperty("EXCEPTION")
        private long exception;

        @JsonProperty("DISPATCHED")
        private long dispatched;

        public StatusCounts() {}

        public StatusCounts(long expired, long urgent, long warning, long ready, long exception, long dispatched) {
            this.expired = expired;
            this.urgent = urgent;
            this.warning = warning;
            this.ready = ready;
            this.exception = exception;
            this.dispatched = dispatched;
        }

        public long getExpired() { return expired; }
        public void setExpired(long expired) { this.expired = expired; }
        public long getUrgent() { return urgent; }
        public void setUrgent(long urgent) { this.urgent = urgent; }
        public long getWarning() { return warning; }
        public void setWarning(long warning) { this.warning = warning; }
        public long getReady() { return ready; }
        public void setReady(long ready) { this.ready = ready; }
        public long getException() { return exception; }
        public void setException(long exception) { this.exception = exception; }
        public long getDispatched() { return dispatched; }
        public void setDispatched(long dispatched) { this.dispatched = dispatched; }
    }

    public static class InspectionVerdictCounts {
        @JsonProperty("PASSED")
        private long passed;

        @JsonProperty("FAILED")
        private long failed;

        @JsonProperty("FLAGGED")
        private long flagged;

        @JsonProperty("none")
        private long none;

        public InspectionVerdictCounts() {}

        public InspectionVerdictCounts(long passed, long failed, long flagged, long none) {
            this.passed = passed;
            this.failed = failed;
            this.flagged = flagged;
            this.none = none;
        }

        public long getPassed() { return passed; }
        public void setPassed(long passed) { this.passed = passed; }
        public long getFailed() { return failed; }
        public void setFailed(long failed) { this.failed = failed; }
        public long getFlagged() { return flagged; }
        public void setFlagged(long flagged) { this.flagged = flagged; }
        public long getNone() { return none; }
        public void setNone(long none) { this.none = none; }
    }

    public LocalDate getBusinessDate() { return businessDate; }
    public void setBusinessDate(LocalDate businessDate) { this.businessDate = businessDate; }
    public long getExpired() { return expired; }
    public void setExpired(long expired) { this.expired = expired; }
    public long getUrgent() { return urgent; }
    public void setUrgent(long urgent) { this.urgent = urgent; }
    public long getWarning() { return warning; }
    public void setWarning(long warning) { this.warning = warning; }
    public long getReady() { return ready; }
    public void setReady(long ready) { this.ready = ready; }
    public long getException() { return exception; }
    public void setException(long exception) { this.exception = exception; }
    public long getDispatched() { return dispatched; }
    public void setDispatched(long dispatched) { this.dispatched = dispatched; }
    public long getTotalActive() { return totalActive; }
    public void setTotalActive(long totalActive) { this.totalActive = totalActive; }
    public StatusCounts getStatusCounts() { return statusCounts; }
    public void setStatusCounts(StatusCounts statusCounts) { this.statusCounts = statusCounts; }
    public InspectionVerdictCounts getInspectionVerdicts() { return inspectionVerdicts; }
    public void setInspectionVerdicts(InspectionVerdictCounts inspectionVerdicts) { this.inspectionVerdicts = inspectionVerdicts; }
    public List<BatchSummaryDto> getTopExpiring() { return topExpiring; }
    public void setTopExpiring(List<BatchSummaryDto> topExpiring) { this.topExpiring = topExpiring; }
    public Long getPendingAccessRequests() { return pendingAccessRequests; }
    public void setPendingAccessRequests(Long pendingAccessRequests) { this.pendingAccessRequests = pendingAccessRequests; }
}
