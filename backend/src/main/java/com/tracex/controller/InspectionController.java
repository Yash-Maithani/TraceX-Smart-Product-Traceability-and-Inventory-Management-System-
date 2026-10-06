package com.tracex.controller;

import com.tracex.dto.ApiResponse;
import com.tracex.dto.InspectionCreateDto;
import com.tracex.exception.ErrorCode;
import com.tracex.model.Inspection;
import com.tracex.security.UserPrincipal;
import com.tracex.service.InspectionService;
import com.tracex.util.RequestIdContext;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/inspections")
public class InspectionController {

    private final InspectionService inspectionService;

    public InspectionController(InspectionService inspectionService) {
        this.inspectionService = inspectionService;
    }

    private void checkReadPermission(UserPrincipal principal) {
        if (principal == null || principal.getUser() == null) {
            throw new AccessDeniedException(ErrorCode.RBAC_INSUFFICIENT.name());
        }
        String role = principal.getUser().getRole().name();
        if (principal.getUser().isSuperAdmin()
                || "ADMIN".equals(role)
                || "MANAGER".equals(role)
                || "FACTORY_MANAGER".equals(role)
                || "QUALITY_INSPECTOR".equals(role)) {
            return;
        }
        throw new AccessDeniedException(ErrorCode.RBAC_INSUFFICIENT.name());
    }

    private void checkCreatePermission(UserPrincipal principal) {
        if (principal == null || principal.getUser() == null) {
            throw new AccessDeniedException(ErrorCode.RBAC_INSUFFICIENT.name());
        }
        String role = principal.getUser().getRole().name();
        if (principal.getUser().isSuperAdmin()
                || "ADMIN".equals(role)
                || "QUALITY_INSPECTOR".equals(role)) {
            return;
        }
        throw new AccessDeniedException(ErrorCode.RBAC_INSUFFICIENT.name());
    }

    @GetMapping
    public ApiResponse<InspectionService.InspectionPageResult> listInspections(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "30") int limit,
            @RequestParam(required = false) String status,
            @AuthenticationPrincipal UserPrincipal principal) {
        checkReadPermission(principal);
        return ApiResponse.ok(inspectionService.listLatestInspections(page, limit, status), RequestIdContext.getOrCreate());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ResponseEntity<ApiResponse<Inspection>> createInspection(
            @RequestBody(required = false) InspectionCreateDto dto,
            @AuthenticationPrincipal UserPrincipal principal) {
        checkCreatePermission(principal);
        Inspection created = inspectionService.createInspection(dto, principal.getUser());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(created, "Inspection submitted", RequestIdContext.getOrCreate()));
    }

    @GetMapping("/my")
    public ApiResponse<InspectionService.InspectionPageResult> listMyInspections(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int limit,
            @AuthenticationPrincipal UserPrincipal principal) {
        checkReadPermission(principal);
        return ApiResponse.ok(
                inspectionService.listMyInspections(principal.getUser().getId(), page, limit),
                RequestIdContext.getOrCreate()
        );
    }

    @GetMapping("/batch/{batchId}")
    public ApiResponse<List<Inspection>> listByBatch(
            @PathVariable String batchId,
            @AuthenticationPrincipal UserPrincipal principal) {
        checkReadPermission(principal);
        return ApiResponse.ok(inspectionService.listByBatchId(batchId), RequestIdContext.getOrCreate());
    }

    @GetMapping("/{id}")
    public ApiResponse<Inspection> getById(
            @PathVariable String id,
            @AuthenticationPrincipal UserPrincipal principal) {
        checkReadPermission(principal);
        return ApiResponse.ok(inspectionService.getById(id), RequestIdContext.getOrCreate());
    }
}
