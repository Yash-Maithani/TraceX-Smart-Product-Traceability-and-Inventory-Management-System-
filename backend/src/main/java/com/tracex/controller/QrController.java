package com.tracex.controller;

import com.tracex.dto.ApiResponse;
import com.tracex.dto.PublicTraceDto;
import com.tracex.dto.ScanRequestDto;
import com.tracex.exception.ApiException;
import com.tracex.exception.ErrorCode;
import com.tracex.security.RateLimiter;
import com.tracex.service.QrService;
import com.tracex.util.RequestIdContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;

@RestController
@RequestMapping("/api/v1/qr")
public class QrController {

    private final QrService qrService;
    private final RateLimiter rateLimiter;
    private final int traceRateLimit;
    private final int scanRateLimit;

    public QrController(
            QrService qrService,
            RateLimiter rateLimiter,
            @Value("${tracex.rate-limit.trace:60}") int traceRateLimit,
            @Value("${tracex.rate-limit.scan:60}") int scanRateLimit
    ) {
        this.qrService = qrService;
        this.rateLimiter = rateLimiter;
        this.traceRateLimit = traceRateLimit;
        this.scanRateLimit = scanRateLimit;
    }

    @GetMapping("/trace/t/{token}")
    public ApiResponse<PublicTraceDto> getPublicTrace(
            @PathVariable String token,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        String clientIp = rateLimiter.resolveClientIp(request);
        if (!rateLimiter.allowRequest("trace:" + clientIp, traceRateLimit, Duration.ofMinutes(1))) {
            throw new ApiException(ErrorCode.RATE_LIMITED, "Too many trace requests. Please try again later.", HttpStatus.TOO_MANY_REQUESTS);
        }

        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
        response.setHeader("Referrer-Policy", "no-referrer");

        String requestId = RequestIdContext.getOrCreate();
        PublicTraceDto dto = qrService.getPublicTrace(token);
        return ApiResponse.ok(dto, requestId);
    }

    @PostMapping("/scan")
    public ApiResponse<Void> recordScan(
            @Valid @RequestBody ScanRequestDto body,
            HttpServletRequest request
    ) {
        String clientIp = rateLimiter.resolveClientIp(request);
        if (!rateLimiter.allowRequest("scan:" + clientIp, scanRateLimit, Duration.ofMinutes(1))) {
            throw new ApiException(ErrorCode.RATE_LIMITED, "Too many scan requests. Please try again later.", HttpStatus.TOO_MANY_REQUESTS);
        }

        String requestId = RequestIdContext.getOrCreate();
        qrService.recordScan(body.getToken(), body.getSource(), request);
        return ApiResponse.ok(null, "Scan recorded successfully", requestId);
    }
}
