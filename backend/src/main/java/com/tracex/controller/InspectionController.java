package com.tracex.controller;

import com.tracex.dto.ApiResponse;
import com.tracex.dto.InspectionCreateDto;
import com.tracex.model.Inspection;
import com.tracex.security.Roles;
import com.tracex.security.UserPrincipal;
import com.tracex.service.InspectionService;
import com.tracex.util.RequestIdContext;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/inspections")
public class InspectionController {

    private final InspectionService inspectionService;
    private final com.tracex.service.NotificationService notificationService;

    public InspectionController(InspectionService inspectionService,
                                com.tracex.service.NotificationService notificationService) {
        this.notificationService = notificationService;
        this.inspectionService = inspectionService;
    }

    @PreAuthorize(Roles.INSPECTION_READERS)
    @GetMapping
    public ApiResponse<InspectionService.InspectionPageResult> listInspections(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "30") int limit,
            @RequestParam(required = false) String status,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.ok(inspectionService.listLatestInspections(page, limit, status), RequestIdContext.getOrCreate());
    }

    @PreAuthorize(Roles.INSPECTORS)
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ResponseEntity<ApiResponse<Inspection>> createInspection(
            @RequestBody(required = false) InspectionCreateDto dto,
            @AuthenticationPrincipal UserPrincipal principal) {
        Inspection created = inspectionService.createInspection(dto, principal.getUser());
        notificationService.inspectionCompleted(principal.getUser(), created.getId(), created.getBatchId(),
                created.getBatchCode(), created.getStatus());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(created, "Inspection submitted", RequestIdContext.getOrCreate()));
    }

    @PreAuthorize(Roles.INSPECTION_READERS)
    @GetMapping("/my")
    public ApiResponse<InspectionService.InspectionPageResult> listMyInspections(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int limit,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.ok(
                inspectionService.listMyInspections(principal.getUser().getId(), page, limit),
                RequestIdContext.getOrCreate()
        );
    }

    @PreAuthorize(Roles.INSPECTION_READERS)
    @GetMapping("/batch/{batchId}")
    public ApiResponse<List<Inspection>> listByBatch(
            @PathVariable String batchId,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.ok(inspectionService.listByBatchId(batchId), RequestIdContext.getOrCreate());
    }

    @PreAuthorize(Roles.INSPECTION_READERS)
    @GetMapping("/{id}")
    public ApiResponse<Inspection> getById(
            @PathVariable String id,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.ok(inspectionService.getById(id), RequestIdContext.getOrCreate());
    }
}
