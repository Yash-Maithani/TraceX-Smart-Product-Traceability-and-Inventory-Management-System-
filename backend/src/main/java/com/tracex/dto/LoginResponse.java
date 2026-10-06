package com.tracex.dto;

public class LoginResponse {

    private String token;
    private UserSummaryDto user;

    public LoginResponse() {
    }

    public LoginResponse(String token, UserSummaryDto user) {
        this.token = token;
        this.user = user;
    }

    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
    }

    public UserSummaryDto getUser() {
        return user;
    }

    public void setUser(UserSummaryDto user) {
        this.user = user;
    }
}
