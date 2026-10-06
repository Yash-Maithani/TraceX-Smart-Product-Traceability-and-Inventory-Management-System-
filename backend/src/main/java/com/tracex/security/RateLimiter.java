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
        return true;
    }

    public synchronized void reset(String key) {
        requestBuckets.remove(key);
    }

    public synchronized void resetAll() {
        requestBuckets.clear();
    }
}
