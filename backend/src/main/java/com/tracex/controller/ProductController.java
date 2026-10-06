package com.tracex.controller;

import com.tracex.dto.ApiResponse;
import com.tracex.model.Product;
import com.tracex.repository.ProductRepository;
import com.tracex.util.RequestIdContext;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/products")
public class ProductController {

    private final ProductRepository productRepository;

    public ProductController(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    @GetMapping
    public ApiResponse<List<Product>> getProducts() {
        return ApiResponse.ok(productRepository.findAll(), RequestIdContext.getOrCreate());
    }
}
