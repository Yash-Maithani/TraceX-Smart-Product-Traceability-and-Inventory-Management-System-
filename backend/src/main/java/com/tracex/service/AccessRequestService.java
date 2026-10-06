package com.tracex.service;

import com.tracex.dto.AccessRequestSummaryDto;
import com.tracex.dto.RequestAccessDto;
import com.tracex.exception.ApiException;
import com.tracex.exception.ErrorCode;
import com.tracex.exception.RateLimitException;
import com.tracex.model.AccessRequest;
import com.tracex.model.AccessRequestStatus;
import com.tracex.model.Role;
import com.tracex.model.User;
import com.tracex.repository.AccessRequestRepository;
import com.tracex.repository.UserRepository;
import com.tracex.security.RateLimiter;
import com.tracex.util.HashUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

@Service
public class AccessRequestService {

    private static final Logger log = LoggerFactory.getLogger(AccessRequestService.class);
    @Value("${tracex.rate-limit.request-access:5}")
    private int MAX_REQUEST_ACCESS_ATTEMPTS = 5;
    private static final Duration RATE_LIMIT_WINDOW = Duration.ofMinutes(15);
    private static final Duration INVITE_EXPIRY = Duration.ofHours(48);

    private final AccessRequestRepository accessRequestRepository;
    private final UserRepository userRepository;
    private final EmailService emailService;
    private final AuditService auditService;
    private final RateLimiter rateLimiter;
    private final Clock clock;

    public AccessRequestService(AccessRequestRepository accessRequestRepository,
                                UserRepository userRepository,
                                EmailService emailService,
                                AuditService auditService,
                                RateLimiter rateLimiter,
                                Clock clock) {
        this.accessRequestRepository = accessRequestRepository;
        this.userRepository = userRepository;
        this.emailService = emailService;
        this.auditService = auditService;
        this.rateLimiter = rateLimiter;
        this.clock = clock;
    }

    public AccessRequestSummaryDto submitRequest(RequestAccessDto dto, String clientIp) {
        String rateLimitKey = "request-access:" + (clientIp != null ? clientIp : "unknown");
        if (!rateLimiter.allowRequest(rateLimitKey, MAX_REQUEST_ACCESS_ATTEMPTS, RATE_LIMIT_WINDOW)) {
            throw new RateLimitException("Too many access requests. Please try again later.");
        }

        // Validate requested role: must be one of the five role values, never super-admin
        if (dto.getRole() == null || dto.getRole().equalsIgnoreCase("super-admin") || dto.getRole().equalsIgnoreCase("superadmin")) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Invalid role requested. Super-admin cannot be requested.", HttpStatus.UNPROCESSABLE_ENTITY);
        }

        Role requestedRole;
        try {
            requestedRole = Role.fromValue(dto.getRole());
        } catch (IllegalArgumentException e) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Invalid role: " + dto.getRole(), HttpStatus.UNPROCESSABLE_ENTITY);
        }

        String email = dto.getEmail().toLowerCase().trim();

        // Check for duplicate email in access requests or existing users
        if (accessRequestRepository.existsByEmail(email) || userRepository.existsByEmailIgnoreCase(email)) {
            throw new ApiException(ErrorCode.CONFLICT, "An access request or account with this email already exists.", HttpStatus.CONFLICT);
        }

        AccessRequest request = new AccessRequest(dto.getName().trim(), email, requestedRole);
        request.setCreatedAt(clock.instant());
        request.setUpdatedAt(clock.instant());
        AccessRequest saved = accessRequestRepository.save(request);

        auditService.record("anonymous", email, "ACCESS_REQUEST_SUBMITTED", "ACCESS_REQUEST", saved.getId(),
                "Access request submitted for " + email + " with requested role " + requestedRole.getValue());

        return AccessRequestSummaryDto.fromEntity(saved);
    }

    public List<AccessRequestSummaryDto> getAllRequests() {
        return accessRequestRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(AccessRequestSummaryDto::fromEntity)
                .toList();
    }

    public AccessRequestSummaryDto approveRequest(String id, User actor) {
        AccessRequest request = accessRequestRepository.findById(id)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Access request not found", HttpStatus.NOT_FOUND));

        if (request.getStatus() == AccessRequestStatus.APPROVED) {
            throw new ApiException(ErrorCode.CONFLICT, "Access request has already been approved", HttpStatus.CONFLICT);
        }

        // Generate 32-byte random raw token, store only SHA-256 hash
        String rawToken = HashUtil.generateRandomHexToken(32);
        String hashedToken = HashUtil.sha256(rawToken);

        request.setInviteToken(hashedToken);
        request.setInviteExpiry(clock.instant().plus(INVITE_EXPIRY));
        request.setStatus(AccessRequestStatus.APPROVED);
        request.setApprovedBy(actor.getUsername());
        request.setUpdatedAt(clock.instant());

        AccessRequest saved = accessRequestRepository.save(request);

        boolean emailSent = true;
        try {
            emailService.sendInviteEmail(saved.getEmail(), saved.getName(), rawToken);
        } catch (Exception e) {
            emailSent = false;
            log.error("Failed to send invitation email to {}: {}", saved.getEmail(), e.getMessage());
        }

        auditService.record(actor, "ACCESS_REQUEST_APPROVED", "ACCESS_REQUEST", saved.getId(),
                "Access request approved for " + saved.getEmail() + (emailSent ? "" : " (email dispatch failed)"));

        return AccessRequestSummaryDto.fromEntity(saved);
    }

    public AccessRequestSummaryDto rejectRequest(String id, String note, User actor) {
        AccessRequest request = accessRequestRepository.findById(id)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Access request not found", HttpStatus.NOT_FOUND));

        request.setStatus(AccessRequestStatus.REJECTED);
        request.setNote(note);
        request.setUpdatedAt(clock.instant());

        AccessRequest saved = accessRequestRepository.save(request);
        auditService.record(actor, "ACCESS_REQUEST_REJECTED", "ACCESS_REQUEST", saved.getId(),
                "Access request rejected for " + saved.getEmail() + (note != null ? ": " + note : ""));

        return AccessRequestSummaryDto.fromEntity(saved);
    }

    public AccessRequestSummaryDto resendInvite(String id, User actor) {
        AccessRequest request = accessRequestRepository.findById(id)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Access request not found", HttpStatus.NOT_FOUND));

        if (request.getStatus() != AccessRequestStatus.APPROVED) {
            throw new ApiException(ErrorCode.CONFLICT, "Cannot resend invitation for non-approved request", HttpStatus.CONFLICT);
        }

        if (request.isInviteUsed()) {
            throw new ApiException(ErrorCode.CONFLICT, "Invitation has already been used", HttpStatus.CONFLICT);
        }

        // Issue fresh token
        String rawToken = HashUtil.generateRandomHexToken(32);
        request.setInviteToken(HashUtil.sha256(rawToken));
        request.setInviteExpiry(clock.instant().plus(INVITE_EXPIRY));
        request.setUpdatedAt(clock.instant());

        AccessRequest saved = accessRequestRepository.save(request);

        boolean emailSent = true;
        try {
            emailService.sendInviteEmail(saved.getEmail(), saved.getName(), rawToken);
        } catch (Exception e) {
            emailSent = false;
            log.error("Failed to resend invitation email to {}: {}", saved.getEmail(), e.getMessage());
        }

        auditService.record(actor, "ACCESS_REQUEST_INVITE_RESENT", "ACCESS_REQUEST", saved.getId(),
                "Invitation resent to " + saved.getEmail() + (emailSent ? "" : " (email dispatch failed)"));

        return AccessRequestSummaryDto.fromEntity(saved);
    }

    public void deleteRequest(String id, User actor) {
        AccessRequest request = accessRequestRepository.findById(id)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Access request not found", HttpStatus.NOT_FOUND));

        accessRequestRepository.delete(request);
        auditService.record(actor, "ACCESS_REQUEST_DELETED", "ACCESS_REQUEST", id,
                "Access request deleted for " + request.getEmail());
    }
}
