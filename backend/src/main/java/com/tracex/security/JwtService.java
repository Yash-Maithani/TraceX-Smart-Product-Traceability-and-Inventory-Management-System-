package com.tracex.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;

@Service
public class JwtService {

    public static final Duration TOKEN_VALIDITY = Duration.ofHours(8);

    private final SecretKey signingKey;
    private final Clock clock;

    public JwtService(@Value("${tracex.security.jwt-secret:default_dev_secret_key_must_be_at_least_32_characters_long_123456}") String secret,
                      Clock clock) {
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < 32) {
            // Pad if short in dev/test fallback
            byte[] padded = new byte[32];
            System.arraycopy(keyBytes, 0, padded, 0, keyBytes.length);
            keyBytes = padded;
        }
        this.signingKey = Keys.hmacShaKeyFor(keyBytes);
        this.clock = clock;
    }

    public String generateToken(String userId, long tokenVersion) {
        return generateTokenWithClaims(userId, tokenVersion, null);
    }

    public String generateTokenWithClaims(String userId, long tokenVersion, java.util.Map<String, Object> extraClaims) {
        Instant now = clock.instant();
        Instant expiry = now.plus(TOKEN_VALIDITY);

        var builder = Jwts.builder()
                .subject(userId)
                .claim("tv", tokenVersion)
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiry));

        if (extraClaims != null) {
            extraClaims.forEach(builder::claim);
        }

        return builder.signWith(signingKey).compact();
    }

    public Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(signingKey)
                .clock(() -> Date.from(clock.instant()))
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public String extractUserId(String token) {
        Claims claims = parseClaims(token);
        return claims.getSubject();
    }

    public Long extractTokenVersion(String token) {
        Claims claims = parseClaims(token);
        Object tv = claims.get("tv");
        if (tv instanceof Number) {
            return ((Number) tv).longValue();
        }
        return null;
    }

    public boolean validateToken(String token) {
        try {
            parseClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }
}
