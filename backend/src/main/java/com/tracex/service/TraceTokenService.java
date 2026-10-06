package com.tracex.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;

@Service
public class TraceTokenService {

    private static final String HMAC_ALGORITHM = "HmacSHA256";
    private static final int NONCE_BYTE_LENGTH = 16;
    private static final int TAG_BYTE_LENGTH = 16;

    private final SecureRandom secureRandom = new SecureRandom();
    private final byte[] secretKeyBytes;

    @org.springframework.beans.factory.annotation.Autowired
    public TraceTokenService(
            @Value("${tracex.security.trace-token-secret:}") String traceTokenSecret,
            @Value("${tracex.security.jwt-secret:}") String jwtSecret
    ) {
        String effectiveSecret = (traceTokenSecret != null && !traceTokenSecret.trim().isEmpty())
                ? traceTokenSecret.trim()
                : (jwtSecret != null && !jwtSecret.trim().isEmpty() ? jwtSecret.trim() : "default-dev-test-trace-token-secret-must-be-long-enough");
        this.secretKeyBytes = effectiveSecret.getBytes(StandardCharsets.UTF_8);
    }

    /**
     * Package-private constructor for isolated unit testing with custom secret.
     */
    TraceTokenService(String customSecret) {
        this.secretKeyBytes = customSecret.getBytes(StandardCharsets.UTF_8);
    }

    /**
     * Generates an opaque trace token:
     * 16 random bytes (SecureRandom) nonce + 16-byte HMAC-SHA256 tag, base64url encoded without padding, joined by a dot.
     */
    public String generateToken() {
        byte[] nonce = new byte[NONCE_BYTE_LENGTH];
        secureRandom.nextBytes(nonce);

        byte[] tag = computeTag(nonce);

        String noncePart = Base64.getUrlEncoder().withoutPadding().encodeToString(nonce);
        String tagPart = Base64.getUrlEncoder().withoutPadding().encodeToString(tag);

        return noncePart + "." + tagPart;
    }

    /**
     * Validates a token using constant-time comparison.
     * Rejects invalid format, wrong lengths, or forged HMAC tags in constant time without database read.
     * Never logs token values or cryptographic errors.
     */
    public boolean isValidToken(String token) {
        if (token == null || token.isBlank()) {
            return false;
        }

        int dotIndex = token.indexOf('.');
        if (dotIndex <= 0 || dotIndex == token.length() - 1 || token.indexOf('.', dotIndex + 1) != -1) {
            return false;
        }

        String nonceStr = token.substring(0, dotIndex);
        String tagStr = token.substring(dotIndex + 1);

        byte[] nonceBytes;
        byte[] tagBytes;
        try {
            nonceBytes = Base64.getUrlDecoder().decode(nonceStr);
            tagBytes = Base64.getUrlDecoder().decode(tagStr);
        } catch (IllegalArgumentException e) {
            return false;
        }

        if (nonceBytes.length != NONCE_BYTE_LENGTH || tagBytes.length != TAG_BYTE_LENGTH) {
            return false;
        }

        byte[] expectedTag = computeTag(nonceBytes);
        return MessageDigest.isEqual(expectedTag, tagBytes);
    }

    private byte[] computeTag(byte[] nonce) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            SecretKeySpec secretKeySpec = new SecretKeySpec(secretKeyBytes, HMAC_ALGORITHM);
            mac.init(secretKeySpec);
            byte[] fullHmac = mac.doFinal(nonce);
            return Arrays.copyOf(fullHmac, TAG_BYTE_LENGTH);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to compute HMAC tag", e);
        }
    }

    public byte[] getSecretKeyBytes() {
        return secretKeyBytes.clone();
    }
}
