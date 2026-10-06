package com.tracex.repository;

import com.tracex.model.ImportJob;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface ImportJobRepository extends MongoRepository<ImportJob, String> {
    List<ImportJob> findByStatus(String status);
    List<ImportJob> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
