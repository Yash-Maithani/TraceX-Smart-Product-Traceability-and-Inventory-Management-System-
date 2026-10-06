package com.tracex;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tracex.model.Role;
import com.tracex.model.User;
import com.tracex.repository.UserRepository;
import com.tracex.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import static org.assertj.core.api.Assertions.assertThat;

public class ForwardedHeadersEmpiricalTest {

    @SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
    @ActiveProfiles("test")
    @TestPropertySource(properties = {
            "server.forward-headers-strategy=framework"
    })
    @Nested
    @DisplayName("Framework Forwarded Headers Strategy")
    class FrameworkStrategyTests {

        @LocalServerPort
        private int port;

        @Autowired
        private JwtService jwtService;

        @Autowired
        private UserRepository userRepository;

        @Autowired
        private PasswordEncoder passwordEncoder;

        private final ObjectMapper objectMapper = new ObjectMapper();
        private User admin;

        @BeforeEach
        void setUp() {
            userRepository.deleteAll();
            admin = userRepository.save(new User("admin", passwordEncoder.encode("ValidPass123!"), "Admin User", "admin@tracex.demo", Role.ADMIN, true));
        }

        @Test
        @DisplayName("Framework: forwards 203.0.113.9 from loopback")
        void testFrameworkStrategyForwardsHeader() throws Exception {
            String token = jwtService.generateToken(admin.getId(), admin.getTokenVersion());

            HttpClient client = HttpClient.newHttpClient();
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("http://127.0.0.1:" + port + "/api/v1/test/client-ip"))
                    .header("Authorization", "Bearer " + token)
                    .header("X-Forwarded-For", "203.0.113.9")
                    .GET()
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            assertThat(response.statusCode()).isEqualTo(200);

            JsonNode json = objectMapper.readTree(response.body());
            String clientIp = json.get("clientIp").asText();
            assertThat(clientIp).isEqualTo("203.0.113.9");
        }
    }

    @SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
    @ActiveProfiles("test")
    @TestPropertySource(properties = {
            "server.forward-headers-strategy=native"
    })
    @Nested
    @DisplayName("Native Forwarded Headers Strategy (Trusted Proxy)")
    class NativeStrategyTrustedProxyTests {

        @LocalServerPort
        private int port;

        @Autowired
        private JwtService jwtService;

        @Autowired
        private UserRepository userRepository;

        @Autowired
        private PasswordEncoder passwordEncoder;

        private final ObjectMapper objectMapper = new ObjectMapper();
        private User admin;

        @BeforeEach
        void setUp() {
            userRepository.deleteAll();
            admin = userRepository.save(new User("admin", passwordEncoder.encode("ValidPass123!"), "Admin User", "admin@tracex.demo", Role.ADMIN, true));
        }

        @Test
        @DisplayName("Native: trusted proxy (127.0.0.1) forwards 203.0.113.9")
        void testNativeStrategyForwardsHeaderWhenTrusted() throws Exception {
            String token = jwtService.generateToken(admin.getId(), admin.getTokenVersion());

            HttpClient client = HttpClient.newHttpClient();
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("http://127.0.0.1:" + port + "/api/v1/test/client-ip"))
                    .header("Authorization", "Bearer " + token)
                    .header("X-Forwarded-For", "203.0.113.9")
                    .GET()
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            assertThat(response.statusCode()).isEqualTo(200);

            JsonNode json = objectMapper.readTree(response.body());
            String clientIp = json.get("clientIp").asText();
            assertThat(clientIp).isEqualTo("203.0.113.9");
        }
    }

    @SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
    @ActiveProfiles("test")
    @TestPropertySource(properties = {
            "server.forward-headers-strategy=native",
            "server.tomcat.remoteip.internal-proxies=10\\..*"
    })
    @Nested
    @DisplayName("Native Forwarded Headers Strategy (Untrusted Direct Connection)")
    class NativeStrategyUntrustedDirectTests {

        @LocalServerPort
        private int port;

        @Autowired
        private JwtService jwtService;

        @Autowired
        private UserRepository userRepository;

        @Autowired
        private PasswordEncoder passwordEncoder;

        private final ObjectMapper objectMapper = new ObjectMapper();
        private User admin;

        @BeforeEach
        void setUp() {
            userRepository.deleteAll();
            admin = userRepository.save(new User("admin", passwordEncoder.encode("ValidPass123!"), "Admin User", "admin@tracex.demo", Role.ADMIN, true));
        }

        @Test
        @DisplayName("Native: untrusted direct connection (127.0.0.1 not matching internal-proxies) ignores spoofed X-Forwarded-For")
        void testNativeStrategyIgnoresHeaderFromUntrustedConnection() throws Exception {
            String token = jwtService.generateToken(admin.getId(), admin.getTokenVersion());

            HttpClient client = HttpClient.newHttpClient();
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("http://127.0.0.1:" + port + "/api/v1/test/client-ip"))
                    .header("Authorization", "Bearer " + token)
                    .header("X-Forwarded-For", "203.0.113.9")
                    .GET()
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            assertThat(response.statusCode()).isEqualTo(200);

            JsonNode json = objectMapper.readTree(response.body());
            String clientIp = json.get("clientIp").asText();
            // Since 127.0.0.1 is not in internal-proxies (10.*), Tomcat's RemoteIpValve ignores X-Forwarded-For and returns remote IP (127.0.0.1)
            assertThat(clientIp).isEqualTo("127.0.0.1");
            assertThat(clientIp).isNotEqualTo("203.0.113.9");
        }
    }
}
