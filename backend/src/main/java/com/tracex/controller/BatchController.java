package com.tracex.controller;

import com.tracex.dto.*;
import com.tracex.exception.ErrorCode;
import com.tracex.util.RequestIdContext;
import com.tracex.security.UserPrincipal;
import com.tracex.service.BatchService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/batches")
public class BatchController {

    private final BatchService batchService;
    private final com.tracex.service.QrService qrService;

    public BatchController(BatchService batchService, com.tracex.service.QrService qrService) {
        this.batchService = batchService;
        this.qrService = qrService;
    }

    private void checkCreateEditPermission(UserPrincipal principal) {
        String role = principal.getUser().getRole().name();
        if (principal.getUser().isSuperAdmin() || "ADMIN".equals(role) || "MANAGER".equals(role) || "FACTORY_MANAGER".equals(role)) {
            return;
        }
        throw new org.springframework.security.access.AccessDeniedException(ErrorCode.RBAC_INSUFFICIENT.name());
    }

    private void checkAdminPermission(UserPrincipal principal) {
        if (principal.getUser().isSuperAdmin() || "ADMIN".equals(principal.getUser().getRole().name())) {
            return;
        }
        throw new org.springframework.security.access.AccessDeniedException(ErrorCode.RBAC_INSUFFICIENT.name());
    }

    private void checkDispatchPermission(UserPrincipal principal) {
        if (principal == null || principal.getUser() == null) {
            throw new org.springframework.security.access.AccessDeniedException(ErrorCode.RBAC_INSUFFICIENT.name());
        }
        String role = principal.getUser().getRole().name();
        if (principal.getUser().isSuperAdmin() || "ADMIN".equals(role) || "DISPATCH_COORDINATOR".equals(role)) {
            return;
        }
        throw new org.springframework.security.access.AccessDeniedException(ErrorCode.RBAC_INSUFFICIENT.name());
    }

    @GetMapping
    public ApiResponse<BatchService.BatchPageResult> getAllBatches(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "50") int limit,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String sku,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String sort) {
        return ApiResponse.ok(batchService.getAllBatches(page, limit, status, sku, search, sort), RequestIdContext.getOrCreate());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ResponseEntity<ApiResponse<BatchDetailDto>> createBatch(
            @Valid @RequestBody BatchCreateDto dto,
            @AuthenticationPrincipal UserPrincipal principal) {
        checkCreateEditPermission(principal);
        BatchDetailDto created = batchService.createBatch(dto, principal.getUsername(), RequestIdContext.getOrCreate());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(created, RequestIdContext.getOrCreate()));
    }

    @GetMapping("/archived")
    public ApiResponse<List<BatchDetailDto>> getArchivedBatches(@AuthenticationPrincipal UserPrincipal principal) {
        checkAdminPermission(principal);
        return ApiResponse.ok(batchService.getArchivedBatches(), RequestIdContext.getOrCreate());
    }

    @GetMapping("/{id}")
    public ApiResponse<BatchDetailDto> getBatchById(@PathVariable String id) {
        return ApiResponse.ok(batchService.getBatchById(id), RequestIdContext.getOrCreate());
    }

    @PatchMapping("/{id}/dispatch")
    public ApiResponse<BatchDetailDto> dispatchBatch(
            @PathVariable String id,
            @RequestBody(required = false) BatchDispatchDto dto,
            @AuthenticationPrincipal UserPrincipal principal) {
        checkDispatchPermission(principal);
        String requestId = RequestIdContext.getOrCreate();
        BatchDetailDto dispatched = batchService.dispatchBatch(id, dto, principal.getUser(), requestId);
        if (dispatched.getWarning() != null) {
            return ApiResponse.ok(dispatched, dispatched.getWarning(), requestId);
        }
        return ApiResponse.ok(dispatched, requestId);
    }

    @PatchMapping("/{id}/note")
    public ApiResponse<BatchDetailDto> updateNote(
            @PathVariable String id,
            @Valid @RequestBody BatchNoteDto dto,
            @AuthenticationPrincipal UserPrincipal principal) {
        checkCreateEditPermission(principal);
        return ApiResponse.ok(batchService.updateNote(id, dto.getNote(), principal.getUsername(), RequestIdContext.getOrCreate()), RequestIdContext.getOrCreate());
    }

    @PatchMapping("/{id}/raw-material")
    public ApiResponse<BatchDetailDto> updateRawMaterial(
            @PathVariable String id,
            @Valid @RequestBody BatchRawMaterialDto dto,
            @AuthenticationPrincipal UserPrincipal principal) {
        checkCreateEditPermission(principal);
        return ApiResponse.ok(batchService.updateRawMaterial(id, dto, principal.getUsername(), RequestIdContext.getOrCreate()), RequestIdContext.getOrCreate());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<BatchDetailDto>> archiveBatch(
            @PathVariable String id,
            @RequestBody(required = false) Map<String, String> body,
            @AuthenticationPrincipal UserPrincipal principal) {
        checkAdminPermission(principal);
        String reason = body != null ? body.get("reason") : null;
        try {
            return ResponseEntity.ok(ApiResponse.ok(batchService.archiveBatch(id, reason, principal.getUsername(), RequestIdContext.getOrCreate()), RequestIdContext.getOrCreate()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(ApiResponse.error(ErrorCode.CONFLICT, e.getMessage(), RequestIdContext.getOrCreate()));
        }
    }

    @PatchMapping("/{id}/restore")
    public ResponseEntity<ApiResponse<BatchDetailDto>> restoreBatch(
            @PathVariable String id,
            @AuthenticationPrincipal UserPrincipal principal) {
        checkAdminPermission(principal);
        try {
            return ResponseEntity.ok(ApiResponse.ok(batchService.restoreBatch(id, principal.getUsername(), RequestIdContext.getOrCreate()), RequestIdContext.getOrCreate()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(ApiResponse.error(ErrorCode.CONFLICT, e.getMessage(), RequestIdContext.getOrCreate()));
        }
    }

    @GetMapping("/{id}/qr")
    public ApiResponse<BatchQrDto> getBatchQr(@PathVariable String id) {
        String requestId = RequestIdContext.getOrCreate();
        BatchQrDto qr = qrService.getBatchQr(id);
        return ApiResponse.ok(qr, requestId);
    }

    @GetMapping("/{id}/scans")
    public ApiResponse<BatchScansDto> getBatchScans(@PathVariable String id) {
        String requestId = RequestIdContext.getOrCreate();
        BatchScansDto scans = qrService.getBatchScans(id);
        return ApiResponse.ok(scans, requestId);
    }
}
