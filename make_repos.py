import os
import io

base = "backend/src/main/java/com/tracex/"

# ProductRepository.java
with io.open(base + "repository/ProductRepository.java", "w", encoding="utf-8") as f:
    f.write("""package com.tracex.repository;

import com.tracex.model.Product;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;
import java.util.Optional;

public interface ProductRepository extends MongoRepository<Product, String> {
    List<Product> findAll();
    Optional<Product> findBySku(String sku);
}
""")

# BatchRepository.java
with io.open(base + "repository/BatchRepository.java", "w", encoding="utf-8") as f:
    f.write("""package com.tracex.repository;

import com.tracex.model.Batch;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;
import java.util.Optional;

public interface BatchRepository extends MongoRepository<Batch, String> {
    Optional<Batch> findByBatchCode(String batchCode);
    List<Batch> findByIsDeletedFalse();
    List<Batch> findByIsDeletedTrue();
    Page<Batch> findByIsDeletedFalseAndLifecycleState(String lifecycleState, Pageable pageable);
    long countByIsDeletedFalse();
}
""")

# CounterRepository.java
with io.open(base + "repository/CounterRepository.java", "w", encoding="utf-8") as f:
    f.write("""package com.tracex.repository;

import com.tracex.model.Counter;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface CounterRepository extends MongoRepository<Counter, String> {
}
""")

