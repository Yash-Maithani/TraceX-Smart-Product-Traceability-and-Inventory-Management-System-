package com.tracex.service;

import com.tracex.model.AuditLog;
import com.tracex.model.User;
import com.tracex.repository.AuditLogRepository;
import com.tracex.repository.UserRepository;
import com.tracex.util.RequestIdContext;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.util.List;
import java.util.Map;

@Service
public class AuditService {

    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;
    private final Clock clock;

    public AuditService(AuditLogRepository auditLogRepository, UserRepository userRepository, Clock clock) {
        this.auditLogRepository = auditLogRepository;
        this.userRepository = userRepository;
        this.clock = clock;
    }

    public AuditLog record(User actor, String action, String targetType, String targetId, String summary) {
        String actorId = actor != null ? actor.getId() : "system";
        String actorUsername = actor != null ? actor.getUsername() : "system";
        return record(actorId, actorUsername, action, targetType, targetId, summary, null, null, null);
    }

    public AuditLog record(String actorId, String actorUsername, String action, String targetType, String targetId, String summary) {
        return record(actorId, actorUsername, action, targetType, targetId, summary, null, null, null);
    }

    public AuditLog record(String actorId, String actorUsername, String action, String targetType, String targetId,
                           String summary, Map<String, Object> before, Map<String, Object> after, String reason) {
        AuditLog log = new AuditLog();
        log.setAction(action);
        // M8 (Phase 13): callers that only know the username (batch actions) no longer record "anonymous"
        if (actorId == null && actorUsername != null) {
            actorId = userRepository.findByUsername(actorUsername).map(User::getId).orElse(null);
        }
        log.setActorId(actorId != null ? actorId : "anonymous");
        log.setActorUsername(actorUsername != null ? actorUsername : "anonymous");
        log.setTargetType(targetType);
        log.setTargetId(targetId);
        log.setSummary(sanitizeSummary(summary));
        log.setBefore(before);
        log.setAfter(after);
        log.setReason(reason);
        log.setRequestId(RequestIdContext.getOrCreate());
        log.setCreatedAt(clock.instant()); // SPEC §3.1: time comes from the injected Clock

        return auditLogRepository.save(log);
    }

    public List<AuditLog> getAllAuditLogs() {
        return auditLogRepository.findAllByOrderByCreatedAtDesc();
    }

    public List<AuditLog> getLogsByTarget(String targetId) {
        return auditLogRepository.findByTargetIdOrderByCreatedAtDesc(targetId);
    }

    public List<AuditLog> getLogsByActor(String actorId) {
        return auditLogRepository.findByActorIdOrderByCreatedAtDesc(actorId);
    }

    public List<AuditLog> getLogsByAction(String action) {
        return auditLogRepository.findByActionOrderByCreatedAtDesc(action);
    }

    private String sanitizeSummary(String summary) {
        if (summary == null) {
            return "";
        }
        // Protect against accidental inclusion of sensitive keywords/hashes
        return summary.replaceAll("(?i)(password|otp|token|secret)[=:]\\s*[^,\\s]+", "$1=[REDACTED]");
    }
}
