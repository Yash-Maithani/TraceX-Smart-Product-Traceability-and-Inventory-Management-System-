package com.tracex.service.ai;

/**
 * One large-language-model backend for the dispatch audit (Phase 11, S-01).
 * Implementations send the prompt and return the model's raw text; parsing is done by the caller.
 */
public interface AiProvider {

    /** Short id shown in the report, e.g. "gemini" or "nvidia". */
    String name();

    /** False when no API key is configured, so the provider is skipped without a network call. */
    boolean isConfigured();

    /** Sends the prompt and returns the model's text. Throws on any HTTP or network failure. */
    String complete(String prompt) throws Exception;
}
