package com.tracex.controller;

import com.tracex.dto.ApiResponse;
import com.tracex.dto.ImportDtos.*;
import com.tracex.exception.ErrorCode;
import com.tracex.security.UserPrincipal;
import com.tracex.service.ImportService;
import com.tracex.util.RequestIdContext;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/import")
public class ImportController {

    private final ImportService importService;

    public ImportController(ImportService importService) {
        this.importService = importService;
    }

    private void checkImporterPermission(UserPrincipal principal) {
        if (principal == null || principal.getUser() == null) {
            throw new AccessDeniedException(ErrorCode.RBAC_INSUFFICIENT.name());
        }
        String role = principal.getUser().getRole().name();
        if (principal.getUser().isSuperAdmin()
                || "ADMIN".equals(role)
                || "MANAGER".equals(role)
                || "FACTORY_MANAGER".equals(role)) {
            return;
        }
        throw new AccessDeniedException(ErrorCode.RBAC_INSUFFICIENT.name());
    }

    @GetMapping("/schema")
    public ApiResponse<ImportSchemaDto> getImportSchema(@AuthenticationPrincipal UserPrincipal principal) {
        checkImporterPermission(principal);
        return ApiResponse.ok(importService.getSchema(), RequestIdContext.getOrCreate());
    }

    @PostMapping("/map-headers")
    public ApiResponse<ImportMapHeadersResponseDto> mapHeaders(
            @RequestBody(required = false) ImportMapHeadersRequestDto body,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        checkImporterPermission(principal);
        List<String> headers = body != null ? body.getHeaders() : List.of();
        return ApiResponse.ok(importService.mapHeaders(headers), RequestIdContext.getOrCreate());
    }

    @PostMapping("/validate")
    public ApiResponse<ImportValidateResponseDto> validateImport(
            @RequestBody(required = false) ImportValidateRequestDto body,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        checkImporterPermission(principal);
        return ApiResponse.ok(importService.validate(body), RequestIdContext.getOrCreate());
    }

    @PostMapping("/commit")
    public ApiResponse<ImportCommitResponseDto> commitImport(
            @RequestBody(required = false) ImportCommitRequestDto body,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        checkImporterPermission(principal);
        String requestId = RequestIdContext.getOrCreate();
        return ApiResponse.ok(importService.commit(body, principal.getUser(), requestId), requestId);
    }

    @GetMapping
    public ApiResponse<List<ImportJobSummaryDto>> listImportJobs(@AuthenticationPrincipal UserPrincipal principal) {
        checkImporterPermission(principal);
        return ApiResponse.ok(importService.listJobs(), RequestIdContext.getOrCreate());
    }

    @GetMapping("/{id}")
    public ApiResponse<ImportJobDetailDto> getImportJob(
            @PathVariable String id,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        checkImporterPermission(principal);
        return ApiResponse.ok(importService.getJobDetail(id), RequestIdContext.getOrCreate());
    }

    @PostMapping("/{id}/rollback")
    public ApiResponse<ImportRollbackResponseDto> rollbackImport(
            @PathVariable String id,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        checkImporterPermission(principal);
        String requestId = RequestIdContext.getOrCreate();
        return ApiResponse.ok(importService.rollback(id, principal.getUser(), requestId), requestId);
    }
}
