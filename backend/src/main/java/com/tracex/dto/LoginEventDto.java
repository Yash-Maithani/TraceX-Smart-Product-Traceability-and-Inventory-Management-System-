package com.tracex.dto;

import com.tracex.model.LoginEvent;

import java.time.Instant;

public class LoginEventDto {

    private String id;
    private String browser;
    private String os;
    private String device;
    private String method;
    private Instant createdAt;

    public static LoginEventDto fromEntity(LoginEvent event) {
        LoginEventDto dto = new LoginEventDto();
        dto.id = event.getId();
        dto.browser = event.getBrowser();
        dto.os = event.getOs();
        dto.device = event.getDevice();
        dto.method = event.getMethod();
        dto.createdAt = event.getCreatedAt();
        return dto;
    }

    public String getId() { return id; }
    public String getBrowser() { return browser; }
    public String getOs() { return os; }
    public String getDevice() { return device; }
    public String getMethod() { return method; }
    public Instant getCreatedAt() { return createdAt; }
}
