package com.tracex.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.ArrayList;
import java.util.List;

/**
 * Create or edit a catalogue product (POST and PATCH /api/v1/products). The SKU is fixed once the
 * product exists because batches, imports and the dispatch queue look products up by it.
 */
public class ProductUpsertDto {
    @NotBlank @Size(min = 2, max = 120)
    private String productName;
    @NotBlank @Pattern(regexp = "[A-Za-z0-9-]{2,12}", message = "Use 2 to 12 letters, digits or hyphens.")
    private String sku;
    @NotBlank @Size(max = 40)
    private String category;
    @NotNull @Min(1) @Max(3650)
    private Integer shelfLifeDays;
    @NotBlank @Pattern(regexp = "LOW|MEDIUM|HIGH", message = "Choose LOW, MEDIUM or HIGH.")
    private String riskLevel;
    @Size(max = 1000)
    private String ingredients;
    @Size(max = 14)
    private List<@NotBlank @Size(max = 40) String> allergens = new ArrayList<>();
    @Size(max = 300)
    private String storageInstructions;

    public String getProductName() { return productName; }
    public void setProductName(String productName) { this.productName = productName; }
    public String getSku() { return sku; }
    public void setSku(String sku) { this.sku = sku; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public Integer getShelfLifeDays() { return shelfLifeDays; }
    public void setShelfLifeDays(Integer shelfLifeDays) { this.shelfLifeDays = shelfLifeDays; }
    public String getRiskLevel() { return riskLevel; }
    public void setRiskLevel(String riskLevel) { this.riskLevel = riskLevel; }
    public String getIngredients() { return ingredients; }
    public void setIngredients(String ingredients) { this.ingredients = ingredients; }
    public List<String> getAllergens() { return allergens; }
    public void setAllergens(List<String> allergens) { this.allergens = allergens; }
    public String getStorageInstructions() { return storageInstructions; }
    public void setStorageInstructions(String storageInstructions) { this.storageInstructions = storageInstructions; }
}
