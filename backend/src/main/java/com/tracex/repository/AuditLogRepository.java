package com.tracex.repository;

import com.tracex.model.AuditLog;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AuditLogRepository extends MongoRepository<AuditLog, String> {

    List<AuditLog> findAllByOrderByCreatedAtDesc();

    List<AuditLog> findByTargetIdOrderByCreatedAtDesc(String targetId);

    List<AuditLog> findByActorIdOrderByCreatedAtDesc(String actorId);

    List<AuditLog> findByActionOrderByCreatedAtDesc(String action);
}
