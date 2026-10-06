package com.tracex.controller;

import com.tracex.dto.*;
import com.tracex.security.RateLimiter;
import com.tracex.security.UserPrincipal;
import com.tracex.service.AccessRequestService;
import com.tracex.service.AuthService;
import com.tracex.service.UserService;
import com.tracex.util.RequestIdContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;
    private final UserService userService;
    private final AccessRequestService accessRequestService;
    private final RateLimiter rateLimiter;

    public AuthController(AuthService authService,
                          UserService userService,
                          AccessRequestService accessRequestService,
                          RateLimiter rateLimiter) {
        this.authService = authService;
        this.userService = userService;
        this.accessRequestService = accessRequestService;
        this.rateLimiter = rateLimiter;
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<LoginResponse>> login(@Valid @RequestBody LoginRequest request,
                                                           HttpServletRequest httpRequest) {
        String clientIp = rateLimiter.resolveClientIp(httpRequest);
        LoginResponse response = authService.login(request, clientIp);
        String requestId = RequestIdContext.getOrCreate();
        return ResponseEntity.ok(ApiResponse.ok(response, "Login successful", requestId));
    }

    @PostMapping("/request-access")
    public ResponseEntity<ApiResponse<AccessRequestSummaryDto>> requestAccess(@Valid @RequestBody RequestAccessDto request,
                                                                              HttpServletRequest httpRequest) {
        String clientIp = rateLimiter.resolveClientIp(httpRequest);
        AccessRequestSummaryDto summary = accessRequestService.submitRequest(request, clientIp);
        String requestId = RequestIdContext.getOrCreate();
        return ResponseEntity.ok(ApiResponse.ok(summary, "Access request submitted successfully", requestId));
    }

    @PostMapping("/activate")
    public ResponseEntity<ApiResponse<Map<String, Object>>> activate(@Valid @RequestBody ActivateAccountDto request) {
        Map<String, Object> result = userService.activateAccount(request);
        String requestId = RequestIdContext.getOrCreate();
        return ResponseEntity.ok(ApiResponse.ok(result, "Account activated; verification OTP sent", requestId));
    }

    @PostMapping("/verify-otp")
    public ResponseEntity<ApiResponse<LoginResponse>> verifyOtp(@Valid @RequestBody VerifyOtpDto request) {
        LoginResponse response = userService.verifyOtp(request);
        String requestId = RequestIdContext.getOrCreate();
        return ResponseEntity.ok(ApiResponse.ok(response, "Account successfully verified", requestId));
    }

    @PostMapping("/verify-otp/resend")
    public ResponseEntity<ApiResponse<Map<String, String>>> resendOtp(@Valid @RequestBody ResendOtpDto request,
                                                                      HttpServletRequest httpRequest) {
        String clientIp = rateLimiter.resolveClientIp(httpRequest);
        userService.resendOtp(request, clientIp);
        String requestId = RequestIdContext.getOrCreate();
        return ResponseEntity.ok(ApiResponse.ok(Map.of("message", "If the account exists and is unverified, a new code has been sent."), requestId));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<ApiResponse<Map<String, String>>> forgotPassword(@Valid @RequestBody ForgotPasswordDto request,
                                                                           HttpServletRequest httpRequest) {
        String clientIp = rateLimiter.resolveClientIp(httpRequest);
        userService.forgotPassword(request, clientIp);
        String requestId = RequestIdContext.getOrCreate();
        return ResponseEntity.ok(ApiResponse.ok(Map.of("message", "If an account exists with this email, password reset instructions have been sent."), requestId));
    }

    @PostMapping("/verify-reset-otp")
    public ResponseEntity<ApiResponse<Map<String, String>>> verifyResetOtp(@Valid @RequestBody VerifyResetOtpDto request) {
        Map<String, String> result = userService.verifyResetOtp(request);
        String requestId = RequestIdContext.getOrCreate();
        return ResponseEntity.ok(ApiResponse.ok(result, "Verification successful", requestId));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<ApiResponse<Map<String, String>>> resetPassword(@Valid @RequestBody ResetPasswordDto request) {
        userService.resetPassword(request);
        String requestId = RequestIdContext.getOrCreate();
        return ResponseEntity.ok(ApiResponse.ok(Map.of("message", "Password has been successfully reset"), requestId));
    }

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<UserSummaryDto>> getMe(@AuthenticationPrincipal UserPrincipal principal) {
        UserSummaryDto user = authService.getCurrentUser(principal.getUser().getId());
        String requestId = RequestIdContext.getOrCreate();
        return ResponseEntity.ok(ApiResponse.ok(user, requestId));
    }

    @PatchMapping("/me")
    public ResponseEntity<ApiResponse<UserSummaryDto>> updateMe(@RequestBody UpdateProfileDto request,
                                                               @AuthenticationPrincipal UserPrincipal principal) {
        UserSummaryDto user = userService.updateProfile(principal.getUser(), request);
        String requestId = RequestIdContext.getOrCreate();
        return ResponseEntity.ok(ApiResponse.ok(user, "Profile updated successfully", requestId));
    }

    @PostMapping("/me/change-password")
    public ResponseEntity<ApiResponse<LoginResponse>> changePassword(@Valid @RequestBody ChangePasswordDto request,
                                                                    @AuthenticationPrincipal UserPrincipal principal) {
        LoginResponse response = userService.changePassword(principal.getUser(), request);
        String requestId = RequestIdContext.getOrCreate();
        return ResponseEntity.ok(ApiResponse.ok(response, "Password changed successfully", requestId));
    }

    @PostMapping("/me/logout-all")
    public ResponseEntity<ApiResponse<Void>> logoutAll(@AuthenticationPrincipal UserPrincipal principal) {
        authService.logoutAll(principal.getUser().getId());
        String requestId = RequestIdContext.getOrCreate();
        return ResponseEntity.ok(ApiResponse.ok(null, "All active sessions have been revoked", requestId));
    }
}
