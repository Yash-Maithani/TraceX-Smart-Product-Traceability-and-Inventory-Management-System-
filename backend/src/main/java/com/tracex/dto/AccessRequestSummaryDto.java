package com.tracex.dto;

import com.tracex.model.AccessRequest;
import com.tracex.model.AccessRequestStatus;
import com.tracex.model.Role;

import java.time.Instant;

public class AccessRequestSummaryDto {

    private String id;
    private String name;
    private String email;
    private Role role;
    private AccessRequestStatus status;
    private String note;
    private Instant inviteExpiry;
    private boolean inviteUsed;
    private String approvedBy;
    private Instant createdAt;
    private Instant updatedAt;

    public AccessRequestSummaryDto() {
    }

    public static AccessRequestSummaryDto fromEntity(AccessRequest request) {
        if (request == null) {
            return null;
        }
        AccessRequestSummaryDto dto = new AccessRequestSummaryDto();
        dto.setId(request.getId());
        dto.setName(request.getName());
        dto.setEmail(request.getEmail());
        dto.setRole(request.getRole());
        dto.setStatus(request.getStatus());
        dto.setNote(request.getNote());
        dto.setInviteExpiry(request.getInviteExpiry());
        dto.setInviteUsed(request.isInviteUsed());
        dto.setApprovedBy(request.getApprovedBy());
        dto.setCreatedAt(request.getCreatedAt());
        dto.setUpdatedAt(request.getUpdatedAt());
        return dto;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public Role getRole() {
        return role;
    }

    public void setRole(Role role) {
        this.role = role;
    }

    public AccessRequestStatus getStatus() {
        return status;
    }

    public void setStatus(AccessRequestStatus status) {
        this.status = status;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public Instant getInviteExpiry() {
        return inviteExpiry;
    }

    public void setInviteExpiry(Instant inviteExpiry) {
        this.inviteExpiry = inviteExpiry;
    }

    public boolean isInviteUsed() {
        return inviteUsed;
    }

    public void setInviteUsed(boolean inviteUsed) {
        this.inviteUsed = inviteUsed;
    }

    public String getApprovedBy() {
        return approvedBy;
    }

    public void setApprovedBy(String approvedBy) {
        this.approvedBy = approvedBy;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
