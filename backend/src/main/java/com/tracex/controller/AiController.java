package com.tracex.controller;

import com.tracex.dto.AiAuditDtos.AiStatus;
import com.tracex.dto.AiAuditDtos.AskAnswer;
import com.tracex.dto.AiAuditDtos.AskRequest;
import com.tracex.dto.AiAuditDtos.DispatchAdvice;
import com.tracex.dto.AiAuditDtos.InspectionDraft;
import com.tracex.dto.AiAuditDtos.InspectionDraftRequest;
import com.tracex.dto.ApiResponse;
import com.tracex.security.Roles;
import com.tracex.security.UserPrincipal;
import com.tracex.service.ai.AiAuditService;
import com.tracex.service.ai.AskService;
import com.tracex.service.ai.InspectionDraftService;
import com.tracex.util.RequestIdContext;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * AI features (Phase 11, reworked in the AI phase). The dispatch advisor's rule-based facts work without
 * any key; Ask TraceX and the inspection assistant need GEMINI_API_KEY or NVIDIA_API_KEY and answer
 * 503 AI_UNAVAILABLE otherwise.
 */
@RestController
@RequestMapping("/api/v1/ai")
public class AiController {

    private final AiAuditService aiAuditService;
    private final AskService askService;
    private final InspectionDraftService inspectionDraftService;

    public AiController(AiAuditService aiAuditService, AskService askService, InspectionDraftService inspectionDraftService) {
        this.aiAuditService = aiAuditService;
        this.askService = askService;
        this.inspectionDraftService = inspectionDraftService;
    }

    @GetMapping("/status")
    public ApiResponse<AiStatus> status() {
        return ApiResponse.ok(aiAuditService.status(), RequestIdContext.getOrCreate());
    }

    @PostMapping("/dispatch-audit")
    public ApiResponse<DispatchAdvice> dispatchAudit(@RequestParam(defaultValue = "false") boolean refresh,
                                                     @RequestParam(defaultValue = "true") boolean ai,
                                                     @AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.ok(aiAuditService.advise(principal.getUser(), refresh, ai), RequestIdContext.getOrCreate());
    }

    @PostMapping("/ask")
    public ApiResponse<AskAnswer> ask(@RequestBody(required = false) AskRequest body,
                                      @AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.ok(askService.ask(principal.getUser(), body == null ? null : body.question()),
                RequestIdContext.getOrCreate());
    }

    @PreAuthorize(Roles.INSPECTORS)
    @PostMapping("/inspection-draft")
    public ApiResponse<InspectionDraft> inspectionDraft(@RequestBody(required = false) InspectionDraftRequest body,
                                                        @AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.ok(inspectionDraftService.draft(principal.getUser(), body == null ? null : body.notes()),
                RequestIdContext.getOrCreate());
    }
}
