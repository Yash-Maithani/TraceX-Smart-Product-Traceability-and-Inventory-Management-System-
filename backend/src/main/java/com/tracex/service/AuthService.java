package com.tracex.service;

import com.tracex.dto.LoginRequest;
import com.tracex.dto.LoginResponse;
import com.tracex.dto.UserSummaryDto;
import com.tracex.exception.ApiException;
import com.tracex.exception.ErrorCode;
import com.tracex.exception.RateLimitException;
import com.tracex.model.LoginEvent;
import com.tracex.model.User;
import com.tracex.repository.LoginEventRepository;
import com.tracex.repository.UserRepository;
import com.tracex.security.GoogleTokenVerifier;
import com.tracex.security.JwtService;
import com.tracex.security.RateLimiter;
import com.tracex.util.UserAgentParser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.util.Optional;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);
    private static final Duration LOGIN_WINDOW = Duration.ofMinutes(15);
    private static final String GENERIC_AUTH_ERROR = "Invalid username or password";

    @Value("${tracex.rate-limit.login:10}")
    private int maxLoginAttempts = 10;

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final RateLimiter rateLimiter;
    private final LoginEventRepository loginEventRepository;
    private final Clock clock;
    private final GoogleTokenVerifier googleTokenVerifier;

    public AuthService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService,
                       RateLimiter rateLimiter,
                       LoginEventRepository loginEventRepository,
                       Clock clock,
                       GoogleTokenVerifier googleTokenVerifier) {
        this.googleTokenVerifier = googleTokenVerifier;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.rateLimiter = rateLimiter;
        this.loginEventRepository = loginEventRepository;
        this.clock = clock;
    }

    public LoginResponse login(LoginRequest request, String clientIp) {
        return login(request, clientIp, null);
    }

    public LoginResponse login(LoginRequest request, String clientIp, String userAgent) {
        String rateLimitKey = "login:" + (clientIp != null ? clientIp : "unknown");
        if (!rateLimiter.allowRequest(rateLimitKey, maxLoginAttempts, LOGIN_WINDOW)) {
            throw new RateLimitException("Too many login attempts. Please try again later.");
        }

        String username = request.getUsername().toLowerCase().trim();
        Optional<User> userOpt = userRepository.findByUsername(username);

        // Unknown or deleted users receive identical response to wrong password
        if (userOpt.isEmpty() || userOpt.get().isDeleted()) {
            // Perform dummy verification to prevent timing attack
            passwordEncoder.matches("dummyPassword", "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy");
            throw new ApiException(ErrorCode.AUTH_INVALID_TOKEN, GENERIC_AUTH_ERROR, HttpStatus.UNAUTHORIZED);
        }

        User user = userOpt.get();

        // Password first: account status is only revealed to someone who already knows the password
        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new ApiException(ErrorCode.AUTH_INVALID_TOKEN, GENERIC_AUTH_ERROR, HttpStatus.UNAUTHORIZED);
        }

        if (!user.isActive()) {
            throw new ApiException(ErrorCode.AUTH_ACCOUNT_INACTIVE, "Your account has been deactivated. Contact your administrator.", HttpStatus.FORBIDDEN);
        }

        String token = jwtService.generateToken(user.getId(), user.getTokenVersion());
        recordLoginEvent(user, userAgent);
        return new LoginResponse(token, UserSummaryDto.fromEntity(user));
    }

    /**
     * Sign in with a Google ID token (Phase 11, S-07, reference `googleAuth.controller.js`).
     * Only accounts that linked this Google email while signed in can use it; nothing is created here.
     */
    public LoginResponse googleLogin(String credential, String clientIp, String userAgent) {
        String rateLimitKey = "login:" + (clientIp != null ? clientIp : "unknown");
        if (!rateLimiter.allowRequest(rateLimitKey, maxLoginAttempts, LOGIN_WINDOW)) {
            throw new RateLimitException("Too many login attempts. Please try again later.");
        }
        if (!googleTokenVerifier.isConfigured()) {
            throw new ApiException(ErrorCode.GOOGLE_SIGN_IN_UNAVAILABLE, "Google sign-in is not available on this server.", HttpStatus.SERVICE_UNAVAILABLE);
        }
        GoogleTokenVerifier.GoogleIdentity identity = googleTokenVerifier.verify(credential)
                .orElseThrow(() -> new ApiException(ErrorCode.AUTH_INVALID_TOKEN, "Google sign-in failed. Please try again.", HttpStatus.UNAUTHORIZED));

        Optional<User> userOpt = userRepository.findByGoogleEmail(identity.email());
        if (userOpt.isEmpty() || userOpt.get().isDeleted()) {
            throw new ApiException(ErrorCode.AUTH_GOOGLE_NOT_LINKED,
                    "No TraceX account is linked to this Google account. Sign in with your username and password, then link Google on the Profile page.",
                    HttpStatus.FORBIDDEN);
        }
        User user = userOpt.get();
        if (!user.isActive()) {
            throw new ApiException(ErrorCode.AUTH_ACCOUNT_INACTIVE, "Your account has been deactivated. Contact your administrator.", HttpStatus.FORBIDDEN);
        }
        String token = jwtService.generateToken(user.getId(), user.getTokenVersion());
        recordLoginEvent(user, userAgent, "google");
        return new LoginResponse(token, UserSummaryDto.fromEntity(user));
    }

    private void recordLoginEvent(User user, String userAgent) {
        recordLoginEvent(user, userAgent, "password");
    }

    private void recordLoginEvent(User user, String userAgent, String method) {
        try {
            loginEventRepository.save(new LoginEvent(
                    user.getId(),
                    user.getUsername(),
                    UserAgentParser.browser(userAgent),
                    UserAgentParser.os(userAgent),
                    UserAgentParser.deviceType(userAgent),
                    method,
                    clock.instant()));
        } catch (Exception ex) {
            // Login history is informational; failing to write it must not block sign-in
            log.warn("Failed to record login event: exceptionClass={}", ex.getClass().getName());
        }
    }

    public UserSummaryDto getCurrentUser(String userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(ErrorCode.AUTH_ACCOUNT_DELETED, "User not found", HttpStatus.UNAUTHORIZED));
        return UserSummaryDto.fromEntity(user);
    }

    public void logoutAll(String userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(ErrorCode.AUTH_ACCOUNT_DELETED, "User not found", HttpStatus.UNAUTHORIZED));
        user.setTokenVersion(user.getTokenVersion() + 1);
        userRepository.save(user);
    }
}
