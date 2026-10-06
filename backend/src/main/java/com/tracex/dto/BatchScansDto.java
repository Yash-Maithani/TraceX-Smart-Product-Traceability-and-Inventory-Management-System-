package com.tracex.dto;

import java.time.Instant;
import java.util.Map;

public class BatchScansDto {

    private long total;
    private Instant lastScannedAt;
    private Map<String, Long> byDevice;
    private Map<String, Long> bySource;

    public BatchScansDto() {
    }

    public BatchScansDto(long total, Instant lastScannedAt, Map<String, Long> byDevice, Map<String, Long> bySource) {
        this.total = total;
        this.lastScannedAt = lastScannedAt;
        this.byDevice = byDevice;
        this.bySource = bySource;
    }

    public long getTotal() { return total; }
    public void setTotal(long total) { this.total = total; }

    public Instant getLastScannedAt() { return lastScannedAt; }
    public void setLastScannedAt(Instant lastScannedAt) { this.lastScannedAt = lastScannedAt; }

    public Map<String, Long> getByDevice() { return byDevice; }
    public void setByDevice(Map<String, Long> byDevice) { this.byDevice = byDevice; }

    public Map<String, Long> getBySource() { return bySource; }
    public void setBySource(Map<String, Long> bySource) { this.bySource = bySource; }
}
