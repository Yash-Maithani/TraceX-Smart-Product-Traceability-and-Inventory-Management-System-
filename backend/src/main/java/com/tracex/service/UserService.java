package com.tracex.service;

import com.tracex.dto.*;
import com.tracex.exception.ApiException;
import com.tracex.exception.ErrorCode;
import com.tracex.exception.RateLimitException;
import com.tracex.exception.ValidationException;
import com.tracex.model.AccessRequest;
import com.tracex.model.AccessRequestStatus;
import com.tracex.model.Role;
import com.tracex.model.User;
import com.tracex.repository.AccessRequestRepository;
import com.tracex.repository.LoginEventRepository;
import com.tracex.repository.UserRepository;
import com.tracex.security.JwtService;
import com.tracex.security.RateLimiter;
import com.tracex.util.HashUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class UserService {

    private static final Logger log = LoggerFactory.getLogger(UserService.class);

    @Value("${tracex.rate-limit.forgot-password:5}")
    private int MAX_FORGOT_PASSWORD_ATTEMPTS = 5;
    @Value("${tracex.rate-limit.resend-otp:5}")
    private int MAX_OTP_RESEND_ATTEMPTS = 5;
    private static final Duration RATE_LIMIT_WINDOW = Duration.ofMinutes(15);
    private static final Duration OTP_EXPIRY = Duration.ofMinutes(10);
    private static final Duration RESET_TOKEN_EXPIRY = Duration.ofMinutes(5);
    private static final int MAX_OTP_ATTEMPTS = 5;
    private static final Duration OTP_LOCKOUT = Duration.ofMinutes(15);
    static final String OTP_PURPOSE_ACTIVATION = "ACTIVATION";
    static final String OTP_PURPOSE_PASSWORD_RESET = "PASSWORD_RESET";

    @Value("${tracex.rate-limit.verify-otp:20}")
    private int maxOtpVerifyPerIp = 20;

    private final UserRepository userRepository;
    private final AccessRequestRepository accessRequestRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final EmailService emailService;
    private final AuditService auditService;
    private final RateLimiter rateLimiter;
    private final Clock clock;
    private final MongoTemplate mongoTemplate;
    private final LoginEventRepository loginEventRepository;

    public UserService(UserRepository userRepository,
                       AccessRequestRepository accessRequestRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService,
                       EmailService emailService,
                       AuditService auditService,
                       RateLimiter rateLimiter,
                       Clock clock,
                       MongoTemplate mongoTemplate,
                       LoginEventRepository loginEventRepository) {
        this.userRepository = userRepository;
        this.accessRequestRepository = accessRequestRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.emailService = emailService;
        this.auditService = auditService;
        this.rateLimiter = rateLimiter;
        this.clock = clock;
        this.mongoTemplate = mongoTemplate;
        this.loginEventRepository = loginEventRepository;
    }

    private void clearOtp(User user) {
        user.setOtpCode(null);
        user.setOtpExpiry(null);
        user.setOtpPurpose(null);
        user.setOtpAttempts(0);
        user.setOtpLockedUntil(null);
    }

    /**
     * Atomically reserves one OTP guess for this account before the code is compared, so parallel
     * guesses cannot all be counted as attempt 1. Throws once MAX_OTP_ATTEMPTS guesses have been used.
     * The counter only clears after a successful verification or once OTP_LOCKOUT has passed;
     * requesting a new code does not clear it.
     */
    private void reserveOtpAttempt(User user) {
        Instant now = clock.instant();
        if (user.getOtpLockedUntil() != null && !user.getOtpLockedUntil().isAfter(now)) {
            mongoTemplate.updateFirst(
                    Query.query(Criteria.where("_id").is(user.getId()).and("otpLockedUntil").is(user.getOtpLockedUntil())),
                    new Update().set("otpAttempts", 0).unset("otpLockedUntil"),
                    User.class);
        }
        User after = mongoTemplate.findAndModify(
                Query.query(Criteria.where("_id").is(user.getId()).and("otpAttempts").lt(MAX_OTP_ATTEMPTS)),
                new Update().inc("otpAttempts", 1).set("updatedAt", now),
                FindAndModifyOptions.options().returnNew(true),
                User.class);
        if (after == null) {
            throw new ApiException(ErrorCode.AUTH_ACCOUNT_INACTIVE,
                    "Too many failed attempts. Try again in 15 minutes or contact support.", HttpStatus.FORBIDDEN);
        }
        if (after.getOtpAttempts() >= MAX_OTP_ATTEMPTS) {
            mongoTemplate.updateFirst(
                    Query.query(Criteria.where("_id").is(user.getId()).and("otpLockedUntil").exists(false)),
                    new Update().set("otpLockedUntil", now.plus(OTP_LOCKOUT)),
                    User.class);
        }
    }

    private void checkOtpVerifyRateLimit(String clientIp) {
        String key = "otp-verify:" + (clientIp != null ? clientIp : "unknown");
        if (!rateLimiter.allowRequest(key, maxOtpVerifyPerIp, RATE_LIMIT_WINDOW)) {
            throw new RateLimitException("Too many verification attempts. Please try again later.");
        }
    }

    private AccessRequest findAccessRequestByInviteTokenOrFailClosed(String tokenHash) {
        try {
            return accessRequestRepository.findByInviteToken(tokenHash)
                    .orElseThrow(() -> new ApiException(ErrorCode.AUTH_INVALID_TOKEN, "Invalid or expired invitation token", HttpStatus.BAD_REQUEST));
        } catch (org.springframework.core.convert.ConversionException | java.time.format.DateTimeParseException ex) {
            log.warn("Corrupted date field on AccessRequest encountered during invite lookup; failing closed: {}", ex.getMessage());
            throw new ApiException(ErrorCode.AUTH_INVALID_TOKEN, "Invalid or expired invitation token", HttpStatus.UNAUTHORIZED);
        }
    }

    private User findUserByEmailOrFailClosed(String email, String invalidMessage) {
        try {
            return userRepository.findByEmailIgnoreCase(email)
                    .orElseThrow(() -> new ApiException(ErrorCode.AUTH_INVALID_TOKEN, invalidMessage, HttpStatus.BAD_REQUEST));
        } catch (org.springframework.core.convert.ConversionException | java.time.format.DateTimeParseException ex) {
            log.warn("Corrupted date field on User encountered during auth lookup; failing closed: {}", ex.getMessage());
            throw new ApiException(ErrorCode.AUTH_INVALID_TOKEN, invalidMessage, HttpStatus.UNAUTHORIZED);
        }
    }

    public Map<String, Object> activateAccount(ActivateAccountDto dto) {
        if (dto.getPassword() == null || dto.getPassword().length() < 8) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Password must be at least 8 characters long", HttpStatus.UNPROCESSABLE_ENTITY);
        }

        String tokenHash = HashUtil.sha256(dto.getToken());
        AccessRequest request = findAccessRequestByInviteTokenOrFailClosed(tokenHash);

        if (request.getStatus() != AccessRequestStatus.APPROVED) {
            throw new ApiException(ErrorCode.AUTH_INVALID_TOKEN, "Invalid or expired invitation token", HttpStatus.BAD_REQUEST);
        }

        if (request.isInviteUsed()) {
            throw new ApiException(ErrorCode.AUTH_INVALID_TOKEN, "Invitation token has already been used", HttpStatus.BAD_REQUEST);
        }

        if (request.getInviteExpiry() == null || request.getInviteExpiry().isBefore(clock.instant())) {
            throw new ApiException(ErrorCode.AUTH_INVALID_TOKEN, "Invitation token has expired", HttpStatus.BAD_REQUEST);
        }

        // M2 (Phase 13): an existing account with this email blocks a second one
        if (request.getEmail() != null && userRepository.findByEmailIgnoreCase(request.getEmail().trim()).isPresent()) {
            throw new ApiException(ErrorCode.CONFLICT, "An account with this email already exists", HttpStatus.CONFLICT);
        }

        // M2 (Phase 13): claim the invitation atomically, so two activations sent at once cannot both
        // create an account from the same link
        Query claimInvite = new Query(new Criteria().andOperator(
                Criteria.where("_id").is(request.getId()),
                Criteria.where("inviteToken").is(tokenHash),
                Criteria.where("inviteUsed").ne(true)));
        Update markUsed = new Update().set("inviteUsed", true).set("updatedAt", clock.instant());
        if (mongoTemplate.updateFirst(claimInvite, markUsed, AccessRequest.class).getModifiedCount() == 0) {
            throw new ApiException(ErrorCode.AUTH_INVALID_TOKEN, "Invitation token has already been used", HttpStatus.BAD_REQUEST);
        }

        // Derive username per reference auth.controller.js lines 320-326
        String[] nameParts = request.getName().trim().split("\\s+");
        String baseUsername = nameParts[0].toLowerCase().replaceAll("[^a-z0-9]", "");
        if (baseUsername.isBlank()) {
            baseUsername = "user";
        }
        String derivedUsername = baseUsername;
        int count = 1;
        while (userRepository.findByUsername(derivedUsername).isPresent()) {
            derivedUsername = baseUsername + (count++);
        }

        // Generate 6-digit OTP
        String rawOtp = HashUtil.generateOtp(6);
        String hashedOtp = HashUtil.sha256(rawOtp);

        User user = new User(
                derivedUsername,
                passwordEncoder.encode(dto.getPassword()),
                request.getName(),
                request.getEmail(),
                request.getRole(),
                false
        );
        user.setActive(false); // Inactive until OTP verification
        user.setEmailVerified(false);
        user.setOtpCode(hashedOtp);
        user.setOtpExpiry(clock.instant().plus(OTP_EXPIRY));
        user.setOtpPurpose(OTP_PURPOSE_ACTIVATION);
        user.setOtpAttempts(0);
        user.setCreatedAt(clock.instant());
        user.setUpdatedAt(clock.instant());

        User savedUser;
        try {
            savedUser = userRepository.save(user);
        } catch (RuntimeException e) {
            // Give the invitation back if the account could not be created (e.g. the email index refused it)
            mongoTemplate.updateFirst(new Query(Criteria.where("_id").is(request.getId())),
                    new Update().set("inviteUsed", false), AccessRequest.class);
            throw e;
        }

        // Email OTP
        emailService.sendActivationOtpEmail(savedUser.getEmail(), savedUser.getName(), rawOtp);

        auditService.record(savedUser, "USER_ACTIVATED_PENDING_OTP", "USER", savedUser.getId(),
                "User account registered with username " + derivedUsername + "; activation OTP dispatched");

        return Map.of(
                "message", "Verification code sent to your email",
                "email", savedUser.getEmail(),
                "username", savedUser.getUsername()
        );
    }

    public LoginResponse verifyOtp(VerifyOtpDto dto, String clientIp) {
        checkOtpVerifyRateLimit(clientIp);
        String email = dto.getEmail().toLowerCase().trim();
        User user = findUserByEmailOrFailClosed(email, "Invalid verification request");

        if (user.isDeleted()) {
            throw new ApiException(ErrorCode.AUTH_ACCOUNT_DELETED, "Account not found", HttpStatus.UNAUTHORIZED);
        }

        // Only a pending activation can be verified here. A password-reset code, or any code for an
        // account that is already verified (including one an admin deactivated), is rejected.
        if (user.isEmailVerified() || !OTP_PURPOSE_ACTIVATION.equals(user.getOtpPurpose())) {
            throw new ApiException(ErrorCode.AUTH_INVALID_TOKEN, "Invalid verification request", HttpStatus.BAD_REQUEST);
        }

        reserveOtpAttempt(user);

        if (user.getOtpExpiry() == null || user.getOtpExpiry().isBefore(clock.instant())) {
            throw new ApiException(ErrorCode.AUTH_INVALID_TOKEN, "Verification code has expired", HttpStatus.BAD_REQUEST);
        }

        String inputHash = HashUtil.sha256(dto.getOtp());
        if (!inputHash.equals(user.getOtpCode())) {
            throw new ApiException(ErrorCode.AUTH_INVALID_TOKEN, "Invalid verification code", HttpStatus.BAD_REQUEST);
        }

        // Success: activate account (re-read so the reserved attempt is not overwritten by a stale copy)
        user = userRepository.findById(user.getId()).orElseThrow();
        user.setActive(true);
        user.setEmailVerified(true);
        clearOtp(user);
        user.setUpdatedAt(clock.instant());
        User activated = userRepository.save(user);

        String token = jwtService.generateToken(activated.getId(), activated.getTokenVersion());

        auditService.record(activated, "USER_OTP_VERIFIED", "USER", activated.getId(),
                "Account verified and activated successfully for " + activated.getUsername());

        return new LoginResponse(token, UserSummaryDto.fromEntity(activated));
    }

    public void resendOtp(ResendOtpDto dto, String clientIp) {
        String rateLimitKey = "otp-resend:" + (clientIp != null ? clientIp : "unknown");
        if (!rateLimiter.allowRequest(rateLimitKey, MAX_OTP_RESEND_ATTEMPTS, RATE_LIMIT_WINDOW)) {
            throw new RateLimitException("Too many verification code requests. Please try again later.");
        }

        String email = dto.getEmail().toLowerCase().trim();
        Optional<User> userOpt = userRepository.findByEmailIgnoreCase(email);

        if (userOpt.isPresent()) {
            User user = userOpt.get();
            if (!user.isDeleted() && !user.isEmailVerified()) {
                String rawOtp = HashUtil.generateOtp(6);
                user.setOtpCode(HashUtil.sha256(rawOtp));
                user.setOtpExpiry(clock.instant().plus(OTP_EXPIRY));
                user.setOtpPurpose(OTP_PURPOSE_ACTIVATION);
                // otpAttempts is deliberately not reset: a new code must not grant new guesses
                user.setUpdatedAt(clock.instant());
                userRepository.save(user);

                emailService.sendActivationOtpEmail(user.getEmail(), user.getName(), rawOtp);
            }
        }
    }

    public void forgotPassword(ForgotPasswordDto dto, String clientIp) {
        String rateLimitKey = "forgot-password:" + (clientIp != null ? clientIp : "unknown");
        if (!rateLimiter.allowRequest(rateLimitKey, MAX_FORGOT_PASSWORD_ATTEMPTS, RATE_LIMIT_WINDOW)) {
            throw new RateLimitException("Too many password reset requests. Please try again later.");
        }

        String email = dto.getEmail().toLowerCase().trim();
        Optional<User> userOpt = userRepository.findByEmailIgnoreCase(email);

        if (userOpt.isPresent() && !userOpt.get().isDeleted() && userOpt.get().isActive()) {
            User user = userOpt.get();
            String rawOtp = HashUtil.generateOtp(6);
            user.setOtpCode(HashUtil.sha256(rawOtp));
            user.setOtpExpiry(clock.instant().plus(OTP_EXPIRY));
            user.setOtpPurpose(OTP_PURPOSE_PASSWORD_RESET);
            // otpAttempts is deliberately not reset: a new code must not grant new guesses
            user.setUpdatedAt(clock.instant());
            userRepository.save(user);

            emailService.sendPasswordResetOtpEmail(user.getEmail(), user.getName(), rawOtp);
            auditService.record(user, "PASSWORD_RESET_REQUESTED", "USER", user.getId(),
                    "Password reset OTP requested for " + user.getUsername());
        } else {
            // Anti-enumeration timing defense: perform dummy bcrypt hash work
            passwordEncoder.matches("dummy", "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy");
        }
    }

    public Map<String, String> verifyResetOtp(VerifyResetOtpDto dto, String clientIp) {
        checkOtpVerifyRateLimit(clientIp);
        String email = dto.getEmail().toLowerCase().trim();
        User user = findUserByEmailOrFailClosed(email, "Invalid password reset request");

        if (user.isDeleted() || !user.isActive() || !OTP_PURPOSE_PASSWORD_RESET.equals(user.getOtpPurpose())) {
            throw new ApiException(ErrorCode.AUTH_INVALID_TOKEN, "Invalid password reset request", HttpStatus.BAD_REQUEST);
        }

        reserveOtpAttempt(user);

        if (user.getOtpExpiry() == null || user.getOtpExpiry().isBefore(clock.instant())) {
            throw new ApiException(ErrorCode.AUTH_INVALID_TOKEN, "Verification code has expired", HttpStatus.BAD_REQUEST);
        }

        String inputHash = HashUtil.sha256(dto.getOtp());
        if (!inputHash.equals(user.getOtpCode())) {
            throw new ApiException(ErrorCode.AUTH_INVALID_TOKEN, "Invalid verification code", HttpStatus.BAD_REQUEST);
        }

        // Issue reset token (32 random bytes); re-read so the reserved attempt is not overwritten
        user = userRepository.findById(user.getId()).orElseThrow();
        String rawResetToken = HashUtil.generateRandomHexToken(32);
        user.setResetToken(HashUtil.sha256(rawResetToken));
        user.setResetTokenExpiry(clock.instant().plus(RESET_TOKEN_EXPIRY));
        clearOtp(user);
        user.setUpdatedAt(clock.instant());
        userRepository.save(user);

        return Map.of("resetToken", rawResetToken);
    }

    public void resetPassword(ResetPasswordDto dto) {
        if (dto.getNewPassword() == null || dto.getNewPassword().length() < 8) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Password must be at least 8 characters long", HttpStatus.UNPROCESSABLE_ENTITY);
        }

        String email = dto.getEmail().toLowerCase().trim();
        User user = findUserByEmailOrFailClosed(email, "Invalid password reset request");

        if (user.isDeleted() || !user.isActive()) {
            throw new ApiException(ErrorCode.AUTH_INVALID_TOKEN, "Invalid password reset request", HttpStatus.BAD_REQUEST);
        }

        String incomingTokenHash = HashUtil.sha256(dto.getResetToken());
        if (user.getResetToken() == null || !user.getResetToken().equals(incomingTokenHash)) {
            throw new ApiException(ErrorCode.AUTH_INVALID_TOKEN, "Invalid or expired reset token", HttpStatus.BAD_REQUEST);
        }

        if (user.getResetTokenExpiry() == null || user.getResetTokenExpiry().isBefore(clock.instant())) {
            throw new ApiException(ErrorCode.AUTH_INVALID_TOKEN, "Reset token has expired", HttpStatus.BAD_REQUEST);
        }

        user.setPasswordHash(passwordEncoder.encode(dto.getNewPassword()));
        user.setResetToken(null);
        user.setResetTokenExpiry(null);
        user.setTokenVersion(user.getTokenVersion() + 1); // Session revocation on password reset!
        user.setUpdatedAt(clock.instant());
        userRepository.save(user);

        auditService.record(user, "PASSWORD_RESET_COMPLETED", "USER", user.getId(),
                "Password successfully reset for " + user.getUsername());
    }

    public UserSummaryDto updateProfile(User actor, UpdateProfileDto dto) {
        User user = userRepository.findById(actor.getId())
                .orElseThrow(() -> new ApiException(ErrorCode.AUTH_ACCOUNT_DELETED, "User not found", HttpStatus.UNAUTHORIZED));

        if (dto.getName() != null && !dto.getName().isBlank()) {
            user.setName(dto.getName().trim());
        }

        boolean emailChanged = false;
        if (dto.getEmail() != null && !dto.getEmail().isBlank()) {
            String newEmail = dto.getEmail().toLowerCase().trim();
            if (!newEmail.equalsIgnoreCase(user.getEmail())) {
                // A session token alone must not be able to redirect password resets to another inbox
                if (dto.getCurrentPassword() == null || !passwordEncoder.matches(dto.getCurrentPassword(), user.getPasswordHash())) {
                    throw new ValidationException("currentPassword", "Enter your current password to change your email");
                }
                if (userRepository.existsByEmailIgnoreCase(newEmail)) {
                    throw new ApiException(ErrorCode.CONFLICT, "Email already in use", HttpStatus.CONFLICT);
                }
                user.setEmail(newEmail);
                // Any outstanding code or reset token was sent to the old address
                clearOtp(user);
                user.setResetToken(null);
                user.setResetTokenExpiry(null);
                emailChanged = true;
            }
        }

        if (dto.getPhone() != null) {
            user.setPhone(dto.getPhone().trim());
        }

        // Explicitly: role and isSuperAdmin in dto or request are IGNORED
        user.setUpdatedAt(clock.instant());
        User saved = userRepository.save(user);

        auditService.record(saved, "PROFILE_UPDATED", "USER", saved.getId(),
                "Profile updated for " + saved.getUsername() + (emailChanged ? " (email changed)" : ""));

        return UserSummaryDto.fromEntity(saved);
    }

    /** Links the Google account behind a fresh ID token to the signed-in user (Phase 11). */
    public UserSummaryDto linkGoogle(User actor, String credential, com.tracex.security.GoogleTokenVerifier verifier) {
        if (!verifier.isConfigured()) {
            throw new ApiException(ErrorCode.GOOGLE_SIGN_IN_UNAVAILABLE, "Google sign-in is not available on this server.", HttpStatus.SERVICE_UNAVAILABLE);
        }
        com.tracex.security.GoogleTokenVerifier.GoogleIdentity identity = verifier.verify(credential)
                .orElseThrow(() -> new ApiException(ErrorCode.AUTH_INVALID_TOKEN, "Google sign-in failed. Please try again.", HttpStatus.UNAUTHORIZED));
        User user = userRepository.findById(actor.getId())
                .orElseThrow(() -> new ApiException(ErrorCode.AUTH_ACCOUNT_DELETED, "User not found", HttpStatus.UNAUTHORIZED));

        // One Google identity, one account: otherwise Google sign-in could land in the wrong account
        userRepository.findByGoogleEmail(identity.email())
                .filter(other -> !other.getId().equals(user.getId()))
                .ifPresent(other -> {
                    throw new ApiException(ErrorCode.CONFLICT, "That Google account is already linked to another TraceX account.", HttpStatus.CONFLICT);
                });
        if (identity.email().equals(user.getGoogleEmail())) {
            return UserSummaryDto.fromEntity(user);
        }
        user.setGoogleEmail(identity.email());
        user.setGoogleLinkedAt(clock.instant());
        user.setUpdatedAt(clock.instant());
        User saved = userRepository.save(user);
        auditService.record(saved, "GOOGLE_LINKED", "USER", saved.getId(), "Google account linked for " + saved.getUsername());
        return UserSummaryDto.fromEntity(saved);
    }

    public UserSummaryDto unlinkGoogle(User actor) {
        User user = userRepository.findById(actor.getId())
                .orElseThrow(() -> new ApiException(ErrorCode.AUTH_ACCOUNT_DELETED, "User not found", HttpStatus.UNAUTHORIZED));
        if (user.getGoogleEmail() == null) {
            return UserSummaryDto.fromEntity(user);
        }
        user.setGoogleEmail(null);
        user.setGoogleLinkedAt(null);
        user.setUpdatedAt(clock.instant());
        User saved = userRepository.save(user);
        auditService.record(saved, "GOOGLE_UNLINKED", "USER", saved.getId(), "Google account unlinked for " + saved.getUsername());
        return UserSummaryDto.fromEntity(saved);
    }

    public UserSummaryDto updateSettings(User actor, UpdateSettingsDto dto) {
        User user = userRepository.findById(actor.getId())
                .orElseThrow(() -> new ApiException(ErrorCode.AUTH_ACCOUNT_DELETED, "User not found", HttpStatus.UNAUTHORIZED));

        User.Preferences prefs = user.getPreferences() != null ? user.getPreferences() : new User.Preferences();
        if (dto.getMode() != null) prefs.setMode(dto.getMode());
        if (dto.getPalette() != null) prefs.setPalette(dto.getPalette());
        if (dto.getAccent() != null) prefs.setAccent(dto.getAccent());
        if (dto.getShowPageImages() != null) prefs.setShowPageImages(dto.getShowPageImages());
        user.setPreferences(prefs);
        user.setUpdatedAt(clock.instant());
        // Display settings only: no audit entry, as with the local-only preferences before Phase 9
        return UserSummaryDto.fromEntity(userRepository.save(user));
    }

    /** The caller's own sign-ins from the last 30 days, newest first, at most 50. */
    public List<LoginEventDto> getLoginHistory(User actor) {
        Instant since = clock.instant().minusSeconds(com.tracex.model.LoginEvent.TTL_SECONDS);
        return loginEventRepository.findTop50ByUserIdAndCreatedAtAfterOrderByCreatedAtDesc(actor.getId(), since)
                .stream()
                .map(LoginEventDto::fromEntity)
                .toList();
    }

    public LoginResponse changePassword(User actor, ChangePasswordDto dto) {
        if (dto.getNewPassword() == null || dto.getNewPassword().length() < 8) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "New password must be at least 8 characters long", HttpStatus.UNPROCESSABLE_ENTITY);
        }

        User user = userRepository.findById(actor.getId())
                .orElseThrow(() -> new ApiException(ErrorCode.AUTH_ACCOUNT_DELETED, "User not found", HttpStatus.UNAUTHORIZED));

        if (!passwordEncoder.matches(dto.getCurrentPassword(), user.getPasswordHash())) {
            throw new ApiException(ErrorCode.AUTH_INVALID_TOKEN, "Current password does not match", HttpStatus.BAD_REQUEST);
        }

        user.setPasswordHash(passwordEncoder.encode(dto.getNewPassword()));
        user.setTokenVersion(user.getTokenVersion() + 1); // Revoke existing sessions!
        user.setUpdatedAt(clock.instant());
        User saved = userRepository.save(user);

        // Issue fresh token so caller stays signed in
        String freshToken = jwtService.generateToken(saved.getId(), saved.getTokenVersion());

        auditService.record(saved, "PASSWORD_CHANGED", "USER", saved.getId(),
                "Password changed for user " + saved.getUsername());

        return new LoginResponse(freshToken, UserSummaryDto.fromEntity(saved));
    }

    public List<UserSummaryDto> getDirectory() {
        return userRepository.findAllByIsActiveTrueAndIsDeletedFalse()
                .stream()
                .map(UserSummaryDto::fromEntity)
                .toList();
    }

    public List<UserSummaryDto> getUsers() {
        return userRepository.findAllByIsDeletedFalse()
                .stream()
                .map(UserSummaryDto::fromEntity)
                .toList();
    }

    public List<UserSummaryDto> getDeletedUsers() {
        return userRepository.findAllByIsDeletedTrue()
                .stream()
                .map(UserSummaryDto::fromEntity)
                .toList();
    }

    public UserSummaryDto toggleUserStatus(String targetId, User actor) {
        if (actor.getId().equals(targetId)) {
            if (actor.isSuperAdmin() && actor.isActive() && userRepository.countByIsSuperAdminTrueAndIsActiveTrueAndIsDeletedFalse() <= 1) {
                throw new ApiException(ErrorCode.LAST_SUPERADMIN, "Cannot deactivate the last active super administrator", HttpStatus.CONFLICT);
            }
            throw new ApiException(ErrorCode.SELF_MODIFICATION_NOT_ALLOWED, "Cannot modify your own active status", HttpStatus.CONFLICT);
        }

        User target = userRepository.findById(targetId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "User not found", HttpStatus.NOT_FOUND));

        // Super-admin immutability & secondary admin restriction (auth.controller.js lines 524-534)
        if (!actor.isSuperAdmin() && (target.isSuperAdmin() || target.getRole() == Role.ADMIN)) {
            throw new ApiException(ErrorCode.RBAC_INSUFFICIENT, "Only a Super Admin can modify Administrator accounts", HttpStatus.FORBIDDEN);
        }

        // Last super-admin guard
        if (target.isSuperAdmin() && target.isActive()) {
            long activeSuperAdmins = userRepository.countByIsSuperAdminTrueAndIsActiveTrueAndIsDeletedFalse();
            if (activeSuperAdmins <= 1) {
                throw new ApiException(ErrorCode.LAST_SUPERADMIN, "Cannot deactivate the last active super administrator", HttpStatus.CONFLICT);
            }
        }

        target.setActive(!target.isActive());
        if (!target.isActive()) {
            target.setTokenVersion(target.getTokenVersion() + 1); // Revoke sessions on deactivation!
            // Outstanding OTPs and reset tokens must not survive deactivation
            clearOtp(target);
            target.setResetToken(null);
            target.setResetTokenExpiry(null);
        }
        target.setUpdatedAt(clock.instant());
        User saved = userRepository.save(target);

        auditService.record(actor, "USER_STATUS_TOGGLED", "USER", saved.getId(),
                "User " + saved.getUsername() + " status toggled to active=" + saved.isActive());

        return UserSummaryDto.fromEntity(saved);
    }

    public UserSummaryDto updateUserRole(String targetId, UpdateRoleDto dto, User actor) {
        if (actor.getId().equals(targetId)) {
            throw new ApiException(ErrorCode.SELF_MODIFICATION_NOT_ALLOWED, "Cannot modify your own role", HttpStatus.CONFLICT);
        }

        User target = userRepository.findById(targetId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "User not found", HttpStatus.NOT_FOUND));

        // Secondary admin restriction (auth.controller.js lines 948-965)
        if (!actor.isSuperAdmin()) {
            if (target.isSuperAdmin() || target.getRole() == Role.ADMIN || dto.getRole() == Role.ADMIN) {
                throw new ApiException(ErrorCode.RBAC_INSUFFICIENT, "Only a Super Admin can grant or modify Administrator privileges", HttpStatus.FORBIDDEN);
            }
        }

        if (target.isSuperAdmin()) {
            throw new ApiException(ErrorCode.LAST_SUPERADMIN, "Super administrator role cannot be modified", HttpStatus.CONFLICT);
        }

        Role previousRole = target.getRole();
        target.setPreviousRole(previousRole);
        target.setRole(dto.getRole());
        target.setPromotedBy(actor.getUsername());
        target.setPromotedAt(clock.instant());
        target.setTokenVersion(target.getTokenVersion() + 1); // Role change takes immediate effect!
        target.setUpdatedAt(clock.instant());
        User saved = userRepository.save(target);

        auditService.record(actor, "USER_ROLE_CHANGED", "USER", saved.getId(),
                "User " + saved.getUsername() + " role changed from " + previousRole + " to " + dto.getRole());

        return UserSummaryDto.fromEntity(saved);
    }

    public void deleteUser(String targetId, String deleteNote, User actor) {
        if (actor.getId().equals(targetId)) {
            if (actor.isSuperAdmin() && userRepository.countByIsSuperAdminTrueAndIsActiveTrueAndIsDeletedFalse() <= 1) {
                throw new ApiException(ErrorCode.LAST_SUPERADMIN, "Cannot delete the last active super administrator", HttpStatus.CONFLICT);
            }
            throw new ApiException(ErrorCode.SELF_MODIFICATION_NOT_ALLOWED, "Cannot delete your own account", HttpStatus.CONFLICT);
        }

        User target = userRepository.findById(targetId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "User not found", HttpStatus.NOT_FOUND));

        if (!actor.isSuperAdmin() && (target.isSuperAdmin() || target.getRole() == Role.ADMIN)) {
            throw new ApiException(ErrorCode.RBAC_INSUFFICIENT, "Only a Super Admin can delete Administrator accounts", HttpStatus.FORBIDDEN);
        }

        if (target.isSuperAdmin()) {
            throw new ApiException(ErrorCode.LAST_SUPERADMIN, "Super administrator accounts cannot be deleted", HttpStatus.CONFLICT);
        }

        target.setDeleted(true);
        target.setDeletedBy(actor.getUsername());
        target.setDeletedAt(clock.instant());
        target.setDeleteNote(deleteNote);
        target.setTokenVersion(target.getTokenVersion() + 1); // Revoke sessions on delete!
        target.setUpdatedAt(clock.instant());
        userRepository.save(target);

        auditService.record(actor, "USER_DELETED", "USER", target.getId(),
                "User " + target.getUsername() + " soft-deleted" + (deleteNote != null ? ": " + deleteNote : ""));
    }

    public UserSummaryDto restoreUser(String targetId, User actor) {
        User target = userRepository.findById(targetId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "User not found", HttpStatus.NOT_FOUND));

        if (!target.isDeleted()) {
            throw new ApiException(ErrorCode.CONFLICT, "User is not deleted", HttpStatus.CONFLICT);
        }

        target.setDeleted(false);
        target.setDeletedBy(null);
        target.setDeletedAt(null);
        target.setDeleteNote(null);
        target.setTokenVersion(target.getTokenVersion() + 1);
        target.setUpdatedAt(clock.instant());
        User saved = userRepository.save(target);

        auditService.record(actor, "USER_RESTORED", "USER", saved.getId(),
                "User " + saved.getUsername() + " restored from recycle bin");

        return UserSummaryDto.fromEntity(saved);
    }
}
