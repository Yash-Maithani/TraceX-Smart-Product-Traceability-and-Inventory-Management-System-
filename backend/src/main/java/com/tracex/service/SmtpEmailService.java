package com.tracex.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.nio.charset.StandardCharsets;

@Service
@ConditionalOnProperty(name = "tracex.mail.sink.enabled", havingValue = "false")
public class SmtpEmailService implements EmailService {

    private static final Logger log = LoggerFactory.getLogger(SmtpEmailService.class);

    private final JavaMailSender mailSender;
    private final String fromName;
    private final String fromAddr;
    private final String frontendUrl;

    public SmtpEmailService(JavaMailSender mailSender,
                            @Value("${tracex.mail.from-name:TraceX Platform}") String fromName,
                            @Value("${tracex.mail.from-addr:noreply@tracex.demo}") String fromAddr,
                            @Value("${tracex.security.frontend-url:http://localhost:5174}") String frontendUrl) {
        this.mailSender = mailSender;
        this.fromName = fromName;
        this.fromAddr = fromAddr;
        this.frontendUrl = frontendUrl.endsWith("/") ? frontendUrl.substring(0, frontendUrl.length() - 1) : frontendUrl;
    }

    @Override
    public void sendInviteEmail(String toEmail, String name, String inviteToken) {
        String activationUrl = frontendUrl + "/activate?token=" + inviteToken;
        String html = loadTemplate("templates/email/invite.html")
                .replace("%NAME%", name != null ? name : "User")
                .replace("%ACTIVATION_URL%", activationUrl);
        String text = loadTemplate("templates/email/invite.txt")
                .replace("%NAME%", name != null ? name : "User")
                .replace("%ACTIVATION_URL%", activationUrl);

        sendMimeEmail(toEmail, "TraceX Account Invitation", text, html);
    }

    @Override
    public void sendActivationOtpEmail(String toEmail, String name, String rawOtp) {
        String html = loadTemplate("templates/email/activation-otp.html")
                .replace("%NAME%", name != null ? name : "User")
                .replace("%OTP_CODE%", rawOtp);
        String text = loadTemplate("templates/email/activation-otp.txt")
                .replace("%NAME%", name != null ? name : "User")
                .replace("%OTP_CODE%", rawOtp);

        sendMimeEmail(toEmail, "TraceX Account Verification Code", text, html);
    }

    @Override
    public void sendPasswordResetOtpEmail(String toEmail, String name, String rawOtp) {
        String html = loadTemplate("templates/email/password-reset-otp.html")
                .replace("%NAME%", name != null ? name : "User")
                .replace("%OTP_CODE%", rawOtp);
        String text = loadTemplate("templates/email/password-reset-otp.txt")
                .replace("%NAME%", name != null ? name : "User")
                .replace("%OTP_CODE%", rawOtp);

        sendMimeEmail(toEmail, "TraceX Password Reset Code", text, html);
    }

    private void sendMimeEmail(String toEmail, String subject, String textBody, String htmlBody) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(new InternetAddress(fromAddr, fromName));
            helper.setTo(toEmail);
            helper.setSubject(subject);
            helper.setText(textBody, htmlBody);

            mailSender.send(message);
            // Log message dispatch without any secrets
            log.info("Sent SMTP email with subject '{}' to recipient", subject);
        } catch (MessagingException | UnsupportedEncodingException e) {
            log.error("Failed to send SMTP email to recipient: {}", e.getMessage());
            throw new RuntimeException("Failed to send email via SMTP", e);
        }
    }

    private String loadTemplate(String path) {
        try {
            ClassPathResource resource = new ClassPathResource(path);
            return new String(resource.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            log.error("Failed to load email template: {}", path);
            return "";
        }
    }
}
