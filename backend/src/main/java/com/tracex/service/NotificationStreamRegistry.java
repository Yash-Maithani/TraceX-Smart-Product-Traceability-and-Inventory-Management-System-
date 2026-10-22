package com.tracex.service;

import com.tracex.model.User;
import com.tracex.repository.UserRepository;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.function.Predicate;

/**
 * Open SSE connections for GET /api/v1/notifications/stream (D-4, SPEC §8.5).
 *
 * Each connection remembers the user and the token version it was opened with. A heartbeat
 * re-reads the user and closes the stream once they are deactivated, deleted, or their sessions
 * are revoked, so a live stream never outlives the session that opened it.
 */
@Component
public class NotificationStreamRegistry {

    private static final Logger log = LoggerFactory.getLogger(NotificationStreamRegistry.class);

    private final UserRepository userRepository;
    private final Map<String, Set<Connection>> byUser = new ConcurrentHashMap<>();
    private final ScheduledExecutorService heartbeat = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "sse-heartbeat");
        t.setDaemon(true);
        return t;
    });

    @Value("${tracex.sse.timeout-ms:1800000}")
    private long timeoutMs = 1_800_000L; // 30 minutes; the client reconnects

    public record Connection(SseEmitter emitter, String userId, String role, boolean superAdmin, long tokenVersion) {
    }

    public NotificationStreamRegistry(UserRepository userRepository,
                                      @Value("${tracex.sse.heartbeat-seconds:25}") long heartbeatSeconds) {
        this.userRepository = userRepository;
        heartbeat.scheduleAtFixedRate(this::sendHeartbeats, heartbeatSeconds, heartbeatSeconds, TimeUnit.SECONDS);
    }

    public SseEmitter open(User user) {
        SseEmitter emitter = new SseEmitter(timeoutMs);
        Connection conn = new Connection(emitter, user.getId(),
                user.getRole() != null ? user.getRole().getValue() : null, user.isSuperAdmin(), user.getTokenVersion());
        byUser.computeIfAbsent(user.getId(), k -> new CopyOnWriteArraySet<>()).add(conn);
        emitter.onCompletion(() -> remove(conn));
        emitter.onTimeout(() -> remove(conn));
        emitter.onError(e -> remove(conn));
        try {
            // First frame tells the client the stream is live
            emitter.send(SseEmitter.event().name("ready").data("{\"ok\":true}"));
        } catch (IOException | IllegalStateException e) {
            remove(conn);
        }
        return emitter;
    }

    /** Sends one named event to every open connection that the filter accepts. */
    public void send(String eventName, Object payload, Predicate<Connection> audience) {
        for (Set<Connection> conns : byUser.values()) {
            for (Connection conn : conns) {
                if (!audience.test(conn)) continue;
                try {
                    conn.emitter().send(SseEmitter.event().name(eventName).data(payload));
                } catch (IOException | IllegalStateException e) {
                    remove(conn);
                }
            }
        }
    }

    public int openConnectionCount() {
        return byUser.values().stream().mapToInt(Set::size).sum();
    }

    public int openConnectionCount(String userId) {
        Set<Connection> conns = byUser.get(userId);
        return conns == null ? 0 : conns.size();
    }

    public void sendHeartbeats() {
        for (Map.Entry<String, Set<Connection>> entry : byUser.entrySet()) {
            Optional<User> current;
            try {
                current = userRepository.findById(entry.getKey());
            } catch (Exception e) {
                continue; // database briefly unavailable; try again next beat
            }
            for (Connection conn : entry.getValue()) {
                boolean stillValid = current.isPresent()
                        && current.get().isActive()
                        && !current.get().isDeleted()
                        && current.get().getTokenVersion() == conn.tokenVersion();
                if (!stillValid) {
                    conn.emitter().complete();
                    remove(conn);
                    continue;
                }
                try {
                    conn.emitter().send(SseEmitter.event().comment("keep-alive"));
                } catch (IOException | IllegalStateException e) {
                    remove(conn);
                }
            }
        }
    }

    private void remove(Connection conn) {
        Set<Connection> conns = byUser.get(conn.userId());
        if (conns != null) {
            conns.remove(conn);
            if (conns.isEmpty()) {
                byUser.remove(conn.userId(), conns);
            }
        }
    }

    @PreDestroy
    void shutdown() {
        heartbeat.shutdownNow();
        byUser.values().forEach(conns -> conns.forEach(c -> {
            try {
                c.emitter().complete();
            } catch (Exception e) {
                log.debug("Ignoring error while closing SSE stream on shutdown");
            }
        }));
        byUser.clear();
    }
}
