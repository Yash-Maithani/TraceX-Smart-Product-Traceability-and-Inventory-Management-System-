package com.tracex;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tracex.dto.ActivateAccountDto;
import com.tracex.exception.ErrorCode;
import com.tracex.model.*;
import com.tracex.repository.*;
import com.tracex.security.GlobalRateLimitFilter;
import com.tracex.security.JwtService;
import com.tracex.security.RateLimiter;
import com.tracex.service.AuditService;
import com.tracex.service.TraceTokenService;
import com.tracex.util.HashUtil;
import com.tracex.util.MutableClock;
import com.tracex.util.RequestIdContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Phase 13: one test (or more) per hardening item M1 to M14 of OI-12 that changed code.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class HardeningTests {

    private static final String PASSWORD = "TestPass123456!";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private AccessRequestRepository accessRequestRepository;
    @Autowired private BatchRepository batchRepository;
    @Autowired private ImportJobRepository importJobRepository;
    @Autowired private AuditLogRepository auditLogRepository;
    @Autowired private ScanEventRepository scanEventRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtService jwtService;
    @Autowired private RateLimiter rateLimiter;
    @Autowired private AuditService auditService;
    @Autowired private TraceTokenService traceTokenService;

    private final List<String> createdUserIds = new ArrayList<>();
    private final List<String> createdRequestIds = new ArrayList<>();
    private final List<String> createdBatchIds = new ArrayList<>();
    private final List<String> createdJobIds = new ArrayList<>();
    private final List<String> createdAuditIds = new ArrayList<>();

    private User admin;
    private String adminToken;
    private User manager;
    private String managerToken;

    @BeforeEach
    void setUp() {
        rateLimiter.resetAll();
        admin = saveUser("hdadmin", "hdadmin@example.com", Role.ADMIN);
        adminToken = token(admin);
        manager = saveUser("hdmanager", "hdmanager@example.com", Role.MANAGER);
        managerToken = token(manager);
    }

    @AfterEach
    void tearDown() {
        for (String batchId : createdBatchIds) {
            scanEventRepository.deleteAll(scanEventRepository.findByBatchId(batchId));
        }
        userRepository.deleteAllById(createdUserIds);
        accessRequestRepository.deleteAllById(createdRequestIds);
        batchRepository.deleteAllById(createdBatchIds);
        importJobRepository.deleteAllById(createdJobIds);
        auditLogRepository.deleteAllById(createdAuditIds);
        rateLimiter.resetAll();
        RequestIdContext.clear();
    }

    private User saveUser(String username, String email, Role role) {
        User u = new User(username, passwordEncoder.encode(PASSWORD), username, email, role, false);
        u.setActive(true);
        u.setEmailVerified(true);
        u = userRepository.save(u);
        createdUserIds.add(u.getId());
        return u;
    }

    private String token(User u) {
        return jwtService.generateToken(u.getId(), u.getTokenVersion());
    }

    private Batch saveBatch(String code, boolean archived) {
        Batch b = new Batch();
        b.setBatchCode(code);
        b.setSku("HD-SKU");
        b.setProductName("Hardening Product");
        b.setSourceLotCode("LOT-HD");
        b.setFarmerName("Farmer Private");
        b.setVillage("Village");
        b.setQuantityProduced(100);
        b.setUnit("kg");
        b.setPackDate(LocalDate.now().minusDays(2));
        b.setExpiryDate(LocalDate.now().plusDays(20));
        b.setLifecycleState("ACTIVE");
        b.setDeleted(archived);
        b.setTraceToken(traceTokenService.generateToken());
        b = batchRepository.save(b);
        createdBatchIds.add(b.getId());
        return b;
    }

    // ---------- M2 ----------

    private String approvedInvite(String name, String email) {
        String rawToken = HashUtil.generateRandomHexToken(32);
        AccessRequest req = new AccessRequest(name, email, Role.MANAGER);
        req.setStatus(AccessRequestStatus.APPROVED);
        req.setInviteToken(HashUtil.sha256(rawToken));
        req.setInviteExpiry(Instant.now().plus(Duration.ofDays(1)));
        req = accessRequestRepository.save(req);
        createdRequestIds.add(req.getId());
        return rawToken;
    }

    private void trackUserByEmail(String email) {
        userRepository.findByEmailIgnoreCase(email).ifPresent(u -> createdUserIds.add(u.getId()));
    }

    @Test
    @DisplayName("M2: an invitation link creates one account; a second activation with it is refused")
    void inviteCanOnlyBeUsedOnce() throws Exception {
        String rawToken = approvedInvite("Hana Once", "hdonce@example.com");
        String body = objectMapper.writeValueAsString(new ActivateAccountDto(rawToken, PASSWORD));

        mockMvc.perform(post("/api/v1/auth/activate").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk());
        trackUserByEmail("hdonce@example.com");

        mockMvc.perform(post("/api/v1/auth/activate").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(ErrorCode.AUTH_INVALID_TOKEN.name()));
        assertThat(userRepository.findAll().stream().filter(u -> "hdonce@example.com".equalsIgnoreCase(u.getEmail()))).hasSize(1);
    }

    @Test
    @DisplayName("M2: an invitation for an email that already has an account is refused and stays unused")
    void inviteForExistingEmailIsRefused() throws Exception {
        String rawToken = approvedInvite("Manager Again", "HDMANAGER@example.com");

        mockMvc.perform(post("/api/v1/auth/activate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ActivateAccountDto(rawToken, PASSWORD))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(ErrorCode.CONFLICT.name()));

        AccessRequest req = accessRequestRepository.findByInviteToken(HashUtil.sha256(rawToken)).orElseThrow();
        assertThat(req.isInviteUsed()).isFalse();
    }

    @Test
    @DisplayName("M2: a second chunk of an import sent while the first is still being saved gets 409")
    void importChunkIsLocked() throws Exception {
        ImportJob job = new ImportJob();
        job.setStatus("running");
        job.setTotalRows(2);
        job.setCreatedBy(admin.getUsername());
        job.setCreatedByRole("admin");
        job.setCreatedAt(Instant.now());
        job.setUpdatedAt(Instant.now());
        job.setChunkLockedAt(Instant.now());
        job = importJobRepository.save(job);
        createdJobIds.add(job.getId());

        Map<String, Object> body = Map.of(
                "jobId", job.getId(),
                "rows", List.of(Map.of("sku", "NO-SUCH-SKU")),
                "isFinal", false);
        mockMvc.perform(post("/api/v1/import/commit")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(ErrorCode.CONFLICT.name()));

        // A lock older than the timeout belongs to a request that died, so the chunk goes through
        ImportJob stale = importJobRepository.findById(job.getId()).orElseThrow();
        stale.setChunkLockedAt(Instant.now().minus(Duration.ofMinutes(5)));
        importJobRepository.save(stale);
        mockMvc.perform(post("/api/v1/import/commit")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk());
        assertThat(importJobRepository.findById(job.getId()).orElseThrow().getChunkLockedAt()).isNull();
    }

    // ---------- M3 ----------

    @Test
    @DisplayName("M3: page and limit outside their range, or not numbers, return 422 instead of 500")
    void badPagingParametersAreValidationErrors() throws Exception {
        for (String query : List.of("limit=0", "limit=501", "page=0", "page=abc", "limit=ten")) {
            mockMvc.perform(get("/api/v1/batches?" + query).header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.code").value(ErrorCode.VALIDATION_ERROR.name()));
        }
        mockMvc.perform(get("/api/v1/batches?limit=500").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());
    }

    // ---------- M5 ----------

    @Test
    @DisplayName("M5: the global limit answers 429 with Retry-After once an address passes it")
    void globalRateLimitFilterBlocksAfterLimit() throws Exception {
        GlobalRateLimitFilter filter = new GlobalRateLimitFilter(new RateLimiter(Clock.systemUTC()), objectMapper, 2);
        for (int i = 0; i < 2; i++) {
            MockHttpServletResponse ok = new MockHttpServletResponse();
            filter.doFilter(apiRequest("/api/v1/batches"), ok, new MockFilterChain());
            assertThat(ok.getStatus()).isEqualTo(200);
        }
        MockHttpServletResponse blocked = new MockHttpServletResponse();
        filter.doFilter(apiRequest("/api/v1/batches"), blocked, new MockFilterChain());
        assertThat(blocked.getStatus()).isEqualTo(429);
        assertThat(blocked.getHeader("Retry-After")).isEqualTo("900");
        assertThat(blocked.getContentAsString()).contains(ErrorCode.RATE_LIMITED.name());

        // Pages outside /api/ are never counted
        MockHttpServletResponse page = new MockHttpServletResponse();
        filter.doFilter(apiRequest("/index.html"), page, new MockFilterChain());
        assertThat(page.getStatus()).isEqualTo(200);
    }

    private MockHttpServletRequest apiRequest(String uri) {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", uri);
        req.setRemoteAddr("203.0.113.7");
        return req;
    }

    @Test
    @DisplayName("M5: rate-limit buckets idle for more than an hour are dropped")
    void idleRateLimitBucketsAreSwept() {
        MutableClock clock = new MutableClock(ZoneId.of("UTC"));
        Instant start = Instant.parse("2026-10-01T10:00:00Z");
        clock.setDelegate(Clock.fixed(start, ZoneOffset.UTC));
        RateLimiter limiter = new RateLimiter(clock);
        limiter.allowRequest("ip:a", 10, Duration.ofMinutes(15));
        limiter.allowRequest("ip:b", 10, Duration.ofMinutes(15));
        assertThat(limiter.trackedKeyCount()).isEqualTo(2);

        clock.setDelegate(Clock.fixed(start.plus(Duration.ofMinutes(61)), ZoneOffset.UTC));
        limiter.allowRequest("ip:c", 10, Duration.ofMinutes(15));
        limiter.sweepNow();
        assertThat(limiter.trackedKeyCount()).isEqualTo(1);
    }

    // ---------- M6 ----------

    @Test
    @DisplayName("M6: an archived batch is 404 by id for non-admins and still readable by an admin")
    void archivedBatchIsAdminOnlyById() throws Exception {
        Batch archived = saveBatch("TX-HD-ARCH", true);
        mockMvc.perform(get("/api/v1/batches/" + archived.getId()).header("Authorization", "Bearer " + managerToken))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/batches/" + archived.getId()).header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        Batch active = saveBatch("TX-HD-LIVE", false);
        mockMvc.perform(get("/api/v1/batches/" + active.getId()).header("Authorization", "Bearer " + managerToken))
                .andExpect(status().isOk());
    }

    // ---------- M8 ----------

    @Test
    @DisplayName("M8: an audit entry recorded with only a username stores that user's id")
    void auditResolvesActorIdFromUsername() {
        AuditLog log = auditService.record(null, manager.getUsername(), "HD_TEST", "BATCH", "x", "hardening test");
        createdAuditIds.add(log.getId());
        assertThat(log.getActorId()).isEqualTo(manager.getId());
        assertThat(log.getCreatedAt()).isNotNull();

        AuditLog unknown = auditService.record(null, "no-such-user-hd", "HD_TEST", "BATCH", "x", "hardening test");
        createdAuditIds.add(unknown.getId());
        assertThat(unknown.getActorId()).isEqualTo("anonymous");
    }

    // ---------- M9 ----------

    @Test
    @DisplayName("M9: keyed hashes are stable per purpose and differ between purposes")
    void keyedHashIsPurposeSeparated() {
        String a = traceTokenService.keyedHash("scan-ip", "198.51.100.1");
        assertThat(traceTokenService.keyedHash("scan-ip", "198.51.100.1")).isEqualTo(a);
        assertThat(traceTokenService.keyedHash("other", "198.51.100.1")).isNotEqualTo(a);
        assertThat(a).hasSize(64);
    }

    @Test
    @DisplayName("M9: an anonymous scan labelled factory is stored as buyer; a staff scan keeps its label")
    void anonymousScanCannotClaimStaffSource() throws Exception {
        Batch batch = saveBatch("TX-HD-SCAN", false);
        String body = objectMapper.writeValueAsString(Map.of("token", batch.getTraceToken(), "source", "factory"));

        mockMvc.perform(post("/api/v1/qr/scan").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/qr/scan").header("Authorization", "Bearer " + managerToken)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk());

        List<String> sources = scanEventRepository.findByBatchId(batch.getId()).stream().map(ScanEvent::getSource).sorted().toList();
        assertThat(sources).containsExactly("buyer", "factory");
    }

    // ---------- M11 ----------

    @Test
    @DisplayName("M11: a request id with spaces, newlines or odd characters is replaced")
    void unsafeRequestIdsAreReplaced() throws Exception {
        for (String bad : List.of("short", "has space in it", "line1\nFAKE LOG", "a".repeat(65), "semi;colon;id")) {
            RequestIdContext.set(bad);
            assertThat(RequestIdContext.getOrCreate()).isNotEqualTo(bad);
        }
        RequestIdContext.set("3f2b8c1e-0a4d-4e7f-9b21-5c6d7e8f9a0b");
        assertThat(RequestIdContext.getOrCreate()).isEqualTo("3f2b8c1e-0a4d-4e7f-9b21-5c6d7e8f9a0b");

        mockMvc.perform(get("/api/v1/qr/trace/t/not-a-token").header("X-Request-Id", "bad id with spaces"))
                .andExpect(result -> assertThat(result.getResponse().getContentAsString()).doesNotContain("bad id with spaces"));
    }

    // ---------- M13 ----------

    @Test
    @DisplayName("M13: a malformed or tampered token is 401 AUTH_INVALID_TOKEN")
    void malformedTokenIsRejected() throws Exception {
        String tampered = adminToken.substring(0, adminToken.length() - 4) + "abcd";
        for (String bad : List.of("not-a-jwt", tampered)) {
            mockMvc.perform(get("/api/v1/batches").header("Authorization", "Bearer " + bad))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.code").value(ErrorCode.AUTH_INVALID_TOKEN.name()));
        }
        mockMvc.perform(get("/api/v1/batches").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());
    }
}
