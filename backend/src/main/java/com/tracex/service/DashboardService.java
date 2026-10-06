package com.tracex.service;

import com.tracex.dto.BatchSummaryDto;
import com.tracex.dto.DashboardSummaryDto;
import com.tracex.model.AccessRequest;
import com.tracex.model.AccessRequestStatus;
import com.tracex.model.Batch;
import com.tracex.model.Role;
import com.tracex.model.User;
import com.tracex.util.BatchFreshness;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;

@Service
public class DashboardService {

    private final MongoTemplate mongoTemplate;
    private final FefoService fefoService;
    private final Clock clock;

    public DashboardService(MongoTemplate mongoTemplate, FefoService fefoService, Clock clock) {
        this.mongoTemplate = mongoTemplate;
        this.fefoService = fefoService;
        this.clock = clock;
    }

    public DashboardSummaryDto getSummary(User currentUser) {
        return getSummary(currentUser, clock);
    }

    public DashboardSummaryDto getSummary(User currentUser, Clock activeClock) {
        long expired = countBatchesForStatus("EXPIRED", activeClock);
        long urgent = countBatchesForStatus("URGENT", activeClock);
        long warning = countBatchesForStatus("WARNING", activeClock);
        long ready = countBatchesForStatus("READY", activeClock);
        long exception = countBatchesForStatus("EXCEPTION", activeClock);
        long dispatched = countBatchesForStatus("DISPATCHED", activeClock);
        long totalActive = expired + urgent + warning + ready + exception;

        long passed = countBatchesForVerdict("PASSED");
        long failed = countBatchesForVerdict("FAILED");
        long flagged = countBatchesForVerdict("FLAGGED");
        long none = countBatchesWithNoVerdict();

        List<BatchSummaryDto> topExpiring = fefoService.getFefoQueue(null, null, activeClock)
                .getQueue()
                .stream()
                .limit(5)
                .toList();

        Long pendingAccessRequests = null;
        if (currentUser != null && canViewPendingAccessRequests(currentUser)) {
            Query pendingQuery = new Query(Criteria.where("status").is(AccessRequestStatus.PENDING));
            pendingAccessRequests = mongoTemplate.count(pendingQuery, AccessRequest.class);
        }

        DashboardSummaryDto dto = new DashboardSummaryDto();
        dto.setBusinessDate(LocalDate.now(activeClock));
        dto.setExpired(expired);
        dto.setUrgent(urgent);
        dto.setWarning(warning);
        dto.setReady(ready);
        dto.setException(exception);
        dto.setDispatched(dispatched);
        dto.setTotalActive(totalActive);
        dto.setStatusCounts(new DashboardSummaryDto.StatusCounts(
                expired, urgent, warning, ready, exception, dispatched
        ));
        dto.setInspectionVerdicts(new DashboardSummaryDto.InspectionVerdictCounts(
                passed, failed, flagged, none
        ));
        dto.setTopExpiring(topExpiring);
        dto.setPendingAccessRequests(pendingAccessRequests);
        return dto;
    }

    /**
     * Reuses the exact same BatchFreshness.applyStatusFilter query builder as BatchService
     * so freshness thresholds are never duplicated.
     */
    private long countBatchesForStatus(String status, Clock activeClock) {
        Query query = new Query();
        query.addCriteria(Criteria.where("isDeleted").is(false));
        BatchFreshness.applyStatusFilter(query, status, activeClock);
        return mongoTemplate.count(query, Batch.class);
    }

    private long countBatchesForVerdict(String verdict) {
        Query query = new Query(
                Criteria.where("isDeleted").is(false)
                        .and("qualityCheck.status").is(verdict)
        );
        return mongoTemplate.count(query, Batch.class);
    }

    private long countBatchesWithNoVerdict() {
        Query query = new Query(
                new Criteria().andOperator(
                        Criteria.where("isDeleted").is(false),
                        new Criteria().orOperator(
                                Criteria.where("qualityCheck").exists(false),
                                Criteria.where("qualityCheck").is(null),
                                Criteria.where("qualityCheck.status").is(null),
                                Criteria.where("qualityCheck.status").nin("PASSED", "FAILED", "FLAGGED")
                        )
                )
        );
        return mongoTemplate.count(query, Batch.class);
    }

    private boolean canViewPendingAccessRequests(User user) {
        if (user.isSuperAdmin()) {
            return true;
        }
        Role role = user.getRole();
        return role == Role.ADMIN || role == Role.MANAGER;
    }
}
