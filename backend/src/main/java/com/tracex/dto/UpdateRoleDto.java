package com.tracex.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.tracex.model.Role;
import jakarta.validation.constraints.NotNull;

@JsonIgnoreProperties(ignoreUnknown = true)
public class UpdateRoleDto {

    @NotNull(message = "Role is required")
    private Role role;

    public UpdateRoleDto() {
    }

    public UpdateRoleDto(Role role) {
        this.role = role;
    }

    public Role getRole() {
        return role;
    }

    public void setRole(Role role) {
        this.role = role;
    }
}
