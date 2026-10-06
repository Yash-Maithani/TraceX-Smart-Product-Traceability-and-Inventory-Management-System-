import os
import io

base = "backend/src/main/java/com/tracex/"

# BatchCodeGenerator.java
with io.open(base + "util/BatchCodeGenerator.java", "w", encoding="utf-8") as f:
    f.write("""package com.tracex.util;

import com.tracex.model.Counter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.YearMonth;
import java.time.ZoneId;

@Component
public class BatchCodeGenerator {

    private final MongoTemplate mongoTemplate;
    private final Clock clock;
    
    @Value("${tracex.business.timezone:Asia/Kolkata}")
    private String businessTimezone;

    public BatchCodeGenerator(MongoTemplate mongoTemplate, Clock clock) {
        this.mongoTemplate = mongoTemplate;
        this.clock = clock;
    }

    public String generateNextCode() {
        YearMonth ym = YearMonth.now(ZoneId.of(businessTimezone));
        String year = String.valueOf(ym.getYear());
        String paddedMonth = String.format("%02d", ym.getMonthValue());
        
        String key = "batch_TX-" + year + "-" + paddedMonth;
        
        Query query = Query.query(Criteria.where("_id").is(key));
        Update update = new Update().inc("seq", 1).setOnInsert("_id", key);
        FindAndModifyOptions options = FindAndModifyOptions.options().upsert(true).returnNew(true);
        
        Counter counter = mongoTemplate.findAndModify(query, update, options, Counter.class);
        long seq = counter.getSeq();
        
        String paddedSeq = seq <= 999 ? String.format("%03d", seq) : String.valueOf(seq);
        return "TX-" + year + "-" + paddedMonth + "-" + paddedSeq;
    }
}
""")

# BatchFreshness.java
with io.open(base + "util/BatchFreshness.java", "w", encoding="utf-8") as f:
    f.write("""package com.tracex.util;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

public class BatchFreshness {
    public static final int URGENT_THRESHOLD_DAYS = 7;
    public static final int WARNING_THRESHOLD_DAYS = 30;
    
    public static String computeTier(long daysUntilExpiry) {
        if (daysUntilExpiry <= 0) return "EXPIRED";
        if (daysUntilExpiry <= URGENT_THRESHOLD_DAYS) return "URGENT";
        if (daysUntilExpiry <= WARNING_THRESHOLD_DAYS) return "WARNING";
        return "READY";
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
""")
