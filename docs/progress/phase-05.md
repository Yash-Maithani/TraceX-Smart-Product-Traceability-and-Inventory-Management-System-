# Phase 5 Verification & Progress Log

**Date**: 2026-10-05  
**Phase**: Phase 5 — Backend Carry-Over (Part A0) & Frontend Foundation (Toolchain, Design System, Auth Screens, App Shell, Shared States, E2E Suite)  
**Status**: COMPLETE

---

## Step 0: Confirm Phase 4.2 Status

Verified that `PROGRESS.md` records Phase 4.2 as `COMPLETE` (dated `2026-10-05`, linked to `[phase-04-2](docs/progress/phase-04-2.md)`).

---

## Part A0: Backend Carry-Over

### A0-1: Tier Filters and Corrupted Dates

- Updated `BatchService.buildFilterCriteria` so that `EXPIRED`, `URGENT`, `WARNING`, and `READY` tier queries include `.regex(ISO_LOCAL_DATE_REGEX)` (`^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$`) on `expiryDate`. Corrupted strings such as `"not-a-date"` sort lexically after valid ISO dates in MongoDB, so requiring the ISO date regex ensures they are excluded from `EXPIRED`, `URGENT`, `WARNING`, and `READY` filters and returned only by `status=EXCEPTION`.
- Verified `GET /api/v1/dispatch/fefo` places corrupted-date batches exclusively in `exceptions` and never in `queue` or `expired`.

### A0-2: Business Dates vs. Timestamps Inventory (SPEC §4)

| Entity / Collection | Field | Category | Storage Type | API Type |
| --- | --- | --- | --- | --- |
| `users` | `inviteExpiry` | Security expiry timestamp | BSON Date (`Instant`) | Internal only |
| `users` | `otpExpiry` | Security expiry timestamp | BSON Date (`Instant`) | Internal only |
| `users` | `resetTokenExpiry` | Security expiry timestamp | BSON Date (`Instant`) | Internal only |
| `users` | `deletedAt` | Audit timestamp | BSON Date (`Instant`) | ISO-8601 UTC string (`date-time`) |
| `users` | `createdAt` | Audit timestamp | BSON Date (`Instant`) | ISO-8601 UTC string (`date-time`) |
| `users` | `updatedAt` | Audit timestamp | BSON Date (`Instant`) | ISO-8601 UTC string (`date-time`) |
| `access_requests` | `requestedAt` | Audit timestamp | BSON Date (`Instant`) | ISO-8601 UTC string (`date-time`) |
| `access_requests` | `reviewedAt` | Audit timestamp | BSON Date (`Instant`) | ISO-8601 UTC string (`date-time`) |
| `products` | `deletedAt` | Audit timestamp | BSON Date (`Instant`) | ISO-8601 UTC string (`date-time`) |
| `products` | `createdAt` | Audit timestamp | BSON Date (`Instant`) | ISO-8601 UTC string (`date-time`) |
| `products` | `updatedAt` | Audit timestamp | BSON Date (`Instant`) | ISO-8601 UTC string (`date-time`) |
| `batches` | `packDate` | Business calendar date | ISO String (`"YYYY-MM-DD"`, `LocalDate`) | `"YYYY-MM-DD"` string (`date`) |
| `batches` | `expiryDate` | Business calendar date | ISO String (`"YYYY-MM-DD"`, `LocalDate`) | `"YYYY-MM-DD"` string (`date`) |
| `batches` | `dispatchDate` | Business calendar date | ISO String (`"YYYY-MM-DD"`, `LocalDate`) | `"YYYY-MM-DD"` string (`date`) |
| `batches` | `dispatchHistory[].dispatchDate` | Business calendar date | ISO String (`"YYYY-MM-DD"`, `LocalDate`) | `"YYYY-MM-DD"` string (`date`) |
| `batches` | `dispatchHistory[].dispatchedAt` | Audit timestamp | BSON Date (`Instant`) | ISO-8601 UTC string (`date-time`) |
| `batches` | `noteHistory[].addedAt` | Audit timestamp | BSON Date (`Instant`) | ISO-8601 UTC string (`date-time`) |
| `batches` | `qualityCheck.inspectedAt` | Audit timestamp | BSON Date (`Instant`) | ISO-8601 UTC string (`date-time`) |
| `batches` | `deletedAt` | Audit timestamp | BSON Date (`Instant`) | ISO-8601 UTC string (`date-time`) |
| `batches` | `createdAt` | Audit timestamp | BSON Date (`Instant`) | ISO-8601 UTC string (`date-time`) |
| `batches` | `updatedAt` | Audit timestamp | BSON Date (`Instant`) | ISO-8601 UTC string (`date-time`) |
| `inspections` | `inspectedAt` | Audit timestamp | BSON Date (`Instant`) | ISO-8601 UTC string (`date-time`) |
| `inspections` | `createdAt` | Audit timestamp | BSON Date (`Instant`) | ISO-8601 UTC string (`date-time`) |
| `inspections` | `updatedAt` | Audit timestamp | BSON Date (`Instant`) | ISO-8601 UTC string (`date-time`) |
| `audit_logs` | `timestamp` | Audit timestamp | BSON Date (`Instant`) | ISO-8601 UTC string (`date-time`) |
| `ml_logs` | `timestamp` | Audit timestamp | BSON Date (`Instant`) | ISO-8601 UTC string (`date-time`) |

- Updated `Batch.dispatchDate`, `Batch.DispatchRecord.dispatchDate`, `BatchResponse.dispatchDate`, and `BatchResponse.DispatchRecordDto.dispatchDate` from `Instant` to `LocalDate` (`"YYYY-MM-DD"`), annotated with `@ValueConverter(BatchLocalDateValueConverter.class)`.
- Updated `DispatchService.dispatchBatch` to parse `dispatchDate` as `LocalDate` (defaulting to `LocalDate.now(clock)` when omitted) and validate it against `packDate` as a calendar date.
- Regenerated `docs/00-audit/openapi-export/tracex-api.yaml` and updated `SPEC.md` §4 and §6.3.

### A0-3: Clock Leakage & Random Test Ordering

- Updated `SeedRunner.seedBatches` to compute the `TX-YYYY-MM-NNN` prefix from the injected `Clock` (`LocalDate.now(clock)`) instead of `LocalDate.now()`, and updated `SeedRunner.reseedMissingBatchesAndInspections` to purge batches with stale year-month prefixes before reseeding.
- Updated `GlobalTestDatabaseSafetyExtension` to restore `TimeZone.getDefault()` in `afterEach` and re-run `SeedRunner` in `afterAll` so no test class leaves leaked clock/timezone state for subsequent classes.
- Added `backend/src/test/resources/junit-platform.properties` enabling `OrderAnnotation` class ordering and `MethodOrderer$Random` method ordering.

Command and output for Part A0 regression tests (`A0-1`, `A0-2`, `A0-3`):

```text
PS C:\Users\yashm\OneDrive\Desktop\TraceX\backend> .\mvnw.cmd test "-Dtest=ProductAndBatchTests#testExceptionStatusFilterAndNullableDaysUntilExpiry+testCreateAndReadBatchDateRoundTripAcrossTimeZones,InspectionAndDispatchTests#testDispatchDateRoundTripAcrossTimeZones"
[INFO] Running com.tracex.InspectionAndDispatchTests
A0-2 Dispatch Round-Trip [JVM TZ=UTC]: mongo.dispatchDate=2026-10-01 (java.lang.String), mongo.dispatchHistory[0].dispatchDate=2026-10-01 (java.lang.String), PATCH => {"success":true,"requestId":"54f52993-55b8-4f14-9b67-aac4f5344e62","data":{"id":"6ac326bdc253567bc74f65d4","batchCode":"TX-A02-DISP-UTC","productName":"Wild Berry Juice Concentrate","sku":"WBJC","sourceLotCode":"LOT-A02-UTC","farmerName":"A02 Farmer","village":"A02 Village","quantityProduced":100,"unit":"Kg","yieldPercent":85.0,"packDate":"2026-09-25","expiryDate":"2026-11-04","dataSource":"manual","shelfLifeSource":"manual","lifecycleState":"DISPATCHED","status":"DISPATCHED","daysUntilExpiry":30,"priorityScore":0.0,"qualityCheck":null,"createdBy":null,"createdAt":"2026-10-05T04:25:33.558Z","updatedAt":"2026-10-05T04:25:33.806Z","traceabilityNote":null,"noteHistory":[],"dispatchHistory":[{"dispatchedBy":"coord_p4","dispatchedAt":"2026-10-05T04:25:33.806Z","buyerName":"A02 Buyer (UTC)","dispatchDate":"2026-10-01","overrideReason":null,"outOfOrder":false}],"deletedAt":null,"deletedBy":null,"deleteNote":null,"dispatchDate":"2026-10-01","buyerName":"A02 Buyer (UTC)","deleted":false}}
A0-2 Dispatch Round-Trip [JVM TZ=Asia/Kolkata]: mongo.dispatchDate=2026-10-01 (java.lang.String), mongo.dispatchHistory[0].dispatchDate=2026-10-01 (java.lang.String), PATCH => {"success":true,"requestId":"c2b28328-2434-442d-b857-3295623cfdd7","data":{"id":"6ac326bdc253567bc74f65d6","batchCode":"TX-A02-DISP-Asia-Kolkata","productName":"Wild Berry Juice Concentrate","sku":"WBJC","sourceLotCode":"LOT-A02-Asia-Kolkata","farmerName":"A02 Farmer","village":"A02 Village","quantityProduced":100,"unit":"Kg","yieldPercent":85.0,"packDate":"2026-09-25","expiryDate":"2026-11-04","dataSource":"manual","shelfLifeSource":"manual","lifecycleState":"DISPATCHED","status":"DISPATCHED","daysUntilExpiry":30,"priorityScore":0.0,"qualityCheck":null,"createdBy":null,"createdAt":"2026-10-05T04:25:33.990Z","updatedAt":"2026-10-05T04:25:34.012Z","traceabilityNote":null,"noteHistory":[],"dispatchHistory":[{"dispatchedBy":"coord_p4","dispatchedAt":"2026-10-05T04:25:34.012Z","buyerName":"A02 Buyer (Asia/Kolkata)","dispatchDate":"2026-10-01","overrideReason":null,"outOfOrder":false}],"deletedAt":null,"deletedBy":null,"deleteNote":null,"dispatchDate":"2026-10-01","buyerName":"A02 Buyer (Asia/Kolkata)","deleted":false}}
A0-2 Dispatch Round-Trip [JVM TZ=America/Los_Angeles]: mongo.dispatchDate=2026-10-01 (java.lang.String), mongo.dispatchHistory[0].dispatchDate=2026-10-01 (java.lang.String), PATCH => {"success":true,"requestId":"ad7e1bb7-2be6-4c40-a7cd-8960608445e5","data":{"id":"6ac326bec253567bc74f65d8","batchCode":"TX-A02-DISP-America-Los_Angeles","productName":"Wild Berry Juice Concentrate","sku":"WBJC","sourceLotCode":"LOT-A02-America-Los_Angeles","farmerName":"A02 Farmer","village":"A02 Village","quantityProduced":100,"unit":"Kg","yieldPercent":85.0,"packDate":"2026-09-25","expiryDate":"2026-11-03","dataSource":"manual","shelfLifeSource":"manual","lifecycleState":"DISPATCHED","status":"DISPATCHED","daysUntilExpiry":29,"priorityScore":0.0,"qualityCheck":null,"createdBy":null,"createdAt":"2026-10-05T04:25:34.049Z","updatedAt":"2026-10-05T04:25:34.061Z","traceabilityNote":null,"noteHistory":[],"dispatchHistory":[{"dispatchedBy":"coord_p4","dispatchedAt":"2026-10-05T04:25:34.061Z","buyerName":"A02 Buyer (America/Los_Angeles)","dispatchDate":"2026-10-01","overrideReason":null,"outOfOrder":false}],"deletedAt":null,"deletedBy":null,"deleteNote":null,"dispatchDate":"2026-10-01","buyerName":"A02 Buyer (America/Los_Angeles)","deleted":false}}
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 12.07 s -- in com.tracex.InspectionAndDispatchTests
[INFO] Running com.tracex.ProductAndBatchTests
R1 Seeded Batch [TX-2026-10-002] Raw Mongo Document: {"_id": {"$oid": "6ac326bec253567bc74f65e4"}, "productId": "6ac326bdc253567bc74f65d2", "productName": "Kumaon Royal Multigrain Crackers", "sku": "KMGC", "sourceLotCode": "DEMO-LOT-002", "farmerName": "Demo Farmer", "village": "Demo Village", "quantityProduced": 150, "unit": "Kg", "yieldPercent": 82.0, "batchCode": "TX-2026-10-002", "packDate": "2026-07-08", "expiryDate": "2026-10-06", "dataSource": "predicted", "shelfLifeSource": "predicted", "lifecycleState": "ACTIVE", "priorityScore": 414.0, "traceabilityNote": "Demo batch - DEMO-LOT-002", "createdBy": "[DEMO] Seed", "noteHistory": [], "dispatchHistory": [], "isDeleted": false, "version": 3, "createdAt": {"$date": "2026-10-05T04:25:34.312Z"}, "updatedAt": {"$date": "2026-10-05T04:25:35.05Z"}, "_class": "com.tracex.model.Batch"}
A0-1 Filter [status=EXPIRED]: count=1, codes=[TX-2026-10-001], containsCorrupted=false
A0-1 Filter [status=URGENT]: count=5, codes=[TX-2026-10-002, TX-2026-10-1669, TX-2026-10-1670, TX-2026-10-1671, TX-2026-10-003], containsCorrupted=false
A0-1 Filter [status=WARNING]: count=2, codes=[TX-2026-10-004, TX-2026-10-005], containsCorrupted=false
A0-1 Filter [status=READY]: count=6, codes=[TX-2026-10-006, TX-2026-10-011, TX-2026-10-012, TX-2026-10-013, TX-2026-10-1672, TX-2026-10-007], containsCorrupted=false
A0-1 Filter [status=EXCEPTION]: count=1, codes=[TX-R3-EXC-001], containsCorrupted=true
A0-1 FEFO [GET /api/v1/dispatch/fefo]: queueContainsCorrupted=false, expiredContainsCorrupted=false, exceptionsCodes=[TX-R3-EXC-001]
[INFO] Tests run: 2, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.671 s -- in com.tracex.ProductAndBatchTests
[INFO] BUILD SUCCESS
```

---

## Check 1: Backend Verify (Two Consecutive Runs with Random Ordering)

Executed `.\mvnw.cmd clean verify` twice in a row with random JUnit method ordering enabled:

```text
PS C:\Users\yashm\OneDrive\Desktop\TraceX\backend> .\mvnw.cmd clean verify
=== RUN 1 ===
[INFO] Running com.tracex.InspectionAndDispatchTests
[INFO] Tests run: 13, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 23.06 s -- in com.tracex.InspectionAndDispatchTests
[INFO] Running com.tracex.GlobalSafetyGuardAutoDetectionTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 2.036 s -- in com.tracex.GlobalSafetyGuardAutoDetectionTest
[INFO] Running com.tracex.FefoServiceTest
[INFO] Tests run: 11, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 4.124 s -- in com.tracex.FefoServiceTest
[INFO] Running com.tracex.RouteCoverageTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.240 s -- in com.tracex.RouteCoverageTest
[INFO] Running com.tracex.AuthLoginTests
[INFO] Tests run: 10, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 6.444 s -- in com.tracex.AuthLoginTests
[INFO] Running com.tracex.ForwardedHeadersEmpiricalTest
[INFO] Running com.tracex.ForwardedHeadersEmpiricalTest$NativeStrategyUntrustedDirectTests
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 2.600 s -- in com.tracex.ForwardedHeadersEmpiricalTest$NativeStrategyUntrustedDirectTests
[INFO] Running com.tracex.ForwardedHeadersEmpiricalTest$NativeStrategyTrustedProxyTests
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.568 s -- in com.tracex.ForwardedHeadersEmpiricalTest$NativeStrategyTrustedProxyTests
[INFO] Running com.tracex.ForwardedHeadersEmpiricalTest$FrameworkStrategyTests
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.542 s -- in com.tracex.ForwardedHeadersEmpiricalTest$FrameworkStrategyTests
[INFO] Tests run: 0, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 5.728 s -- in com.tracex.ForwardedHeadersEmpiricalTest
[INFO] Running com.tracex.TokenAndSessionTests
[INFO] Tests run: 8, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.157 s -- in com.tracex.TokenAndSessionTests
[INFO] Running com.tracex.AccessRequestAndUserFlowTests
[INFO] Tests run: 9, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 8.999 s -- in com.tracex.AccessRequestAndUserFlowTests
[INFO] Running com.tracex.ProductAndBatchTests
[INFO] Tests run: 35, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 2.542 s -- in com.tracex.ProductAndBatchTests
[INFO] Running com.tracex.ErrorCodeSpecSyncTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.012 s -- in com.tracex.ErrorCodeSpecSyncTest
[INFO] Running com.tracex.ConfigurationAndSeedTests
[INFO] Tests run: 12, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.679 s -- in com.tracex.ConfigurationAndSeedTests
[INFO] Running com.tracex.AdminVsAdminRulesTest
[INFO] Tests run: 11, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 6.325 s -- in com.tracex.AdminVsAdminRulesTest
[INFO] Running com.tracex.OpenApiExportTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 4.416 s -- in com.tracex.OpenApiExportTest
[INFO] Running com.tracex.SmtpEmailServiceTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 2.207 s -- in com.tracex.SmtpEmailServiceTest
[INFO] Running com.tracex.RbacMatrixTest
[INFO] Tests run: 287, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 2.417 s -- in com.tracex.RbacMatrixTest
[INFO] Running com.tracex.BatchIndexTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.200 s -- in com.tracex.BatchIndexTest
[INFO] Tests run: 405, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
[INFO] Total time:  01:23 min
[INFO] Finished at: 2026-10-05T09:52:01+05:30

=== RUN 2 ===
[INFO] Running com.tracex.RouteCoverageTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 10.29 s -- in com.tracex.RouteCoverageTest
[INFO] Running com.tracex.FefoServiceTest
[INFO] Tests run: 11, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 6.970 s -- in com.tracex.FefoServiceTest
[INFO] Running com.tracex.AccessRequestAndUserFlowTests
[INFO] Tests run: 9, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 9.520 s -- in com.tracex.AccessRequestAndUserFlowTests
[INFO] Running com.tracex.InspectionAndDispatchTests
[INFO] Tests run: 13, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 11.78 s -- in com.tracex.InspectionAndDispatchTests
[INFO] Running com.tracex.SmtpEmailServiceTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 2.584 s -- in com.tracex.SmtpEmailServiceTest
[INFO] Running com.tracex.BatchIndexTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.201 s -- in com.tracex.BatchIndexTest
[INFO] Running com.tracex.ForwardedHeadersEmpiricalTest
[INFO] Running com.tracex.ForwardedHeadersEmpiricalTest$NativeStrategyUntrustedDirectTests
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 2.725 s -- in com.tracex.ForwardedHeadersEmpiricalTest$NativeStrategyUntrustedDirectTests
[INFO] Running com.tracex.ForwardedHeadersEmpiricalTest$NativeStrategyTrustedProxyTests
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.684 s -- in com.tracex.ForwardedHeadersEmpiricalTest$NativeStrategyTrustedProxyTests
[INFO] Running com.tracex.ForwardedHeadersEmpiricalTest$FrameworkStrategyTests
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.496 s -- in com.tracex.ForwardedHeadersEmpiricalTest$FrameworkStrategyTests
[INFO] Tests run: 0, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 5.923 s -- in com.tracex.ForwardedHeadersEmpiricalTest
[INFO] Running com.tracex.AuthLoginTests
[INFO] Tests run: 10, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 6.582 s -- in com.tracex.AuthLoginTests
[INFO] Running com.tracex.ProductAndBatchTests
[INFO] Tests run: 35, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 2.196 s -- in com.tracex.ProductAndBatchTests
[INFO] Running com.tracex.GlobalSafetyGuardAutoDetectionTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.215 s -- in com.tracex.GlobalSafetyGuardAutoDetectionTest
[INFO] Running com.tracex.TokenAndSessionTests
[INFO] Tests run: 8, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.168 s -- in com.tracex.TokenAndSessionTests
[INFO] Running com.tracex.ConfigurationAndSeedTests
[INFO] Tests run: 12, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.682 s -- in com.tracex.ConfigurationAndSeedTests
[INFO] Running com.tracex.ErrorCodeSpecSyncTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.008 s -- in com.tracex.ErrorCodeSpecSyncTest
[INFO] Running com.tracex.OpenApiExportTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 3.218 s -- in com.tracex.OpenApiExportTest
[INFO] Running com.tracex.AdminVsAdminRulesTest
[INFO] Tests run: 11, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 6.487 s -- in com.tracex.AdminVsAdminRulesTest
[INFO] Running com.tracex.RbacMatrixTest
[INFO] Tests run: 287, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 2.583 s -- in com.tracex.RbacMatrixTest
[INFO] Tests run: 405, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
[INFO] Total time:  01:24 min
[INFO] Finished at: 2026-10-05T09:54:58+05:30
```

---

## Check 2: Frontend Static Checks, Unit Tests, and OpenAPI Drift Check

```text
PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> npm run typecheck; npm run lint; npm run check:banned; npm run check:contrast; npm run check:api-drift; npm test

> tracex-frontend@1.0.0 typecheck
> tsc --noEmit


> tracex-frontend@1.0.0 lint
> eslint . --max-warnings=0


> tracex-frontend@1.0.0 check:banned
> node scripts/check-banned-patterns.mjs

Banned pattern check PASSED: 0 violations found across src/ and index.html.

> tracex-frontend@1.0.0 check:contrast
> node scripts/check-contrast.mjs

WCAG Contrast Verification across 138 token pairs:
...
Contrast check PASSED: all 138 pairs meet or exceed WCAG AA thresholds.

> tracex-frontend@1.0.0 check:api-drift
> node scripts/check-api-drift.mjs

OpenAPI schema drift check PASSED: src/api/generated/schema.d.ts is up to date with tracex-api.yaml.

> tracex-frontend@1.0.0 test
> vitest run

 RUN  v3.1.2 C:/Users/yashm/OneDrive/Desktop/TraceX/frontend

 ✓ src/lib/dates.test.ts (7 tests) 37ms
 ✓ src/auth/auth.test.tsx (8 tests) 686ms
 ✓ src/components/ui/ui.test.tsx (10 tests) 921ms

 Test Files  3 passed (3)
      Tests  25 passed (25)
   Start at  12:45:24
   Duration  3.55s
```

---

## Check 3: `check:banned` Verification with Planted Violation

```text
=== CHECK 3: check:banned baseline, planted violation failure, and recovery ===

> tracex-frontend@1.0.0 check:banned
> node scripts/check-banned-patterns.mjs

Banned pattern check PASSED: 0 violations found across src/ and index.html.

> tracex-frontend@1.0.0 check:banned
> node scripts/check-banned-patterns.mjs

Banned pattern check FAILED with 3 violation(s):
  [VIOLATION] src/PlantedViolationTemp.tsx:1 - Banned 'localStorage' usage outside src/lib/prefs.ts
  [VIOLATION] src/PlantedViolationTemp.tsx:1 - Banned 'dangerouslySetInnerHTML' usage
  [VIOLATION] src/PlantedViolationTemp.tsx:1 - Banned inline 'style={{...}}' usage (only CSS custom properties allowed)
Planted violation exit code: 1

> tracex-frontend@1.0.0 check:banned
> node scripts/check-banned-patterns.mjs

Banned pattern check PASSED: 0 violations found across src/ and index.html.
Post-removal exit code: 0
```

---

## Check 4: `check:contrast` WCAG AA Verification Across All 3 Palettes, 4 Accents, and 6 Statuses

```text
> tracex-frontend@1.0.0 check:contrast
> node scripts/check-contrast.mjs

WCAG Contrast Verification across 138 token pairs:
[PASS] editorial (light)            | text-primary on bg-canvas (text)         | #141413 on #f8f7f4 => 17.21:1 (min 4.5:1)
[PASS] editorial (light)            | text-primary on bg-surface (text)        | #141413 on #ffffff => 18.43:1 (min 4.5:1)
[PASS] editorial (light)            | text-primary on bg-elevated (text)       | #141413 on #f1efe9 => 16.03:1 (min 4.5:1)
[PASS] editorial (light)            | text-secondary on bg-canvas (text)       | #4a4843 on #f8f7f4 => 8.53:1 (min 4.5:1)
[PASS] editorial (light)            | text-secondary on bg-surface (text)      | #4a4843 on #ffffff => 9.13:1 (min 4.5:1)
[PASS] editorial (light)            | text-muted on bg-canvas (text)           | #5c5953 on #f8f7f4 => 6.51:1 (min 4.5:1)
[PASS] editorial (light)            | text-muted on bg-surface (text)          | #5c5953 on #ffffff => 6.98:1 (min 4.5:1)
[PASS] editorial (light)            | text-secondary on bg-elevated (icons/large) | #4a4843 on #f1efe9 => 7.94:1 (min 3.0:1)
[PASS] editorial (light)            | border-strong on bg-surface (input border) | #736e64 on #ffffff => 5.07:1 (min 3.0:1)
[PASS] editorial (light)            | border-strong on bg-canvas (input border) | #736e64 on #f8f7f4 => 4.73:1 (min 3.0:1)
[PASS] editorial+cobalt (light)     | focus-ring on bg-surface (focus >= 3:1)  | #1d4ed8 on #ffffff => 6.70:1 (min 3.0:1)
[PASS] editorial+cobalt (light)     | focus-ring on bg-canvas (focus >= 3:1)   | #1d4ed8 on #f8f7f4 => 6.26:1 (min 3.0:1)
[PASS] editorial+emerald (light)    | focus-ring on bg-surface (focus >= 3:1)  | #047857 on #ffffff => 5.48:1 (min 3.0:1)
[PASS] editorial+emerald (light)    | focus-ring on bg-canvas (focus >= 3:1)   | #047857 on #f8f7f4 => 5.12:1 (min 3.0:1)
[PASS] editorial+amber (light)      | focus-ring on bg-surface (focus >= 3:1)  | #b45309 on #ffffff => 5.02:1 (min 3.0:1)
[PASS] editorial+amber (light)      | focus-ring on bg-canvas (focus >= 3:1)   | #b45309 on #f8f7f4 => 4.69:1 (min 3.0:1)
[PASS] editorial+rose (light)       | focus-ring on bg-surface (focus >= 3:1)  | #be123c on #ffffff => 6.29:1 (min 3.0:1)
[PASS] editorial+rose (light)       | focus-ring on bg-canvas (focus >= 3:1)   | #be123c on #f8f7f4 => 5.87:1 (min 3.0:1)
[PASS] editorial (dark)             | text-primary on bg-canvas (text)         | #f5f3ee on #121210 => 16.91:1 (min 4.5:1)
[PASS] editorial (dark)             | text-primary on bg-surface (text)        | #f5f3ee on #1b1b18 => 15.57:1 (min 4.5:1)
[PASS] editorial (dark)             | text-primary on bg-elevated (text)       | #f5f3ee on #252521 => 13.87:1 (min 4.5:1)
[PASS] editorial (dark)             | text-secondary on bg-canvas (text)       | #c9c5bc on #121210 => 10.89:1 (min 4.5:1)
[PASS] editorial (dark)             | text-secondary on bg-surface (text)      | #c9c5bc on #1b1b18 => 10.03:1 (min 4.5:1)
[PASS] editorial (dark)             | text-muted on bg-canvas (text)           | #a6a196 on #121210 => 7.29:1 (min 4.5:1)
[PASS] editorial (dark)             | text-muted on bg-surface (text)          | #a6a196 on #1b1b18 => 6.71:1 (min 4.5:1)
[PASS] editorial (dark)             | text-secondary on bg-elevated (icons/large) | #c9c5bc on #252521 => 8.93:1 (min 3.0:1)
[PASS] editorial (dark)             | border-strong on bg-surface (input border) | #8c877b on #1b1b18 => 4.82:1 (min 3.0:1)
[PASS] editorial (dark)             | border-strong on bg-canvas (input border) | #8c877b on #121210 => 5.24:1 (min 3.0:1)
[PASS] editorial+cobalt (dark)      | focus-ring on bg-surface (focus >= 3:1)  | #60a5fa on #1b1b18 => 6.79:1 (min 3.0:1)
[PASS] editorial+cobalt (dark)      | focus-ring on bg-canvas (focus >= 3:1)   | #60a5fa on #121210 => 7.38:1 (min 3.0:1)
[PASS] editorial+emerald (dark)     | focus-ring on bg-surface (focus >= 3:1)  | #34d399 on #1b1b18 => 8.98:1 (min 3.0:1)
[PASS] editorial+emerald (dark)     | focus-ring on bg-canvas (focus >= 3:1)   | #34d399 on #121210 => 9.76:1 (min 3.0:1)
[PASS] editorial+amber (dark)       | focus-ring on bg-surface (focus >= 3:1)  | #fbbf24 on #1b1b18 => 10.34:1 (min 3.0:1)
[PASS] editorial+amber (dark)       | focus-ring on bg-canvas (focus >= 3:1)   | #fbbf24 on #121210 => 11.23:1 (min 3.0:1)
[PASS] editorial+rose (dark)        | focus-ring on bg-surface (focus >= 3:1)  | #fb7185 on #1b1b18 => 6.41:1 (min 3.0:1)
[PASS] editorial+rose (dark)        | focus-ring on bg-canvas (focus >= 3:1)   | #fb7185 on #121210 => 6.97:1 (min 3.0:1)
[PASS] obsidian (light)             | text-primary on bg-canvas (text)         | #0f172a on #f4f6f9 => 16.49:1 (min 4.5:1)
[PASS] obsidian (light)             | text-primary on bg-surface (text)        | #0f172a on #ffffff => 17.85:1 (min 4.5:1)
[PASS] obsidian (light)             | text-primary on bg-elevated (text)       | #0f172a on #eaeff5 => 15.44:1 (min 4.5:1)
[PASS] obsidian (light)             | text-secondary on bg-canvas (text)       | #334155 on #f4f6f9 => 9.56:1 (min 4.5:1)
[PASS] obsidian (light)             | text-secondary on bg-surface (text)      | #334155 on #ffffff => 10.35:1 (min 4.5:1)
[PASS] obsidian (light)             | text-muted on bg-canvas (text)           | #475569 on #f4f6f9 => 7.00:1 (min 4.5:1)
[PASS] obsidian (light)             | text-muted on bg-surface (text)          | #475569 on #ffffff => 7.58:1 (min 4.5:1)
[PASS] obsidian (light)             | text-secondary on bg-elevated (icons/large) | #334155 on #eaeff5 => 8.96:1 (min 3.0:1)
[PASS] obsidian (light)             | border-strong on bg-surface (input border) | #64748b on #ffffff => 4.76:1 (min 3.0:1)
[PASS] obsidian (light)             | border-strong on bg-canvas (input border) | #64748b on #f4f6f9 => 4.40:1 (min 3.0:1)
[PASS] obsidian+cobalt (light)      | focus-ring on bg-surface (focus >= 3:1)  | #1d4ed8 on #ffffff => 6.70:1 (min 3.0:1)
[PASS] obsidian+cobalt (light)      | focus-ring on bg-canvas (focus >= 3:1)   | #1d4ed8 on #f4f6f9 => 6.19:1 (min 3.0:1)
[PASS] obsidian+emerald (light)     | focus-ring on bg-surface (focus >= 3:1)  | #047857 on #ffffff => 5.48:1 (min 3.0:1)
[PASS] obsidian+emerald (light)     | focus-ring on bg-canvas (focus >= 3:1)   | #047857 on #f4f6f9 => 5.07:1 (min 3.0:1)
[PASS] obsidian+amber (light)       | focus-ring on bg-surface (focus >= 3:1)  | #b45309 on #ffffff => 5.02:1 (min 3.0:1)
[PASS] obsidian+amber (light)       | focus-ring on bg-canvas (focus >= 3:1)   | #b45309 on #f4f6f9 => 4.64:1 (min 3.0:1)
[PASS] obsidian+rose (light)        | focus-ring on bg-surface (focus >= 3:1)  | #be123c on #ffffff => 6.29:1 (min 3.0:1)
[PASS] obsidian+rose (light)        | focus-ring on bg-canvas (focus >= 3:1)   | #be123c on #f4f6f9 => 5.81:1 (min 3.0:1)
[PASS] obsidian (dark)              | text-primary on bg-canvas (text)         | #f8fafc on #0b0f19 => 18.30:1 (min 4.5:1)
[PASS] obsidian (dark)              | text-primary on bg-surface (text)        | #f8fafc on #111827 => 16.96:1 (min 4.5:1)
[PASS] obsidian (dark)              | text-primary on bg-elevated (text)       | #f8fafc on #1e293b => 13.98:1 (min 4.5:1)
[PASS] obsidian (dark)              | text-secondary on bg-canvas (text)       | #cbd5e1 on #0b0f19 => 12.90:1 (min 4.5:1)
[PASS] obsidian (dark)              | text-secondary on bg-surface (text)      | #cbd5e1 on #111827 => 11.95:1 (min 4.5:1)
[PASS] obsidian (dark)              | text-muted on bg-canvas (text)           | #94a3b8 on #0b0f19 => 7.47:1 (min 4.5:1)
[PASS] obsidian (dark)              | text-muted on bg-surface (text)          | #94a3b8 on #111827 => 6.92:1 (min 4.5:1)
[PASS] obsidian (dark)              | text-secondary on bg-elevated (icons/large) | #cbd5e1 on #1e293b => 9.85:1 (min 3.0:1)
[PASS] obsidian (dark)              | border-strong on bg-surface (input border) | #7c8ea6 on #111827 => 5.30:1 (min 3.0:1)
[PASS] obsidian (dark)              | border-strong on bg-canvas (input border) | #7c8ea6 on #0b0f19 => 5.72:1 (min 3.0:1)
[PASS] obsidian+cobalt (dark)       | focus-ring on bg-surface (focus >= 3:1)  | #60a5fa on #111827 => 6.98:1 (min 3.0:1)
[PASS] obsidian+cobalt (dark)       | focus-ring on bg-canvas (focus >= 3:1)   | #60a5fa on #0b0f19 => 7.53:1 (min 3.0:1)
[PASS] obsidian+emerald (dark)      | focus-ring on bg-surface (focus >= 3:1)  | #34d399 on #111827 => 9.23:1 (min 3.0:1)
[PASS] obsidian+emerald (dark)      | focus-ring on bg-canvas (focus >= 3:1)   | #34d399 on #0b0f19 => 9.96:1 (min 3.0:1)
[PASS] obsidian+amber (dark)        | focus-ring on bg-surface (focus >= 3:1)  | #fbbf24 on #111827 => 10.63:1 (min 3.0:1)
[PASS] obsidian+amber (dark)        | focus-ring on bg-canvas (focus >= 3:1)   | #fbbf24 on #0b0f19 => 11.47:1 (min 3.0:1)
[PASS] obsidian+rose (dark)         | focus-ring on bg-surface (focus >= 3:1)  | #fb7185 on #111827 => 6.59:1 (min 3.0:1)
[PASS] obsidian+rose (dark)         | focus-ring on bg-canvas (focus >= 3:1)   | #fb7185 on #0b0f19 => 7.12:1 (min 3.0:1)
[PASS] emerald (light)              | text-primary on bg-canvas (text)         | #0c1f17 on #f3f7f5 => 15.88:1 (min 4.5:1)
[PASS] emerald (light)              | text-primary on bg-surface (text)        | #0c1f17 on #ffffff => 17.16:1 (min 4.5:1)
[PASS] emerald (light)              | text-primary on bg-elevated (text)       | #0c1f17 on #e7f0ec => 14.77:1 (min 4.5:1)
[PASS] emerald (light)              | text-secondary on bg-canvas (text)       | #28473a on #f3f7f5 => 9.47:1 (min 4.5:1)
[PASS] emerald (light)              | text-secondary on bg-surface (text)      | #28473a on #ffffff => 10.23:1 (min 4.5:1)
[PASS] emerald (light)              | text-muted on bg-canvas (text)           | #3d5c4f on #f3f7f5 => 6.84:1 (min 4.5:1)
[PASS] emerald (light)              | text-muted on bg-surface (text)          | #3d5c4f on #ffffff => 7.39:1 (min 4.5:1)
[PASS] emerald (light)              | text-secondary on bg-elevated (icons/large) | #28473a on #e7f0ec => 8.80:1 (min 3.0:1)
[PASS] emerald (light)              | border-strong on bg-surface (input border) | #5c7d6f on #ffffff => 4.55:1 (min 3.0:1)
[PASS] emerald (light)              | border-strong on bg-canvas (input border) | #5c7d6f on #f3f7f5 => 4.21:1 (min 3.0:1)
[PASS] emerald+cobalt (light)       | focus-ring on bg-surface (focus >= 3:1)  | #1d4ed8 on #ffffff => 6.70:1 (min 3.0:1)
[PASS] emerald+cobalt (light)       | focus-ring on bg-canvas (focus >= 3:1)   | #1d4ed8 on #f3f7f5 => 6.20:1 (min 3.0:1)
[PASS] emerald+emerald (light)      | focus-ring on bg-surface (focus >= 3:1)  | #047857 on #ffffff => 5.48:1 (min 3.0:1)
[PASS] emerald+emerald (light)      | focus-ring on bg-canvas (focus >= 3:1)   | #047857 on #f3f7f5 => 5.07:1 (min 3.0:1)
[PASS] emerald+amber (light)        | focus-ring on bg-surface (focus >= 3:1)  | #b45309 on #ffffff => 5.02:1 (min 3.0:1)
[PASS] emerald+amber (light)        | focus-ring on bg-canvas (focus >= 3:1)   | #b45309 on #f3f7f5 => 4.65:1 (min 3.0:1)
[PASS] emerald+rose (light)         | focus-ring on bg-surface (focus >= 3:1)  | #be123c on #ffffff => 6.29:1 (min 3.0:1)
[PASS] emerald+rose (light)         | focus-ring on bg-canvas (focus >= 3:1)   | #be123c on #f3f7f5 => 5.82:1 (min 3.0:1)
[PASS] emerald (dark)               | text-primary on bg-canvas (text)         | #eef7f3 on #091410 => 17.19:1 (min 4.5:1)
[PASS] emerald (dark)               | text-primary on bg-surface (text)        | #eef7f3 on #102019 => 15.48:1 (min 4.5:1)
[PASS] emerald (dark)               | text-primary on bg-elevated (text)       | #eef7f3 on #182e25 => 13.21:1 (min 4.5:1)
[PASS] emerald (dark)               | text-secondary on bg-canvas (text)       | #bfd6cc on #091410 => 12.25:1 (min 4.5:1)
[PASS] emerald (dark)               | text-secondary on bg-surface (text)      | #bfd6cc on #102019 => 11.03:1 (min 4.5:1)
[PASS] emerald (dark)               | text-muted on bg-canvas (text)           | #94b5a7 on #091410 => 8.42:1 (min 4.5:1)
[PASS] emerald (dark)               | text-muted on bg-surface (text)          | #94b5a7 on #102019 => 7.59:1 (min 4.5:1)
[PASS] emerald (dark)               | text-secondary on bg-elevated (icons/large) | #bfd6cc on #182e25 => 9.41:1 (min 3.0:1)
[PASS] emerald (dark)               | border-strong on bg-surface (input border) | #6f9686 on #102019 => 5.14:1 (min 3.0:1)
[PASS] emerald (dark)               | border-strong on bg-canvas (input border) | #6f9686 on #091410 => 5.70:1 (min 3.0:1)
[PASS] emerald+cobalt (dark)        | focus-ring on bg-surface (focus >= 3:1)  | #60a5fa on #102019 => 6.65:1 (min 3.0:1)
[PASS] emerald+cobalt (dark)        | focus-ring on bg-canvas (focus >= 3:1)   | #60a5fa on #091410 => 7.38:1 (min 3.0:1)
[PASS] emerald+emerald (dark)       | focus-ring on bg-surface (focus >= 3:1)  | #34d399 on #102019 => 8.79:1 (min 3.0:1)
[PASS] emerald+emerald (dark)       | focus-ring on bg-canvas (focus >= 3:1)   | #34d399 on #091410 => 9.76:1 (min 3.0:1)
[PASS] emerald+amber (dark)         | focus-ring on bg-surface (focus >= 3:1)  | #fbbf24 on #102019 => 10.12:1 (min 3.0:1)
[PASS] emerald+amber (dark)         | focus-ring on bg-canvas (focus >= 3:1)   | #fbbf24 on #091410 => 11.24:1 (min 3.0:1)
[PASS] emerald+rose (dark)          | focus-ring on bg-surface (focus >= 3:1)  | #fb7185 on #102019 => 6.28:1 (min 3.0:1)
[PASS] emerald+rose (dark)          | focus-ring on bg-canvas (focus >= 3:1)   | #fb7185 on #091410 => 6.97:1 (min 3.0:1)
[PASS] accent:cobalt (light)        | accent-on-primary on accent-primary      | #ffffff on #1d4ed8 => 6.70:1 (min 4.5:1)
[PASS] accent:cobalt (light)        | accent-subtle-text on accent-subtle-bg   | #1e3a8a on #dbeafe => 8.49:1 (min 4.5:1)
[PASS] accent:cobalt (dark)         | accent-on-primary on accent-primary      | #0b1329 on #60a5fa => 7.25:1 (min 4.5:1)
[PASS] accent:cobalt (dark)         | accent-subtle-text on accent-subtle-bg   | #dbeafe on #1e3a8a => 8.49:1 (min 4.5:1)
[PASS] accent:emerald (light)       | accent-on-primary on accent-primary      | #ffffff on #047857 => 5.48:1 (min 4.5:1)
[PASS] accent:emerald (light)       | accent-subtle-text on accent-subtle-bg   | #064e3b on #d1fae5 => 8.57:1 (min 4.5:1)
[PASS] accent:emerald (dark)        | accent-on-primary on accent-primary      | #052016 on #34d399 => 8.92:1 (min 4.5:1)
[PASS] accent:emerald (dark)        | accent-subtle-text on accent-subtle-bg   | #d1fae5 on #064e3b => 8.57:1 (min 4.5:1)
[PASS] accent:amber (light)         | accent-on-primary on accent-primary      | #ffffff on #b45309 => 5.02:1 (min 4.5:1)
[PASS] accent:amber (light)         | accent-subtle-text on accent-subtle-bg   | #78350f on #fef3c7 => 8.15:1 (min 4.5:1)
[PASS] accent:amber (dark)          | accent-on-primary on accent-primary      | #211202 on #fbbf24 => 10.92:1 (min 4.5:1)
[PASS] accent:amber (dark)          | accent-subtle-text on accent-subtle-bg   | #fef3c7 on #78350f => 8.15:1 (min 4.5:1)
[PASS] accent:rose (light)          | accent-on-primary on accent-primary      | #ffffff on #be123c => 6.29:1 (min 4.5:1)
[PASS] accent:rose (light)          | accent-subtle-text on accent-subtle-bg   | #881337 on #ffe4e6 => 7.97:1 (min 4.5:1)
[PASS] accent:rose (dark)           | accent-on-primary on accent-primary      | #29060d on #fb7185 => 6.93:1 (min 4.5:1)
[PASS] accent:rose (dark)           | accent-subtle-text on accent-subtle-bg   | #ffe4e6 on #881337 => 7.97:1 (min 4.5:1)
[PASS] status (light)               | danger-text on danger-bg                 | #991b1b on #fee2e2 => 6.80:1 (min 4.5:1)
[PASS] status (light)               | btn-danger-text on btn-danger-bg         | #ffffff on #b91c1c => 6.47:1 (min 4.5:1)
[PASS] status (light)               | urgent-text on urgent-bg                 | #9a3412 on #ffedd5 => 6.38:1 (min 4.5:1)
[PASS] status (light)               | warning-text on warning-bg               | #854d0e on #fef3c7 => 6.15:1 (min 4.5:1)
[PASS] status (light)               | success-text on success-bg               | #166534 on #dcfce7 => 6.49:1 (min 4.5:1)
[PASS] status (light)               | info-text on info-bg                     | #1e40af on #dbeafe => 7.15:1 (min 4.5:1)
[PASS] status (light)               | neutral-text on neutral-bg               | #1e293b on #e2e8f0 => 11.87:1 (min 4.5:1)
[PASS] status (dark)                | danger-text on danger-bg                 | #fecaca on #451212 => 10.77:1 (min 4.5:1)
[PASS] status (dark)                | btn-danger-text on btn-danger-bg         | #280505 on #f87171 => 6.81:1 (min 4.5:1)
[PASS] status (dark)                | urgent-text on urgent-bg                 | #fed7aa on #431807 => 11.31:1 (min 4.5:1)
[PASS] status (dark)                | warning-text on warning-bg               | #fef08a on #3f2706 => 12.00:1 (min 4.5:1)
[PASS] status (dark)                | success-text on success-bg               | #bbf7d0 on #08331c => 11.55:1 (min 4.5:1)
[PASS] status (dark)                | info-text on info-bg                     | #bfdbfe on #11244d => 10.68:1 (min 4.5:1)
[PASS] status (dark)                | neutral-text on neutral-bg               | #e2e8f0 on #273244 => 10.48:1 (min 4.5:1)
Contrast check PASSED: all 138 pairs meet or exceed WCAG AA thresholds.
```

---

## Checks 5, 6, 7, 8, 9, 10, 11, 13, 14: E2E Reset Guard and Full Playwright Browser Suite

Verified `scripts/e2e-reset.ps1` refuses to touch `tracex_fresh_dev` (exit code 1) and resets `tracex_fresh_e2e` (exit code 0), followed by running `npm run e2e` against the real `e2e` backend and Vite `e2e` server:

```text
PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> powershell -ExecutionPolicy Bypass -File "..\scripts\e2e-reset.ps1" -DatabaseName "tracex_fresh_dev"
SAFETY GUARD ABORTED: Refusing to reset database 'tracex_fresh_dev'. Only 'tracex_fresh_e2e' may be reset by this script.
Dev DB guard exit code: 1

PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> powershell -ExecutionPolicy Bypass -File "..\scripts\e2e-reset.ps1"; npm run e2e
Resetting E2E database 'tracex_fresh_e2e' at mongodb://localhost:27017/tracex_fresh_e2e ...
Successfully dropped E2E database 'tracex_fresh_e2e'.

> tracex-frontend@1.0.0 e2e
> playwright test


Running 6 tests using 1 worker

  ok 1 [chromium] › e2e\phase05.spec.ts:46:3 › Phase 5 E2E Verification Suite (Checks 5, 6, 7, 8, 9, 10, 11, 13, 14) › Check 5 & Check 13: Log in as each seeded role, verify name/role, wrong password error, and token/console hygiene (5.5s)
  ok 2 [chromium] › e2e\phase05.spec.ts:99:3 › Phase 5 E2E Verification Suite (Checks 5, 6, 7, 8, 9, 10, 11, 13, 14) › Check 6 & Forgot/Reset Password: Full invite onboarding flow and password reset flow in browser (3.7s)
  ok 3 [chromium] › e2e\phase05.spec.ts:194:3 › Phase 5 E2E Verification Suite (Checks 5, 6, 7, 8, 9, 10, 11, 13, 14) › Check 7: 401 mid-session redirect with preserved return path, open-redirect block, deactivated user message, 403 forbidden state, and offline recovery (17.8s)
  ok 4 [chromium] › e2e\phase05.spec.ts:301:3 › Phase 5 E2E Verification Suite (Checks 5, 6, 7, 8, 9, 10, 11, 13, 14) › Check 8 & Check 9: Keyboard-only login, skip link, navigation, dialog focus trap/Escape/restore, theme toggle, and reduced motion 0s durations (1.1s)
  ok 5 [chromium] › e2e\phase05.spec.ts:381:3 › Phase 5 E2E Verification Suite (Checks 5, 6, 7, 8, 9, 10, 11, 13, 14) › Check 10 & Check 14: axe zero serious/critical violations on every route and styleguide in light and dark for all three palettes, plus runtime switching and reload persistence (51.5s)
  ok 6 [chromium] › e2e\phase05.spec.ts:487:3 › Phase 5 E2E Verification Suite (Checks 5, 6, 7, 8, 9, 10, 11, 13, 14) › Check 11: Responsive viewports (375px, 768px, 1280px), zero horizontal overflow, adaptive navigation, and screenshots (3.6s)

  6 passed (2.0m)
```

Screenshots saved in `docs/screenshots/phase-05/`:

```text
PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> Get-ChildItem ..\docs\screenshots\phase-05\*.png | Select-Object Name, Length

Name                        Length
----                        ------
login-dark-375.png           24762
login-light-1280.png         27495
shell-desktop-1280.png       60479
shell-mobile-drawer-375.png  17798
styleguide-dark-1280.png    171289
styleguide-light-1280.png   165263
```

---

## Check 12: Production Build Guard, CSP Injection, and Bundle Hygiene

```text
=== CHECK 12: Production build env guard + dist verification ===

> tracex-frontend@1.0.0 build
> tsc -b && vite build

error during build:
Error: PRODUCTION BUILD ERROR: VITE_API_BASE_URL is required for production builds and must be a valid https:// URL.
Missing VITE_API_BASE_URL exit code: 1

> tracex-frontend@1.0.0 build
> tsc -b && vite build

error during build:
Error: PRODUCTION BUILD ERROR: VITE_API_BASE_URL must use https:// in production builds (received: "http://api.tracex.example.com").
HTTP VITE_API_BASE_URL exit code: 1

> tracex-frontend@1.0.0 build
> tsc -b && vite build

vite v6.3.3 building for production...
transforming...
✓ 1710 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.83 kB │ gzip:   0.47 kB
dist/assets/index-DSvYkIBM.css   24.83 kB │ gzip:   5.21 kB
dist/assets/index-g2DNWfD1.js   361.27 kB │ gzip: 109.24 kB
✓ built in 20.33s
HTTPS VITE_API_BASE_URL exit code: 0
=== dist/index.html contents ===
<!doctype html>
<html lang="en" data-theme="light" data-palette="editorial" data-accent="cobalt">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="TraceX — Supply Chain Freshness & Traceability Platform" />
    <title>TraceX — Freshness & Traceability</title>
    <script type="module" crossorigin src="/assets/index-g2DNWfD1.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-DSvYkIBM.css">
      <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://api.tracex.example.com; base-uri 'self'; form-action 'self'" />
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
=== Search dist/ for localhost, 127.0.0.1, styleguide, fonts.googleapis, fonts.gstatic ===
Forbidden pattern hits in dist/: 0
```

---

## Check 15: Date Helpers Across `UTC`, `Asia/Kolkata`, and `America/Los_Angeles`

```text
PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> foreach ($tz in @("UTC", "Asia/Kolkata", "America/Los_Angeles")) { Write-Host "=== TZ=$tz ==="; $env:TZ = $tz; npx vitest run src/lib/dates.test.ts }; Remove-Item Env:\TZ -ErrorAction SilentlyContinue
=== TZ=UTC ===

 RUN  v3.1.2 C:/Users/yashm/OneDrive/Desktop/TraceX/frontend

 ✓ src/lib/dates.test.ts (7 tests) 28ms

 Test Files  1 passed (1)
      Tests  7 passed (7)
   Start at  07:16:27
   Duration  1.54s

=== TZ=Asia/Kolkata ===

 RUN  v3.1.2 C:/Users/yashm/OneDrive/Desktop/TraceX/frontend

 ✓ src/lib/dates.test.ts (7 tests) 28ms

 Test Files  1 passed (1)
      Tests  7 passed (7)
   Start at  12:46:30
   Duration  1.57s

=== TZ=America/Los_Angeles ===

 RUN  v3.1.2 C:/Users/yashm/OneDrive/Desktop/TraceX/frontend

 ✓ src/lib/dates.test.ts (7 tests) 29ms

 Test Files  1 passed (1)
      Tests  7 passed (7)
   Start at  00:16:34
   Duration  1.56s
```

---

## Check 16: Documentation & Markdown Table Linter

Updated `SPEC.md`, `docs/traceability.md`, and `PROGRESS.md`, and verified all Markdown files with `scripts/lint-md-tables.ps1`:

```text
PS C:\Users\yashm\OneDrive\Desktop\TraceX> powershell -ExecutionPolicy Bypass -File scripts/lint-md-tables.ps1
=== Markdown Table Linter ===
Scanning 25 Markdown files...


=== Summary ===
Files checked: 25
Errors: 0
Warnings: 0
STATUS: PASSED (Zero problems found)
```
