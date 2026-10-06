package com.tracex.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public class ResendOtpDto {

    @NotBlank(message = "Email is required")
    @Email(message = "Valid email is required")
    private String email;

    public ResendOtpDto() {
    }

    public ResendOtpDto(String email) {
        this.email = email;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }
}
