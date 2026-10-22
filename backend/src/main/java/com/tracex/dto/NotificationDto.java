package com.tracex.dto;

import com.tracex.model.Notification;

import java.time.Instant;
import java.util.List;

public class NotificationDto {

    private String id;
    private String type;
    private String title;
    private String message;
    private String refType;
    private String refId;
    private String triggeredByName;
    private boolean read;
    private Instant createdAt;

    /** `read` is computed for the given user from the per-user `readBy` list. */
    public static NotificationDto forUser(Notification n, String userId) {
        NotificationDto dto = new NotificationDto();
        dto.id = n.getId();
        dto.type = n.getType();
        dto.title = n.getTitle();
        dto.message = n.getMessage();
        dto.refType = n.getRefType();
        dto.refId = n.getRefId();
        dto.triggeredByName = n.getTriggeredBy() != null ? n.getTriggeredBy().getName() : null;
        dto.read = n.getReadBy() != null && n.getReadBy().contains(userId);
        dto.createdAt = n.getCreatedAt();
        return dto;
    }

    public String getId() { return id; }
    public String getType() { return type; }
    public String getTitle() { return title; }
    public String getMessage() { return message; }
    public String getRefType() { return refType; }
    public String getRefId() { return refId; }
    public String getTriggeredByName() { return triggeredByName; }
    public boolean isRead() { return read; }
    public Instant getCreatedAt() { return createdAt; }

    public static class NotificationListDto {
        private List<NotificationDto> items;
        private long unreadCount;

        public NotificationListDto() {
        }

        public NotificationListDto(List<NotificationDto> items, long unreadCount) {
            this.items = items;
            this.unreadCount = unreadCount;
        }

        public List<NotificationDto> getItems() { return items; }
        public long getUnreadCount() { return unreadCount; }
    }

    public static class ReadAllResultDto {
        private long marked;

        public ReadAllResultDto() {
        }

        public ReadAllResultDto(long marked) {
            this.marked = marked;
        }

        public long getMarked() { return marked; }
    }
}
