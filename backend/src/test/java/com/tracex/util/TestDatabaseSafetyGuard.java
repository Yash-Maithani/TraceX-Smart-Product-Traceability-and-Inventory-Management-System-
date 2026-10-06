package com.tracex.util;

import org.springframework.data.mongodb.core.MongoTemplate;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

/**
 * Safety guard for test execution against MongoDB and shared Clock state.
 * 1. Enforces that any test deleting or dropping data MUST be connected to a database
 *    whose name ends with '_test' (e.g. tracex_fresh_test).
 * 2. Enforces that at the start of every test, the shared Clock bean is within 5 seconds
 *    of real wall-clock time so no test can leak a fixed or shifted Clock to later tests.
 */
public final class TestDatabaseSafetyGuard {

    public static final long MAX_CLOCK_DRIFT_MILLIS = 5_000L;

    private TestDatabaseSafetyGuard() {
    }

    public static void checkTestDatabase(MongoTemplate mongoTemplate) {
        if (mongoTemplate == null || mongoTemplate.getDb() == null) {
            throw new IllegalStateException("Test database safety guard: MongoTemplate or Database reference is null");
        }
        String dbName = mongoTemplate.getDb().getName();
        if (dbName == null || !dbName.endsWith("_test")) {
            throw new IllegalStateException(
                    "Safety guard aborted test execution: connected database name '" + dbName +
                    "' does not end with '_test'. Tests that modify data are strictly prohibited from running against non-test databases."
            );
        }
    }

    public static void checkClockWithinRealTime(Clock clock) {
        if (clock == null) {
            throw new IllegalStateException("Clock safety guard: Clock reference is null");
        }
        Instant clockInstant = clock.instant();
        Instant realNow = Instant.now();
        long driftMillis = Math.abs(Duration.between(realNow, clockInstant).toMillis());
        if (driftMillis > MAX_CLOCK_DRIFT_MILLIS) {
            throw new IllegalStateException(
                    "Clock safety guard aborted test execution: shared Clock bean instant (" + clockInstant +
                    ") differs from real time (" + realNow + ") by " + driftMillis +
                    " ms, exceeding the " + MAX_CLOCK_DRIFT_MILLIS + " ms maximum allowed drift."
            );
        }
    }
}
