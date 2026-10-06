package com.tracex;

import com.icegreen.greenmail.util.GreenMail;
import com.icegreen.greenmail.util.ServerSetupTest;
import com.tracex.service.SmtpEmailService;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
public class SmtpEmailServiceTest {

    private static GreenMail greenMail;

    @BeforeAll
    static void startMailServer() {
        greenMail = new GreenMail(ServerSetupTest.SMTP);
        greenMail.setUser("test@tracex.demo", "secret");
        greenMail.start();
    }

    @AfterAll
    static void stopMailServer() {
        if (greenMail != null) {
            greenMail.stop();
        }
    }

    @DynamicPropertySource
    static void configureMail(DynamicPropertyRegistry registry) {
        registry.add("tracex.mail.sink.enabled", () -> "false");
        registry.add("spring.mail.host", () -> "localhost");
        registry.add("spring.mail.port", () -> ServerSetupTest.SMTP.getPort());
        registry.add("spring.mail.username", () -> "test@tracex.demo");
        registry.add("spring.mail.password", () -> "secret");
        registry.add("spring.mail.properties.mail.smtp.auth", () -> "false");
        registry.add("spring.mail.properties.mail.smtp.starttls.enable", () -> "false");
    }

    @Autowired
    private SmtpEmailService smtpEmailService;

    @Test
    @DisplayName("SmtpEmailService dispatches invite, activation OTP, and password reset OTP via SMTP")
    void testSmtpEmailDispatch() throws Exception {
        smtpEmailService.sendInviteEmail("recipient@example.com", "Test User", "raw_invite_token_123");
        smtpEmailService.sendActivationOtpEmail("recipient@example.com", "Test User", "123456");
        smtpEmailService.sendPasswordResetOtpEmail("recipient@example.com", "Test User", "654321");

        MimeMessage[] receivedMessages = greenMail.getReceivedMessages();
        assertThat(receivedMessages).hasSize(3);

        assertThat(receivedMessages[0].getSubject()).isEqualTo("TraceX Account Invitation");
        assertThat(receivedMessages[1].getSubject()).isEqualTo("TraceX Account Verification Code");
        assertThat(receivedMessages[2].getSubject()).isEqualTo("TraceX Password Reset Code");
    }
}
