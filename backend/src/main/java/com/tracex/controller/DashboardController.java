package com.tracex.controller;

import com.tracex.dto.ApiResponse;
import com.tracex.dto.DashboardSummaryDto;
import com.tracex.model.User;
import com.tracex.security.UserPrincipal;
import com.tracex.service.DashboardService;
import com.tracex.util.RequestIdContext;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/dashboard")
public class DashboardController {

    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping("/summary")
    public ApiResponse<DashboardSummaryDto> getSummary(@AuthenticationPrincipal UserPrincipal principal) {
        User currentUser = principal != null ? principal.getUser() : null;
        return ApiResponse.ok(dashboardService.getSummary(currentUser), RequestIdContext.getOrCreate());
    }
}
