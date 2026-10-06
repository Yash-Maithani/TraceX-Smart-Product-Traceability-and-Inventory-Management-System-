package com.tracex;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tracex.exception.ErrorCode;
import com.tracex.model.Role;
import com.tracex.model.User;
import com.tracex.repository.UserRepository;
import com.tracex.security.JwtService;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TokenAndSessionTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private org.springframework.data.mongodb.core.MongoTemplate mongoTemplate;

    private User testUser;
    private String validToken;

    @org.junit.jupiter.api.AfterAll
    static void restoreSeedAfterClass(@Autowired com.tracex.service.SeedRunner seedRunner) {
        seedRunner.run();
    }

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();

        testUser = new User("test_manager", passwordEncoder.encode("Password123!"), "Manager", "manager@tracex.demo", Role.MANAGER, false);
        testUser.setTokenVersion(1L);
        userRepository.save(testUser);

        validToken = jwtService.generateToken(testUser.getId(), testUser.getTokenVersion());
    }

    @Test
    @DisplayName("Missing token on protected endpoint returns 401 AUTH_NO_TOKEN with requestId")
    void testMissingTokenReturns401AuthNoToken() throws Exception {
        mockMvc.perform(get("/api/v1/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().exists("X-Request-Id"))
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value(ErrorCode.AUTH_NO_TOKEN.name()));
    }

    @Test
    @DisplayName("Expired token returns 401 AUTH_INVALID_TOKEN")
    void testExpiredTokenReturns401AuthInvalidToken() throws Exception {
        SecretKey key = Keys.hmacShaKeyFor("test_jwt_secret_key_must_be_at_least_32_chars_long_12345".getBytes(StandardCharsets.UTF_8));
        Instant past = Instant.now().minus(1, ChronoUnit.HOURS);

        String expiredToken = Jwts.builder()
                .subject(testUser.getId())
                .claim("tv", 1L)
                .issuedAt(Date.from(past.minus(8, ChronoUnit.HOURS)))
                .expiration(Date.from(past))
                .signWith(key)
                .compact();

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + expiredToken))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value(ErrorCode.AUTH_INVALID_TOKEN.name()));
    }

    @Test
    @DisplayName("Tampered token signature returns 401 AUTH_INVALID_TOKEN")
    void testTamperedTokenReturns401AuthInvalidToken() throws Exception {
        String tampered = validToken.substring(0, validToken.length() - 5) + "abcde";

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + tampered))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value(ErrorCode.AUTH_INVALID_TOKEN.name()));
    }

    @Test
    @DisplayName("Forged role claim in token is ignored because role is strictly loaded from database")
    void testForgedRoleClaimInTokenIsIgnored() throws Exception {
        // Forging an ADMIN claim in the token for testUser whose DB role is MANAGER
        String forgedToken = jwtService.generateTokenWithClaims(
                testUser.getId(),
                testUser.getTokenVersion(),
                java.util.Map.of("role", "ADMIN", "isSuperAdmin", true)
        );

        // Accessing admin-only endpoint: should be rejected with 403 RBAC_INSUFFICIENT
        mockMvc.perform(get("/api/v1/test/admin-only")
                        .header("Authorization", "Bearer " + forgedToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value(ErrorCode.RBAC_INSUFFICIENT.name()));

        // But manager-only endpoint succeeds because DB role is MANAGER
        mockMvc.perform(get("/api/v1/test/manager-only")
                        .header("Authorization", "Bearer " + forgedToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    @DisplayName("TEST-M-02: logout-all increments tokenVersion, making the old token AUTH_SESSION_REVOKED")
    void testLogoutAllInvalidatesOldToken() throws Exception {
        // Valid token works initially
        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + validToken))
                .andExpect(status().isOk());

        // Perform logout-all
        mockMvc.perform(post("/api/v1/auth/me/logout-all")
                        .header("Authorization", "Bearer " + validToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        // Old token must immediately fail with AUTH_SESSION_REVOKED
        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + validToken))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value(ErrorCode.AUTH_SESSION_REVOKED.name()));
    }

    @Test
    @DisplayName("Deactivating user directly in MongoDB takes effect on the very next request (403 AUTH_ACCOUNT_INACTIVE)")
    void testDeactivatingUserInDatabaseTakesEffectImmediately() throws Exception {
        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + validToken))
                .andExpect(status().isOk());

        // Deactivate directly in DB
        testUser.setActive(false);
        userRepository.save(testUser);

        // Next request with same token is denied
        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + validToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value(ErrorCode.AUTH_ACCOUNT_INACTIVE.name()));
    }

    @Test
    @DisplayName("Soft-deleting user directly in MongoDB takes effect on the very next request (401 AUTH_ACCOUNT_DELETED)")
    void testDeletingUserInDatabaseTakesEffectImmediately() throws Exception {
        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + validToken))
                .andExpect(status().isOk());

        // Soft-delete directly in DB
        testUser.setDeleted(true);
        userRepository.save(testUser);

        // Next request returns 401 AUTH_ACCOUNT_DELETED
        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + validToken))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value(ErrorCode.AUTH_ACCOUNT_DELETED.name()));
    }

    @Test
    @DisplayName("Changing user role directly in MongoDB takes effect on the very next request")
    void testChangingRoleInDatabaseTakesEffectImmediately() throws Exception {
        // Manager cannot access admin-only route
        mockMvc.perform(get("/api/v1/test/admin-only")
                        .header("Authorization", "Bearer " + validToken))
                .andExpect(status().isForbidden());

        // Promote to ADMIN directly in DB
        testUser.setRole(Role.ADMIN);
        userRepository.save(testUser);

        // Very next request with the exact same token now succeeds!
        mockMvc.perform(get("/api/v1/test/admin-only")
                        .header("Authorization", "Bearer " + validToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }
}
