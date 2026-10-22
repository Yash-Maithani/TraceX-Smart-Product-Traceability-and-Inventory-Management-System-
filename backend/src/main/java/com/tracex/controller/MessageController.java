package com.tracex.controller;

import com.tracex.dto.ApiResponse;
import com.tracex.dto.MessageDtos.ChannelsDto;
import com.tracex.dto.MessageDtos.MessageBodyDto;
import com.tracex.dto.MessageDtos.MessageDto;
import com.tracex.security.UserPrincipal;
import com.tracex.service.MessageService;
import com.tracex.util.RequestIdContext;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Role channels and record comments (Phase 10.1, S-05). Literal paths come before /{id}.
 */
@RestController
@RequestMapping("/api/v1/messages")
public class MessageController {

    private final MessageService messageService;

    public MessageController(MessageService messageService) {
        this.messageService = messageService;
    }

    @GetMapping("/channels")
    public ApiResponse<ChannelsDto> channels(@AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.ok(messageService.listChannels(principal.getUser()), RequestIdContext.getOrCreate());
    }

    @GetMapping("/channel/{role}")
    public ApiResponse<List<MessageDto>> channel(@PathVariable String role,
                                                 @RequestParam(required = false) Integer limit,
                                                 @AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.ok(messageService.getChannel(principal.getUser(), role, limit), RequestIdContext.getOrCreate());
    }

    @PostMapping("/channel/{role}")
    public ResponseEntity<ApiResponse<MessageDto>> postToChannel(@PathVariable String role,
                                                                 @Valid @RequestBody MessageBodyDto dto,
                                                                 @AuthenticationPrincipal UserPrincipal principal) {
        MessageDto created = messageService.postToChannel(principal.getUser(), role, dto.getBody());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(created, RequestIdContext.getOrCreate()));
    }

    @GetMapping("/record/{refType}/{refId}")
    public ApiResponse<List<MessageDto>> thread(@PathVariable String refType, @PathVariable String refId,
                                                @AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.ok(messageService.getThread(principal.getUser(), refType, refId), RequestIdContext.getOrCreate());
    }

    @PostMapping("/record/{refType}/{refId}")
    public ResponseEntity<ApiResponse<MessageDto>> postToThread(@PathVariable String refType, @PathVariable String refId,
                                                                @Valid @RequestBody MessageBodyDto dto,
                                                                @AuthenticationPrincipal UserPrincipal principal) {
        MessageDto created = messageService.postToThread(principal.getUser(), refType, refId, dto.getBody());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(created, RequestIdContext.getOrCreate()));
    }

    @PatchMapping("/{id}")
    public ApiResponse<MessageDto> edit(@PathVariable String id, @Valid @RequestBody MessageBodyDto dto,
                                        @AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.ok(messageService.edit(principal.getUser(), id, dto.getBody()), RequestIdContext.getOrCreate());
    }

    @DeleteMapping("/{id}")
    public ApiResponse<MessageDto> delete(@PathVariable String id, @AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.ok(messageService.delete(principal.getUser(), id), RequestIdContext.getOrCreate());
    }
}
