package com.tracex;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tracex.model.LoginEvent;
import com.tracex.model.Role;
import com.tracex.model.User;
import com.tracex.repository.LoginEventRepository;
import com.tracex.repository.UserRepository;
import com.tracex.security.GoogleTokenVerifier;
import com.tracex.security.GoogleTokenVerifier.GoogleIdentity;
import com.tracex.security.JwtService;
import com.tracex.security.RateLimiter;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Phase 11: Google sign-in (S-07, D-3). The verifier is a mock, so no test calls Google or needs a client id.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class GoogleSignInTests {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private LoginEventRepository loginEventRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtService jwtService;
    @Autowired private RateLimiter rateLimiter;

    @MockBean private GoogleTokenVerifier verifier;

    private final List<String> userIds = new ArrayList<>();
    private User alice;
    private User bob;

    @BeforeEach
    void setUp() {
        rateLimiter.resetAll();
        alice = save("g11alice", "g11alice@example.com");
        bob = save("g11bob", "g11bob@example.com");
        when(verifier.isConfigured()).thenReturn(true);
        when(verifier.verify(anyString())).thenReturn(Optional.empty());
        when(verifier.verify("alice-google-token")).thenReturn(Optional.of(new GoogleIdentity("alice.personal@gmail.com", "Alice")));
    }

    @AfterEach
    void tearDown() {
        for (String id : userIds) {
            loginEventRepository.deleteAll(loginEventRepository.findTop50ByUserIdAndCreatedAtAfterOrderByCreatedAtDesc(id, Instant.EPOCH));
        }
        userRepository.deleteAllById(userIds);
        rateLimiter.resetAll();
    }

    private User save(String username, String email) {
        User u = new User(username, passwordEncoder.encode("TestPass123456!"), username, email, Role.MANAGER, false);
        u.setEmailVerified(true);
        u = userRepository.save(u);
        userIds.add(u.getId());
        return u;
    }

    private String bearer(User u) {
        User fresh = userRepository.findById(u.getId()).orElseThrow();
        return "Bearer " + jwtService.generateToken(fresh.getId(), fresh.getTokenVersion());
    }

    private String json(String credential) throws Exception {
        return objectMapper.writeValueAsString(Map.of("credential", credential));
    }

    @Test
    @DisplayName("Link, then sign in with Google: a JWT is issued and the sign-in is recorded with method google")
    void linkThenSignIn() throws Exception {
        mockMvc.perform(post("/api/v1/auth/me/google-link").header("Authorization", bearer(alice))
                        .contentType(MediaType.APPLICATION_JSON).content(json("alice-google-token")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.googleEmail").value("alice.personal@gmail.com"));

        mockMvc.perform(post("/api/v1/auth/google/token").header("User-Agent", "Mozilla/5.0 (Windows NT 10.0) Chrome/129.0")
                        .contentType(MediaType.APPLICATION_JSON).content(json("alice-google-token")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.token").isNotEmpty())
                .andExpect(jsonPath("$.data.user.username").value("g11alice"));

        List<LoginEvent> events = loginEventRepository.findTop50ByUserIdAndCreatedAtAfterOrderByCreatedAtDesc(alice.getId(), Instant.EPOCH);
        assertThat(events).hasSize(1);
        assertThat(events.get(0).getMethod()).isEqualTo("google");
    }

    @Test
    @DisplayName("An unlinked Google account gets 403 AUTH_GOOGLE_NOT_LINKED; a bad token gets 401")
    void notLinkedAndInvalidToken() throws Exception {
        mockMvc.perform(post("/api/v1/auth/google/token").contentType(MediaType.APPLICATION_JSON).content(json("alice-google-token")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("AUTH_GOOGLE_NOT_LINKED"));
        mockMvc.perform(post("/api/v1/auth/google/token").contentType(MediaType.APPLICATION_JSON).content(json("forged")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_INVALID_TOKEN"));
        mockMvc.perform(post("/api/v1/auth/google/token").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    @DisplayName("One Google account can link to only one TraceX account (409)")
    void googleEmailIsUnique() throws Exception {
        mockMvc.perform(post("/api/v1/auth/me/google-link").header("Authorization", bearer(alice))
                        .contentType(MediaType.APPLICATION_JSON).content(json("alice-google-token")))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/auth/me/google-link").header("Authorization", bearer(bob))
                        .contentType(MediaType.APPLICATION_JSON).content(json("alice-google-token")))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("A deactivated account cannot sign in with Google; after unlinking, Google sign-in stops working")
    void deactivatedAndUnlinked() throws Exception {
        mockMvc.perform(post("/api/v1/auth/me/google-link").header("Authorization", bearer(alice))
                        .contentType(MediaType.APPLICATION_JSON).content(json("alice-google-token")))
                .andExpect(status().isOk());

        mockMvc.perform(delete("/api/v1/auth/me/google-link").header("Authorization", bearer(alice)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.googleEmail").doesNotExist());
        mockMvc.perform(post("/api/v1/auth/google/token").contentType(MediaType.APPLICATION_JSON).content(json("alice-google-token")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("AUTH_GOOGLE_NOT_LINKED"));

        mockMvc.perform(post("/api/v1/auth/me/google-link").header("Authorization", bearer(alice))
                        .contentType(MediaType.APPLICATION_JSON).content(json("alice-google-token")))
                .andExpect(status().isOk());
        User inactive = userRepository.findById(alice.getId()).orElseThrow();
        inactive.setActive(false);
        userRepository.save(inactive);
        mockMvc.perform(post("/api/v1/auth/google/token").contentType(MediaType.APPLICATION_JSON).content(json("alice-google-token")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("AUTH_ACCOUNT_INACTIVE"));
    }

    @Test
    @DisplayName("Without GOOGLE_CLIENT_ID, sign-in and linking answer 503 GOOGLE_SIGN_IN_UNAVAILABLE")
    void notConfigured() throws Exception {
        when(verifier.isConfigured()).thenReturn(false);
        mockMvc.perform(post("/api/v1/auth/google/token").contentType(MediaType.APPLICATION_JSON).content(json("alice-google-token")))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("GOOGLE_SIGN_IN_UNAVAILABLE"));
        mockMvc.perform(post("/api/v1/auth/me/google-link").header("Authorization", bearer(alice))
                        .contentType(MediaType.APPLICATION_JSON).content(json("alice-google-token")))
                .andExpect(status().isServiceUnavailable());
    }

    @Test
    @DisplayName("Token claims: wrong audience, wrong issuer, unverified email or expiry are all refused")
    void claimChecks() {
        GoogleTokenVerifier real = new GoogleTokenVerifier("our-client-id.apps.googleusercontent.com", objectMapper, Clock.systemUTC());
        long future = Instant.now().getEpochSecond() + 600;
        Map<String, Object> good = Map.of("aud", "our-client-id.apps.googleusercontent.com", "iss", "https://accounts.google.com",
                "email_verified", "true", "exp", String.valueOf(future), "email", "Person@Gmail.com", "name", "Person");

        assertThat(real.checkClaims(objectMapper.valueToTree(good))).contains(new GoogleIdentity("person@gmail.com", "Person"));
        assertThat(real.checkClaims(objectMapper.valueToTree(with(good, "aud", "someone-elses-app")))).isEmpty();
        assertThat(real.checkClaims(objectMapper.valueToTree(with(good, "iss", "evil.example.com")))).isEmpty();
        assertThat(real.checkClaims(objectMapper.valueToTree(with(good, "email_verified", "false")))).isEmpty();
        assertThat(real.checkClaims(objectMapper.valueToTree(with(good, "exp", String.valueOf(Instant.now().getEpochSecond() - 5))))).isEmpty();
        assertThat(new GoogleTokenVerifier("", objectMapper, Clock.systemUTC()).verify("anything")).isEmpty();
    }

    private static Map<String, Object> with(Map<String, Object> base, String key, Object value) {
        Map<String, Object> copy = new java.util.HashMap<>(base);
        copy.put(key, value);
        return copy;
    }
}
