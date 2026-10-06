package com.tracex.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "accessrequests")
public class AccessRequest {

    @Id
    private String id;

    private String name;

    @Indexed(unique = true)
    private String email;

    private Role role;

    private AccessRequestStatus status = AccessRequestStatus.PENDING;

    private String note;

    @JsonIgnore
    private String inviteToken; // SHA-256 hash only

    private Instant inviteExpiry;

    private boolean inviteUsed = false;

    private String approvedBy;

    private boolean synthetic = false;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    public AccessRequest() {
    }

    public AccessRequest(String name, String email, Role role) {
        this.name = name;
        this.email = email != null ? email.toLowerCase().trim() : null;
        this.role = role;
        this.status = AccessRequestStatus.PENDING;
        this.inviteUsed = false;
        this.synthetic = false;
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
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
        this.email = email != null ? email.toLowerCase().trim() : null;
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

    public String getInviteToken() {
        return inviteToken;
    }

    public void setInviteToken(String inviteToken) {
        this.inviteToken = inviteToken;
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

    public boolean isSynthetic() {
        return synthetic;
    }

    public void setSynthetic(boolean synthetic) {
        this.synthetic = synthetic;
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
