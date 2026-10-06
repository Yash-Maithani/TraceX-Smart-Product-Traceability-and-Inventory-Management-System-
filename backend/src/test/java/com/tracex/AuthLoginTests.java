package com.tracex;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tracex.dto.LoginRequest;
import com.tracex.exception.ErrorCode;
import com.tracex.model.Role;
import com.tracex.model.User;
import com.tracex.repository.UserRepository;
import com.tracex.security.RateLimiter;
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
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthLoginTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private RateLimiter rateLimiter;

    @Autowired
    private org.springframework.data.mongodb.core.MongoTemplate mongoTemplate;

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
        userRepository.deleteAll();

        // Active admin
        User activeAdmin = new User("admin", passwordEncoder.encode("ValidPass123!"), "Admin User", "admin@tracex.demo", Role.ADMIN, true);
        userRepository.save(activeAdmin);

        // Inactive user
        User inactiveUser = new User("inactive_user", passwordEncoder.encode("ValidPass123!"), "Inactive", "inactive@tracex.demo", Role.MANAGER, false);
        inactiveUser.setActive(false);
        userRepository.save(inactiveUser);

        // Soft-deleted user
        User deletedUser = new User("deleted_user", passwordEncoder.encode("ValidPass123!"), "Deleted", "deleted@tracex.demo", Role.FACTORY_MANAGER, false);
        deletedUser.setDeleted(true);
        userRepository.save(deletedUser);
    }

    @Test
    @DisplayName("Login success returns JWT token and UserSummaryDto without passwordHash")
    void testLoginSuccess() throws Exception {
        LoginRequest req = new LoginRequest("admin", "ValidPass123!");

        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(header().exists("X-Request-Id"))
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.token").isString())
                .andExpect(jsonPath("$.data.user.username").value("admin"))
                .andExpect(jsonPath("$.data.user.role").value("admin"))
                .andExpect(jsonPath("$.data.user.superAdmin").value(true))
                .andExpect(jsonPath("$.data.user.passwordHash").doesNotExist())
                .andReturn();

        String content = result.getResponse().getContentAsString();
        assertThat(content).doesNotContain("passwordHash");
        assertThat(content).doesNotContain("$2a$");
    }

    @Test
    @DisplayName("Wrong password returns 401 AUTH_INVALID_TOKEN")
    void testWrongPassword() throws Exception {
        LoginRequest req = new LoginRequest("admin", "WrongPass!");

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value(ErrorCode.AUTH_INVALID_TOKEN.name()))
                .andExpect(jsonPath("$.error").value("Invalid username or password"));
    }

    @Test
    @DisplayName("Unknown user returns 401 AUTH_INVALID_TOKEN")
    void testUnknownUser() throws Exception {
        LoginRequest req = new LoginRequest("non_existent_user", "AnyPassword!");

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value(ErrorCode.AUTH_INVALID_TOKEN.name()))
                .andExpect(jsonPath("$.error").value("Invalid username or password"));
    }

    @Test
    @DisplayName("Deleted user returns identical response to unknown user")
    void testDeletedUser() throws Exception {
        LoginRequest req = new LoginRequest("deleted_user", "ValidPass123!");

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value(ErrorCode.AUTH_INVALID_TOKEN.name()))
                .andExpect(jsonPath("$.error").value("Invalid username or password"));
    }

    @Test
    @DisplayName("Same-response check: unknown user and wrong password have identical envelope and message")
    void testSameResponseUnknownAndWrongPassword() throws Exception {
        LoginRequest unknownReq = new LoginRequest("ghost_user", "somePassword");
        LoginRequest wrongPassReq = new LoginRequest("admin", "wrongPassword");

        MvcResult unknownResult = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(unknownReq)))
                .andExpect(status().isUnauthorized())
                .andReturn();

        MvcResult wrongPassResult = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(wrongPassReq)))
                .andExpect(status().isUnauthorized())
                .andReturn();

        JsonNode unknownNode = objectMapper.readTree(unknownResult.getResponse().getContentAsString());
        JsonNode wrongPassNode = objectMapper.readTree(wrongPassResult.getResponse().getContentAsString());

        assertThat(unknownNode.get("code").asText()).isEqualTo(wrongPassNode.get("code").asText());
        assertThat(unknownNode.get("error").asText()).isEqualTo(wrongPassNode.get("error").asText());
    }

    @Test
    @DisplayName("Inactive user receives 403 AUTH_ACCOUNT_INACTIVE")
    void testInactiveUser() throws Exception {
        LoginRequest req = new LoginRequest("inactive_user", "ValidPass123!");

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value(ErrorCode.AUTH_ACCOUNT_INACTIVE.name()))
                .andExpect(jsonPath("$.error").value("Your account has been deactivated. Contact your administrator."));
    }

    @Test
    @DisplayName("Rate limit: 10 login attempts allowed, 11th rapid attempt returns 429 RATE_LIMITED")
    void testLoginRateLimit() throws Exception {
        LoginRequest req = new LoginRequest("admin", "WrongPassword!");

        for (int i = 1; i <= 10; i++) {
            mockMvc.perform(post("/api/v1/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isUnauthorized());
        }

        // 11th attempt must be blocked with 429
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value(ErrorCode.RATE_LIMITED.name()))
                .andExpect(jsonPath("$.error").value("Too many login attempts. Please try again later."));
    }

    @Test
    @DisplayName("Spoofed X-Forwarded-For headers cannot bypass rate limit: different spoofed headers share remote address bucket")
    void testSpoofedForwardedHeadersDoNotBypassRateLimit() throws Exception {
        LoginRequest req = new LoginRequest("admin", "WrongPassword!");

        for (int i = 1; i <= 10; i++) {
            mockMvc.perform(post("/api/v1/auth/login")
                            .header("X-Forwarded-For", "192.168.1." + i)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isUnauthorized());
        }

        // 11th attempt with yet another spoofed IP must still be blocked with 429
        mockMvc.perform(post("/api/v1/auth/login")
                        .header("X-Forwarded-For", "10.99.88.77")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value(ErrorCode.RATE_LIMITED.name()))
                .andExpect(jsonPath("$.error").value("Too many login attempts. Please try again later."));
    }

    @Test
    @DisplayName("BCrypt hash differs from plaintext password")
    void testBCryptHashDiffersFromPlaintext() {
        String plaintext = "SecretPassword123!";
        String hash = passwordEncoder.encode(plaintext);

        assertThat(hash).isNotEqualTo(plaintext);
        assertThat(hash).startsWith("$2a$");
        assertThat(passwordEncoder.matches(plaintext, hash)).isTrue();
    }

    @Test
    @DisplayName("Validation-error envelope returns 422 with fieldErrors array")
    void testValidationErrorEnvelopeWithFieldErrors() throws Exception {
        LoginRequest emptyReq = new LoginRequest("", "");

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(emptyReq)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(header().exists("X-Request-Id"))
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value(ErrorCode.VALIDATION_ERROR.name()))
                .andExpect(jsonPath("$.fieldErrors").isArray())
                .andExpect(jsonPath("$.fieldErrors.length()").value(2));
    }
}
