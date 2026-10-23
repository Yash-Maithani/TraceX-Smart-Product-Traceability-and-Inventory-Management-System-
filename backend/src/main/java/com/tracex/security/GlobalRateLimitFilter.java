package com.tracex.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tracex.dto.ApiResponse;
import com.tracex.exception.ErrorCode;
import com.tracex.util.RequestIdContext;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;

/**
 * SPEC §7 "Global API: 500 / IP / 15 min" (M5, Phase 13). Runs before authentication so it also
 * covers anonymous traffic. The health check is exempt so monitoring never trips it.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class GlobalRateLimitFilter extends OncePerRequestFilter {

    private static final Duration WINDOW = Duration.ofMinutes(15);

    private final RateLimiter rateLimiter;
    private final ObjectMapper objectMapper;
    private final int maxPerWindow;

    public GlobalRateLimitFilter(RateLimiter rateLimiter, ObjectMapper objectMapper,
                                 @Value("${tracex.rate-limit.global:500}") int maxPerWindow) {
        this.rateLimiter = rateLimiter;
        this.objectMapper = objectMapper;
        this.maxPerWindow = maxPerWindow;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return !path.startsWith("/api/") || "OPTIONS".equalsIgnoreCase(request.getMethod());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String key = "global:" + rateLimiter.resolveClientIp(request);
        if (!rateLimiter.allowRequest(key, maxPerWindow, WINDOW)) {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding("UTF-8");
            response.setHeader("Retry-After", String.valueOf(WINDOW.toSeconds()));
            objectMapper.writeValue(response.getWriter(),
                    ApiResponse.error(ErrorCode.RATE_LIMITED, "Too many requests. Please try again later.", RequestIdContext.getOrCreate()));
            return;
        }
        chain.doFilter(request, response);
    }
}
