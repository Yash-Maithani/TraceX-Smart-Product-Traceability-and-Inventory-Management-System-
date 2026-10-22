package com.tracex.dto;

import com.tracex.model.Message;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/** Request and response shapes for /api/v1/messages (Phase 10.1). */
public final class MessageDtos {

    private MessageDtos() {
    }

    public static class MessageBodyDto {
        @NotBlank(message = "Message body is required")
        @Size(max = Message.MAX_BODY, message = "Message cannot exceed 2000 characters")
        private String body;

        public MessageBodyDto() {
        }

        public MessageBodyDto(String body) {
            this.body = body;
        }

        public String getBody() { return body; }
        public void setBody(String body) { this.body = body; }
    }

    /** A deleted message keeps its place in the conversation but loses its body (reference `present`). */
    public static class MessageDto {
        private String id;
        private String scope;
        private String body;
        private String authorName;
        private String authorRole;
        private boolean mine;
        private boolean deleted;
        private int editCount;
        private Instant editedAt;
        private Instant createdAt;
        private Instant expiresAt;

        public static MessageDto present(Message m, String viewerId) {
            MessageDto dto = new MessageDto();
            dto.id = m.getId();
            dto.scope = m.getScope();
            dto.authorName = m.getAuthorName();
            dto.authorRole = m.getAuthorRole();
            dto.mine = m.getAuthorId() != null && m.getAuthorId().equals(viewerId);
            dto.deleted = m.isDeleted();
            dto.createdAt = m.getCreatedAt();
            if (!m.isDeleted()) {
                dto.body = m.getBody();
                dto.editCount = m.getEditHistory() != null ? m.getEditHistory().size() : 0;
                dto.editedAt = m.getEditedAt();
                dto.expiresAt = m.getExpiresAt();
            }
            return dto;
        }

        public String getId() { return id; }
        public String getScope() { return scope; }
        public String getBody() { return body; }
        public String getAuthorName() { return authorName; }
        public String getAuthorRole() { return authorRole; }
        public boolean isMine() { return mine; }
        public boolean isDeleted() { return deleted; }
        public int getEditCount() { return editCount; }
        public Instant getEditedAt() { return editedAt; }
        public Instant getCreatedAt() { return createdAt; }
        public Instant getExpiresAt() { return expiresAt; }
    }

    public static class ChannelActivityDto {
        private Instant lastAt;
        private String lastAuthor;
        private String lastBody; // first 90 characters
        private long total;

        public ChannelActivityDto() {
        }

        public ChannelActivityDto(Instant lastAt, String lastAuthor, String lastBody, long total) {
            this.lastAt = lastAt;
            this.lastAuthor = lastAuthor;
            this.lastBody = lastBody;
            this.total = total;
        }

        public Instant getLastAt() { return lastAt; }
        public String getLastAuthor() { return lastAuthor; }
        public String getLastBody() { return lastBody; }
        public long getTotal() { return total; }
    }

    public static class ChannelsDto {
        private List<String> channels;
        private boolean superAdmin;
        private long retentionDays;
        private Map<String, Long> memberCounts;
        private Map<String, ChannelActivityDto> activity;

        public ChannelsDto() {
        }

        public ChannelsDto(List<String> channels, boolean superAdmin, long retentionDays,
                           Map<String, Long> memberCounts, Map<String, ChannelActivityDto> activity) {
            this.channels = channels;
            this.superAdmin = superAdmin;
            this.retentionDays = retentionDays;
            this.memberCounts = memberCounts;
            this.activity = activity;
        }

        public List<String> getChannels() { return channels; }
        public boolean isSuperAdmin() { return superAdmin; }
        public long getRetentionDays() { return retentionDays; }
        public Map<String, Long> getMemberCounts() { return memberCounts; }
        public Map<String, ChannelActivityDto> getActivity() { return activity; }
    }
}
