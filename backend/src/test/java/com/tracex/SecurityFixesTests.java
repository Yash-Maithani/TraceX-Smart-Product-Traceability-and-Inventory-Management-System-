package com.tracex;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tracex.config.AppConfig;
import com.tracex.dto.*;
import com.tracex.exception.ApiException;
import com.tracex.exception.ErrorCode;
import com.tracex.model.*;
import com.tracex.repository.*;
import com.tracex.security.JwtService;
import com.tracex.security.RateLimiter;
import com.tracex.service.UserService;
import com.tracex.util.HashUtil;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.lang.reflect.Field;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Phase 8.2: one test (or more) per finding C1-C3 and H1-H7 of the strict PBL review.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class SecurityFixesTests {

    private static final String PASSWORD = "TestPass123456!";
    private static final String OTP = "123456";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private AccessRequestRepository accessRequestRepository;
    @Autowired private BatchRepository batchRepository;
    @Autowired private ImportJobRepository importJobRepository;
    @Autowired private AuditLogRepository auditLogRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtService jwtService;
    @Autowired private RateLimiter rateLimiter;
    @Autowired private UserService userService;

    private final List<String> createdUserIds = new ArrayList<>();
    private final List<String> createdRequestIds = new ArrayList<>();
    private final List<String> createdBatchIds = new ArrayList<>();
    private final List<String> createdJobIds = new ArrayList<>();

    private User admin;
    private String adminToken;

    @BeforeEach
    void setUp() {
        rateLimiter.resetAll();
        admin = saveUser("sfadmin", "sfadmin@example.com", Role.ADMIN, false, true);
        adminToken = token(admin);
    }

    @AfterEach
    void tearDown() {
        userRepository.deleteAllById(createdUserIds);
        accessRequestRepository.deleteAllById(createdRequestIds);
        batchRepository.deleteAllById(createdBatchIds);
        importJobRepository.deleteAllById(createdJobIds);
        rateLimiter.resetAll();
    }

    private User saveUser(String username, String email, Role role, boolean superAdmin, boolean active) {
        User u = new User(username, passwordEncoder.encode(PASSWORD), username, email, role, superAdmin);
        u.setActive(active);
        u.setEmailVerified(true);
        u = userRepository.save(u);
        createdUserIds.add(u.getId());
        return u;
    }

    private String token(User u) {
        return jwtService.generateToken(u.getId(), u.getTokenVersion());
    }

    private void giveOtp(User u, String purpose) {
        User fresh = userRepository.findById(u.getId()).orElseThrow();
        fresh.setOtpCode(HashUtil.sha256(OTP));
        fresh.setOtpExpiry(Instant.now().plus(Duration.ofMinutes(10)));
        fresh.setOtpPurpose(purpose);
        userRepository.save(fresh);
    }

    private String json(Object o) throws Exception {
        return objectMapper.writeValueAsString(o);
    }

    // ---------- C1 ----------

    @Test
    @DisplayName("C1: a password-reset OTP cannot reactivate a deactivated account through /verify-otp")
    void resetOtpCannotReactivateDeactivatedUser() throws Exception {
        User victim = saveUser("sfvictim", "sfvictim@example.com", Role.MANAGER, false, false);
        giveOtp(victim, "PASSWORD_RESET");

        mockMvc.perform(post("/api/v1/auth/verify-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(new VerifyOtpDto("sfvictim@example.com", OTP))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(ErrorCode.AUTH_INVALID_TOKEN.name()));

        assertThat(userRepository.findById(victim.getId()).orElseThrow().isActive()).isFalse();
    }

    @Test
    @DisplayName("C1: deactivating a user clears any outstanding OTP and reset token")
    void deactivationClearsOutstandingCodes() throws Exception {
        User target = saveUser("sftarget", "sftarget@example.com", Role.MANAGER, false, true);
        giveOtp(target, "PASSWORD_RESET");

        mockMvc.perform(patch("/api/v1/auth/users/" + target.getId() + "/toggle")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        User after = userRepository.findById(target.getId()).orElseThrow();
        assertThat(after.isActive()).isFalse();
        assertThat(after.getOtpCode()).isNull();
        assertThat(after.getOtpPurpose()).isNull();
        assertThat(after.getResetToken()).isNull();
    }

    @Test
    @DisplayName("C1: an activation OTP is not accepted by /verify-reset-otp")
    void activationOtpRejectedByResetEndpoint() throws Exception {
        User u = saveUser("sfpending", "sfpending@example.com", Role.MANAGER, false, true);
        giveOtp(u, "ACTIVATION");

        mockMvc.perform(post("/api/v1/auth/verify-reset-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(new VerifyResetOtpDto("sfpending@example.com", OTP))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(ErrorCode.AUTH_INVALID_TOKEN.name()));
    }

    // ---------- C2 ----------

    @Test
    @DisplayName("C2: rejecting an approved request revokes its invite, so the emailed link cannot create an account")
    void rejectedInviteCannotActivate() throws Exception {
        String rawToken = "c2-raw-invite-token-0123456789abcdef";
        AccessRequest req = new AccessRequest("Carol Reject", "sfcarol@example.com", Role.MANAGER);
        req.setStatus(AccessRequestStatus.APPROVED);
        req.setInviteToken(HashUtil.sha256(rawToken));
        req.setInviteExpiry(Instant.now().plus(Duration.ofHours(48)));
        req = accessRequestRepository.save(req);
        createdRequestIds.add(req.getId());

        mockMvc.perform(post("/api/v1/auth/requests/" + req.getId() + "/reject")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"note\":\"changed my mind\"}"))
                .andExpect(status().isOk());

        AccessRequest after = accessRequestRepository.findById(req.getId()).orElseThrow();
        assertThat(after.getInviteToken()).isNull();

        mockMvc.perform(post("/api/v1/auth/activate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(new ActivateAccountDto(rawToken, "ValidPass123!"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(ErrorCode.AUTH_INVALID_TOKEN.name()));
        assertThat(userRepository.findByEmailIgnoreCase("sfcarol@example.com")).isEmpty();
    }

    @Test
    @DisplayName("C2: an invite whose request is not APPROVED cannot activate, even with a valid token")
    void nonApprovedRequestCannotActivate() throws Exception {
        String rawToken = "c2-raw-invite-token-pending-987654";
        AccessRequest req = new AccessRequest("Dan Pending", "sfdan@example.com", Role.MANAGER);
        req.setStatus(AccessRequestStatus.REJECTED);
        req.setInviteToken(HashUtil.sha256(rawToken));
        req.setInviteExpiry(Instant.now().plus(Duration.ofHours(48)));
        req = accessRequestRepository.save(req);
        createdRequestIds.add(req.getId());

        mockMvc.perform(post("/api/v1/auth/activate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(new ActivateAccountDto(rawToken, "ValidPass123!"))))
                .andExpect(status().isBadRequest());
        assertThat(userRepository.findByEmailIgnoreCase("sfdan@example.com")).isEmpty();
    }

    // ---------- C3 ----------

    @Test
    @DisplayName("C3: with no active profile the production fail-fast checks run")
    void noProfileRunsProductionChecks() throws Exception {
        MockEnvironment env = new MockEnvironment(); // no active profiles
        AppConfig appConfig = new AppConfig(env);
        Field jwt = AppConfig.class.getDeclaredField("jwtSecret");
        jwt.setAccessible(true);
        jwt.set(appConfig, "");

        assertThatThrownBy(appConfig::validateConfiguration)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("JWT_SECRET");
    }

    @Test
    @DisplayName("C3: JwtService refuses a missing or short secret instead of padding it")
    void jwtServiceRejectsShortSecret() {
        assertThatThrownBy(() -> new JwtService("", java.time.Clock.systemUTC()))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> new JwtService("short", java.time.Clock.systemUTC()))
                .isInstanceOf(IllegalStateException.class);
    }

    // ---------- H1 ----------

    @Test
    @DisplayName("H1: a super-admin whose role string is factory-manager can approve access requests and toggle users")
    void superAdminWithNonAdminRoleCanUseAdminEndpoints() throws Exception {
        User sa = saveUser("sfsuperfm", "sfsuperfm@example.com", Role.FACTORY_MANAGER, true, true);
        String saToken = token(sa);

        AccessRequest req = new AccessRequest("Erin Approve", "sferin@example.com", Role.MANAGER);
        req = accessRequestRepository.save(req);
        createdRequestIds.add(req.getId());

        mockMvc.perform(post("/api/v1/auth/requests/" + req.getId() + "/approve")
                        .header("Authorization", "Bearer " + saToken))
                .andExpect(status().isOk());

        User target = saveUser("sftoggle", "sftoggle@example.com", Role.MANAGER, false, true);
        mockMvc.perform(patch("/api/v1/auth/users/" + target.getId() + "/toggle")
                        .header("Authorization", "Bearer " + saToken))
                .andExpect(status().isOk());
    }

    // ---------- H2 ----------

    @Test
    @DisplayName("H2: request-access answers an existing account's email exactly like a new email")
    void requestAccessDoesNotRevealExistingAccounts() throws Exception {
        String existing = mockMvc.perform(post("/api/v1/auth/request-access")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(new RequestAccessDto("Someone", "sfadmin@example.com", "manager"))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String fresh = mockMvc.perform(post("/api/v1/auth/request-access")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(new RequestAccessDto("Someone New", "sfbrandnew@example.com", "manager"))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        accessRequestRepository.findByEmail("sfbrandnew@example.com").ifPresent(r -> createdRequestIds.add(r.getId()));

        JsonNode a = objectMapper.readTree(existing);
        JsonNode b = objectMapper.readTree(fresh);
        assertThat(a.get("data")).isEqualTo(b.get("data"));
        assertThat(a.get("message")).isEqualTo(b.get("message"));
        assertThat(accessRequestRepository.findByEmail("sfadmin@example.com")).isEmpty();
    }

    // ---------- H3 ----------

    @Test
    @DisplayName("H3: asking for a new reset code does not clear the failed-attempt counter")
    void forgotPasswordDoesNotResetAttempts() throws Exception {
        User u = saveUser("sflocked", "sflocked@example.com", Role.MANAGER, false, true);
        giveOtp(u, "PASSWORD_RESET");
        User locked = userRepository.findById(u.getId()).orElseThrow();
        locked.setOtpAttempts(5);
        locked.setOtpLockedUntil(Instant.now().plus(Duration.ofMinutes(15)));
        userRepository.save(locked);

        mockMvc.perform(post("/api/v1/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(new ForgotPasswordDto("sflocked@example.com"))))
                .andExpect(status().isOk());

        assertThat(userRepository.findById(u.getId()).orElseThrow().getOtpAttempts()).isEqualTo(5);
        mockMvc.perform(post("/api/v1/auth/verify-reset-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(new VerifyResetOtpDto("sflocked@example.com", "000000"))))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("H3: once the lockout window has passed, the correct code works again")
    void lockoutExpires() throws Exception {
        User u = saveUser("sfexpired", "sfexpired@example.com", Role.MANAGER, false, true);
        giveOtp(u, "PASSWORD_RESET");
        User locked = userRepository.findById(u.getId()).orElseThrow();
        locked.setOtpAttempts(5);
        locked.setOtpLockedUntil(Instant.now().minus(Duration.ofMinutes(1)));
        userRepository.save(locked);

        mockMvc.perform(post("/api/v1/auth/verify-reset-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(new VerifyResetOtpDto("sfexpired@example.com", OTP))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.resetToken").isNotEmpty());
    }

    @Test
    @DisplayName("H3: 20 parallel wrong guesses are counted atomically: exactly 5 are compared, the rest are refused")
    void parallelGuessesAreCountedAtomically() throws Exception {
        User u = saveUser("sfparallel", "sfparallel@example.com", Role.MANAGER, false, true);
        giveOtp(u, "PASSWORD_RESET");

        ExecutorService pool = Executors.newFixedThreadPool(20);
        CountDownLatch start = new CountDownLatch(1);
        AtomicInteger wrongCode = new AtomicInteger();
        AtomicInteger lockedOut = new AtomicInteger();
        List<Future<?>> futures = new ArrayList<>();
        for (int i = 0; i < 20; i++) {
            futures.add(pool.submit(() -> {
                start.await();
                try {
                    userService.verifyResetOtp(new VerifyResetOtpDto("sfparallel@example.com", "000000"), "10.0.0.1");
                } catch (ApiException ex) {
                    if (ex.getStatus() == org.springframework.http.HttpStatus.FORBIDDEN) lockedOut.incrementAndGet();
                    else wrongCode.incrementAndGet();
                }
                return null;
            }));
        }
        start.countDown();
        for (Future<?> f : futures) f.get(30, TimeUnit.SECONDS);
        pool.shutdown();

        assertThat(wrongCode.get()).isEqualTo(5);
        assertThat(lockedOut.get()).isEqualTo(15);
        assertThat(userRepository.findById(u.getId()).orElseThrow().getOtpAttempts()).isEqualTo(5);
    }

    // ---------- H4 ----------

    @Test
    @DisplayName("H4: changing the profile email needs the current password; other fields do not")
    void emailChangeNeedsCurrentPassword() throws Exception {
        User u = saveUser("sfprofile", "sfprofile@example.com", Role.MANAGER, false, true);
        String t = token(u);

        mockMvc.perform(patch("/api/v1/auth/me").header("Authorization", "Bearer " + t)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", "attacker@example.com"))))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value(ErrorCode.VALIDATION_ERROR.name()));

        mockMvc.perform(patch("/api/v1/auth/me").header("Authorization", "Bearer " + t)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", "attacker@example.com", "currentPassword", "wrong-password"))))
                .andExpect(status().isUnprocessableEntity());
        assertThat(userRepository.findById(u.getId()).orElseThrow().getEmail()).isEqualTo("sfprofile@example.com");

        mockMvc.perform(patch("/api/v1/auth/me").header("Authorization", "Bearer " + t)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("name", "New Name"))))
                .andExpect(status().isOk());

        mockMvc.perform(patch("/api/v1/auth/me").header("Authorization", "Bearer " + t)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", "sfprofile2@example.com", "currentPassword", PASSWORD))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.email").value("sfprofile2@example.com"));
    }

    @Test
    @DisplayName("H4: an invalid email in PATCH /me is rejected by validation")
    void profileEmailIsValidated() throws Exception {
        User u = saveUser("sfbademail", "sfbademail@example.com", Role.MANAGER, false, true);
        mockMvc.perform(patch("/api/v1/auth/me").header("Authorization", "Bearer " + token(u))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", "not-an-email", "currentPassword", PASSWORD))))
                .andExpect(status().isUnprocessableEntity());
    }

    // ---------- H5 ----------

    @Test
    @DisplayName("H5: a deactivated account with a wrong password gets the generic 401, not 403")
    void loginChecksPasswordBeforeStatus() throws Exception {
        saveUser("sfinactive", "sfinactive@example.com", Role.MANAGER, false, false);

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("username", "sfinactive", "password", "wrong-password"))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(ErrorCode.AUTH_INVALID_TOKEN.name()));

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("username", "sfinactive", "password", PASSWORD))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(ErrorCode.AUTH_ACCOUNT_INACTIVE.name()));
    }

    // ---------- H6 ----------

    private Batch saveBatch(String code, String lifecycle) {
        Batch b = new Batch();
        b.setBatchCode(code);
        b.setSku("SF-SKU");
        b.setProductName("Security Fix Product");
        b.setSourceLotCode("LOT-SF");
        b.setFarmerName("Farmer Private");
        b.setVillage("Old Village");
        b.setQuantityProduced(100);
        b.setUnit("kg");
        b.setPackDate(LocalDate.now().minusDays(2));
        b.setExpiryDate(LocalDate.now().plusDays(20));
        b.setLifecycleState(lifecycle);
        b = batchRepository.save(b);
        createdBatchIds.add(b.getId());
        return b;
    }

    @Test
    @DisplayName("H6: raw material on a dispatched batch cannot be changed")
    void dispatchedBatchRawMaterialIsFrozen() throws Exception {
        Batch b = saveBatch("TX-SF-DISP", "DISPATCHED");
        mockMvc.perform(patch("/api/v1/batches/" + b.getId() + "/raw-material")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("village", "New Village"))))
                .andExpect(status().isConflict());
        assertThat(batchRepository.findById(b.getId()).orElseThrow().getVillage()).isEqualTo("Old Village");
    }

    @Test
    @DisplayName("H6: a corrected expiryDate must be after packDate")
    void expiryMustFollowPackDate() throws Exception {
        Batch b = saveBatch("TX-SF-EXP", "ACTIVE");
        mockMvc.perform(patch("/api/v1/batches/" + b.getId() + "/raw-material")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("expiryDate", LocalDate.now().minusDays(5).toString()))))
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    @DisplayName("H6: a correction records old and new values; farmerName values never reach audit_logs")
    void correctionRecordsBeforeAndAfter() throws Exception {
        Batch b = saveBatch("TX-SF-AUD", "ACTIVE");
        mockMvc.perform(patch("/api/v1/batches/" + b.getId() + "/raw-material")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("village", "New Village", "farmerName", "Farmer Changed"))))
                .andExpect(status().isOk());

        Batch after = batchRepository.findById(b.getId()).orElseThrow();
        String lastNote = after.getNoteHistory().get(after.getNoteHistory().size() - 1).getNote();
        assertThat(lastNote).contains("village: Old Village -> New Village");

        AuditLog log = auditLogRepository.findByTargetIdOrderByCreatedAtDesc(b.getId()).stream()
                .filter(l -> "BATCH_RAW_MATERIAL_UPDATED".equals(l.getAction()))
                .findFirst().orElseThrow();
        assertThat(log.getBefore()).containsEntry("village", "Old Village");
        assertThat(log.getAfter()).containsEntry("village", "New Village");
        assertThat(String.valueOf(log.getBefore()) + log.getAfter() + log.getSummary())
                .doesNotContain("Farmer Private").doesNotContain("Farmer Changed");
        auditLogRepository.deleteAll(auditLogRepository.findByTargetIdOrderByCreatedAtDesc(b.getId()));
    }

    // ---------- H7 ----------

    @Test
    @DisplayName("H7: only the importer who ran a job, or an admin, can roll it back")
    void rollbackRequiresOwnerOrAdmin() throws Exception {
        User owner = saveUser("sfowner", "sfowner@example.com", Role.FACTORY_MANAGER, false, true);
        User other = saveUser("sfother", "sfother@example.com", Role.MANAGER, false, true);

        ImportJob job = new ImportJob();
        job.setEntity("batch");
        job.setFileName("sf.csv");
        job.setStatus("done");
        job.setCreatedBy(owner.getUsername());
        job.setCreatedByRole("factory-manager");
        job.setInsertedBatchIds(new ArrayList<>());
        job.setCreatedAt(Instant.now());
        job.setUpdatedAt(Instant.now());
        job = importJobRepository.save(job);
        createdJobIds.add(job.getId());

        mockMvc.perform(post("/api/v1/import/" + job.getId() + "/rollback")
                        .header("Authorization", "Bearer " + token(other)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(ErrorCode.RBAC_INSUFFICIENT.name()));

        // Owner and admin pass the ownership check (the job inserted nothing, so the next guard answers 409)
        mockMvc.perform(post("/api/v1/import/" + job.getId() + "/rollback")
                        .header("Authorization", "Bearer " + token(owner)))
                .andExpect(status().isConflict());
        mockMvc.perform(post("/api/v1/import/" + job.getId() + "/rollback")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isConflict());
    }
}
