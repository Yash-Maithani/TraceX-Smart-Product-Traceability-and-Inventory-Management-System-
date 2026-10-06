# Phase 4.1 Verification and Repair Log — FEFO, Quality Inspections, and Dispatch

> Executed: 2026-10-04
> Environment: Windows 11, Java 21 (Eclipse Temurin 21.0.12.1+1-LTS), Spring Boot 3.2.5, MongoDB 4.11.2 driver against `tracex_fresh_test` (integration tests) and `tracex_fresh_dev` (live dev trace).

---

## Summary of Phase 4.1 Verification Items

| Item | Description | Result |
|---|---|---|
| V1 | Test inventory (`FefoServiceTest`, `InspectionAndDispatchTests`, `OpenApiExportTest`), mapping to Phase 4 checks, and gap additions | PASS |
| V2 | Corrupted `expiryDate` tolerance (`missing`, `null`, `"not-a-date"`) across FEFO, batch list, and batch detail | PASS |
| V3 | Single authority for FEFO (`FefoService`) and freshness tier thresholds (`BatchFreshness`) | PASS |
| V4 | Atomic conditional dispatch (`findAndModify`) and 100-iteration 2-thread race counts (`100` / `100`) | PASS |
| V5 | Inspections partial unique index (`batchId_isLatest_unique_idx`) and 10-thread parallel `qualityCheck` snapshot convergence | PASS |
| V6 | `SPEC.md` §6.2 sync (`DISPATCH_OUT_OF_ORDER`, `BATCH_EXPIRED`, `QUALITY_HOLD`), `PROGRESS.md` changelog, and OpenAPI operation list | PASS |
| V7 | `Decisions` table `Outcome` column (`D-1` to `D-19`) in `PROGRESS.md` and markdown table linter | PASS |
| V8 | Full `.\mvnw.cmd clean verify` (`401` tests, per-class counts) and live dev-server trace | PASS |

---

## V1: Test Inventory and Phase 4 Check Mapping

- **Result**: PASS
- Every test method in `FefoServiceTest` (`11` methods), `InspectionAndDispatchTests` (`12` methods), and `OpenApiExportTest` (`1` method) is listed below with a one-line assertion summary and mapped to the Phase 4 checks and the 21 required scenarios.
- **Tests added in Phase 4.1 to close V1/V2 gaps**:
  - `FefoServiceTest.testEmptyFefoQueue` (empty queue returns empty `queue`, `expired`, and `exceptions` lists)
  - `FefoServiceTest.testOrderAfterEditDispatchArchiveAndRestore` (order and 1-based `rank` update after raw-material `expiryDate` edit, dispatch, archive, and restore)
  - `FefoServiceTest.testBusinessTimezone2330UtcBoundaryInFefoAndDispatch` (`23:30 UTC` = `05:00 IST` next day in `Asia/Kolkata` boundary across FEFO and dispatch)
  - `FefoServiceTest.testCorruptedExpiryDateDoesNotBreakFefoOrBatchReads` (raw `MongoTemplate` insertion of missing, `null`, and `"not-a-date"` `expiryDate` tested against `GET /api/v1/dispatch/fefo`, `GET /api/v1/batches`, and `GET /api/v1/batches/{id}`)
  - `InspectionAndDispatchTests.testDispatchExpiredTodayAndYesterdayReturnsBatchExpired` (expanded to assert both expired-today -> `409 BATCH_EXPIRED` and expiring-tomorrow `+1d` -> `200 OK`)

### `FefoServiceTest` (11 test methods)

| Test Method | One-Line Assertion Summary | Phase 4 Check Mapping |
|---|---|---|
| `testThreeGroupsClassification` | Asserts active batches with `daysUntilExpiry > 0` go to `queue`, `<= 0` go to `expired`, and `null`/unparseable `expiryDate` go to `exceptions` with `status = "EXCEPTION"` and `exceptionReason`. | Check 3 (FEFO 3 groups; expired in `expired`; corrupted in `exceptions`) |
| `testExcludedStatesNotInAnyGroup` | Asserts `DISPATCHED` and archived/soft-deleted (`isDeleted = true`) batches are excluded from `queue`, `expired`, and `exceptions`. | Check 3 (Dispatched, archived, and soft-deleted excluded) |
| `testOrderingAndOneBasedRank` | Asserts `queue` orders by tier (`URGENT` -> `WARNING` -> `READY`), `daysUntilExpiry` asc, `createdAt` asc, then `batchCode` asc, and assigns contiguous 1-based `rank`. | Check 1 & Check 3 (FEFO ordering with different expiry dates; equal expiry tie-break by `createdAt` then `batchCode`) |
| `testBoundaryDaysWithFixedClock` | Asserts exact tier boundaries under a fixed `Clock`: `<= 0` (`expired`), `+1` and `+7` (`URGENT`), `+8` and `+30` (`WARNING`), and `+31` (`READY`). | Check 3 (Expiry today, `+1`, `+7`, `+8`, `+30`, `+31`) |
| `testAdvancingClockMovesBatchWithZeroDbWrites` | Asserts advancing the `Clock` moves a batch across `READY -> WARNING -> URGENT -> expired` with zero database writes (`updatedAt` unchanged). | Check 3 (Dynamic runtime tier transitions with zero DB writes) |
| `testCategoryAndSkuFiltersAppliedBeforeOrderingAndRank` | Asserts `category` and `sku` query parameters filter eligible batches before FEFO ordering and re-index `rank` starting at `1`. | Check 3 & D-18 (`sku` filter and `category` filter) |
| `testPriorityScoreComputedAndDoesNotAffectQueueOrder` | Asserts `priorityScore` (`max(0, 365 - daysUntilExpiry) + riskBonus`) is returned on DTOs and a higher `priorityScore` on a `READY` batch never ranks ahead of an `URGENT` batch. | Check 2 (`priorityScore` display-only; never affects FEFO order) |
| `testEmptyFefoQueue` | Asserts `GET /api/v1/dispatch/fefo` returns HTTP 200 with empty `queue`, `expired`, and `exceptions` arrays when no eligible batches exist. | Check 3 (Empty queue) |
| `testOrderAfterEditDispatchArchiveAndRestore` | Asserts FEFO queue order and 1-based `rank` dynamically update after raw-material `expiryDate` edit (`PATCH /raw-material`), dispatch (`PATCH /dispatch`), archive (`DELETE /batches/{id}`), and restore (`PATCH /restore`). | Check 3 (Order after edit, dispatch, archive, and restore) |
| `testBusinessTimezone2330UtcBoundaryInFefoAndDispatch` | Asserts at `2026-06-15T23:30:00Z` (`2026-06-16T05:00:00+05:30` in `Asia/Kolkata`), a batch expiring on `2026-06-16` IST has `daysUntilExpiry == 0` (`expired`, `409 BATCH_EXPIRED` on dispatch) while `2026-06-17` IST has `daysUntilExpiry == 1` (`URGENT` in `queue`, `200 OK` on dispatch). | Check 3 & Check 5 (`23:30 UTC` `Asia/Kolkata` business-zone case) |
| `testCorruptedExpiryDateDoesNotBreakFefoOrBatchReads` | Asserts raw batches with missing, `null`, and `"not-a-date"` `expiryDate` return HTTP 200 on `GET /api/v1/dispatch/fefo` (in `exceptions` with `exceptionReason`), `GET /api/v1/batches`, and `GET /api/v1/batches/{id}`, then cleans up. | Check 3 & V2 (Corrupted data tolerance on FEFO, batch list, and batch detail) |

### `InspectionAndDispatchTests` (12 test methods)

| Test Method | One-Line Assertion Summary | Phase 4 Check Mapping |
|---|---|---|
| `testCreateInspectionAndSupersedeLatest` | Asserts `POST /api/v1/inspections` sets `isLatest = true`, snapshots `Batch.qualityCheck`, writes a PII-free `INSPECTION_CREATED` audit log, and a second inspection flips the first to `isLatest = false` with `GET /batch/{batchId}` returning newest first. | Check 6 & Check 9 (Inspection creation, `isLatest` superseding, `qualityCheck` snapshot, PII-free audit) |
| `testGetLatestInspectionsAndMyInspections` | Asserts `GET /api/v1/inspections` returns only `isLatest = true` records (with `status` filtering) and `GET /api/v1/inspections/my` returns only the authenticated inspector's records. | Check 6 (Inspection list and `/my` filtering) |
| `testInspectionValidationsAndClientIsLatestIgnored` | Asserts `PASSED` with any `passed = false` checklist item returns `422` (`fieldErrors` on `status`), `PASSED` with `passed = null` succeeds (`201`) while ignoring client-supplied `isLatest = false`, and rating `0`/`6`, unknown checklist labels, and over-length fields return `422`. | Check 6 (`PASSED` with `false` checklist item -> `422`; rating `0` and `6` rejected; client-supplied `isLatest` ignored) |
| `testInspectionBatchEligibilityAndImmutability405` | Asserts inspecting an unknown or archived batch returns `404`, inspecting a `DISPATCHED` batch returns `409 CONFLICT`, and `PUT`/`PATCH`/`DELETE` on `/api/v1/inspections` and `/api/v1/inspections/{id}` return `405 METHOD_NOT_ALLOWED`. | Check 6 (`PUT`, `PATCH`, `DELETE` on inspections rejected with `405`) |
| `testTenConcurrentInspectionsSingleIsLatest` | Asserts 10 parallel threads submitting inspections on one batch save all 10 documents, leave exactly one with `isLatest = true` (the newest), and converge `Batch.qualityCheck` to the newest inspection. | Check 9 (Ten parallel inspections leave exactly one `isLatest = true`) |
| `testInspectionsIndexesNoTtlAndPartialUniqueIndexPresent` | Asserts `inspections.listIndexes()` contains no `expireAfterSeconds` (no TTL) and includes the partial unique index `batchId_isLatest_unique_idx` on `{ batchId: 1 }` where `{ isLatest: true }`. | Check 9 & Check 10 (Partial unique index and no TTL on `inspections`) |
| `testDispatchEarliestSuccessAndReDispatchConflict` | Asserts dispatching the earliest batch returns `200 OK` (`DISPATCHED`), removes it from FEFO `queue`, writes a PII-free `BATCH_DISPATCHED` audit log, rejects re-dispatch with `409 CONFLICT`, and rejects archived/unknown batches with `404`. | Check 4 (Dispatch lifecycle, FEFO removal, PII-free audit, re-dispatch `409`) |
| `testDispatchExpiredTodayAndYesterdayReturnsBatchExpired` | Asserts dispatching a batch expiring today (`daysUntilExpiry == 0`) or yesterday (`-1`) returns `409 BATCH_EXPIRED` (both in `expired`, never `queue`), while dispatching a batch expiring tomorrow (`+1`) returns `200 OK`. | Check 5 (Expired-today dispatch gives `409 BATCH_EXPIRED` and expiring tomorrow succeeds) |
| `testQualityHoldFailedBlocksAndPassedUnblocksAndFlaggedWarns` | Asserts a `FAILED` latest inspection blocks dispatch with `409 QUALITY_HOLD`, a subsequent `PASSED` inspection lifts the hold (`200 OK`), and a `FLAGGED` inspection dispatches (`200 OK`) with a response `warning`. | Check 7 (`FAILED` verdict blocks dispatch and later `PASSED` lifts it; `FLAGGED` dispatches with warning) |
| `testOutOfOrderPerSkuOverrideAndTieRule` | Asserts out-of-order dispatch for the same SKU without `overrideReason` returns `409 DISPATCH_OUT_OF_ORDER` naming the earlier `batchCode`, succeeds (`200 OK`) and audits when `overrideReason` is provided, allows cross-SKU dispatch without override, and treats equal `expiryDate` as a tie (not out of order). | Check 8 (Out-of-order refused naming earlier batch; override with reason succeeds and is audited; equal-expiry tie is not out of order) |
| `testConcurrentDispatchRaceRepeated100Times` | Asserts across 100 runs of 2 threads concurrently dispatching the same active batch, every run produces one `200 OK`, one `409 CONFLICT` (`100` successes, `100` conflicts), and 1 `dispatchHistory` entry. | Check 4 (Dispatch race: two threads, 100 runs) |
| `testDispatchRoleCheckFirstAndFieldValidation` | Asserts unauthorized roles (`factory-manager`, `quality-inspector`, `manager`) receive `403 RBAC_INSUFFICIENT` on dispatch even for a non-existent batch ID, `dispatch-coordinator` receives `403` on inspections, and invalid `buyerName`/`dispatchDate` return `422` with `fieldErrors`. | Check 11 & Check 12 (Role check before lookup; dispatch field validation) |

### `OpenApiExportTest` (1 test method)

| Test Method | One-Line Assertion Summary | Phase 4 Check Mapping |
|---|---|---|
| `exportOpenApiSpecs` | Exports `/api/v1/api-docs` to `docs/openapi.json` and `/api/v1/api-docs.yaml` to `backend/src/main/resources/openapi/tracex-api.yaml`, and asserts 1-to-1 parity between the 40 OpenAPI `/api/v1/**` operations and the 40 active `/api/v1/**` rows in `docs/permission-matrix.csv` (`phase <= 4`). | Check 14 & Check 15 (OpenAPI export and 1-to-1 `permission-matrix.csv` parity) |

---

## V2: Corrupted Data Tolerance (`missing`, `null`, and `"not-a-date"` `expiryDate`)

- **Result**: PASS
- **How tolerant reads work (documented in `SPEC.md` §3.1)**:
  - `AppConfig.LenientStringToInstantConverter` (`@ReadingConverter`) is registered in `MongoCustomConversions`. When MongoDB contains an unparseable string (such as `"not-a-date"`) for an `Instant` field, the converter logs a warning and returns `null` instead of throwing a deserialization exception (preventing HTTP 500 on `GET /api/v1/batches` and `GET /api/v1/batches/{id}`).
  - In `GET /api/v1/dispatch/fefo`, `FefoService.loadActiveNonDeletedBatches()` inspects the raw BSON `expiryDate` field and places any batch whose `expiryDate` is omitted (`"Missing expiryDate"`), `null` (`"Null expiryDate"`), or unparseable (`"Unparseable expiryDate: not-a-date"`) into `exceptions` with `status: "EXCEPTION"`, `daysUntilExpiry: 0`, `rank: null`, and `exceptionReason` populated — never in `queue` or `expired`.
  - In `GET /api/v1/batches` and `GET /api/v1/batches/{id}`, `BatchFreshness.calculateStatus` and `BatchService.enrichSummary` map any non-dispatched batch with `expiryDate == null` to `expiryDate: null`, `status: "EXCEPTION"`, `daysUntilExpiry: 0`, and `exceptionReason: "Missing, null, or unparseable expiryDate"`.
- **Command & real test output (`FefoServiceTest#testCorruptedExpiryDateDoesNotBreakFefoOrBatchReads`)**:

```powershell
.\mvnw.cmd test "-Dtest=FefoServiceTest#testCorruptedExpiryDateDoesNotBreakFefoOrBatchReads"
```

```text
V2 FEFO exceptions JSON: [{"id":"6ac267fe03470f17c0a5c093","batchCode":"TX-CORR-MISSING","productName":"Kashmiri Garlic Cloves","sku":"KMGC","sourceLotCode":"LOT-MISS","farmerName":"Farmer Miss","village":"Village M","quantityProduced":80,"unit":"Kg","yieldPercent":80.0,"packDate":"2026-09-29T14:51:42.752Z","expiryDate":null,"dataSource":null,"shelfLifeSource":null,"lifecycleState":"ACTIVE","status":"EXCEPTION","daysUntilExpiry":0,"priorityScore":0.0,"qualityCheck":null,"exceptionReason":"Missing expiryDate","createdBy":null,"createdAt":"2026-10-04T11:51:42.752Z","updatedAt":null,"deleted":false},{"id":"6ac267fe03470f17c0a5c094","batchCode":"TX-CORR-NULL","productName":"Kashmiri Garlic Cloves","sku":"KMGC","sourceLotCode":"LOT-NULL","farmerName":"Farmer Null","village":"Village N","quantityProduced":90,"unit":"Kg","yieldPercent":82.0,"packDate":"2026-09-29T14:51:42.752Z","expiryDate":null,"dataSource":null,"shelfLifeSource":null,"lifecycleState":"ACTIVE","status":"EXCEPTION","daysUntilExpiry":0,"priorityScore":0.0,"qualityCheck":null,"exceptionReason":"Null expiryDate","createdBy":null,"createdAt":"2026-10-04T12:51:42.752Z","updatedAt":null,"deleted":false},{"id":"6ac267fe03470f17c0a5c095","batchCode":"TX-CORR-NOTADATE","productName":"Kashmiri Garlic Cloves","sku":"KMGC","sourceLotCode":"LOT-STR","farmerName":"Farmer Str","village":"Village S","quantityProduced":95,"unit":"Kg","yieldPercent":84.0,"packDate":"2026-09-29T14:51:42.752Z","expiryDate":null,"dataSource":null,"shelfLifeSource":null,"lifecycleState":"ACTIVE","status":"EXCEPTION","daysUntilExpiry":0,"priorityScore":0.0,"qualityCheck":null,"exceptionReason":"Unparseable expiryDate: not-a-date","createdBy":null,"createdAt":"2026-10-04T13:51:42.752Z","updatedAt":null,"deleted":false}]
2026-10-04T20:21:42.785+05:30  WARN 21132 --- [           main] com.tracex.config.AppConfig              : Unparseable Instant string 'not-a-date' encountered during MongoDB read; returning null
V2 Batch List Corrupted Item: batchCode=TX-CORR-MISSING, status=EXCEPTION, expiryDate=null, daysUntilExpiry=0, exceptionReason=Missing, null, or unparseable expiryDate
V2 Batch List Corrupted Item: batchCode=TX-CORR-NULL, status=EXCEPTION, expiryDate=null, daysUntilExpiry=0, exceptionReason=Missing, null, or unparseable expiryDate
V2 Batch List Corrupted Item: batchCode=TX-CORR-NOTADATE, status=EXCEPTION, expiryDate=null, daysUntilExpiry=0, exceptionReason=Missing, null, or unparseable expiryDate
V2 Batch Detail HTTP 200: id=6ac267fe03470f17c0a5c093, batchCode=TX-CORR-MISSING, status=EXCEPTION, expiryDate=null, exceptionReason=Missing, null, or unparseable expiryDate
V2 Batch Detail HTTP 200: id=6ac267fe03470f17c0a5c094, batchCode=TX-CORR-NULL, status=EXCEPTION, expiryDate=null, exceptionReason=Missing, null, or unparseable expiryDate
2026-10-04T20:21:42.811+05:30  WARN 21132 --- [           main] com.tracex.config.AppConfig              : Unparseable Instant string 'not-a-date' encountered during MongoDB read; returning null
V2 Batch Detail HTTP 200: id=6ac267fe03470f17c0a5c095, batchCode=TX-CORR-NOTADATE, status=EXCEPTION, expiryDate=null, exceptionReason=Missing, null, or unparseable expiryDate
```

---

## V3: Single Authority (`FefoService` and `BatchFreshness`)

- **Result**: PASS
- `BatchService.dispatchBatch` (`backend/src/main/java/com/tracex/service/BatchService.java` line 267) delegates out-of-order evaluation directly to `fefoService.findEarlierEligibleBatchForSameSku(batch, clockToUse)`:

```java
// backend/src/main/java/com/tracex/service/BatchService.java lines 266-281
// 5. Out-of-order check per D-18 (per-SKU)
Optional<BatchSummaryDto> earlierBatchOpt = fefoService.findEarlierEligibleBatchForSameSku(batch, clockToUse);
boolean outOfOrder = earlierBatchOpt.isPresent();
String trimmedOverrideReason = (dto != null && dto.getOverrideReason() != null && !dto.getOverrideReason().trim().isEmpty())
        ? dto.getOverrideReason().trim()
        : null;

if (outOfOrder && trimmedOverrideReason == null) {
    String earlierCode = earlierBatchOpt.get().getBatchCode();
    throw new ApiException(
            ErrorCode.DISPATCH_OUT_OF_ORDER,
            "Batch " + batch.getBatchCode() + " is out of FEFO order for SKU " + batch.getSku()
                    + "; batch " + earlierCode + " expires earlier and must be dispatched first unless overrideReason is provided",
            HttpStatus.CONFLICT
    );
}
```

- **Search results across `src/main/java` proving FEFO eligibility/grouping/ordering exists only in `FefoService` and tier thresholds (`URGENT_THRESHOLD_DAYS`, `WARNING_THRESHOLD_DAYS`) only in `BatchFreshness`**:

```powershell
Get-ChildItem -Path "src\main\java" -Recurse -Filter "*.java" | Select-String -Pattern "findEarlierEligibleBatchForSameSku|getFefoQueue|fefoComparator|tierPriority|computeTier"
Get-ChildItem -Path "src\main\java" -Recurse -Filter "*.java" | Select-String -Pattern "URGENT_THRESHOLD_DAYS|WARNING_THRESHOLD_DAYS"
```

```text
=== V3.1: Search for findEarlierEligibleBatchForSameSku / getFefoQueue / fefoComparator / tierPriority / computeTier across src/main/java ===
src\main\java\com\tracex\controller\DispatchController.java:22: public ApiResponse<FefoService.FefoResult> getFefoQueue(
src\main\java\com\tracex\controller\DispatchController.java:25: return ApiResponse.ok(fefoService.getFefoQueue(category, sku), RequestIdContext.getOrCreate());
src\main\java\com\tracex\service\BatchService.java:267: Optional<BatchSummaryDto> earlierBatchOpt = fefoService.findEarlierEligibleBatchForSameSku(batch, clockToUse);
src\main\java\com\tracex\service\FefoService.java:74: public FefoResult getFefoQueue(String category, String sku) {
src\main\java\com\tracex\service\FefoService.java:75: return getFefoQueue(category, sku, this.clock);
src\main\java\com\tracex\service\FefoService.java:78: public FefoResult getFefoQueue(String category, String sku, Clock clockToUse) {
src\main\java\com\tracex\service\FefoService.java:132: queue.sort(fefoComparator());
src\main\java\com\tracex\service\FefoService.java:157: public Optional<BatchSummaryDto> findEarlierEligibleBatchForSameSku(Batch targetBatch, Clock clockToUse) {
src\main\java\com\tracex\service\FefoService.java:161: FefoResult skuFefo = getFefoQueue(null, targetBatch.getSku(), clockToUse);
src\main\java\com\tracex\service\FefoService.java:178: public Comparator<BatchSummaryDto> fefoComparator() {
src\main\java\com\tracex\service\FefoService.java:180: .comparingInt((BatchSummaryDto b) -> BatchFreshness.tierPriority(b.getStatus()))
src\main\java\com\tracex\util\BatchFreshness.java:17: public static String computeTier(long daysUntilExpiry) {
src\main\java\com\tracex\util\BatchFreshness.java:24: public static int tierPriority(String tier) {
src\main\java\com\tracex\util\BatchFreshness.java:46: return computeTier(days);

=== V3.2: Search for URGENT_THRESHOLD_DAYS / WARNING_THRESHOLD_DAYS across src/main/java ===
src\main\java\com\tracex\util\BatchFreshness.java:14: public static final int URGENT_THRESHOLD_DAYS = 7;
src\main\java\com\tracex\util\BatchFreshness.java:15: public static final int WARNING_THRESHOLD_DAYS = 30;
src\main\java\com\tracex\util\BatchFreshness.java:19: if (daysUntilExpiry <= URGENT_THRESHOLD_DAYS) return "URGENT";
src\main\java\com\tracex\util\BatchFreshness.java:20: if (daysUntilExpiry <= WARNING_THRESHOLD_DAYS) return "WARNING";
src\main\java\com\tracex\util\BatchFreshness.java:63: Instant max = now.plus(URGENT_THRESHOLD_DAYS, ChronoUnit.DAYS);
src\main\java\com\tracex\util\BatchFreshness.java:66: Instant min = now.plus(URGENT_THRESHOLD_DAYS, ChronoUnit.DAYS);
src\main\java\com\tracex\util\BatchFreshness.java:67: Instant max = now.plus(WARNING_THRESHOLD_DAYS, ChronoUnit.DAYS);
src\main\java\com\tracex\util\BatchFreshness.java:70: Instant min = now.plus(WARNING_THRESHOLD_DAYS, ChronoUnit.DAYS);
src\main\java\com\tracex\util\BatchFreshness.java:82: case "URGENT" -> Optional.of(now.plus(URGENT_THRESHOLD_DAYS, ChronoUnit.DAYS));
src\main\java\com\tracex\util\BatchFreshness.java:83: case "WARNING" -> Optional.of(now.plus(WARNING_THRESHOLD_DAYS, ChronoUnit.DAYS));
```

---

## V4: Atomic Conditional Dispatch and 100-Run Race Counts

- **Result**: PASS
- **Actual conditional update (filter and update) in `BatchService.dispatchBatch` (`backend/src/main/java/com/tracex/service/BatchService.java` lines 286–324)**:

```java
// Atomic conditional update: _id, isDeleted=false, lifecycleState=ACTIVE, and non-expired
Instant startOfTomorrow = BatchFreshness.startOfTomorrow(clockToUse);
Query atomicQuery = new Query(Criteria.where("_id").is(batch.getId())
        .and("isDeleted").is(false)
        .and("lifecycleState").is("ACTIVE")
        .and("expiryDate").gte(startOfTomorrow));

Batch.DispatchHistoryEntry historyEntry = new Batch.DispatchHistoryEntry(
        actorUsername,
        now,
        trimmedBuyerName,
        effectiveDispatchDate,
        outOfOrder ? trimmedOverrideReason : null,
        outOfOrder
);

Update update = new Update()
        .set("lifecycleState", "DISPATCHED")
        .set("buyerName", trimmedBuyerName)
        .set("dispatchDate", effectiveDispatchDate)
        .set("updatedAt", now)
        .push("dispatchHistory", historyEntry);

if (outOfOrder) {
    String earlierCode = earlierBatchOpt.get().getBatchCode();
    Batch.NoteHistoryEntry overrideNote = new Batch.NoteHistoryEntry(
            "[FEFO Override] Dispatched out of order ahead of " + earlierCode + ": " + trimmedOverrideReason,
            actorUsername,
            now
    );
    update.push("noteHistory", overrideNote);
}

Batch updated = mongoTemplate.findAndModify(
        atomicQuery,
        update,
        FindAndModifyOptions.options().returnNew(true),
        Batch.class
);
```

- **100-iteration 2-thread race test output (`InspectionAndDispatchTests#testConcurrentDispatchRaceRepeated100Times`)**:

```powershell
.\mvnw.cmd test "-Dtest=InspectionAndDispatchTests#testConcurrentDispatchRaceRepeated100Times"
```

```text
V4 Race Summary: runs=100, success200=100, conflict409=100
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0 -- in com.tracex.InspectionAndDispatchTests
```

---

## V5: Inspections Partial Unique Index and 10-Thread Snapshot Convergence

- **Result**: PASS
- **Index list and 10-thread parallel inspection output from `InspectionAndDispatchTests`**:

```powershell
.\mvnw.cmd test "-Dtest=InspectionAndDispatchTests#testTenConcurrentInspectionsSingleIsLatest+testInspectionsIndexesNoTtlAndPartialUniqueIndexPresent"
```

```text
V5 10-Thread Parallel Inspection Result: totalSaved=10, isLatestCount=1, newestInspection={id=6ac2680603470f17c0a5c13e, status=PASSED, rating=3, createdAt=2026-10-04T14:51:50.933Z}, batchQualityCheck={status=PASSED, rating=3, inspectedAt=2026-10-04T14:51:50.933Z, inspectorName=insp1_p4 FullName}
V5 Inspection Index: {"v": 2, "key": {"_id": 1}, "name": "_id_"}
V5 Inspection Index: {"v": 2, "key": {"batchId": 1}, "name": "batchId"}
V5 Inspection Index: {"v": 2, "key": {"batchCode": 1}, "name": "batchCode"}
V5 Inspection Index: {"v": 2, "key": {"batchId": 1}, "name": "batchId_isLatest_unique_idx", "unique": true, "partialFilterExpression": {"isLatest": true}}
V5 Inspection Index: {"v": 2, "key": {"batchId": 1, "createdAt": -1}, "name": "batchId_createdAt_desc_idx"}
V5 Inspection Index: {"v": 2, "key": {"inspectedBy.userId": 1, "createdAt": -1}, "name": "inspectedBy_userId_createdAt_desc_idx"}
V5 Inspection Index: {"v": 2, "key": {"status": 1, "isLatest": 1, "createdAt": -1}, "name": "status_isLatest_createdAt_desc_idx"}
```

---

## V6: SPEC §6.2 Error Codes, Changelog Sync, and OpenAPI Operation List

- **Result**: PASS
- **`SPEC.md` §6.2 lines for `DISPATCH_OUT_OF_ORDER`, `BATCH_EXPIRED`, and `QUALITY_HOLD`**:

```powershell
Select-String -Path "..\SPEC.md" -Pattern "DISPATCH_OUT_OF_ORDER|BATCH_EXPIRED|QUALITY_HOLD"
```

```text
SPEC.md:526: | `DISPATCH_OUT_OF_ORDER` | 409 | Batch is not next in FEFO queue; override required |
SPEC.md:528: | `BATCH_EXPIRED` | 409 | Batch is expired (`daysUntilExpiry <= 0`) and cannot be dispatched |
SPEC.md:529: | `QUALITY_HOLD` | 409 | Batch latest inspection verdict is `FAILED`; dispatch blocked (D-19) |
```

- **`PROGRESS.md` changelog**: Verified that `DISPATCH_OUT_OF_ORDER`, `BATCH_EXPIRED`, and `QUALITY_HOLD` are all explicitly named under `### Phase 4 Carry-Over Fixes & Spec Refinements` in `PROGRESS.md`.
- **OpenAPI operation list for dispatch, FEFO, and inspections (`docs/openapi.json` and `backend/src/main/resources/openapi/tracex-api.yaml`)**:

```powershell
$json = Get-Content "..\docs\openapi.json" -Raw | ConvertFrom-Json
foreach ($prop in $json.paths.PSObject.Properties) {
    $path = $prop.Name
    if ($path -match "dispatch|fefo|inspections") {
        foreach ($methodProp in $prop.Value.PSObject.Properties) {
            $m = $methodProp.Name.ToUpper()
            $opId = $methodProp.Value.operationId
            Write-Host "$m $path (operationId: $opId)"
        }
    }
}
```

```text
GET /api/v1/inspections (operationId: listInspections)
POST /api/v1/inspections (operationId: createInspection)
PATCH /api/v1/batches/{id}/dispatch (operationId: dispatchBatch)
GET /api/v1/inspections/{id} (operationId: getById)
GET /api/v1/inspections/my (operationId: listMyInspections)
GET /api/v1/inspections/batch/{batchId} (operationId: listByBatch)
GET /api/v1/dispatch/fefo (operationId: getFefoQueue)
```

---

## V7: Decisions Table `Outcome` Column and Table Linter

- **Result**: PASS
- Added the `Outcome` column to the `Decisions` table (`D-1` through `D-19`) in `PROGRESS.md` using wording from `SPEC.md`, and ran `scripts/lint-md-tables.ps1`.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\lint-md-tables.ps1
```

```text
=== Markdown Table Linter ===
Scanning 23 Markdown files...


=== Summary ===
Files checked: 23
Errors: 0
Warnings: 0
STATUS: PASSED (Zero problems found)
```

---

## V8: Full `.\mvnw.cmd clean verify` and Live Dev-Server Trace

- **Result**: PASS

### 1. Full `.\mvnw.cmd clean verify` with Test Counts per Class

```powershell
.\mvnw.cmd clean verify
```

```text
[INFO] Running com.tracex.AccessRequestAndUserFlowTests
[INFO] Tests run: 8, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 12.20 s -- in com.tracex.AccessRequestAndUserFlowTests
[INFO] Running com.tracex.AdminVsAdminRulesTest
[INFO] Tests run: 11, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 6.606 s -- in com.tracex.AdminVsAdminRulesTest
[INFO] Running com.tracex.AuthLoginTests
[INFO] Tests run: 10, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 4.319 s -- in com.tracex.AuthLoginTests
[INFO] Running com.tracex.BatchIndexTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.944 s -- in com.tracex.BatchIndexTest
[INFO] Running com.tracex.ConfigurationAndSeedTests
[INFO] Tests run: 12, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.935 s -- in com.tracex.ConfigurationAndSeedTests
[INFO] Running com.tracex.ErrorCodeSpecSyncTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.025 s -- in com.tracex.ErrorCodeSpecSyncTest
[INFO] Running com.tracex.FefoServiceTest
[INFO] Tests run: 11, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 2.886 s -- in com.tracex.FefoServiceTest
[INFO] Running com.tracex.ForwardedHeadersEmpiricalTest
[INFO] Running com.tracex.ForwardedHeadersEmpiricalTest$NativeStrategyUntrustedDirectTests
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.635 s -- in com.tracex.ForwardedHeadersEmpiricalTest$NativeStrategyUntrustedDirectTests
[INFO] Running com.tracex.ForwardedHeadersEmpiricalTest$NativeStrategyTrustedProxyTests
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.984 s -- in com.tracex.ForwardedHeadersEmpiricalTest$NativeStrategyTrustedProxyTests
[INFO] Running com.tracex.ForwardedHeadersEmpiricalTest$FrameworkStrategyTests
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.946 s -- in com.tracex.ForwardedHeadersEmpiricalTest$FrameworkStrategyTests
[INFO] Tests run: 0, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 3.568 s -- in com.tracex.ForwardedHeadersEmpiricalTest
[INFO] Running com.tracex.GlobalSafetyGuardAutoDetectionTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.008 s -- in com.tracex.GlobalSafetyGuardAutoDetectionTest
[INFO] Running com.tracex.InspectionAndDispatchTests
[INFO] Tests run: 12, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 7.527 s -- in com.tracex.InspectionAndDispatchTests
[INFO] Running com.tracex.OpenApiExportTest
Exported openapi.json length: 29856, operations: 40
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.898 s -- in com.tracex.OpenApiExportTest
[INFO] Running com.tracex.ProductAndBatchTests
[INFO] Tests run: 33, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.215 s -- in com.tracex.ProductAndBatchTests
[INFO] Running com.tracex.RbacMatrixTest
[INFO] Tests run: 287, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.686 s -- in com.tracex.RbacMatrixTest
[INFO] Running com.tracex.RouteCoverageTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.012 s -- in com.tracex.RouteCoverageTest
[INFO] Running com.tracex.SmtpEmailServiceTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.009 s -- in com.tracex.SmtpEmailServiceTest
[INFO] Running com.tracex.TokenAndSessionTests
[INFO] Tests run: 8, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.702 s -- in com.tracex.TokenAndSessionTests
[INFO] 
[INFO] Results:
[INFO] 
[INFO] Tests run: 401, Failures: 0, Errors: 0, Skipped: 0
[INFO] 
[INFO] --- jar:3.3.0:jar (default-jar) @ tracex-backend ---
[INFO] Building jar: C:\Users\yashm\OneDrive\Desktop\TraceX\backend\target\tracex-backend-1.0.0-SNAPSHOT.jar
[INFO] 
[INFO] --- spring-boot:3.2.5:repackage (repackage) @ tracex-backend ---
[INFO] Replacing main artifact C:\Users\yashm\OneDrive\Desktop\TraceX\backend\target\tracex-backend-1.0.0-SNAPSHOT.jar with repackaged archive, adding nested dependencies in BOOT-INF/.
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  53.796 s
[INFO] Finished at: 2026-10-04T20:22:02+05:30
[INFO] ------------------------------------------------------------------------
```

### 2. Live Dev-Server Trace (`tracex_fresh_dev` on Port 8081)

```powershell
$proc = Start-Process -FilePath "C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot\bin\java.exe" `
    -ArgumentList "-jar","target/tracex-backend-1.0.0-SNAPSHOT.jar","--spring.profiles.active=dev" `
    -WorkingDirectory "C:\Users\yashm\OneDrive\Desktop\TraceX\backend" -PassThru -NoNewWindow
```

```text
=== 0. Auth Logins ===
coordinator login: HTTP 200 (role=dispatch-coordinator)
inspector login:   HTTP 200 (role=quality-inspector)

=== 1. GET /api/v1/dispatch/fefo ===
HTTP 200 | queue.count=13, expired.count=1, exceptions.count=0
[{"rank":1,"id":"6ac1c437b820d073691b4ea0","batchCode":"TX-2000-01-002","sku":"KMGC","status":"URGENT","daysUntilExpiry":1,"priorityScore":414.0},{"rank":2,"id":"6ac1c437b820d073691b4ea1","batchCode":"TX-2000-01-003","sku":"ABHJAM","status":"URGENT","daysUntilExpiry":7,"priorityScore":408.0},{"rank":3,"id":"6ac1c437b820d073691b4ea2","batchCode":"TX-2000-01-004","sku":"WBDRP","status":"WARNING","daysUntilExpiry":8,"priorityScore":357.0},{"rank":4,"id":"6ac2695bcf84463f5503e7cb","batchCode":"TX-2026-10-003","sku":"KMGC","status":"WARNING","daysUntilExpiry":10,"priorityScore":405.0}]

=== 2. PATCH /api/v1/batches/6ac1c437b820d073691b4ea0/dispatch (Head Batch TX-2000-01-002 as dispatch-coordinator) ===
HTTP 200 | {"success":true,"requestId":"094fdc7c-ee1d-4754-8c1d-3ae2dd349fd5","data":{"id":"6ac1c437b820d073691b4ea0","batchCode":"TX-2000-01-002","productName":"Kumaon Royal Multigrain Crackers","sku":"KMGC","sourceLotCode":"DEMO-LOT-002","farmerName":"Demo Farmer","village":"Demo Village","quantityProduced":150,"unit":"Kg","yieldPercent":82.0,"packDate":"2026-07-07T14:57:29.878Z","expiryDate":"2026-10-05T14:57:29.878Z","dataSource":"predicted","shelfLifeSource":"predicted","lifecycleState":"DISPATCHED","status":"DISPATCHED","daysUntilExpiry":1,"priorityScore":414.0,"qualityCheck":{"status":"PASSED","rating":5,"inspectedAt":"2026-10-04T05:48:26.479Z","inspectorName":"[DEMO] Quality Inspector"},"createdBy":"[DEMO] Seed","createdAt":"2026-10-04T03:12:55.531Z","updatedAt":"2026-10-04T14:57:32.026Z","traceabilityNote":"Demo batch - DEMO-LOT-002","noteHistory":[],"dispatchHistory":[{"dispatchedBy":"coordinator","dispatchedAt":"2026-10-04T14:57:32.026Z","buyerName":"Himalayan Organic Retailers","dispatchDate":"2026-10-04T14:57:32.026Z","overrideReason":null,"outOfOrder":false}],"deletedAt":null,"deletedBy":null,"deleteNote":null,"dispatchDate":"2026-10-04T14:57:32.026Z","buyerName":"Himalayan Organic Retailers","deleted":false}}

=== 3. PATCH /api/v1/batches/6ac2695bcf84463f5503e7cd/dispatch (Out-of-Order TX-2026-10-004 without overrideReason -> 409) ===
HTTP 409 | {"success":false,"requestId":"5674c0df-6ad0-4daa-8dd7-c9fb419b266e","code":"DISPATCH_OUT_OF_ORDER","error":"Batch TX-2026-10-004 is out of FEFO order for SKU KMGC; batch TX-2026-10-003 expires earlier and must be dispatched first unless overrideReason is provided"}

=== 4. PATCH /api/v1/batches/6ac2695bcf84463f5503e7cd/dispatch (Out-of-Order TX-2026-10-004 WITH overrideReason -> 200) ===
HTTP 200 | {"success":true,"requestId":"967d74d3-aec8-4918-9bf1-368413412db5","data":{"id":"6ac2695bcf84463f5503e7cd","batchCode":"TX-2026-10-004","productName":"Kumaon Royal Multigrain Crackers","sku":"KMGC","sourceLotCode":"LOT-V8-LATE","farmerName":"Suresh Negi","village":"Ranikhet","quantityProduced":140,"unit":"Kg","yieldPercent":90.0,"packDate":"2026-10-03T14:57:31Z","expiryDate":"2026-11-13T14:57:31Z","dataSource":"fallback","shelfLifeSource":"manual","lifecycleState":"DISPATCHED","status":"DISPATCHED","daysUntilExpiry":40,"priorityScore":375.0,"qualityCheck":null,"createdBy":"factory_mgr","createdAt":"2026-10-04T14:57:31.937Z","updatedAt":"2026-10-04T14:57:32.111Z","traceabilityNote":"Best before 2026-11-13T14:57:31Z","noteHistory":[{"note":"[FEFO Override] Dispatched out of order ahead of TX-2026-10-003: Export sea-freight contract requires minimum 30 days remaining shelf life","editedBy":"coordinator","editedAt":"2026-10-04T14:57:32.111Z"}],"dispatchHistory":[{"dispatchedBy":"coordinator","dispatchedAt":"2026-10-04T14:57:32.111Z","buyerName":"Export Buyer GmbH","dispatchDate":"2026-10-04T14:57:32.111Z","overrideReason":"Export sea-freight contract requires minimum 30 days remaining shelf life","outOfOrder":true}],"deletedAt":null,"deletedBy":null,"deleteNote":null,"dispatchDate":"2026-10-04T14:57:32.111Z","buyerName":"Export Buyer GmbH","deleted":false}}

=== 5a. POST /api/v1/inspections (FAILED verdict on TX-2026-10-003) ===
HTTP 201 | {"success":true,"requestId":"fe2be4f8-9a52-4e9e-84f8-2872dc01b2c9","data":{"id":"6ac2695ccf84463f5503e7d1","batchId":"6ac2695bcf84463f5503e7cb","batchCode":"TX-2026-10-003","productName":"Kumaon Royal Multigrain Crackers","sku":"KMGC","status":"FAILED","rating":1,"checklist":[{"label":"Packaging integrity","passed":false,"note":"Seal punctured on crate 2"},{"label":"Label accuracy & legibility","passed":true,"note":"OK"},{"label":"Expiry date visible & correct","passed":null,"note":""},{"label":"Weight / quantity correct","passed":null,"note":""},{"label":"No visible contamination","passed":null,"note":""},{"label":"Colour & texture acceptable","passed":null,"note":""},{"label":"Odour within acceptable range","passed":null,"note":""},{"label":"Storage conditions met","passed":null,"note":""}],"findings":"Seal puncture detected during pre-dispatch check","recommendation":"Quarantine batch and re-pack","inspectedBy":{"userId":"6abf4a44186d506b7f4240be","name":"[DEMO] Quality Inspector","username":"inspector"},"createdAt":"2026-10-04T14:57:32.158866300Z","isLatest":true},"message":"Inspection submitted"}

=== 5b. PATCH /api/v1/batches/6ac2695bcf84463f5503e7cb/dispatch (Attempt dispatch on FAILED batch TX-2026-10-003 -> 409 QUALITY_HOLD) ===
HTTP 409 | {"success":false,"requestId":"541e7364-c3dc-480e-8b4d-9993b50b994d","code":"QUALITY_HOLD","error":"Batch cannot be dispatched: latest inspection verdict is FAILED"}

=== Dev server (PID 17468) stopped ===
```
