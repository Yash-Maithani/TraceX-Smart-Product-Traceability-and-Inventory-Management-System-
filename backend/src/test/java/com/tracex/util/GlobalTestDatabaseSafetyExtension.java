package com.tracex.util;

import org.junit.jupiter.api.extension.AfterEachCallback;
import org.junit.jupiter.api.extension.BeforeEachCallback;
import org.junit.jupiter.api.extension.ExtensionContext;
import org.springframework.context.ApplicationContext;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.test.context.junit.jupiter.SpringExtension;

import java.time.Clock;
import java.util.TimeZone;

/**
 * Global JUnit 5 extension that runs automatically around every test method:
 * 1. Verifies the connected MongoDB database name ends with '_test' before any test runs.
 * 2. Verifies at the start of every test that the shared Clock bean is within 5 seconds of real time.
 * 3. Captures and restores TimeZone.getDefault() around every test method.
 *
 * Note: This guard never modifies database collections or re-seeds data.
 */
public class GlobalTestDatabaseSafetyExtension implements BeforeEachCallback, AfterEachCallback {

    private static final ExtensionContext.Namespace NAMESPACE =
            ExtensionContext.Namespace.create(GlobalTestDatabaseSafetyExtension.class);
    private static final String SAVED_TIMEZONE_KEY = "savedDefaultTimeZone";

    @Override
    public void beforeEach(ExtensionContext context) {
        context.getStore(NAMESPACE).put(SAVED_TIMEZONE_KEY, TimeZone.getDefault());
        ApplicationContext springContext;
        try {
            springContext = SpringExtension.getApplicationContext(context);
        } catch (Exception ignored) {
            // Non-Spring unit tests do not have a Spring ApplicationContext
            return;
        }

        if (springContext != null) {
            if (springContext.containsBean("mongoTemplate")) {
                MongoTemplate mongoTemplate = springContext.getBean(MongoTemplate.class);
                TestDatabaseSafetyGuard.checkTestDatabase(mongoTemplate);
            }
            if (springContext.getBeanNamesForType(Clock.class).length > 0) {
                Clock clock = springContext.getBean(Clock.class);
                TestDatabaseSafetyGuard.checkClockWithinRealTime(clock);
            }
        }
    }

    @Override
    public void afterEach(ExtensionContext context) {
        TimeZone saved = context.getStore(NAMESPACE).remove(SAVED_TIMEZONE_KEY, TimeZone.class);
        if (saved != null) {
            TimeZone.setDefault(saved);
        }
    }
}
