package com.tracex.service;

import com.tracex.dto.ProductReportDto;
import com.tracex.dto.ProductReportRequestDto;
import com.tracex.exception.ResourceNotFoundException;
import com.tracex.exception.ValidationException;
import com.tracex.model.Batch;
import com.tracex.model.ProductReport;
import com.tracex.model.User;
import com.tracex.repository.BatchRepository;
import com.tracex.repository.ProductReportRepository;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.util.List;
import java.util.Map;

/**
 * Shopper problem reports (pick-list #2). A shopper reports from the public QR page using the batch's
 * trace token; the quality team is notified and resolves the report from the batch detail page.
 */
@Service
public class ProductReportService {

    static final Map<String, String> CATEGORY_LABELS = Map.of(
            "TASTE_OR_SMELL", "Taste or smell",
            "PACKAGING", "Damaged packaging",
            "FOREIGN_OBJECT", "Something in the product",
            "ILLNESS", "Felt unwell",
            "EXPIRY", "Date or freshness",
            "OTHER", "Other"
    );

    private final ProductReportRepository reportRepository;
    private final BatchRepository batchRepository;
    private final TraceTokenService traceTokenService;
    private final NotificationService notificationService;
    private final AuditService auditService;
    private final Clock clock;

    public ProductReportService(ProductReportRepository reportRepository, BatchRepository batchRepository,
                                TraceTokenService traceTokenService, NotificationService notificationService,
                                AuditService auditService, Clock clock) {
        this.reportRepository = reportRepository;
        this.batchRepository = batchRepository;
        this.traceTokenService = traceTokenService;
        this.notificationService = notificationService;
        this.auditService = auditService;
        this.clock = clock;
    }

    public void submit(ProductReportRequestDto dto, String clientIp) {
        if (!traceTokenService.isValidToken(dto.getToken())) {
            throw new ResourceNotFoundException("Batch not found or unavailable");
        }
        Batch batch = batchRepository.findByTraceToken(dto.getToken())
                .filter(b -> !b.isDeleted())
                .orElseThrow(() -> new ResourceNotFoundException("Batch not found or unavailable"));

        ProductReport report = new ProductReport();
        report.setBatchId(batch.getId());
        report.setBatchCode(batch.getBatchCode());
        report.setProductName(batch.getProductName());
        report.setCategory(dto.getCategory());
        report.setMessage(dto.getMessage().trim());
        String contact = dto.getContact() == null ? null : dto.getContact().trim();
        report.setContact(contact == null || contact.isEmpty() ? null : contact);
        report.setIpHash(traceTokenService.keyedHash("report-ip", clientIp != null ? clientIp : "unknown"));
        report.setCreatedAt(clock.instant());
        reportRepository.save(report);

        // The notification names the batch and the category only, never the shopper's words or contact
        notificationService.productReportSubmitted(batch.getId(), batch.getBatchCode(), batch.getProductName(),
                CATEGORY_LABELS.get(dto.getCategory()), "ILLNESS".equals(dto.getCategory()));
    }

    public List<ProductReportDto> listForBatch(String batchId) {
        batchRepository.findById(batchId)
                .filter(b -> !b.isDeleted())
                .orElseThrow(() -> new ResourceNotFoundException("Batch not found"));
        return reportRepository.findByBatchIdOrderByCreatedAtDesc(batchId).stream()
                .map(ProductReportDto::from)
                .toList();
    }

    public ProductReportDto resolve(String reportId, String note, User actor) {
        ProductReport report = reportRepository.findById(reportId)
                .orElseThrow(() -> new ResourceNotFoundException("Report not found"));
        if (ProductReport.STATUS_RESOLVED.equals(report.getStatus())) {
            throw new ValidationException("status", "This report is already resolved.");
        }
        report.setStatus(ProductReport.STATUS_RESOLVED);
        report.setResolvedAt(clock.instant());
        report.setResolvedByName(actor.getName());
        String trimmed = note == null ? null : note.trim();
        report.setResolutionNote(trimmed == null || trimmed.isEmpty() ? null : trimmed);
        ProductReport saved = reportRepository.save(report);
        auditService.record(actor, "PRODUCT_REPORT_RESOLVED", "BATCH", report.getBatchId(),
                "Shopper report on batch " + report.getBatchCode() + " marked resolved");
        notificationService.broadcastChange("batch:updated", report.getBatchId());
        return ProductReportDto.from(saved);
    }
}
