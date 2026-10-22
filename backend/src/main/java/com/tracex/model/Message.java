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
 * One collection for two conversations (SPEC §4 `messages`, S-05, reference `Message.model.js`).
 *
 * `scope = "record"`: a comment on a batch or inspection. Audit evidence: `expiresAt` stays null so
 * the TTL index never removes it, edits keep the previous text, and deletes are soft.
 * `scope = "channel"`: role chat. `expiresAt` is 90 days after posting.
 */
@Document(collection = "messages")
@CompoundIndexes({
    @CompoundIndex(name = "record_thread_idx", def = "{'scope': 1, 'refType': 1, 'refId': 1, 'createdAt': 1}"),
    @CompoundIndex(name = "channel_feed_idx", def = "{'scope': 1, 'channelRole': 1, 'createdAt': -1}")
})
public class Message {

    public static final long CHANNEL_RETENTION_DAYS = 90;
    public static final int MAX_BODY = 2000;

    @Id
    private String id;

    private String scope;       // record | channel
    private String refType;     // batch | inspection (record only)
    private String refId;       // record only
    private String channelRole; // role value (channel only)

    private String body;
    private String authorId;
    private String authorName;
    private String authorRole;

    private List<Edit> editHistory = new ArrayList<>();
    private Instant editedAt;

    private boolean isDeleted = false;
    private Instant deletedAt;
    private String deletedBy;

    /** Null keeps the message forever; a date lets the TTL index delete it then. */
    @Indexed(name = "expiresAt_ttl_idx", expireAfterSeconds = 0)
    private Instant expiresAt;

    private Instant createdAt;
    private Instant updatedAt;

    public static class Edit {
        private String body;
        private Instant editedAt;

        public Edit() {
        }

        public Edit(String body, Instant editedAt) {
            this.body = body;
            this.editedAt = editedAt;
        }

        public String getBody() { return body; }
        public void setBody(String body) { this.body = body; }
        public Instant getEditedAt() { return editedAt; }
        public void setEditedAt(Instant editedAt) { this.editedAt = editedAt; }
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getScope() { return scope; }
    public void setScope(String scope) { this.scope = scope; }
    public String getRefType() { return refType; }
    public void setRefType(String refType) { this.refType = refType; }
    public String getRefId() { return refId; }
    public void setRefId(String refId) { this.refId = refId; }
    public String getChannelRole() { return channelRole; }
    public void setChannelRole(String channelRole) { this.channelRole = channelRole; }
    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
    public String getAuthorId() { return authorId; }
    public void setAuthorId(String authorId) { this.authorId = authorId; }
    public String getAuthorName() { return authorName; }
    public void setAuthorName(String authorName) { this.authorName = authorName; }
    public String getAuthorRole() { return authorRole; }
    public void setAuthorRole(String authorRole) { this.authorRole = authorRole; }
    public List<Edit> getEditHistory() { return editHistory; }
    public void setEditHistory(List<Edit> editHistory) { this.editHistory = editHistory; }
    public Instant getEditedAt() { return editedAt; }
    public void setEditedAt(Instant editedAt) { this.editedAt = editedAt; }
    public boolean isDeleted() { return isDeleted; }
    public void setDeleted(boolean deleted) { isDeleted = deleted; }
    public Instant getDeletedAt() { return deletedAt; }
    public void setDeletedAt(Instant deletedAt) { this.deletedAt = deletedAt; }
    public String getDeletedBy() { return deletedBy; }
    public void setDeletedBy(String deletedBy) { this.deletedBy = deletedBy; }
    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
