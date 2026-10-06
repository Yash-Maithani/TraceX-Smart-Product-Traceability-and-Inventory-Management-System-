package com.tracex.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Document(collection = "inspections")
public class Inspection {

    @Id
    private String id;

    @Indexed
    private String batchId;

    @Indexed
    private String batchCode;

    private String productName;
    private String sku;
    private String status;
    private int rating;
    private List<ChecklistItem> checklist = new ArrayList<>();
    private String findings = "";
    private String recommendation = "";
    private InspectedBy inspectedBy;

    @Field("isLatest")
    @JsonProperty("isLatest")
    private boolean isLatest = true;

    @CreatedDate
    private Instant createdAt;

    public static class ChecklistItem {
        private String label;
        private Boolean passed;
        private String note = "";

        public ChecklistItem() {}

        public ChecklistItem(String label, Boolean passed, String note) {
            this.label = label;
            this.passed = passed;
            this.note = note != null ? note : "";
        }

        public String getLabel() { return label; }
        public void setLabel(String label) { this.label = label; }
        public Boolean getPassed() { return passed; }
        public void setPassed(Boolean passed) { this.passed = passed; }
        public String getNote() { return note; }
        public void setNote(String note) { this.note = note; }
    }

    public static class InspectedBy {
        private String userId;
        private String name;
        private String username;

        public InspectedBy() {}

        public InspectedBy(String userId, String name, String username) {
            this.userId = userId;
            this.name = name;
            this.username = username;
        }

        public String getUserId() { return userId; }
        public void setUserId(String userId) { this.userId = userId; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getUsername() { return username; }
        public void setUsername(String username) { this.username = username; }
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getBatchId() { return batchId; }
    public void setBatchId(String batchId) { this.batchId = batchId; }
    public String getBatchCode() { return batchCode; }
    public void setBatchCode(String batchCode) { this.batchCode = batchCode; }
    public String getProductName() { return productName; }
    public void setProductName(String productName) { this.productName = productName; }
    public String getSku() { return sku; }
    public void setSku(String sku) { this.sku = sku; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public int getRating() { return rating; }
    public void setRating(int rating) { this.rating = rating; }
    public List<ChecklistItem> getChecklist() { return checklist; }
    public void setChecklist(List<ChecklistItem> checklist) { this.checklist = checklist; }
    public String getFindings() { return findings; }
    public void setFindings(String findings) { this.findings = findings; }
    public String getRecommendation() { return recommendation; }
    public void setRecommendation(String recommendation) { this.recommendation = recommendation; }
    public InspectedBy getInspectedBy() { return inspectedBy; }
    public void setInspectedBy(InspectedBy inspectedBy) { this.inspectedBy = inspectedBy; }

    @JsonProperty("isLatest")
    public boolean isLatest() { return isLatest; }

    @JsonProperty("isLatest")
    public void setLatest(boolean latest) { isLatest = latest; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
