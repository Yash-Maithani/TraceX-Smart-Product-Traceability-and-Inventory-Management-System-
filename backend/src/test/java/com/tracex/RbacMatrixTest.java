package com.tracex;

import com.tracex.exception.ErrorCode;
import com.tracex.model.Role;
import com.tracex.model.User;
import com.tracex.repository.UserRepository;
import com.tracex.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.TestFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class RbacMatrixTest {

    private static final Logger log = LoggerFactory.getLogger(RbacMatrixTest.class);

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private static final String NON_EXISTENT_ID = "000000000000000000000001";

    private final Map<String, User> testUsers = new HashMap<>();

    @BeforeEach
    void setUpUsers() {
        createOrUpdateUser("rbac_superadmin", Role.ADMIN, true);
        createOrUpdateUser("rbac_admin", Role.ADMIN, false);
        createOrUpdateUser("rbac_manager", Role.MANAGER, false);
        createOrUpdateUser("rbac_factory_mgr", Role.FACTORY_MANAGER, false);
        createOrUpdateUser("rbac_inspector", Role.QUALITY_INSPECTOR, false);
        createOrUpdateUser("rbac_coordinator", Role.DISPATCH_COORDINATOR, false);
    }

    private void createOrUpdateUser(String username, Role role, boolean isSuperAdmin) {
        User user = userRepository.findByUsername(username).orElseGet(() -> {
            User newUser = new User(
                    username,
                    passwordEncoder.encode("TestPass123456!"),
                    "RBAC Test " + username,
                    username + "@tracex.demo",
                    role,
                    isSuperAdmin
            );
            return newUser;
        });
        user.setRole(role);
        user.setSuperAdmin(isSuperAdmin);
        user.setActive(true);
        user.setDeleted(false);
        user = userRepository.save(user);
        testUsers.put(username, user);
    }

    private String getTokenForRole(String roleName) {
        String username = switch (roleName) {
            case "super-admin" -> "rbac_superadmin";
            case "admin" -> "rbac_admin";
            case "manager" -> "rbac_manager";
            case "factory-manager" -> "rbac_factory_mgr";
            case "quality-inspector" -> "rbac_inspector";
            case "dispatch-coordinator" -> "rbac_coordinator";
            default -> throw new IllegalArgumentException("Unknown role: " + roleName);
        };
        User user = userRepository.findByUsername(username).orElseThrow();
        return jwtService.generateToken(user.getId(), user.getTokenVersion());
    }

    @TestFactory
    @DisplayName("RBAC Permission Matrix Suite (Phase <= 8)")
    Stream<DynamicTest> testRbacMatrixPhaseLeq4() throws IOException {
        Path matrixPath = findPermissionMatrixPath();
        assertThat(matrixPath).isNotNull();

        List<String> lines = Files.readAllLines(matrixPath);
        List<DynamicTest> tests = new ArrayList<>();

        List<String> roles = List.of(
                "super-admin", "admin", "manager", "factory-manager", "quality-inspector", "dispatch-coordinator"
        );

        int evaluatedRowCount = 0;

        for (int i = 1; i < lines.size(); i++) {
            String line = lines.get(i).trim();
            if (line.isEmpty() || line.startsWith("#")) continue;

            String[] parts = line.split(",");
            if (parts.length < 9) continue;

            int phase = Integer.parseInt(parts[0].trim());
            if (phase > 8) {
                continue; // Covered in later phases
            }

            evaluatedRowCount++;
            String method = parts[1].trim().toUpperCase();
            String rawPath = parts[2].trim();

            String anonymousRule = parts.length > 9 ? parts[9].trim().toLowerCase() : "deny";
            boolean isPublic = "allow".equals(anonymousRule);

            // Add dynamic test for anonymous access
            String anonTestName = String.format("Phase %d [anonymous] %s %s -> %s", phase, method, rawPath, anonymousRule);
            tests.add(DynamicTest.dynamicTest(anonTestName, () -> {
                String resolvedPath = rawPath.replace(":id", NON_EXISTENT_ID).replace(":batchId", NON_EXISTENT_ID).replace(":token", "test.token");
                MockHttpServletRequestBuilder anonReq = MockMvcRequestBuilders
                        .request(HttpMethod.valueOf(method), URI.create(resolvedPath))
                        .contentType(MediaType.APPLICATION_JSON);

                if (method.equals("POST") || method.equals("PATCH") || method.equals("PUT")) {
                    if (resolvedPath.contains("/qr/scan")) {
                        anonReq.content("{\"token\":\"test.token\"}");
                    } else {
                        anonReq.content("{}");
                    }
                }

                if ("deny".equals(anonymousRule)) {
                    mockMvc.perform(anonReq)
                            .andExpect(status().isUnauthorized())
                            .andExpect(jsonPath("$.code").value(ErrorCode.AUTH_NO_TOKEN.name()));
                } else {
                    mockMvc.perform(anonReq)
                            .andExpect(result -> {
                                int status = result.getResponse().getStatus();
                                org.assertj.core.api.Assertions.assertThat(status)
                                    .isNotIn(401, 403);
                            });
                }
            }));

            for (int r = 0; r < roles.size(); r++) {
                String role = roles.get(r);
                String expectedPermission = parts[3 + r].trim().toLowerCase();

                String testName = String.format("Phase %d [%s] %s %s -> %s", phase, role, method, rawPath, expectedPermission);

                tests.add(DynamicTest.dynamicTest(testName, () -> {
                    String resolvedPath = rawPath.replace(":id", NON_EXISTENT_ID).replace(":batchId", NON_EXISTENT_ID).replace(":token", "test.token");
                    HttpMethod httpMethod = HttpMethod.valueOf(method);

                    MockHttpServletRequestBuilder requestBuilder = MockMvcRequestBuilders
                            .request(httpMethod, URI.create(resolvedPath))
                            .contentType(MediaType.APPLICATION_JSON);

                    if (!isPublic) {
                        String token = getTokenForRole(role);
                        requestBuilder.header("Authorization", "Bearer " + token);
                    }

                    if (method.equals("POST") || method.equals("PATCH") || method.equals("PUT")) {
                        if (resolvedPath.contains("/raw-material")) {
                            requestBuilder.content("{\"farmerName\":\"F\", \"village\":\"V\", \"sourceLotCode\":\"L\", \"quantityProduced\":1, \"unit\":\"Kg\", \"yieldPercent\":1.0}");
                        } else if (resolvedPath.contains("/note")) {
                            requestBuilder.content("{\"note\":\"n\"}");
                        } else if (resolvedPath.contains("/dispatch")) {
                            requestBuilder.content("{\"buyerName\":\"Test Buyer\"}");
                        } else if (resolvedPath.contains("/inspections") && method.equals("POST")) {
                            requestBuilder.content("{\"batchId\":\"" + NON_EXISTENT_ID + "\", \"status\":\"PASSED\", \"rating\":5}");
                        } else if (resolvedPath.contains("/batches") && method.equals("POST")) {
                            requestBuilder.content("{\"productId\":\"662f6b8a8b1a8d001c2a3b4c\", \"sourceLotCode\":\"L\", \"farmerName\":\"F\", \"village\":\"V\", \"quantityProduced\":1, \"unit\":\"Kg\", \"yieldPercent\":1.0, \"packDate\":\"2024-01-01T00:00:00Z\"}");
                        } else if (resolvedPath.contains("/qr/scan")) {
                            requestBuilder.content("{\"token\":\"test.token\"}");
                        } else {
                            requestBuilder.content("{}");
                        }
                    }

                    if ("deny".equals(expectedPermission)) {
                        mockMvc.perform(requestBuilder)
                                .andExpect(status().isForbidden())
                                .andExpect(jsonPath("$.code").value(ErrorCode.RBAC_INSUFFICIENT.name()));
                    } else if ("allow".equals(expectedPermission)) {
                        mockMvc.perform(requestBuilder)
                                .andExpect(result -> {
                                    int status = result.getResponse().getStatus();
                                    org.assertj.core.api.Assertions.assertThat(status)
                                        .isNotIn(401, 403);
                                });
                    }
                }));
            }
        }

        assertThat(evaluatedRowCount).isEqualTo(53);
        assertThat(tests.size()).isEqualTo(371);
        log.info("Generated {} dynamic tests for {} active phase rows", tests.size(), evaluatedRowCount);
        return tests.stream();
    }

    private java.nio.file.Path findPermissionMatrixPath() {
        return java.nio.file.Path.of("../docs/permission-matrix.csv");
    }

}