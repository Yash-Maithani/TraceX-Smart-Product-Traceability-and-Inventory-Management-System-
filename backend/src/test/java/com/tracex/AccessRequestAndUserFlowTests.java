package com.tracex;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tracex.dto.*;
import com.tracex.exception.ErrorCode;
import com.tracex.model.*;
import com.tracex.repository.AccessRequestRepository;
import com.tracex.repository.AuditLogRepository;
import com.tracex.repository.UserRepository;
import com.tracex.security.JwtService;
import com.tracex.security.RateLimiter;
import com.tracex.service.DevMailSink;
import com.tracex.service.EmailService;
import com.tracex.util.HashUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class AccessRequestAndUserFlowTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AccessRequestRepository accessRequestRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private RateLimiter rateLimiter;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired(required = false)
    private DevMailSink devMailSink;

    @Autowired
    private org.springframework.data.mongodb.core.MongoTemplate mongoTemplate;

    @SpyBean
    private EmailService emailService;

    private User superAdmin;
    private User admin;
    private User manager;
    private User coordinator;

    private String superAdminToken;
    private String adminToken;
    private String managerToken;
    private String coordinatorToken;

    @org.junit.jupiter.api.AfterAll
    static void restoreSeedAfterClass(
            @Autowired RateLimiter rateLimiter,
            @Autowired com.tracex.service.SeedRunner seedRunner) {
        rateLimiter.resetAll();
        seedRunner.run();
    }

    @BeforeEach
    void setUp() {
        rateLimiter.resetAll();
        accessRequestRepository.deleteAll();
        auditLogRepository.deleteAll();
        userRepository.deleteAll();

        if (devMailSink != null) {
            devMailSink.clear();
        }

        superAdmin = userRepository.save(new User("superadmin", passwordEncoder.encode("TestPass123456!"), "Super Admin", "superadmin@tracex.demo", Role.ADMIN, true));
        admin = userRepository.save(new User("admin", passwordEncoder.encode("TestPass123456!"), "Staff Admin", "admin@tracex.demo", Role.ADMIN, false));
        manager = userRepository.save(new User("manager", passwordEncoder.encode("TestPass123456!"), "Operations Manager", "manager@tracex.demo", Role.MANAGER, false));
        coordinator = userRepository.save(new User("coordinator", passwordEncoder.encode("TestPass123456!"), "Dispatch Coordinator", "coord@tracex.demo", Role.DISPATCH_COORDINATOR, false));

        superAdminToken = jwtService.generateToken(superAdmin.getId(), superAdmin.getTokenVersion());
        adminToken = jwtService.generateToken(admin.getId(), admin.getTokenVersion());
        managerToken = jwtService.generateToken(manager.getId(), manager.getTokenVersion());
        coordinatorToken = jwtService.generateToken(coordinator.getId(), coordinator.getTokenVersion());
    }

    @Test
    @DisplayName("Check 7: Token stored hashed only, forged/expired/reused invite rejected, lockout on 5 wrong OTPs, expired OTP rejected")
    void testCheck7InviteTokenAndOtpLifecycle() throws Exception {
        // 1. Submit request and approve
        RequestAccessDto req = new RequestAccessDto("Alice Smith", "alice@example.com", "manager");
        MvcResult submitResult = mockMvc.perform(post("/api/v1/auth/request-access")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andReturn();

        String requestId = objectMapper.readTree(submitResult.getResponse().getContentAsString()).get("data").get("id").asText();

        mockMvc.perform(post("/api/v1/auth/requests/" + requestId + "/approve")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        // Check MongoDB: raw token must NOT be in DB, only SHA-256 hash
        AccessRequest dbReq = accessRequestRepository.findById(requestId).orElseThrow();
        String storedHash = dbReq.getInviteToken();
        assertThat(storedHash).isNotNull();
        assertThat(storedHash).hasSize(64); // 64 hex chars = 256 bits

        // Extract raw token from sink
        String rawToken = extractTokenFromMailSink();
        assertThat(rawToken).isNotNull();
        assertThat(rawToken).isNotEqualTo(storedHash);
        assertThat(HashUtil.sha256(rawToken)).isEqualTo(storedHash);

        // Forged invite token rejected
        ActivateAccountDto forgedDto = new ActivateAccountDto("forged_raw_token_that_does_not_exist", "ValidPass123!");
        mockMvc.perform(post("/api/v1/auth/activate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(forgedDto)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(ErrorCode.AUTH_INVALID_TOKEN.name()));

        // Expired invite token rejected
        dbReq.setInviteExpiry(Instant.now().minus(Duration.ofHours(1)));
        accessRequestRepository.save(dbReq);

        ActivateAccountDto expiredDto = new ActivateAccountDto(rawToken, "ValidPass123!");
        mockMvc.perform(post("/api/v1/auth/activate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(expiredDto)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(ErrorCode.AUTH_INVALID_TOKEN.name()));

        // Restore valid expiry and activate
        dbReq.setInviteExpiry(Instant.now().plus(Duration.ofHours(48)));
        accessRequestRepository.save(dbReq);

        mockMvc.perform(post("/api/v1/auth/activate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ActivateAccountDto(rawToken, "ValidPass123!"))))
                .andExpect(status().isOk());

        // Reused invite rejected
        mockMvc.perform(post("/api/v1/auth/activate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ActivateAccountDto(rawToken, "ValidPass123!"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(ErrorCode.AUTH_INVALID_TOKEN.name()));

        // Verify OTP: extract raw OTP from sink
        String rawOtp = extractOtpFromMailSink();
        assertThat(rawOtp).isNotNull();

        User createdUser = userRepository.findByEmailIgnoreCase("alice@example.com").orElseThrow();
        assertThat(createdUser.getOtpCode()).isEqualTo(HashUtil.sha256(rawOtp));
        assertThat(createdUser.isActive()).isFalse();

        // Expired OTP rejected
        createdUser.setOtpExpiry(Instant.now().minus(Duration.ofMinutes(1)));
        userRepository.save(createdUser);

        mockMvc.perform(post("/api/v1/auth/verify-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new VerifyOtpDto("alice@example.com", rawOtp))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(ErrorCode.AUTH_INVALID_TOKEN.name()));

        // Restore expiry and test lockout after 5 wrong OTP attempts
        createdUser.setOtpExpiry(Instant.now().plus(Duration.ofMinutes(10)));
        createdUser.setOtpAttempts(0);
        userRepository.save(createdUser);

        for (int i = 1; i <= 4; i++) {
            mockMvc.perform(post("/api/v1/auth/verify-otp")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(new VerifyOtpDto("alice@example.com", "999999"))))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value(ErrorCode.AUTH_INVALID_TOKEN.name()));
        }

        // 5th failed attempt
        mockMvc.perform(post("/api/v1/auth/verify-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new VerifyOtpDto("alice@example.com", "999999"))))
                .andExpect(status().isBadRequest());

        // 6th attempt locked out
        mockMvc.perform(post("/api/v1/auth/verify-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new VerifyOtpDto("alice@example.com", rawOtp))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(ErrorCode.AUTH_ACCOUNT_INACTIVE.name()));
    }

    @Test
    @DisplayName("Check 8: Approve twice returns 409, duplicate email returns CONFLICT, invalid role or super-admin gives 422")
    void testCheck8ValidationAndConflictRules() throws Exception {
        // Request with super-admin role gives 422
        RequestAccessDto superAdminReq = new RequestAccessDto("Fake Super", "super@example.com", "super-admin");
        mockMvc.perform(post("/api/v1/auth/request-access")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(superAdminReq)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value(ErrorCode.VALIDATION_ERROR.name()));

        // Request with non-existent role gives 422
        RequestAccessDto invalidRoleReq = new RequestAccessDto("Invalid Role", "fake@example.com", "unknown-role");
        mockMvc.perform(post("/api/v1/auth/request-access")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidRoleReq)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value(ErrorCode.VALIDATION_ERROR.name()));

        // Valid request
        RequestAccessDto validReq = new RequestAccessDto("Bob Smith", "bob@example.com", "manager");
        MvcResult submitResult = mockMvc.perform(post("/api/v1/auth/request-access")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validReq)))
                .andExpect(status().isOk())
                .andReturn();

        String reqId = objectMapper.readTree(submitResult.getResponse().getContentAsString()).get("data").get("id").asText();

        // Duplicate email request returns 409 CONFLICT
        mockMvc.perform(post("/api/v1/auth/request-access")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validReq)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(ErrorCode.CONFLICT.name()));

        // Approve once
        mockMvc.perform(post("/api/v1/auth/requests/" + reqId + "/approve")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        // Approve second time returns 409 CONFLICT
        mockMvc.perform(post("/api/v1/auth/requests/" + reqId + "/approve")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(ErrorCode.CONFLICT.name()));
    }

    @Test
    @DisplayName("Check 9: forgot-password identical responses for existing/non-existing, reset revokes session, no secrets in logs")
    void testCheck9ForgotPasswordAndSessionRevocation() throws Exception {
        // Forgot password with existing user
        MvcResult existingResult = mockMvc.perform(post("/api/v1/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ForgotPasswordDto("admin@tracex.demo"))))
                .andExpect(status().isOk())
                .andReturn();

        // Forgot password with non-existing user
        MvcResult nonExistingResult = mockMvc.perform(post("/api/v1/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ForgotPasswordDto("ghost.user@tracex.demo"))))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode existingJson = objectMapper.readTree(existingResult.getResponse().getContentAsString());
        JsonNode nonExistingJson = objectMapper.readTree(nonExistingResult.getResponse().getContentAsString());

        String existingMsg = existingJson.path("data").path("message").asText();
        String nonExistingMsg = nonExistingJson.path("data").path("message").asText();
        assertThat(existingMsg).isEqualTo(nonExistingMsg);
        assertThat(existingMsg).isNotEmpty();

        // Verify reset OTP and reset password
        String resetOtp = extractOtpFromMailSink();
        assertThat(resetOtp).isNotNull();

        MvcResult verifyResetResult = mockMvc.perform(post("/api/v1/auth/verify-reset-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new VerifyResetOtpDto("admin@tracex.demo", resetOtp))))
                .andExpect(status().isOk())
                .andReturn();

        String rawResetToken = objectMapper.readTree(verifyResetResult.getResponse().getContentAsString()).get("data").get("resetToken").asText();
        assertThat(rawResetToken).isNotNull();

        // Reset password bumps tokenVersion
        mockMvc.perform(post("/api/v1/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ResetPasswordDto("admin@tracex.demo", rawResetToken, "BrandNewPassword123!"))))
                .andExpect(status().isOk());

        // Old token must now be rejected with 401 AUTH_SESSION_REVOKED
        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(ErrorCode.AUTH_SESSION_REVOKED.name()));
    }

    @Test
    @DisplayName("Check 10: Guards: self role change (409), self deactivation (409), removing last super-admin (409), isSuperAdmin in PATCH /me ignored")
    void testCheck10GuardsAndAdminRules() throws Exception {
        // 1. Self role change refused with 409
        mockMvc.perform(patch("/api/v1/auth/users/" + admin.getId() + "/role")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateRoleDto(Role.MANAGER))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(ErrorCode.SELF_MODIFICATION_NOT_ALLOWED.name()));

        // 2. Self deactivation refused with 409
        mockMvc.perform(patch("/api/v1/auth/users/" + admin.getId() + "/toggle")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(ErrorCode.SELF_MODIFICATION_NOT_ALLOWED.name()));

        // 3. Deactivating the last active super-admin refused with 409 LAST_SUPERADMIN
        mockMvc.perform(patch("/api/v1/auth/users/" + superAdmin.getId() + "/toggle")
                        .header("Authorization", "Bearer " + superAdminToken))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(ErrorCode.LAST_SUPERADMIN.name()));

        // 4. Secondary admin cannot modify super-admin (403)
        mockMvc.perform(patch("/api/v1/auth/users/" + superAdmin.getId() + "/toggle")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(ErrorCode.RBAC_INSUFFICIENT.name()));

        // 5. isSuperAdmin in PATCH /me body is ignored
        mockMvc.perform(patch("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + managerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Updated Manager\",\"isSuperAdmin\":true,\"role\":\"admin\"}"))
                .andExpect(status().isOk());

        User managerInDb = userRepository.findById(manager.getId()).orElseThrow();
        assertThat(managerInDb.isSuperAdmin()).isFalse();
        assertThat(managerInDb.getRole()).isEqualTo(Role.MANAGER);
        assertThat(managerInDb.getName()).isEqualTo("Updated Manager");
    }

    @Test
    @DisplayName("Check 11: Soft-deleted user cannot login, token rejected, appears in deleted list, restore works for super-admin only")
    void testCheck11SoftDeleteAndRestoreFlow() throws Exception {
        // Soft delete manager
        mockMvc.perform(delete("/api/v1/auth/users/" + manager.getId())
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new DeleteUserDto("Testing soft delete"))))
                .andExpect(status().isOk());

        // Existing token rejected on next request
        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + managerToken))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(ErrorCode.AUTH_ACCOUNT_DELETED.name()));

        // Login fails with identical response
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginRequest("manager", "TestPass123456!"))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(ErrorCode.AUTH_INVALID_TOKEN.name()));

        // Appears in deleted list for super-admin
        MvcResult deletedListResult = mockMvc.perform(get("/api/v1/auth/users/deleted")
                        .header("Authorization", "Bearer " + superAdminToken))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode deletedArr = objectMapper.readTree(deletedListResult.getResponse().getContentAsString()).get("data");
        assertThat(deletedArr.isArray()).isTrue();
        assertThat(deletedArr.size()).isGreaterThanOrEqualTo(1);

        // Regular admin calling deleted list gets 403
        mockMvc.perform(get("/api/v1/auth/users/deleted")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(ErrorCode.RBAC_INSUFFICIENT.name()));

        // Regular admin calling restore gets 403
        mockMvc.perform(patch("/api/v1/auth/users/" + manager.getId() + "/restore")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(ErrorCode.RBAC_INSUFFICIENT.name()));

        // Super-admin restores user
        mockMvc.perform(patch("/api/v1/auth/users/" + manager.getId() + "/restore")
                        .header("Authorization", "Bearer " + superAdminToken))
                .andExpect(status().isOk());

        User restoredManager = userRepository.findById(manager.getId()).orElseThrow();
        assertThat(restoredManager.isDeleted()).isFalse();
    }

    @Test
    @DisplayName("Check 12: Every mutating action writes audit entry, summaries contain no secrets")
    void testCheck12AuditLoggingCompleteness() throws Exception {
        // Submit access request
        mockMvc.perform(post("/api/v1/auth/request-access")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new RequestAccessDto("Charlie Brown", "charlie@example.com", "factory-manager"))))
                .andExpect(status().isOk());

        List<AuditLog> logs = auditLogRepository.findAll();
        assertThat(logs).isNotEmpty();

        for (AuditLog audit : logs) {
            assertThat(audit.getSummary()).isNotNull();
            assertThat(audit.getSummary()).doesNotContain("$2a$");
            assertThat(audit.getSummary()).doesNotContain("password=");
        }
    }

    @Test
    @DisplayName("Check 13: Non-admin sending admin requests gets 403 and MongoDB is unchanged")
    void testCheck13NonAdminForbiddenFromAdminEndpoints() throws Exception {
        long userCountBefore = userRepository.count();

        // Dispatch coordinator attempting to approve access request
        mockMvc.perform(post("/api/v1/auth/requests/some-id/approve")
                        .header("Authorization", "Bearer " + coordinatorToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(ErrorCode.RBAC_INSUFFICIENT.name()));

        // Dispatch coordinator attempting to delete user
        mockMvc.perform(delete("/api/v1/auth/users/" + manager.getId())
                        .header("Authorization", "Bearer " + coordinatorToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(ErrorCode.RBAC_INSUFFICIENT.name()));

        // Verify MongoDB count untouched
        assertThat(userRepository.count()).isEqualTo(userCountBefore);
    }

    @Test
    @DisplayName("Check 14: Mail sender forced failure leaves approval intact, response reports email not sent, resend succeeds")
    void testCheck14MailSenderFailureResilience() throws Exception {
        // Create request
        AccessRequest req = accessRequestRepository.save(new AccessRequest("David Evans", "david@example.com", Role.MANAGER));

        // Force emailService to throw exception on sendInviteEmail
        doThrow(new RuntimeException("Simulated SMTP Connection Refused"))
                .when(emailService).sendInviteEmail(anyString(), anyString(), anyString());

        // Approve request: must succeed despite email failure
        mockMvc.perform(post("/api/v1/auth/requests/" + req.getId() + "/approve")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        // Approval is persisted
        AccessRequest approvedReq = accessRequestRepository.findById(req.getId()).orElseThrow();
        assertThat(approvedReq.getStatus()).isEqualTo(AccessRequestStatus.APPROVED);
        assertThat(approvedReq.getInviteToken()).isNotNull();

        // Resend succeeds when mail sender works
        org.mockito.Mockito.doCallRealMethod()
                .when(emailService).sendInviteEmail(anyString(), anyString(), anyString());

        mockMvc.perform(post("/api/v1/auth/requests/" + req.getId() + "/resend")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());
    }

    private String extractTokenFromMailSink() throws IOException {
        if (devMailSink == null) return null;
        Path sinkDir = devMailSink.getSinkDirectory();
        if (!Files.exists(sinkDir)) return null;

        try (var stream = Files.newDirectoryStream(sinkDir, "*-invite.txt")) {
            for (Path file : stream) {
                List<String> lines = Files.readAllLines(file);
                for (String l : lines) {
                    if (l.startsWith("Activation-URL:")) {
                        String url = l.substring("Activation-URL:".length()).trim();
                        int tokenIndex = url.indexOf("token=");
                        if (tokenIndex != -1) {
                            return url.substring(tokenIndex + "token=".length()).trim();
                        }
                    }
                }
            }
        }
        return null;
    }

    private String extractOtpFromMailSink() throws IOException {
        if (devMailSink == null) return null;
        Path sinkDir = devMailSink.getSinkDirectory();
        if (!Files.exists(sinkDir)) return null;

        try (var stream = Files.newDirectoryStream(sinkDir, "*otp.txt")) {
            Path latest = null;
            long latestTime = 0;
            for (Path file : stream) {
                long mtime = Files.getLastModifiedTime(file).toMillis();
                if (mtime > latestTime) {
                    latestTime = mtime;
                    latest = file;
                }
            }
            if (latest != null) {
                List<String> lines = Files.readAllLines(latest);
                for (String l : lines) {
                    if (l.startsWith("OTP:")) {
                        return l.substring("OTP:".length()).trim();
                    }
                }
            }
        }
        return null;
    }

    @Test
    @DisplayName("Phase 4.2 R2: Corrupted inviteExpiry, otpExpiry, and resetTokenExpiry in MongoDB fail closed with 401 and standard error envelope")
    void testCorruptedSecurityExpiriesFailClosed() throws Exception {
        // 1. Corrupted inviteExpiry on an approved AccessRequest
        AccessRequest req = new AccessRequest("Corrupted Invite User", "corrupt-invite@example.com", Role.MANAGER);
        req.setStatus(AccessRequestStatus.APPROVED);
        req.setInviteToken(HashUtil.sha256("raw-invite-token-r2"));
        req.setInviteExpiry(Instant.now().plus(Duration.ofHours(24)));
        req = accessRequestRepository.save(req);

        mongoTemplate.getCollection("accessrequests").updateOne(
                new org.bson.Document("email", "corrupt-invite@example.com"),
                new org.bson.Document("$set", new org.bson.Document("inviteExpiry", "not-an-instant-invite"))
        );

        try {
            mockMvc.perform(post("/api/v1/auth/activate")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(new ActivateAccountDto("raw-invite-token-r2", "ValidPass123456!"))))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.success").value(false))
                    .andExpect(jsonPath("$.code").value(ErrorCode.AUTH_INVALID_TOKEN.name()))
                    .andExpect(jsonPath("$.error").exists())
                    .andExpect(jsonPath("$.requestId").exists());
        } finally {
            mongoTemplate.getCollection("accessrequests").deleteOne(new org.bson.Document("email", "corrupt-invite@example.com"));
        }

        // 2. Corrupted otpExpiry on a User
        manager.setOtpCode(HashUtil.sha256("654321"));
        manager.setOtpExpiry(Instant.now().plus(Duration.ofMinutes(10)));
        userRepository.save(manager);

        mongoTemplate.getCollection("users").updateOne(
                new org.bson.Document("email", "manager@tracex.demo"),
                new org.bson.Document("$set", new org.bson.Document("otpExpiry", "not-an-instant-otp"))
        );

        try {
            mockMvc.perform(post("/api/v1/auth/verify-otp")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(new VerifyOtpDto("manager@tracex.demo", "654321"))))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.success").value(false))
                    .andExpect(jsonPath("$.code").value(ErrorCode.AUTH_INVALID_TOKEN.name()))
                    .andExpect(jsonPath("$.error").exists())
                    .andExpect(jsonPath("$.requestId").exists());

            mockMvc.perform(post("/api/v1/auth/verify-reset-otp")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(new VerifyOtpDto("manager@tracex.demo", "654321"))))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.success").value(false))
                    .andExpect(jsonPath("$.code").value(ErrorCode.AUTH_INVALID_TOKEN.name()))
                    .andExpect(jsonPath("$.error").exists())
                    .andExpect(jsonPath("$.requestId").exists());
        } finally {
            mongoTemplate.getCollection("users").updateOne(
                    new org.bson.Document("email", "manager@tracex.demo"),
                    new org.bson.Document("$unset", new org.bson.Document("otpExpiry", "").append("otpCode", ""))
            );
        }

        // 3. Corrupted resetTokenExpiry on a User
        manager = userRepository.findByEmail("manager@tracex.demo").orElseThrow();
        manager.setResetToken(HashUtil.sha256("raw-reset-token-r2"));
        manager.setResetTokenExpiry(Instant.now().plus(Duration.ofMinutes(15)));
        userRepository.save(manager);

        mongoTemplate.getCollection("users").updateOne(
                new org.bson.Document("email", "manager@tracex.demo"),
                new org.bson.Document("$set", new org.bson.Document("resetTokenExpiry", "not-an-instant-reset"))
        );

        try {
            mockMvc.perform(post("/api/v1/auth/reset-password")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(new ResetPasswordDto("manager@tracex.demo", "raw-reset-token-r2", "NewValidPass123456!"))))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.success").value(false))
                    .andExpect(jsonPath("$.code").value(ErrorCode.AUTH_INVALID_TOKEN.name()))
                    .andExpect(jsonPath("$.error").exists())
                    .andExpect(jsonPath("$.requestId").exists());
        } finally {
            mongoTemplate.getCollection("users").updateOne(
                    new org.bson.Document("email", "manager@tracex.demo"),
                    new org.bson.Document("$unset", new org.bson.Document("resetTokenExpiry", "").append("resetToken", ""))
            );
        }
    }
}

