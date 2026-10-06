package com.tracex.repository;

import com.tracex.model.ScanEvent;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface ScanEventRepository extends MongoRepository<ScanEvent, String> {
    List<ScanEvent> findByBatchId(String batchId);
    List<ScanEvent> findByBatchIdOrderByScannedAtDesc(String batchId);
    long countByBatchId(String batchId);
}
