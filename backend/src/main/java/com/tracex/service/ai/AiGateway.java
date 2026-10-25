package com.tracex.service.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tracex.exception.ApiException;
import com.tracex.exception.ErrorCode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.function.Function;

/**
 * One way into the language models for every AI feature (AI phase): tries the configured providers in
 * order (Gemini, then NVIDIA) and hands back the first answer that parses. Provider errors and raw model
 * text are never logged or returned, only the exception class.
 */
@Component
public class AiGateway {

    private static final Logger log = LoggerFactory.getLogger(AiGateway.class);

    private final List<AiProvider> providers;
    private final ObjectMapper objectMapper;

    public AiGateway(List<AiProvider> providers, ObjectMapper objectMapper) {
        this.providers = providers; // ordered by @Order: Gemini first, NVIDIA second
        this.objectMapper = objectMapper;
    }

    public boolean enabled() {
        return providers.stream().anyMatch(AiProvider::isConfigured);
    }

    public List<String> configuredProviders() {
        return providers.stream().filter(AiProvider::isConfigured).map(AiProvider::name).toList();
    }

    /** The model's answer as JSON and the provider that gave it. */
    public record Answer<T>(T value, String provider) {
    }

    /**
     * Sends the prompt and parses the JSON answer with {@code reader}. A provider whose answer does not
     * parse counts as failed and the next one is tried; when none works the caller gets 503 AI_UNAVAILABLE.
     */
    public <T> Answer<T> askJson(String prompt, Function<JsonNode, T> reader) {
        if (!enabled()) {
            throw new ApiException(ErrorCode.AI_UNAVAILABLE, "The AI features are not available on this server.", HttpStatus.SERVICE_UNAVAILABLE);
        }
        for (AiProvider provider : providers) {
            if (!provider.isConfigured()) continue;
            try {
                String raw = provider.complete(prompt);
                String cleaned = raw.replace("```json", "").replace("```", "").trim();
                T value = reader.apply(objectMapper.readTree(cleaned));
                return new Answer<>(value, provider.name());
            } catch (Exception e) {
                log.warn("AI provider {} failed: exceptionClass={}", provider.name(), e.getClass().getName());
            }
        }
        throw new ApiException(ErrorCode.AI_UNAVAILABLE, "The AI service is unavailable right now. Please try again later.",
                HttpStatus.SERVICE_UNAVAILABLE);
    }

    /** Trims and caps model text so a runaway answer cannot flood the page. */
    public static String cap(String s, int max) {
        if (s == null) return "";
        String t = s.trim();
        return t.length() <= max ? t : t.substring(0, max - 1) + "…";
    }
}
