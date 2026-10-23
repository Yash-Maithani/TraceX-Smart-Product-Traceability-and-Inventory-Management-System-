package com.tracex.service.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * NVIDIA NIM (fallback provider, reference `aiService.js`: OpenAI-compatible chat completions,
 * default model `meta/llama-3.1-70b-instruct`).
 */
@Component
@Order(2)
public class NvidiaProvider implements AiProvider {

    private static final String ENDPOINT = "https://integrate.api.nvidia.com/v1/chat/completions";

    private final String apiKey;
    private final String model;
    private final ObjectMapper objectMapper;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

    public NvidiaProvider(@Value("${tracex.ai.nvidia.api-key:}") String apiKey,
                          @Value("${tracex.ai.nvidia.model:meta/llama-3.1-70b-instruct}") String model,
                          ObjectMapper objectMapper) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.model = model;
        this.objectMapper = objectMapper;
    }

    @Override
    public String name() {
        return "nvidia";
    }

    @Override
    public boolean isConfigured() {
        return !apiKey.isEmpty();
    }

    @Override
    public String complete(String prompt) throws Exception {
        Map<String, Object> body = Map.of(
                "model", model,
                "messages", List.of(Map.of("role", "user", "content", prompt)),
                "temperature", 0.2,
                "max_tokens", 1024);
        HttpRequest req = HttpRequest.newBuilder(URI.create(ENDPOINT))
                .timeout(Duration.ofSeconds(45))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + apiKey)
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)))
                .build();
        HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() / 100 != 2) {
            throw new IllegalStateException("NVIDIA returned HTTP " + res.statusCode());
        }
        JsonNode text = objectMapper.readTree(res.body()).at("/choices/0/message/content");
        if (text.isMissingNode() || text.asText().isBlank()) {
            throw new IllegalStateException("NVIDIA returned no text");
        }
        return text.asText();
    }
}
