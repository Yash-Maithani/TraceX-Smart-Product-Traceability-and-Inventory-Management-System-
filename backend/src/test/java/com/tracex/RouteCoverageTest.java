package com.tracex;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
public class RouteCoverageTest {

    private static final Logger log = LoggerFactory.getLogger(RouteCoverageTest.class);

    @Autowired
    @org.springframework.beans.factory.annotation.Qualifier("requestMappingHandlerMapping")
    private RequestMappingHandlerMapping handlerMapping;

    @Test
    @DisplayName("Two-way route coverage: every mapped Spring endpoint has a matrix row, and every matrix row with phase <= 4 maps to a real endpoint")
    void testTwoWayRouteCoverage() throws IOException {
        Path matrixPath = findPermissionMatrixPath();
        assertThat(matrixPath)
                .withFailMessage("docs/permission-matrix.csv could not be found")
                .isNotNull();

        List<String> matrixLines = Files.readAllLines(matrixPath);
        Set<String> allMatrixEndpoints = new HashSet<>();
        Set<String> phaseLeq4MatrixEndpoints = new HashSet<>();
        List<String> pendingLaterPhaseEndpoints = new ArrayList<>();

        // Parse phase, method, path from CSV lines
        for (int i = 1; i < matrixLines.size(); i++) {
            String line = matrixLines.get(i).trim();
            if (line.isEmpty() || line.startsWith("#")) {
                continue;
            }
            String[] parts = line.split(",");
            if (parts.length >= 3) {
                int phase;
                try {
                    phase = Integer.parseInt(parts[0].trim());
                } catch (NumberFormatException e) {
                    continue;
                }
                String method = parts[1].trim().toUpperCase();
                String path = parts[2].trim();
                String key = method + " " + path;
                allMatrixEndpoints.add(key);

                if (phase <= 8) {
                    phaseLeq4MatrixEndpoints.add(key);
                } else {
                    pendingLaterPhaseEndpoints.add(String.format("Phase %d: %s", phase, key));
                }
            }
        }

        // Collect all mapped Spring routes
        Set<String> mappedSpringRoutes = new HashSet<>();
        List<String> unmappedRoutes = new ArrayList<>();

        handlerMapping.getHandlerMethods().forEach((info, method) -> {
            String className = method.getBeanType().getName();
            if (className.startsWith("com.tracex.test.") ||
                className.contains("swagger") ||
                className.contains("springdoc") ||
                className.contains("BasicErrorController")) {
                return;
            }

            Set<String> patterns = info.getPatternValues();
            Set<RequestMethod> httpMethods = info.getMethodsCondition().getMethods();

            for (String pattern : patterns) {
                if (pattern.startsWith("/actuator") ||
                    pattern.startsWith("/v3/api-docs") ||
                    pattern.startsWith("/swagger-ui") ||
                    pattern.startsWith("/error") ||
                    pattern.startsWith("/api/v1/test")) {
                    continue;
                }

                // Normalize Spring path variable {param} to :param
                String normalizedPath = pattern.replaceAll("\\{[^/]+\\}", ":$0")
                        .replace(":{", ":")
                        .replace("}", "");

                if (httpMethods.isEmpty()) {
                    String key = "GET " + normalizedPath;
                    mappedSpringRoutes.add(key);
                    if (!allMatrixEndpoints.contains(key)) {
                        unmappedRoutes.add(key + " (" + method.getMethod().getName() + ")");
                    }
                } else {
                    for (RequestMethod rm : httpMethods) {
                        String key = rm.name().toUpperCase() + " " + normalizedPath;
                        mappedSpringRoutes.add(key);
                        if (!allMatrixEndpoints.contains(key)) {
                            unmappedRoutes.add(key + " (" + method.getMethod().getName() + ")");
                        }
                    }
                }
            }
        });

        // Direction 1: Every mapped Spring endpoint must have a corresponding row in docs/permission-matrix.csv
        assertThat(unmappedRoutes)
                .withFailMessage("The following mapped Spring endpoints have no corresponding entry in docs/permission-matrix.csv:\n" + String.join("\n", unmappedRoutes))
                .isEmpty();

        // Direction 2: Every matrix row with phase <= 8 must map to a real Spring endpoint (actuator health is handled by Actuator)
        List<String> missingPhaseLeq4Routes = new ArrayList<>();
        for (String expectedRoute : phaseLeq4MatrixEndpoints) {
            if (expectedRoute.equals("GET /actuator/health")) {
                continue; // Provided by Spring Boot Actuator
            }
            if (!mappedSpringRoutes.contains(expectedRoute)) {
                missingPhaseLeq4Routes.add(expectedRoute);
            }
        }

        assertThat(missingPhaseLeq4Routes)
                .withFailMessage("The following Phase <= 8 routes from permission-matrix.csv are not mapped in Spring Boot controllers:\n" + String.join("\n", missingPhaseLeq4Routes))
                .isEmpty();

        assertThat(phaseLeq4MatrixEndpoints).hasSize(53);
        log.info("Two-way route coverage confirmed for Phase <= 8 ({} active endpoints). {} endpoints pending for later phases.",
                phaseLeq4MatrixEndpoints.size(), pendingLaterPhaseEndpoints.size());
    }

    private Path findPermissionMatrixPath() {
        Path current = Path.of("").toAbsolutePath();
        for (int i = 0; i < 5; i++) {
            Path candidate = current.resolve("docs/permission-matrix.csv");
            if (Files.exists(candidate)) {
                return candidate;
            }
            if (current.getParent() == null) break;
            current = current.getParent();
        }
        return null;
    }
}
