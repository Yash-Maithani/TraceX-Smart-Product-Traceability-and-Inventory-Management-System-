# Phase 8: Bulk CSV Import (Backend + UI)

**Status**: COMPLETE  
**Date**: 2026-10-06  
**Baseline**: `477` backend tests, `75` frontend unit tests (`13` files), `37` Playwright E2E tests (`4` files)  
**Phase 8 Totals**: `542` backend tests (`+65`: `+49` in `RbacMatrixTest`, `+16` in `ImportTests`), `88` frontend unit tests (`15` files, `+13`: `+8` in `csvParser.test.ts`, `+5` in `ImportPage.test.tsx`), `39` Playwright E2E tests (`5` files, `+2` in `phase08.spec.ts`), `0` failures  
**New Dependencies Added**: None (`0` backend, `0` frontend)

---

## Step 0: Pre-Build Checks & Code Audit

### 0.1 Confirm `PROGRESS.md` Shows Phase 8.0 `COMPLETE` and `D-23` / `D-24` as `Proposed`

Command:
```powershell
Select-String -Path PROGRESS.md -Pattern "\| 8\.0 \||\| D-23 \||\| D-24 \|" | ForEach-Object { "$($_.FileName):$($_.LineNumber): $($_.Line)" } | Tee-Object -FilePath docs\progress\evidence\phase-08\step0-progress-check.txt
```

Output (`docs/progress/evidence/phase-08/step0-progress-check.txt`):
```text
PROGRESS.md:29: | 8.0 | Import reference extraction, SPEC §3.7, and Phase 7.1 carry-over | COMPLETE | 2026-10-06 | [phase-08-0](docs/progress/phase-08-0.md) |
PROGRESS.md:66: | D-23 | Import batch creation & validation code path | Proposed | Import commit creates batches through the same `BatchService` creation path as `POST /api/v1/batches` (so each imported batch gets an atomic `TX-YYYY-MM-NNN` batch code from `BatchCodeGenerator`, a `traceToken`, runtime freshness derivation, and standard validation), never by writing documents directly. Row validation reuses existing batch validators with no copied rules | SPEC §3.7 |
PROGRESS.md:67: | D-24 | Import rollback semantics & guards | Proposed | Rollback soft-deletes only the batches the job inserted, using the same archive operation as `DELETE /api/v1/batches/{id}` with the reason `"Import rollback <jobId>"` and an audit entry; it never hard-deletes and does not undo updates made to existing batches. Rollback returns HTTP `409 CONFLICT` (changing nothing) when any inserted batch has since been dispatched, when the job status is not `done`, or when it was already rolled back | SPEC §3.7 |
```

### 0.2 Code Audit Findings (`DISPATCHED` Representation & `packDate` Future-Date Check)

1. **How a `DISPATCHED` batch is represented**:
   - In `Batch.java` (lines 50–62), a batch has `private String lifecycleState = "ACTIVE";` and `private List<DispatchHistoryEntry> dispatchHistory = new ArrayList<>();`.
   - In `BatchService.java` (`dispatchBatch`, lines 224–226 and 311–316), dispatching checks `if ("DISPATCHED".equals(batch.getLifecycleState()))` and atomically sets `.set("lifecycleState", "DISPATCHED")` alongside `.push("dispatchHistory", historyEntry)`.
   - In `BatchFreshness.java` (`calculateStatus`, lines 42–45, and `applyStatusFilter`, lines 113–114), a batch's `DISPATCHED` status is determined strictly by `"DISPATCHED".equals(lifecycleState)` (`Criteria.where("lifecycleState").is("DISPATCHED")`).
   - Therefore, `ImportService.rollbackJob` checks `"DISPATCHED".equals(batch.getLifecycleState())` on each inserted batch before archiving.
2. **Whether `POST /api/v1/batches` rejects a future `packDate`**:
   - In `BatchCreateDto.java` (lines 56–60), `packDate` has `@NotNull`, `@JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")`, and `@JsonDeserialize(using = FlexibleLocalDateDeserializer.class)` — no `@PastOrPresent` annotation.
   - In `BatchService.java` (`createBatch`, lines 63–119), `createBatch` does not reject a future `packDate` (unlike `dispatchDate`, which explicitly checks `effectiveDispatchDate.isAfter(today)`).
   - Therefore, per `D-23`, import validation reuses the exact batch validation rules and does not invent a future-`packDate` restriction.
3. **Oversize / Empty `rows` Error Code (`ErrorCode.java` & `SPEC.md` §6.2)**:
   - `ErrorCode.java` defines `VALIDATION_ERROR` (`422`) and does not define a separate oversize error code; therefore empty `rows`, `> 500` rows per request, and `> 10,000` rows per job all return `422 VALIDATION_ERROR` with a `fieldErrors` entry on `"rows"`.

Output (`docs/progress/evidence/phase-08/step0-code-audit.txt`):
```text
=== 1. Batch.java lifecycleState & dispatchHistory (lines 48-62) ===
    private String dataSource;
    private String shelfLifeSource;
    private String lifecycleState = "ACTIVE";
    private double priorityScore;
    @ValueConverter(BatchLocalDateValueConverter.class)
    private LocalDate dispatchDate;
    private String buyerName;
    private String traceabilityNote;
    private String createdBy;
    
    private List<NoteHistoryEntry> noteHistory = new ArrayList<>();
    private QualityCheck qualityCheck;
    private List<DispatchHistoryEntry> dispatchHistory = new ArrayList<>();
    
    private boolean isDeleted = false;
=== 2. BatchService.java dispatchBatch lifecycleState check & transition (lines 223-230, 310-322) ===

        // 2. Not already DISPATCHED (else 409 CONFLICT)
        if ("DISPATCHED".equals(batch.getLifecycleState())) {
            throw new ApiException(ErrorCode.CONFLICT, "Batch is already dispatched", HttpStatus.CONFLICT);
        }

        // 3. Not expired (daysUntilExpiry > 0, else 409 BATCH_EXPIRED)
        long daysUntilExpiry = BatchFreshness.calculateDaysUntilExpiry(batch.getExpiryDate(), clockToUse);
---
                outOfOrder ? trimmedOverrideReason : null,
                outOfOrder
        );

        Update update = new Update()
                .set("lifecycleState", "DISPATCHED")
                .set("buyerName", trimmedBuyerName)
                .set("dispatchDate", effectiveDispatchDate.toString())
                .set("updatedAt", now)
                .push("dispatchHistory", historyEntry);

        if (outOfOrder) {
            String earlierCode = earlierBatchOpt.get().getBatchCode();
=== 3. BatchFreshness.java DISPATCHED check (lines 45-50, 112-117) ===

    public static String calculateStatus(String lifecycleState, LocalDate expiryDate, Clock clock) {
        if ("DISPATCHED".equals(lifecycleState)) {
            return "DISPATCHED";
        }
        if (expiryDate == null) {
---
                    Criteria.where("expiryDate").regex(ISO_LOCAL_DATE_REGEX)
            ));
        } else if ("DISPATCHED".equals(status)) {
            query.addCriteria(Criteria.where("lifecycleState").is("DISPATCHED"));
        } else if ("EXCEPTION".equals(status)) {
            query.addCriteria(new Criteria().andOperator(
=== 4. BatchCreateDto.java packDate annotations (lines 24-30) & BatchService.createBatch (lines 154-210) ===
    private double yieldPercent;
    @NotNull
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    @JsonDeserialize(using = FlexibleLocalDateDeserializer.class)
    @Schema(type = "string", format = "date", example = "2026-10-09")
    private LocalDate packDate;
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
---
    public BatchDetailDto createBatch(BatchCreateDto dto, String createdByUsername, String requestId) {
        Product product = productRepository.findById(dto.getProductId())
                .orElseThrow(() -> new ResourceNotFoundException("Product not found"));

        LocalDate expiryDate;
        String dataSource;
        String shelfLifeSource;

        if (dto.getExpiryDate() != null) {
            expiryDate = dto.getExpiryDate();
            dataSource = "fallback";
            shelfLifeSource = "manual";
        } else if (product.getPredictedShelfLifeDays() != null) {
            expiryDate = dto.getPackDate().plusDays(product.getPredictedShelfLifeDays());
            dataSource = "predicted";
            shelfLifeSource = "predicted";
        } else {
            expiryDate = dto.getPackDate().plusDays(product.getBaseShelfLifeDays());
            dataSource = "fallback";
            shelfLifeSource = "base";
        }

        double priorityScore = fefoService.computePriorityScore(expiryDate, product.getRiskLevel(), clock);

        Batch batch = new Batch();
        batch.setProductId(product.getId());
        batch.setProductName(product.getProductName());
        batch.setSku(product.getSku());
        batch.setSourceLotCode(dto.getSourceLotCode().trim().toUpperCase());
        batch.setFarmerName(dto.getFarmerName().trim());
        batch.setVillage(dto.getVillage().trim());
        batch.setQuantityProduced(dto.getQuantityProduced());
        batch.setUnit(dto.getUnit());
        batch.setYieldPercent(dto.getYieldPercent());
        batch.setPackDate(dto.getPackDate());
        batch.setExpiryDate(expiryDate);
        batch.setDataSource(dataSource);
        batch.setShelfLifeSource(shelfLifeSource);
        batch.setPriorityScore(priorityScore);
        batch.setLifecycleState("ACTIVE");

        if (dto.getTraceabilityNote() != null && !dto.getTraceabilityNote().trim().isEmpty()) {
            batch.setTraceabilityNote(dto.getTraceabilityNote().trim());
        } else {
            batch.setTraceabilityNote("Best before " + expiryDate.toString());
        }

        batch.setCreatedBy(createdByUsername);
        batch.setBatchCode(batchCodeGenerator.generateNextCode());
        batch.setTraceToken(traceTokenService.generateToken());

        Batch saved = batchRepository.save(batch);

        auditService.record(null, createdByUsername, "BATCH_CREATED", "BATCH", saved.getId(), "Batch created: " + saved.getBatchCode());

        return mapToDetail(saved);
    }
=== 5. ErrorCode.java (all lines) ===
package com.tracex.exception;

public enum ErrorCode {
    AUTH_NO_TOKEN,
    AUTH_INVALID_TOKEN,
    AUTH_SESSION_REVOKED,
    AUTH_ACCOUNT_DELETED,
    AUTH_ACCOUNT_INACTIVE,
    RBAC_INSUFFICIENT,
    NOT_FOUND,
    CONFLICT,
    DISPATCH_OUT_OF_ORDER,
    DISPATCH_EXPIRED,
    BATCH_EXPIRED,
    QUALITY_HOLD,
    VALIDATION_ERROR,
    METHOD_NOT_ALLOWED,
    RATE_LIMITED,
    AI_UNAVAILABLE,
    INTERNAL_ERROR,
    LAST_SUPERADMIN,
    SELF_MODIFICATION_NOT_ALLOWED
}
```

---

## Part 0: Two Corrections in `docs/progress/phase-08-0.md` and `PROGRESS.md`

1. **`management.health.mail.enabled=false` wording**: Reworded `docs/progress/phase-08-0.md` (lines 204–210) and `PROGRESS.md` (line 376) to state accurately that `management.health.mail.enabled=false` was removed from base `application.properties` and added to `application-dev.properties` and `application-test.properties`, whereas `application-e2e.properties` already had `management.health.mail.enabled=false` and was not modified.
2. **Markdown table linter file count (`34`)**: Verified `docs/progress/evidence/phase-08-0/lint-md-tables.txt` shows `34` Markdown files checked, and updated `docs/progress/phase-08-0.md` and `PROGRESS.md` to use `34` everywhere.

Output (`docs/progress/evidence/phase-08/part0-corrections.txt`):
```text
=== Part 0.1: docs/progress/phase-08-0.md lines 204-210 & PROGRESS.md line 376 ===
## Verification 3 (Part 0 Item 3): `management.health.mail.enabled=false` Scoped to `dev`, `test`, and `e2e` Profiles

### Decision & Reason
- **Decision**: Removed `management.health.mail.enabled=false` from base `backend/src/main/resources/application.properties` and added it to `application-dev.properties` and `application-test.properties` (`backend/src/test/resources/application-test.properties`); `application-e2e.properties` already had `management.health.mail.enabled=false` and was not modified (as shown in the Verification 6 file modification list at lines 474–476). Thus `management.health.mail.enabled=false` is active only in the `dev`, `test`, and `e2e` profiles. Recorded in `SPEC.md` §8.3 and `PROGRESS.md`.
- **Reason**: The `dev`, `test`, and `e2e` profiles set `tracex.mail.sink.enabled=true` (`DevMailSink`) and have no SMTP server running on `localhost:587` (except during `SmtpEmailServiceTest`, which starts an embedded GreenMail server on a test port). Leaving `MailHealthIndicator` enabled in those three profiles would cause `/actuator/health` to fail with `503 DOWN` attempting to connect to `localhost:587`. Removing `management.health.mail.enabled=false` from base `application.properties` ensures `prod` (`tracex.mail.sink.enabled=false`, where `SmtpEmailService` is active) does not silently inherit a disabled mail health check.

### Profile Files (`docs/progress/evidence/phase-08-0/profile-files.txt`)
---
- **Part 0 Item 3 (`management.health.mail.enabled=false` Scoped to `dev`, `test`, and `e2e` Profiles)**: Removed `management.health.mail.enabled=false` from base `backend/src/main/resources/application.properties` and added it to `application-dev.properties` and `application-test.properties` (`application-e2e.properties` already had `management.health.mail.enabled=false` and was not modified), because those three profiles use `DevMailSink` (`tracex.mail.sink.enabled=true`) with no SMTP server on `localhost:587`, whereas `prod` uses `SmtpEmailService`. Documented in `SPEC.md` §8.3, verified `/actuator/health` returns `{"status":"UP"}` under `dev` and `prod` (`actuator-health.txt`), and verified `.\mvnw.cmd clean verify` passes (`477` tests, `0` failures, `mvnw-verify.txt`).
- **Part A (Bulk Import Reference Extraction)**: Audited `import.controller.js`, `ImportJob.model.js`, `import.routes.js`, `requireAdmin.js`, `expiryCalculator.js`, `productContract.js`, `ImportPanel.jsx`, `useImport.js`, `csvParser.js`, `csvParser.test.js`, and `rbac.test.js` in the reference workspace and wrote `docs/00-audit/import-reference.md` covering all 11 required sections with exact file/line citations and verbatim code excerpts (`<= 15` lines each).
- **Part B (`SPEC.md` §3.7, Deviations Table, `D-23`, `D-24`, Role Wording, and Open Questions)**: Added `SPEC.md` §3.7 (`Bulk Import`) and the 3-column Deviations Table, recorded `D-23` and `D-24` as `Proposed` in `PROGRESS.md` and `SPEC.md`, aligned `SPEC.md` §2 and §6.3 importer role wording with `requireImporter` and `docs/permission-matrix.csv` (`super-admin`, `admin`, `manager`, `factory-manager`), verified `scripts/lint-md-tables.ps1` passed across `34` Markdown files (`lint-md-tables.txt`), and documented Phase 8 open questions in [docs/progress/phase-08-0.md](docs/progress/phase-08-0.md).
=== Part 0.2: docs/progress/evidence/phase-08-0/lint-md-tables.txt ===
=== Markdown Table Linter ===
Scanning 34 Markdown files...


=== Summary ===
Files checked: 34
Errors: 0
Warnings: 0
STATUS: PASSED (Zero problems found)
--- docs/progress/phase-08-0.md lines 538-555 ---
### 7b. Markdown Table Linter (`scripts\lint-md-tables.ps1` — 34 Markdown files)
Command:
```powershell
powershell -ExecutionPolicy Bypass -File scripts\lint-md-tables.ps1 2>&1 | Tee-Object -FilePath docs\progress\evidence\phase-08-0\lint-md-tables.txt
```

Output (`docs/progress/evidence/phase-08-0/lint-md-tables.txt` — 34 files checked after `docs/progress/phase-08-0.md` was created):
```text
=== Markdown Table Linter ===
Scanning 34 Markdown files...


=== Summary ===
Files checked: 34
Errors: 0
Warnings: 0
STATUS: PASSED (Zero problems found)
```
```

---

## Part A: Decisions Applied (`SPEC.md` §3.7, `D-23`, `D-24`, `PROGRESS.md`)

All 10 Part A decisions were incorporated into `SPEC.md` §3.7 and `PROGRESS.md`, and `D-23` / `D-24` were marked `Resolved` after verification:
1. **Job join and ownership**: `POST /api/v1/import/commit` with a `jobId` requires the job to exist and `job.createdBy == actor.username`, else `404 NOT_FOUND`. Status must be `"running"`, else `409 CONFLICT`. A chunk that would push `processedRows + rows.size() > 10,000` returns `422 VALIDATION_ERROR` with `fieldErrors` on `"rows"`.
2. **Stuck jobs**: Added `updatedAt` to `ImportJob`. Any `"running"` job with `updatedAt < now - tracex.import.stale-running-minutes` (default `15`) is lazily marked `"failed"` with `finishedAt` set on list, detail, commit, and rollback. Rollback is allowed for `"done"` OR `"failed"` jobs with non-empty `insertedBatchIds`; `409 CONFLICT` remains for `"running"`, `"rolled_back"`, or empty `insertedBatchIds`.
3. **Cross-chunk duplicates**: `POST /api/v1/import/validate` returns `insertKey` (`<sku>|<sourceLotCode>|<packDate>`) for every `insert` row and accepts optional `priorKeys` on subsequent chunks (`skip` with reason `"Duplicate of an earlier row in this file"`). Dedupe DB lookups filter by `isDeleted = false` only.
4. **Row count errors**: Empty `rows`, `> 500` rows per request, and `> 10,000` rows per job all return `422 VALIDATION_ERROR` with `fieldErrors` on `"rows"`.
5. **Skipped rows never count as errors**: When `isFinal=true`, `status = (inserted == 0 && errored > 0) ? "failed" : "done"`. All-skipped jobs finish as `"done"`.
6. **Row-error cap**: `ImportJob.rowErrors` is capped at `500` entries with `boolean rowErrorsTruncated` (`true` when truncated), while `errored` counts all errored rows.
7. **`rowNumber` semantics**: Uses the client's 1-based `rowIndex` plus `1` when positive (`rowIndex + 1`), or `chunkIndex * 500 + i + 2`.
8. **Partial archive before rollback**: Rollback checks all preconditions first (`409 CONFLICT` if any inserted batch has `lifecycleState == "DISPATCHED"`, changing nothing). Otherwise it skips already-archived (`isDeleted == true`) batches, archives the remaining active ones via `BatchService.archiveBatch` with reason `"Import rollback <jobId>"`, and returns `{ jobId, status: "rolled_back", archived, alreadyArchived, rolledBackAt, rolledBackBy }`.
9. **Audit & notifications (no PII, `D-9`)**: Records `BATCH_CREATED` per inserted batch, `IMPORT_COMMITTED` / `IMPORT_FAILED` on final chunk, and `IMPORT_ROLLED_BACK` on rollback (`BATCH_ARCHIVED` per archived batch), plus a `Notification` for the actor on final commit (`IMPORT_COMPLETED` / `IMPORT_FAILED`). `farmerName` is never included in `/validate` preview, `rowErrors`, `auditlogs`, `notifications`, or application logs.
10. **Sample CSV**: Static sample generated client-side (`sample-batches-import.csv`) with 5 valid rows across seeded SKUs (`WBJC`, `KMGC`, `ORGH`, `millets_almora`, `turmeric_haldi`), no `GET /api/v1/products` dependency.

---

## Verification 1: Backend `.\mvnw.cmd clean verify` & Surefire Per-Class Counts (`542` tests, `0` failures)

### 1a. `.\mvnw.cmd clean verify` Output

Command:
```powershell
.\mvnw.cmd clean verify 2>&1 | Tee-Object -FilePath ..\docs\progress\evidence\phase-08\mvnw-clean-verify.txt
```

Output (`docs/progress/evidence/phase-08/mvnw-clean-verify.txt` lines 605–665):
```text
Verified openapi.json length: 46214, operations: 52
Verified tracex-api.yaml length: 62126
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 2.720 s -- in com.tracex.OpenApiExportTest
[INFO] Running com.tracex.AuthLoginTests
2026-10-06T15:07:19.523+05:30  INFO 23808 --- [           main] t.c.s.AnnotationConfigContextLoaderUtils : Could not detect default configuration classes for test class [com.tracex.AuthLoginTests]: AuthLoginTests does not declare any static, non-private, non-final, nested classes annotated with @Configuration.
2026-10-06T15:07:19.525+05:30  INFO 23808 --- [           main] .b.t.c.SpringBootTestContextBootstrapper : Found @SpringBootConfiguration com.tracex.TraceXApplication for test class com.tracex.AuthLoginTests
2026-10-06T15:07:23.973+05:30  INFO 23808 --- [           main] com.tracex.service.SeedRunner            : Executing idempotent database seed for demo users, access requests, products, batches, and inspections...
2026-10-06T15:07:24.103+05:30  INFO 23808 --- [           main] com.tracex.service.SeedRunner            : Database seeding completed.
[INFO] Tests run: 10, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 4.582 s -- in com.tracex.AuthLoginTests
[INFO] Running com.tracex.RouteCoverageTest
2026-10-06T15:07:24.105+05:30  INFO 23808 --- [           main] t.c.s.AnnotationConfigContextLoaderUtils : Could not detect default configuration classes for test class [com.tracex.RouteCoverageTest]: RouteCoverageTest does not declare any static, non-private, non-final, nested classes annotated with @Configuration.
2026-10-06T15:07:24.106+05:30  INFO 23808 --- [           main] .b.t.c.SpringBootTestContextBootstrapper : Found @SpringBootConfiguration com.tracex.TraceXApplication for test class com.tracex.RouteCoverageTest
2026-10-06T15:07:24.114+05:30  INFO 23808 --- [           main] com.tracex.RouteCoverageTest             : Two-way route coverage confirmed for Phase <= 8 (53 active endpoints). 9 endpoints pending for later phases.
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.011 s -- in com.tracex.RouteCoverageTest
[INFO] Running com.tracex.ImportTests
2026-10-06T15:07:24.118+05:30  INFO 23808 --- [           main] t.c.s.AnnotationConfigContextLoaderUtils : Could not detect default configuration classes for test class [com.tracex.ImportTests]: ImportTests does not declare any static, non-private, non-final, nested classes annotated with @Configuration.
2026-10-06T15:07:24.120+05:30  INFO 23808 --- [           main] .b.t.c.SpringBootTestContextBootstrapper : Found @SpringBootConfiguration com.tracex.TraceXApplication for test class com.tracex.ImportTests
[INFO] Tests run: 16, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.780 s -- in com.tracex.ImportTests
[INFO] Running com.tracex.InspectionAndDispatchTests
...
[INFO] Tests run: 14, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 8.441 s -- in com.tracex.InspectionAndDispatchTests
[INFO] Running com.tracex.TraceTokenTests
2026-10-06T15:07:33.343+05:30  INFO 23808 --- [           main] t.c.s.AnnotationConfigContextLoaderUtils : Could not detect default configuration classes for test class [com.tracex.TraceTokenTests]: TraceTokenTests does not declare any static, non-private, non-final, nested classes annotated with @Configuration.
2026-10-06T15:07:33.345+05:30  INFO 23808 --- [           main] .b.t.c.SpringBootTestContextBootstrapper : Found @SpringBootConfiguration com.tracex.TraceXApplication for test class com.tracex.TraceTokenTests
[INFO] Tests run: 4, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.032 s -- in com.tracex.TraceTokenTests
[INFO] 
[INFO] Results:
[INFO] 
[INFO] Tests run: 542, Failures: 0, Errors: 0, Skipped: 0
[INFO] 
[INFO] 
[INFO] --- jar:3.3.0:jar (default-jar) @ tracex-backend ---
[INFO] Building jar: C:\Users\yashm\OneDrive\Desktop\TraceX\backend\target\tracex-backend-1.0.0-SNAPSHOT.jar
[INFO] 
[INFO] --- spring-boot:3.2.5:repackage (repackage) @ tracex-backend ---
[INFO] Replacing main artifact C:\Users\yashm\OneDrive\Desktop\TraceX\backend\target\tracex-backend-1.0.0-SNAPSHOT.jar with repackaged archive, adding nested dependencies in BOOT-INF/.
[INFO] The original artifact has been renamed to C:\Users\yashm\OneDrive\Desktop\TraceX\backend\target\tracex-backend-1.0.0-SNAPSHOT.jar.original
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  01:09 min
[INFO] Finished at: 2026-10-06T15:07:34+05:30
[INFO] ------------------------------------------------------------------------
```

### 1b. Surefire Per-Class Breakdown (`docs/progress/evidence/phase-08/surefire-per-class.txt`)

Command:
```powershell
Get-ChildItem backend\target\surefire-reports\TEST-*.xml | Sort-Object Name | ForEach-Object { [xml]$x = Get-Content $_.FullName; $s = $x.testsuite; "{0,-55} tests={1,3} failures={2} errors={3} skipped={4}" -f $s.name, $s.tests, $s.failures, $s.errors, $s.skipped } | Tee-Object -FilePath docs\progress\evidence\phase-08\surefire-per-class.txt
```

Output (`docs/progress/evidence/phase-08/surefire-per-class.txt`):
```text
com.tracex.AccessRequestAndUserFlowTests                tests=  9 failures=0 errors=0 skipped=0
com.tracex.AdminVsAdminRulesTest                        tests= 11 failures=0 errors=0 skipped=0
com.tracex.AuthLoginTests                               tests= 10 failures=0 errors=0 skipped=0
com.tracex.BatchIndexTest                               tests=  1 failures=0 errors=0 skipped=0
com.tracex.BatchQrAndScansTests                         tests= 10 failures=0 errors=0 skipped=0
com.tracex.ConfigurationAndSeedTests                    tests= 13 failures=0 errors=0 skipped=0
com.tracex.DashboardSummaryTests                        tests=  4 failures=0 errors=0 skipped=0
com.tracex.ErrorCodeSpecSyncTest                        tests=  1 failures=0 errors=0 skipped=0
com.tracex.FefoServiceTest                              tests= 11 failures=0 errors=0 skipped=0
com.tracex.ForwardedHeadersEmpiricalTest$FrameworkStrategyTests tests=  1 failures=0 errors=0 skipped=0
com.tracex.ForwardedHeadersEmpiricalTest$NativeStrategyTrustedProxyTests tests=  1 failures=0 errors=0 skipped=0
com.tracex.ForwardedHeadersEmpiricalTest$NativeStrategyUntrustedDirectTests tests=  1 failures=0 errors=0 skipped=0
com.tracex.ForwardedHeadersEmpiricalTest                tests=  0 failures=0 errors=0 skipped=0
com.tracex.GlobalSafetyGuardAutoDetectionTest           tests=  2 failures=0 errors=0 skipped=0
com.tracex.ImportTests                                  tests= 16 failures=0 errors=0 skipped=0
com.tracex.InspectionAndDispatchTests                   tests= 14 failures=0 errors=0 skipped=0
com.tracex.OpenApiExportTest                            tests=  1 failures=0 errors=0 skipped=0
com.tracex.ProductAndBatchTests                         tests= 40 failures=0 errors=0 skipped=0
com.tracex.PublicTraceAndScanTests                      tests= 11 failures=0 errors=0 skipped=0
com.tracex.RbacMatrixTest                               tests=371 failures=0 errors=0 skipped=0
com.tracex.RouteCoverageTest                            tests=  1 failures=0 errors=0 skipped=0
com.tracex.SmtpEmailServiceTest                         tests=  1 failures=0 errors=0 skipped=0
com.tracex.TokenAndSessionTests                         tests=  8 failures=0 errors=0 skipped=0
com.tracex.TraceTokenTests                              tests=  4 failures=0 errors=0 skipped=0
```

---

## Verification 2: Frontend Static Checks & Vitest Unit Tests (`88` tests in `15` files, `0` failures)

Command:
```powershell
cmd /c "npm run typecheck && npm run lint && npm run check:banned && npm run check:api-drift && npm run check:permissions-drift && npx vitest run" 2>&1 | Tee-Object -FilePath ..\docs\progress\evidence\phase-08\frontend-checks-and-unit-tests.txt
```

Output (`docs/progress/evidence/phase-08/frontend-checks-and-unit-tests.txt`):
```text
> tracex-frontend@1.0.0 typecheck
> tsc --noEmit


> tracex-frontend@1.0.0 lint
> eslint . --max-warnings=0


> tracex-frontend@1.0.0 check:banned
> node scripts/check-banned-patterns.mjs

Banned pattern check PASSED: 0 violations found across src/, index.html, and design-assets/backdrops.json.

> tracex-frontend@1.0.0 check:api-drift
> node scripts/check-api-drift.mjs

OpenAPI schema drift check PASSED (compare-only, zero file writes): src/api/generated/schema.d.ts and docs/openapi.json match backend/src/main/resources/openapi/tracex-api.yaml.

> tracex-frontend@1.0.0 check:permissions-drift
> node scripts/check-permissions-drift.mjs

Permissions drift check PASSED (compare-only, zero file writes): src/auth/permissions.generated.ts matches docs/permission-matrix.csv.

 RUN  v3.1.2 C:/Users/yashm/OneDrive/Desktop/TraceX/frontend

 ✓ src/lib/logger.test.ts (4 tests) 11ms
 ✓ src/lib/dates.test.ts (7 tests) 30ms
 ✓ src/auth/permissions.test.ts (2 tests) 8ms
 ✓ src/features/import/csvParser.test.ts (8 tests) 86ms
 ✓ src/api/endpoints.test.ts (5 tests) 44ms
 ✓ src/components/ui/PageBackdrop.test.tsx (8 tests) 518ms
 ✓ src/features/batches/BatchesAndDialogs.test.tsx (5 tests) 736ms
 ✓ src/features/fefo/FefoAndInspectionsAndProfile.test.tsx (3 tests) 817ms
 ✓ src/features/public/PublicPages.test.tsx (3 tests) 799ms
 ✓ src/auth/auth.test.tsx (8 tests) 944ms
 ✓ src/features/dashboard/DashboardPage.test.tsx (5 tests) 1012ms
 ✓ src/components/ui/ui.test.tsx (10 tests) 1205ms
 ✓ src/features/public/PublicTracePage.test.tsx (10 tests) 1072ms
 ✓ src/features/import/ImportPage.test.tsx (5 tests) 1383ms
 ✓ src/features/batches/BatchDetailPage.test.tsx (5 tests) 1510ms

 Test Files  15 passed (15)
      Tests  88 passed (88)
   Start at  14:59:50
   Duration  4.85s (transform 2.23s, setup 5.42s, collect 13.32s, tests 10.17s, environment 15.94s, prepare 2.44s)
```

---

## Verification 3: Playwright Full E2E Run (`39` passed across `5` files)

Command:
```powershell
npx playwright test 2>&1 | Tee-Object -FilePath ..\docs\progress\evidence\phase-08\playwright-full.txt
```

Output (`docs/progress/evidence/phase-08/playwright-full.txt` tail):
```text
  ok 29 [chromium] › e2e\phase07.spec.ts:178:3 › Phase 7 E2E Verification Suite (QR & Public Trace) › P7-E2E-01: factory-manager creates a batch, reads qrAbsoluteUrl, opens in logged-out context (no farmer name), scan count increases after reload (1.3s)
  ok 30 [chromium] › e2e\phase07.spec.ts:211:3 › Phase 7 E2E Verification Suite (QR & Public Trace) › P7-E2E-02: QR section renders image, Download PNG saves <batchCode>-qr.png, matches API data URL bytes (941ms)
  ok 31 [chromium] › e2e\phase07.spec.ts:242:3 › Phase 7 E2E Verification Suite (QR & Public Trace) › P7-E2E-03: archive batch as admin makes public link return 404, restore makes same link work again (461ms)
  ok 32 [chromium] › e2e\phase07.spec.ts:283:3 › Phase 7 E2E Verification Suite (QR & Public Trace) › P7-E2E-04: dispatch the batch, public page shows status DISPATCHED (361ms)
  ok 33 [chromium] › e2e\phase07.spec.ts:319:3 › Phase 7 E2E Verification Suite (QR & Public Trace) › P7-E2E-05: forged and malformed tokens and old /trace/:code show right states with no console errors (462ms)
[P7-E2E-06 TZ] Asia/Kolkata=Nov 20, 2026 America/Los_Angeles=Nov 20, 2026 identical=true
  ok 34 [chromium] › e2e\phase07.spec.ts:351:3 › Phase 7 E2E Verification Suite (QR & Public Trace) › P7-E2E-06: public trace page expiry date is identical in Asia/Kolkata and America/Los_Angeles contexts (589ms)
[P7-E2E-07 AXE] checked /trace/t/:token in 12 permutations (3 palettes x 2 modes x 2 image settings) + batch detail: zero violations
  ok 35 [chromium] › e2e\phase07.spec.ts:376:3 › Phase 7 E2E Verification Suite (QR & Public Trace) › P7-E2E-07: axe-core zero serious or critical violations on /trace/t/:token in light and dark across 3 palettes and images on/off, and batch detail with QR (7.4s)
[P7-E2E-08 VIEWPORTS] trace and batch detail at 375px, 768px, 1280px: all scrollWidth === clientWidth
  ok 36 [chromium] › e2e\phase07.spec.ts:429:3 › Phase 7 E2E Verification Suite (QR & Public Trace) › P7-E2E-08: 375px, 768px, and 1280px: scrollWidth equals clientWidth on trace page and batch detail; screenshots saved (1.4s)
[P7-E2E-09 NETWORK] traceRequests=1 scanRequests=1 authHeaderSent=false sessionStorageRead=false
  ok 37 [chromium] › e2e\phase07.spec.ts:476:3 › Phase 7 E2E Verification Suite (QR & Public Trace) › P7-E2E-09: network log shows exactly one trace GET and one scan POST; sessionStorage tx_token not read or sent (892ms)
  ok 38 [chromium] › e2e\phase08.spec.ts:90:3 › Phase 8 Bulk CSV Import E2E Suite › P8-E2E-01: owner imports fixture CSV (valid + duplicate + error), views result, rolls back, and re-imports successfully (4.0s)
  ok 39 [chromium] › e2e\phase08.spec.ts:182:3 › Phase 8 Bulk CSV Import E2E Suite › P8-E2E-02: quality-inspector has no Bulk Import nav link and direct /import URL is denied (403) (635ms)

  39 passed (3.7m)
```

---

## Verification 4: Live Dev Run on `8081` (`tracex_fresh_dev`)

Output (`docs/progress/evidence/phase-08/live-dev-import-flow.txt`):
```text
=== 1. Dev Backend Health on 8081 ===
{"status":"UP"}

=== 2. Initial mongosh counts (tracex_fresh_dev) ===
{"activeBatches":13,"deletedBatches":1,"importJobs":0}

=== 3. POST /api/v1/import/map-headers ===
{"mapping":{"productSku":"Product SKU","sourceLotCode":"Source Lot Code","farmerName":"Farmer Name","village":"Village","quantityProduced":"Quantity","unit":"Unit","yieldPercent":"Yield %","packDate":"Pack Date"},"unmappedRequired":[]}

=== 4. POST /api/v1/import/validate (2 CSV rows) ===
{"summary":{"total":2,"insert":2,"skip":0,"error":0},"preview":[{"rowNumber":2,"verdict":"insert","reason":null,"product":{"sku":"WBJC","productName":"Wild Berry Juice Concentrate"},"sourceLotCode":"LIVE-DEV-LOT-001","village":"Almora","quantityProduced":185,"unit":"Kg","yieldPercent":91.5,"packDate":"2026-03-10","insertKey":"WBJC|LIVE-DEV-LOT-001|2026-03-10","errors":[]},{"rowNumber":3,"verdict":"insert","reason":null,"product":{"sku":"KMGC","productName":"Kumaon Royal Multigrain Crackers"},"sourceLotCode":"LIVE-DEV-LOT-002","village":"Bageshwar","quantityProduced":240,"unit":"Kg","yieldPercent":88.0,"packDate":"2026-03-12","insertKey":"KMGC|LIVE-DEV-LOT-002|2026-03-12","errors":[]}]}

=== 5. POST /api/v1/import/commit (Chunk 0, isFinal=false) ===
{"jobId":"6ac4c3b7addfc547b642b324","status":"running","chunkInserted":1,"chunkSkipped":0,"chunkErrored":0,"totals":{"processedRows":1,"totalRows":2,"inserted":1,"skipped":0,"errored":0},"batches":[{"id":"6ac4c3b7addfc547b642b325","batchCode":"TX-2026-10-016","productName":"Wild Berry Juice Concentrate","sku":"WBJC","sourceLotCode":"LIVE-DEV-LOT-001","packDate":"2026-03-10","expiryDate":"2026-09-06","status":"EXPIRED"}],"errors":[],"rowErrorsTruncated":false}

=== 6. POST /api/v1/import/commit (Chunk 1, isFinal=true, same jobId) ===
{"jobId":"6ac4c3b7addfc547b642b324","status":"done","chunkInserted":1,"chunkSkipped":0,"chunkErrored":0,"totals":{"processedRows":2,"totalRows":2,"inserted":2,"skipped":0,"errored":0},"batches":[{"id":"6ac4c3b7addfc547b642b327","batchCode":"TX-2026-10-017","productName":"Kumaon Royal Multigrain Crackers","sku":"KMGC","sourceLotCode":"LIVE-DEV-LOT-002","packDate":"2026-03-12","expiryDate":"2026-06-10","status":"EXPIRED"}],"errors":[],"rowErrorsTruncated":false}

=== 7. GET /api/v1/import/6ac4c3b7addfc547b642b324 ===
{"id":"6ac4c3b7addfc547b642b324","fileName":"live-dev-phase08.csv","entity":"batch","status":"done","totalRows":2,"processedRows":2,"inserted":2,"updated":0,"skipped":0,"errored":0,"rowErrorsTruncated":false,"createdBy":"superadmin","createdByRole":"super-admin","createdAt":"2026-10-06T09:47:35.642Z","updatedAt":"2026-10-06T09:47:35.712Z","finishedAt":"2026-10-06T09:47:35.712Z","rolledBackAt":null,"rolledBackBy":null,"insertedBatchIds":["6ac4c3b7addfc547b642b325","6ac4c3b7addfc547b642b327"],"rowErrors":[]}

=== 8. Post-Commit mongosh counts (tracex_fresh_dev) ===
{"activeBatches":15,"deletedBatches":1,"importJobs":1}

=== 9. POST /api/v1/import/6ac4c3b7addfc547b642b324/rollback ===
{"jobId":"6ac4c3b7addfc547b642b324","status":"rolled_back","archived":2,"alreadyArchived":0,"rolledBackAt":"2026-10-06T09:47:36.722725500Z","rolledBackBy":"superadmin"}

=== 10. Post-Rollback mongosh counts and rolled-back batch records (tracex_fresh_dev) ===
{"activeBatches":13,"deletedBatches":3,"importJobs":1,"rolledBackBatches":[{"sku":"WBJC","batchCode":"TX-2026-10-016","isDeleted":true,"deletedBy":"superadmin","deleteNote":"Import rollback 6ac4c3b7addfc547b642b324"},{"sku":"KMGC","batchCode":"TX-2026-10-017","isDeleted":true,"deletedBy":"superadmin","deleteNote":"Import rollback 6ac4c3b7addfc547b642b324"}]}
```

---

## Verification 5: Planted Failure A — Drop `isDeleted=false` in Dedupe Lookup

### 5a. Failure Output (`docs/progress/evidence/phase-08/planted-failure-a-fail.txt`)

Command:
```powershell
.\mvnw.cmd test "-Dtest=ImportTests#testRollbackHappyPathAndReImportAllowedAfterRollback" 2>&1 | Tee-Object -FilePath ..\docs\progress\evidence\phase-08\planted-failure-a-fail.txt
```

Output (`docs/progress/evidence/phase-08/planted-failure-a-fail.txt` lines 188–211):
```text
[ERROR] Tests run: 1, Failures: 1, Errors: 0, Skipped: 0, Time elapsed: 7.225 s <<< FAILURE! -- in com.tracex.ImportTests
[ERROR] com.tracex.ImportTests.testRollbackHappyPathAndReImportAllowedAfterRollback -- Time elapsed: 1.340 s <<< FAILURE!
java.lang.AssertionError: JSON path "$.data.summary.insert" expected:<2> but was:<0>
	at org.springframework.test.util.AssertionErrors.fail(AssertionErrors.java:59)
	at org.springframework.test.util.AssertionErrors.assertEquals(AssertionErrors.java:122)
	at org.springframework.test.util.JsonPathExpectationsHelper.assertValue(JsonPathExpectationsHelper.java:123)
	at org.springframework.test.web.servlet.result.JsonPathResultMatchers.lambda$value$2(JsonPathResultMatchers.java:111)
	at org.springframework.test.web.servlet.MockMvc$1.andExpect(MockMvc.java:214)
	at com.tracex.ImportTests.testRollbackHappyPathAndReImportAllowedAfterRollback(ImportTests.java:738)
	at java.base/java.lang.reflect.Method.invoke(Method.java:580)
	at java.base/java.util.ArrayList.forEach(ArrayList.java:1596)
	at java.base/java.util.ArrayList.forEach(ArrayList.java:1596)

[INFO] 
[INFO] Results:
[INFO] 
[ERROR] Failures: 
[ERROR]   ImportTests.testRollbackHappyPathAndReImportAllowedAfterRollback:738 JSON path "$.data.summary.insert" expected:<2> but was:<0>
[INFO] 
[ERROR] Tests run: 1, Failures: 1, Errors: 0, Skipped: 0
[INFO] 
[INFO] ------------------------------------------------------------------------
[INFO] BUILD FAILURE
[INFO] ------------------------------------------------------------------------
```

### 5b. Pass After Revert (`docs/progress/evidence/phase-08/planted-failure-a-pass.txt`)

Output (`docs/progress/evidence/phase-08/planted-failure-a-pass.txt` lines 77–88):
```text
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 7.399 s -- in com.tracex.ImportTests
[INFO] 
[INFO] Results:
[INFO] 
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
[INFO] 
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  15.017 s
[INFO] Finished at: 2026-10-06T15:02:08+05:30
[INFO] ------------------------------------------------------------------------
```

---

## Verification 6: Planted Failure B — Remove Dispatched Check in Rollback

### 6a. Failure Output (`docs/progress/evidence/phase-08/planted-failure-b-fail.txt`)

Command:
```powershell
.\mvnw.cmd test "-Dtest=ImportTests#testRollbackWhenAnyBatchDispatchedReturns409AndChangesNothing" 2>&1 | Tee-Object -FilePath ..\docs\progress\evidence\phase-08\planted-failure-b-fail.txt
```

Output (`docs/progress/evidence/phase-08/planted-failure-b-fail.txt` lines 151–174):
```text
[ERROR] Tests run: 1, Failures: 1, Errors: 0, Skipped: 0, Time elapsed: 6.983 s <<< FAILURE! -- in com.tracex.ImportTests
[ERROR] com.tracex.ImportTests.testRollbackWhenAnyBatchDispatchedReturns409AndChangesNothing -- Time elapsed: 1.233 s <<< FAILURE!
java.lang.AssertionError: Status expected:<409> but was:<200>
	at org.springframework.test.util.AssertionErrors.fail(AssertionErrors.java:59)
	at org.springframework.test.util.AssertionErrors.assertEquals(AssertionErrors.java:122)
	at org.springframework.test.web.servlet.result.StatusResultMatchers.lambda$matcher$9(StatusResultMatchers.java:637)
	at org.springframework.test.web.servlet.MockMvc$1.andExpect(MockMvc.java:214)
	at com.tracex.ImportTests.testRollbackWhenAnyBatchDispatchedReturns409AndChangesNothing(ImportTests.java:787)
	at java.base/java.lang.reflect.Method.invoke(Method.java:580)
	at java.base/java.util.ArrayList.forEach(ArrayList.java:1596)
	at java.base/java.util.ArrayList.forEach(ArrayList.java:1596)

[INFO] 
[INFO] Results:
[INFO] 
[ERROR] Failures: 
[ERROR]   ImportTests.testRollbackWhenAnyBatchDispatchedReturns409AndChangesNothing:787 Status expected:<409> but was:<200>
[INFO] 
[ERROR] Tests run: 1, Failures: 1, Errors: 0, Skipped: 0
[INFO] 
[INFO] ------------------------------------------------------------------------
[INFO] BUILD FAILURE
[INFO] ------------------------------------------------------------------------
```

### 6b. Pass After Revert (`docs/progress/evidence/phase-08/planted-failure-b-pass.txt`)

Output (`docs/progress/evidence/phase-08/planted-failure-b-pass.txt` lines 77–88):
```text
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 6.967 s -- in com.tracex.ImportTests
[INFO] 
[INFO] Results:
[INFO] 
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
[INFO] 
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  14.629 s
[INFO] Finished at: 2026-10-06T15:03:35+05:30
[INFO] ------------------------------------------------------------------------
```

---

## Verification 7: Planted Failure C — Include `farmerName` in `/validate` Preview

### 7a. Failure Output (`docs/progress/evidence/phase-08/planted-failure-c-fail.txt`)

Command:
```powershell
.\mvnw.cmd test "-Dtest=ImportTests#testNoFarmerNameInPreviewRowErrorsAuditOrCapturedLogs" 2>&1 | Tee-Object -FilePath ..\docs\progress\evidence\phase-08\planted-failure-c-fail.txt
```

Output (`docs/progress/evidence/phase-08/planted-failure-c-fail.txt` lines 114–144):
```text
[ERROR] Tests run: 1, Failures: 1, Errors: 0, Skipped: 0, Time elapsed: 7.027 s <<< FAILURE! -- in com.tracex.ImportTests
[ERROR] com.tracex.ImportTests.testNoFarmerNameInPreviewRowErrorsAuditOrCapturedLogs -- Time elapsed: 1.169 s <<< FAILURE!
java.lang.AssertionError: 

Expecting actual:
  "{"success":true,"requestId":"0eb6a99c-9b59-48a2-91ee-0bfb3717d350","data":{"summary":{"total":2,"insert":1,"skip":0,"error":1},"preview":[{"rowNumber":2,"verdict":"insert","reason":null,"product":{"sku":"TEST-IMP-SKU","productName":"Test Import Himalayan Honey"},"sourceLotCode":"LOT-PII-GOOD","village":"Mukteshwar","quantityProduced":150,"unit":"Kg","yieldPercent":88.5,"packDate":"2026-10-06","insertKey":"TEST-IMP-SKU|LOT-PII-GOOD|2026-10-06","farmerName":"PII_SECRET_FARMER_KUNDAN_998877","errors":[]},{"rowNumber":3,"verdict":"error","reason":null,"product":{"sku":"TEST-IMP-SKU","productName":"Test Import Himalayan Honey"},"sourceLotCode":"LOT-PII-BAD","village":"Mukteshwar","quantityProduced":150,"unit":"Kg","yieldPercent":88.5,"packDate":null,"insertKey":null,"farmerName":null,"errors":[{"field":"farmerName","message":"Farmer name must be at most 200 characters"},{"field":"packDate","message":"Pack date must be DD/MM/YYYY or YYYY-MM-DD"}]}]}}"
not to contain:
  "PII_SECRET_FARMER_KUNDAN_998877"

	at com.tracex.ImportTests.testNoFarmerNameInPreviewRowErrorsAuditOrCapturedLogs(ImportTests.java:927)
	at java.base/java.lang.reflect.Method.invoke(Method.java:580)
	at java.base/java.util.ArrayList.forEach(ArrayList.java:1596)
	at java.base/java.util.ArrayList.forEach(ArrayList.java:1596)

[INFO] 
[INFO] Results:
[INFO] 
[ERROR] Failures: 
[ERROR]   ImportTests.testNoFarmerNameInPreviewRowErrorsAuditOrCapturedLogs:927 
Expecting actual:
  "{"success":true,"requestId":"0eb6a99c-9b59-48a2-91ee-0bfb3717d350","data":{"summary":{"total":2,"insert":1,"skip":0,"error":1},"preview":[{"rowNumber":2,"verdict":"insert","reason":null,"product":{"sku":"TEST-IMP-SKU","productName":"Test Import Himalayan Honey"},"sourceLotCode":"LOT-PII-GOOD","village":"Mukteshwar","quantityProduced":150,"unit":"Kg","yieldPercent":88.5,"packDate":"2026-10-06","insertKey":"TEST-IMP-SKU|LOT-PII-GOOD|2026-10-06","farmerName":"PII_SECRET_FARMER_KUNDAN_998877","errors":[]},{"rowNumber":3,"verdict":"error","reason":null,"product":{"sku":"TEST-IMP-SKU","productName":"Test Import Himalayan Honey"},"sourceLotCode":"LOT-PII-BAD","village":"Mukteshwar","quantityProduced":150,"unit":"Kg","yieldPercent":88.5,"packDate":null,"insertKey":null,"farmerName":null,"errors":[{"field":"farmerName","message":"Farmer name must be at most 200 characters"},{"field":"packDate","message":"Pack date must be DD/MM/YYYY or YYYY-MM-DD"}]}]}}"
not to contain:
  "PII_SECRET_FARMER_KUNDAN_998877"

[INFO] 
[ERROR] Tests run: 1, Failures: 1, Errors: 0, Skipped: 0
[INFO] 
[INFO] ------------------------------------------------------------------------
[INFO] BUILD FAILURE
[INFO] ------------------------------------------------------------------------
```

### 7b. Pass After Revert (`docs/progress/evidence/phase-08/planted-failure-c-pass.txt`)

Output (`docs/progress/evidence/phase-08/planted-failure-c-pass.txt` lines 77–88):
```text
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 7.412 s -- in com.tracex.ImportTests
[INFO] 
[INFO] Results:
[INFO] 
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
[INFO] 
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  14.987 s
[INFO] Finished at: 2026-10-06T15:06:04+05:30
[INFO] ------------------------------------------------------------------------
```

---

## Verification 8: Matrix & OpenAPI Parity + Frontend Drift Checks

Output (`docs/progress/evidence/phase-08/matrix-openapi-parity.txt` tail):
```text
2026-10-06T15:14:01.143+05:30  INFO 19848 --- [o-auto-1-exec-1] o.springdoc.api.AbstractOpenApiResource  : Init duration for springdoc-openapi is: 1341 ms
Verified openapi.json length: 46214, operations: 52
Verified tracex-api.yaml length: 62126
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 3.404 s -- in com.tracex.OpenApiExportTest
[INFO] 
[INFO] Results:
[INFO] 
[INFO] Tests run: 2, Failures: 0, Errors: 0, Skipped: 0
[INFO] 
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  12.388 s
[INFO] Finished at: 2026-10-06T15:14:01+05:30
[INFO] ------------------------------------------------------------------------

> tracex-frontend@1.0.0 check:api-drift
> node scripts/check-api-drift.mjs

OpenAPI schema drift check PASSED (compare-only, zero file writes): src/api/generated/schema.d.ts and docs/openapi.json match backend/src/main/resources/openapi/tracex-api.yaml.

> tracex-frontend@1.0.0 check:permissions-drift
> node scripts/check-permissions-drift.mjs

Permissions drift check PASSED (compare-only, zero file writes): src/auth/permissions.generated.ts matches docs/permission-matrix.csv.
```

---

## Verification 9: Markdown Table Linter (`scripts\lint-md-tables.ps1`)

Command:
```powershell
powershell -ExecutionPolicy Bypass -File scripts\lint-md-tables.ps1 2>&1 | Tee-Object -FilePath docs\progress\evidence\phase-08\lint-md-tables.txt
```

Output (`docs/progress/evidence/phase-08/lint-md-tables.txt`):
```text
=== Markdown Table Linter ===
Scanning 35 Markdown files...


=== Summary ===
Files checked: 35
Errors: 0
Warnings: 0
STATUS: PASSED (Zero problems found)
```

---

## Verification 10: Existing Batch Tests Unchanged (`ProductAndBatchTests` — `40` tests, `0` failures)

Command:
```powershell
.\mvnw.cmd test "-Dtest=ProductAndBatchTests" 2>&1 | Tee-Object -FilePath ..\docs\progress\evidence\phase-08\batch-tests-unchanged.txt
```

Output (`docs/progress/evidence/phase-08/batch-tests-unchanged.txt` tail):
```text
2026-10-06T15:14:20.520+05:30  INFO 28636 --- [           main] com.tracex.service.SeedRunner            : Executing idempotent database seed for demo users, access requests, products, batches, and inspections...
2026-10-06T15:14:20.646+05:30  INFO 28636 --- [           main] com.tracex.service.SeedRunner            : Database seeding completed.
[INFO] Tests run: 40, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 11.12 s -- in com.tracex.ProductAndBatchTests
[INFO] 
[INFO] Results:
[INFO] 
[INFO] Tests run: 40, Failures: 0, Errors: 0, Skipped: 0
[INFO] 
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  13.423 s
[INFO] Finished at: 2026-10-06T15:14:20+05:30
[INFO] ------------------------------------------------------------------------
```
