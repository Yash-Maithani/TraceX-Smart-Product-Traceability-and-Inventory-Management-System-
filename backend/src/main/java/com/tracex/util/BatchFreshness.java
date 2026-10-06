package com.tracex.util;

import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

public class BatchFreshness {
    public static final int URGENT_THRESHOLD_DAYS = 7;
    public static final int WARNING_THRESHOLD_DAYS = 30;
    public static final String ISO_LOCAL_DATE_REGEX =
            "^(?:\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|02-(?:0[1-9]|1\\d|2[0-8]))|(?:(?:[02468][048]|[13579][26])00|\\d{2}(?:0[48]|[2468][048]|[13579][26]))-02-29)$";

    public static String computeTier(long daysUntilExpiry) {
        if (daysUntilExpiry <= 0) return "EXPIRED";
        if (daysUntilExpiry <= URGENT_THRESHOLD_DAYS) return "URGENT";
        if (daysUntilExpiry <= WARNING_THRESHOLD_DAYS) return "WARNING";
        return "READY";
    }

    public static int tierPriority(String tier) {
        if ("URGENT".equals(tier)) return 0;
        if ("WARNING".equals(tier)) return 1;
        if ("READY".equals(tier)) return 2;
        return 3;
    }

    public static long calculateDaysUntilExpiry(LocalDate expiryDate, Clock clock) {
        if (expiryDate == null) return Long.MIN_VALUE;
        LocalDate today = LocalDate.now(clock);
        return ChronoUnit.DAYS.between(today, expiryDate);
    }

    public static long calculateDaysUntilExpiry(Instant expiryDate, Clock clock) {
        if (expiryDate == null) return Long.MIN_VALUE;
        LocalDate today = LocalDate.now(clock);
        LocalDate expiryLocal = expiryDate.atZone(clock.getZone()).toLocalDate();
        return ChronoUnit.DAYS.between(today, expiryLocal);
    }

    public static String calculateStatus(String lifecycleState, LocalDate expiryDate, Clock clock) {
        if ("DISPATCHED".equals(lifecycleState)) {
            return "DISPATCHED";
        }
        if (expiryDate == null) {
            return "EXCEPTION";
        }
        long days = calculateDaysUntilExpiry(expiryDate, clock);
        return computeTier(days);
    }

    public static String calculateStatus(String lifecycleState, Instant expiryDate, Clock clock) {
        if ("DISPATCHED".equals(lifecycleState)) {
            return "DISPATCHED";
        }
        if (expiryDate == null) {
            return "EXCEPTION";
        }
        long days = calculateDaysUntilExpiry(expiryDate, clock);
        return computeTier(days);
    }

    public static Instant startOfTomorrow(Clock clock) {
        return LocalDate.now(clock).plusDays(1).atStartOfDay(clock.getZone()).toInstant();
    }

    public static String tomorrowDateString(Clock clock) {
        return LocalDate.now(clock).plusDays(1).toString();
    }

    public static Sort defaultBatchSort() {
        return Sort.by(Sort.Direction.ASC, "expiryDate");
    }

    public static void applyStatusFilter(Query query, String statusFilter, Clock clock) {
        if (statusFilter == null || statusFilter.trim().isEmpty()) {
            return;
        }
        String status = statusFilter.trim().toUpperCase();
        LocalDate today = LocalDate.now(clock);
        String todayStr = today.toString();
        String urgentMaxStr = today.plusDays(URGENT_THRESHOLD_DAYS).toString();
        String warningMaxStr = today.plusDays(WARNING_THRESHOLD_DAYS).toString();

        if ("URGENT".equals(status)) {
            query.addCriteria(new Criteria().andOperator(
                    Criteria.where("lifecycleState").ne("DISPATCHED"),
                    Criteria.where("expiryDate").gt(todayStr).lte(urgentMaxStr),
                    Criteria.where("expiryDate").regex(ISO_LOCAL_DATE_REGEX)
            ));
        } else if ("WARNING".equals(status)) {
            query.addCriteria(new Criteria().andOperator(
                    Criteria.where("lifecycleState").ne("DISPATCHED"),
                    Criteria.where("expiryDate").gt(urgentMaxStr).lte(warningMaxStr),
                    Criteria.where("expiryDate").regex(ISO_LOCAL_DATE_REGEX)
            ));
        } else if ("READY".equals(status)) {
            query.addCriteria(new Criteria().andOperator(
                    Criteria.where("lifecycleState").ne("DISPATCHED"),
                    Criteria.where("expiryDate").gt(warningMaxStr),
                    Criteria.where("expiryDate").regex(ISO_LOCAL_DATE_REGEX)
            ));
        } else if ("EXPIRED".equals(status)) {
            query.addCriteria(new Criteria().andOperator(
                    Criteria.where("lifecycleState").ne("DISPATCHED"),
                    Criteria.where("expiryDate").lte(todayStr),
                    Criteria.where("expiryDate").regex(ISO_LOCAL_DATE_REGEX)
            ));
        } else if ("DISPATCHED".equals(status)) {
            query.addCriteria(Criteria.where("lifecycleState").is("DISPATCHED"));
        } else if ("EXCEPTION".equals(status)) {
            query.addCriteria(new Criteria().andOperator(
                    Criteria.where("lifecycleState").ne("DISPATCHED"),
                    new Criteria().orOperator(
                            Criteria.where("expiryDate").exists(false),
                            Criteria.where("expiryDate").is(null),
                            Criteria.where("expiryDate").not().regex(ISO_LOCAL_DATE_REGEX)
                    )
            ));
        }
    }

    public static Optional<Instant> statusToMaxExpiry(String statusFilter, Instant now) {
        if (statusFilter == null) return Optional.empty();
        return switch (statusFilter.toUpperCase()) {
            case "URGENT" -> Optional.of(now.plus(URGENT_THRESHOLD_DAYS, ChronoUnit.DAYS));
            case "WARNING" -> Optional.of(now.plus(WARNING_THRESHOLD_DAYS, ChronoUnit.DAYS));
            default -> Optional.empty();
        };
    }
}

