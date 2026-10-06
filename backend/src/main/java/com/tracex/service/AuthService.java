package com.tracex.service;

import com.tracex.dto.LoginRequest;
import com.tracex.dto.LoginResponse;
import com.tracex.dto.UserSummaryDto;
import com.tracex.exception.ApiException;
import com.tracex.exception.ErrorCode;
import com.tracex.exception.RateLimitException;
import com.tracex.model.User;
import com.tracex.repository.UserRepository;
import com.tracex.security.JwtService;
import com.tracex.security.RateLimiter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Optional;

@Service
public class AuthService {

    private static final Duration LOGIN_WINDOW = Duration.ofMinutes(15);
    private static final String GENERIC_AUTH_ERROR = "Invalid username or password";

    @Value("${tracex.rate-limit.login:10}")
    private int maxLoginAttempts = 10;

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final RateLimiter rateLimiter;

    public AuthService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService,
                       RateLimiter rateLimiter) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.rateLimiter = rateLimiter;
    }

    public LoginResponse login(LoginRequest request, String clientIp) {
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

        if (!user.isActive()) {
            throw new ApiException(ErrorCode.AUTH_ACCOUNT_INACTIVE, "Your account has been deactivated. Contact your administrator.", HttpStatus.FORBIDDEN);
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new ApiException(ErrorCode.AUTH_INVALID_TOKEN, GENERIC_AUTH_ERROR, HttpStatus.UNAUTHORIZED);
        }

        String token = jwtService.generateToken(user.getId(), user.getTokenVersion());
        return new LoginResponse(token, UserSummaryDto.fromEntity(user));
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
