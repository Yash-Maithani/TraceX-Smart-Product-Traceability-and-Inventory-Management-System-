package com.tracex.repository;

import com.tracex.model.User;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends MongoRepository<User, String> {

    Optional<User> findByUsername(String username);

    Optional<User> findByUsernameIgnoreCase(String username);

    boolean existsByUsernameIgnoreCase(String username);

    Optional<User> findByEmail(String email);

    Optional<User> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);

    long countByIsSuperAdminTrueAndIsActiveTrueAndIsDeletedFalse();

    List<User> findAllByIsDeletedFalse();

    List<User> findAllByIsDeletedTrue();

    List<User> findAllByIsActiveTrueAndIsDeletedFalse();

    Optional<User> findByResetToken(String resetToken);
}
