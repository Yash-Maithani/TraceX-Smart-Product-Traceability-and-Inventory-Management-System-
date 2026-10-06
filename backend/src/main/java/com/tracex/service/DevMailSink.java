package com.tracex.service;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.env.Environment;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

@Service
@ConditionalOnProperty(name = "tracex.mail.sink.enabled", havingValue = "true", matchIfMissing = true)
public class DevMailSink implements EmailService {

    private static final Logger log = LoggerFactory.getLogger(DevMailSink.class);
    private static final AtomicLong COUNTER = new AtomicLong(0);

    private final Environment environment;
    private final String frontendUrl;
    private final Path sinkDirectory;

    public DevMailSink(Environment environment,
                       @Value("${tracex.security.frontend-url:http://localhost:5174}") String frontendUrl,
                       @Value("${tracex.mail.sink.dir:target/dev-mail}") String sinkDir) {
        this.environment = environment;
        this.frontendUrl = frontendUrl.endsWith("/") ? frontendUrl.substring(0, frontendUrl.length() - 1) : frontendUrl;
        this.sinkDirectory = Paths.get(sinkDir).toAbsolutePath();
    }

    @PostConstruct
    public void init() {
        if (Arrays.asList(environment.getActiveProfiles()).contains("prod")) {
            throw new IllegalStateException("DevMailSink is strictly prohibited in the production profile.");
        }

        try {
            Files.createDirectories(sinkDirectory);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to create dev-mail directory: " + sinkDirectory, e);
        }
    }

    @Override
    public void sendInviteEmail(String toEmail, String name, String inviteToken) {
        String activationUrl = frontendUrl + "/activate?token=" + inviteToken;
        String htmlTemplate = loadTemplate("templates/email/invite.html")
                .replace("%NAME%", name != null ? name : "User")
                .replace("%ACTIVATION_URL%", activationUrl);
        String textTemplate = loadTemplate("templates/email/invite.txt")
                .replace("%NAME%", name != null ? name : "User")
                .replace("%ACTIVATION_URL%", activationUrl);

        writeMessage("invite", toEmail, "TraceX Account Invitation", textTemplate, htmlTemplate, activationUrl, null);
    }

    @Override
    public void sendActivationOtpEmail(String toEmail, String name, String rawOtp) {
        String htmlTemplate = loadTemplate("templates/email/activation-otp.html")
                .replace("%NAME%", name != null ? name : "User")
                .replace("%OTP_CODE%", rawOtp);
        String textTemplate = loadTemplate("templates/email/activation-otp.txt")
                .replace("%NAME%", name != null ? name : "User")
                .replace("%OTP_CODE%", rawOtp);

        writeMessage("activation-otp", toEmail, "TraceX Account Verification Code", textTemplate, htmlTemplate, null, rawOtp);
    }

    @Override
    public void sendPasswordResetOtpEmail(String toEmail, String name, String rawOtp) {
        String htmlTemplate = loadTemplate("templates/email/password-reset-otp.html")
                .replace("%NAME%", name != null ? name : "User")
                .replace("%OTP_CODE%", rawOtp);
        String textTemplate = loadTemplate("templates/email/password-reset-otp.txt")
                .replace("%NAME%", name != null ? name : "User")
                .replace("%OTP_CODE%", rawOtp);

        writeMessage("password-reset-otp", toEmail, "TraceX Password Reset Code", textTemplate, htmlTemplate, null, rawOtp);
    }

    private void writeMessage(String type, String toEmail, String subject, String textBody, String htmlBody, String activationUrl, String otpCode) {
        long seq = COUNTER.incrementAndGet();
        String filename = String.format("%d-%05d-%s.txt", System.currentTimeMillis(), seq, type);
        Path filePath = sinkDirectory.resolve(filename);

        StringBuilder sb = new StringBuilder();
        sb.append("Timestamp: ").append(Instant.now()).append("\n");
        sb.append("Type: ").append(type).append("\n");
        sb.append("To: ").append(toEmail).append("\n");
        sb.append("Subject: ").append(subject).append("\n");
        if (activationUrl != null) {
            sb.append("Activation-URL: ").append(activationUrl).append("\n");
        }
        if (otpCode != null) {
            sb.append("OTP: ").append(otpCode).append("\n");
        }
        sb.append("\n--- TEXT BODY ---\n");
        sb.append(textBody).append("\n");
        sb.append("\n--- HTML BODY ---\n");
        sb.append(htmlBody).append("\n");

        try {
            Files.writeString(filePath, sb.toString(), StandardCharsets.UTF_8);
            // Notice: no sensitive token, password or OTP is logged to logger
            log.info("DevMailSink recorded {} message to file: {}", type, filename);
        } catch (IOException e) {
            log.error("Failed to write dev-mail message to {}", filePath, e);
            throw new RuntimeException("Failed to write dev-mail message", e);
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

    public Path getSinkDirectory() {
        return sinkDirectory;
    }

    public void clear() {
        try {
            if (Files.exists(sinkDirectory)) {
                try (var stream = Files.newDirectoryStream(sinkDirectory)) {
                    for (Path entry : stream) {
                        Files.deleteIfExists(entry);
                    }
                }
            }
        } catch (IOException e) {
            log.warn("Failed to clear dev-mail sink directory", e);
        }
    }
}
