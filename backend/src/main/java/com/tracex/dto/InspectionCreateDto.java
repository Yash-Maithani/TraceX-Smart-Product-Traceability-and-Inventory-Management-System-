package com.tracex.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.tracex.model.Inspection;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public class InspectionCreateDto {
    private String batchId;
    private String status;
    private Integer rating;
    private List<Inspection.ChecklistItem> checklist;
    private String findings;
    private String recommendation;
    // Accepted in payload so Jackson does not fail, but ignored by server (server always controls isLatest)
    private Boolean isLatest;

    public InspectionCreateDto() {}

    public String getBatchId() { return batchId; }
    public void setBatchId(String batchId) { this.batchId = batchId; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Integer getRating() { return rating; }
    public void setRating(Integer rating) { this.rating = rating; }
    public List<Inspection.ChecklistItem> getChecklist() { return checklist; }
    public void setChecklist(List<Inspection.ChecklistItem> checklist) { this.checklist = checklist; }
    public String getFindings() { return findings; }
    public void setFindings(String findings) { this.findings = findings; }
    public String getRecommendation() { return recommendation; }
    public void setRecommendation(String recommendation) { this.recommendation = recommendation; }
    public Boolean getIsLatest() { return isLatest; }
    public void setIsLatest(Boolean isLatest) { this.isLatest = isLatest; }
}
