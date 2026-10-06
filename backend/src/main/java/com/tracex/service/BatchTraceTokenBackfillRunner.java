package com.tracex.service;

import com.mongodb.client.result.UpdateResult;
import com.tracex.model.Batch;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@Order(100)
public class BatchTraceTokenBackfillRunner implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(BatchTraceTokenBackfillRunner.class);

    private final MongoTemplate mongoTemplate;
    private final TraceTokenService traceTokenService;

    public BatchTraceTokenBackfillRunner(MongoTemplate mongoTemplate, TraceTokenService traceTokenService) {
        this.mongoTemplate = mongoTemplate;
        this.traceTokenService = traceTokenService;
    }

    @Override
    public void run(String... args) {
        backfillMissingTokens();
    }

    public synchronized int backfillMissingTokens() {
        Query query = new Query(new Criteria().orOperator(
                Criteria.where("traceToken").is(null),
                Criteria.where("traceToken").exists(false)
        ));

        List<Batch> batchesNeedingTokens = mongoTemplate.find(query, Batch.class);
        if (batchesNeedingTokens.isEmpty()) {
            log.info("[traceToken backfill] No batches missing traceToken. 0 batches updated.");
            return 0;
        }

        int count = 0;
        for (Batch batch : batchesNeedingTokens) {
            String token = traceTokenService.generateToken();
            UpdateResult result = mongoTemplate.updateFirst(
                    Query.query(new Criteria().andOperator(
                            Criteria.where("_id").is(batch.getId()),
                            new Criteria().orOperator(
                                    Criteria.where("traceToken").is(null),
                                    Criteria.where("traceToken").exists(false)
                            )
                    )),
                    Update.update("traceToken", token),
                    Batch.class
            );
            if (result.getModifiedCount() > 0) {
                count++;
            }
        }

        log.info("[traceToken backfill] Completed backfill: {} batch(es) assigned traceToken.", count);
        return count;
    }
}
