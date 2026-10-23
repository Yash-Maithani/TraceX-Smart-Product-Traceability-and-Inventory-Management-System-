package com.tracex.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** The `credential` (Google ID token) returned by the Sign in with Google button (Phase 11). */
public class GoogleCredentialDto {

    @NotBlank(message = "Google credential is required")
    @Size(max = 4096)
    private String credential;

    public GoogleCredentialDto() {
    }

    public GoogleCredentialDto(String credential) {
        this.credential = credential;
    }

    public String getCredential() { return credential; }
    public void setCredential(String credential) { this.credential = credential; }
}
