package com.tracex.controller;

import com.tracex.dto.ApiResponse;
import com.tracex.dto.ProductReportDto;
import com.tracex.dto.ResolveProductReportDto;
import com.tracex.security.Roles;
import com.tracex.security.UserPrincipal;
import com.tracex.service.ProductReportService;
import com.tracex.util.RequestIdContext;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Staff side of shopper problem reports: read them per batch, and mark one resolved. */
@RestController
public class ProductReportController {

    private final ProductReportService productReportService;

    public ProductReportController(ProductReportService productReportService) {
        this.productReportService = productReportService;
    }

    @PreAuthorize(Roles.INSPECTION_READERS)
    @GetMapping("/api/v1/batches/{id}/reports")
    public ApiResponse<List<ProductReportDto>> getBatchReports(@PathVariable String id) {
        return ApiResponse.ok(productReportService.listForBatch(id), RequestIdContext.getOrCreate());
    }

    @PreAuthorize(Roles.REPORT_HANDLERS)
    @PatchMapping("/api/v1/product-reports/{id}/resolve")
    public ApiResponse<ProductReportDto> resolveReport(
            @PathVariable String id,
            @Valid @RequestBody ResolveProductReportDto body,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.ok(productReportService.resolve(id, body.getNote(), principal.getUser()),
                RequestIdContext.getOrCreate());
    }
}
