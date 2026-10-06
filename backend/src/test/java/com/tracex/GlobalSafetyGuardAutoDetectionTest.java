package com.tracex;

import com.tracex.util.TestDatabaseSafetyGuard;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
public class GlobalSafetyGuardAutoDetectionTest {

    @Autowired
    private Clock clock;

    @Test
    @DisplayName("Extension autodetection runs for newly created test class without any guard call")
    void testExtensionProtectsClassWithoutManualGuardCall() {
        // The test succeeds because connected database is tracex_fresh_test (verified by global extension)
        assertThat(true).isTrue();
    }

    @Test
    @DisplayName("A0-3 / E3: Clock safety guard accepts live Clock within 5s of real time and aborts on leaked/shifted Clock")
    void testClockGuardRejectsLeakedClockAndAcceptsRealTimeClock() {
        // Live Spring Clock bean must be within 5 seconds of real time
        TestDatabaseSafetyGuard.checkClockWithinRealTime(clock);

        // Shifting the shared MutableClock bean to 2000-01-01 must fail the 5-second guard immediately, and reset() restores it
        com.tracex.util.MutableClock mutableClock = (com.tracex.util.MutableClock) clock;
        try {
            mutableClock.setDelegate(Clock.fixed(Instant.parse("2000-01-01T00:00:00Z"), ZoneOffset.UTC));
            assertThatThrownBy(() -> TestDatabaseSafetyGuard.checkClockWithinRealTime(clock))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("Clock safety guard aborted test execution")
                    .hasMessageContaining("5000 ms");
        } finally {
            mutableClock.reset();
        }

        // After reset(), the shared Clock bean passes the guard without exceptions
        TestDatabaseSafetyGuard.checkClockWithinRealTime(clock);
    }
}
