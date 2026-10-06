package com.tracex.service;

import com.tracex.dto.*;
import com.tracex.exception.ApiException;
import com.tracex.exception.ErrorCode;
import com.tracex.exception.RateLimitException;
import com.tracex.model.AccessRequest;
import com.tracex.model.Role;
import com.tracex.model.User;
import com.tracex.repository.AccessRequestRepository;
import com.tracex.repository.UserRepository;
import com.tracex.security.JwtService;
import com.tracex.security.RateLimiter;
import com.tracex.util.HashUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
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

    private final UserRepository userRepository;
    private final AccessRequestRepository accessRequestRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final EmailService emailService;
    private final AuditService auditService;
    private final RateLimiter rateLimiter;
    private final Clock clock;

    public UserService(UserRepository userRepository,
                       AccessRequestRepository accessRequestRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService,
                       EmailService emailService,
                       AuditService auditService,
                       RateLimiter rateLimiter,
                       Clock clock) {
        this.userRepository = userRepository;
        this.accessRequestRepository = accessRequestRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.emailService = emailService;
        this.auditService = auditService;
        this.rateLimiter = rateLimiter;
        this.clock = clock;
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

        if (request.isInviteUsed()) {
            throw new ApiException(ErrorCode.AUTH_INVALID_TOKEN, "Invitation token has already been used", HttpStatus.BAD_REQUEST);
        }

        if (request.getInviteExpiry() == null || request.getInviteExpiry().isBefore(clock.instant())) {
            throw new ApiException(ErrorCode.AUTH_INVALID_TOKEN, "Invitation token has expired", HttpStatus.BAD_REQUEST);
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
        user.setOtpAttempts(0);
        user.setCreatedAt(clock.instant());
        user.setUpdatedAt(clock.instant());

        User savedUser = userRepository.save(user);

        // Mark invite used
        request.setInviteUsed(true);
        request.setUpdatedAt(clock.instant());
        accessRequestRepository.save(request);

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

    public LoginResponse verifyOtp(VerifyOtpDto dto) {
        String email = dto.getEmail().toLowerCase().trim();
        User user = findUserByEmailOrFailClosed(email, "Invalid verification request");

        if (user.isDeleted()) {
            throw new ApiException(ErrorCode.AUTH_ACCOUNT_DELETED, "Account not found", HttpStatus.UNAUTHORIZED);
        }

        if (user.getOtpAttempts() >= MAX_OTP_ATTEMPTS) {
            throw new ApiException(ErrorCode.AUTH_ACCOUNT_INACTIVE, "Too many failed attempts. Account locked. Contact support.", HttpStatus.FORBIDDEN);
        }

        if (user.getOtpExpiry() == null || user.getOtpExpiry().isBefore(clock.instant())) {
            throw new ApiException(ErrorCode.AUTH_INVALID_TOKEN, "Verification code has expired", HttpStatus.BAD_REQUEST);
        }

        String inputHash = HashUtil.sha256(dto.getOtp());
        if (!inputHash.equals(user.getOtpCode())) {
            user.setOtpAttempts(user.getOtpAttempts() + 1);
            user.setUpdatedAt(clock.instant());
            userRepository.save(user);
            throw new ApiException(ErrorCode.AUTH_INVALID_TOKEN, "Invalid verification code", HttpStatus.BAD_REQUEST);
        }

        // Success: activate account
        user.setActive(true);
        user.setEmailVerified(true);
        user.setOtpCode(null);
        user.setOtpExpiry(null);
        user.setOtpAttempts(0);
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
                user.setOtpAttempts(0);
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
            user.setOtpAttempts(0);
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

    public Map<String, String> verifyResetOtp(VerifyResetOtpDto dto) {
        String email = dto.getEmail().toLowerCase().trim();
        User user = findUserByEmailOrFailClosed(email, "Invalid password reset request");

        if (user.isDeleted() || !user.isActive()) {
            throw new ApiException(ErrorCode.AUTH_INVALID_TOKEN, "Invalid password reset request", HttpStatus.BAD_REQUEST);
        }

        if (user.getOtpAttempts() >= MAX_OTP_ATTEMPTS) {
            throw new ApiException(ErrorCode.AUTH_ACCOUNT_INACTIVE, "Too many failed attempts. Account locked. Contact support.", HttpStatus.FORBIDDEN);
        }

        if (user.getOtpExpiry() == null || user.getOtpExpiry().isBefore(clock.instant())) {
            throw new ApiException(ErrorCode.AUTH_INVALID_TOKEN, "Verification code has expired", HttpStatus.BAD_REQUEST);
        }

        String inputHash = HashUtil.sha256(dto.getOtp());
        if (!inputHash.equals(user.getOtpCode())) {
            user.setOtpAttempts(user.getOtpAttempts() + 1);
            user.setUpdatedAt(clock.instant());
            userRepository.save(user);
            throw new ApiException(ErrorCode.AUTH_INVALID_TOKEN, "Invalid verification code", HttpStatus.BAD_REQUEST);
        }

        // Issue reset token (32 random bytes)
        String rawResetToken = HashUtil.generateRandomHexToken(32);
        user.setResetToken(HashUtil.sha256(rawResetToken));
        user.setResetTokenExpiry(clock.instant().plus(RESET_TOKEN_EXPIRY));
        user.setOtpCode(null);
        user.setOtpExpiry(null);
        user.setOtpAttempts(0);
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

        if (user.isDeleted()) {
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

        if (dto.getEmail() != null && !dto.getEmail().isBlank()) {
            String newEmail = dto.getEmail().toLowerCase().trim();
            if (!newEmail.equalsIgnoreCase(user.getEmail()) && userRepository.existsByEmailIgnoreCase(newEmail)) {
                throw new ApiException(ErrorCode.CONFLICT, "Email already in use", HttpStatus.CONFLICT);
            }
            user.setEmail(newEmail);
        }

        if (dto.getPhone() != null) {
            user.setPhone(dto.getPhone().trim());
        }

        // Explicitly: role and isSuperAdmin in dto or request are IGNORED
        user.setUpdatedAt(clock.instant());
        User saved = userRepository.save(user);

        auditService.record(saved, "PROFILE_UPDATED", "USER", saved.getId(),
                "Profile updated for " + saved.getUsername());

        return UserSummaryDto.fromEntity(saved);
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
