package com.tracex.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * In-app notification (SPEC §4 `notifications`, M-09). Kept for 7 days by a TTL index.
 *
 * Audience: `recipientUserId` for one person, otherwise every user whose role is in `recipientRoles`
 * (a super-admin also receives anything addressed to `admin`). Read state is per user (`readBy`),
 * not one shared flag: in the reference, one person reading a role notification marked it read for
 * the whole role.
 */
@Document(collection = "notifications")
@CompoundIndexes({
    @CompoundIndex(name = "recipientRoles_createdAt_desc_idx", def = "{'recipientRoles': 1, 'createdAt': -1}"),
    @CompoundIndex(name = "recipientUserId_createdAt_desc_idx", def = "{'recipientUserId': 1, 'createdAt': -1}")
})
public class Notification {

    public static final long TTL_SECONDS = 604_800L; // 7 days

    @Id
    private String id;

    private List<String> recipientRoles = new ArrayList<>();
    private String recipientUserId;
    private String type;    // batch_created, batch_imported, import_finished, batch_dispatched, inspection_completed, admin_action
    private String title;   // max 120
    private String message; // max 400
    private String refType; // batch, import, inspection, access_request
    private String refId;
    private TriggeredBy triggeredBy;
    private List<String> readBy = new ArrayList<>();

    @Indexed(name = "createdAt_ttl_idx", expireAfterSeconds = 604_800)
    private Instant createdAt;

    public static class TriggeredBy {
        private String userId;
        private String name;
        private String role;

        public TriggeredBy() {
        }

        public TriggeredBy(String userId, String name, String role) {
            this.userId = userId;
            this.name = name;
            this.role = role;
        }

        public String getUserId() { return userId; }
        public void setUserId(String userId) { this.userId = userId; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getRole() { return role; }
        public void setRole(String role) { this.role = role; }
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public List<String> getRecipientRoles() { return recipientRoles; }
    public void setRecipientRoles(List<String> recipientRoles) { this.recipientRoles = recipientRoles; }
    public String getRecipientUserId() { return recipientUserId; }
    public void setRecipientUserId(String recipientUserId) { this.recipientUserId = recipientUserId; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public String getRefType() { return refType; }
    public void setRefType(String refType) { this.refType = refType; }
    public String getRefId() { return refId; }
    public void setRefId(String refId) { this.refId = refId; }
    public TriggeredBy getTriggeredBy() { return triggeredBy; }
    public void setTriggeredBy(TriggeredBy triggeredBy) { this.triggeredBy = triggeredBy; }
    public List<String> getReadBy() { return readBy; }
    public void setReadBy(List<String> readBy) { this.readBy = readBy; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
