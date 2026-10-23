package com.tracex.controller;

import com.tracex.dto.*;
import com.tracex.exception.ErrorCode;
import com.tracex.util.RequestIdContext;
import com.tracex.security.Roles;
import com.tracex.security.UserPrincipal;
import com.tracex.service.BatchService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/batches")
public class BatchController {

    private final BatchService batchService;
    private final com.tracex.service.QrService qrService;
    private final com.tracex.service.NotificationService notificationService;

    public BatchController(BatchService batchService, com.tracex.service.QrService qrService,
                           com.tracex.service.NotificationService notificationService) {
        this.notificationService = notificationService;
        this.batchService = batchService;
        this.qrService = qrService;
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

    @PreAuthorize(Roles.BATCH_EDITORS)
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ResponseEntity<ApiResponse<BatchDetailDto>> createBatch(
            @Valid @RequestBody BatchCreateDto dto,
            @AuthenticationPrincipal UserPrincipal principal) {
        BatchDetailDto created = batchService.createBatch(dto, principal.getUsername(), RequestIdContext.getOrCreate());
        notificationService.batchCreated(principal.getUser(), created.getId(), created.getBatchCode(), created.getProductName());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(created, RequestIdContext.getOrCreate()));
    }

    @PreAuthorize(Roles.ADMIN)
    @GetMapping("/archived")
    public ApiResponse<List<BatchDetailDto>> getArchivedBatches(@AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.ok(batchService.getArchivedBatches(), RequestIdContext.getOrCreate());
    }

    @GetMapping("/{id}")
    public ApiResponse<BatchDetailDto> getBatchById(@PathVariable String id,
                                                    @AuthenticationPrincipal UserPrincipal principal) {
        BatchDetailDto batch = batchService.getBatchById(id);
        // M6 (Phase 13): archived batches, farmer name included, follow the admin-only archive rule
        boolean admin = principal.getUser().isSuperAdmin() || principal.getUser().getRole() == com.tracex.model.Role.ADMIN;
        if (batch.isDeleted() && !admin) {
            throw new com.tracex.exception.ResourceNotFoundException("Batch not found");
        }
        return ApiResponse.ok(batch, RequestIdContext.getOrCreate());
    }

    @PreAuthorize(Roles.DISPATCHERS)
    @PatchMapping("/{id}/dispatch")
    public ApiResponse<BatchDetailDto> dispatchBatch(
            @PathVariable String id,
            @RequestBody(required = false) BatchDispatchDto dto,
            @AuthenticationPrincipal UserPrincipal principal) {
        String requestId = RequestIdContext.getOrCreate();
        BatchDetailDto dispatched = batchService.dispatchBatch(id, dto, principal.getUser(), requestId);
        List<com.tracex.model.Batch.DispatchHistoryEntry> history = dispatched.getDispatchHistory();
        boolean outOfOrder = history != null && !history.isEmpty() && history.get(history.size() - 1).isOutOfOrder();
        notificationService.batchDispatched(principal.getUser(), dispatched.getId(), dispatched.getBatchCode(),
                dispatched.getBuyerName(), outOfOrder);
        if (dispatched.getWarning() != null) {
            return ApiResponse.ok(dispatched, dispatched.getWarning(), requestId);
        }
        return ApiResponse.ok(dispatched, requestId);
    }

    @PreAuthorize(Roles.BATCH_EDITORS)
    @PatchMapping("/{id}/note")
    public ApiResponse<BatchDetailDto> updateNote(
            @PathVariable String id,
            @Valid @RequestBody BatchNoteDto dto,
            @AuthenticationPrincipal UserPrincipal principal) {
        BatchDetailDto updated = batchService.updateNote(id, dto.getNote(), principal.getUsername(), RequestIdContext.getOrCreate());
        notificationService.broadcastChange("batch:updated", id);
        return ApiResponse.ok(updated, RequestIdContext.getOrCreate());
    }

    @PreAuthorize(Roles.BATCH_EDITORS)
    @PatchMapping("/{id}/raw-material")
    public ApiResponse<BatchDetailDto> updateRawMaterial(
            @PathVariable String id,
            @Valid @RequestBody BatchRawMaterialDto dto,
            @AuthenticationPrincipal UserPrincipal principal) {
        BatchDetailDto updated = batchService.updateRawMaterial(id, dto, principal.getUsername(), RequestIdContext.getOrCreate());
        notificationService.broadcastChange("batch:updated", id);
        return ApiResponse.ok(updated, RequestIdContext.getOrCreate());
    }

    @PreAuthorize(Roles.ADMIN)
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<BatchDetailDto>> archiveBatch(
            @PathVariable String id,
            @RequestBody(required = false) Map<String, String> body,
            @AuthenticationPrincipal UserPrincipal principal) {
        String reason = body != null ? body.get("reason") : null;
        try {
            BatchDetailDto archived = batchService.archiveBatch(id, reason, principal.getUsername(), RequestIdContext.getOrCreate());
            notificationService.broadcastChange("batch:updated", id);
            return ResponseEntity.ok(ApiResponse.ok(archived, RequestIdContext.getOrCreate()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(ApiResponse.error(ErrorCode.CONFLICT, e.getMessage(), RequestIdContext.getOrCreate()));
        }
    }

    @PreAuthorize(Roles.ADMIN)
    @PatchMapping("/{id}/restore")
    public ResponseEntity<ApiResponse<BatchDetailDto>> restoreBatch(
            @PathVariable String id,
            @AuthenticationPrincipal UserPrincipal principal) {
        try {
            BatchDetailDto restored = batchService.restoreBatch(id, principal.getUsername(), RequestIdContext.getOrCreate());
            notificationService.broadcastChange("batch:updated", id);
            return ResponseEntity.ok(ApiResponse.ok(restored, RequestIdContext.getOrCreate()));
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
