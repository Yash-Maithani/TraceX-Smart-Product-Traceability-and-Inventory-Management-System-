package com.tracex.service;

import com.tracex.dto.NotificationDto;
import com.tracex.exception.ResourceNotFoundException;
import com.tracex.model.Notification;
import com.tracex.model.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Notifications and live updates (M-09, D-4, SPEC §8.5).
 *
 * `notify(...)` stores a notification and pushes it on the stream as the matching live event
 * (`batch:created`, `batch:dispatched`, `import:finished`, `inspection:created`, `access-request:created`,
 * `product-report:created`).
 * `broadcastChange(...)` pushes a live-only `batch:updated` event with no stored notification, so open
 * lists refresh. Payloads carry ids, codes and counts only: never farmer names (D-9) or other personal data.
 * A failure here is logged and never fails the business action that triggered it.
 */
@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);
    private static final int LIST_LIMIT = 50;

    public static final List<String> BATCH_WATCHERS = List.of("quality-inspector", "dispatch-coordinator", "manager", "admin");
    public static final List<String> DISPATCH_WATCHERS = List.of("factory-manager", "manager", "admin");
    public static final List<String> INSPECTION_WATCHERS = List.of("factory-manager", "manager", "admin", "dispatch-coordinator");
    public static final List<String> ACCESS_WATCHERS = List.of("admin");
    public static final List<String> REPORT_WATCHERS = List.of("quality-inspector", "manager", "admin");

    private final MongoTemplate mongoTemplate;
    private final NotificationStreamRegistry streams;
    private final Clock clock;

    public NotificationService(MongoTemplate mongoTemplate, NotificationStreamRegistry streams, Clock clock) {
        this.mongoTemplate = mongoTemplate;
        this.streams = streams;
        this.clock = clock;
    }

    // ---------- events raised by other features ----------

    public void batchCreated(User actor, String batchId, String batchCode, String productName) {
        notify("batch:created", "batch_created", BATCH_WATCHERS, null, actor,
                "New batch " + batchCode,
                productName + " batch " + batchCode + " was created and is ready for inspection.",
                "batch", batchId);
    }

    public void batchDispatched(User actor, String batchId, String batchCode, String buyerName, boolean outOfOrder) {
        notify("batch:dispatched", "batch_dispatched", DISPATCH_WATCHERS, null, actor,
                "Batch " + batchCode + " dispatched",
                "Batch " + batchCode + " was dispatched to " + buyerName + (outOfOrder ? " out of FEFO order, with a recorded reason." : "."),
                "batch", batchId);
    }

    public void inspectionCompleted(User actor, String inspectionId, String batchId, String batchCode, String verdict) {
        String message = "FAILED".equals(verdict)
                ? "Batch " + batchCode + " failed inspection and is on quality hold. It cannot be dispatched."
                : "Batch " + batchCode + " was inspected with verdict " + verdict + ".";
        notify("inspection:created", "inspection_completed", INSPECTION_WATCHERS, null, actor,
                "Inspection " + verdict + ": " + batchCode, message, "batch", batchId);
    }

    public void importFinished(User actor, String jobId, String status, int inserted, int skipped, int errored) {
        // The importer always hears how it went
        notify("import:finished", "import_finished", List.of(), actor.getId(), actor,
                "done".equals(status) ? "Import finished" : "Import failed",
                String.format("%d batches added, %d skipped as duplicates, %d rows with errors.", inserted, skipped, errored),
                "import", jobId);
        // Everyone who works with new batches hears that some arrived
        if (inserted > 0) {
            notify("batch:created", "batch_imported", BATCH_WATCHERS, null, actor,
                    inserted + " batches imported",
                    inserted + " new batches were added by bulk import and are ready for inspection.",
                    "import", jobId);
        }
    }

    public void productReportSubmitted(String batchId, String batchCode, String productName,
                                       String categoryLabel, boolean urgent) {
        notify("product-report:created", "product_report", REPORT_WATCHERS, null, null,
                (urgent ? "Urgent shopper report on " : "Shopper report on ") + batchCode,
                "A shopper reported \"" + categoryLabel + "\" for " + productName + " batch " + batchCode + ".",
                "batch", batchId);
    }

    public void accessRequestSubmitted(String requestId, String requestedRole) {
        notify("access-request:created", "admin_action", ACCESS_WATCHERS, null, null,
                "New access request",
                "Someone asked for " + requestedRole + " access. Review it on the Team page.",
                "access_request", requestId);
    }

    /** Live-only event so open screens refresh; nothing is stored. */
    public void broadcastChange(String eventName, String batchId) {
        try {
            streams.send(eventName, Map.of("refType", "batch", "refId", batchId), c -> true);
        } catch (Exception e) {
            log.warn("Live update {} failed: exceptionClass={}", eventName, e.getClass().getName());
        }
    }

    // ---------- reading ----------

    public NotificationDto.NotificationListDto listFor(User user) {
        Query q = new Query(audienceCriteria(user)).with(Sort.by(Sort.Direction.DESC, "createdAt")).limit(LIST_LIMIT);
        List<NotificationDto> items = mongoTemplate.find(q, Notification.class).stream()
                .map(n -> NotificationDto.forUser(n, user.getId()))
                .toList();
        long unread = mongoTemplate.count(new Query(new Criteria().andOperator(
                audienceCriteria(user), Criteria.where("readBy").ne(user.getId()))), Notification.class);
        return new NotificationDto.NotificationListDto(items, unread);
    }

    public NotificationDto markRead(User user, String id) {
        Query q = new Query(new Criteria().andOperator(Criteria.where("_id").is(id), audienceCriteria(user)));
        Notification n = mongoTemplate.findAndModify(q, new Update().addToSet("readBy", user.getId()),
                org.springframework.data.mongodb.core.FindAndModifyOptions.options().returnNew(true), Notification.class);
        if (n == null) {
            // Not found, expired, or addressed to someone else: the same 404 for all three
            throw new ResourceNotFoundException("Notification not found");
        }
        return NotificationDto.forUser(n, user.getId());
    }

    public NotificationDto.ReadAllResultDto markAllRead(User user) {
        Query q = new Query(new Criteria().andOperator(audienceCriteria(user), Criteria.where("readBy").ne(user.getId())));
        long marked = mongoTemplate.updateMulti(q, new Update().addToSet("readBy", user.getId()), Notification.class)
                .getModifiedCount();
        return new NotificationDto.ReadAllResultDto(marked);
    }

    public SseEmitter openStream(User user) {
        return streams.open(user);
    }

    // ---------- internals ----------

    /** Notifications addressed to this user, or to their role, except role broadcasts they triggered. */
    Criteria audienceCriteria(User user) {
        List<String> roles = rolesOf(user.getRole() != null ? user.getRole().getValue() : null, user.isSuperAdmin());
        Criteria forRole = new Criteria().andOperator(
                Criteria.where("recipientRoles").in(roles),
                Criteria.where("triggeredBy.userId").ne(user.getId()));
        return new Criteria().orOperator(Criteria.where("recipientUserId").is(user.getId()), forRole);
    }

    private static List<String> rolesOf(String role, boolean superAdmin) {
        List<String> roles = new ArrayList<>();
        if (role != null) roles.add(role);
        if (superAdmin && !roles.contains("admin")) roles.add("admin");
        return roles;
    }

    private void notify(String eventName, String type, List<String> roles, String userId, User actor,
                        String title, String message, String refType, String refId) {
        try {
            Notification n = new Notification();
            n.setType(type);
            n.setRecipientRoles(new ArrayList<>(roles));
            n.setRecipientUserId(userId);
            n.setTitle(truncate(title, 120));
            n.setMessage(truncate(message, 400));
            n.setRefType(refType);
            n.setRefId(refId);
            if (actor != null) {
                n.setTriggeredBy(new Notification.TriggeredBy(actor.getId(), actor.getName(),
                        actor.getRole() != null ? actor.getRole().getValue() : null));
            }
            n.setCreatedAt(Instant.now(clock));
            Notification saved = mongoTemplate.save(n);

            String actorId = actor != null ? actor.getId() : null;
            streams.send(eventName, NotificationDto.forUser(saved, ""), conn -> {
                if (userId != null) return userId.equals(conn.userId());
                if (conn.userId().equals(actorId)) return false;
                return rolesOf(conn.role(), conn.superAdmin()).stream().anyMatch(roles::contains);
            });
        } catch (Exception e) {
            log.warn("Notification {} failed: exceptionClass={}", type, e.getClass().getName());
        }
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max - 1) + "…";
    }
}
