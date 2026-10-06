package com.tracex.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "scanevents")
@CompoundIndexes({
    @CompoundIndex(name = "batchId_scannedAt_desc_idx", def = "{'batchId': 1, 'scannedAt': -1}")
})
public class ScanEvent {

    @Id
    private String id;

    @Indexed
    private String batchId;

    private String batchCode;
    private Instant scannedAt;
    private String source;
    private String deviceType;
    private String ipHash;

    public ScanEvent() {
    }

    public ScanEvent(String batchId, String batchCode, Instant scannedAt, String source, String deviceType, String ipHash) {
        this.batchId = batchId;
        this.batchCode = batchCode;
        this.scannedAt = scannedAt;
        this.source = source;
        this.deviceType = deviceType;
        this.ipHash = ipHash;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getBatchId() { return batchId; }
    public void setBatchId(String batchId) { this.batchId = batchId; }

    public String getBatchCode() { return batchCode; }
    public void setBatchCode(String batchCode) { this.batchCode = batchCode; }

    public Instant getScannedAt() { return scannedAt; }
    public void setScannedAt(Instant scannedAt) { this.scannedAt = scannedAt; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public String getDeviceType() { return deviceType; }
    public void setDeviceType(String deviceType) { this.deviceType = deviceType; }

    public String getIpHash() { return ipHash; }
    public void setIpHash(String ipHash) { this.ipHash = ipHash; }
}
