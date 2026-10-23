package com.tracex.dto;

import com.tracex.model.Role;
import com.tracex.model.User;

import java.time.Instant;

public class UserSummaryDto {

    private String id;
    private String username;
    private String name;
    private String email;
    private String phone;
    private Role role;
    private boolean isSuperAdmin;
    private boolean isActive;
    private boolean isDeleted;
    private boolean emailVerified;
    private Instant createdAt;
    private Instant updatedAt;
    private User.Preferences preferences;
    private String googleEmail;

    public UserSummaryDto() {
    }

    public static UserSummaryDto fromEntity(User user) {
        if (user == null) {
            return null;
        }
        UserSummaryDto dto = new UserSummaryDto();
        dto.setId(user.getId());
        dto.setUsername(user.getUsername());
        dto.setName(user.getName());
        dto.setEmail(user.getEmail());
        dto.setPhone(user.getPhone());
        dto.setRole(user.getRole());
        dto.setSuperAdmin(user.isSuperAdmin());
        dto.setActive(user.isActive());
        dto.setDeleted(user.isDeleted());
        dto.setEmailVerified(user.isEmailVerified());
        dto.setCreatedAt(user.getCreatedAt());
        dto.setUpdatedAt(user.getUpdatedAt());
        // null until the user first saves settings, so the client keeps its local choices until then
        dto.setPreferences(user.getPreferences());
        dto.setGoogleEmail(user.getGoogleEmail());
        return dto;
    }

    public String getGoogleEmail() {
        return googleEmail;
    }

    public void setGoogleEmail(String googleEmail) {
        this.googleEmail = googleEmail;
    }

    public User.Preferences getPreferences() {
        return preferences;
    }

    public void setPreferences(User.Preferences preferences) {
        this.preferences = preferences;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
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

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public Role getRole() {
        return role;
    }

    public void setRole(Role role) {
        this.role = role;
    }

    public boolean isSuperAdmin() {
        return isSuperAdmin;
    }

    public void setSuperAdmin(boolean superAdmin) {
        isSuperAdmin = superAdmin;
    }

    public boolean isActive() {
        return isActive;
    }

    public void setActive(boolean active) {
        isActive = active;
    }

    public boolean isDeleted() {
        return isDeleted;
    }

    public void setDeleted(boolean deleted) {
        isDeleted = deleted;
    }

    public boolean isEmailVerified() {
        return emailVerified;
    }

    public void setEmailVerified(boolean emailVerified) {
        this.emailVerified = emailVerified;
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
