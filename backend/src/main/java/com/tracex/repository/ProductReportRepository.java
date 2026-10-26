package com.tracex.repository;

import com.tracex.model.ProductReport;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface ProductReportRepository extends MongoRepository<ProductReport, String> {

    List<ProductReport> findByBatchIdOrderByCreatedAtDesc(String batchId);
}
