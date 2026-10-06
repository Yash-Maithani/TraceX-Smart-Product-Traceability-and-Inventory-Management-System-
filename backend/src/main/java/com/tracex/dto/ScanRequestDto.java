package com.tracex.dto;

import jakarta.validation.constraints.NotBlank;

public class ScanRequestDto {

    @NotBlank(message = "Token is required")
    private String token;

    private String source;

    public ScanRequestDto() {
    }

    public ScanRequestDto(String token, String source) {
        this.token = token;
        this.source = source;
    }

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }
}
