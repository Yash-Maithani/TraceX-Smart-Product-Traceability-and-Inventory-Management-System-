package com.tracex.config;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import java.time.Clock;
import java.time.ZoneId;
import org.springframework.beans.factory.annotation.Value;

import org.springframework.core.env.Environment;
import org.springframework.data.mongodb.config.EnableMongoAuditing;

import java.time.Clock;
import java.util.Arrays;

@Configuration
@EnableMongoAuditing
public class AppConfig {

    private static final Logger log = LoggerFactory.getLogger(AppConfig.class);

    private final Environment environment;

    @Value("${tracex.security.jwt-secret:}")
    private String jwtSecret;

    @Value("${tracex.security.trace-token-secret:}")
    private String traceTokenSecret;

    @Value("${tracex.security.frontend-url:}")
    private String frontendUrl;

    @Value("${tracex.security.public-trace-base-url:}")
    private String publicTraceBaseUrl;

    @Value("${tracex.seed.enabled:false}")
    private boolean seedEnabled;

    @Value("${tracex.seed.default-password:}")
    private String seedDefaultPassword;

    public AppConfig(Environment environment) {
        this.environment = environment;
    }

    /* Original clock removed */

    @PostConstruct
    public void validateConfiguration() {
        boolean isProd = Arrays.asList(environment.getActiveProfiles()).contains("prod");
        if (isProd) {
            if (jwtSecret == null || jwtSecret.trim().length() < 32) {
                String msg = "Missing or invalid JWT_SECRET. In production profile, JWT_SECRET must be at least 32 characters long.";
                log.error(msg);
                throw new IllegalStateException(msg);
            }
            if (traceTokenSecret == null || traceTokenSecret.trim().length() < 32) {
                String msg = "Missing or invalid TRACE_TOKEN_SECRET. In production profile, TRACE_TOKEN_SECRET must be at least 32 characters long.";
                log.error(msg);
                throw new IllegalStateException(msg);
            }
            if (frontendUrl == null || frontendUrl.trim().isEmpty()) {
                String msg = "Missing FRONTEND_URL. In production profile, FRONTEND_URL must be specified.";
                log.error(msg);
                throw new IllegalStateException(msg);
            }
            if (publicTraceBaseUrl == null || publicTraceBaseUrl.trim().isEmpty()) {
                String msg = "Missing PUBLIC_TRACE_BASE_URL. In production profile, PUBLIC_TRACE_BASE_URL must be specified.";
                log.error(msg);
                throw new IllegalStateException(msg);
            }
            if (isLocalOrPrivateAddress(publicTraceBaseUrl)) {
                String msg = "Invalid PUBLIC_TRACE_BASE_URL. In production profile, PUBLIC_TRACE_BASE_URL cannot point to localhost, loopback, or private address.";
                log.error(msg);
                throw new IllegalStateException(msg);
            }
            if (seedEnabled) {
                if (seedDefaultPassword == null || seedDefaultPassword.trim().length() < 12) {
                    String msg = "Missing or invalid SEED_DEFAULT_PASSWORD. In production profile with SEED_ENABLED=true, SEED_DEFAULT_PASSWORD must be at least 12 characters long.";
                    log.error(msg);
                    throw new IllegalStateException(msg);
                }
            }
        }
    }

    private boolean isLocalOrPrivateAddress(String urlStr) {
        if (urlStr == null || urlStr.trim().isEmpty()) {
            return false;
        }
        try {
            java.net.URI uri = java.net.URI.create(urlStr.trim());
            String host = uri.getHost();
            if (host == null) {
                host = urlStr.trim();
            }
            host = host.toLowerCase();
            if (host.equals("localhost") || host.equals("127.0.0.1") || host.equals("::1") || host.equals("[::1]")) {
                return true;
            }
            if (host.startsWith("10.") || host.startsWith("192.168.")) {
                return true;
            }
            if (host.matches("^172\\.(1[6-9]|2[0-9]|3[0-1])\\..*")) {
                return true;
            }
            try {
                java.net.InetAddress addr = java.net.InetAddress.getByName(host);
                if (addr.isLoopbackAddress() || addr.isSiteLocalAddress() || addr.isAnyLocalAddress()) {
                    return true;
                }
            } catch (Exception ignored) {
            }
            return false;
        } catch (Exception e) {
            return true;
        }
    }

    @Value("${tracex.business.timezone:Asia/Kolkata}")
    private String businessTimezone;

    @Bean
    public Clock clock() {
        return Clock.system(ZoneId.of(businessTimezone));
    }

}