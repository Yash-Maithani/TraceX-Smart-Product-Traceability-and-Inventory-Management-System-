package com.tracex.util;

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
        return generateNextCode(this.clock);
    }

    public String generateNextCode(Clock clockToUse) {
        ZoneId zone = ZoneId.of(businessTimezone);
        YearMonth ym = YearMonth.from(clockToUse.instant().atZone(zone));
        String year = String.valueOf(ym.getYear());
        String paddedMonth = String.format("%02d", ym.getMonthValue());
        
        String key = "batch_TX-" + year + "-" + paddedMonth;
        
        Query query = Query.query(Criteria.where("_id").is(key));
        Update update = new Update().inc("seq", 1).setOnInsert("_id", key);
        FindAndModifyOptions options = FindAndModifyOptions.options().upsert(true).returnNew(true);
        
        Counter counter = mongoTemplate.findAndModify(query, update, options, Counter.class);
        long seq = counter != null ? counter.getSeq() : 1L;
        
        String paddedSeq = seq <= 999 ? String.format("%03d", seq) : String.valueOf(seq);
        return "TX-" + year + "-" + paddedMonth + "-" + paddedSeq;
    }
}
