# Phase 6 Progress Log — Core Feature UI & Dashboard Summary Endpoint

> Status: **COMPLETE**
> Completed: 2026-10-06
> Scope: Screen map (`docs/06-ui/screen-map.md`), `GET /api/v1/dashboard/summary` (`D-21` `Proposed`), generated UI permission helpers (`src/auth/permissions.generated.ts`), core screens (Dashboard, Batches list, Create Batch, Batch Detail, Archived Batches, FEFO & Dispatch, Quality Inspections, Profile & Security), banned client-side freshness comparison rules, Vitest unit coverage (`>= 70%` statements), and Playwright E2E suite (`frontend/e2e/phase06.spec.ts`).

---

## Step 0: Confirm Phase 5.1 is COMPLETE in `PROGRESS.md`

```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX> Select-String -Path "PROGRESS.md" -Pattern "\| 5\.1 \|"
PROGRESS.md:25:| 5.1 | Per-page photo backdrops | COMPLETE | 2026-10-05 | [phase-05-1](docs/progress/phase-05-1.md) |
```

---

## Summary of Phase 6 Implementation (Parts A–F)

- **Part A (Screen Map & Specification Alignment)**:
  - Audited all 62 reference control rows in `docs/00-audit/feature-parity.md` and wrote `docs/06-ui/screen-map.md` mapping every dashboard, batches, FEFO, inspections, dispatch, archive/restore, and profile row to its Phase 6 page, endpoint, and unit/E2E test, and marking deferred rows with their target phase (`Phase 7`–`Phase 12`).
  - Added Decision `D-21` (`Proposed`) in `PROGRESS.md` and `SPEC.md` §6.3 for `GET /api/v1/dashboard/summary`, added the permission matrix row in `docs/permission-matrix.csv` (`phase=6`), regenerated OpenAPI (`backend/src/main/resources/openapi/tracex-api.yaml` and `docs/openapi.json`) and frontend schema (`frontend/src/api/generated/schema.d.ts`), and updated `OpenApiExportTest` and `RbacMatrixTest` to include `phase <= 6` (`42` active matrix rows, `41` `/api/v1/**` OpenAPI operations).
- **Part B (Backend — `GET /api/v1/dashboard/summary`)**:
  - Created `DashboardSummaryDto`, `DashboardService`, and `DashboardController` (`GET /api/v1/dashboard/summary`).
  - Computed `EXPIRED`, `URGENT`, `WARNING`, `READY`, and `EXCEPTION` counts using `BatchFreshness.applyStatusFilter` (zero duplicated freshness threshold logic), `dispatched` total, top 5 expiring batches via `FefoService.getFefoQueue`, latest-inspection verdict counts (`PASSED`, `FAILED`, `FLAGGED`, `none`), role-scoped `pendingAccessRequests` (`manager`, `admin`, and `super-admin` only; `null` for `factory-manager`, `quality-inspector`, and `dispatch-coordinator`), and `businessDate` (`LocalDate.now(clock)`).
  - Added `DashboardSummaryTests.java` (5 tests) plus 6 RBAC matrix tests for `GET /api/v1/dashboard/summary` (`412 + 11 = 423` backend tests).
- **Part C (Generated UI Permissions & Drift Check)**:
  - Created `frontend/scripts/generate-permissions.mjs` (`npm run gen:permissions`) generating `frontend/src/auth/permissions.generated.ts` from `docs/permission-matrix.csv`, and `frontend/scripts/check-permissions-drift.mjs` (`npm run check:permissions-drift`, compare-only with zero file writes).
- **Part D & Part E (Core Pages, Removal of Placeholder Routes, & Rules)**:
  - Implemented `DashboardPage.tsx` (`/` and `/dashboard`), `BatchesPage.tsx` (`/batches` and `/batches/new`), `CreateBatchDialog.tsx`, `BatchDetailPage.tsx` (`/batches/:id`), `ArchivedBatchesPage.tsx` (`/batches/archived`), `FefoPage.tsx` (`/fefo`), `DispatchDialog.tsx`, `InspectionsPage.tsx` (`/inspections`), and `ProfilePage.tsx` (`/profile` and `/settings`).
  - Removed placeholder `HomePage.tsx` and `RoleDemoPage.tsx` (`/admin-check`), updated `AppShell.tsx` navigation to use `canAccessNavRoute` from `permissions.generated.ts`, and passed `backdropKey` to `PageHeader` on every page.
  - Added Rule 16 in `frontend/scripts/check-banned-patterns.mjs` rejecting client-side comparisons on `daysUntilExpiry` and hardcoded `7` or `30` day freshness thresholds.

---

## Check 1: Backend `.\mvnw.cmd clean verify` (3 Consecutive Runs — 423 Tests)

```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX\backend> .\mvnw.cmd clean verify; Write-Host "RUN1_EXIT=$LASTEXITCODE"
...
[INFO] Results:
[INFO]
[INFO] Tests run: 423, Failures: 0, Errors: 0, Skipped: 0
[INFO]
[INFO] --- jar:3.3.0:jar (default-jar) @ tracex-backend ---
[INFO] Building jar: C:\Users\yashm\OneDrive\Desktop\TraceX\backend\target\tracex-backend-1.0.0-SNAPSHOT.jar
[INFO]
[INFO] --- spring-boot:3.2.5:repackage (repackage) @ tracex-backend ---
[INFO] Replacing main artifact C:\Users\yashm\OneDrive\Desktop\TraceX\backend\target\tracex-backend-1.0.0-SNAPSHOT.jar with repackaged archive, adding nested dependencies in BOOT-INF/.
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  01:00 min
[INFO] Finished at: 2026-10-06T08:47:27+05:30
[INFO] ------------------------------------------------------------------------
RUN1_EXIT=0
```

```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX\backend> .\mvnw.cmd clean verify; Write-Host "RUN2_EXIT=$LASTEXITCODE"
...
[INFO] Results:
[INFO]
[INFO] Tests run: 423, Failures: 0, Errors: 0, Skipped: 0
[INFO]
[INFO] --- jar:3.3.0:jar (default-jar) @ tracex-backend ---
[INFO] Building jar: C:\Users\yashm\OneDrive\Desktop\TraceX\backend\target\tracex-backend-1.0.0-SNAPSHOT.jar
[INFO]
[INFO] --- spring-boot:3.2.5:repackage (repackage) @ tracex-backend ---
[INFO] Replacing main artifact C:\Users\yashm\OneDrive\Desktop\TraceX\backend\target\tracex-backend-1.0.0-SNAPSHOT.jar with repackaged archive, adding nested dependencies in BOOT-INF/.
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  58.454 s
[INFO] Finished at: 2026-10-06T08:48:40+05:30
[INFO] ------------------------------------------------------------------------
RUN2_EXIT=0
```

```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX\backend> .\mvnw.cmd clean verify; Write-Host "RUN3_EXIT=$LASTEXITCODE"
...
[INFO] Results:
[INFO]
[INFO] Tests run: 423, Failures: 0, Errors: 0, Skipped: 0
[INFO]
[INFO] --- jar:3.3.0:jar (default-jar) @ tracex-backend ---
[INFO] Building jar: C:\Users\yashm\OneDrive\Desktop\TraceX\backend\target\tracex-backend-1.0.0-SNAPSHOT.jar
[INFO]
[INFO] --- spring-boot:3.2.5:repackage (repackage) @ tracex-backend ---
[INFO] Replacing main artifact C:\Users\yashm\OneDrive\Desktop\TraceX\backend\target\tracex-backend-1.0.0-SNAPSHOT.jar with repackaged archive, adding nested dependencies in BOOT-INF/.
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  57.869 s
[INFO] Finished at: 2026-10-06T08:51:52+05:30
[INFO] ------------------------------------------------------------------------
RUN3_EXIT=0
```

---

## Check 2: Frontend Static Checks (`typecheck`, `lint`, `check:banned`, `check:contrast`, `check:backdrops`, `check:permissions-drift`, `check:api-drift`)

```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> npm run typecheck; Write-Host "TYPECHECK_EXIT=$LASTEXITCODE"
PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> npm run lint; Write-Host "LINT_EXIT=$LASTEXITCODE"
PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> npm run check:banned; Write-Host "BANNED_EXIT=$LASTEXITCODE"
PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> npm run check:contrast; Write-Host "CONTRAST_EXIT=$LASTEXITCODE"
PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> npm run check:backdrops; Write-Host "BACKDROPS_EXIT=$LASTEXITCODE"
PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> npm run check:permissions-drift; Write-Host "PERMS_DRIFT_EXIT=$LASTEXITCODE"
PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> npm run check:api-drift; Write-Host "API_DRIFT_EXIT=$LASTEXITCODE"

> tracex-frontend@1.0.0 typecheck
> tsc --noEmit
TYPECHECK_EXIT=0

> tracex-frontend@1.0.0 lint
> eslint . --max-warnings 0
LINT_EXIT=0

> tracex-frontend@1.0.0 check:banned
> node scripts/check-banned-patterns.mjs
Banned pattern check PASSED: 0 violations found across src/, index.html, and design-assets/backdrops.json.
BANNED_EXIT=0

> tracex-frontend@1.0.0 check:contrast
> node scripts/check-contrast.mjs
Contrast check PASSED: all 198 token pairs (including worst-case backdrop scrim over #ffffff and #000000) meet WCAG 2.1 AA thresholds.
CONTRAST_EXIT=0

> tracex-frontend@1.0.0 check:backdrops
> node scripts/check-backdrops.mjs
Backdrop manifest check PASSED: 14 keys valid (14 placeholder warning(s) tracked under OI-11).
BACKDROPS_EXIT=0

> tracex-frontend@1.0.0 check:permissions-drift
> node scripts/check-permissions-drift.mjs
Permissions drift check PASSED (compare-only, zero file writes): src/auth/permissions.generated.ts matches docs/permission-matrix.csv.
PERMS_DRIFT_EXIT=0

> tracex-frontend@1.0.0 check:api-drift
> node scripts/check-api-drift.mjs
OpenAPI drift check PASSED (compare-only, zero file writes): docs/openapi.json and src/api/generated/schema.d.ts are in sync with backend/src/main/resources/openapi/tracex-api.yaml.
API_DRIFT_EXIT=0
```

---

## Check 3: Planted `daysUntilExpiry` Comparison Fails `npm run check:banned`, Reverts Cleanly

```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> $target = "src\features\dashboard\DashboardPage.tsx"
PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> $orig = [System.IO.File]::ReadAllText((Resolve-Path $target))
PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> [System.IO.File]::WriteAllText((Resolve-Path $target), $orig + "`nexport const __test_banned = (daysUntilExpiry: number) => daysUntilExpiry < 7;`n")
PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> npm run check:banned; Write-Host "BANNED_PLANTED_EXIT=$LASTEXITCODE"

> tracex-frontend@1.0.0 check:banned
> node scripts/check-banned-patterns.mjs

Banned pattern check FAILED with 2 violation(s):
  [VIOLATION] src/features/dashboard/DashboardPage.tsx:340 - Banned client-side comparison on 'daysUntilExpiry' (freshness and FEFO logic must come from the server)
  [VIOLATION] src/features/dashboard/DashboardPage.tsx:340 - Banned hardcoded 7 or 30 day freshness threshold comparison
BANNED_PLANTED_EXIT=1

PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> [System.IO.File]::WriteAllText((Resolve-Path $target), $orig)
PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> npm run check:banned; Write-Host "BANNED_RESTORED_EXIT=$LASTEXITCODE"

> tracex-frontend@1.0.0 check:banned
> node scripts/check-banned-patterns.mjs

Banned pattern check PASSED: 0 violations found across src/, index.html, and design-assets/backdrops.json.
BANNED_RESTORED_EXIT=0
```

---

## Check 4: Planted Edit in `src/auth/permissions.generated.ts` Fails `npm run check:permissions-drift`, Reverts Cleanly

```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> $permTarget = "src\auth\permissions.generated.ts"
PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> $permOrig = [System.IO.File]::ReadAllText((Resolve-Path $permTarget))
PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> [System.IO.File]::WriteAllText((Resolve-Path $permTarget), $permOrig + "`n// planted drift comment`n")
PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> npm run check:permissions-drift; Write-Host "PERMS_DRIFT_PLANTED_EXIT=$LASTEXITCODE"

> tracex-frontend@1.0.0 check:permissions-drift
> node scripts/check-permissions-drift.mjs

Permissions drift detected: src/auth/permissions.generated.ts does not match docs/permission-matrix.csv. Run `npm run gen:permissions` to synchronize.
PERMS_DRIFT_PLANTED_EXIT=1

PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> npm run gen:permissions; Write-Host "GEN_PERMS_EXIT=$LASTEXITCODE"

> tracex-frontend@1.0.0 gen:permissions
> node scripts/generate-permissions.mjs

Generated src/auth/permissions.generated.ts from docs/permission-matrix.csv (62 endpoint rules).
GEN_PERMS_EXIT=0

PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> npm run check:permissions-drift; Write-Host "PERMS_DRIFT_RESTORED_EXIT=$LASTEXITCODE"

> tracex-frontend@1.0.0 check:permissions-drift
> node scripts/check-permissions-drift.mjs

Permissions drift check PASSED (compare-only, zero file writes): src/auth/permissions.generated.ts matches docs/permission-matrix.csv.
PERMS_DRIFT_RESTORED_EXIT=0
```

---

## Check 5: Unit Test Suite & Coverage Report (`npm run test:coverage` — >= 70% Statements)

```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> npm run test:coverage; Write-Host "COVERAGE_EXIT=$LASTEXITCODE"

> tracex-frontend@1.0.0 test:coverage
> vitest run --coverage

 RUN  v3.1.2 C:/Users/yashm/OneDrive/Desktop/TraceX/frontend
      Coverage enabled with v8

 ✓ src/lib/dates.test.ts (5 tests) 26ms
 ✓ src/auth/permissions.test.ts (4 tests) 21ms
 ✓ src/api/client.test.ts (5 tests) 64ms
 ✓ src/components/ui/PageBackdrop.test.tsx (8 tests) 388ms
 ✓ src/features/batches/BatchDetailPage.test.tsx (2 tests) 595ms
 ✓ src/features/batches/BatchesPage.test.tsx (2 tests) 641ms
 ✓ src/features/fefo/FefoPage.test.tsx (3 tests) 695ms
 ✓ src/features/profile/InspectionsAndProfile.test.tsx (2 tests) 763ms
 ✓ src/features/dashboard/DashboardPage.test.tsx (5 tests) 816ms
 ✓ src/auth/auth.test.tsx (8 tests) 800ms
 ✓ src/components/ui/ui.test.tsx (10 tests) 974ms

 Test Files  11 passed (11)
      Tests  54 passed (54)
   Start at  09:14:52
   Duration  4.44s (transform 1.68s, setup 3.96s, collect 9.19s, tests 5.57s, environment 10.95s, prepare 1.63s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |    90.3 |    65.83 |   75.16 |    90.3 |                   
 api               |   95.87 |    76.31 |     100 |   95.87 |                   
  client.ts        |    90.9 |    72.91 |     100 |    90.9 | ...47,151,153-154 
  endpoints.ts     |     100 |    81.48 |     100 |     100 | 51,65,133,181,191 
  types.ts         |       0 |        0 |       0 |       0 |                   
 auth              |    90.6 |    87.35 |     100 |    90.6 |                   
  AuthContext.tsx  |   75.21 |    81.25 |     100 |   75.21 | ...18,122,151-152 
  RequireAuth.tsx  |     100 |    94.44 |     100 |     100 | 51                
  RequireRole.tsx  |   91.48 |       40 |     100 |   91.48 | 40-41,76-77       
  ....generated.ts |     100 |    97.14 |     100 |     100 | 110               
  tokenStore.ts    |   91.48 |    76.92 |     100 |   91.48 | 17-18,28,40       
 components/ui     |   95.74 |    73.44 |   84.09 |   95.74 |                   
  Button.tsx       |     100 |    66.66 |     100 |     100 | 22-31             
  Dialog.tsx       |   93.78 |    79.41 |   83.33 |   93.78 | ...4-56,89-92,120 
  ...rBoundary.tsx |   91.89 |    83.33 |      80 |   91.89 | 42-44             
  Field.tsx        |   94.36 |    89.74 |     100 |   94.36 | 60,64-65,170-174  
  PageBackdrop.tsx |     100 |       88 |     100 |     100 | 32,84,105         
  Spinner.tsx      |     100 |      100 |     100 |     100 |                   
  States.tsx       |   95.71 |    80.76 |      80 |   95.71 | ...10-115,192,276 
  StatusBadge.tsx  |     100 |       50 |     100 |     100 | 12                
  Table.tsx        |   93.02 |    73.91 |   66.66 |   93.02 | 41-46,63,65,81-84 
  Toast.tsx        |   92.75 |    53.33 |   66.66 |   92.75 | 36,53,68,98-99    
  statusMap.ts     |     100 |        0 |     100 |     100 | 37-128            
 features/auth     |   83.24 |    51.94 |   84.21 |   83.24 |                   
  ActivatePage.tsx |    87.5 |    45.45 |     100 |    87.5 | 66-76,86-88       
  ...swordPage.tsx |   85.71 |       75 |     100 |   85.71 | 43-53,92-94       
  LoginPage.tsx    |   85.71 |    69.23 |     100 |   85.71 | ...53,56-57,83-89 
  ...ccessPage.tsx |    92.1 |       50 |   66.66 |    92.1 | 57,67-68,79-85    
  ...swordPage.tsx |   84.92 |    47.61 |      80 |   84.92 | ...37-139,186-188 
  ...fyOtpPage.tsx |   67.34 |    33.33 |   66.66 |   67.34 | ...30-132,136-138 
 features/batches  |   87.75 |    59.92 |   60.63 |   87.75 |                   
  ...tchesPage.tsx |    87.3 |    57.14 |   76.92 |    87.3 | ...67,169-172,215 
  ...etailPage.tsx |   85.87 |    51.02 |   48.57 |   85.87 | ...46-647,679-685 
  BatchesPage.tsx  |   91.98 |    73.58 |   71.42 |   91.98 | ...16,318-326,353 
  ...tchDialog.tsx |   92.85 |    71.87 |      50 |   92.85 | ...27,142,188-194 
  ...tchDialog.tsx |   81.85 |    56.86 |   77.77 |   81.85 | ...31-236,270-275 
 ...ures/dashboard |   96.88 |     52.5 |     100 |   96.88 |                   
  ...boardPage.tsx |   96.88 |     52.5 |     100 |   96.88 | ...00,286-289,317 
 features/fefo     |   89.88 |    58.33 |   57.89 |   89.88 |                   
  FefoPage.tsx     |   89.88 |    58.33 |   57.89 |   89.88 | ...29,373,410-411 
 ...es/inspections |   93.03 |     59.8 |   64.86 |   93.03 |                   
  ...tionsPage.tsx |   93.03 |     59.8 |   64.86 |   93.03 | ...68,681-683,688 
 features/profile  |   84.61 |       48 |    64.7 |   84.61 |                   
  ProfilePage.tsx  |   84.61 |       48 |    64.7 |   84.61 | ...28-234,309-316 
 features/public   |     100 |       80 |     100 |     100 |                   
  PublicPages.tsx  |     100 |       80 |     100 |     100 | 32                
-------------------|---------|----------|---------|---------|-------------------
COVERAGE_EXIT=0
```

---

## Check 6: Full Playwright E2E Suite (`npx playwright test` — 28/28 Passing)

```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> npx playwright test; Write-Host "PLAYWRIGHT_EXIT=$LASTEXITCODE"

Running 28 tests using 1 worker

  ok 1  [chromium] › e2e\phase05-1.spec.ts:25:3 › P51-E2E-01 (Check 3): Styleguide renders all 14 backdrop keys in banner, side, and full variants in light and dark themes with zero broken images (7.8s)
  ok 2  [chromium] › e2e\phase05-1.spec.ts:71:3 › P51-E2E-02 (Check 4): Auth pages at 375px, 768px, and 1280px switch layout cleanly, have no horizontal scroll, and save screenshots with images on, images off, and images blocked (4.4s)
  ok 3  [chromium] › e2e\phase05-1.spec.ts:218:3 › P51-E2E-03 (Check 5): axe-core passes with zero serious or critical violations on auth pages, home page, public trace page, and styleguide in both themes with images on and off (28.3s)
  ok 4  [chromium] › e2e\phase05-1.spec.ts:290:3 › P51-E2E-04 (Check 6): With image requests blocked, auth pages and the home page render on the flat fallback with identical element heights (zero layout shift) (3.7s)
  ok 5  [chromium] › e2e\phase05-1.spec.ts:420:3 › P51-E2E-05 (Check 7): Turning showPageImages off in user menu or styleguide removes all picture/img elements, makes zero image requests on navigation, and survives reload (1.8s)
  ok 6  [chromium] › e2e\phase05-1.spec.ts:491:3 › P51-E2E-06 (Check 8): Sending Save-Data: on header makes zero backdrop image requests (649ms)
  ok 7  [chromium] › e2e\phase05-1.spec.ts:531:3 › P51-E2E-07 (Check 9): /login fresh load transfers <= 300 KB of backdrop image bytes (for auth only) and requests no other key (1.5s)
  ok 8  [chromium] › e2e\phase05.spec.ts:93:3 › E2E-01 (Check 5 & Check 13): Login for all six seeded accounts (five roles plus super-admin) and verify sessionStorage tx_token and console hygiene (2.9s)
  ok 9  [chromium] › e2e\phase05.spec.ts:156:3 › E2E-02 (Check 5): Login failure with wrong password displays the server error message (434ms)
  ok 10 [chromium] › e2e\phase05.spec.ts:166:3 › E2E-03 (Check 6): Full invite onboarding flow (request access, approve via API, read invite from dev mail sink, activate, read OTP, verify, land signed in) (1.5s)
  ok 11 [chromium] › e2e\phase05.spec.ts:230:3 › E2E-04 (Check 6): Forgot and reset password flow end-to-end in browser (2.1s)
  ok 12 [chromium] › e2e\phase05.spec.ts:305:3 › E2E-05 (Check 7 & Check 13): 401 mid-session through logout-all in another context clears tx_token, redirects to /login?next=..., returns on sign-in, and blocks external ?next= open redirects (1.3s)
  ok 13 [chromium] › e2e\phase05.spec.ts:372:3 › E2E-06 (Check 7): Deactivated user login displays the deactivated account message (450ms)
  ok 14 [chromium] › e2e\phase05.spec.ts:404:3 › E2E-07 (Check 7): Lower role on restricted route (/batches/archived) sees the 403 forbidden state (623ms)
  ok 15 [chromium] › e2e\phase05.spec.ts:419:3 › E2E-08 (Check 7): Offline banner appears when the real backend is stopped and recovers when restarted (11.0s)
  ok 16 [chromium] › e2e\phase05.spec.ts:441:3 › E2E-09 (Check 8 & Check 9): Keyboard-only login, skip link, dialog focus trap/Escape/restore, theme toggle, and reduced-motion 0s durations (952ms)
  ok 17 [chromium] › e2e\phase05.spec.ts:522:3 › E2E-10 (Check 10 & Check 14): axe-core accessibility scan on every route in light and dark for all three palettes, plus runtime switching and reload persistence (32.4s)
  ok 18 [chromium] › e2e\phase05.spec.ts:612:3 › E2E-11 (Check 11): Responsive viewports (375px, 768px, 1280px) scrollWidth and clientWidth measurements on every route, adaptive navigation, and all 36 route screenshots (8.6s)
  ok 19 [chromium] › e2e\phase06.spec.ts:132:3 › P6-E2E-01: Dashboard metrics match server summary and clicking a tier card filters the batch list (1.1s)
  ok 20 [chromium] › e2e\phase06.spec.ts:206:3 › P6-E2E-02: Create a batch as factory-manager, see generated batchCode, add a note, and edit raw material (1.9s)
  ok 21 [chromium] › e2e\phase06.spec.ts:267:3 › P6-E2E-03: Quality inspector 422 PASSED-with-fail check, PASSED badge, FAILED quality hold block, and FLAGGED dispatch warning (3.4s)
  ok 22 [chromium] › e2e\phase06.spec.ts:359:3 › P6-E2E-04: FEFO dispatch in order succeeds; out-of-order without overrideReason is blocked and shows earlier batchCode; out-of-order with overrideReason succeeds; expired batch is blocked with BATCH_EXPIRED (1.7s)
  ok 23 [chromium] › e2e\phase06.spec.ts:425:3 › P6-E2E-05: Archive and restore as admin; non-admin sees no archive button and gets 403 on archived route; dispatch-coordinator sees no create-batch or inspect controls (2.7s)
  ok 24 [chromium] › e2e\phase06.spec.ts:480:3 › P6-E2E-06: Edit profile and change password, keeping the session signed in via rotated token (1.9s)
  ok 25 [chromium] › e2e\phase06.spec.ts:518:3 › P6-E2E-07 (Check 8): Two Playwright contexts with Asia/Kolkata and America/Los_Angeles show the exact same expiry date string for the same batch (1.5s)
  ok 26 [chromium] › e2e\phase06.spec.ts:573:3 › P6-E2E-08 (Check 9): Delayed and failed response test proves no success toast appears before server confirmation (1.2s)
  ok 27 [chromium] › e2e\phase06.spec.ts:666:3 › P6-E2E-09: axe-core accessibility scan on every Phase 6 route in light and dark modes (17.5s)
  ok 28 [chromium] › e2e\phase06.spec.ts:718:3 › P6-E2E-10: 375px mobile viewport measurements and screenshots in docs/screenshots/phase-06/ (2.4s)

  28 passed (3.1m)
PLAYWRIGHT_EXIT=0
```

### Phase 6 axe-core & 375px Mobile Viewport Output (`P6-E2E-09` & `P6-E2E-10`)

```text
[P6-E2E-09 AXE] route=/ mode=light -> violations=0 seriousOrCritical=0
[P6-E2E-09 AXE] route=/ mode=dark -> violations=0 seriousOrCritical=0
[P6-E2E-09 AXE] route=/dashboard mode=light -> violations=0 seriousOrCritical=0
[P6-E2E-09 AXE] route=/dashboard mode=dark -> violations=0 seriousOrCritical=0
[P6-E2E-09 AXE] route=/batches mode=light -> violations=0 seriousOrCritical=0
[P6-E2E-09 AXE] route=/batches mode=dark -> violations=0 seriousOrCritical=0
[P6-E2E-09 AXE] route=/batches/new mode=light -> violations=0 seriousOrCritical=0
[P6-E2E-09 AXE] route=/batches/new mode=dark -> violations=0 seriousOrCritical=0
[P6-E2E-09 AXE] route=/batches/6ac38b2bf9d77e3e83e916aa mode=light -> violations=0 seriousOrCritical=0
[P6-E2E-09 AXE] route=/batches/6ac38b2bf9d77e3e83e916aa mode=dark -> violations=0 seriousOrCritical=0
[P6-E2E-09 AXE] route=/batches/archived mode=light -> violations=0 seriousOrCritical=0
[P6-E2E-09 AXE] route=/batches/archived mode=dark -> violations=0 seriousOrCritical=0
[P6-E2E-09 AXE] route=/fefo mode=light -> violations=0 seriousOrCritical=0
[P6-E2E-09 AXE] route=/fefo mode=dark -> violations=0 seriousOrCritical=0
[P6-E2E-09 AXE] route=/inspections mode=light -> violations=0 seriousOrCritical=0
[P6-E2E-09 AXE] route=/inspections mode=dark -> violations=0 seriousOrCritical=0
[P6-E2E-09 AXE] route=/profile mode=light -> violations=0 seriousOrCritical=0
[P6-E2E-09 AXE] route=/profile mode=dark -> violations=0 seriousOrCritical=0
[P6-E2E-09 AXE] route=/settings mode=light -> violations=0 seriousOrCritical=0
[P6-E2E-09 AXE] route=/settings mode=dark -> violations=0 seriousOrCritical=0
[P6-E2E-10 375px] route=/dashboard -> scrollWidth=375 clientWidth=375 file=01-dashboard-375.png
[P6-E2E-10 375px] route=/batches -> scrollWidth=375 clientWidth=375 file=02-batches-list-375.png
[P6-E2E-10 375px] route=/batches/new -> scrollWidth=375 clientWidth=375 file=03-batches-create-375.png
[P6-E2E-10 375px] route=/batches/6ac38b2bf9d77e3e83e916aa -> scrollWidth=375 clientWidth=375 file=04-batch-detail-375.png
[P6-E2E-10 375px] route=/batches/archived -> scrollWidth=375 clientWidth=375 file=05-batches-archived-375.png
[P6-E2E-10 375px] route=/fefo -> scrollWidth=375 clientWidth=375 file=06-fefo-queue-375.png
[P6-E2E-10 375px] route=/inspections -> scrollWidth=375 clientWidth=375 file=07-inspections-375.png
[P6-E2E-10 375px] route=/profile -> scrollWidth=375 clientWidth=375 file=08-profile-375.png
```

---

## Check 7: Production Build with `VITE_API_BASE_URL=https://api.tracex.example.com` and `dist/` Search for `localhost` / `127.0.0.1`

```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> $env:VITE_API_BASE_URL="https://api.tracex.example.com"
PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> npm run build; Write-Host "BUILD_EXIT=$LASTEXITCODE"
PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> $matches = Get-ChildItem -Path "dist" -Recurse -File | Select-String -Pattern "localhost|127\.0\.0\.1"
PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> Write-Host "DIST_LOCALHOST_MATCH_COUNT=$($matches.Count)"

> tracex-frontend@1.0.0 build
> tsc -b && vite build

vite v6.3.3 building for production...
transforming...
✓ 1723 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                 0.85 kB │ gzip:   0.47 kB
dist/assets/index-BUWyvBVt.css                 37.45 kB │ gzip:   6.85 kB
dist/assets/index-Dw9oWHvf.js                 478.67 kB │ gzip: 133.57 kB
✓ built in 8.89s
BUILD_EXIT=0
DIST_LOCALHOST_MATCH_COUNT=0
```

---

## Check 8: Timezone Comparison Test Output (`Asia/Kolkata` vs `America/Los_Angeles`)

```text
[P6-E2E-07 TZ] batch=TX-2026-10-001 Asia/Kolkata={listExpiry:Oct 1, 2026, detailExpiry:Oct 1, 2026, detailPack:Mar 20, 2026} America/Los_Angeles={listExpiry:Oct 1, 2026, detailExpiry:Oct 1, 2026, detailPack:Mar 20, 2026}
  ok 25 [chromium] › e2e\phase06.spec.ts:518:3 › Phase 6 E2E Verification Suite (Core Feature UI & Checks 6, 8, 9) › P6-E2E-07 (Check 8): Two Playwright contexts with Asia/Kolkata and America/Los_Angeles show the exact same expiry date string for the same batch (1.5s)
```

---

## Check 9: Delayed and Failed Response Test Output (`P6-E2E-08`)

```text
[P6-E2E-08 IN_FLIGHT_BEFORE_FAIL] submitDisabled=true, successToastCount=0, createdBannerCount=0
[P6-E2E-08 AFTER_500_FAIL] errorBannerVisible=true, successToastCount=0
[P6-E2E-08 IN_FLIGHT_BEFORE_SUCCESS] submitDisabled=true, successToastCount=0, createdBannerCount=0
[P6-E2E-08 AFTER_201_SUCCESS] createdBannerVisible=true, successToastVisible=true
  ok 26 [chromium] › e2e\phase06.spec.ts:573:3 › Phase 6 E2E Verification Suite (Core Feature UI & Checks 6, 8, 9) › P6-E2E-08 (Check 9): Delayed and failed response test proves no success toast appears before server confirmation (1.2s)
```

---

## Check 10: Updated `docs/00-audit/feature-parity.md`, `docs/traceability.md`, and `scripts/lint-md-tables.ps1`

```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX> powershell -NoProfile -ExecutionPolicy Bypass -File scripts/lint-md-tables.ps1; Write-Host "MD_LINT_EXIT=$LASTEXITCODE"
=== Markdown Table Linter ===
Scanning 30 Markdown files...


=== Summary ===
Files checked: 30
Errors: 0
Warnings: 0
STATUS: PASSED (Zero problems found)
MD_LINT_EXIT=0
```
