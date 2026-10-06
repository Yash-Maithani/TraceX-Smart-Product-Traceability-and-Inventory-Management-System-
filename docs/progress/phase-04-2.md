# Phase 4.2 — Repair Pass Log (Date-Only Representation, Scoped Converter, `EXCEPTION` Representation)

> Completed: 2026-10-04
> Status: **COMPLETE**

---

## R1 — Date Storage and Serialization (`packDate` and `expiryDate` as `LocalDate` `"YYYY-MM-DD"`)

### 1. Previous vs. Repaired Representation

- **Before Phase 4.2**:
  - `Batch.packDate` and `Batch.expiryDate` were typed as `java.time.Instant` (`BatchSummaryDto`, `BatchCreateDto`, `BatchRawMaterialDto`, and `SeedRunner` also used `Instant`).
  - Raw MongoDB storage: `packDate` and `expiryDate` were stored as BSON `Date` (`java.util.Date`, e.g. `{"$date": "2026-10-09T00:00:00.000Z"}`).
  - API response (`GET /api/v1/batches/{id}`): Jackson serialized `Instant` as an ISO-8601 timestamp string (`"2026-10-09T00:00:00Z"`).
- **After Phase 4.2**:
  - `Batch.packDate` and `Batch.expiryDate` are typed as `java.time.LocalDate` and annotated with `@ValueConverter(BatchLocalDateValueConverter.class)`.
  - `BatchSummaryDto.packDate` and `BatchSummaryDto.expiryDate` are typed as `LocalDate` with `@JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")` and `@Schema(type = "string", format = "date", example = "2026-10-09")`.
  - `BatchCreateDto` and `BatchRawMaterialDto` use `LocalDate` with `@JsonDeserialize(using = FlexibleLocalDateDeserializer.class)` and `@JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")`.
  - `SeedRunner.seedBatches` / `upsertBatch` seed `LocalDate` values directly.
  - Raw MongoDB storage: `packDate` and `expiryDate` are stored as BSON `String` (`java.lang.String`) in `"YYYY-MM-DD"` format.
  - API response (`GET /api/v1/batches/{id}`): `packDate` and `expiryDate` are returned as `"YYYY-MM-DD"` strings with zero time-zone shift regardless of the server/JVM default time zone.

### 2. Raw Seeded Document in MongoDB & `GET /api/v1/batches/{id}` Output + Time-Zone Round-Trip Test (`UTC`, `Asia/Kolkata`, `America/Los_Angeles`)

Command executed:

```powershell
.\mvnw.cmd test -Dtest="ProductAndBatchTests#testCreateAndReadBatchDateRoundTripAcrossTimeZones"
```

Real output:

```text
R1 Seeded Batch [TX-2000-01-002] Raw Mongo Document: {"_id": {"$oid": "6ac2764f87c51f6160a6236f"}, "productId": "6ac2764f87c51f6160a6235a", "productName": "Kumaon Royal Multigrain Crackers", "sku": "KMGC", "sourceLotCode": "DEMO-LOT-002", "farmerName": "Demo Farmer", "village": "Demo Village", "quantityProduced": 150, "unit": "Kg", "yieldPercent": 82.0, "batchCode": "TX-2000-01-002", "packDate": "2026-07-07", "expiryDate": "2026-10-05", "dataSource": "predicted", "shelfLifeSource": "predicted", "lifecycleState": "ACTIVE", "priorityScore": 414.0, "traceabilityNote": "Demo batch - DEMO-LOT-002", "createdBy": "[DEMO] Seed", "noteHistory": [], "dispatchHistory": [], "isDeleted": false, "version": 11, "createdAt": {"$date": "2026-10-04T15:52:47.942Z"}, "updatedAt": {"$date": "2026-10-04T15:57:22.413Z"}, "_class": "com.tracex.model.Batch"}
R1 Seeded Batch [TX-2000-01-002]: mongo.packDate=2026-07-07 (java.lang.String), mongo.expiryDate=2026-10-05 (java.lang.String), GET /api/v1/batches/6ac2764f87c51f6160a6236f => {"success":true,"requestId":"8ac0833f-d899-438a-9f8f-10ba875843b4","data":{"id":"6ac2764f87c51f6160a6236f","batchCode":"TX-2000-01-002","productName":"Kumaon Royal Multigrain Crackers","sku":"KMGC","sourceLotCode":"DEMO-LOT-002","farmerName":"Demo Farmer","village":"Demo Village","quantityProduced":150,"unit":"Kg","yieldPercent":82.0,"packDate":"2026-07-07","expiryDate":"2026-10-05","dataSource":"predicted","shelfLifeSource":"predicted","lifecycleState":"ACTIVE","status":"URGENT","daysUntilExpiry":1,"priorityScore":414.0,"qualityCheck":null,"createdBy":"[DEMO] Seed","createdAt":"2026-10-04T15:52:47.942Z","updatedAt":"2026-10-04T15:57:22.413Z","traceabilityNote":"Demo batch - DEMO-LOT-002","noteHistory":[],"dispatchHistory":[],"deletedAt":null,"deletedBy":null,"deleteNote":null,"dispatchDate":null,"buyerName":null,"deleted":false}}
R1 Round-Trip [JVM TZ=UTC]: mongo.packDate=2026-10-09 (java.lang.String), mongo.expiryDate=2026-10-09 (java.lang.String), GET /api/v1/batches/6ac277622250a55371ad3ee0 => {"success":true,"requestId":"c04cf32b-a1f7-44a8-abfa-117d79f578bf","data":{"id":"6ac277622250a55371ad3ee0","batchCode":"TX-2026-10-1526","productName":"Kumaon Royal Multigrain Crackers","sku":"KMGC","sourceLotCode":"R1-TZ-UTC","farmerName":"R1 Farmer","village":"R1 Village","quantityProduced":100,"unit":"Kg","yieldPercent":88.5,"packDate":"2026-10-09","expiryDate":"2026-10-09","dataSource":"fallback","shelfLifeSource":"manual","lifecycleState":"ACTIVE","status":"URGENT","daysUntilExpiry":5,"priorityScore":410.0,"qualityCheck":null,"createdBy":"test_factory_mgr","createdAt":"2026-10-04T15:57:22.926Z","updatedAt":"2026-10-04T15:57:22.926Z","traceabilityNote":"Best before 2026-10-09","noteHistory":[],"dispatchHistory":[],"deletedAt":null,"deletedBy":null,"deleteNote":null,"dispatchDate":null,"buyerName":null,"deleted":false}}
R1 Round-Trip [JVM TZ=Asia/Kolkata]: mongo.packDate=2026-10-09 (java.lang.String), mongo.expiryDate=2026-10-09 (java.lang.String), GET /api/v1/batches/6ac277622250a55371ad3ee2 => {"success":true,"requestId":"3799a948-eb24-42a5-b4af-92288a4f42cf","data":{"id":"6ac277622250a55371ad3ee2","batchCode":"TX-2026-10-1527","productName":"Kumaon Royal Multigrain Crackers","sku":"KMGC","sourceLotCode":"R1-TZ-ASIA-KOLKATA","farmerName":"R1 Farmer","village":"R1 Village","quantityProduced":100,"unit":"Kg","yieldPercent":88.5,"packDate":"2026-10-09","expiryDate":"2026-10-09","dataSource":"fallback","shelfLifeSource":"manual","lifecycleState":"ACTIVE","status":"URGENT","daysUntilExpiry":5,"priorityScore":410.0,"qualityCheck":null,"createdBy":"test_factory_mgr","createdAt":"2026-10-04T15:57:22.981Z","updatedAt":"2026-10-04T15:57:22.981Z","traceabilityNote":"Best before 2026-10-09","noteHistory":[],"dispatchHistory":[],"deletedAt":null,"deletedBy":null,"deleteNote":null,"dispatchDate":null,"buyerName":null,"deleted":false}}
R1 Round-Trip [JVM TZ=America/Los_Angeles]: mongo.packDate=2026-10-09 (java.lang.String), mongo.expiryDate=2026-10-09 (java.lang.String), GET /api/v1/batches/6ac277632250a55371ad3ee4 => {"success":true,"requestId":"012f69c2-c02f-44b6-8958-89df7c496611","data":{"id":"6ac277632250a55371ad3ee4","batchCode":"TX-2026-10-1528","productName":"Kumaon Royal Multigrain Crackers","sku":"KMGC","sourceLotCode":"R1-TZ-AMERICA-LOS_ANGELES","farmerName":"R1 Farmer","village":"R1 Village","quantityProduced":100,"unit":"Kg","yieldPercent":88.5,"packDate":"2026-10-09","expiryDate":"2026-10-09","dataSource":"fallback","shelfLifeSource":"manual","lifecycleState":"ACTIVE","status":"URGENT","daysUntilExpiry":5,"priorityScore":410.0,"qualityCheck":null,"createdBy":"test_factory_mgr","createdAt":"2026-10-04T15:57:23.017Z","updatedAt":"2026-10-04T15:57:23.017Z","traceabilityNote":"Best before 2026-10-09","noteHistory":[],"dispatchHistory":[],"deletedAt":null,"deletedBy":null,"deleteNote":null,"dispatchDate":null,"buyerName":null,"deleted":false}}
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 7.101 s -- in com.tracex.ProductAndBatchTests
[INFO] BUILD SUCCESS
```

---

## R2 — Scoped Lenient Converter & Fail-Closed Security Expiries

### 1. Changes Applied

- Removed `LenientStringToInstantConverter` and `mongoCustomConversions()` from `backend/src/main/java/com/tracex/config/AppConfig.java` so no global lenient converter affects `Instant` fields (`inviteExpiry`, `otpExpiry`, `resetTokenExpiry`).
- Created `backend/src/main/java/com/tracex/util/BatchLocalDateValueConverter.java` (`PropertyValueConverter<Object, Object, ValueConversionContext<?>>`) and applied it via `@ValueConverter(BatchLocalDateValueConverter.class)` exclusively on `Batch.packDate` and `Batch.expiryDate`.
- Added fail-closed entity lookup helpers (`findAccessRequestByInviteTokenOrFailClosed` and `findUserByEmailOrFailClosed`) in `backend/src/main/java/com/tracex/service/UserService.java` that catch `ConversionException | DateTimeParseException` during entity hydration and reject the request with HTTP `401 AUTH_INVALID_TOKEN` and the standard error envelope.
- Added `testCorruptedSecurityExpiriesFailClosed` in `backend/src/test/java/com/tracex/AccessRequestAndUserFlowTests.java` testing corrupted `inviteExpiry` (`POST /api/v1/auth/activate`), corrupted `otpExpiry` (`POST /api/v1/auth/verify-otp` and `POST /api/v1/auth/verify-reset-otp`), and corrupted `resetTokenExpiry` (`POST /api/v1/auth/reset-password`).
- Verified `FefoServiceTest.testCorruptedExpiryDateDoesNotBreakFefoOrBatchReads` (V2 test for corrupted batch dates) remains green.

### 2. R2 & V2 Test Verification

Command executed:

```powershell
.\mvnw.cmd test -Dtest="AccessRequestAndUserFlowTests#testCorruptedSecurityExpiriesFailClosed,FefoServiceTest#testCorruptedExpiryDateDoesNotBreakFefoOrBatchReads"
```

Real output:

```text
[INFO] Running com.tracex.AccessRequestAndUserFlowTests
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 5.862 s -- in com.tracex.AccessRequestAndUserFlowTests
[INFO] Running com.tracex.FefoServiceTest
2026-10-04T21:20:26.110+05:30  WARN 8172 --- [           main] c.t.util.BatchLocalDateValueConverter    : Unparseable Batch LocalDate value 'not-a-date' encountered during MongoDB read; returning null
2026-10-04T21:20:26.122+05:30  WARN 8172 --- [           main] c.t.util.BatchLocalDateValueConverter    : Unparseable Batch LocalDate value 'not-a-date' encountered during MongoDB read; returning null
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.914 s -- in com.tracex.FefoServiceTest
[INFO] BUILD SUCCESS
```

---

## R3 — `EXCEPTION` Representation (`daysUntilExpiry: null`, OpenAPI Enum, and `status=EXCEPTION` Filter)

### 1. Changes Applied

- Changed `BatchSummaryDto.daysUntilExpiry` from primitive `long` to nullable `Long`.
- Updated `BatchService.enrichSummary` and `FefoService.getFefoQueue` so that when `expiryDate` is missing, `null`, or unparseable (`status: "EXCEPTION"`), `daysUntilExpiry` is `null` (not `0`), and `exceptionReason` is populated only when `status` is `"EXCEPTION"` (`null` for all other statuses).
- Annotated `BatchSummaryDto.status` with `@Schema(description = "Derived freshness/lifecycle status", allowableValues = {"EXPIRED", "URGENT", "WARNING", "READY", "EXCEPTION", "DISPATCHED"})`.
- Updated `BatchFreshness.applyStatusFilter` to support `GET /api/v1/batches?status=EXCEPTION` (matching active, non-deleted batches where `expiryDate` does not exist, is `null`, or does not match `^\d{4}-\d{2}-\d{2}$`).
- Updated `SPEC.md` (§3.1, §4, §6.3) and regenerated `docs/openapi.json` and `backend/src/main/resources/openapi/tracex-api.yaml`.
- Added `testExceptionStatusFilterAndNullableDaysUntilExpiry` in `ProductAndBatchTests.java` and schema assertions in `OpenApiExportTest.java`.

### 2. R3 Test Output (`GET /api/v1/batches/{id}` and `GET /api/v1/batches?status=EXCEPTION`)

Real output from `ProductAndBatchTests#testExceptionStatusFilterAndNullableDaysUntilExpiry`:

```json
{
  "success": true,
  "requestId": "810f3600-3a3b-421f-9ffd-e960f2ebdc55",
  "data": {
    "id": "6ac275cd9aa650103f82b12d",
    "batchCode": "TX-R3-EXC-001",
    "productName": "Wild Berry Juice Concentrate",
    "sku": "WBJC",
    "sourceLotCode": "LOT-R3-EXC",
    "farmerName": "R3 Farmer",
    "village": "R3 Village",
    "quantityProduced": 40,
    "unit": "Kg",
    "yieldPercent": 80.0,
    "packDate": "2026-10-01",
    "expiryDate": null,
    "dataSource": null,
    "shelfLifeSource": null,
    "lifecycleState": "ACTIVE",
    "status": "EXCEPTION",
    "daysUntilExpiry": null,
    "priorityScore": 0.0,
    "qualityCheck": null,
    "exceptionReason": "Missing, null, or unparseable expiryDate",
    "createdBy": null,
    "createdAt": "2026-10-04T15:50:37.673Z",
    "updatedAt": null,
    "traceabilityNote": null,
    "noteHistory": [],
    "dispatchHistory": [],
    "deletedAt": null,
    "deletedBy": null,
    "deleteNote": null,
    "dispatchDate": null,
    "buyerName": null,
    "deleted": false
  }
}
```

---

## R4 — Full Verification (`clean verify`, `OpenApiExportTest`, `ErrorCodeSpecSyncTest`, `lint-md-tables.ps1`)

### 1. Full Maven Build & Test Suite (`.\mvnw.cmd clean verify`)

Command executed:

```powershell
.\mvnw.cmd clean verify
```

Real output (with per-class test counts):

```text
[INFO] Running com.tracex.AccessRequestAndUserFlowTests
[INFO] Tests run: 9, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 12.65 s -- in com.tracex.AccessRequestAndUserFlowTests
[INFO] Running com.tracex.AdminVsAdminRulesTest
[INFO] Tests run: 11, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 6.109 s -- in com.tracex.AdminVsAdminRulesTest
[INFO] Running com.tracex.AuthLoginTests
[INFO] Tests run: 10, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 4.406 s -- in com.tracex.AuthLoginTests
[INFO] Running com.tracex.BatchIndexTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.900 s -- in com.tracex.BatchIndexTest
[INFO] Running com.tracex.ConfigurationAndSeedTests
[INFO] Tests run: 12, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.928 s -- in com.tracex.ConfigurationAndSeedTests
[INFO] Running com.tracex.ErrorCodeSpecSyncTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.021 s -- in com.tracex.ErrorCodeSpecSyncTest
[INFO] Running com.tracex.FefoServiceTest
[INFO] Tests run: 11, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 2.704 s -- in com.tracex.FefoServiceTest
[INFO] Running com.tracex.ForwardedHeadersEmpiricalTest
[INFO] Running com.tracex.ForwardedHeadersEmpiricalTest$NativeStrategyUntrustedDirectTests
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.397 s -- in com.tracex.ForwardedHeadersEmpiricalTest$NativeStrategyUntrustedDirectTests
[INFO] Running com.tracex.ForwardedHeadersEmpiricalTest$NativeStrategyTrustedProxyTests
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.021 s -- in com.tracex.ForwardedHeadersEmpiricalTest$NativeStrategyTrustedProxyTests
[INFO] Running com.tracex.ForwardedHeadersEmpiricalTest$FrameworkStrategyTests
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.941 s -- in com.tracex.ForwardedHeadersEmpiricalTest$FrameworkStrategyTests
[INFO] Tests run: 0, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 3.364 s -- in com.tracex.ForwardedHeadersEmpiricalTest
[INFO] Running com.tracex.GlobalSafetyGuardAutoDetectionTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.006 s -- in com.tracex.GlobalSafetyGuardAutoDetectionTest
[INFO] Running com.tracex.InspectionAndDispatchTests
[INFO] Tests run: 12, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 7.353 s -- in com.tracex.InspectionAndDispatchTests
[INFO] Running com.tracex.OpenApiExportTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.880 s -- in com.tracex.OpenApiExportTest
[INFO] Running com.tracex.ProductAndBatchTests
[INFO] Tests run: 35, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.375 s -- in com.tracex.ProductAndBatchTests
[INFO] Running com.tracex.RbacMatrixTest
[INFO] Tests run: 287, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.709 s -- in com.tracex.RbacMatrixTest
[INFO] Running com.tracex.RouteCoverageTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.009 s -- in com.tracex.RouteCoverageTest
[INFO] Running com.tracex.SmtpEmailServiceTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.943 s -- in com.tracex.SmtpEmailServiceTest
[INFO] Running com.tracex.TokenAndSessionTests
[INFO] Tests run: 8, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.676 s -- in com.tracex.TokenAndSessionTests
[INFO] 
[INFO] Results:
[INFO] 
[INFO] Tests run: 404, Failures: 0, Errors: 0, Skipped: 0
[INFO] 
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  53.104 s
[INFO] Finished at: 2026-10-04T21:22:54+05:30
[INFO] ------------------------------------------------------------------------
```

### 2. `OpenApiExportTest` & `ErrorCodeSpecSyncTest`

Command executed:

```powershell
.\mvnw.cmd test -Dtest="OpenApiExportTest,ErrorCodeSpecSyncTest"
```

Real output:

```text
[INFO] Running com.tracex.ErrorCodeSpecSyncTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.025 s -- in com.tracex.ErrorCodeSpecSyncTest
[INFO] Running com.tracex.OpenApiExportTest
Exported openapi.json length: 30246, operations: 40
Exported tracex-api.yaml length: 40782
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 7.276 s -- in com.tracex.OpenApiExportTest
[INFO] 
[INFO] Results:
[INFO] 
[INFO] Tests run: 2, Failures: 0, Errors: 0, Skipped: 0
[INFO] 
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  9.902 s
[INFO] Finished at: 2026-10-04T21:23:32+05:30
[INFO] ------------------------------------------------------------------------
```

### 3. Markdown Table Linter (`scripts/lint-md-tables.ps1`)

Command executed:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/lint-md-tables.ps1
```

Real output:

```text
=== Markdown Table Linter ===
Scanning 24 Markdown files...


=== Summary ===
Files checked: 24
Errors: 0
Warnings: 0
STATUS: PASSED (Zero problems found)
```

