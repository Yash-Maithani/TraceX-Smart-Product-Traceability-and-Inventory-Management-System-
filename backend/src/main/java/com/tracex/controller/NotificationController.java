package com.tracex.controller;

import com.tracex.dto.ApiResponse;
import com.tracex.dto.NotificationDto;
import com.tracex.security.UserPrincipal;
import com.tracex.service.NotificationService;
import com.tracex.util.RequestIdContext;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Notifications (Phase 10). Every endpoint works on the caller's own notifications only.
 */
@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    public ApiResponse<NotificationDto.NotificationListDto> list(@AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.ok(notificationService.listFor(principal.getUser()), RequestIdContext.getOrCreate());
    }

    /** Server-Sent Events (D-4). Authenticated with the normal Authorization header. */
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@AuthenticationPrincipal UserPrincipal principal) {
        return notificationService.openStream(principal.getUser());
    }

    @PatchMapping("/{id}/read")
    public ApiResponse<NotificationDto> markRead(@PathVariable String id, @AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.ok(notificationService.markRead(principal.getUser(), id), RequestIdContext.getOrCreate());
    }

    @PatchMapping("/read-all")
    public ApiResponse<NotificationDto.ReadAllResultDto> markAllRead(@AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.ok(notificationService.markAllRead(principal.getUser()), RequestIdContext.getOrCreate());
    }
}
