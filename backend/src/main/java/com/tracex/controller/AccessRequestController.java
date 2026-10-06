package com.tracex.controller;

import com.tracex.dto.AccessRequestSummaryDto;
import com.tracex.dto.ApiResponse;
import com.tracex.dto.RejectRequestDto;
import com.tracex.security.UserPrincipal;
import com.tracex.service.AccessRequestService;
import com.tracex.util.RequestIdContext;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/auth/requests")
public class AccessRequestController {

    private final AccessRequestService accessRequestService;

    public AccessRequestController(AccessRequestService accessRequestService) {
        this.accessRequestService = accessRequestService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<List<AccessRequestSummaryDto>>> getAllRequests() {
        List<AccessRequestSummaryDto> requests = accessRequestService.getAllRequests();
        String requestId = RequestIdContext.getOrCreate();
        return ResponseEntity.ok(ApiResponse.ok(requests, requestId));
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<AccessRequestSummaryDto>> approveRequest(
            @PathVariable String id,
            @AuthenticationPrincipal UserPrincipal principal) {
        AccessRequestSummaryDto approved = accessRequestService.approveRequest(id, principal.getUser());
        String requestId = RequestIdContext.getOrCreate();
        return ResponseEntity.ok(ApiResponse.ok(approved, "Access request approved and invitation dispatched", requestId));
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<AccessRequestSummaryDto>> rejectRequest(
            @PathVariable String id,
            @RequestBody(required = false) RejectRequestDto dto,
            @AuthenticationPrincipal UserPrincipal principal) {
        String note = dto != null ? dto.getNote() : null;
        AccessRequestSummaryDto rejected = accessRequestService.rejectRequest(id, note, principal.getUser());
        String requestId = RequestIdContext.getOrCreate();
        return ResponseEntity.ok(ApiResponse.ok(rejected, "Access request rejected", requestId));
    }

    @PostMapping("/{id}/resend")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<AccessRequestSummaryDto>> resendInvite(
            @PathVariable String id,
            @AuthenticationPrincipal UserPrincipal principal) {
        AccessRequestSummaryDto resent = accessRequestService.resendInvite(id, principal.getUser());
        String requestId = RequestIdContext.getOrCreate();
        return ResponseEntity.ok(ApiResponse.ok(resent, "Invitation email resent successfully", requestId));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteRequest(
            @PathVariable String id,
            @AuthenticationPrincipal UserPrincipal principal) {
        accessRequestService.deleteRequest(id, principal.getUser());
        String requestId = RequestIdContext.getOrCreate();
        return ResponseEntity.ok(ApiResponse.ok(null, "Access request deleted", requestId));
    }
}
