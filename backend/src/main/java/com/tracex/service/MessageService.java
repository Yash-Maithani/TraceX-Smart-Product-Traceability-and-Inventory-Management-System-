package com.tracex.service;

import com.tracex.dto.MessageDtos.ChannelActivityDto;
import com.tracex.dto.MessageDtos.ChannelsDto;
import com.tracex.dto.MessageDtos.MessageDto;
import com.tracex.exception.ApiException;
import com.tracex.exception.ErrorCode;
import com.tracex.exception.ResourceNotFoundException;
import com.tracex.exception.ValidationException;
import com.tracex.model.Message;
import com.tracex.model.Role;
import com.tracex.model.User;
import com.tracex.repository.BatchRepository;
import com.tracex.repository.InspectionRepository;
import com.tracex.repository.UserRepository;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Role channels and record comments (S-05), ported from the reference `messages.controller.js`.
 *
 * Deviations: inspection threads follow GET /api/v1/inspections, so `dispatch-coordinator` cannot read
 * or post on them (the reference let every signed-in user in); validation errors are 422 with field
 * errors; edits and deletes also require access to the conversation the message is in.
 */
@Service
public class MessageService {

    public static final List<String> ALL_CHANNELS =
            List.of("admin", "manager", "factory-manager", "quality-inspector", "dispatch-coordinator");
    private static final int MAX_PAGE = 100;
    private static final int DEFAULT_CHANNEL_PAGE = 50;

    private final MongoTemplate mongoTemplate;
    private final BatchRepository batchRepository;
    private final InspectionRepository inspectionRepository;
    private final UserRepository userRepository;
    private final NotificationStreamRegistry streams;
    private final Clock clock;

    public MessageService(MongoTemplate mongoTemplate, BatchRepository batchRepository,
                          InspectionRepository inspectionRepository, UserRepository userRepository,
                          NotificationStreamRegistry streams, Clock clock) {
        this.mongoTemplate = mongoTemplate;
        this.batchRepository = batchRepository;
        this.inspectionRepository = inspectionRepository;
        this.userRepository = userRepository;
        this.streams = streams;
        this.clock = clock;
    }

    // ---------- access rules ----------

    private static String roleOf(User user) {
        return user.getRole() != null ? user.getRole().getValue() : null;
    }

    /** Super-admin sees every channel; everyone else exactly their own. */
    public static List<String> channelsFor(String role, boolean superAdmin) {
        if (superAdmin) return ALL_CHANNELS;
        return role != null && ALL_CHANNELS.contains(role) ? List.of(role) : List.of();
    }

    /** Inspection threads follow the inspection read rule; batch threads are open to every role. */
    public static boolean canUseRecord(String refType, String role, boolean superAdmin) {
        if ("inspection".equals(refType)) {
            return superAdmin || !"dispatch-coordinator".equals(role);
        }
        return true;
    }

    private void requireChannel(User user, String channel) {
        if (!ALL_CHANNELS.contains(channel)) {
            throw new ResourceNotFoundException("Unknown channel");
        }
        if (!channelsFor(roleOf(user), user.isSuperAdmin()).contains(channel)) {
            throw new ApiException(ErrorCode.RBAC_INSUFFICIENT, "You do not have access to that channel", HttpStatus.FORBIDDEN);
        }
    }

    private void requireRecord(User user, String refType, String refId) {
        if (!"batch".equals(refType) && !"inspection".equals(refType)) {
            throw new ValidationException("refType", "refType must be batch or inspection");
        }
        if (!canUseRecord(refType, roleOf(user), user.isSuperAdmin())) {
            throw new ApiException(ErrorCode.RBAC_INSUFFICIENT, "You do not have access to inspection comments", HttpStatus.FORBIDDEN);
        }
        boolean exists = "batch".equals(refType) ? batchRepository.existsById(refId) : inspectionRepository.existsById(refId);
        if (!exists) {
            throw new ResourceNotFoundException("No " + refType + " with that id");
        }
    }

    private static String cleanBody(String raw) {
        String body = raw == null ? "" : raw.trim();
        if (body.isEmpty()) throw new ValidationException("body", "Message body is required");
        if (body.length() > Message.MAX_BODY) throw new ValidationException("body", "Message cannot exceed 2000 characters");
        return body;
    }

    // ---------- record threads ----------

    public List<MessageDto> getThread(User user, String refType, String refId) {
        requireRecord(user, refType, refId);
        Query q = Query.query(Criteria.where("scope").is("record").and("refType").is(refType).and("refId").is(refId))
                .with(Sort.by(Sort.Direction.ASC, "createdAt")).limit(MAX_PAGE);
        return mongoTemplate.find(q, Message.class).stream().map(m -> MessageDto.present(m, user.getId())).toList();
    }

    public MessageDto postToThread(User user, String refType, String refId, String rawBody) {
        requireRecord(user, refType, refId);
        Message m = newMessage(user, cleanBody(rawBody));
        m.setScope("record");
        m.setRefType(refType);
        m.setRefId(refId);
        m.setExpiresAt(null); // permanent: record comments are audit evidence
        Message saved = mongoTemplate.save(m);
        pushNew(saved);
        return MessageDto.present(saved, user.getId());
    }

    // ---------- role channels ----------

    public ChannelsDto listChannels(User user) {
        List<String> allowed = channelsFor(roleOf(user), user.isSuperAdmin());

        Map<String, Long> memberCounts = new LinkedHashMap<>();
        allowed.forEach(c -> memberCounts.put(c, 0L));
        for (User u : userRepository.findAllByIsActiveTrueAndIsDeletedFalse()) {
            String r = roleOf(u);
            if (memberCounts.containsKey(r)) memberCounts.merge(r, 1L, Long::sum);
        }

        Map<String, ChannelActivityDto> activity = new LinkedHashMap<>();
        for (String channel : allowed) {
            Criteria c = Criteria.where("scope").is("channel").and("channelRole").is(channel).and("isDeleted").is(false);
            long total = mongoTemplate.count(Query.query(c), Message.class);
            if (total == 0) continue;
            Message last = mongoTemplate.findOne(Query.query(c).with(Sort.by(Sort.Direction.DESC, "createdAt")), Message.class);
            if (last != null) {
                String preview = last.getBody().length() > 90 ? last.getBody().substring(0, 90) : last.getBody();
                activity.put(channel, new ChannelActivityDto(last.getCreatedAt(), last.getAuthorName(), preview, total));
            }
        }
        return new ChannelsDto(allowed, user.isSuperAdmin(), Message.CHANNEL_RETENTION_DAYS, memberCounts, activity);
    }

    public List<MessageDto> getChannel(User user, String channel, Integer limit) {
        requireChannel(user, channel);
        int size = Math.max(1, Math.min(limit != null ? limit : DEFAULT_CHANNEL_PAGE, MAX_PAGE));
        Query q = Query.query(Criteria.where("scope").is("channel").and("channelRole").is(channel))
                .with(Sort.by(Sort.Direction.DESC, "createdAt")).limit(size);
        List<MessageDto> newestFirst = new ArrayList<>(
                mongoTemplate.find(q, Message.class).stream().map(m -> MessageDto.present(m, user.getId())).toList());
        Collections.reverse(newestFirst); // oldest to newest for display
        return newestFirst;
    }

    public MessageDto postToChannel(User user, String channel, String rawBody) {
        requireChannel(user, channel);
        Message m = newMessage(user, cleanBody(rawBody));
        m.setScope("channel");
        m.setChannelRole(channel);
        m.setExpiresAt(clock.instant().plus(Duration.ofDays(Message.CHANNEL_RETENTION_DAYS)));
        Message saved = mongoTemplate.save(m);
        pushNew(saved);
        return MessageDto.present(saved, user.getId());
    }

    // ---------- edit and delete ----------

    private Message findVisible(User user, String id) {
        Message m = mongoTemplate.findById(id, Message.class);
        if (m == null) throw new ResourceNotFoundException("Message not found");
        boolean visible = "channel".equals(m.getScope())
                ? channelsFor(roleOf(user), user.isSuperAdmin()).contains(m.getChannelRole())
                : canUseRecord(m.getRefType(), roleOf(user), user.isSuperAdmin());
        if (!visible) throw new ResourceNotFoundException("Message not found");
        return m;
    }

    /** Author only, not even an admin: the previous text goes to editHistory first. */
    public MessageDto edit(User user, String id, String rawBody) {
        Message m = findVisible(user, id);
        if (m.isDeleted()) {
            throw new ApiException(ErrorCode.CONFLICT, "Message has been deleted", HttpStatus.CONFLICT);
        }
        if (!user.getId().equals(m.getAuthorId())) {
            throw new ApiException(ErrorCode.RBAC_INSUFFICIENT, "You can only edit your own messages", HttpStatus.FORBIDDEN);
        }
        String body = cleanBody(rawBody);
        Instant now = clock.instant();
        m.getEditHistory().add(new Message.Edit(m.getBody(), now));
        m.setBody(body);
        m.setEditedAt(now);
        m.setUpdatedAt(now);
        Message saved = mongoTemplate.save(m);
        pushNew(saved);
        return MessageDto.present(saved, user.getId());
    }

    /** Author, or admin / super-admin for moderation. Soft delete: the slot stays, the body is withheld. */
    public MessageDto delete(User user, String id) {
        Message m = findVisible(user, id);
        if (m.isDeleted()) return MessageDto.present(m, user.getId());
        boolean mine = user.getId().equals(m.getAuthorId());
        boolean moderator = user.isSuperAdmin() || user.getRole() == Role.ADMIN;
        if (!mine && !moderator) {
            throw new ApiException(ErrorCode.RBAC_INSUFFICIENT, "You can only delete your own messages", HttpStatus.FORBIDDEN);
        }
        Instant now = clock.instant();
        m.setDeleted(true);
        m.setDeletedAt(now);
        m.setDeletedBy(user.getUsername());
        m.setUpdatedAt(now);
        Message saved = mongoTemplate.save(m);
        pushNew(saved);
        return MessageDto.present(saved, user.getId());
    }

    // ---------- internals ----------

    private Message newMessage(User user, String body) {
        Instant now = clock.instant();
        Message m = new Message();
        m.setBody(body);
        m.setAuthorId(user.getId());
        m.setAuthorName(user.getName() != null ? user.getName() : user.getUsername());
        m.setAuthorRole(roleOf(user) != null ? roleOf(user) : "unknown");
        m.setCreatedAt(now);
        m.setUpdatedAt(now);
        return m;
    }

    /** Live nudge only (no stored notification, no message body): open views refetch. */
    private void pushNew(Message m) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("scope", m.getScope());
        if ("channel".equals(m.getScope())) {
            payload.put("channelRole", m.getChannelRole());
            streams.send("message:new", payload,
                    c -> channelsFor(c.role(), c.superAdmin()).contains(m.getChannelRole()));
        } else {
            payload.put("refType", m.getRefType());
            payload.put("refId", m.getRefId());
            streams.send("message:new", payload, c -> canUseRecord(m.getRefType(), c.role(), c.superAdmin()));
        }
    }
}
