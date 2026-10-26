package com.tracex.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** A shopper's report from the public QR page. Contact is optional so a shopper can stay anonymous. */
public class ProductReportRequestDto {

    @NotBlank(message = "Token is required")
    private String token;

    @NotBlank(message = "Choose what went wrong")
    @Pattern(regexp = "TASTE_OR_SMELL|PACKAGING|FOREIGN_OBJECT|ILLNESS|EXPIRY|OTHER",
            message = "Category must be one of TASTE_OR_SMELL, PACKAGING, FOREIGN_OBJECT, ILLNESS, EXPIRY, OTHER")
    private String category;

    @NotBlank(message = "Describe the problem")
    @Size(min = 10, max = 1000, message = "Description must be 10 to 1000 characters")
    private String message;

    @Size(max = 120, message = "Contact must be at most 120 characters")
    private String contact;

    public ProductReportRequestDto() {
    }

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public String getContact() { return contact; }
    public void setContact(String contact) { this.contact = contact; }
}
