package com.tracex.repository;

import com.tracex.model.AccessRequest;
import com.tracex.model.AccessRequestStatus;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AccessRequestRepository extends MongoRepository<AccessRequest, String> {

    Optional<AccessRequest> findByEmail(String email);

    boolean existsByEmail(String email);

    Optional<AccessRequest> findByInviteToken(String inviteToken);

    List<AccessRequest> findByStatus(AccessRequestStatus status);

    List<AccessRequest> findAllByOrderByCreatedAtDesc();
}
