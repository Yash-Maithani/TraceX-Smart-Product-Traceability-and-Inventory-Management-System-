package com.tracex.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * One successful sign-in (SPEC §4 `loginevents`, S-03). Kept for 30 days by a TTL index.
 * No IP address, city or country is stored: the new build has no geo-IP service, and a raw IP
 * would be personal data with no use on this screen.
 */
@Document(collection = "loginevents")
@CompoundIndexes({
    @CompoundIndex(name = "userId_createdAt_desc_idx", def = "{'userId': 1, 'createdAt': -1}")
})
public class LoginEvent {

    public static final long TTL_SECONDS = 2_592_000L; // 30 days

    @Id
    private String id;

    private String userId;
    private String username;
    private String browser;
    private String os;
    private String device;
    private String method; // "password" (Google sign-in arrives in Phase 11)

    @Indexed(name = "createdAt_ttl_idx", expireAfterSeconds = 2_592_000)
    private Instant createdAt;

    public LoginEvent() {
    }

    public LoginEvent(String userId, String username, String browser, String os, String device, String method, Instant createdAt) {
        this.userId = userId;
        this.username = username;
        this.browser = browser;
        this.os = os;
        this.device = device;
        this.method = method;
        this.createdAt = createdAt;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getBrowser() { return browser; }
    public void setBrowser(String browser) { this.browser = browser; }
    public String getOs() { return os; }
    public void setOs(String os) { this.os = os; }
    public String getDevice() { return device; }
    public void setDevice(String device) { this.device = device; }
    public String getMethod() { return method; }
    public void setMethod(String method) { this.method = method; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
