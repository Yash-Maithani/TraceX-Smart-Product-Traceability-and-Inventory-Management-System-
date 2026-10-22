package com.tracex;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tracex.model.LoginEvent;
import com.tracex.model.Role;
import com.tracex.model.User;
import com.tracex.repository.LoginEventRepository;
import com.tracex.repository.UserRepository;
import com.tracex.security.JwtService;
import com.tracex.security.RateLimiter;
import com.tracex.util.UserAgentParser;
import org.bson.Document;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Phase 9: PATCH /api/v1/auth/me/settings and GET /api/v1/auth/me/login-history.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class SettingsAndLoginHistoryTests {

    private static final String PASSWORD = "TestPass123456!";
    private static final String CHROME_WINDOWS =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";
    private static final String SAFARI_IPHONE =
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private LoginEventRepository loginEventRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtService jwtService;
    @Autowired private RateLimiter rateLimiter;
    @Autowired private MongoTemplate mongoTemplate;

    private final List<String> userIds = new ArrayList<>();
    private User alice;
    private User bob;

    @BeforeEach
    void setUp() {
        rateLimiter.resetAll();
        alice = save("p9alice", "p9alice@example.com");
        bob = save("p9bob", "p9bob@example.com");
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
        User u = new User(username, passwordEncoder.encode(PASSWORD), username, email, Role.MANAGER, false);
        u.setEmailVerified(true);
        u = userRepository.save(u);
        userIds.add(u.getId());
        return u;
    }

    private String token(User u) {
        return jwtService.generateToken(u.getId(), u.getTokenVersion());
    }

    private void login(String username, String password, String userAgent, int expectedStatus) throws Exception {
        mockMvc.perform(post("/api/v1/auth/login")
                        .header("User-Agent", userAgent)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("username", username, "password", password))))
                .andExpect(status().is(expectedStatus));
    }

    @Test
    @DisplayName("Settings: saved preferences come back on GET /me, and a partial update keeps the other fields")
    void settingsAreSavedAndPartiallyUpdated() throws Exception {
        String t = token(alice);
        mockMvc.perform(patch("/api/v1/auth/me/settings").header("Authorization", "Bearer " + t)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("mode", "dark", "palette", "obsidian", "accent", "rose", "showPageImages", false))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.preferences.mode").value("dark"));

        mockMvc.perform(patch("/api/v1/auth/me/settings").header("Authorization", "Bearer " + t)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("palette", "emerald"))))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + t))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.preferences.mode").value("dark"))
                .andExpect(jsonPath("$.data.preferences.palette").value("emerald"))
                .andExpect(jsonPath("$.data.preferences.accent").value("rose"))
                .andExpect(jsonPath("$.data.preferences.showPageImages").value(false));
    }

    @Test
    @DisplayName("Settings: preferences are null until first saved; a first partial save fills in the defaults")
    void defaultsWhenNothingSaved() throws Exception {
        String t = token(bob);
        mockMvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + t))
                .andExpect(jsonPath("$.data.preferences").doesNotExist());

        mockMvc.perform(patch("/api/v1/auth/me/settings").header("Authorization", "Bearer " + t)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("accent", "amber"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.preferences.mode").value("system"))
                .andExpect(jsonPath("$.data.preferences.palette").value("editorial"))
                .andExpect(jsonPath("$.data.preferences.accent").value("amber"))
                .andExpect(jsonPath("$.data.preferences.showPageImages").value(true));
    }

    @Test
    @DisplayName("Settings: unknown mode, palette or accent values return 422 with field errors")
    void invalidSettingsRejected() throws Exception {
        mockMvc.perform(patch("/api/v1/auth/me/settings").header("Authorization", "Bearer " + token(alice))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("mode", "neon", "palette", "purple", "accent", "x"))))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.fieldErrors.length()").value(3));
        assertThat(userRepository.findById(alice.getId()).orElseThrow().getPreferences()).isNull();
    }

    @Test
    @DisplayName("Login history: each successful sign-in is recorded with browser, OS and device; failed sign-ins are not")
    void successfulLoginsAreRecorded() throws Exception {
        login("p9alice", PASSWORD, CHROME_WINDOWS, 200);
        login("p9alice", "wrong-password", CHROME_WINDOWS, 401);
        login("p9alice", PASSWORD, SAFARI_IPHONE, 200);

        String body = mockMvc.perform(get("/api/v1/auth/me/login-history").header("Authorization", "Bearer " + token(alice)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        JsonNode data = objectMapper.readTree(body).get("data");
        assertThat(data).hasSize(2);
        // Newest first
        assertThat(data.get(0).get("browser").asText()).isEqualTo("Safari");
        assertThat(data.get(0).get("os").asText()).isEqualTo("iOS");
        assertThat(data.get(0).get("device").asText()).isEqualTo("Mobile");
        assertThat(data.get(1).get("browser").asText()).isEqualTo("Chrome");
        assertThat(data.get(1).get("os").asText()).isEqualTo("Windows");
        assertThat(data.get(1).get("device").asText()).isEqualTo("Desktop");
        assertThat(data.get(0).get("method").asText()).isEqualTo("password");
        // No network or location data is exposed
        assertThat(body).doesNotContain("ip").doesNotContain("city").doesNotContain("country");
    }

    @Test
    @DisplayName("Login history: users only see their own sign-ins, and entries older than 30 days are left out")
    void historyIsOwnAndRecent() throws Exception {
        login("p9bob", PASSWORD, CHROME_WINDOWS, 200);
        loginEventRepository.save(new LoginEvent(alice.getId(), "p9alice", "Firefox", "Linux", "Desktop", "password",
                Instant.now().minus(Duration.ofDays(31))));
        loginEventRepository.save(new LoginEvent(alice.getId(), "p9alice", "Edge", "Windows", "Desktop", "password",
                Instant.now().minus(Duration.ofDays(2))));

        mockMvc.perform(get("/api/v1/auth/me/login-history").header("Authorization", "Bearer " + token(alice)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].browser").value("Edge"));
    }

    @Test
    @DisplayName("Login history: loginevents has a 30-day TTL index on createdAt and a userId+createdAt index")
    void loginEventIndexes() {
        List<Document> indexes = mongoTemplate.getCollection("loginevents").listIndexes().into(new ArrayList<>());
        Document ttl = indexes.stream().filter(i -> "createdAt_ttl_idx".equals(i.getString("name"))).findFirst().orElseThrow();
        assertThat(((Number) ttl.get("expireAfterSeconds")).longValue()).isEqualTo(2_592_000L);
        assertThat(indexes.stream().anyMatch(i -> "userId_createdAt_desc_idx".equals(i.getString("name")))).isTrue();
    }

    @Test
    @DisplayName("UserAgentParser: broad browser, OS and device families, with Unknown for a missing header")
    void userAgentParser() {
        assertThat(UserAgentParser.browser(CHROME_WINDOWS)).isEqualTo("Chrome");
        assertThat(UserAgentParser.browser("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/129.0 Safari/537.36 Edg/129.0")).isEqualTo("Edge");
        assertThat(UserAgentParser.browser("Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0")).isEqualTo("Firefox");
        assertThat(UserAgentParser.os("Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0")).isEqualTo("Linux");
        assertThat(UserAgentParser.os("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 Version/17.6 Safari/605.1.15")).isEqualTo("macOS");
        assertThat(UserAgentParser.os("Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/129.0 Mobile Safari/537.36")).isEqualTo("Android");
        assertThat(UserAgentParser.deviceType("Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X)")).isEqualTo("Tablet");
        assertThat(UserAgentParser.browser(null)).isEqualTo("Unknown");
        assertThat(UserAgentParser.os("")).isEqualTo("Unknown");
        assertThat(UserAgentParser.deviceType(null)).isEqualTo("Unknown");
    }
}
