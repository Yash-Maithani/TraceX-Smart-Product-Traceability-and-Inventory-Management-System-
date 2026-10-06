package com.tracex.service;

public interface EmailService {

    void sendInviteEmail(String toEmail, String name, String inviteToken);

    void sendActivationOtpEmail(String toEmail, String name, String rawOtp);

    void sendPasswordResetOtpEmail(String toEmail, String name, String rawOtp);
}
