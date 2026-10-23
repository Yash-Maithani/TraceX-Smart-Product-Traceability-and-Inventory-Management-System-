package com.tracex.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class RateLimiter {

    private final Clock clock;
    private final Map<String, Deque<Instant>> requestBuckets = new ConcurrentHashMap<>();
    /** Longest window any caller uses; buckets idle for longer than this are dropped (M5, Phase 13). */
    private static final Duration MAX_WINDOW = Duration.ofHours(1);
    private static final int SWEEP_EVERY = 1000;
    private int callsSinceSweep = 0;

    public RateLimiter(Clock clock) {
        this.clock = clock;
    }

    /**
     * Resolves the client IP for rate limiting using strictly the servlet remote address.
     * Client-supplied headers like X-Forwarded-For must NOT be read directly to prevent spoofing.
     * Forwarded headers are only honored by the servlet container when configured via
     * Spring's server.forward-headers-strategy (off in dev and test, set for the platform proxy in prod).
     */
    public String resolveClientIp(HttpServletRequest request) {
        if (request == null) {
            return "unknown";
        }
        String remoteAddr = request.getRemoteAddr();
        return (remoteAddr != null && !remoteAddr.isBlank()) ? remoteAddr : "unknown";
    }

    public synchronized boolean allowRequest(String key, int maxRequests, Duration window) {
        Instant now = clock.instant();
        Instant cutoff = now.minus(window);

        Deque<Instant> bucket = requestBuckets.computeIfAbsent(key, k -> new ArrayDeque<>());

        // Evict expired timestamps
        while (!bucket.isEmpty() && bucket.peekFirst().isBefore(cutoff)) {
            bucket.pollFirst();
        }

        if (bucket.size() >= maxRequests) {
            return false;
        }

        bucket.addLast(now);
        if (++callsSinceSweep >= SWEEP_EVERY) {
            callsSinceSweep = 0;
            sweep(now);
        }
        return true;
    }

    private void sweep(Instant now) {
        Instant idleCutoff = now.minus(MAX_WINDOW);
        requestBuckets.entrySet().removeIf(e -> e.getValue().isEmpty() || e.getValue().peekLast().isBefore(idleCutoff));
    }

    /** Number of keys currently tracked (tests and diagnostics). */
    public synchronized int trackedKeyCount() {
        return requestBuckets.size();
    }

    /** Runs the idle sweep now (tests). */
    public synchronized void sweepNow() {
        sweep(clock.instant());
    }

    public synchronized void reset(String key) {
        requestBuckets.remove(key);
    }

    public synchronized void resetAll() {
        requestBuckets.clear();
    }
}
