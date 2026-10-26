package com.tracex.service;

import com.tracex.dto.ProductUpsertDto;
import com.tracex.exception.ResourceNotFoundException;
import com.tracex.exception.ValidationException;
import com.tracex.model.Product;
import com.tracex.model.User;
import com.tracex.repository.ProductRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;

/**
 * Product catalogue (2026-10-26). Before this, products existed only as seed data. A change applies to
 * batches created afterwards; existing batches keep the expiry date and priority they were given.
 */
@Service
public class ProductService {

    private final ProductRepository productRepository;
    private final AuditService auditService;

    public ProductService(ProductRepository productRepository, AuditService auditService) {
        this.productRepository = productRepository;
        this.auditService = auditService;
    }

    public List<Product> listProducts() {
        List<Product> products = new ArrayList<>(productRepository.findAll());
        products.sort((a, b) -> String.valueOf(a.getProductName()).compareToIgnoreCase(String.valueOf(b.getProductName())));
        return products;
    }

    public Product createProduct(ProductUpsertDto dto, User actor) {
        String sku = normaliseSku(dto.getSku());
        if (productRepository.findBySku(sku).isPresent()) {
            throw new ValidationException("sku", "Another product already uses the SKU " + sku + ".");
        }
        Product product = new Product();
        product.setSku(sku);
        apply(product, dto);
        Product saved = productRepository.save(product);
        auditService.record(actor, "PRODUCT_CREATED", "PRODUCT", saved.getId(),
                "Product " + saved.getProductName() + " (" + sku + ") added to the catalogue");
        return saved;
    }

    public Product updateProduct(String id, ProductUpsertDto dto, User actor) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found"));
        if (!normaliseSku(dto.getSku()).equals(normaliseSku(product.getSku()))) {
            throw new ValidationException("sku", "The SKU cannot change once a product exists.");
        }
        String before = product.getProductName() + ", " + effectiveShelfLife(product) + " days, " + product.getRiskLevel();
        apply(product, dto);
        Product saved = productRepository.save(product);
        auditService.record(actor, "PRODUCT_UPDATED", "PRODUCT", saved.getId(),
                "Product " + saved.getSku() + " changed from " + before + " to "
                        + saved.getProductName() + ", " + effectiveShelfLife(saved) + " days, " + saved.getRiskLevel());
        return saved;
    }

    private void apply(Product product, ProductUpsertDto dto) {
        product.setProductName(dto.getProductName().trim());
        product.setCategory(dto.getCategory().trim());
        product.setBaseShelfLifeDays(dto.getShelfLifeDays());
        // The catalogue shelf life is the one batches use, so an older predicted value must not override it
        product.setPredictedShelfLifeDays(null);
        product.setPredictedExpiryTemplate(null);
        product.setRiskLevel(dto.getRiskLevel().toUpperCase(Locale.ROOT));
        product.setIngredients(blankToNull(dto.getIngredients()));
        product.setStorageInstructions(blankToNull(dto.getStorageInstructions()));
        LinkedHashSet<String> allergens = new LinkedHashSet<>();
        if (dto.getAllergens() != null) {
            for (String a : dto.getAllergens()) {
                if (a != null && !a.isBlank()) allergens.add(a.trim());
            }
        }
        product.setAllergens(new ArrayList<>(allergens));
    }

    private static int effectiveShelfLife(Product p) {
        if (p.getPredictedShelfLifeDays() != null) return p.getPredictedShelfLifeDays();
        return p.getBaseShelfLifeDays() == null ? 0 : p.getBaseShelfLifeDays();
    }

    private static String normaliseSku(String sku) {
        return sku == null ? "" : sku.trim().toUpperCase(Locale.ROOT);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
