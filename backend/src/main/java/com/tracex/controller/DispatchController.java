package com.tracex.controller;

import com.tracex.dto.ApiResponse;
import com.tracex.service.FefoService;
import com.tracex.util.RequestIdContext;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/dispatch")
public class DispatchController {

    private final FefoService fefoService;

    public DispatchController(FefoService fefoService) {
        this.fefoService = fefoService;
    }

    @GetMapping("/fefo")
    public ApiResponse<FefoService.FefoResult> getFefoQueue(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String sku) {
        return ApiResponse.ok(fefoService.getFefoQueue(category, sku), RequestIdContext.getOrCreate());
    }
}
