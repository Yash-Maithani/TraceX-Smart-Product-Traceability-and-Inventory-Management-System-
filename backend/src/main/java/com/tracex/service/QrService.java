package com.tracex.service;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;
import com.tracex.dto.*;
import com.tracex.exception.ResourceNotFoundException;
import com.tracex.exception.ValidationException;
import com.tracex.model.Batch;
import com.tracex.model.ScanEvent;
import com.tracex.repository.BatchRepository;
import com.tracex.repository.ScanEventRepository;
import com.tracex.security.RateLimiter;
import com.tracex.util.BatchFreshness;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

@Service
public class QrService {

    private static final Set<String> VALID_SOURCES = Set.of("factory", "buyer", "QA");

    private final BatchRepository batchRepository;
    private final ScanEventRepository scanEventRepository;
    private final TraceTokenService traceTokenService;
    private final RateLimiter rateLimiter;
    private final Clock clock;
    private final MongoTemplate mongoTemplate;
    private final String publicTraceBaseUrl;

    public QrService(
            BatchRepository batchRepository,
            ScanEventRepository scanEventRepository,
            TraceTokenService traceTokenService,
            RateLimiter rateLimiter,
            Clock clock,
            MongoTemplate mongoTemplate,
            @Value("${tracex.security.public-trace-base-url:http://localhost:5174}") String publicTraceBaseUrl
    ) {
        this.batchRepository = batchRepository;
        this.scanEventRepository = scanEventRepository;
        this.traceTokenService = traceTokenService;
        this.rateLimiter = rateLimiter;
        this.clock = clock;
        this.mongoTemplate = mongoTemplate;
        this.publicTraceBaseUrl = (publicTraceBaseUrl != null && publicTraceBaseUrl.endsWith("/"))
                ? publicTraceBaseUrl.substring(0, publicTraceBaseUrl.length() - 1)
                : (publicTraceBaseUrl != null ? publicTraceBaseUrl : "http://localhost:5174");
    }

    public String generateQrDataUrl(String content) {
        try {
            QRCodeWriter qrCodeWriter = new QRCodeWriter();
            Map<EncodeHintType, Object> hints = new EnumMap<>(EncodeHintType.class);
            hints.put(EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.M);
            hints.put(EncodeHintType.MARGIN, 1);
            hints.put(EncodeHintType.CHARACTER_SET, "UTF-8");

            BitMatrix bitMatrix = qrCodeWriter.encode(content, BarcodeFormat.QR_CODE, 512, 512, hints);

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            MatrixToImageWriter.writeToStream(bitMatrix, "PNG", baos);
            byte[] pngBytes = baos.toByteArray();

            return "data:image/png;base64," + Base64.getEncoder().encodeToString(pngBytes);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to generate QR code", e);
        }
    }

    public PublicTraceDto getPublicTrace(String token) {
        // Fast constant-time validation before any DB lookup
        if (!traceTokenService.isValidToken(token)) {
            throw new ResourceNotFoundException("Batch not found or unavailable");
        }

        Batch batch = batchRepository.findByTraceToken(token)
                .orElseThrow(() -> new ResourceNotFoundException("Batch not found or unavailable"));

        if (batch.isDeleted()) {
            throw new ResourceNotFoundException("Batch not found or unavailable");
        }

        String status = BatchFreshness.calculateStatus(batch.getLifecycleState(), batch.getExpiryDate(), clock);
        LocalDate expiryDate = "EXCEPTION".equals(status) ? null : batch.getExpiryDate();

        PublicTraceDto dto = new PublicTraceDto();
        dto.setBatchCode(batch.getBatchCode());
        dto.setProductName(batch.getProductName());
        dto.setSku(batch.getSku());
        dto.setVillage(batch.getVillage());
        dto.setPackDate(batch.getPackDate());
        dto.setExpiryDate(expiryDate);
        dto.setStatus(status);

        if (batch.getQualityCheck() != null) {
            dto.setQualityCheck(new PublicTraceDto.QualityCheckPublicDto(
                    batch.getQualityCheck().getStatus(),
                    batch.getQualityCheck().getRating(),
                    batch.getQualityCheck().getInspectedAt()
            ));
        } else {
            dto.setQualityCheck(null);
        }

        dto.setTraceabilityNote(batch.getTraceabilityNote());
        return dto;
    }

    public void recordScan(String token, String source, HttpServletRequest request) {
        if (!traceTokenService.isValidToken(token)) {
            throw new ResourceNotFoundException("Batch not found or unavailable");
        }

        String effectiveSource = (source == null || source.isBlank()) ? "buyer" : source.trim();
        if (!VALID_SOURCES.contains(effectiveSource)) {
            throw new ValidationException("Validation failed", List.of(
                    new FieldErrorDto("source", "Invalid source value. Must be one of: factory, buyer, QA")
            ));
        }

        Batch batch = batchRepository.findByTraceToken(token)
                .orElseThrow(() -> new ResourceNotFoundException("Batch not found or unavailable"));

        if (batch.isDeleted()) {
            // Archived batches record nothing
            throw new ResourceNotFoundException("Batch not found or unavailable");
        }

        String userAgent = request != null ? request.getHeader("User-Agent") : null;
        String deviceType = parseDeviceType(userAgent);

        String clientIp = rateLimiter.resolveClientIp(request);
        String ipHash = hashIp(clientIp);

        ScanEvent event = new ScanEvent(
                batch.getId(),
                batch.getBatchCode(),
                clock.instant(),
                effectiveSource,
                deviceType,
                ipHash
        );
        scanEventRepository.save(event);
    }

    public BatchQrDto getBatchQr(String batchId) {
        Batch batch = batchRepository.findById(batchId)
                .orElseThrow(() -> new ResourceNotFoundException("Batch not found"));

        if (batch.isDeleted()) {
            throw new ResourceNotFoundException("Batch not found");
        }

        String token = batch.getTraceToken();
        if (token == null || token.isBlank()) {
            String candidateToken = traceTokenService.generateToken();
            Query query = Query.query(new Criteria().andOperator(
                    Criteria.where("_id").is(batchId),
                    new Criteria().orOperator(
                            Criteria.where("traceToken").is(null),
                            Criteria.where("traceToken").exists(false),
                            Criteria.where("traceToken").is("")
                    )
            ));
            Update update = Update.update("traceToken", candidateToken);
            FindAndModifyOptions options = FindAndModifyOptions.options().returnNew(true);
            Batch updated = mongoTemplate.findAndModify(query, update, options, Batch.class);
            if (updated != null && updated.getTraceToken() != null && !updated.getTraceToken().isBlank()) {
                token = updated.getTraceToken();
            } else {
                Batch refreshed = batchRepository.findById(batchId)
                        .orElseThrow(() -> new ResourceNotFoundException("Batch not found"));
                token = refreshed.getTraceToken();
            }
        }

        String qrAbsoluteUrl = publicTraceBaseUrl + "/trace/t/" + token;
        String qrCodeDataUrl = generateQrDataUrl(qrAbsoluteUrl);

        return new BatchQrDto(qrCodeDataUrl, qrAbsoluteUrl);
    }

    public BatchScansDto getBatchScans(String batchId) {
        Batch batch = batchRepository.findById(batchId)
                .orElseThrow(() -> new ResourceNotFoundException("Batch not found"));

        if (batch.isDeleted()) {
            throw new ResourceNotFoundException("Batch not found");
        }

        long total = mongoTemplate.count(Query.query(Criteria.where("batchId").is(batchId)), ScanEvent.class);

        Query latestQuery = Query.query(Criteria.where("batchId").is(batchId))
                .with(Sort.by(Sort.Direction.DESC, "scannedAt"))
                .limit(1);
        ScanEvent latest = mongoTemplate.findOne(latestQuery, ScanEvent.class);
        Instant lastScannedAt = latest != null ? latest.getScannedAt() : null;

        Map<String, Long> byDevice = new LinkedHashMap<>();
        byDevice.put("Mobile", mongoTemplate.count(Query.query(Criteria.where("batchId").is(batchId).and("deviceType").is("Mobile")), ScanEvent.class));
        byDevice.put("Tablet", mongoTemplate.count(Query.query(Criteria.where("batchId").is(batchId).and("deviceType").is("Tablet")), ScanEvent.class));
        byDevice.put("Desktop", mongoTemplate.count(Query.query(Criteria.where("batchId").is(batchId).and("deviceType").is("Desktop")), ScanEvent.class));
        byDevice.put("Unknown", mongoTemplate.count(Query.query(Criteria.where("batchId").is(batchId).and("deviceType").is("Unknown")), ScanEvent.class));

        Map<String, Long> bySource = new LinkedHashMap<>();
        bySource.put("factory", mongoTemplate.count(Query.query(Criteria.where("batchId").is(batchId).and("source").is("factory")), ScanEvent.class));
        bySource.put("buyer", mongoTemplate.count(Query.query(Criteria.where("batchId").is(batchId).and("source").is("buyer")), ScanEvent.class));
        bySource.put("QA", mongoTemplate.count(Query.query(Criteria.where("batchId").is(batchId).and("source").is("QA")), ScanEvent.class));

        return new BatchScansDto(total, lastScannedAt, byDevice, bySource);
    }

    private String parseDeviceType(String userAgent) {
        if (userAgent == null || userAgent.isBlank()) {
            return "Unknown";
        }
        if (userAgent.matches("(?i).*?(ipad|tablet|kindle).*?")) {
            return "Tablet";
        }
        if (userAgent.matches("(?i).*?(mobi|android|iphone).*?")) {
            return "Mobile";
        }
        return "Desktop";
    }

    private String hashIp(String clientIp) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(traceTokenService.getSecretKeyBytes(), "HmacSHA256"));
            byte[] hmac = mac.doFinal((clientIp != null ? clientIp : "unknown").getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hmac);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to hash IP", e);
        }
    }
}
