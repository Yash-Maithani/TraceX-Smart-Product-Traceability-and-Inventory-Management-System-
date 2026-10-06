package com.tracex.util;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Objects;

/**
 * Test-only delegating {@link Clock} that wraps a live {@link Clock#system(ZoneId)} delegate by default,
 * allowing individual tests to temporarily substitute a fixed/offset {@link Clock} and restore the live
 * system-clock delegate in a {@code finally} block via {@link #reset()}.
 */
public class MutableClock extends Clock {

    private final ZoneId defaultZoneId;
    private volatile Clock delegate;

    public MutableClock(ZoneId defaultZoneId) {
        this.defaultZoneId = Objects.requireNonNull(defaultZoneId, "defaultZoneId must not be null");
        this.delegate = Clock.system(this.defaultZoneId);
    }

    public void setDelegate(Clock newDelegate) {
        this.delegate = Objects.requireNonNull(newDelegate, "newDelegate must not be null");
    }

    /**
     * Restores the delegate to a live system-clock instance ({@link Clock#system(ZoneId)}),
     * never a static {@link Instant#now()} snapshot.
     */
    public void reset() {
        this.delegate = Clock.system(this.defaultZoneId);
    }

    public ZoneId getDefaultZoneId() {
        return defaultZoneId;
    }

    @Override
    public ZoneId getZone() {
        return delegate.getZone();
    }

    @Override
    public Clock withZone(ZoneId zone) {
        return delegate.withZone(zone);
    }

    @Override
    public Instant instant() {
        return delegate.instant();
    }
}
