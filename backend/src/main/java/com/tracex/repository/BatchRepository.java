package com.tracex.repository;

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
    Optional<Batch> findByTraceToken(String traceToken);
    Optional<Batch> findByTraceTokenAndIsDeletedFalse(String traceToken);
}
