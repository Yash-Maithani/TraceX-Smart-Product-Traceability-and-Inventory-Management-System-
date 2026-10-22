package com.tracex.repository;

import com.tracex.model.LoginEvent;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.Instant;
import java.util.List;

public interface LoginEventRepository extends MongoRepository<LoginEvent, String> {
    List<LoginEvent> findTop50ByUserIdAndCreatedAtAfterOrderByCreatedAtDesc(String userId, Instant after);
    long countByUserId(String userId);
}
