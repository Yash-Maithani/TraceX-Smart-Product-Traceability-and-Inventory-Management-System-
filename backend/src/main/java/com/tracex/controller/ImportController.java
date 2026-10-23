package com.tracex.controller;

import com.tracex.dto.ApiResponse;
import com.tracex.dto.ImportDtos.*;
import com.tracex.security.Roles;
import com.tracex.security.UserPrincipal;
import com.tracex.service.ImportService;
import com.tracex.util.RequestIdContext;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/import")
public class ImportController {

    private final ImportService importService;
    private final com.tracex.service.NotificationService notificationService;

    public ImportController(ImportService importService, com.tracex.service.NotificationService notificationService) {
        this.notificationService = notificationService;
        this.importService = importService;
    }

    @PreAuthorize(Roles.IMPORTERS)
    @GetMapping("/schema")
    public ApiResponse<ImportSchemaDto> getImportSchema(@AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.ok(importService.getSchema(), RequestIdContext.getOrCreate());
    }

    @PreAuthorize(Roles.IMPORTERS)
    @PostMapping("/map-headers")
    public ApiResponse<ImportMapHeadersResponseDto> mapHeaders(
            @RequestBody(required = false) ImportMapHeadersRequestDto body,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        List<String> headers = body != null ? body.getHeaders() : List.of();
        return ApiResponse.ok(importService.mapHeaders(headers), RequestIdContext.getOrCreate());
    }

    @PreAuthorize(Roles.IMPORTERS)
    @PostMapping("/validate")
    public ApiResponse<ImportValidateResponseDto> validateImport(
            @RequestBody(required = false) ImportValidateRequestDto body,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ApiResponse.ok(importService.validate(body), RequestIdContext.getOrCreate());
    }

    @PreAuthorize(Roles.IMPORTERS)
    @PostMapping("/commit")
    public ApiResponse<ImportCommitResponseDto> commitImport(
            @RequestBody(required = false) ImportCommitRequestDto body,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        String requestId = RequestIdContext.getOrCreate();
        ImportCommitResponseDto resp = importService.commit(body, principal.getUser(), requestId);
        // Only the final chunk finishes a job; earlier chunks keep it "running"
        if ("done".equals(resp.getStatus()) || "failed".equals(resp.getStatus())) {
            ImportCommitTotalsDto t = resp.getTotals();
            notificationService.importFinished(principal.getUser(), resp.getJobId(), resp.getStatus(),
                    t != null ? t.getInserted() : 0, t != null ? t.getSkipped() : 0, t != null ? t.getErrored() : 0);
        }
        return ApiResponse.ok(resp, requestId);
    }

    @PreAuthorize(Roles.IMPORTERS)
    @GetMapping
    public ApiResponse<List<ImportJobSummaryDto>> listImportJobs(@AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.ok(importService.listJobs(), RequestIdContext.getOrCreate());
    }

    @PreAuthorize(Roles.IMPORTERS)
    @GetMapping("/{id}")
    public ApiResponse<ImportJobDetailDto> getImportJob(
            @PathVariable String id,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ApiResponse.ok(importService.getJobDetail(id), RequestIdContext.getOrCreate());
    }

    @PreAuthorize(Roles.IMPORTERS)
    @PostMapping("/{id}/rollback")
    public ApiResponse<ImportRollbackResponseDto> rollbackImport(
            @PathVariable String id,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        String requestId = RequestIdContext.getOrCreate();
        ImportRollbackResponseDto result = importService.rollback(id, principal.getUser(), requestId);
        notificationService.broadcastChange("batch:updated", null);
        return ApiResponse.ok(result, requestId);
    }
}
