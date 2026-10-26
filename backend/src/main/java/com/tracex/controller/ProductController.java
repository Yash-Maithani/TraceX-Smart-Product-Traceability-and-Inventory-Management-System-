package com.tracex.controller;

import com.tracex.dto.ApiResponse;
import com.tracex.dto.ProductUpsertDto;
import com.tracex.model.Product;
import com.tracex.security.Roles;
import com.tracex.security.UserPrincipal;
import com.tracex.service.ProductService;
import com.tracex.util.RequestIdContext;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/products")
public class ProductController {

    private final ProductService productService;

    public ProductController(ProductService productService) {
        this.productService = productService;
    }

    @GetMapping
    public ApiResponse<List<Product>> getProducts() {
        return ApiResponse.ok(productService.listProducts(), RequestIdContext.getOrCreate());
    }

    @PreAuthorize(Roles.MANAGERS)
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ResponseEntity<ApiResponse<Product>> createProduct(
            @Valid @RequestBody ProductUpsertDto dto,
            @AuthenticationPrincipal UserPrincipal principal) {
        Product created = productService.createProduct(dto, principal.getUser());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(created, RequestIdContext.getOrCreate()));
    }

    @PreAuthorize(Roles.MANAGERS)
    @PatchMapping("/{id}")
    public ApiResponse<Product> updateProduct(
            @PathVariable String id,
            @Valid @RequestBody ProductUpsertDto dto,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.ok(productService.updateProduct(id, dto, principal.getUser()), RequestIdContext.getOrCreate());
    }
}
