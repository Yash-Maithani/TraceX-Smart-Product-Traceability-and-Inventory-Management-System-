package com.tracex.service.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Google Gemini (primary provider). The key goes in the `x-goog-api-key` header, never the URL, so it
 * cannot end up in access logs.
 *
 * Several models are tried in order (AI phase, real-key test on 2026-10-25): Google retires model names
 * for new keys (gemini-2.5-flash answered 404) and busy models answer 503, so a retired, busy or
 * rate-limited model hands over to the next one, and so does one that does not answer within 15 seconds.
 * Only the model name and HTTP status are logged.
 */
@Component
@Order(1)
public class GeminiProvider implements AiProvider {

    private static final Logger log = LoggerFactory.getLogger(GeminiProvider.class);
    private static final String ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent";
    /** Statuses that mean "this model cannot answer now", so the next model is tried. */
    private static final Set<Integer> TRY_NEXT = Set.of(404, 429, 500, 502, 503, 504);

    private final String apiKey;
    private final List<String> models;
    private final ObjectMapper objectMapper;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

    public GeminiProvider(@Value("${tracex.ai.gemini.api-key:}") String apiKey,
                          @Value("${tracex.ai.gemini.models:gemini-flash-lite-latest,gemini-3.5-flash,gemini-flash-latest}") String models,
                          ObjectMapper objectMapper) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.models = Arrays.stream(models.split(",")).map(String::trim).filter(m -> !m.isEmpty()).toList();
        this.objectMapper = objectMapper;
    }

    @Override
    public String name() {
        return "gemini";
    }

    @Override
    public boolean isConfigured() {
        return !apiKey.isEmpty() && !models.isEmpty();
    }

    @Override
    public String complete(String prompt) throws Exception {
        Map<String, Object> body = Map.of(
                "contents", List.of(Map.of("role", "user", "parts", List.of(Map.of("text", prompt)))),
                "generationConfig", Map.of("temperature", 0.2, "responseMimeType", "application/json"));
        String json = objectMapper.writeValueAsString(body);
        int lastStatus = 0;
        for (String model : models) {
            HttpRequest req = HttpRequest.newBuilder(URI.create(String.format(ENDPOINT, model)))
                    .timeout(Duration.ofSeconds(15))
                    .header("Content-Type", "application/json")
                    .header("x-goog-api-key", apiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(json))
                    .build();
            HttpResponse<String> res;
            try {
                res = http.send(req, HttpResponse.BodyHandlers.ofString());
            } catch (java.io.IOException e) {
                // A model that hangs (seen on 2026-10-25) or drops the connection: try the next one
                log.warn("Gemini model {} did not answer: exceptionClass={}", model, e.getClass().getName());
                continue;
            }
            lastStatus = res.statusCode();
            if (lastStatus / 100 == 2) {
                return firstText(objectMapper.readTree(res.body()));
            }
            log.warn("Gemini model {} answered HTTP {}", model, lastStatus);
            if (!TRY_NEXT.contains(lastStatus)) break; // 400 or 403: a bad request or key, another model will not help
        }
        throw new IllegalStateException("Gemini returned HTTP " + lastStatus);
    }

    /** The first non-empty text part; newer models can add a separate thinking part. */
    private static String firstText(JsonNode root) {
        for (JsonNode part : root.at("/candidates/0/content/parts")) {
            if (part.path("thought").asBoolean(false)) continue;
            String text = part.path("text").asText("");
            if (!text.isBlank()) return text;
        }
        throw new IllegalStateException("Gemini returned no text");
    }
}
