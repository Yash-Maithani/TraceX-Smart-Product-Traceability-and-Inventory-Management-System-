package com.tracex.controller;

import com.tracex.dto.AiAuditDtos.AiStatus;
import com.tracex.dto.AiAuditDtos.AuditReport;
import com.tracex.dto.ApiResponse;
import com.tracex.security.UserPrincipal;
import com.tracex.service.ai.AiAuditService;
import com.tracex.util.RequestIdContext;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * AI dispatch audit (Phase 11, S-01). Works only when GEMINI_API_KEY or NVIDIA_API_KEY is set.
 */
@RestController
@RequestMapping("/api/v1/ai")
public class AiController {

    private final AiAuditService aiAuditService;

    public AiController(AiAuditService aiAuditService) {
        this.aiAuditService = aiAuditService;
    }

    @GetMapping("/status")
    public ApiResponse<AiStatus> status() {
        return ApiResponse.ok(aiAuditService.status(), RequestIdContext.getOrCreate());
    }

    @PostMapping("/dispatch-audit")
    public ApiResponse<AuditReport> dispatchAudit(@RequestParam(defaultValue = "false") boolean refresh,
                                                  @AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.ok(aiAuditService.runAudit(principal.getUser(), refresh), RequestIdContext.getOrCreate());
    }
}
