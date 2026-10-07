# Phase 8.0 Progress Log — Import Reference Extraction, SPEC §3.7, and Phase 7.1 Carry-Over (No Import Code)

> Status: **COMPLETE**  
> Completed: 2026-10-06  
> Scope: Phase 7.1 carry-over corrections (Part 0 items 1–3), bulk import reference extraction (`docs/00-audit/import-reference.md`, Part A), `SPEC.md` §3.7 (`Bulk Import`) + Deviations Table + `D-23` (`Proposed`) + `D-24` (`Proposed`) + §2/§6.3 importer role wording + Open Questions for Phase 8 (Part B). Zero import source or test code added; test totals unchanged at **477 backend / 75 frontend unit (13 files) / 37 Playwright E2E (4 files)**.

---

## Baseline vs Phase 8.0 Totals

| Suite | Phase 7.1 Baseline | Added in Phase 8.0 | Phase 8.0 Total | Evidence File |
|---|---|---|---|---|
| **Backend (`mvnw.cmd clean verify`)** | 477 | 0 | **477** (0 failures, 0 errors, 0 skipped) | `docs/progress/evidence/phase-08-0/mvnw-verify.txt` |
| **Frontend Unit (`npm test -- --run`)** | 75 (13 files) | 0 | **75** (13 files) | `docs/progress/evidence/phase-08-0/frontend-unit.txt` |
| **Playwright E2E (`npx playwright test`)** | 37 (4 files) | 0 | **37** (4 files) | `docs/progress/evidence/phase-08-0/playwright.txt` |

---

## Step 0: Confirm Phase 7 and Phase 7.1 are `COMPLETE` in `PROGRESS.md`

Command:
```powershell
Select-String -Path "PROGRESS.md" -Pattern "\| 7 \|", "\| 7\.1 \|" 2>&1 | Tee-Object -FilePath docs\progress\evidence\phase-08-0\step0-progress-check.txt
```

Output (`docs/progress/evidence/phase-08-0/step0-progress-check.txt`):
```text
PROGRESS.md:27:| 7 | QR and public trace (token-based) | COMPLETE | 2026-10-06 | [phase-07](docs/progress/phase-07.md) |
PROGRESS.md:28:| 7.1 | Phase 7 evidence and test repair | COMPLETE | 2026-10-06 | [phase-07-1](docs/progress/phase-07-1.md) |
```

---

## Verification 1 (Part 0 Item 1): Test Count Reconciliation in `docs/progress/phase-07-1.md` and `PROGRESS.md`

### What Was Wrong Before Phase 8.0
1. **Per-class delta sum (`55` vs `54`)**: In `docs/progress/phase-07-1.md` (lines 24 and 191), `RouteCoverageTest` was listed with a delta of `+1` (`0 -> 1`), making the per-class deltas sum to `10 + 1 + 11 + 28 + 1 + 4 = 55` instead of `54`. In fact, `RouteCoverageTest` (`1` test) was already present in Phase 5.0 (`docs/progress/phase-05-0.md` line 286) and Phase 6 (`1 -> 1`, delta `0`).
2. **Unchanged classes total (`422` vs `117` [`116 + 1`])**: Line 25 of `docs/progress/phase-07-1.md` previously stated `"Other 15 classes (0 delta): 422 tests unchanged"`, which double-counted `ConfigurationAndSeedTests` (`12`) and `RbacMatrixTest` (`294`). The 14 other unchanged classes sum to `116`, plus `RouteCoverageTest` (`1`) = `117` unchanged tests across 15 unchanged classes (`117 + 12 + 294 = 423` Phase 6 baseline).
3. **Frontend unit baseline (`63 in 12 files` vs `54 in 11 files`)**: Line 14 of `docs/progress/phase-07-1.md` previously listed the Phase 6 baseline as `63 (12 files)`. The real Phase 6 baseline in `docs/progress/phase-06.md` (Check 5) is **54 tests in 11 files**; Phase 7 added `+9` tests (`+1` file -> `63` in `12` files) and Phase 7.1 added `+12` tests (`+1` file -> `75` in `13` files), so Phases 7 and 7.1 together added **+21 tests (+2 files)** to reach `75` in `13` files.

### Before Lines (`docs/progress/phase-07-1.md` prior to Phase 8.0)
```markdown
| **Backend Tests** | 423 | 477 | +54 (+52 in P7, +2 in P7.1) | `mvnw-verify-run1.txt`, `run2.txt`, `run3.txt` |
| **Frontend Unit Tests** | 63 (12 files) | 75 (13 files) | +12 (+1 file) | `frontend-unit.txt` (90.12% statements) |
| **Playwright E2E Tests** | 37 (4 files) | 37 (4 files) | 0 | `playwright-full.txt` (3.5m execution) |
...
  - `RouteCoverageTest.java` (+1 test): New in Phase 7; validates two-way route mapping coverage between Spring controllers and `docs/permission-matrix.csv`.
  - Other 15 classes (0 delta): 422 tests unchanged.
```

### After Lines Captured in `docs/progress/evidence/phase-08-0/part0-item1-corrections.txt`
Command:
```powershell
& {
  Write-Output "=== docs/progress/phase-07-1.md (lines 11-33 & 171-201) ==="
  Get-Content "docs\progress\phase-07-1.md" | Select-Object -Skip 10 -First 23
  Write-Output "---"
  Get-Content "docs\progress\phase-07-1.md" | Select-Object -Skip 170 -First 31
  Write-Output "=== PROGRESS.md (lines 363-381) ==="
  Get-Content "PROGRESS.md" | Select-Object -Skip 362 -First 20
} 2>&1 | Tee-Object -FilePath docs\progress\evidence\phase-08-0\part0-item1-corrections.txt
```

Output (`docs/progress/evidence/phase-08-0/part0-item1-corrections.txt`):
```text
=== docs/progress/phase-07-1.md (lines 11-33 & 171-201) ===
| Metric | Phase 6 Baseline | Phase 7 Starting (Step 0) | Added in Phase 7 & 7.1 | New Total | Verification File |
|---|---|---|---|---|---|
| **Backend Tests** | 423 | 475 (+52 in Phase 7) | +54 (+52 in P7, +2 in P7.1) | **477** | `mvnw-verify-run1.txt`, `run2.txt`, `run3.txt` |
| **Frontend Unit Tests** | 54 (11 files) | 63 (12 files, +9 in P7) | +21 (+9 in P7, +12 in P7.1; +2 files) | **75** (13 files) | `frontend-unit.txt` (90.12% statements) |
| **Playwright E2E Tests** | 28 (3 files) | 37 (4 files, +9 in P7) | +9 (+9 in P7, 0 in P7.1; +1 file) | **37** (4 files) | `playwright-full.txt` (3.5m execution) |

### Arithmetic Breakdown
- **Backend Tests (423 -> 477, +54 total across Phase 7 & 7.1)**:
  - `TraceTokenTests.java` (+4 tests, `0 -> 4`): Opaque token format, HMAC constant-time tag verification, malformed token rejection, canonical 404 homogeneity.
  - `PublicTraceAndScanTests.java` (+11 tests, `0 -> 11`): Whitelist payload assertion, qualityCheck field variations, status tier derivation under fixed clock, archived 404 vs unknown 404 byte-for-byte diff, scan event recording, device parsing (`Mobile`, `Tablet`, `Desktop`, `Unknown`), keyed `ipHash` isolation and privacy, 20 concurrent scans, archived batch scan suppression, rate limiter independent buckets (60/min), spoofed `X-Forwarded-For` mitigation.
  - `BatchQrAndScansTests.java` (+10 tests, `0 -> 10`): RBAC access across all 6 roles, 401 unauthenticated check, 404 missing/archived checks, `ipHash` leak prevention, `qrAbsoluteUrl` prefix check, 50 concurrent creates with unique tokens, startup backfill idempotency, prod profile fail-fast (missing/short secret, localhost trace URL), atomic conditional update on concurrent GET.
  - `RbacMatrixTest.java` (+28 tests, `294 -> 322`): Expanded dynamic test generation from 42 matrix rows (294 tests) to 46 matrix rows (322 tests) covering the 4 new Phase 7 endpoints across 6 roles and anonymous access.
  - `ConfigurationAndSeedTests.java` (+1 test, `12 -> 13`): Seed runner idempotency regression test proving re-running seed produces 0 duplicate key errors and preserves exactly 12 demo batches.
  - `RouteCoverageTest.java` (0 delta, `1 -> 1`): Already existed in Phase 6 (`docs/progress/phase-05-0.md` line 286); validates two-way route mapping coverage between Spring controllers and `docs/permission-matrix.csv`.
  - Unchanged 15 classes (including `RouteCoverageTest`: 1, plus 14 other unchanged classes totaling 116): `116 + 1 = 117` tests (`117 unchanged + 12 ConfigurationAndSeedTests + 294 RbacMatrixTest = 423` in Phase 6).
  - *Calculation*: `423 + 4 + 11 + 10 + 28 + 1 = 477 tests` (deltas: `4 + 11 + 10 + 28 + 1 = +54`).
- **Frontend Unit Tests (54 in 11 files -> 75 in 13 files, +21 tests and +2 files across Phases 7 & 7.1)**:
  - Phase 6 baseline (`docs/progress/phase-06.md` Check 5): **54 tests across 11 files** (not 63; 63 was the intermediate Phase 7 count before Phase 7.1 repairs).
  - Phases 7 and 7.1 together added **+21 tests (+9 in Phase 7 and +12 in Phase 7.1)** and **+2 test files** (`src/features/public/PublicTracePage.test.tsx` [10 tests] and `src/lib/logger.test.ts` [4 tests]), plus expanded tests in `src/api/endpoints.test.ts`, `src/features/public/PublicPages.test.tsx`, and `src/features/batches/BatchDetailPage.test.tsx`.
  - *Calculation*: `54 (Phase 6 baseline) + 21 (Phases 7 & 7.1) = 75 tests` (`2 + 4 + 7 + 5 + 8 + 5 + 3 + 3 + 8 + 5 + 10 + 10 + 5 = 75 tests across 13 files`).
- **Playwright E2E Tests (28 -> 37, +9 tests)**:
  - 4 spec files (`phase05.spec.ts`, `phase05-1.spec.ts`, `phase06.spec.ts`, `phase07.spec.ts`): all 37 tests green.
---
### Class-by-Class Reconciliation from Baseline 423 to 477

*Derivation of Phase 6 per-class baseline*: Phase 6 (`docs/progress/phase-06.md` Check 1) recorded only the aggregate `Tests run: 423`. The exact Phase 6 per-class baseline is derived deterministically from:
1. The complete per-class Surefire log in `docs/progress/phase-05-0.md` lines 277–315 (`409` tests across 15 classes, including `RouteCoverageTest = 1`, `ConfigurationAndSeedTests = 12`, `ProductAndBatchTests = 37`, `RbacMatrixTest = 287`),
2. Phase 5.0.2 (`PROGRESS.md` line 317 / `docs/progress/phase-05-0-2.md` Item 4), which added `+3` tests to `ProductAndBatchTests` (`37 -> 40`, total `412`), and
3. Phase 6 (`docs/progress/phase-06.md` lines 22 & 26), which added `DashboardSummaryTests` (`4` test methods in `DashboardSummaryTests.java`) and `1` matrix row (`41 -> 42` rows x 7 actors = `287 -> 294`, `+7` in `RbacMatrixTest`, total `412 + 4 + 7 = 423`).

| Test Class | Baseline (Phase 6) | Total in Phase 7.1 | Delta | Explanation |
|---|---|---|---|---|
| `AccessRequestAndUserFlowTests` | 9 | 9 | 0 | Unchanged |
| `AdminVsAdminRulesTest` | 11 | 11 | 0 | Unchanged |
| `AuthLoginTests` | 10 | 10 | 0 | Unchanged |
| `BatchIndexTest` | 1 | 1 | 0 | Unchanged |
| `BatchQrAndScansTests` | 0 | 10 | +10 | New class for Phase 7 (QR retrieval, scan analytics, RBAC, concurrent token generation, concurrent GET atomic update) |
| `ConfigurationAndSeedTests` | 12 | 13 | +1 | Added seed idempotency regression test (`testSeedTwiceDoesNotThrowDuplicateKeyAndPreserves12DemoBatches`) |
| `DashboardSummaryTests` | 4 | 4 | 0 | Unchanged |
| `ErrorCodeSpecSyncTest` | 1 | 1 | 0 | Unchanged |
| `FefoServiceTest` | 11 | 11 | 0 | Unchanged |
| `ForwardedHeadersEmpiricalTest` (all nested) | 3 | 3 | 0 | Unchanged |
| `GlobalSafetyGuardAutoDetectionTest` | 2 | 2 | 0 | Unchanged |
| `InspectionAndDispatchTests` | 14 | 14 | 0 | Unchanged |
| `OpenApiExportTest` | 1 | 1 | 0 | Unchanged |
| `ProductAndBatchTests` | 40 | 40 | 0 | Unchanged |
| `PublicTraceAndScanTests` | 0 | 11 | +11 | New class for Phase 7 (public trace DTO whitelist, scan recording, rate limiting, ipHash) |
| `RbacMatrixTest` | 294 | 322 | +28 | 4 new Phase 7 matrix rows x 7 dynamic tests (1 anonymous + 6 roles) = 28 dynamic test cases |
| `RouteCoverageTest` | 1 | 1 | 0 | Unchanged since Phase 5.0 (`docs/progress/phase-05-0.md` line 286); validates two-way route coverage |
| `SmtpEmailServiceTest` | 1 | 1 | 0 | Unchanged |
| `TokenAndSessionTests` | 8 | 8 | 0 | Unchanged |
| `TraceTokenTests` | 0 | 4 | +4 | New class: token cryptographic structure, HMAC tag tampering rejection, malformed tokens, canonical 404 homogeneity |
| **Total** | **423** | **477** | **+54** | `423 + 10 + 1 + 11 + 28 + 4 = 477` (15 unchanged classes = 117 [116 + 1 `RouteCoverageTest`]; `117 + 12 + 294 = 423`) |
```

---

## Verification 2 (Part 0 Item 2): Root Cause of `http://localhost:5173` vs `5174` and Live API Proof

### Initial Search for `5173`
Command:
```powershell
Get-ChildItem -Path backend, frontend, scripts, . -Include *.properties,*.yml,*.yaml,*.ps1,*.mjs,*.ts,*.js,*.env* -Recurse -File | Where-Object { $_.FullName -notmatch 'node_modules|target|dist' } | Select-String -Pattern "5173" 2>&1 | Tee-Object -FilePath docs\progress\evidence\phase-08-0\grep-5173.txt
```

Output (`docs/progress/evidence/phase-08-0/grep-5173.txt`):
```text
backend\src\main\resources\application-dev.properties:8:tracex.security.public-trace-base-url=${PUBLIC_TRACE_BASE_URL:http://localhost:5173}
```

### Root Cause & Fix
- `backend/src/main/resources/application-dev.properties` line 8 had `tracex.security.public-trace-base-url=${PUBLIC_TRACE_BASE_URL:http://localhost:5173}`, which overrode the base default `http://localhost:5174` in `application.properties` line 28 whenever the `dev` profile ran without `PUBLIC_TRACE_BASE_URL` set in the environment.
- Updated `backend/src/main/resources/application-dev.properties` line 8 to `tracex.security.public-trace-base-url=${PUBLIC_TRACE_BASE_URL:http://localhost:5174}`, cleared `PUBLIC_TRACE_BASE_URL` in the shell, restarted the `dev` backend on port `8081`, and created a batch via `POST /api/v1/batches`.

### Live Verification Output (`docs/progress/evidence/phase-08-0/part0-dev-5174-and-health.txt`)
```text
=== 1. Check for 5173 after fixing application-dev.properties ===
Matches for 5173 count: 0

=== 2. Clear PUBLIC_TRACE_BASE_URL in shell and verify ===
Env:PUBLIC_TRACE_BASE_URL = ''

=== 3. Start dev backend on port 8081 and check /actuator/health ===
GET /actuator/health HTTP 200: 123 34 115 116 97 116 117 115 34 58 34 85 80 34 125

=== 4. Login as admin and create batch via POST /api/v1/batches ===
Selected product: Wild Berry Juice Concentrate (6ac1c437b820d073691b4e9a)
POST /api/v1/batches HTTP 201:
{
    "success":  true,
    "requestId":  "b222ba77-8589-43dc-b7f7-8794a2603fda",
    "data":  {
                 "id":  "6ac4aafe39ee0d1cffc5a56d",
                 "batchCode":  "TX-2026-10-015",
                 "productName":  "Wild Berry Juice Concentrate",
                 "sku":  "WBJC",
                 "sourceLotCode":  "LOT-P80-VERIFY-5174",
                 "farmerName":  "Kundan Bisht",
                 "village":  "Almora",
                 "quantityProduced":  120,
                 "unit":  "Kg",
                 "yieldPercent":  88.0,
                 "packDate":  "2026-10-06",
                 "expiryDate":  "2026-11-06",
                 "dataSource":  "fallback",
                 "shelfLifeSource":  "manual",
                 "lifecycleState":  "ACTIVE",
                 "status":  "READY",
                 "daysUntilExpiry":  31,
                 "priorityScore":  334.0,
                 "qualityCheck":  null,
                 "createdBy":  "admin",
                 "createdAt":  "2026-10-06T08:02:06.071018Z",
                 "updatedAt":  "2026-10-06T08:02:06.071018Z",
                 "traceabilityNote":  "Phase 8.0 verify 5174 port",
                 "noteHistory":  [

                                 ],
                 "dispatchHistory":  [

                                     ],
                 "deletedAt":  null,
                 "deletedBy":  null,
                 "deleteNote":  null,
                 "dispatchDate":  null,
                 "buyerName":  null,
                 "qrAbsoluteUrl":  "http://localhost:5174/trace/t/_M3FoYYBVbvKnIssUNbFVA.Hhgt-KViO1Z1CzykQDpvSA",
                 "deleted":  false
             }
}

Extracted qrAbsoluteUrl: http://localhost:5174/trace/t/_M3FoYYBVbvKnIssUNbFVA.Hhgt-KViO1Z1CzykQDpvSA
Starts with http://localhost:5174: True
```

---

## Verification 3 (Part 0 Item 3): `management.health.mail.enabled=false` Scoped to `dev`, `test`, and `e2e` Profiles

### Decision & Reason
- **Decision**: Removed `management.health.mail.enabled=false` from base `backend/src/main/resources/application.properties` and added it to `application-dev.properties` and `application-test.properties` (`backend/src/test/resources/application-test.properties`); `application-e2e.properties` already had `management.health.mail.enabled=false` and was not modified (as shown in the Verification 6 file modification list at lines 474–476). Thus `management.health.mail.enabled=false` is active only in the `dev`, `test`, and `e2e` profiles. Recorded in `SPEC.md` §8.3 and `PROGRESS.md`.
- **Reason**: The `dev`, `test`, and `e2e` profiles set `tracex.mail.sink.enabled=true` (`DevMailSink`) and have no SMTP server running on `localhost:587` (except during `SmtpEmailServiceTest`, which starts an embedded GreenMail server on a test port). Leaving `MailHealthIndicator` enabled in those three profiles would cause `/actuator/health` to fail with `503 DOWN` attempting to connect to `localhost:587`. Removing `management.health.mail.enabled=false` from base `application.properties` ensures `prod` (`tracex.mail.sink.enabled=false`, where `SmtpEmailService` is active) does not silently inherit a disabled mail health check.

### Profile Files (`docs/progress/evidence/phase-08-0/profile-files.txt`)
```text
=== backend/src/main/resources/application.properties ===
# Base Application Properties
spring.application.name=tracex-backend
spring.profiles.active=${SPRING_PROFILES_ACTIVE:dev}

# Server
server.port=${SERVER_PORT:8081}

# Request Size Limit
spring.servlet.multipart.max-file-size=10MB
spring.servlet.multipart.max-request-size=10MB

# Actuator: expose only health
management.endpoints.web.exposure.include=health
management.endpoint.health.show-details=never

# OpenAPI Documentation
springdoc.swagger-ui.path=/api/v1/docs
springdoc.api-docs.path=/api/v1/api-docs
springdoc.swagger-ui.enabled=true
springdoc.api-docs.enabled=true
springdoc.paths-to-exclude=/api/v1/test/**

# Security & CORS Defaults
tracex.security.jwt-secret=${JWT_SECRET:}
tracex.security.trace-token-secret=${TRACE_TOKEN_SECRET:}
tracex.security.frontend-url=${FRONTEND_URL:http://localhost:5174}
tracex.security.public-trace-base-url=${PUBLIC_TRACE_BASE_URL:http://localhost:5174}

# Rate Limits
tracex.rate-limit.trace=${RATE_LIMIT_TRACE:60}
tracex.rate-limit.scan=${RATE_LIMIT_SCAN:60}

# Seed Configuration
tracex.seed.enabled=${SEED_ENABLED:false}
tracex.seed.default-password=${SEED_DEFAULT_PASSWORD:}

# Forward Headers Strategy (off in base, dev, test)
server.forward-headers-strategy=none

# Mail & Dev Mail Sink Configuration
tracex.mail.sink.enabled=true
tracex.mail.sink.dir=target/dev-mail
tracex.mail.from-name=${EMAIL_FROM_NAME:TraceX Platform}
tracex.mail.from-addr=${EMAIL_FROM_ADDR:noreply@tracex.demo}

spring.mail.host=${SPRING_MAIL_HOST:localhost}
spring.mail.port=${SPRING_MAIL_PORT:587}
spring.mail.username=${SPRING_MAIL_USERNAME:}
spring.mail.password=${SPRING_MAIL_PASSWORD:}
spring.mail.properties.mail.smtp.auth=${SPRING_MAIL_PROPERTIES_MAIL_SMTP_AUTH:true}
spring.mail.properties.mail.smtp.starttls.enable=${SPRING_MAIL_PROPERTIES_MAIL_SMTP_STARTTLS_ENABLE:true}


tracex.business.timezone=${BUSINESS_TIME_ZONE:Asia/Kolkata}

spring.data.mongodb.auto-index-creation=true

=== backend/src/main/resources/application-dev.properties ===
# Development Profile
server.port=${SERVER_PORT:8081}
spring.data.mongodb.uri=${SPRING_DATA_MONGODB_URI:mongodb://localhost:27017/tracex_fresh_dev}

tracex.seed.enabled=${SEED_ENABLED:true}
tracex.seed.default-password=${SEED_DEFAULT_PASSWORD:DevPass123456!}
tracex.security.frontend-url=${FRONTEND_URL:http://localhost:5174}
tracex.security.public-trace-base-url=${PUBLIC_TRACE_BASE_URL:http://localhost:5174}
tracex.security.jwt-secret=${JWT_SECRET:dev_secret_key_must_be_at_least_32_bytes_long_123456}

management.health.mail.enabled=false

springdoc.swagger-ui.enabled=true
springdoc.api-docs.enabled=true

=== backend/src/test/resources/application-test.properties ===
spring.data.mongodb.uri=mongodb://localhost:27017/tracex_fresh_test
tracex.security.jwt-secret=0123456789abcdef0123456789abcdef
management.endpoint.health.show-details=always
management.endpoint.health.show-components=always
management.health.mail.enabled=false
tracex.seed.enabled=true
tracex.seed.default-password=TestPass123456!
spring.data.mongodb.auto-index-creation=true

=== backend/src/main/resources/application-e2e.properties ===
spring.data.mongodb.uri=mongodb://localhost:27017/tracex_fresh_e2e
server.port=8083
tracex.security.jwt-secret=e2e-jwt-secret-key-at-least-32-chars-long-for-browser-tests
tracex.security.frontend-url=${FRONTEND_URL:http://localhost:5174}
tracex.seed.enabled=true
tracex.seed.default-password=${E2E_SEED_PASSWORD:E2ePass123456!}
tracex.mail.sink.enabled=true
management.health.mail.enabled=false
tracex.rate-limit.login=1000
tracex.rate-limit.request-access=1000
tracex.rate-limit.forgot-password=1000
tracex.rate-limit.resend-otp=1000
tracex.rate-limit.trace=1000
tracex.rate-limit.scan=1000
logging.level.com.tracex=INFO
```

### `/actuator/health` Output (`docs/progress/evidence/phase-08-0/actuator-health.txt`)
```text
=== 1. Dev Profile /actuator/health (port 8081, tracex_fresh_dev) ===
HTTP 200: {"status":"UP"}

=== 2. Prod Profile /actuator/health with valid prod env vars (port 8084, tracex_fresh_dev, MANAGEMENT_HEALTH_MAIL_ENABLED=false since no external SMTP server on local Windows machine) ===
HTTP 200: {"status":"UP"}
```
*(In `test` profile, `ConfigurationAndSeedTests#testActuatorHealthReportsDatabaseUp` also asserts `$.status == "UP"` and `$.components.mongo.status == "UP"`.)*

### `.\mvnw.cmd clean verify` Result (`docs/progress/evidence/phase-08-0/mvnw-verify.txt`)
Command:
```powershell
Set-Location backend; .\mvnw.cmd clean verify 2>&1 | Tee-Object -FilePath ..\docs\progress\evidence\phase-08-0\mvnw-verify.txt
```

Output (`docs/progress/evidence/phase-08-0/mvnw-verify.txt` tail):
```text
[INFO] Results:
[INFO] 
[INFO] Tests run: 477, Failures: 0, Errors: 0, Skipped: 0
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
[INFO] Total time:  01:05 min
[INFO] Finished at: 2026-10-06T13:31:23+05:30
[INFO] ------------------------------------------------------------------------
```

---

## Verification 4 & 5 (Part A & Part B): `docs/00-audit/import-reference.md`, `SPEC.md` §3.7, `D-23`, `D-24`, and Open Questions

Command:
```powershell
& {
  Write-Output "=== Check 4: docs/00-audit/import-reference.md headings & summary ==="
  $item = Get-Item "docs\00-audit\import-reference.md"
  Write-Output "File: $($item.FullName) | Length: $($item.Length) bytes | LastWriteTime: $($item.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss'))"
  Select-String -Path "docs\00-audit\import-reference.md" -Pattern "^## " | ForEach-Object { "$($_.LineNumber): $($_.Line)" }
  Write-Output "--- Answered / Partial / Not Found Summary ---"
  Select-String -Path "docs\00-audit\import-reference.md" -Pattern "Answered|Partial|Not found in reference" | ForEach-Object { "$($_.LineNumber): $($_.Line)" }
  Write-Output "=== Check 5: SPEC.md §3.7, Deviations table, D-23, D-24 ==="
  Select-String -Path "SPEC.md" -Pattern "D-23|D-24|### .3\.7|#### Deviations from Reference Implementation" | ForEach-Object { "SPEC.md:$($_.LineNumber): $($_.Line)" }
  Select-String -Path "PROGRESS.md" -Pattern "D-23|D-24" | ForEach-Object { "PROGRESS.md:$($_.LineNumber): $($_.Line)" }
} 2>&1 | Tee-Object -FilePath docs\progress\evidence\phase-08-0\audit-and-spec-check.txt
```

Output (`docs/progress/evidence/phase-08-0/audit-and-spec-check.txt`):
```text
=== Check 4: docs/00-audit/import-reference.md headings & summary ===
File: C:\Users\yashm\OneDrive\Desktop\TraceX\docs\00-audit\import-reference.md | Length: 42498 bytes | LastWriteTime: 2026-10-06 13:41:40
9: ## Reference Files Audited
28: ## 1. Import Schema
77: ## 2. Header Mapping
119: ## 3. Validation
166: ## 4. Row Outcome
211: ## 5. Derived Values
253: ## 6. Chunking and Job Lifecycle
298: ## 7. Rollback
337: ## 8. CSV Parser Rules
384: ## 9. UI Flow
425: ## 10. Authorisation and Side Effects
470: ## 11. Defects in Reference
513: ## Summary Count of Extracted Items
--- Answered / Partial / Not Found Summary ---
5: > **Extraction Summary**: **11 / 11 sections answered** (`11 answered`, `0 partial`, `0 not found` across the 7 named source/test files; **not found in reference**: backend unit/integration tests for bulk import in `backend/tests/` and standalone `.csv` fixture files - only `frontend/src/utils/csvParser.test.js` and `backend/tests/rbac.test.js` lines 80-95, 115-130 exist).
24: | Backend import controller test / `.csv` fixtures | **Not found in reference** | - | Search of reference `backend/tests/` (`aiService.test.js`, `expiryCalculator.test.js`, `qrGenerator.test.js`, `rbac.test.js`) and `*.csv` across workspace returned 0 backend import tests and 0 `.csv` fixture files (the sample template is generated inline in `ImportPanel.jsx` lines 31-44) |
399:      - `Import N batches` button is enabled whenever `preview.summary.insert > 0` (`line 277`) - partial imports (inserting valid rows while skipping errored/duplicate rows) are allowed.
517: | **Answered** | **11 / 11** | Sections 1 through 11 fully answered with exact file paths, line numbers, and verbatim code excerpts (`<= 15` lines each) |
518: | **Partial** | **0 / 11** | None |
519: | **Not found in reference** | **0 sections** (2 auxiliary artifacts noted) | All 7 named files exist and were read in full; reference has no backend import test file in `backend/tests/` and no standalone `.csv` fixture file on disk |
=== Check 5: SPEC.md  3.7, Deviations table, D-23, D-24 ===
SPEC.md:2: > Version: 0.3 (Phase 8.0 - import reference extraction,  3.7 Bulk Import, D-23 & D-24 proposed)
SPEC.md:33: | D-23 | Import batch creation & validation code path | Import commit creates batches through the same `BatchService` creation path as `POST /api/v1/batches` (so each imported batch gets an atomic `TX-YYYY-MM-NNN` batch code from `BatchCodeGenerator`, a `traceToken`, runtime freshness derivation, and standard validation), never by writing documents directly. Row validation reuses existing batch validators with no copied rules | **PROPOSED** |
SPEC.md:34: | D-24 | Import rollback semantics & guards | Rollback soft-deletes only the batches the job inserted, using the same archive operation as `DELETE /api/v1/batches/{id}` with the reason `"Import rollback <jobId>"` and an audit entry; it never hard-deletes and does not undo updates made to existing batches. Rollback returns HTTP `409 CONFLICT` (changing nothing) when any inserted batch has since been dispatched, when the job status is not `done`, or when it was already rolled back | **PROPOSED** |
SPEC.md:323: ###  3.7 - Bulk Import (`docs/00-audit/import-reference.md`)
SPEC.md:329: 4. `POST /api/v1/import/commit`: Commits a chunk of rows (`1..500` rows per request) within a maximum job cap of **10,000 rows per job (`Proposed`)**. Creates or updates an `ImportJob` (`importjobs` collection) and creates valid non-duplicate batches via `BatchService` (`D-23`, `Proposed`).
SPEC.md:332: 7. `POST /api/v1/import/:id/rollback`: Soft-deletes batches inserted by the job (`D-24`, `Proposed`).
SPEC.md:338: **Validation & Batch Creation Code Path (`D-11`, `D-16`, `D-17`, `D-22`, `D-23` `Proposed`)**:
SPEC.md:339: - **Single creation path (`D-23`, `Proposed`)**: Import commit creates every batch through the same `BatchService` creation code path as `POST /api/v1/batches`, never by writing batch documents directly to MongoDB. Row validation reuses the existing batch field validators with no copied validation rules:
SPEC.md:346: - **Derived values via `BatchService` (`D-11`, `D-16`, `D-17`, `D-22`, `D-23`)**:
SPEC.md:359: **Rollback Semantics (`D-24`, `Proposed`)**:
SPEC.md:367: - *Comparison with reference & recommendation*: The reference `rollbackImport` (`import.controller.js` lines 662-672) used a raw `Batch.updateMany({ _id: { $in: job.insertedBatchIds }, isDeleted: { $ne: true } })` that silently soft-deletes already-dispatched batches (contradicting `ImportPanel.jsx` line 375) and wrote no `audit_logs` entry. **Recommendation**: Adopt `D-24` (`409 CONFLICT` when any inserted batch has been dispatched, when `status != "done"`, or when already `rolled_back`), because archiving a batch that has already physically left the facility (`DISPATCHED`) corrupts dispatch and traceability records.
SPEC.md:373: #### Deviations from Reference Implementation (Bulk Import)
SPEC.md:377: | `preallocateBatchCodes` (`import.controller.js` lines 273-289) uses non-atomic `Batch.findOne` + in-memory increment with prefix `HS-YYYY-MM-NNN` | Each imported batch allocates `TX-YYYY-MM-NNN` atomically from the `counters` collection via `BatchCodeGenerator` (`BatchService`) | Resolved `D-11` (`TX-` prefix), `OI-02` (atomic counter), and `D-23` (`Proposed` single batch creation path) |
SPEC.md:378: | `commitImport` (`import.controller.js` lines 506-562) writes directly via `Batch.insertMany` and duplicates validation/expiry/QR logic | `commitImport` delegates batch creation and validation to `BatchService` (`POST /api/v1/batches` code path) | `D-23` (`Proposed`): single source of truth for batch creation, validation, `traceToken`, and `BatchFreshness` |
SPEC.md:383: | `rollbackImport` (`import.controller.js` lines 662-672) silently soft-deletes already-dispatched batches and writes no `audit_logs` entry | Rollback returns HTTP `409 CONFLICT` (changing nothing) if any inserted batch has been dispatched, if `status != "done"`, or if already rolled back, and archives via `BatchService` with reason `"Import rollback <jobId>"` and an `audit_logs` entry | `D-24` (`Proposed`): prevents corrupting dispatched inventory records and preserves audit trail |
PROGRESS.md:66: | D-23 | Import batch creation & validation code path | Proposed | Import commit creates batches through the same `BatchService` creation path as `POST /api/v1/batches` (so each imported batch gets an atomic `TX-YYYY-MM-NNN` batch code from `BatchCodeGenerator`, a `traceToken`, runtime freshness derivation, and standard validation), never by writing documents directly. Row validation reuses existing batch validators with no copied rules | SPEC  3.7 |
PROGRESS.md:67: | D-24 | Import rollback semantics & guards | Proposed | Rollback soft-deletes only the batches the job inserted, using the same archive operation as `DELETE /api/v1/batches/{id}` with the reason `"Import rollback <jobId>"` and an audit entry; it never hard-deletes and does not undo updates made to existing batches. Rollback returns HTTP `409 CONFLICT` (changing nothing) when any inserted batch has since been dispatched, when the job status is not `done`, or when it was already rolled back | SPEC  3.7 |
PROGRESS.md:378: - **Part B (`SPEC.md`  3.7, Deviations Table, `D-23`, `D-24`, Role Wording, and Open Questions)**: Added `SPEC.md`  3.7 (`Bulk Import`) and the 3-column Deviations Table, recorded `D-23` and `D-24` as `Proposed` in `PROGRESS.md` and `SPEC.md`, aligned `SPEC.md`  2 and  6.3 importer role wording with `requireImporter` and `docs/permission-matrix.csv` (`super-admin`, `admin`, `manager`, `factory-manager`), and documented Phase 8 open questions in [docs/progress/phase-08-0.md](docs/progress/phase-08-0.md).
```

### Open Questions for the Team

The following questions arise from gaps, ambiguities, or defects in the reference implementation and should be confirmed for Phase 8:

1. **Multi-chunk job join, creator match, and stuck-`running` recovery (`commitImport` lines 489–501, 595–598)**:
   - In the reference, chunk 0 creates an `ImportJob` (`status: "running"`) and returns `jobId`; later chunks pass `jobId` and the final chunk passes `isFinal: true`. However, the reference does not verify that subsequent chunks come from the same `createdBy` user, does not reject appending to a job whose status is already `done` or `failed`, and leaves the job permanently stuck in `status: "running"` (and un-rollbackable) if a browser tab closes or a later chunk fails mid-flight.
   - *Question*: Should `POST /api/v1/import/commit` enforce `job.createdBy == actor.username` and `job.status == "running"` (`409 CONFLICT` otherwise), and should a failed/aborted multi-chunk job either transition to `"failed"` or allow rollback of already-inserted batches?
2. **Cross-chunk in-file duplicate detection during `POST /api/v1/import/validate` (`useImport.js` lines 67–94)**:
   - In the reference, the client splits `validate` into 200-row requests, and `seenInFile` is local to a single request. Thus, identical rows in chunk 0 (row 10) and chunk 1 (row 210) both show `verdict: "insert"` in the dry-run preview!
   - *Question*: Should the client pass already-seen dedupe keys (or should `validate` accept up to a higher limit / track keys across chunks) so cross-chunk duplicates within the same file are accurately marked `skip` during preview?
3. **HTTP status codes & error codes for empty `rows` (`0` rows) and oversized chunks (`> 500` rows) or jobs (`> 10,000` rows)**:
   - The reference returns HTTP `400` on `rows.length === 0` and HTTP `413` on `rows.length > 500` (`import.controller.js` lines 425–432, 476–482).
   - *Question*: In the TraceX `/api/v1/` error envelope (`SPEC.md` §6.1–§6.2), should empty `rows`, `rows.length > 500`, and `processedRows + rows.length > 10000` return HTTP `422 VALIDATION_ERROR` (with `fieldErrors` on `rows`), or should `> 500` / `> 10,000` return HTTP `413` with a new `ErrorCode`?
4. **Whether a `skip` row counts as an error or prevents job completion (`import.controller.js` line 596)**:
   - In the reference, `skip` rows increment `job.skipped` (not `job.errored`), do not add to `rowErrors[]`, and a file consisting solely of `skip` rows (`inserted == 0, skipped > 0, errored == 0`) finishes with `job.status = "done"`.
   - *Question*: Confirm that `skip` rows never count as errors and that `job.status = "failed"` occurs only when `inserted == 0 && errored > 0`.
5. **Rollback behavior when one of the job's batches was manually archived (`isDeleted: true`) vs. dispatched (`lifecycleState: "DISPATCHED"`) before rollback (`D-24`)**:
   - Under `D-24` (`Proposed`), rollback returns HTTP `409 CONFLICT` (changing nothing) if any batch in `insertedBatchIds` has been dispatched (`lifecycleState == "DISPATCHED"`), if `job.status != "done"`, or if `job.status == "rolled_back"`.
   - *Question*: If an admin manually archived (`DELETE /api/v1/batches/:id`, `isDeleted: true`) one of the imported batches before rolling back the import job (while none are dispatched), should rollback skip the already-archived batch and archive the remaining active batches from `insertedBatchIds`, or return `409 CONFLICT`?
6. **PII (`farmerName`) in `POST /api/v1/import/validate` preview and `ImportJob.rowErrors` (`import.controller.js` lines 453, 574)**:
   - The reference includes `farmer: r.value?.farmerName` in the `/validate` preview response (even though `ImportPanel.jsx` never renders `r.farmer` in the preview table!) and stores raw `value` in `ImportJob.rowErrors[]`.
   - *Question*: Should `farmer` be omitted from the `/validate` preview DTO and redacted/omitted when `field == "farmerName"` in `ImportJob.rowErrors[]`?
7. **Future `packDate` validation in bulk import vs. `POST /api/v1/batches`**:
   - In `POST /api/v1/batches` (`BatchService`), `packDate` cannot be in the future (`packDate > LocalDate.now(clock)` -> `422 VALIDATION_ERROR`). The reference `import.controller.js` (`parseDate`, lines 132–154) allowed any year `1970..2100`.
   - *Question*: Under `D-23` (reusing `BatchService` validators), confirm that future `packDate` (`packDate > today` in `Asia/Kolkata`) is rejected as a row validation error during bulk import.

---

## Verification 6: Search Proof That No Import Code Was Added

Command:
```powershell
& {
  Write-Output "=== Recursive case-insensitive search of backend/src and frontend/src for ImportJob, ImportController, csv ==="
  Get-ChildItem -Path "backend\src", "frontend\src" -Recurse -File | Select-String -Pattern "ImportJob|ImportController|csv"
  Write-Output "=== Files modified in backend/src and frontend/src on 2026-10-06 after 13:20 ==="
  Get-ChildItem -Path "backend\src", "frontend\src", "docs", "SPEC.md", "PROGRESS.md" -Recurse -File | Where-Object { $_.LastWriteTime -gt [datetime]"2026-10-06T13:20:00" -and $_.FullName -notmatch "\\evidence\\phase-08-0\\" } | Sort-Object LastWriteTime | ForEach-Object { "$($_.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss'))  $($_.FullName.Replace('C:\Users\yashm\OneDrive\Desktop\TraceX\', ''))" }
} 2>&1 | Tee-Object -FilePath docs\progress\evidence\phase-08-0\no-import-code-proof.txt
```

Output (`docs/progress/evidence/phase-08-0/no-import-code-proof.txt`):
```text
=== Recursive case-insensitive search of backend/src and frontend/src for ImportJob, ImportController, csv ===

backend\src\test\java\com\tracex\OpenApiExportTest.java:93:        List<String> csvLines = Files.readAllLines(docsDir.resolve("permission-matrix.csv"), StandardCharsets.UTF_8);
backend\src\test\java\com\tracex\OpenApiExportTest.java:96:        for (int i = 1; i < csvLines.size(); i++) {
backend\src\test\java\com\tracex\OpenApiExportTest.java:97:            String line = csvLines.get(i).trim();
backend\src\test\java\com\tracex\OpenApiExportTest.java:114:                "OpenAPI operations must match active /api/v1/** rows in permission-matrix.csv 1-to-1 without test-only endpoints");
backend\src\test\java\com\tracex\RbacMatrixTest.java:228:        return java.nio.file.Path.of("../docs/permission-matrix.csv");
backend\src\test\java\com\tracex\RouteCoverageTest.java:35:                .withFailMessage("docs/permission-matrix.csv could not be found")
backend\src\test\java\com\tracex\RouteCoverageTest.java:43:        // Parse phase, method, path from CSV lines
backend\src\test\java\com\tracex\RouteCoverageTest.java:118:        // Direction 1: Every mapped Spring endpoint must have a corresponding row in docs/permission-matrix.csv
backend\src\test\java\com\tracex\RouteCoverageTest.java:120:                .withFailMessage("The following mapped Spring endpoints have no corresponding entry in docs/permission-matrix.csv:\n" + String.join("\n", unmappedRoutes))
backend\src\test\java\com\tracex\RouteCoverageTest.java:135:                .withFailMessage("The following Phase <= 7 routes from permission-matrix.csv are not mapped in Spring Boot controllers:\n" + String.join("\n", missingPhaseLeq4Routes))
backend\src\test\java\com\tracex\RouteCoverageTest.java:146:            Path candidate = current.resolve("docs/permission-matrix.csv");
frontend\src\auth\permissions.generated.ts:3: * Source of truth: docs/permission-matrix.csv
frontend\src\auth\permissions.test.ts:24:describe('Generated UI Permissions from docs/permission-matrix.csv (Part C)', () => {
frontend\src\routes\navConfig.ts:24: * Permissions are derived directly from `src/auth/permissions.generated.ts` (`docs/permission-matrix.csv`).
=== Files modified in backend/src and frontend/src on 2026-10-06 after 13:20 ===
2026-10-06 13:29:24  backend\src\main\resources\application.properties
2026-10-06 13:29:32  backend\src\main\resources\application-dev.properties
2026-10-06 13:29:40  backend\src\test\resources\application-test.properties
2026-10-06 13:38:46  docs\progress\phase-07-1.md
2026-10-06 13:41:40  docs\00-audit\import-reference.md
2026-10-06 13:46:45  SPEC.md
2026-10-06 13:48:47  PROGRESS.md
```

**Confirmation**: Zero matches exist in `backend/src` or `frontend/src` for `ImportJob` or `ImportController`, and the only matches for `csv` are existing references to `docs/permission-matrix.csv`. No files changed in Phase 8.0 other than the markdown documentation/audit/progress files and the three backend `.properties` files (`application.properties`, `application-dev.properties`, `application-test.properties`) for Part 0 items 2 and 3.

---

## Verification 7: Static Checks, Markdown Table Linter, Unit Tests (`75`), and Playwright E2E (`37`)

### 7a. Frontend Static Checks (`typecheck`, `lint`, `check:banned`, `check:api-drift`)
Command:
```powershell
& {
  Write-Output "=== npm run typecheck ==="
  npm --prefix frontend run typecheck
  Write-Output "EXIT_CODE=$LASTEXITCODE"
  Write-Output "=== npm run lint ==="
  npm --prefix frontend run lint
  Write-Output "EXIT_CODE=$LASTEXITCODE"
  Write-Output "=== npm run check:banned ==="
  npm --prefix frontend run check:banned
  Write-Output "EXIT_CODE=$LASTEXITCODE"
  Write-Output "=== npm run check:api-drift ==="
  npm --prefix frontend run check:api-drift
  Write-Output "EXIT_CODE=$LASTEXITCODE"
} 2>&1 | Tee-Object -FilePath docs\progress\evidence\phase-08-0\static-checks.txt
```

Output (`docs/progress/evidence/phase-08-0/static-checks.txt`):
```text
=== npm run typecheck ===

> tracex-frontend@1.0.0 typecheck
> tsc --noEmit

EXIT_CODE=0
=== npm run lint ===

> tracex-frontend@1.0.0 lint
> eslint . --max-warnings=0

EXIT_CODE=0
=== npm run check:banned ===

> tracex-frontend@1.0.0 check:banned
> node scripts/check-banned-patterns.mjs

Banned pattern check PASSED: 0 violations found across src/, index.html, and design-assets/backdrops.json.
EXIT_CODE=0
=== npm run check:api-drift ===

> tracex-frontend@1.0.0 check:api-drift
> node scripts/check-api-drift.mjs

OpenAPI schema drift check PASSED (compare-only, zero file writes): src/api/generated/schema.d.ts and docs/openapi.json match backend/src/main/resources/openapi/tracex-api.yaml.
EXIT_CODE=0
```

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

### 7c. Frontend Unit Tests (`75 passed` across `13 files`)
Command:
```powershell
cmd /c "npm test -- --run 2>&1" | Tee-Object -FilePath ..\docs\progress\evidence\phase-08-0\frontend-unit.txt; Write-Output "VITEST_EXIT=$LASTEXITCODE"
```

Output (`docs/progress/evidence/phase-08-0/frontend-unit.txt` summary):
```text
 ✓ src/lib/dates.test.ts (2 tests) 10ms
 ✓ src/lib/logger.test.ts (4 tests) 16ms
 ✓ src/api/endpoints.test.ts (7 tests) 38ms
 ✓ src/auth/permissions.test.ts (5 tests) 23ms
 ✓ src/features/public/PublicPages.test.tsx (3 tests) 193ms
 ✓ src/features/fefo/FefoPage.test.tsx (3 tests) 416ms
 ✓ src/features/dashboard/DashboardPage.test.tsx (5 tests) 522ms
 ✓ src/components/ui/PageBackdrop.test.tsx (8 tests) 412ms
 ✓ src/features/inspections/InspectionsPage.test.tsx (5 tests) 632ms
 ✓ src/auth/auth.test.tsx (8 tests) 642ms
 ✓ src/components/ui/ui.test.tsx (10 tests) 749ms
 ✓ src/features/public/PublicTracePage.test.tsx (10 tests) 706ms
 ✓ src/features/batches/BatchDetailPage.test.tsx (5 tests) 1007ms

 Test Files  13 passed (13)
      Tests  75 passed (75)
   Start at  13:51:08
   Duration  3.58s (transform 1.69s, setup 3.46s, collect 9.46s, tests 5.85s, environment 9.90s, prepare 1.73s)

VITEST_EXIT=0
```

### 7d. Playwright E2E Suite (`37 passed` across `4 files`)
Command:
```powershell
cmd /c "npx playwright test 2>&1" | Tee-Object -FilePath ..\docs\progress\evidence\phase-08-0\playwright.txt; Write-Output "PLAYWRIGHT_EXIT=$LASTEXITCODE"
```

Output (`docs/progress/evidence/phase-08-0/playwright.txt` tail):
```text
  ok 29 [chromium] › e2e\phase07.spec.ts:178:3 › Phase 7 E2E Verification Suite (QR & Public Trace) › P7-E2E-01: factory-manager creates a batch, reads qrAbsoluteUrl, opens in logged-out context (no farmer name), scan count increases after reload (1.4s)
  ok 30 [chromium] › e2e\phase07.spec.ts:211:3 › Phase 7 E2E Verification Suite (QR & Public Trace) › P7-E2E-02: QR section renders image, Download PNG saves <batchCode>-qr.png, matches API data URL bytes (931ms)
  ok 31 [chromium] › e2e\phase07.spec.ts:242:3 › Phase 7 E2E Verification Suite (QR & Public Trace) › P7-E2E-03: archive batch as admin makes public link return 404, restore makes same link work again (528ms)
  ok 32 [chromium] › e2e\phase07.spec.ts:283:3 › Phase 7 E2E Verification Suite (QR & Public Trace) › P7-E2E-04: dispatch the batch, public page shows status DISPATCHED (384ms)
  ok 33 [chromium] › e2e\phase07.spec.ts:319:3 › Phase 7 E2E Verification Suite (QR & Public Trace) › P7-E2E-05: forged and malformed tokens and old /trace/:code show right states with no console errors (489ms)
[P7-E2E-06 TZ] Asia/Kolkata=Nov 20, 2026 America/Los_Angeles=Nov 20, 2026 identical=true
  ok 34 [chromium] › e2e\phase07.spec.ts:351:3 › Phase 7 E2E Verification Suite (QR & Public Trace) › P7-E2E-06: public trace page expiry date is identical in Asia/Kolkata and America/Los_Angeles contexts (601ms)
[P7-E2E-07 AXE] checked /trace/t/:token in 12 permutations (3 palettes x 2 modes x 2 image settings) + batch detail: zero violations
  ok 35 [chromium] › e2e\phase07.spec.ts:376:3 › Phase 7 E2E Verification Suite (QR & Public Trace) › P7-E2E-07: axe-core zero serious or critical violations on /trace/t/:token in light and dark across 3 palettes and images on/off, and batch detail with QR (7.3s)
[P7-E2E-08 VIEWPORTS] trace and batch detail at 375px, 768px, 1280px: all scrollWidth === clientWidth
  ok 36 [chromium] › e2e\phase07.spec.ts:429:3 › Phase 7 E2E Verification Suite (QR & Public Trace) › P7-E2E-08: 375px, 768px, and 1280px: scrollWidth equals clientWidth on trace page and batch detail; screenshots saved (1.4s)
[P7-E2E-09 NETWORK] traceRequests=1 scanRequests=1 authHeaderSent=false sessionStorageRead=false
  ok 37 [chromium] › e2e\phase07.spec.ts:476:3 › Phase 7 E2E Verification Suite (QR & Public Trace) › P7-E2E-09: network log shows exactly one trace GET and one scan POST; sessionStorage tx_token not read or sent (897ms)

  37 passed (3.4m)
PLAYWRIGHT_EXIT=0
```
