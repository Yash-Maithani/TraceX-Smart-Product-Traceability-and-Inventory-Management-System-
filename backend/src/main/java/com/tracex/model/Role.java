package com.tracex.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum Role {
    ADMIN("admin"),
    MANAGER("manager"),
    FACTORY_MANAGER("factory-manager"),
    QUALITY_INSPECTOR("quality-inspector"),
    DISPATCH_COORDINATOR("dispatch-coordinator");

    private final String value;

    Role(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    @JsonCreator
    public static Role fromValue(String value) {
        if (value == null) {
            return null;
        }
        for (Role role : Role.values()) {
            if (role.value.equalsIgnoreCase(value.trim()) || role.name().equalsIgnoreCase(value.trim())) {
                return role;
            }
        }
        throw new IllegalArgumentException("Unknown role: " + value);
    }

    @Override
    public String toString() {
        return value;
    }
}
