package com.tracex;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
public class OpenApiExportTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    public void exportOpenApiSpecs() throws Exception {
        // Try /api/v1/api-docs first, fallback to /v3/api-docs if needed
        ResponseEntity<String> jsonResp = restTemplate.getForEntity("/api/v1/api-docs", String.class);
        if (!jsonResp.getStatusCode().is2xxSuccessful()) {
            jsonResp = restTemplate.getForEntity("/v3/api-docs", String.class);
        }
        assertEquals(200, jsonResp.getStatusCode().value(), "Expected 200 from JSON api-docs endpoint, got: " + jsonResp.getBody());
        String json = jsonResp.getBody();

        ResponseEntity<String> yamlResp = restTemplate.getForEntity("/api/v1/api-docs.yaml", String.class);
        if (!yamlResp.getStatusCode().is2xxSuccessful()) {
            yamlResp = restTemplate.getForEntity("/v3/api-docs.yaml", String.class);
        }
        assertEquals(200, yamlResp.getStatusCode().value(), "Expected 200 from YAML api-docs endpoint, got: " + yamlResp.getBody());
        String yaml = yamlResp.getBody();

        assertNotNull(json);
        assertNotNull(yaml);

        // Locate repo root
        Path cwd = Paths.get("").toAbsolutePath();
        Path repoRoot;
        if (Files.exists(cwd.resolve("pom.xml"))) {
            repoRoot = cwd.getParent();
        } else {
            repoRoot = cwd;
        }

        Path docsDir = repoRoot.resolve("docs");
        Path yamlDir = repoRoot.resolve("backend/src/main/resources/openapi");

        if ("true".equalsIgnoreCase(System.getProperty("export.openapi"))) {
            Files.writeString(yamlDir.resolve("tracex-api.yaml"), yaml, StandardCharsets.UTF_8);
            Files.writeString(docsDir.resolve("openapi.json"), json, StandardCharsets.UTF_8);
        }

        // Compare-only check: never write files during test execution (unless explicitly requested via export.openapi flag).
        // Verify live SpringDoc specification matches committed backend/src/main/resources/openapi/tracex-api.yaml
        // and that docs/openapi.json matches backend/src/main/resources/openapi/tracex-api.yaml.
        JsonNode root = objectMapper.readTree(json);
        JsonNode pathsNode = root.get("paths");
        assertNotNull(pathsNode, "OpenAPI paths node must not be null");

        Set<String> openApiOperations = new TreeSet<>();
        Iterator<Map.Entry<String, JsonNode>> pathFields = pathsNode.fields();
        while (pathFields.hasNext()) {
            Map.Entry<String, JsonNode> pathEntry = pathFields.next();
            String path = pathEntry.getKey();
            Iterator<String> methodNames = pathEntry.getValue().fieldNames();
            while (methodNames.hasNext()) {
                String method = methodNames.next().toUpperCase();
                if (Set.of("GET", "POST", "PUT", "PATCH", "DELETE").contains(method)) {
                    openApiOperations.add(method + " " + path);
                }
            }
        }

        List<String> csvLines = Files.readAllLines(docsDir.resolve("permission-matrix.csv"), StandardCharsets.UTF_8);
        Set<String> matrixApiOperations = new TreeSet<>();
        int totalActiveMatrixRows = 0;
        for (int i = 1; i < csvLines.size(); i++) {
            String line = csvLines.get(i).trim();
            if (line.isEmpty()) continue;
            String[] cols = line.split(",");
            int phase = Integer.parseInt(cols[0].trim());
            if (phase <= 8) {
                totalActiveMatrixRows++;
                String method = cols[1].trim().toUpperCase();
                String path = cols[2].trim().replaceAll(":([a-zA-Z0-9_]+)", "{$1}");
                if (path.startsWith("/api/v1/")) {
                    matrixApiOperations.add(method + " " + path);
                }
            }
        }

        assertEquals(53, totalActiveMatrixRows, "Expected 53 total active matrix rows for phase <= 8 (52 /api/v1/** + 1 /actuator/health)");
        assertEquals(52, matrixApiOperations.size(), "Expected 52 /api/v1/** matrix rows for phase <= 8");
        assertEquals(matrixApiOperations, openApiOperations,
                "OpenAPI operations must match active /api/v1/** rows in permission-matrix.csv 1-to-1 without test-only endpoints");

        // Verify BatchSummaryDto schema has date-only format on packDate/expiryDate and full status enum including EXCEPTION
        JsonNode batchSummaryProps = root.at("/components/schemas/BatchSummaryDto/properties");
        assertEquals("string", batchSummaryProps.at("/packDate/type").asText(), "BatchSummaryDto.packDate must have type string");
        assertEquals("date", batchSummaryProps.at("/packDate/format").asText(), "BatchSummaryDto.packDate must have format date");
        assertEquals("string", batchSummaryProps.at("/expiryDate/type").asText(), "BatchSummaryDto.expiryDate must have type string");
        assertEquals("date", batchSummaryProps.at("/expiryDate/format").asText(), "BatchSummaryDto.expiryDate must have format date");

        JsonNode statusEnumNode = batchSummaryProps.at("/status/enum");
        Set<String> statusEnumValues = new TreeSet<>();
        if (statusEnumNode.isArray()) {
            for (JsonNode val : statusEnumNode) {
                statusEnumValues.add(val.asText());
            }
        }
        assertEquals(Set.of("EXPIRED", "URGENT", "WARNING", "READY", "EXCEPTION", "DISPATCHED"), statusEnumValues,
                "BatchSummaryDto.status enum must list EXPIRED, URGENT, WARNING, READY, EXCEPTION, DISPATCHED");

        // Verify A0-2 business dates: BatchDetailDto.dispatchDate and DispatchHistoryEntry.dispatchDate have date-only format
        JsonNode batchDetailProps = root.at("/components/schemas/BatchDetailDto/properties");
        assertEquals("string", batchDetailProps.at("/dispatchDate/type").asText(), "BatchDetailDto.dispatchDate must have type string");
        assertEquals("date", batchDetailProps.at("/dispatchDate/format").asText(), "BatchDetailDto.dispatchDate must have format date");
        JsonNode dispatchRecordProps = root.at("/components/schemas/DispatchHistoryEntry/properties");
        assertEquals("string", dispatchRecordProps.at("/dispatchDate/type").asText(), "DispatchHistoryEntry.dispatchDate must have type string");
        assertEquals("date", dispatchRecordProps.at("/dispatchDate/format").asText(), "DispatchHistoryEntry.dispatchDate must have format date");

        // E7 Compare-Only Check:
        // 1) Live SpringDoc output must match backend/src/main/resources/openapi/tracex-api.yaml
        // 2) docs/openapi.json must match backend/src/main/resources/openapi/tracex-api.yaml
        JsonNode yamlRoot = new com.fasterxml.jackson.dataformat.yaml.YAMLMapper()
                .readTree(Files.readString(yamlDir.resolve("tracex-api.yaml"), StandardCharsets.UTF_8));
        JsonNode jsonFromDisk = objectMapper.readTree(Files.readString(docsDir.resolve("openapi.json"), StandardCharsets.UTF_8));
        java.util.Comparator<JsonNode> numericComparator = (a, b) ->
                (a.isNumber() && b.isNumber()) ? Double.compare(a.asDouble(), b.asDouble()) : (a.equals(b) ? 0 : 1);

        org.junit.jupiter.api.Assertions.assertTrue(
                yamlRoot.get("info").equals(numericComparator, root.get("info")),
                "Live OpenAPI info must match backend/src/main/resources/openapi/tracex-api.yaml");
        org.junit.jupiter.api.Assertions.assertTrue(
                yamlRoot.get("paths").equals(numericComparator, root.get("paths")),
                "Live OpenAPI paths must match backend/src/main/resources/openapi/tracex-api.yaml");
        org.junit.jupiter.api.Assertions.assertTrue(
                yamlRoot.get("components").equals(numericComparator, root.get("components")),
                "Live OpenAPI components must match backend/src/main/resources/openapi/tracex-api.yaml");
        org.junit.jupiter.api.Assertions.assertTrue(
                yamlRoot.get("info").equals(numericComparator, jsonFromDisk.get("info")),
                "docs/openapi.json info must match backend/src/main/resources/openapi/tracex-api.yaml");
        org.junit.jupiter.api.Assertions.assertTrue(
                yamlRoot.get("paths").equals(numericComparator, jsonFromDisk.get("paths")),
                "docs/openapi.json paths must match backend/src/main/resources/openapi/tracex-api.yaml");
        org.junit.jupiter.api.Assertions.assertTrue(
                yamlRoot.get("components").equals(numericComparator, jsonFromDisk.get("components")),
                "docs/openapi.json components must match backend/src/main/resources/openapi/tracex-api.yaml");

        System.out.println("Verified openapi.json length: " + json.length() + ", operations: " + openApiOperations.size());
        System.out.println("Verified tracex-api.yaml length: " + yaml.length());
    }
}
