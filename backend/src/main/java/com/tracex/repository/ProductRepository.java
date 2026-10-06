package com.tracex.repository;

import com.tracex.model.Product;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;
import java.util.Optional;

public interface ProductRepository extends MongoRepository<Product, String> {
    List<Product> findAll();
    Optional<Product> findBySku(String sku);
}
