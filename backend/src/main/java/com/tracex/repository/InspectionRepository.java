package com.tracex.repository;

import com.tracex.model.Inspection;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface InspectionRepository extends MongoRepository<Inspection, String> {
    List<Inspection> findByBatchIdOrderByCreatedAtDesc(String batchId);
    Optional<Inspection> findByBatchIdAndIsLatestTrue(String batchId);
}
