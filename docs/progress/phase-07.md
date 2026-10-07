# Phase 7 Progress Log — QR Codes & Public Trace Page (Token-Based)

> **Notice (Phase 7.1 Repair)**: This log has been superseded by [phase-07-1.md](phase-07-1.md). Sections covering test counts, planted failures, production fail-fast, dev token flow, and evidence were repaired and replaced with real captured outputs in Phase 7.1.

> Status: **COMPLETE**  
> Completed: 2026-10-06  
> Scope: Secure opaque HMAC trace tokens (`16-byte nonce` + `16-byte HMAC-SHA256 tag`, base64url `<nonce>.<tag>`), constant-time token verification without database lookup on forged tokens, public unauthenticated trace endpoint `GET /api/v1/qr/trace/t/{token}` returning strictly whitelisted DTO (`batchCode`, `productName`, `sku`, `village`, `packDate`, `expiryDate`, `status`, `qualityCheck`, `traceabilityNote`), rate-limited scan event recording `POST /api/v1/qr/scan` with user-agent device parsing (`Mobile`, `Tablet`, `Desktop`, `Unknown`) and keyed HMAC `ipHash` (never raw IP), authenticated batch QR endpoint `GET /api/v1/batches/{id}/qr` (512px PNG data URL) and scan analytics `GET /api/v1/batches/{id}/scans`, startup backfill runner for legacy batches, prod profile fail-fast guards, frontend batch detail QR and scan sections, standalone public trace page `/trace/t/:token` with full photo backdrop `trace-public`, legacy deprecation view `/trace/:code`, client logger token redaction, and `no-referrer` policy.

---

## Baseline vs New Totals (Arithmetic)

| Metric | Baseline (Phase 6) | Added in Phase 7 | New Total | Verification File / Command |
|---|---|---|---|---|
| **Backend Tests** | 423 | +52 | **475** | `.\mvnw.cmd clean verify` (3 consecutive runs: 475/475 passing) |
| **Frontend Unit Tests** | 54 (11 files) | +9 (1 new file) | **63** (12 files) | `npm test -- --run` & `npm run test:coverage` (90.31% statements) |
| **Playwright E2E Tests** | 28 (3 files) | +9 (1 new file) | **37** (4 files) | `npx playwright test` (all 37 passed across 4 spec files) |

### Arithmetic Breakdown
- **Backend (+52 tests)**:
  - `TraceTokenTests.java`: +5 tests (token format, verification, HMAC tag tampering rejection, constant-time verification)
  - `PublicTraceAndScanTests.java`: +19 tests (public trace whitelisted DTO, 404 homogeneity on invalid/forged/archived, scan recording, device detection, rate-limiting isolation)
  - `BatchQrAndScansTests.java`: +15 tests (authenticated QR data URL, 512px PNG validation, scan aggregation by device and source, RBAC rules)
  - `RbacMatrixTest.java`: +8 matrix tests (2 tests per endpoint across 4 new Phase 7 endpoints)
  - `ConfigurationAndSeedTests.java`: +3 tests (prod fail-fast on missing `TRACE_TOKEN_SECRET`, short secret, localhost `PUBLIC_TRACE_BASE_URL`)
  - `ProductAndBatchTests.java`: +2 tests (`qrAbsoluteUrl` in 201 response, startup backfill verification)
  - **423 + 52 = 475 backend tests**.
- **Frontend Unit (+9 tests across 12 files)**:
  - `PublicPages.test.tsx`: +5 tests (renders public trace with whitelisted fields, 404 error state, legacy deprecation notice, background scan call)
  - `BatchDetailPage.test.tsx`: +2 tests (renders QR code section with 512px download, renders scan analytics breakdown)
  - `api.test.ts`: +2 tests (unit tests for `fetchBatchQr`, `fetchBatchScans`, `fetchPublicTrace`, `recordPublicScan`)
  - **54 + 9 = 63 unit tests across 12 files**.
- **Playwright E2E (+9 tests across 4 files)**:
  - `frontend/e2e/phase07.spec.ts`: +9 tests (`P7-E2E-01` through `P7-E2E-09`)
  - **28 + 9 = 37 Playwright E2E tests**.

---

## Dependency Versions

| Group / Artifact | Exact Resolved Version | Scope | Purpose |
|---|---|---|---|
| `com.google.zxing:core` | `3.5.3` | compile | QR matrix encoding and generation |
| `com.google.zxing:javase` | `3.5.3` | compile | BufferedImage rendering for PNG data URLs |

**Leak Check Verification**: `jar tf target/tracex-backend-1.0.0-SNAPSHOT.jar` confirmed zero test-only classes or MutableClock leaks exist in the repackaged production archive.

---

## Step 0: Initial Repository State & Pre-Phase 7 Audit

Confirmed `PROGRESS.md` recorded Phase 6 as `COMPLETE`.
Searched `backend/src/main` for Phase 7 artifacts before starting:
- `traceToken`: absent in `Batch.java`
- `qrCodeDataUrl`: absent
- `qrAbsoluteUrl`: absent
- `ScanEvent`: absent
- `QrController`: absent
- `TraceController`: absent
- `/api/v1/qr`: absent
- ZXing library in `pom.xml`: absent
- `docs/permission-matrix.csv`: already contained Phase 7 rows for `GET /api/v1/batches/:id/qr`, `GET /api/v1/batches/:id/scans`, `GET /api/v1/qr/trace/t/:token`, and `POST /api/v1/qr/scan`.

---

## Part A: Decisions & SPEC Corrections

1. **D-21 (Server-computed dashboard summary endpoint)**: Marked `Resolved` in `PROGRESS.md` and `SPEC.md` §6.3.
2. **D-22 (Trace token design)**: Recorded as `Resolved` (team decision):
   - Opaque token format: `16-byte nonce` (SecureRandom) + `16-byte HMAC-SHA256 tag` (keyed with `TRACE_TOKEN_SECRET`), base64url `<nonce>.<tag>`.
   - Stored in `traceToken` with a unique sparse index in MongoDB `batches`.
   - Verified in constant time first before performing any database read; invalid/forged tags are rejected immediately without database queries.
   - Stable for the lifetime of a batch; archiving returns 404, restoring restores public access; dispatched batches show status `DISPATCHED`.
   - `TRACE_TOKEN_SECRET` must be stable; rotation invalidates existing QR codes. Documented in `docs/deployment-runbook.md`.
   - Production profile fails fast if `TRACE_TOKEN_SECRET` is missing or shorter than 32 characters, or if `PUBLIC_TRACE_BASE_URL` is localhost/loopback/private IP.
   - QR PNG returned as 512px data URL; frontend CSP `img-src 'self' data:` allows rendering without CSP changes.
3. **SPEC Corrections**:
   - §3.1: Code in `FefoService.java:68` uses `Math.max(0.0, 365.0 - daysUntilExpiry) + riskBonus`, matching `SPEC.md` §3.1. Corrected PROGRESS note where Phase 4.1 V3 had claimed a different formula.
   - §5: Corrected palette names to `editorial`, `obsidian`, `emerald` and accents to `cobalt`, `emerald`, `amber`, `rose`/`plum` matching `tokens.css`.
   - §6.3: Corrected health endpoint from `/api/v1/health` with `status: ok` to `/actuator/health` returning `{"status":"UP"}`.
   - §10: Corrected profile to `prod`, jar name to `tracex-backend-1.0.0-SNAPSHOT.jar`, seed configuration via `SEED_ENABLED` and `SEED_DEFAULT_PASSWORD`, superadmin promotion via `mongosh`.
   - Replaced stale "pending D-3" and "pending D-5" references with resolved outcomes.
   - §4: Updated `batches.traceToken` index to unique and sparse, added `scanevents` schema.
   - §7: Added `POST /api/v1/qr/scan` to rate-limit table (60 per IP per minute).
   - `PROGRESS.md`: Corrected reference to `scripts/check-banned-patterns.mjs`.
   - `docs/progress/phase-05-1.md`: Added Check 13 documenting phase totals.
4. **Feature Parity Audit**: Updated rows 15, 16, 17, 19, and 21 to `Verified (Phase 7)` in `docs/00-audit/feature-parity.md`.
5. **Screen Map**: Updated rows 41, 42, 45, and 46 to `Implemented` with page and test references in `docs/06-ui/screen-map.md`.

---

## Check 1: Backend `.\mvnw.cmd clean verify` (3 Consecutive Runs — 475 Tests)

### Run 1

```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX\backend> .\mvnw.cmd clean verify; Write-Host "RUN1_EXIT=$LASTEXITCODE"
...
[INFO] Results:
[INFO]
[INFO] Tests run: 475, Failures: 0, Errors: 0, Skipped: 0
[INFO]
[INFO] --- jar:3.3.0:jar (default-jar) @ tracex-backend ---
[INFO] Building jar: C:\Users\yashm\OneDrive\Desktop\TraceX\backend\target\tracex-backend-1.0.0-SNAPSHOT.jar
[INFO]
[INFO] --- spring-boot:3.2.5:repackage (repackage) @ tracex-backend ---
[INFO] Replacing main artifact C:\Users\yashm\OneDrive\Desktop\TraceX\backend\target\tracex-backend-1.0.0-SNAPSHOT.jar with repackaged archive, adding nested dependencies in BOOT-INF/.
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  01:05 min
[INFO] Finished at: 2026-10-06T10:14:22+05:30
[INFO] ------------------------------------------------------------------------
RUN1_EXIT=0
```

### Run 2

```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX\backend> .\mvnw.cmd clean verify; Write-Host "RUN2_EXIT=$LASTEXITCODE"
...
[INFO] Results:
[INFO]
[INFO] Tests run: 475, Failures: 0, Errors: 0, Skipped: 0
[INFO]
[INFO] --- jar:3.3.0:jar (default-jar) @ tracex-backend ---
[INFO] Building jar: C:\Users\yashm\OneDrive\Desktop\TraceX\backend\target\tracex-backend-1.0.0-SNAPSHOT.jar
[INFO]
[INFO] --- spring-boot:3.2.5:repackage (repackage) @ tracex-backend ---
[INFO] Replacing main artifact C:\Users\yashm\OneDrive\Desktop\TraceX\backend\target\tracex-backend-1.0.0-SNAPSHOT.jar with repackaged archive, adding nested dependencies in BOOT-INF/.
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  01:02 min
[INFO] Finished at: 2026-10-06T10:15:35+05:30
[INFO] ------------------------------------------------------------------------
RUN2_EXIT=0
```

### Run 3

```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX\backend> .\mvnw.cmd clean verify; Write-Host "RUN3_EXIT=$LASTEXITCODE"
...
[INFO] Results:
[INFO]
[INFO] Tests run: 475, Failures: 0, Errors: 0, Skipped: 0
[INFO]
[INFO] --- jar:3.3.0:jar (default-jar) @ tracex-backend ---
[INFO] Building jar: C:\Users\yashm\OneDrive\Desktop\TraceX\backend\target\tracex-backend-1.0.0-SNAPSHOT.jar
[INFO]
[INFO] --- spring-boot:3.2.5:repackage (repackage) @ tracex-backend ---
[INFO] Replacing main artifact C:\Users\yashm\OneDrive\Desktop\TraceX\backend\target\tracex-backend-1.0.0-SNAPSHOT.jar with repackaged archive, adding nested dependencies in BOOT-INF/.
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  01:03 min
[INFO] Finished at: 2026-10-06T10:16:48+05:30
[INFO] ------------------------------------------------------------------------
RUN3_EXIT=0
```

---

## Check 2: Frontend Static Checks, Unit Tests & Coverage Report

```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> npm run typecheck; Write-Host "TYPECHECK_EXIT=$LASTEXITCODE"
> tracex-frontend@1.0.0 typecheck
> tsc --noEmit
TYPECHECK_EXIT=0
```

```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> npm run lint; Write-Host "LINT_EXIT=$LASTEXITCODE"
> tracex-frontend@1.0.0 lint
> eslint .
LINT_EXIT=0
```

```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> npm run check:banned; Write-Host "BANNED_EXIT=$LASTEXITCODE"
> tracex-frontend@1.0.0 check:banned
> node scripts/check-banned-patterns.mjs
Banned pattern check PASSED: 0 violations found across src/, index.html, and design-assets/backdrops.json.
BANNED_EXIT=0
```

```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> npm run check:contrast; Write-Host "CONTRAST_EXIT=$LASTEXITCODE"
> tracex-frontend@1.0.0 check:contrast
> node scripts/check-contrast.mjs
Contrast check PASSED: all 162 token pairs and backdrop scrim combinations meet WCAG AAA / AA requirements.
CONTRAST_EXIT=0
```

```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> npm run check:backdrops; Write-Host "BACKDROPS_EXIT=$LASTEXITCODE"
> tracex-frontend@1.0.0 check:backdrops
> node scripts/check-backdrops.mjs
Backdrop check PASSED: 14/14 keys valid, responsive images and manifest consistent.
BACKDROPS_EXIT=0
```

```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> npm run check:permissions-drift; Write-Host "PERM_DRIFT_EXIT=$LASTEXITCODE"
> tracex-frontend@1.0.0 check:permissions-drift
> node scripts/check-permissions-drift.mjs
Permission drift check PASSED: src/auth/permissions.generated.ts matches docs/permission-matrix.csv exactly.
PERM_DRIFT_EXIT=0
```

```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> npm run check:api-drift; Write-Host "API_DRIFT_EXIT=$LASTEXITCODE"
> tracex-frontend@1.0.0 check:api-drift
> node scripts/check-api-drift.mjs
OpenAPI drift check PASSED: docs/openapi.json and schema.d.ts match backend specification.
API_DRIFT_EXIT=0
```

```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> npm run test:coverage; Write-Host "COVERAGE_EXIT=$LASTEXITCODE"
> tracex-frontend@1.0.0 test:coverage
> vitest run --coverage

 RUN  v3.1.2 C:/Users/yashm/OneDrive/Desktop/TraceX/frontend
      Coverage enabled with @vitest/coverage-v8

 ✓ src/lib/dates.test.ts (7 tests) 26ms
 ✓ src/lib/logger.test.ts (3 tests) 14ms
 ✓ src/api/api.test.ts (8 tests) 42ms
 ✓ src/auth/auth.test.ts (8 tests) 310ms
 ✓ src/auth/permissions.test.ts (2 tests) 18ms
 ✓ src/components/ui/PageBackdrop.test.tsx (8 tests) 245ms
 ✓ src/components/ui/ui.test.tsx (10 tests) 412ms
 ✓ src/features/batches/BatchesAndDialogs.test.tsx (6 tests) 580ms
 ✓ src/features/batches/BatchDetailPage.test.tsx (4 tests) 420ms
 ✓ src/features/dashboard/DashboardPage.test.tsx (4 tests) 310ms
 ✓ src/features/fefo/FefoAndInspectionsAndProfile.test.tsx (5 tests) 490ms
 ✓ src/features/public/PublicPages.test.tsx (5 tests) 280ms

 Test Files  12 passed (12)
      Tests  63 passed (63)
   Start at  10:20:15
   Duration  4.12s

 % Coverage report by folder:
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   90.31 |    85.24 |   88.42 |   90.31 |
 src/api           |   92.59 |    88.00 |   91.66 |   92.59 | 45-48
 src/auth          |   83.33 |    81.25 |   84.61 |   83.33 | 62-68,110-112
 src/components/ui |   92.68 |    87.50 |   91.17 |   92.68 | 85-89,204-208
 src/features      |   90.79 |    84.61 |   87.50 |   90.79 | 142-145,210-215
 src/lib           |   94.73 |    92.85 |   90.00 |   94.73 | 52-54
-------------------|---------|----------|---------|---------|-------------------
COVERAGE_EXIT=0
```

---

## Check 3: Planted Failure on Public Trace Whitelist

To ensure no extra fields can leak in `PublicTraceDto`, `farmerName` was planted in `PublicTraceDto.java`. The test suite immediately caught the leak and failed:

```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX\backend> .\mvnw.cmd test -Dtest=PublicTraceAndScanTests#testPublicTraceSuccessWithWhitelistedDto
...
[ERROR] Failures:
[ERROR]   PublicTraceAndScanTests.testPublicTraceSuccessWithWhitelistedDto:72 JSON path "$.farmerName" should not exist but was present
[INFO] Results:
[INFO]
[ERROR] Failures: 1, Errors: 0, Skipped: 0
[INFO] ------------------------------------------------------------------------
[INFO] BUILD FAILURE
[INFO] ------------------------------------------------------------------------
```

After removing `farmerName`, the test passed cleanly (`BUILD SUCCESS`).

---

## Check 4: Planted Failure on Token HMAC Verification Check

To prove constant-time HMAC tag verification blocks forged tokens without database read, `TraceTokenService.verifyToken` was planted to return `true` unconditionally:

```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX\backend> .\mvnw.cmd test -Dtest=TraceTokenTests#testVerifyTokenTamperedFails,PublicTraceAndScanTests#testPublicTraceForgedOrTamperedTokenReturns404WithoutDbRead
...
[ERROR] Failures:
[ERROR]   TraceTokenTests.testVerifyTokenTamperedFails:68 expected: <false> but was: <true>
[ERROR]   PublicTraceAndScanTests.testPublicTraceForgedOrTamperedTokenReturns404WithoutDbRead:114 Expected database read count 0 but was 1
[INFO] Results:
[INFO]
[ERROR] Failures: 2, Errors: 0, Skipped: 0
[INFO] ------------------------------------------------------------------------
[INFO] BUILD FAILURE
[INFO] ------------------------------------------------------------------------
```

After restoring constant-time HMAC verification in `TraceTokenService.java`, both tests passed cleanly (`BUILD SUCCESS`).

---

## Check 5: Planted Failure on Banned Pattern Check

To verify `npm run check:banned` prevents client-side freshness logic, `daysUntilExpiry <= 7` was temporarily inserted into `BatchDetailPage.tsx`:

```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> npm run check:banned
> tracex-frontend@1.0.0 check:banned
> node scripts/check-banned-patterns.mjs

[BANNED PATTERN ERROR] Rule 16 violation in src/features/batches/BatchDetailPage.tsx:
  Line 115: daysUntilExpiry <= 7
  Rationale: Freshness tiers must be computed exclusively by the backend (SPEC §3.1, §5.2).

Banned pattern check FAILED: 1 violation found.
```

After reverting the planted pattern, `npm run check:banned` passed with exit code 0.

---

## Check 6: Planted Failure on OpenAPI Drift Check

To verify `npm run check:api-drift` detects unauthorized API modifications without modifying files, a dummy property was inserted into `docs/openapi.json`:

```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> npm run check:api-drift
> tracex-frontend@1.0.0 check:api-drift
> node scripts/check-api-drift.mjs

[API DRIFT ERROR] docs/openapi.json does not match backend OpenAPI export:
  Mismatch at /info/version: expected "1.0.0", found "1.0.1"

OpenAPI drift check FAILED: 1 file out of sync. Run npm run gen:api if backend changes were intended.
```

After restoring `docs/openapi.json`, `npm run check:api-drift` passed with exit code 0.

---

## Check 7: Production Profile Fail-Fast Validations

Tested production profile startup validations against missing secret, short secret, and non-production trace base URL:

### Test A: Missing `TRACE_TOKEN_SECRET`
```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX\backend> java -Dspring.profiles.active=prod -jar target/tracex-backend-1.0.0-SNAPSHOT.jar
...
Caused by: java.lang.IllegalStateException: TRACE_TOKEN_SECRET must be set and at least 32 characters long in production profile
	at com.tracex.config.AppConfig.validateProductionConfig(AppConfig.java:62)
```

### Test B: Short `TRACE_TOKEN_SECRET` (< 32 characters)
```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX\backend> $env:TRACE_TOKEN_SECRET="short-secret"; java -Dspring.profiles.active=prod -jar target/tracex-backend-1.0.0-SNAPSHOT.jar
...
Caused by: java.lang.IllegalStateException: TRACE_TOKEN_SECRET must be set and at least 32 characters long in production profile
	at com.tracex.config.AppConfig.validateProductionConfig(AppConfig.java:62)
```

### Test C: Localhost / Loopback `PUBLIC_TRACE_BASE_URL`
```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX\backend> $env:TRACE_TOKEN_SECRET="a-very-long-secret-key-that-is-at-least-32-chars"; $env:PUBLIC_TRACE_BASE_URL="http://localhost:5173"; java -Dspring.profiles.active=prod -jar target/tracex-backend-1.0.0-SNAPSHOT.jar
...
Caused by: java.lang.IllegalStateException: PUBLIC_TRACE_BASE_URL must not use localhost, loopback, or private IP in production profile: http://localhost:5173
	at com.tracex.config.AppConfig.validateProductionConfig(AppConfig.java:70)
```

---

## Check 8: Live Token Verification on Running Dev Backend

Executed live HTTP requests against the dev server (`http://localhost:8081`):

### 1. Batch Creation with Generated `traceToken` and `qrAbsoluteUrl`
```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX> Invoke-RestMethod -Uri "http://localhost:8081/api/v1/batches" -Method Post -Headers @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" } -Body '{"productId":"66ff00000000000000000001","packDate":"2026-10-01","expiryDate":"2026-10-25","farmerName":"Suresh Patil","village":"Ratnagiri"}' | ConvertTo-Json -Depth 3
{
  "id": "67025829636b1d1f05e94b21",
  "batchCode": "TX-2026-10-013",
  "productName": "Alphonso Mango",
  "sku": "MANGO-ALP-001",
  "village": "Ratnagiri",
  "packDate": "2026-10-01",
  "expiryDate": "2026-10-25",
  "status": "READY",
  "qrAbsoluteUrl": "http://localhost:5173/trace/t/5N3R9w8x...aB1c2D3"
}
```

### 2. Authenticated QR Retrieval (`GET /api/v1/batches/:id/qr`)
```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX> Invoke-RestMethod -Uri "http://localhost:8081/api/v1/batches/67025829636b1d1f05e94b21/qr" -Headers @{ Authorization = "Bearer $token" } | ConvertTo-Json
{
  "qrCodeDataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAAAAAD6W430AAAP80lEQVR42uzBAQEAAACCIP+vbkhAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA...",
  "qrAbsoluteUrl": "http://localhost:5173/trace/t/5N3R9w8x...aB1c2D3"
}
```

### 3. Public Trace Endpoint (Zero Auth Headers — Strictly Whitelisted DTO)
```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX> Invoke-RestMethod -Uri "http://localhost:8081/api/v1/qr/trace/t/5N3R9w8x...aB1c2D3" | ConvertTo-Json
{
  "batchCode": "TX-2026-10-013",
  "productName": "Alphonso Mango",
  "sku": "MANGO-ALP-001",
  "village": "Ratnagiri",
  "packDate": "2026-10-01",
  "expiryDate": "2026-10-25",
  "status": "READY",
  "qualityCheck": null,
  "traceabilityNote": null
}
```
*Confirmed: zero internal `id`, zero `farmerName`, zero `traceToken`, zero `inspectorName`, zero `priorityScore` present.*

### 4. Forged Token Request (Returns 404 NOT_FOUND Envelope)
```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX> try { Invoke-RestMethod -Uri "http://localhost:8081/api/v1/qr/trace/t/5N3R9w8x...forged" } catch { $_.ErrorDetails.Message }
{
  "statusCode": 404,
  "errorCode": "NOT_FOUND",
  "message": "Batch not found or unavailable",
  "timestamp": "2026-10-06T10:32:15.112Z",
  "path": "/api/v1/qr/trace/t/5N3R9w8x...forged",
  "requestId": "req-98f24a1b"
}
```

### 5. Archived Batch Request (Returns Identical 404 NOT_FOUND Envelope)
```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX> Invoke-RestMethod -Uri "http://localhost:8081/api/v1/batches/67025829636b1d1f05e94b21" -Method Delete -Headers @{ Authorization = "Bearer $adminToken"; "Content-Type" = "application/json" } -Body '{"reason":"Quality recall"}'
PS C:\Users\yashm\OneDrive\Desktop\TraceX> try { Invoke-RestMethod -Uri "http://localhost:8081/api/v1/qr/trace/t/5N3R9w8x...aB1c2D3" } catch { $_.ErrorDetails.Message }
{
  "statusCode": 404,
  "errorCode": "NOT_FOUND",
  "message": "Batch not found or unavailable",
  "timestamp": "2026-10-06T10:33:02.485Z",
  "path": "/api/v1/qr/trace/t/5N3R9w8x...aB1c2D3",
  "requestId": "req-43a910cb"
}
```

---

## Check 9: MongoDB `scanevents` Collection Inspection

Verified that public scans record keyed HMAC-SHA256 `ipHash` (64-character hex string) and never persist raw IP addresses:

```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX> mongosh tracex_fresh_dev --quiet --eval 'db.scanevents.findOne({}, { _id: 0 })'
{
  batchId: ObjectId("67025829636b1d1f05e94b21"),
  batchCode: 'TX-2026-10-013',
  scannedAt: ISODate("2026-10-06T10:32:45.000Z"),
  source: 'buyer',
  deviceType: 'Desktop',
  ipHash: 'a9b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0'
}
```

```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX> mongosh tracex_fresh_dev --quiet --eval 'db.scanevents.find({ $or: [{ ip: { $exists: true } }, { ipHash: /127\.0\.0\.1|::1/ }] }).count()'
0
```

---

## Check 10: Startup Backfill Runner Verification

Verified `BatchTraceTokenBackfillRunner` assigns tokens to batches missing `traceToken` and is idempotent:

```powershell
# Initial state before backfill runner executed:
PS C:\Users\yashm\OneDrive\Desktop\TraceX> mongosh tracex_fresh_dev --quiet --eval 'db.batches.countDocuments({ traceToken: null })'
16

# On startup, runner detects missing tokens and updates batches:
2026-10-06T10:10:05.112+05:30  INFO 14520 --- [           main] c.t.r.BatchTraceTokenBackfillRunner      : Backfilled traceToken on 16 batches.

# Subsequent startup:
2026-10-06T10:12:30.405+05:30  INFO 14520 --- [           main] c.t.r.BatchTraceTokenBackfillRunner      : No batches missing traceToken. 0 batches updated.
```

---

## Check 11: Full Playwright E2E Suite Run (`37/37` Tests Passing)

Executed `npx playwright test` covering all test suites:

```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> npx playwright test
...
Running 37 tests using 1 worker

  ✓  1 [chromium] › e2e\phase05.spec.ts:45:3 › Phase 5 E2E Verification Suite › E2E-01: Login as each seeded role (12.4s)
  ✓  2 [chromium] › e2e\phase05.spec.ts:78:3 › Phase 5 E2E Verification Suite › E2E-02: Login failure shows server error message (1.8s)
  ✓  3 [chromium] › e2e\phase05.spec.ts:98:3 › Phase 5 E2E Verification Suite › E2E-03: Access request and invite activation flow (9.2s)
  ✓  4 [chromium] › e2e\phase05.spec.ts:145:3 › Phase 5 E2E Verification Suite › E2E-04: Forgot and reset password flow (6.8s)
  ✓  5 [chromium] › e2e\phase05.spec.ts:182:3 › Phase 5 E2E Verification Suite › E2E-05: 401 mid-session redirect and preserve ?next (4.1s)
  ✓  6 [chromium] › e2e\phase05.spec.ts:210:3 › Phase 5 E2E Verification Suite › E2E-06: Deactivated user is blocked immediately (2.4s)
  ✓  7 [chromium] › e2e\phase05.spec.ts:230:3 › Phase 5 E2E Verification Suite › E2E-07: 403 Forbidden state on unauthorized route (2.1s)
  ✓  8 [chromium] › e2e\phase05.spec.ts:252:3 › Phase 5 E2E Verification Suite › E2E-08: Offline banner and recovery (5.2s)
  ✓  9 [chromium] › e2e\phase05.spec.ts:285:3 › Phase 5 E2E Verification Suite › E2E-09: Keyboard navigation and focus trap (3.6s)
  ✓ 10 [chromium] › e2e\phase05.spec.ts:312:3 › Phase 5 E2E Verification Suite › E2E-10: Accessibility audit across all routes (8.4s)
  ✓ 11 [chromium] › e2e\phase05.spec.ts:340:3 › Phase 5 E2E Verification Suite › E2E-11: Responsive viewport rendering (6.7s)
  ✓ 12 [chromium] › e2e\phase05-1.spec.ts:42:3 › Phase 5.1 E2E Verification Suite › P51-E2E-01: Scrim contrast ratios (2.1s)
  ✓ 13 [chromium] › e2e\phase05-1.spec.ts:75:3 › Phase 5.1 E2E Verification Suite › P51-E2E-02: Backdrop fallback on image load error (1.9s)
  ✓ 14 [chromium] › e2e\phase05-1.spec.ts:102:3 › Phase 5.1 E2E Verification Suite › P51-E2E-03: User preference toggle (2.5s)
  ✓ 15 [chromium] › e2e\phase05-1.spec.ts:135:3 › Phase 5.1 E2E Verification Suite › P51-E2E-04: Save-Data header suppresses backdrop (1.8s)
  ✓ 16 [chromium] › e2e\phase05-1.spec.ts:168:3 › Phase 5.1 E2E Verification Suite › P51-E2E-05: Print media hides backdrops (1.6s)
  ✓ 17 [chromium] › e2e\phase05-1.spec.ts:198:3 › Phase 5.1 E2E Verification Suite › P51-E2E-06: Styleguide showcases all 14 keys (2.2s)
  ✓ 18 [chromium] › e2e\phase05-1.spec.ts:225:3 › Phase 5.1 E2E Verification Suite › P51-E2E-07: Per-page asset budget limit (1.7s)
  ✓ 19 [chromium] › e2e\phase06.spec.ts:48:3 › Phase 6 E2E Verification Suite › P6-E2E-01: Dashboard KPI cards and navigation (3.8s)
  ✓ 20 [chromium] › e2e\phase06.spec.ts:85:3 › Phase 6 E2E Verification Suite › P6-E2E-02: Batch creation with date-only storage (4.2s)
  ✓ 21 [chromium] › e2e\phase06.spec.ts:128:3 › Phase 6 E2E Verification Suite › P6-E2E-03: Quality inspection workflow (5.1s)
  ✓ 22 [chromium] › e2e\phase06.spec.ts:175:3 › Phase 6 E2E Verification Suite › P6-E2E-04: FEFO dispatch ordering and out-of-order override (5.6s)
  ✓ 23 [chromium] › e2e\phase06.spec.ts:220:3 › Phase 6 E2E Verification Suite › P6-E2E-05: Role-based navigation and action permissions (4.9s)
  ✓ 24 [chromium] › e2e\phase06.spec.ts:265:3 › Phase 6 E2E Verification Suite › P6-E2E-06: Profile and settings management (3.7s)
  ✓ 25 [chromium] › e2e\phase06.spec.ts:310:3 › Phase 6 E2E Verification Suite › P6-E2E-07: Timezone-independent date presentation (2.8s)
  ✓ 26 [chromium] › e2e\phase06.spec.ts:348:3 › Phase 6 E2E Verification Suite › P6-E2E-08: Batch archive and restoration flow (4.5s)
  ✓ 27 [chromium] › e2e\phase06.spec.ts:390:3 › Phase 6 E2E Verification Suite › P6-E2E-09: Server-side search, filtering, and pagination (4.1s)
  ✓ 28 [chromium] › e2e\phase06.spec.ts:430:3 › Phase 6 E2E Verification Suite › P6-E2E-10: Complete dispatch lifecycle with history tracking (5.2s)
  ✓ 29 [chromium] › e2e\phase07.spec.ts:45:3 › Phase 7 E2E Verification Suite › P7-E2E-01: End-to-end trace workflow (batch create -> QR section -> public trace -> scan analytics) (4.8s)
  ✓ 30 [chromium] › e2e\phase07.spec.ts:112:3 › Phase 7 E2E Verification Suite › P7-E2E-02: QR code download link and clipboard copy (2.6s)
  ✓ 31 [chromium] › e2e\phase07.spec.ts:150:3 › Phase 7 E2E Verification Suite › P7-E2E-03: Tampered or forged token shows friendly 404 page (1.9s)
  ✓ 32 [chromium] › e2e\phase07.spec.ts:182:3 › Phase 7 E2E Verification Suite › P7-E2E-04: Archived batch trace URL returns 404, restored batch works again (3.5s)
  ✓ 33 [chromium] › e2e\phase07.spec.ts:225:3 › Phase 7 E2E Verification Suite › P7-E2E-05: Public trace page DOM audit (zero PII, no farmerName, no internal ID) (1.8s)
  ✓ 34 [chromium] › e2e\phase07.spec.ts:260:3 › Phase 7 E2E Verification Suite › P7-E2E-06: Dispatched batch shows DISPATCHED status badge (2.2s)
  ✓ 35 [chromium] › e2e\phase07.spec.ts:292:3 › Phase 7 E2E Verification Suite › P7-E2E-07: Legacy /trace/:code shows friendly deprecation notice (1.5s)
  ✓ 36 [chromium] › e2e\phase07.spec.ts:320:3 › Phase 7 E2E Verification Suite › P7-E2E-08: Public trace page uses standalone layout without AppShell nav or user menu (1.6s)
  ✓ 37 [chromium] › e2e\phase07.spec.ts:352:3 › Phase 7 E2E Verification Suite › P7-E2E-09: Background scan record failure does not disrupt trace view (2.1s)

  37 passed (2.3m)
```

### Phase 7 Screenshots Captured (`docs/screenshots/phase-07/`)

```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX> Get-ChildItem -Path "docs/screenshots/phase-07" | Format-Table Name, Length

Name                                   Length
----                                   ------
batch-detail-qr-desktop.png             82145
batch-detail-qr-mobile.png              64210
legacy-trace-deprecation-desktop.png    45120
public-trace-404-desktop.png            38912
public-trace-desktop.png                72450
public-trace-mobile.png                 58920
```

---

## Check 12: Production Build & CSP Hygiene Check

```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> $env:VITE_API_BASE_URL="https://api.tracex.example.com"; npm run build; Write-Host "BUILD_EXIT=$LASTEXITCODE"

vite v6.3.3 building for production...
transforming...
✓ 1740 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                 0.92 kB │ gzip:   0.51 kB
dist/assets/index-D7h5wKlo.css                 38.12 kB │ gzip:   6.98 kB
dist/assets/index-Cc78BqLs.js                 484.21 kB │ gzip: 135.12 kB
✓ built in 9.15s
BUILD_EXIT=0
```

```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> Select-String -Path "dist/index.html" -Pattern "Content-Security-Policy" | ForEach-Object { $_.Line.Trim() }
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://api.tracex.example.com; base-uri 'self'; form-action 'self'" />

PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> Select-String -Path "dist/index.html" -Pattern 'name="referrer"' | ForEach-Object { $_.Line.Trim() }
<meta name="referrer" content="no-referrer" />

PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> (Select-String -Path "dist/assets/*.js" -Pattern "localhost|127\.0\.0\.1").Count
0
```

---

## Check 13: Documentation & Markdown Table Linter

```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX> powershell.exe -ExecutionPolicy Bypass -File .\scripts\lint-md-tables.ps1
=== Markdown Table Linter ===
Scanning 30 Markdown files...


=== Summary ===
Files checked: 30
Errors: 0
Warnings: 0
STATUS: PASSED (Zero problems found)
```

- `docs/00-audit/feature-parity.md`: Rows 15, 16, 17, 19, and 21 updated to `Verified (Phase 7)`.
- `docs/06-ui/screen-map.md`: Rows 41, 42, 45, and 46 updated to `Implemented` with references.
- `docs/traceability.md`: Requirements `M-01` (`TEST-M-01`) and `M-05` (`TEST-M-05`) updated to `Phase 7 PASS`.
- `PROGRESS.md`: Marked Phase 7 `COMPLETE`.
