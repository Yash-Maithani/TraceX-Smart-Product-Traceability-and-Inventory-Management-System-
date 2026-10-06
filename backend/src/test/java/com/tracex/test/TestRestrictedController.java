package com.tracex.test;

import com.tracex.dto.ApiResponse;
import com.tracex.util.RequestIdContext;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/test")
public class TestRestrictedController {

    @GetMapping("/admin-only")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, String>>> adminOnly() {
        String requestId = RequestIdContext.getOrCreate();
        return ResponseEntity.ok(ApiResponse.ok(Map.of("message", "Welcome Admin"), requestId));
    }

    @GetMapping("/manager-only")
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<ApiResponse<Map<String, String>>> managerOnly() {
        String requestId = RequestIdContext.getOrCreate();
        return ResponseEntity.ok(ApiResponse.ok(Map.of("message", "Welcome Manager"), requestId));
    }

    @org.springframework.beans.factory.annotation.Autowired
    private com.tracex.security.RateLimiter rateLimiter;

    @GetMapping("/client-ip")
    public ResponseEntity<Map<String, String>> getClientIp(jakarta.servlet.http.HttpServletRequest request) {
        return ResponseEntity.ok(Map.of("clientIp", rateLimiter.resolveClientIp(request)));
    }
}
