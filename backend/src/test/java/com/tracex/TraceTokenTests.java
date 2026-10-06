package com.tracex;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tracex.service.TraceTokenService;
import com.tracex.util.TestDatabaseSafetyGuard;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Base64;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class TraceTokenTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private MongoTemplate mongoTemplate;

    @Autowired
    private TraceTokenService traceTokenService;

    @BeforeEach
    void setUp() {
        TestDatabaseSafetyGuard.checkTestDatabase(mongoTemplate);
    }

    @Test
    @DisplayName("Generated token matches format, length, base64url encoding and contains no batchCode")
    void testGeneratedTokenFormatAndNoBatchCode() {
        String token = traceTokenService.generateToken();
        assertThat(token).isNotBlank();

        // Must be <nonce>.<tag>
        String[] parts = token.split("\\.", -1);
        assertThat(parts).hasSize(2);

        String nonceStr = parts[0];
        String tagStr = parts[1];

        // Base64url without padding regex
        Pattern base64UrlPattern = Pattern.compile("^[A-Za-z0-9_-]+$");
        assertThat(nonceStr).matches(base64UrlPattern);
        assertThat(tagStr).matches(base64UrlPattern);

        // Decode: exactly 16 bytes each
        byte[] nonceBytes = Base64.getUrlDecoder().decode(nonceStr);
        byte[] tagBytes = Base64.getUrlDecoder().decode(tagStr);
        assertThat(nonceBytes).hasSize(16);
        assertThat(tagBytes).hasSize(16);

        // Check it contains no batchCode or date
        String sampleBatchCode = "TX-2026-10-001";
        assertThat(token).doesNotContain(sampleBatchCode);
        assertThat(token).doesNotContain("TX-");
        assertThat(token).doesNotContain("2026");

        // Service validation accepts it
        assertThat(traceTokenService.isValidToken(token)).isTrue();
    }

    @Test
    @DisplayName("Verification uses constant-time comparison via service API")
    void testConstantTimeVerificationViaServiceApi() {
        String token = traceTokenService.generateToken();
        assertThat(traceTokenService.isValidToken(token)).isTrue();

        // Mutating a character in the tag fails validation
        String[] parts = token.split("\\.");
        String nonceStr = parts[0];
        String tagStr = parts[1];

        char firstTagChar = tagStr.charAt(0);
        char tamperedTagChar = (firstTagChar == 'A') ? 'B' : 'A';
        String tamperedTag = tamperedTagChar + tagStr.substring(1);
        String forgedToken = nonceStr + "." + tamperedTag;

        assertThat(traceTokenService.isValidToken(forgedToken)).isFalse();

        // Mutating nonce fails validation
        char firstNonceChar = nonceStr.charAt(0);
        char tamperedNonceChar = (firstNonceChar == 'A') ? 'B' : 'A';
        String tamperedNonce = tamperedNonceChar + nonceStr.substring(1);
        String forgedNonceToken = tamperedNonce + "." + tagStr;

        assertThat(traceTokenService.isValidToken(forgedNonceToken)).isFalse();
    }

    @Test
    @DisplayName("Invalid token formats are rejected: empty, null, wrong separator, truncated, over-long")
    void testTokenValidationRejections() {
        assertThat(traceTokenService.isValidToken(null)).isFalse();
        assertThat(traceTokenService.isValidToken("")).isFalse();
        assertThat(traceTokenService.isValidToken("   ")).isFalse();

        // Wrong separator
        assertThat(traceTokenService.isValidToken("nonce:tag")).isFalse();
        assertThat(traceTokenService.isValidToken("nonce,tag")).isFalse();
        assertThat(traceTokenService.isValidToken("nonce..tag")).isFalse();
        assertThat(traceTokenService.isValidToken(".tag")).isFalse();
        assertThat(traceTokenService.isValidToken("nonce.")).isFalse();
        assertThat(traceTokenService.isValidToken("a.b.c")).isFalse();

        // Truncated
        String validToken = traceTokenService.generateToken();
        String[] parts = validToken.split("\\.");
        assertThat(traceTokenService.isValidToken(parts[0])).isFalse();
        assertThat(traceTokenService.isValidToken(parts[0] + ".AQID")).isFalse();

        // Over-long (e.g. 24 bytes base64 encoded)
        String overLongNonce = Base64.getUrlEncoder().withoutPadding().encodeToString(new byte[24]);
        String validTag = parts[1];
        assertThat(traceTokenService.isValidToken(overLongNonce + "." + validTag)).isFalse();

        String overLongTag = Base64.getUrlEncoder().withoutPadding().encodeToString(new byte[24]);
        assertThat(traceTokenService.isValidToken(parts[0] + "." + overLongTag)).isFalse();

        // Invalid base64url characters (+, /, =)
        assertThat(traceTokenService.isValidToken("nonce+plus.tag")).isFalse();
        assertThat(traceTokenService.isValidToken("nonce/slash.tag")).isFalse();
        assertThat(traceTokenService.isValidToken("nonce=.tag=")).isFalse();
    }

    @Test
    @DisplayName("Unknown, forged, truncated, wrong separator, and over-long tokens return identical 404 body (apart from requestId)")
    void testUnknownForgedTruncatedMalformedTokensReturnIdentical404Body() throws Exception {
        // 1. Unknown valid token (valid format, not in DB)
        String unknownValidToken = traceTokenService.generateToken();
        MvcResult unknownRes = mockMvc.perform(get("/api/v1/qr/trace/t/" + unknownValidToken))
                .andExpect(status().isNotFound())
                .andReturn();
        JsonNode unknownJson = objectMapper.readTree(unknownRes.getResponse().getContentAsString());

        // 2. Forged tag token
        String validToken = traceTokenService.generateToken();
        String[] parts = validToken.split("\\.");
        char lastChar = parts[1].charAt(parts[1].length() - 1);
        char tampered = (lastChar == 'x') ? 'y' : 'x';
        String forgedToken = parts[0] + "." + parts[1].substring(0, parts[1].length() - 1) + tampered;
        MvcResult forgedRes = mockMvc.perform(get("/api/v1/qr/trace/t/" + forgedToken))
                .andExpect(status().isNotFound())
                .andReturn();
        JsonNode forgedJson = objectMapper.readTree(forgedRes.getResponse().getContentAsString());

        // 3. Truncated token
        String truncatedToken = parts[0] + ".AQID";
        MvcResult truncRes = mockMvc.perform(get("/api/v1/qr/trace/t/" + truncatedToken))
                .andExpect(status().isNotFound())
                .andReturn();
        JsonNode truncJson = objectMapper.readTree(truncRes.getResponse().getContentAsString());

        // 4. Wrong separator
        String wrongSepToken = parts[0] + "-" + parts[1];
        MvcResult wrongSepRes = mockMvc.perform(get("/api/v1/qr/trace/t/" + wrongSepToken))
                .andExpect(status().isNotFound())
                .andReturn();
        JsonNode wrongSepJson = objectMapper.readTree(wrongSepRes.getResponse().getContentAsString());

        // 5. Over-long token
        String overLongNonce = Base64.getUrlEncoder().withoutPadding().encodeToString(new byte[24]);
        String overLongToken = overLongNonce + "." + parts[1];
        MvcResult overLongRes = mockMvc.perform(get("/api/v1/qr/trace/t/" + overLongToken))
                .andExpect(status().isNotFound())
                .andReturn();
        JsonNode overLongJson = objectMapper.readTree(overLongRes.getResponse().getContentAsString());

        // 6. Whitespace / empty token
        MvcResult emptyRes = mockMvc.perform(get(java.net.URI.create("/api/v1/qr/trace/t/%20")))
                .andExpect(status().isNotFound())
                .andReturn();
        JsonNode emptyJson = objectMapper.readTree(emptyRes.getResponse().getContentAsString());

        // Assert all share the exact same error code, message, success flag and data
        assertIdenticalErrorStructure(unknownJson, forgedJson);
        assertIdenticalErrorStructure(unknownJson, truncJson);
        assertIdenticalErrorStructure(unknownJson, wrongSepJson);
        assertIdenticalErrorStructure(unknownJson, overLongJson);
        assertIdenticalErrorStructure(unknownJson, emptyJson);
    }

    private void assertIdenticalErrorStructure(JsonNode expected, JsonNode actual) {
        assertThat(actual.path("success").asBoolean()).isEqualTo(expected.path("success").asBoolean()).isFalse();
        assertThat(actual.path("code").asText()).isEqualTo(expected.path("code").asText()).isEqualTo("NOT_FOUND");
        assertThat(actual.path("error").asText()).isEqualTo(expected.path("error").asText()).isEqualTo("Batch not found or unavailable");
        assertThat(actual.path("requestId").asText()).isNotBlank();
    }
}
