package com.tracex.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.util.Optional;
import java.util.Set;

/**
 * Verifies a Google Identity Services ID token (the `credential` from the Sign in with Google button).
 *
 * Google checks the signature and expiry at its tokeninfo endpoint; this class then checks that the
 * token was issued for our client id (`aud`), by Google (`iss`), for a verified email, and has not
 * expired. The reference instead accepted an OAuth access token and only called userinfo, which does
 * not prove the token was issued to this app.
 */
@Component
public class GoogleTokenVerifier {

    private static final String TOKENINFO = "https://oauth2.googleapis.com/tokeninfo?id_token=";
    private static final Set<String> ISSUERS = Set.of("accounts.google.com", "https://accounts.google.com");

    public record GoogleIdentity(String email, String name) {
    }

    private final String clientId;
    private final ObjectMapper objectMapper;
    private final Clock clock;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

    public GoogleTokenVerifier(@Value("${tracex.google.client-id:}") String clientId, ObjectMapper objectMapper, Clock clock) {
        this.clientId = clientId == null ? "" : clientId.trim();
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    public boolean isConfigured() {
        return !clientId.isEmpty();
    }

    /** Empty when the token is missing, malformed, expired, not for this app, or the email is unverified. */
    public Optional<GoogleIdentity> verify(String idToken) {
        if (!isConfigured() || idToken == null || idToken.isBlank() || idToken.length() > 4096) {
            return Optional.empty();
        }
        try {
            HttpRequest req = HttpRequest.newBuilder(URI.create(TOKENINFO + URLEncoder.encode(idToken, StandardCharsets.UTF_8)))
                    .timeout(Duration.ofSeconds(10)).GET().build();
            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() != 200) return Optional.empty();
            return checkClaims(objectMapper.readTree(res.body()));
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    /** Claim checks, separate so tests can run them without the network. */
    public Optional<GoogleIdentity> checkClaims(JsonNode claims) {
        if (!clientId.equals(claims.path("aud").asText())) return Optional.empty();
        if (!ISSUERS.contains(claims.path("iss").asText())) return Optional.empty();
        if (!"true".equals(claims.path("email_verified").asText())) return Optional.empty();
        long exp = claims.path("exp").asLong(0);
        if (exp <= clock.instant().getEpochSecond()) return Optional.empty();
        String email = claims.path("email").asText("").trim().toLowerCase();
        if (email.isEmpty()) return Optional.empty();
        return Optional.of(new GoogleIdentity(email, claims.path("name").asText(null)));
    }
}
