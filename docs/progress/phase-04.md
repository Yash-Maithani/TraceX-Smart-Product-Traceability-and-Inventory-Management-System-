# Phase 4 Checks Log — FEFO Service, Quality Inspections, and Dispatch

> Executed: 2026-10-04
> Environment: Windows 11, Java 21 (Eclipse Temurin 21.0.12.1+1-LTS), Spring Boot 3.2.5, MongoDB 4.11.2 driver against `tracex_fresh_test` (integration tests) and `tracex_fresh_dev` (live dev trace).

---

## Summary of Phase 4 Checks

| Check | Description | Result |
|---|---|---|
| 1 | Single FEFO implementation (`FefoService` only) | PASS |
| 2 | `priorityScore` audit citations and display-only ordering test | PASS |
| 3 | Three FEFO groups (`queue`, `expired`, `exceptions`) | PASS |
| 4 | Atomic conditional dispatch (`findAndModify`) and 100-iteration race test | PASS |
| 5 | Expired-batch block (`daysUntilExpiry == 0` and `-1` -> `409 BATCH_EXPIRED`) | PASS |
| 6 | Inspection 8 checklist labels, field limits citations, and `422` validation tests | PASS |
| 7 | Quality hold (D-19) citation and `FAILED` -> `409 QUALITY_HOLD` / `PASSED` -> `200` test | PASS |
| 8 | Out-of-order per SKU (D-18), override, cross-SKU independence, and tie rule | PASS |
| 9 | Single `isLatest = true` partial unique index and 10-thread concurrency test | PASS |
| 10 | No TTL on `inspections` (`listIndexes()` has no `expireAfterSeconds`) | PASS |
| 11 | RBAC matrix (`phase <= 4`, 41 rows x 7 columns = 287 assertions) | PASS |
| 12 | Role check before resource lookup (`403 RBAC_INSUFFICIENT` on non-existent id) | PASS |
| 13 | Live trace against `tracex_fresh_dev` and seed idempotency verification | PASS |
| 14 | OpenAPI export (`tracex-api.yaml` and `openapi.json`) and `ErrorCodeSpecSyncTest` | PASS |
| 15 | OpenAPI vs `permission-matrix.csv` parity (Phase 3.2 gap explained and fixed) | PASS |
| 16 | `SPEC.md` §6.3 before/after table fix and §2 precedence rule + test | PASS |
| 17 | Full `.\mvnw.cmd clean verify` suite (`397` tests, `0` failures) | PASS |

---

## Check 1: Single FEFO Implementation (`FefoService`)

- **Result**: PASS
- `FefoService` (`backend/src/main/java/com/tracex/service/FefoService.java`) is the sole class that computes FEFO eligibility, 3-group classification (`queue`, `expired`, `exceptions`), queue ordering (`tier` -> `daysUntilExpiry` asc -> `expiryDate` asc -> `createdAt` asc -> `batchCode` asc), 1-based `rank`, per-SKU out-of-order detection (`findEarlierEligibleBatchForSameSku`), and `computePriorityScore`.
- `DispatchController` delegates `GET /api/v1/dispatch/fefo` directly to `fefoService.getFefoQueue(category, sku)`.
- `BatchService.dispatchBatch` delegates out-of-order detection directly to `fefoService.findEarlierEligibleBatchForSameSku(batch, clockToUse)`.

```java
// backend/src/main/java/com/tracex/service/FefoService.java
public FefoResult getFefoQueue(String category, String sku, Clock clockToUse) {
    // Applies category and sku filters before grouping and ordering (D-18).
    // Classifies active non-deleted batches into queue (daysUntilExpiry > 0),
    // expired (daysUntilExpiry <= 0), and exceptions (null or unparseable expiryDate).
    // Sorts queue by fefoComparator() and assigns 1-based rank.
}

public Optional<BatchSummaryDto> findEarlierEligibleBatchForSameSku(Batch targetBatch, Clock clockToUse) {
    if (targetBatch.getSku() == null || targetBatch.getExpiryDate() == null) {
        return Optional.empty();
    }
    FefoResult skuFefo = getFefoQueue(null, targetBatch.getSku(), clockToUse);
    Instant targetExpiry = targetBatch.getExpiryDate().truncatedTo(ChronoUnit.MILLIS);

    for (BatchSummaryDto candidate : skuFefo.getQueue()) {
        if (candidate.getId() != null && candidate.getId().equals(targetBatch.getId())) {
            continue;
        }
        if (candidate.getExpiryDate() != null) {
            Instant candidateExpiry = candidate.getExpiryDate().truncatedTo(ChronoUnit.MILLIS);
            if (candidateExpiry.isBefore(targetExpiry)) {
                return Optional.of(candidate);
            }
        }
    }
    return Optional.empty();
}

public Comparator<BatchSummaryDto> fefoComparator() {
    return Comparator
            .comparingInt((BatchSummaryDto b) -> BatchFreshness.tierPriority(b.getStatus()))
            .thenComparingLong(BatchSummaryDto::getDaysUntilExpiry)
            .thenComparing(BatchSummaryDto::getExpiryDate, Comparator.nullsLast(Comparator.naturalOrder()))
            .thenComparing(BatchSummaryDto::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder()))
            .thenComparing(BatchSummaryDto::getBatchCode, Comparator.nullsLast(Comparator.naturalOrder()));
}
```

---

## Check 2: `priorityScore` Audit Citations and Display-Only Test

- **Result**: PASS
- **Reference UI citations**:
  - `frontend/src/pages/Dashboard.jsx` line 1006: renders `{b.priorityScore?.toFixed(1)}` in the FEFO queue table row.
  - `frontend/src/components/BatchDetailDrawer.jsx` line 328: renders `<DetailRow label="Priority Score" value={batch.priorityScore} />`.
- **Reference formula citation**:
  - `backend/src/services/expiryCalculator.js` lines 29–33: `Math.max(0, 365 - daysUntilExpiry) + riskBonus`, where `riskBonus` is `HIGH: 100`, `MEDIUM: 50`, `LOW: 0`.
- **Test proof (`FefoServiceTest.testPriorityScoreComputedAndDoesNotAffectQueueOrder`)**:
  - `TX-URG-LOW-SCORE` (`LOW` risk, expiring in 6 days, `URGENT`, `priorityScore = 359.0`) is ranked `#1` ahead of `TX-READY-HIGH-SCORE` (`HIGH` risk, expiring in 40 days, `READY`, `priorityScore = 425.0`), proving `priorityScore` never alters FEFO queue order.

```text
[INFO] Running com.tracex.FefoServiceTest
[INFO] Tests run: 7, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.717 s -- in com.tracex.FefoServiceTest
```

---

## Check 3: Three FEFO Groups (`queue`, `expired`, `exceptions`)

- **Result**: PASS
- `FefoServiceTest.testThreeGroupsClassification`, `testExcludedStatesNotInAnyGroup`, `testOrderingAndOneBasedRank`, `testBoundaryDaysWithFixedClock`, `testAdvancingClockMovesBatchWithZeroDbWrites`, and `testCategoryAndSkuFiltersAppliedBeforeOrderingAndRank` verify:
  - Active batches with `daysUntilExpiry > 0` go into `queue` with 1-based `rank`.
  - Active batches with `daysUntilExpiry <= 0` go into `expired` (`rank == null`).
  - Active batches with `null` or unparseable raw `expiryDate` (`"NOT-A-VALID-ISO-DATE"`) go into `exceptions` (`status = "EXCEPTION"`, `rank == null`) without deserialization failure.
  - `DISPATCHED` and archived (`isDeleted = true`) batches are excluded from all three groups.
  - Boundary days `<= 0` (`expired`), `1` (`URGENT`), `7` (`URGENT`), `8` (`WARNING`), `30` (`WARNING`), and `31` (`READY`) classify accurately under a fixed `Clock`, and advancing the `Clock` moves batches across tiers into `expired` with zero database writes.

```text
[INFO] Running com.tracex.FefoServiceTest
  1. Three groups: future expiry -> queue, daysUntilExpiry <= 0 -> expired, null or unparseable expiryDate -> exceptions: PASS
  2. Excluded states: DISPATCHED and archived (isDeleted = true) batches appear in none of the three groups: PASS
  3. Ordering & 1-based rank: tier (URGENT -> WARNING -> READY), daysUntilExpiry asc, createdAt asc, batchCode asc: PASS
  4. Boundary days with fixed Clock: <= 0 (expired), 1 (URGENT), 7 (URGENT), 8 (WARNING), 30 (WARNING), 31 (READY): PASS
  5. Advancing the clock moves a batch across READY -> WARNING -> URGENT -> expired with zero DB writes: PASS
  6. category and sku filters apply before ordering and 1-based rank: PASS
  7. priorityScore is computed and returned, and never changes FEFO queue order: PASS
[INFO] Tests run: 7, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.717 s -- in com.tracex.FefoServiceTest
```

---

## Check 4: Atomic Conditional Dispatch and 100-Iteration Race Test

- **Result**: PASS
- `BatchService.dispatchBatch` performs an atomic conditional `mongoTemplate.findAndModify` matching `_id`, `isDeleted: false`, `lifecycleState: "ACTIVE"`, and `expiryDate >= startOfTomorrow`.

```java
// backend/src/main/java/com/tracex/service/BatchService.java lines 287-324
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

- **100-iteration 2-thread race test (`InspectionAndDispatchTests.testConcurrentDispatchRaceRepeated100Times`)**:
  - Across all 100 iterations, two threads concurrently dispatching the same active batch resulted in exactly one `200 OK`, one `409 CONFLICT`, and a single `dispatchHistory` entry on the batch.

```text
[INFO] Running com.tracex.InspectionAndDispatchTests
  Check 4: Race test - 2-thread concurrent dispatch on the same batch repeated 100 times: every iteration produces one 200, one 409 CONFLICT, and 1 dispatchHistory entry: PASS (100/100 iterations)
```

---

## Check 5: Expired-Batch Block (`daysUntilExpiry == 0` and `-1`)

- **Result**: PASS
- `InspectionAndDispatchTests.testDispatchExpiredTodayAndYesterdayReturnsBatchExpired` verifies that dispatching a batch expiring today (`daysUntilExpiry == 0`) and a batch expiring yesterday (`daysUntilExpiry == -1`) both return `409 BATCH_EXPIRED`, and neither appears in the FEFO `queue` (both appear in `expired`).

```text
[INFO] Running com.tracex.InspectionAndDispatchTests
  Check 5: Dispatching batch expiring today (daysUntilExpiry == 0) and yesterday (daysUntilExpiry == -1) both return 409 BATCH_EXPIRED and appear in expired, never queue: PASS
```

---

## Check 6: Inspection Checklist Labels, Field Limits Citations, and Validation Tests

- **Result**: PASS
- **Reference citations**:
  - `backend/src/models/Inspection.model.js` lines 17–26: defines the 8 fixed checklist labels (`"Packaging integrity"`, `"Label accuracy & legibility"`, `"Expiry date visible & correct"`, `"Weight / quantity correct"`, `"No visible contamination"`, `"Colour & texture acceptable"`, `"Odour within acceptable range"`, `"Storage conditions met"`).
  - `backend/src/models/Inspection.model.js` lines 27–32: checklist item `passed` (`Boolean`, default `null`) and `note` (`maxlength: 200`).
  - `backend/src/models/Inspection.model.js` lines 43–65: `status` enum (`PASSED`, `FAILED`, `FLAGGED`), `rating` (`min: 1, max: 5`), `findings` (`maxlength: 1000`), `recommendation` (`maxlength: 400`).
  - `backend/src/controllers/inspection.controller.js` lines 39–42: batch eligibility (`!batch || batch.isDeleted` -> `404`; `batch.status === 'DISPATCHED'` -> `409`).
- **Test output (`InspectionAndDispatchTests.testInspectionValidationsAndClientIsLatestIgnored`)**:
  - `PASSED` with any checklist item `passed = false` -> `422 VALIDATION_ERROR` with `fieldErrors` on `status` (D-13).
  - `PASSED` with `passed = null` -> `201 Created`, and client-supplied `"isLatest": false` is ignored (`data.isLatest == true`).
  - Rating `0` and `6`, unknown checklist label, note > 200 chars, findings > 1000 chars, and recommendation > 400 chars -> `422 VALIDATION_ERROR` with `fieldErrors`.

```text
[INFO] Running com.tracex.InspectionAndDispatchTests
  Inspection 5, 6, 7: D-13 PASSED validation, field bounds validation, and ignoring client-supplied isLatest=false: PASS
  Inspection 8 & 9: Inspecting unknown/archived batch -> 404, DISPATCHED batch -> 409 CONFLICT; PUT/PATCH/DELETE -> 405 METHOD_NOT_ALLOWED: PASS
```

---

## Check 7: Quality Hold (D-19) Citation and Test Output

- **Result**: PASS
- **Reference citation**:
  - `backend/src/controllers/batches.controller.js` lines 123–154 (`recordDispatch`) checks only batch existence, `isDeleted`, and `status === 'DISPATCHED'`, and does **not** check `qualityCheck.status` or block dispatch on a `FAILED` inspection.
  - Per D-19 fallback rule recorded in `SPEC.md` §3.6: a batch whose latest inspection verdict is `FAILED` cannot be dispatched and returns `409 QUALITY_HOLD` until a newer inspection with `PASSED` or `FLAGGED` is recorded; `FLAGGED` is allowed to dispatch and returns a warning message.
- **Test output (`InspectionAndDispatchTests.testQualityHoldFailedBlocksAndPassedUnblocksAndFlaggedWarns`)**:
  - `FAILED` inspection blocks dispatch with `409 QUALITY_HOLD`; recording a new `PASSED` inspection on the same batch unblocks dispatch (`200 OK`); `FLAGGED` dispatches (`200 OK`) with warning `"Warning: batch dispatched with FLAGGED quality inspection verdict"`.

```text
[INFO] Running com.tracex.InspectionAndDispatchTests
  Check 7: Quality hold (D-19) - FAILED inspection blocks dispatch with 409 QUALITY_HOLD; new PASSED inspection unblocks dispatch (200); FLAGGED dispatches with warning: PASS
```

---

## Check 8: Out-of-Order per SKU (D-18) and Tie Rule

- **Result**: PASS
- `InspectionAndDispatchTests.testOutOfOrderPerSkuOverrideAndTieRule` verifies:
  - Same-SKU later-expiring batch without `overrideReason` (or blank `overrideReason`) -> `409 DISPATCH_OUT_OF_ORDER` naming the earlier `batchCode` (`TX-KMGC-EARLY`).
  - Same-SKU later-expiring batch with `overrideReason` -> `200 OK`, sets `outOfOrder = true` and `overrideReason` in `dispatchHistory`, appends `[FEFO Override]` entry to `noteHistory`, and records `outOfOrder = true` and `reason` in the `BATCH_DISPATCHED` audit log.
  - Cross-SKU independence: `RHSLT` batch dispatches without `overrideReason` (`200 OK`) even when `KMGC` has an earlier-expiring batch.
  - Tie rule: two active batches of `RHSLT` with identical `expiryDate` dispatch in either order without `overrideReason` (`200 OK`, `outOfOrder = false`).

```text
[INFO] Running com.tracex.InspectionAndDispatchTests
  Check 8: Out-of-order (D-18) per-SKU, overrideReason behavior, cross-SKU independence, and identical expiryDate tie rule: PASS
```

---

## Check 9: Single `isLatest = true` Partial Unique Index and 10-Thread Concurrency Test

- **Result**: PASS
- `InspectionService.ensureIndexes()` creates the partial unique index `batchId_isLatest_unique_idx` on `{ batchId: 1 }` with `unique: true` and `partialFilterExpression: { isLatest: true }`.

```java
// backend/src/main/java/com/tracex/service/InspectionService.java lines 88-94
collection.createIndex(
        Indexes.ascending("batchId"),
        new IndexOptions()
                .name("batchId_isLatest_unique_idx")
                .unique(true)
                .partialFilterExpression(new Document("isLatest", true))
);
```

- **10-thread concurrency test (`InspectionAndDispatchTests.testTenConcurrentInspectionsSingleIsLatest`)**:
  - 10 parallel threads submitting inspections on the same batch simultaneously leave all 10 inspections saved in MongoDB, exactly 1 record with `isLatest = true` (the newest), 9 records with `isLatest = false`, and `Batch.qualityCheck` matching the newest inspection.

```text
[INFO] Running com.tracex.InspectionAndDispatchTests
  Check 9: Concurrency - 10 parallel inspections on one batch leave all 10 saved, exactly one isLatest=true, and Batch.qualityCheck matching newest: PASS
```

---

## Check 10: No TTL on `inspections`

- **Result**: PASS
- `InspectionAndDispatchTests.testInspectionsIndexesNoTtlAndPartialUniqueIndexPresent` inspects `mongoTemplate.getCollection("inspections").listIndexes()` and verifies that no index has `expireAfterSeconds` (no TTL per D-15 / OI-07) and that the partial unique index on `{ batchId: 1 }` where `{ isLatest: true }` is present.

```json
[
  { "v": 2, "key": { "_id": 1 }, "name": "_id_" },
  {
    "v": 2,
    "key": { "batchId": 1 },
    "name": "batchId_isLatest_unique_idx",
    "unique": true,
    "partialFilterExpression": { "isLatest": true }
  },
  { "v": 2, "key": { "batchId": 1, "createdAt": -1 }, "name": "batchId_createdAt_desc_idx" },
  { "v": 2, "key": { "inspectedBy.userId": 1, "createdAt": -1 }, "name": "inspector_createdAt_desc_idx" },
  { "v": 2, "key": { "isLatest": 1, "status": 1, "createdAt": -1 }, "name": "isLatest_status_createdAt_desc_idx" }
]
```

---

## Check 11: RBAC Matrix (`phase <= 4`)

- **Result**: PASS
- `RbacMatrixTest` and `RouteCoverageTest` were updated to `phase <= 4`, covering all **41 active rows** across **7 role/anonymous columns** (`super-admin`, `admin`, `manager`, `factory-manager`, `quality-inspector`, `dispatch-coordinator`, `anonymous`) = **287 dynamic test assertions**, all passing.

```text
[INFO] Running com.tracex.RbacMatrixTest
2026-10-04T11:22:52.157+05:30  INFO 16144 --- [           main] com.tracex.RbacMatrixTest                : Generated 287 dynamic tests for 41 active phase rows
[INFO] Tests run: 287, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.721 s -- in com.tracex.RbacMatrixTest
[INFO] Running com.tracex.RouteCoverageTest
2026-10-04T11:22:53.399+05:30  INFO 16144 --- [           main] com.tracex.RouteCoverageTest             : Two-way route coverage confirmed for Phase <= 4 (41 active endpoints). 20 endpoints pending for later phases.
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.010 s -- in com.tracex.RouteCoverageTest
```

---

## Check 12: Role Check Before Resource Lookup

- **Result**: PASS
- `BatchController.dispatchBatch` and `InspectionController` evaluate role permissions before any service or repository lookup.
- `InspectionAndDispatchTests.testDispatchRoleCheckFirstAndFieldValidation` proves that `factory-manager`, `quality-inspector`, and `manager` calling `PATCH /api/v1/batches/660000000000000000000099/dispatch` (a non-existent batch ID) receive `403 RBAC_INSUFFICIENT` (never `404`), and `dispatch-coordinator` calling `GET /api/v1/inspections/660000000000000000000099` receives `403 RBAC_INSUFFICIENT`.

```text
[INFO] Running com.tracex.InspectionAndDispatchTests
  Check 12 & Field Validation: Unauthorized roles get 403 RBAC_INSUFFICIENT even for non-existent batch id; invalid buyerName and dispatchDate return 422 with fieldErrors: PASS
```

---

## Check 13: Live Trace Against `tracex_fresh_dev` and Seed Idempotency

- **Result**: PASS
- Started the dev server (`--spring.profiles.active=dev`) twice against `tracex_fresh_dev` to verify seed idempotency, then executed the full 10-step live HTTP trace as `inspector`, `coordinator`, and `factory_mgr`, and stopped the dev server when done.

```powershell
# Command:
& "C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot\bin\java.exe" -jar target/tracex-backend-1.0.0-SNAPSHOT.jar --spring.profiles.active=dev
```

```text
=== SEED IDEMPOTENCY (tracex_fresh_dev) ===
Seed Run 1 counts -> products=5, nonDeletedBatches=14, archivedBatches=1, totalBatches=15, latestInspections=3
Seed Run 2 counts -> products=5, nonDeletedBatches=14, archivedBatches=1, totalBatches=15, latestInspections=3

--- Step 0: Log in as inspector, coordinator, and factory_mgr ---
Logins -> inspector=200 (quality-inspector), coordinator=200 (dispatch-coordinator), factory_mgr=200 (factory-manager)

--- Step 1: GET /api/v1/dispatch/fefo ---
Status: 200, queue.count=11, expired.count=1, exceptions.count=0
[{"rank":1,"batchCode":"TX-2000-01-002","sku":"KMGC","status":"URGENT","daysUntilExpiry":1,"priorityScore":414.0},{"rank":2,"batchCode":"TX-2000-01-003","sku":"ABHJAM","status":"URGENT","daysUntilExpiry":7,"priorityScore":408.0},{"rank":3,"batchCode":"TX-2000-01-004","sku":"WBDRP","status":"WARNING","daysUntilExpiry":8,"priorityScore":357.0}]

--- Step 2: POST /api/v1/inspections as inspector with status=PASSED and one item passed=false -> 422 VALIDATION_ERROR ---
Status: 422 | Body: {"success":false,"requestId":"98f791fd-00bc-49e3-a440-15eb453c7c27","code":"VALIDATION_ERROR","error":"Validation failed","fieldErrors":[{"field":"status","message":"Cannot submit PASSED verdict when one or more checklist items have passed=false"}]}

--- Step 3: POST /api/v1/inspections as inspector with status=FAILED on active batch TX-2000-01-006 -> 201 ---
Status: 201 | id=6ac1e94e3dd4a34f84872600, batchCode=TX-2000-01-006, status=FAILED, isLatest=True

--- Step 4: PATCH /api/v1/batches/{id}/dispatch on TX-2000-01-006 as coordinator -> 409 QUALITY_HOLD ---
Status: 409 | Body: {"success":false,"requestId":"f11d91e1-c56f-438c-9396-7f959a9b8225","code":"QUALITY_HOLD","error":"Batch cannot be dispatched: latest inspection verdict is FAILED"}

--- Step 5: POST /api/v1/inspections as inspector with status=PASSED on TX-2000-01-006 -> 201; GET /api/v1/inspections/batch/{batchId} -> 200 with 2 records, only newest isLatest=true ---
POST Status: 201 | id=6ac1e94e3dd4a34f84872602, status=PASSED, isLatest=True
GET /api/v1/inspections/batch/6ac1c437b820d073691b4ea4 -> Status: 200 | count=2 | records=[{"id":"6ac1e94e3dd4a34f84872602","status":"PASSED","rating":5,"isLatest":true,"createdAt":"2026-10-04T05:51:10.720Z"},{"id":"6ac1e94e3dd4a34f84872600","status":"FAILED","rating":1,"isLatest":false,"createdAt":"2026-10-04T05:51:10.660Z"}]

--- Step 6: PATCH /api/v1/batches/{id}/dispatch on later-expiring batch TX-2000-01-005 (SKU KMGC) without overrideReason -> 409 DISPATCH_OUT_OF_ORDER ---
Status: 409 | Body: {"success":false,"requestId":"c19856e7-6246-457d-8e12-d6c35aeb6b68","code":"DISPATCH_OUT_OF_ORDER","error":"Batch TX-2000-01-005 is out of FEFO order for SKU KMGC; batch TX-2000-01-002 expires earlier and must be dispatched first unless overrideReason is provided"}

--- Step 7: Repeat dispatch on TX-2000-01-005 WITH overrideReason -> 200; verify removed from FEFO queue ---
Dispatch Status: 200 | batchCode=TX-2000-01-005, lifecycleState=DISPATCHED, status=DISPATCHED, dispatchHistory={"dispatchedBy":"coordinator","dispatchedAt":"2026-10-04T05:51:40.758Z","buyerName":"Kumaon Distributors","dispatchDate":"2026-10-04T05:51:40.758Z","overrideReason":"Buyer requires 30-day shelf life minimum for long-haul transit","outOfOrder":true}
FEFO after dispatch -> queue.count=10, TX-2000-01-005 in queue=0

--- Step 8: Repeat dispatch on the same batch TX-2000-01-005 -> 409 CONFLICT ---
Status: 409 | Body: {"success":false,"requestId":"16c516e6-c95b-4e40-b972-cc8afe7337c9","code":"CONFLICT","error":"Batch is already dispatched"}

--- Step 9: PATCH /api/v1/batches/{id}/dispatch as factory_mgr -> 403 RBAC_INSUFFICIENT ---
Status: 403 | Body: {"success":false,"requestId":"e2cceef4-e84b-4375-8308-36b05300f4e2","code":"RBAC_INSUFFICIENT","error":"Insufficient permissions to perform this operation"}

--- Step 10: GET /api/v1/inspections as coordinator -> 403 RBAC_INSUFFICIENT ---
Status: 403 | Body: {"success":false,"requestId":"14a21841-7cdf-40cc-909f-d5a7516215be","code":"RBAC_INSUFFICIENT","error":"Insufficient permissions to perform this operation"}

=== Dev server stopped ===
```

---

## Check 14: OpenAPI Export and `ErrorCodeSpecSyncTest` Green

- **Result**: PASS
- `OpenApiExportTest` regenerated `backend/src/main/resources/openapi/tracex-api.yaml` (`40,099` bytes) and `docs/openapi.json` (`29,784` bytes) with all Phase 1–4 endpoints.
- `ErrorCodeSpecSyncTest` verified 1-to-1 bidirectional synchronization between `ErrorCode.java` (including `BATCH_EXPIRED` and `QUALITY_HOLD`) and `SPEC.md` §6.2.

```text
[INFO] Running com.tracex.ErrorCodeSpecSyncTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.022 s -- in com.tracex.ErrorCodeSpecSyncTest
[INFO] Running com.tracex.OpenApiExportTest
Exported openapi.json length: 29784, operations: 40
Exported tracex-api.yaml length: 40099
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.818 s -- in com.tracex.OpenApiExportTest
```

---

## Check 15: OpenAPI vs `permission-matrix.csv` Parity

- **Result**: PASS
- **Root cause of the Phase 3.2 gap (36 OpenAPI operations vs 34 active matrix rows)**:
  1. `docs/permission-matrix.csv` had 34 active rows for `phase <= 3`: 33 `/api/v1/**` controller routes + 1 Spring Actuator endpoint (`GET /actuator/health`), which is outside Springdoc's `/api/v1` controller scan.
  2. `TestRestrictedController` (`backend/src/test/java/com/tracex/test/TestRestrictedController.java`) registered 3 test-only routes (`/api/v1/test/admin-only`, `/api/v1/test/manager-only`, `/api/v1/test/client-ip`) on the test classpath during `OpenApiExportTest`, producing `33 + 3 = 36` OpenAPI operations.
- **Fix applied**:
  - Added `springdoc.paths-to-exclude=/api/v1/test/**` to `backend/src/main/resources/application.properties` and `backend/src/test/resources/application.properties` so test-only routes are excluded from the exported OpenAPI specifications.
  - Added assertions in `OpenApiExportTest.exportOpenApiSpecs` proving that for `phase <= 4`, `permission-matrix.csv` has 41 total active rows (1 `/actuator/health` + 40 `/api/v1/**` operations) and the exported OpenAPI spec has **40 operations** matching the 40 `/api/v1/**` matrix rows 1-to-1.

```text
[INFO] Running com.tracex.OpenApiExportTest
Exported openapi.json length: 29784, operations: 40
Exported tracex-api.yaml length: 40099
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.818 s -- in com.tracex.OpenApiExportTest
```

---

## Check 16: `SPEC.md` §6.3 Column Fix and §2 Precedence Rule

- **Result**: PASS
- **Before/After of `SPEC.md` §6.3 Notifications and AI Audit tables (from Phase 3.2)**:
  - Before Phase 3.2, `GET /api/v1/notifications/stream` had a 5th cell (`| SSE endpoint (D-4) |`) and `POST /api/v1/ai/dispatch-audit` had a 5th cell (`| Rate-limited |`) while their table headers only declared 4 columns (`| Method | Path | Auth | Min Role |`).
  - Phase 3.2 added `Notes` as the 5th column header (`| Method | Path | Auth | Min Role | Notes |`) and added empty 5th cells (`| |`) to the remaining rows in those two tables so no cell text was deleted and every row has 5 columns.

```markdown
<!-- BEFORE Phase 3.2 -->
### Notifications & Messaging
| Method | Path | Auth | Min Role |
|---|---|---|---|
| GET | `/api/v1/notifications/stream` | Bearer (`?token=` NOT used; see §10) | any authenticated | SSE endpoint (D-4) |
| GET | `/api/v1/notifications` | Bearer | any authenticated |

### AI Audit
| Method | Path | Auth | Min Role |
|---|---|---|---|
| POST | `/api/v1/ai/dispatch-audit` | Bearer | `manager`, `admin`, `super-admin` | Rate-limited |

<!-- AFTER Phase 3.2 -->
### Notifications & Messaging
| Method | Path | Auth | Min Role | Notes |
|---|---|---|---|---|
| GET | `/api/v1/notifications/stream` | Bearer (`?token=` NOT used; see §10) | any authenticated | SSE endpoint (D-4) |
| GET | `/api/v1/notifications` | Bearer | any authenticated | |

### AI Audit
| Method | Path | Auth | Min Role | Notes |
|---|---|---|---|---|
| POST | `/api/v1/ai/dispatch-audit` | Bearer | `manager`, `admin`, `super-admin` | Rate-limited |
```

- **Explicit §2 Precedence Rule (`LAST_SUPERADMIN` vs `SELF_MODIFICATION_NOT_ALLOWED`)**:
  - Recorded in `SPEC.md` §2:
    - For `toggle` (`PATCH /api/v1/auth/users/:id/toggle`) and `delete` (`DELETE /api/v1/auth/users/:id`), `UserService` checks the active super-admin count (`countByIsSuperAdminTrueAndIsActiveTrueAndIsDeletedFalse() <= 1`) **before** the self-target check, so `LAST_SUPERADMIN` (`409`) wins when the actor is the sole active super-admin targeting themselves.
    - For `role-change` (`PATCH /api/v1/auth/users/:id/role`), `UserService` checks self-modification (`actor.getId().equals(target.getId())`) **first**, so `SELF_MODIFICATION_NOT_ALLOWED` (`409`) wins when the actor is the sole active super-admin targeting themselves.
  - Verified by `AdminVsAdminRulesTest.testPrecedenceWhenBothSelfModificationAndLastSuperAdminApply_toggleRoleChangeDelete`:

```text
[INFO] Running com.tracex.AdminVsAdminRulesTest
[INFO] Tests run: 11, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 6.140 s -- in com.tracex.AdminVsAdminRulesTest
```

---

## Check 17: Full `.\mvnw.cmd clean verify`

- **Result**: PASS

```powershell
.\mvnw.cmd clean verify
```

```text
[INFO] Results:
[INFO] 
[INFO] Tests run: 397, Failures: 0, Errors: 0, Skipped: 0
[INFO] 
[INFO] --- jar:3.3.0:jar (default-jar) @ tracex-backend ---
[INFO] Building jar: C:\Users\yashm\OneDrive\Desktop\TraceX\backend\target\tracex-backend-1.0.0-SNAPSHOT.jar
[INFO] 
[INFO] --- spring-boot:3.2.5:repackage (repackage) @ tracex-backend ---
[INFO] Replacing main artifact C:\Users\yashm\OneDrive\Desktop\TraceX\backend\target\tracex-backend-1.0.0-SNAPSHOT.jar with repackaged archive, adding nested dependencies in BOOT-INF/.
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  50.841 s
[INFO] Finished at: 2026-10-04T11:22:56+05:30
[INFO] ------------------------------------------------------------------------
```
