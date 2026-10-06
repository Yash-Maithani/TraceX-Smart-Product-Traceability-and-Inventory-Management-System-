# Phase 5.0 — Verification and Repair Pass (`E1`–`E8`)

> Completed: 2026-10-05
> Status: COMPLETE

---

## E1 — Tests and 16-Check Coverage Map

### 1. Frontend Unit & Component Test Totals (`npm test`)

Total unit/component tests: **25 tests across 3 files**:
- `src/lib/dates.test.ts`: **7 tests**
- `src/auth/auth.test.tsx`: **8 tests**
- `src/components/ui/ui.test.tsx`: **10 tests**

Command:

```powershell
npx vitest run --reporter=verbose
```

Real output:

```text
 RUN  v3.1.2 C:/Users/yashm/OneDrive/Desktop/TraceX/frontend

 ✓ src/lib/dates.test.ts > src/lib/dates.ts — Business Date & Timestamp Formatting (D-17, Part A) > validates canonical YYYY-MM-DD calendar strings and rejects invalid dates 2ms
 ✓ src/lib/dates.test.ts > src/lib/dates.ts — Business Date & Timestamp Formatting (D-17, Part A) > parses YYYY-MM-DD parts purely lexically without Date instantiation 1ms
 ✓ src/lib/dates.test.ts > src/lib/dates.ts — Business Date & Timestamp Formatting (D-17, Part A) > formats business date "2026-10-09" identically when process.env.TZ = UTC 0ms
 ✓ src/lib/dates.test.ts > src/lib/dates.ts — Business Date & Timestamp Formatting (D-17, Part A) > formats business date "2026-10-09" identically when process.env.TZ = Asia/Kolkata 0ms
 ✓ src/lib/dates.test.ts > src/lib/dates.ts — Business Date & Timestamp Formatting (D-17, Part A) > formats business date "2026-10-09" identically when process.env.TZ = America/Los_Angeles 0ms
 ✓ src/lib/dates.test.ts > src/lib/dates.ts — Business Date & Timestamp Formatting (D-17, Part A) > returns fallback for missing or corrupted business dates 0ms
 ✓ src/lib/dates.test.ts > src/lib/dates.ts — Business Date & Timestamp Formatting (D-17, Part A) > formats ISO timestamps and handles missing/invalid values gracefully 19ms
 ✓ src/auth/auth.test.tsx > API Client, Token Store, Route Guards, and Auth Screens (Part D) > stores JWT exclusively in sessionStorage under tx_token and never in localStorage or cookies 10ms
 ✓ src/auth/auth.test.tsx > API Client, Token Store, Route Guards, and Auth Screens (Part D) > sanitizes ?next= redirect paths and blocks external or protocol-relative URLs 1ms
 ✓ src/auth/auth.test.tsx > API Client, Token Store, Route Guards, and Auth Screens (Part D) > attaches Authorization header, parses envelope, and maps 401, 403, 429, and network errors 12ms
 ✓ src/auth/auth.test.tsx > API Client, Token Store, Route Guards, and Auth Screens (Part D) > redirects unauthenticated users to /login?next=... and renders ForbiddenState for insufficient role 197ms
 ✓ src/auth/auth.test.tsx > API Client, Token Store, Route Guards, and Auth Screens (Part D) > validates LoginPage inputs and displays server error message on invalid credentials 137ms
 ✓ src/auth/auth.test.tsx > API Client, Token Store, Route Guards, and Auth Screens (Part D) > validates RequestAccessPage and displays server field errors under matching fields 52ms
 ✓ src/auth/auth.test.tsx > API Client, Token Store, Route Guards, and Auth Screens (Part D) > validates ActivatePage password policy (min 8 chars + match) and VerifyOtpPage 6-digit OTP 94ms
 ✓ src/auth/auth.test.tsx > API Client, Token Store, Route Guards, and Auth Screens (Part D) > validates ForgotPasswordPage and ResetPasswordPage two-step reset flow 87ms
 ✓ src/components/ui/ui.test.tsx > Design System UI Components & Accessibility (Part B & Part C) > renders Button variants, disabled state, and loading state with aria-busy 177ms
 ✓ src/components/ui/ui.test.tsx > Design System UI Components & Accessibility (Part B & Part C) > links Field label, hint, and error message via aria-describedby and toggles PasswordInput 127ms
 ✓ src/components/ui/ui.test.tsx > Design System UI Components & Accessibility (Part B & Part C) > renders every StatusBadge status with both an SVG icon and visible text label 114ms
 ✓ src/components/ui/ui.test.tsx > Design System UI Components & Accessibility (Part B & Part C) > renders Table with caption, sorting, loading, empty state, and Pagination 59ms
 ✓ src/components/ui/ui.test.tsx > Design System UI Components & Accessibility (Part B & Part C) > traps focus inside Dialog, closes on Escape, and restores focus to trigger 28ms
 ✓ src/components/ui/ui.test.tsx > Design System UI Components & Accessibility (Part B & Part C) > enforces mandatory reason in ConfirmDialog when requireReason is true 20ms
 ✓ src/components/ui/ui.test.tsx > Design System UI Components & Accessibility (Part B & Part C) > renders Toast notifications, shared states, ThemeToggle, SkipLink, and ErrorBoundary 118ms
 ✓ src/components/ui/ui.test.tsx > Design System UI Components & Accessibility (Part B & Part C) > catches rendering errors in ErrorBoundary 31ms
 ✓ src/components/ui/ui.test.tsx > Design System UI Components & Accessibility (Part B & Part C) > redacts tokens, passwords, OTPs, and authorization headers in logger 1ms
 ✓ src/components/ui/ui.test.tsx > Design System UI Components & Accessibility (Part B & Part C) > detects planted violations in scanDirectoryForBannedPatterns 7ms

 Test Files  3 passed (3)
      Tests  25 passed (25)
   Start at  17:07:28
   Duration  20.64s (transform 1.41s, setup 11.21s, collect 8.21s, tests 1.30s, environment 33.84s, prepare 956ms)
```

---

### 2. Playwright E2E Test Inventory (`frontend/e2e/phase05.spec.ts` — 11 Tests)

| ID | Playwright Test Name | What It Asserts |
|---|---|---|
| E2E-01 | E2E-01 (Check 5 & Check 13): Login for all six seeded accounts (five roles plus super-admin) and verify sessionStorage tx_token and console hygiene | Signs in through the UI as superadmin, admin, manager, factory_mgr, inspector, and coordinator; verifies user name and role label in AppShell, confirms JWT is stored only in sessionStorage under tx_token (never localStorage or cookies) and never printed to console, and confirms logout clears tx_token. |
| E2E-02 | E2E-02 (Check 5): Login failure with wrong password displays the server error message | Submits an invalid password for superadmin on /login and asserts the error banner displays Invalid username or password. |
| E2E-03 | E2E-03 (Check 6): Full invite onboarding flow (request access, approve via API, read invite from dev mail sink, activate, read OTP, verify, land signed in) | Submits /request-access in the browser, approves as superadmin via API, reads the invite token from backend/target/dev-mail, activates password on /activate, reads the 6-digit OTP from backend/target/dev-mail, verifies on /verify-otp, lands signed in on / with the expected name and role, signs out, and logs back in with the new credentials. |
| E2E-04 | E2E-04 (Check 6): Forgot and reset password flow end-to-end in browser | Requests a password reset on /forgot-password, reads the reset OTP from backend/target/dev-mail, verifies the OTP and sets a new password on /reset-password, and signs in on /login with the new password. |
| E2E-05 | E2E-05 (Check 7 & Check 13): 401 mid-session through logout-all in another context clears tx_token, redirects to /login?next=..., returns on sign-in, and blocks external ?next= open redirects | Logs in as superadmin, visits /admin-check, revokes the session via POST /api/v1/auth/me/logout-all from an external fetch context, triggers an authenticated request, verifies tx_token is cleared and browser redirects to /login?next=%2Fadmin-check with the session-expired banner, signs back in to land on /admin-check, and verifies /login?next=https%3A%2F%2Fevil.example%2Fphish redirects safely to /. |
| E2E-06 | E2E-06 (Check 7): Deactivated user login displays the deactivated account message | Deactivates coordinator via PATCH /api/v1/auth/users/{id}/toggle, attempts login in the browser, asserts the deactivated account message is displayed, and restores active status in finally. |
| E2E-07 | E2E-07 (Check 7): Lower role on restricted route (/admin-check) sees the 403 forbidden state | Logs in as inspector (quality-inspector), navigates to /admin-check, and asserts the 403 ForbiddenState component is rendered without signing the user out. |
| E2E-08 | E2E-08 (Check 7): Offline banner appears when the real backend is stopped and recovers when restarted | Stops the real E2E backend process on port 8083, triggers an API check in the browser to assert the offline banner appears, restarts the E2E backend, clicks retry, and asserts the offline banner disappears. |
| E2E-09 | E2E-09 (Check 8 & Check 9): Keyboard-only login, skip link, dialog focus trap/Escape/restore, theme toggle, and reduced-motion 0s durations | Uses only Tab, Shift+Tab, Enter, and Escape to activate SkipLink, sign in on /login, open and trap focus inside Dialog, close with Escape and restore focus to the trigger, toggle theme, and emulates prefers-reduced-motion: reduce to assert transitionDuration and animationDuration are 0s. |
| E2E-10 | E2E-10 (Check 10 & Check 14): axe-core accessibility scan on every route in light and dark for all three palettes, plus runtime switching and reload persistence | Verifies prefers-color-scheme default when localStorage is empty, verifies runtime switching and reload persistence of data-palette and data-theme, and runs axe-core across all 12 routes in all 3 palettes (editorial, obsidian, emerald) and both modes (light, dark), asserting zero serious or critical violations. |
| E2E-11 | E2E-11 (Check 11): Responsive viewports (375px, 768px, 1280px) scrollWidth and clientWidth measurements on every route, adaptive navigation, and all 36 route screenshots | Measures scrollWidth and clientWidth at 375px, 768px, and 1280px across all 12 routes, asserts scrollWidth <= clientWidth everywhere, verifies desktop sidebar (>=1024px) vs mobile drawer (<1024px), and saves all 36 route-viewport screenshots to docs/screenshots/phase-05/. |

---

### 3. Mapping of All 16 Phase 5 Verification Checks

| Check | Requirement Summary | Verification Test / Command |
|---|---|---|
| Check 1 | Part A0 backend tests and full backend suite green across repeated runs | ProductAndBatchTests, InspectionAndDispatchTests, GlobalSafetyGuardAutoDetectionTest, and 3x mvnw.cmd clean verify (409 tests, 0 failures) |
| Check 2 | Clean install, lint, typecheck, unit tests, and production build succeed | npm ci, npm run lint, npm run typecheck, npm test (25/25 pass), npm run build |
| Check 3 | Banned-pattern check passes, fails on planted violation, passes when restored | npm run check:banned + ui.test.tsx (detects planted violations in scanDirectoryForBannedPatterns) |
| Check 4 | OpenAPI drift check passes and fails when a copy differs | npm run check:api-drift + OpenApiExportTest |
| Check 5 | Seeded roles plus super-admin log in with right name/role; wrong password shows server message | Playwright E2E-01 (6 seeded accounts) and E2E-02 (wrong password error) |
| Check 6 | Full invite flow in browser (request access, approve via API, read dev mail, activate, read OTP, verify, sign in) and forgot/reset password | Playwright E2E-03 (full invite onboarding) and E2E-04 (forgot/reset password) |
| Check 7 | 401 mid-session redirect with return path, open-redirect block, deactivated user message, 403 forbidden state, and offline banner recovery | Playwright E2E-05 (401 + open redirect), E2E-06 (deactivated user), E2E-07 (403 forbidden state), and E2E-08 (offline banner + recovery) |
| Check 8 | Keyboard-only flow (login, skip link, navigation, dialog trap/Escape/restore, theme toggle) with visible focus | Playwright E2E-09 + ui.test.tsx dialog focus trap test |
| Check 9 | Emulating prefers-reduced-motion: reduce sets transition/animation durations to 0s | Playwright E2E-09 (computed style durations equal 0s) |
| Check 10 | axe-core reports zero serious/critical violations on every route and styleguide in light and dark across all three palettes | Playwright E2E-10 (12 routes x 3 palettes x 2 modes = 72 scans, 0 violations) + npm run check:contrast (138/138 pairs pass) |
| Check 11 | Responsive layout at 375px, 768px, and 1280px with zero horizontal overflow, adaptive navigation, and saved screenshots | Playwright E2E-11 (36 route-viewport measurements + 36 screenshots in docs/screenshots/phase-05/) |
| Check 12 | Production build fails without VITE_API_BASE_URL or with http://, succeeds with https://, and dist/ has no localhost/styleguide/inline script and includes CSP meta | E6 build verification script + vite.config.ts production guard |
| Check 13 | Token exists only in sessionStorage under tx_token, cleared on logout and 401, and never printed by logger | Playwright E2E-01 & E2E-05 + auth.test.tsx + ui.test.tsx (logger redaction test) |
| Check 14 | Theme and palette switch at runtime, persist across reload, and default to system setting when localStorage is empty | Playwright E2E-10 |
| Check 15 | Business date "2026-10-09" renders identically across UTC, Asia/Kolkata, and America/Los_Angeles | src/lib/dates.test.ts (TZ=UTC, Asia/Kolkata, America/Los_Angeles) |
| Check 16 | PROGRESS.md and SPEC.md updated and scripts/lint-md-tables.ps1 passes | scripts/lint-md-tables.ps1 (0 errors across all markdown files) |

---

### 4. Real Playwright E2E Suite Output (`scripts/e2e-reset.ps1` + `npm run e2e`)

Command:

```powershell
powershell -ExecutionPolicy Bypass -File "..\scripts\e2e-reset.ps1"; npm run e2e
```

Real output:

```text
Resetting E2E database 'tracex_fresh_e2e' at mongodb://localhost:27017/tracex_fresh_e2e ...
Successfully dropped E2E database 'tracex_fresh_e2e'.

> tracex-frontend@1.0.0 e2e
> playwright test


Running 11 tests using 1 worker

[E2E-01] Signed in as superadmin -> name="[DEMO] Super Administrator", role="Administrator", sessionStorage.keys=["tx_token"], localStorage.tx_token=null, cookie=""
[E2E-01] Signed in as admin -> name="[DEMO] Staff Administrator", role="Administrator", sessionStorage.keys=["tx_token"], localStorage.tx_token=null, cookie=""
[E2E-01] Signed in as manager -> name="[DEMO] Operations Manager", role="Manager", sessionStorage.keys=["tx_token"], localStorage.tx_token=null, cookie=""
[E2E-01] Signed in as factory_mgr -> name="[DEMO] Factory Manager", role="Factory Manager", sessionStorage.keys=["tx_token"], localStorage.tx_token=null, cookie=""
[E2E-01] Signed in as inspector -> name="[DEMO] Quality Inspector", role="Quality Inspector", sessionStorage.keys=["tx_token"], localStorage.tx_token=null, cookie=""
[E2E-01] Signed in as coordinator -> name="[DEMO] Dispatch Coordinator", role="Dispatch Coordinator", sessionStorage.keys=["tx_token"], localStorage.tx_token=null, cookie=""
  ok 1 [chromium] › e2e\phase05.spec.ts:93:3 › Phase 5 E2E Verification Suite (E1–E6 / Checks 5–14) › E2E-01 (Check 5 & Check 13): Login for all six seeded accounts (five roles plus super-admin) and verify sessionStorage tx_token and console hygiene (5.3s)
  ok 2 [chromium] › e2e\phase05.spec.ts:139:3 › Phase 5 E2E Verification Suite (E1–E6 / Checks 5–14) › E2E-02 (Check 5): Login failure with wrong password displays the server error message (475ms)
  ok 3 [chromium] › e2e\phase05.spec.ts:149:3 › Phase 5 E2E Verification Suite (E1–E6 / Checks 5–14) › E2E-03 (Check 6): Full invite onboarding flow (request access, approve via API, read invite from dev mail sink, activate, read OTP, verify, land signed in) (1.4s)
  ok 4 [chromium] › e2e\phase05.spec.ts:213:3 › Phase 5 E2E Verification Suite (E1–E6 / Checks 5–14) › E2E-04 (Check 6): Forgot and reset password flow end-to-end in browser (2.0s)
  ok 5 [chromium] › e2e\phase05.spec.ts:288:3 › Phase 5 E2E Verification Suite (E1–E6 / Checks 5–14) › E2E-05 (Check 7 & Check 13): 401 mid-session through logout-all in another context clears tx_token, redirects to /login?next=..., returns on sign-in, and blocks external ?next= open redirects (1.2s)
  ok 6 [chromium] › e2e\phase05.spec.ts:333:3 › Phase 5 E2E Verification Suite (E1–E6 / Checks 5–14) › E2E-06 (Check 7): Deactivated user login displays the deactivated account message (439ms)
  ok 7 [chromium] › e2e\phase05.spec.ts:365:3 › Phase 5 E2E Verification Suite (E1–E6 / Checks 5–14) › E2E-07 (Check 7): Lower role on restricted route (/admin-check) sees the 403 forbidden state (555ms)
  ok 8 [chromium] › e2e\phase05.spec.ts:380:3 › Phase 5 E2E Verification Suite (E1–E6 / Checks 5–14) › E2E-08 (Check 7): Offline banner appears when the real backend is stopped and recovers when restarted (10.5s)
[E2E-09] Reduced motion computed durations -> {"btnTransition":"0s","btnAnimation":"0s","navTransition":"0s","navAnimation":"0s"}
  ok 9 [chromium] › e2e\phase05.spec.ts:402:3 › Phase 5 E2E Verification Suite (E1–E6 / Checks 5–14) › E2E-09 (Check 8 & Check 9): Keyboard-only login, skip link, dialog focus trap/Escape/restore, theme toggle, and reduced-motion 0s durations (882ms)
  ok 10 [chromium] › e2e\phase05.spec.ts:483:3 › Phase 5 E2E Verification Suite (E1–E6 / Checks 5–14) › E2E-10 (Check 10 & Check 14): axe-core accessibility scan on every route in light and dark for all three palettes, plus runtime switching and reload persistence (30.4s)
  ok 11 [chromium] › e2e\phase05.spec.ts:573:3 › Phase 5 E2E Verification Suite (E1–E6 / Checks 5–14) › E2E-11 (Check 11): Responsive viewports (375px, 768px, 1280px) scrollWidth and clientWidth measurements on every route, adaptive navigation, and screenshots (4.9s)

  11 passed (1.2m)
```

---

## E2 — Backend Regression Tests for Part A0 (`A0-1`, `A0-2`, `A0-3`, `A0-4`) and New Test Count

### 1. Summary of Part A0 Regression Tests and Test Count Progression

Backend test count progression:
- **Phase 4.2**: `404` tests
- **Phase 5**: `405` tests (`+1`: `InspectionAndDispatchTests#testDispatchDateRoundTripAcrossTimeZones`)
- **Phase 5.0**: **`409` tests** (`+4` new tests added in Phase 5.0:
  1. `ProductAndBatchTests#testA01CorruptedExpiryMissingNullAndNotADateAgainstAllFiveFiltersAndFefo`
  2. `ProductAndBatchTests#testImpossibleCalendarDatesNeverMatchTierFiltersAndRouteToException`
  3. `InspectionAndDispatchTests#testDispatchHistoryDispatchDateAcrossThreeTimeZones`
  4. `GlobalSafetyGuardAutoDetectionTest#testClockGuardRejectsLeakedClockAndAcceptsRealTimeClock`)

Detailed coverage of each Part A0 regression test:
- **A0-1 (`ProductAndBatchTests#testA01CorruptedExpiryMissingNullAndNotADateAgainstAllFiveFiltersAndFefo`)**: Inserts all three corrupted-expiry batch forms directly into MongoDB (`TX-A01-MISSING` with omitted `expiryDate`, `TX-A01-NULL` with `expiryDate: null`, and `TX-A01-NOTADATE` with `expiryDate: "not-a-date"`), then queries all five status filters (`GET /api/v1/batches?status=EXPIRED`, `URGENT`, `WARNING`, `READY`, and `EXCEPTION`) plus `GET /api/v1/dispatch/fefo`. Asserts that `EXPIRED`, `URGENT`, `WARNING`, and `READY` exclude all three corrupted batches, while `status=EXCEPTION` and FEFO `exceptions` include all three (`daysUntilExpiry: null`, `status: "EXCEPTION"`).
- **A0-1 Tightened Pattern (`ProductAndBatchTests#testImpossibleCalendarDatesNeverMatchTierFiltersAndRouteToException`)**: Tightened `BatchFreshness.ISO_LOCAL_DATE_REGEX` to the strict Gregorian calendar pattern `^(?:\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\d|30)|02-(?:0[1-9]|1\d|2[0-8]))|(?:(?:[02468][048]|[13579][26])00|\d{2}(?:0[48]|[2468][048]|[13579][26]))-02-29)$` so impossible calendar dates (`"2026-02-31"`, `"2026-02-29"` in a non-leap year, `"2026-04-31"`) never match `EXPIRED`, `URGENT`, `WARNING`, or `READY`, and instead route to `status=EXCEPTION` and FEFO `exceptions`.
- **A0-2 (`InspectionAndDispatchTests#testDispatchDateRoundTripAcrossTimeZones` and `InspectionAndDispatchTests#testDispatchHistoryDispatchDateAcrossThreeTimeZones`)**: Verifies both `dispatchDate` and `dispatchHistory[].dispatchDate` across `UTC`, `Asia/Kolkata`, and `America/Los_Angeles` (restoring `TimeZone.getDefault()` in `finally`), asserting that MongoDB stores `java.lang.String` (`"2026-10-01"` / `"2026-09-29"`) and both `PATCH /api/v1/batches/{id}/dispatch` and `GET /api/v1/batches/{id}` return the exact `"YYYY-MM-DD"` string in all three time zones.
- **A0-3 (`GlobalSafetyGuardAutoDetectionTest#testClockGuardRejectsLeakedClockAndAcceptsRealTimeClock`)**: Verifies that `TestDatabaseSafetyGuard.checkClockWithinRealTime(clock)` accepts the live Spring `Clock` bean, throws `IllegalStateException` when the shared `MutableClock` bean is shifted to `2000-01-01T00:00:00Z`, and passes without exceptions after `mutableClock.reset()`.
- **A0-4 (`ProductAndBatchTests#testUnmatchedPathReturns404AndWrongMethodReturns405`)**: Verifies that an unmatched API path (`GET /api/v1/does-not-exist`) returns HTTP `404 NOT_FOUND` and a wrong HTTP method on a matched path (`DELETE /api/v1/products`) returns HTTP `405 METHOD_NOT_ALLOWED`.

### 2. Real Execution Output for Part A0 Regression Tests

Command:

```powershell
.\mvnw.cmd test "-Dtest=ConfigurationAndSeedTests#testSeedDependentCollectionsHaveNonZeroCounts,GlobalSafetyGuardAutoDetectionTest,ProductAndBatchTests#testStatusChangingAfterAdvancingClockWithNoWrite+testA01CorruptedExpiryMissingNullAndNotADateAgainstAllFiveFiltersAndFefo+testImpossibleCalendarDatesNeverMatchTierFiltersAndRouteToException,InspectionAndDispatchTests#testDispatchDateRoundTripAcrossTimeZones+testDispatchHistoryDispatchDateAcrossThreeTimeZones,OpenApiExportTest"
```

Real output:

```text
[INFO] Running com.tracex.OpenApiExportTest
Verified openapi.json length: 30300, operations: 40
Verified tracex-api.yaml length: 40857
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 2.385 s -- in com.tracex.OpenApiExportTest
[INFO] Running com.tracex.ProductAndBatchTests
2026-10-05T18:02:03.688+05:30  WARN 26588 --- [           main] c.t.util.BatchLocalDateValueConverter    : Unparseable Batch LocalDate value 'not-a-date' encountered during MongoDB read; returning null
A0-1 Filter [status=EXPIRED]: count=1, codes=[TX-2026-10-001], containsMissing=false, containsNull=false, containsNotADate=false
A0-1 Filter [status=URGENT]: count=2, codes=[TX-2026-10-002, TX-2026-10-003], containsMissing=false, containsNull=false, containsNotADate=false
A0-1 Filter [status=WARNING]: count=2, codes=[TX-2026-10-004, TX-2026-10-005], containsMissing=false, containsNull=false, containsNotADate=false
A0-1 Filter [status=READY]: count=4, codes=[TX-2026-10-006, TX-2026-10-011, TX-2026-10-007, TX-2026-10-012], containsMissing=false, containsNull=false, containsNotADate=false
2026-10-05T18:02:03.787+05:30  WARN 26588 --- [           main] c.t.util.BatchLocalDateValueConverter    : Unparseable Batch LocalDate value 'not-a-date' encountered during MongoDB read; returning null
A0-1 Filter [status=EXCEPTION]: count=3, codes=[TX-A01-MISSING, TX-A01-NULL, TX-A01-NOTADATE], containsAllCorrupted=true
2026-10-05T18:02:03.808+05:30  WARN 26588 --- [           main] c.t.util.BatchLocalDateValueConverter    : Unparseable Batch LocalDate value 'not-a-date' encountered during MongoDB read; returning null
A0-1 FEFO [GET /api/v1/dispatch/fefo]: queueCodes=[TX-2026-10-002, TX-2026-10-003, TX-2026-10-004, TX-2026-10-005, TX-2026-10-006, TX-2026-10-011, TX-2026-10-007, TX-2026-10-012], expiredCodes=[TX-2026-10-001], exceptionsCodes=[TX-A01-MISSING, TX-A01-NOTADATE, TX-A01-NULL]
A0-1 Impossible Date Check [status=EXPIRED]: containsAnyImpossible=false
A0-1 Impossible Date Check [status=URGENT]: containsAnyImpossible=false
A0-1 Impossible Date Check [status=WARNING]: containsAnyImpossible=false
A0-1 Impossible Date Check [status=READY]: containsAnyImpossible=false
2026-10-05T18:02:04.058+05:30  WARN 26588 --- [           main] c.t.util.BatchLocalDateValueConverter    : Unparseable Batch LocalDate value '2026-02-29' encountered during MongoDB read; returning null
2026-10-05T18:02:04.059+05:30  WARN 26588 --- [           main] c.t.util.BatchLocalDateValueConverter    : Unparseable Batch LocalDate value '2026-02-31' encountered during MongoDB read; returning null
2026-10-05T18:02:04.059+05:30  WARN 26588 --- [           main] c.t.util.BatchLocalDateValueConverter    : Unparseable Batch LocalDate value '2026-04-31' encountered during MongoDB read; returning null
A0-1 Impossible Date Check [status=EXCEPTION]: codes=[TX-IMP-2026-02-29, TX-IMP-2026-02-31, TX-IMP-2026-04-31]
[INFO] Tests run: 3, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 2.345 s -- in com.tracex.ProductAndBatchTests
[INFO] Running com.tracex.GlobalSafetyGuardAutoDetectionTest
[INFO] Tests run: 2, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.796 s -- in com.tracex.GlobalSafetyGuardAutoDetectionTest
[INFO] Running com.tracex.InspectionAndDispatchTests
A0-2 Dispatch Round-Trip [JVM TZ=UTC]: mongo.dispatchDate=2026-10-01 (java.lang.String), mongo.dispatchHistory[0].dispatchDate=2026-10-01 (java.lang.String), PATCH => {"success":true,"requestId":"30f529ea-d4f7-403d-b313-47e4f3fed610","data":{"id":"6ac398c55d20257e8f7ff247","batchCode":"TX-A02-DISP-UTC","productName":"Wild Berry Juice Concentrate","sku":"WBJC","sourceLotCode":"LOT-A02-UTC","farmerName":"A02 Farmer","village":"A02 Village","quantityProduced":100,"unit":"Kg","yieldPercent":85.0,"packDate":"2026-09-25","expiryDate":"2026-11-04","dataSource":"manual","shelfLifeSource":"manual","lifecycleState":"DISPATCHED","status":"DISPATCHED","daysUntilExpiry":30,"priorityScore":0.0,"qualityCheck":null,"createdBy":null,"createdAt":"2026-10-05T12:32:05.489Z","updatedAt":"2026-10-05T12:32:05.510Z","traceabilityNote":null,"noteHistory":[],"dispatchHistory":[{"dispatchedBy":"coord_p4","dispatchedAt":"2026-10-05T12:32:05.510Z","buyerName":"A02 Buyer (UTC)","dispatchDate":"2026-10-01","overrideReason":null,"outOfOrder":false}],"deletedAt":null,"deletedBy":null,"deleteNote":null,"dispatchDate":"2026-10-01","buyerName":"A02 Buyer (UTC)","deleted":false}}, GET => {"success":true,"requestId":"f7bec0f1-9e32-4302-80ee-f0b6e0fc554e","data":{"id":"6ac398c55d20257e8f7ff247","batchCode":"TX-A02-DISP-UTC","productName":"Wild Berry Juice Concentrate","sku":"WBJC","sourceLotCode":"LOT-A02-UTC","farmerName":"A02 Farmer","village":"A02 Village","quantityProduced":100,"unit":"Kg","yieldPercent":85.0,"packDate":"2026-09-25","expiryDate":"2026-11-04","dataSource":"manual","shelfLifeSource":"manual","lifecycleState":"DISPATCHED","status":"DISPATCHED","daysUntilExpiry":30,"priorityScore":0.0,"qualityCheck":null,"createdBy":null,"createdAt":"2026-10-05T12:32:05.489Z","updatedAt":"2026-10-05T12:32:05.510Z","traceabilityNote":null,"noteHistory":[],"dispatchHistory":[{"dispatchedBy":"coord_p4","dispatchedAt":"2026-10-05T12:32:05.510Z","buyerName":"A02 Buyer (UTC)","dispatchDate":"2026-10-01","overrideReason":null,"outOfOrder":false}],"deletedAt":null,"deletedBy":null,"deleteNote":null,"dispatchDate":"2026-10-01","buyerName":"A02 Buyer (UTC)","deleted":false}}
A0-2 Dispatch Round-Trip [JVM TZ=Asia/Kolkata]: mongo.dispatchDate=2026-10-01 (java.lang.String), mongo.dispatchHistory[0].dispatchDate=2026-10-01 (java.lang.String), PATCH => {"success":true,"requestId":"175401cc-25b0-4559-b603-5e2e93b59eb5","data":{"id":"6ac398c55d20257e8f7ff249","batchCode":"TX-A02-DISP-Asia-Kolkata","productName":"Wild Berry Juice Concentrate","sku":"WBJC","sourceLotCode":"LOT-A02-Asia-Kolkata","farmerName":"A02 Farmer","village":"A02 Village","quantityProduced":100,"unit":"Kg","yieldPercent":85.0,"packDate":"2026-09-25","expiryDate":"2026-11-04","dataSource":"manual","shelfLifeSource":"manual","lifecycleState":"DISPATCHED","status":"DISPATCHED","daysUntilExpiry":30,"priorityScore":0.0,"qualityCheck":null,"createdBy":null,"createdAt":"2026-10-05T12:32:05.540Z","updatedAt":"2026-10-05T12:32:05.546Z","traceabilityNote":null,"noteHistory":[],"dispatchHistory":[{"dispatchedBy":"coord_p4","dispatchedAt":"2026-10-05T12:32:05.546Z","buyerName":"A02 Buyer (Asia/Kolkata)","dispatchDate":"2026-10-01","overrideReason":null,"outOfOrder":false}],"deletedAt":null,"deletedBy":null,"deleteNote":null,"dispatchDate":"2026-10-01","buyerName":"A02 Buyer (Asia/Kolkata)","deleted":false}}, GET => {"success":true,"requestId":"0ae97856-177a-4aaa-ad75-fed1ecb0dba2","data":{"id":"6ac398c55d20257e8f7ff249","batchCode":"TX-A02-DISP-Asia-Kolkata","productName":"Wild Berry Juice Concentrate","sku":"WBJC","sourceLotCode":"LOT-A02-Asia-Kolkata","farmerName":"A02 Farmer","village":"A02 Village","quantityProduced":100,"unit":"Kg","yieldPercent":85.0,"packDate":"2026-09-25","expiryDate":"2026-11-04","dataSource":"manual","shelfLifeSource":"manual","lifecycleState":"DISPATCHED","status":"DISPATCHED","daysUntilExpiry":30,"priorityScore":0.0,"qualityCheck":null,"createdBy":null,"createdAt":"2026-10-05T12:32:05.540Z","updatedAt":"2026-10-05T12:32:05.546Z","traceabilityNote":null,"noteHistory":[],"dispatchHistory":[{"dispatchedBy":"coord_p4","dispatchedAt":"2026-10-05T12:32:05.546Z","buyerName":"A02 Buyer (Asia/Kolkata)","dispatchDate":"2026-10-01","overrideReason":null,"outOfOrder":false}],"deletedAt":null,"deletedBy":null,"deleteNote":null,"dispatchDate":"2026-10-01","buyerName":"A02 Buyer (Asia/Kolkata)","deleted":false}}
A0-2 Dispatch Round-Trip [JVM TZ=America/Los_Angeles]: mongo.dispatchDate=2026-10-01 (java.lang.String), mongo.dispatchHistory[0].dispatchDate=2026-10-01 (java.lang.String), PATCH => {"success":true,"requestId":"20694983-aa99-491d-80a4-408ac29053be","data":{"id":"6ac398c55d20257e8f7ff24b","batchCode":"TX-A02-DISP-America-Los_Angeles","productName":"Wild Berry Juice Concentrate","sku":"WBJC","sourceLotCode":"LOT-A02-America-Los_Angeles","farmerName":"A02 Farmer","village":"A02 Village","quantityProduced":100,"unit":"Kg","yieldPercent":85.0,"packDate":"2026-09-25","expiryDate":"2026-11-04","dataSource":"manual","shelfLifeSource":"manual","lifecycleState":"DISPATCHED","status":"DISPATCHED","daysUntilExpiry":30,"priorityScore":0.0,"qualityCheck":null,"createdBy":null,"createdAt":"2026-10-05T12:32:05.558Z","updatedAt":"2026-10-05T12:32:05.564Z","traceabilityNote":null,"noteHistory":[],"dispatchHistory":[{"dispatchedBy":"coord_p4","dispatchedAt":"2026-10-05T12:32:05.564Z","buyerName":"A02 Buyer (America/Los_Angeles)","dispatchDate":"2026-10-01","overrideReason":null,"outOfOrder":false}],"deletedAt":null,"deletedBy":null,"deleteNote":null,"dispatchDate":"2026-10-01","buyerName":"A02 Buyer (America/Los_Angeles)","deleted":false}}, GET => {"success":true,"requestId":"b6b45a6c-cc8b-40ab-9a9e-e4801d469817","data":{"id":"6ac398c55d20257e8f7ff24b","batchCode":"TX-A02-DISP-America-Los_Angeles","productName":"Wild Berry Juice Concentrate","sku":"WBJC","sourceLotCode":"LOT-A02-America-Los_Angeles","farmerName":"A02 Farmer","village":"A02 Village","quantityProduced":100,"unit":"Kg","yieldPercent":85.0,"packDate":"2026-09-25","expiryDate":"2026-11-04","dataSource":"manual","shelfLifeSource":"manual","lifecycleState":"DISPATCHED","status":"DISPATCHED","daysUntilExpiry":30,"priorityScore":0.0,"qualityCheck":null,"createdBy":null,"createdAt":"2026-10-05T12:32:05.558Z","updatedAt":"2026-10-05T12:32:05.564Z","traceabilityNote":null,"noteHistory":[],"dispatchHistory":[{"dispatchedBy":"coord_p4","dispatchedAt":"2026-10-05T12:32:05.564Z","buyerName":"A02 Buyer (America/Los_Angeles)","dispatchDate":"2026-10-01","overrideReason":null,"outOfOrder":false}],"deletedAt":null,"deletedBy":null,"deleteNote":null,"dispatchDate":"2026-10-01","buyerName":"A02 Buyer (America/Los_Angeles)","deleted":false}}
A0-2 dispatchHistory[].dispatchDate [JVM TZ=UTC]: mongo.dispatchHistory[0].dispatchDate=2026-09-29 (java.lang.String), mongo.dispatchHistory[0].dispatchedAt=Mon Oct 05 12:32:05 UTC 2026 (java.util.Date), GET dispatchHistory[0] => {"dispatchedBy":"coord_p4","dispatchedAt":"2026-10-05T12:32:05.994Z","buyerName":"A02 History Buyer (UTC)","dispatchDate":"2026-09-29","overrideReason":null,"outOfOrder":false}
A0-2 dispatchHistory[].dispatchDate [JVM TZ=Asia/Kolkata]: mongo.dispatchHistory[0].dispatchDate=2026-09-29 (java.lang.String), mongo.dispatchHistory[0].dispatchedAt=Mon Oct 05 18:02:06 IST 2026 (java.util.Date), GET dispatchHistory[0] => {"dispatchedBy":"coord_p4","dispatchedAt":"2026-10-05T12:32:06.014Z","buyerName":"A02 History Buyer (Asia/Kolkata)","dispatchDate":"2026-09-29","overrideReason":null,"outOfOrder":false}
A0-2 dispatchHistory[].dispatchDate [JVM TZ=America/Los_Angeles]: mongo.dispatchHistory[0].dispatchDate=2026-09-29 (java.lang.String), mongo.dispatchHistory[0].dispatchedAt=Mon Oct 05 05:32:06 PDT 2026 (java.util.Date), GET dispatchHistory[0] => {"dispatchedBy":"coord_p4","dispatchedAt":"2026-10-05T12:32:06.034Z","buyerName":"A02 History Buyer (America/Los_Angeles)","dispatchDate":"2026-09-29","overrideReason":null,"outOfOrder":false}
[INFO] Tests run: 2, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.131 s -- in com.tracex.InspectionAndDispatchTests
[INFO] Running com.tracex.ConfigurationAndSeedTests
SEEDED_BATCH: sourceLotCode=DEMO-LOT-001, batchCode=TX-2026-10-001, packDate=2026-03-19, expiryDate=2026-09-30, lifecycleState=ACTIVE
SEEDED_BATCH: sourceLotCode=DEMO-LOT-002, batchCode=TX-2026-10-002, packDate=2026-07-08, expiryDate=2026-10-06, lifecycleState=ACTIVE
SEEDED_BATCH: sourceLotCode=DEMO-LOT-003, batchCode=TX-2026-10-003, packDate=2025-10-12, expiryDate=2026-10-12, lifecycleState=ACTIVE
SEEDED_BATCH: sourceLotCode=DEMO-LOT-004, batchCode=TX-2026-10-004, packDate=2026-01-16, expiryDate=2026-10-13, lifecycleState=ACTIVE
SEEDED_BATCH: sourceLotCode=DEMO-LOT-005, batchCode=TX-2026-10-005, packDate=2026-08-06, expiryDate=2026-11-04, lifecycleState=ACTIVE
SEEDED_BATCH: sourceLotCode=DEMO-LOT-006, batchCode=TX-2026-10-006, packDate=2026-05-09, expiryDate=2026-11-05, lifecycleState=ACTIVE
SEEDED_BATCH: sourceLotCode=DEMO-LOT-007, batchCode=TX-2026-10-007, packDate=2025-01-03, expiryDate=2027-01-03, lifecycleState=ACTIVE
SEEDED_BATCH: sourceLotCode=DEMO-LOT-008, batchCode=TX-2026-10-008, packDate=2026-03-19, expiryDate=2027-03-19, lifecycleState=DISPATCHED
SEEDED_BATCH: sourceLotCode=DEMO-LOT-009, batchCode=TX-2026-10-009, packDate=2026-08-16, expiryDate=2027-02-12, lifecycleState=DISPATCHED
SEEDED_BATCH: sourceLotCode=DEMO-LOT-010, batchCode=TX-2026-10-010, packDate=2026-06-27, expiryDate=2026-09-25, lifecycleState=ACTIVE
SEEDED_BATCH: sourceLotCode=DEMO-LOT-011, batchCode=TX-2026-10-011, packDate=2026-03-09, expiryDate=2026-12-04, lifecycleState=ACTIVE
SEEDED_BATCH: sourceLotCode=DEMO-LOT-012, batchCode=TX-2026-10-012, packDate=2025-01-03, expiryDate=2027-01-03, lifecycleState=ACTIVE
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.161 s -- in com.tracex.ConfigurationAndSeedTests
[INFO]
[INFO] Results:
[INFO]
[INFO] Tests run: 9, Failures: 0, Errors: 0, Skipped: 0
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
```

---

## E3 — Clock Leakage, 12 vs 13 Seeded Batches Fix, Pure Safety Guard, Random Class & Method Order, and 3x `mvnw.cmd clean verify`

### 1. Root Cause of `TX-2000-01-002`, Named Tests That Shift `Clock` / `TimeZone`, and Restoration Proof

1. **Why `TX-2000-01-002` appeared in Phase 4.2**:
   - In Phase 3 (`SeedRunner.java` lines 231–254), `SeedRunner.seedBatches()` hardcoded `"TX-2000-01-001"`..`"TX-2000-01-012"` instead of deriving the prefix from `LocalDate.now(clock)` (fixed in Phase 5 `A0-3`).
2. **Named test that shifts the shared `Clock` bean (`ProductAndBatchTests#testStatusChangingAfterAdvancingClockWithNoWrite`) and how it restores the `Clock`**:
   - Registered `MutableClock` (`backend/src/main/java/com/tracex/util/MutableClock.java`) as the `@Bean public Clock clock()` in `AppConfig.java` (delegating by default to `Clock.system(ZoneId.of(businessTimezone))`).
   - In `ProductAndBatchTests#testStatusChangingAfterAdvancingClockWithNoWrite` (`ProductAndBatchTests.java` line 371), the test shifts the shared `MutableClock` bean across `t0`, `t0 + 2d`, `t0 + 25d`, and `t0 + 35d`, verifies the dynamic status transitions (`READY` -> `WARNING` -> `URGENT` -> `EXPIRED`) via `GET /api/v1/batches/{id}` with zero database writes, restores the `Clock` in a `finally` block via `mutableClock.reset()` (backed by `@AfterEach void resetClockAfterEach()` and `@AfterAll` in `ProductAndBatchTests.java`), and immediately calls `TestDatabaseSafetyGuard.checkClockWithinRealTime(clock)` to verify restoration.
3. **Named rollover tests that use fixed `Clock` instances (`ProductAndBatchTests#testMonthRollover`, `ProductAndBatchTests#testYearRollover`, and `ProductAndBatchTests#testThousandthBatchProducesFourDigitSequence`)**:
   - Pass local `Clock.fixed(...)` instances to `batchCodeGenerator.generateNextCode(fixedClock)` and remove their temporary counter keys (`batch_TX-2026-01`, `batch_TX-2026-02`, `batch_TX-2026-12`, `batch_TX-2027-01`, `batch_TX-2035-07`) in `finally` blocks so test counter keys never linger in MongoDB.
4. **Named tests that change the JVM default `TimeZone` (`ProductAndBatchTests#testCreateAndReadBatchDateRoundTripAcrossTimeZones`, `InspectionAndDispatchTests#testDispatchDateRoundTripAcrossTimeZones`, and `InspectionAndDispatchTests#testDispatchHistoryDispatchDateAcrossThreeTimeZones`)**:
   - Save `TimeZone originalDefault = TimeZone.getDefault()` before iterating over `UTC`, `Asia/Kolkata`, and `America/Los_Angeles`, and restore `TimeZone.setDefault(originalDefault)` in `finally` (and `GlobalTestDatabaseSafetyExtension.afterEach` also restores the baseline `TimeZone`).
5. **Pure Safety Guard (`GlobalTestDatabaseSafetyExtension` + `TestDatabaseSafetyGuard`)**:
   - `GlobalTestDatabaseSafetyExtension` is strictly read-only on database state (`AfterAllCallback`, `SeedRunner`, and `RateLimiter` removed from the extension).
   - `GlobalTestDatabaseSafetyExtension.beforeEach` calls `TestDatabaseSafetyGuard.checkClockWithinRealTime(Clock clock)` before every test method across the entire 409-test suite, asserting `Math.abs(Duration.between(Instant.now(), clock.instant()).toMillis()) <= 5000L` without a single exception.

### 2. Explanation of 13 vs 12 Seeded Batches and Fix

- **Why 13 batches appeared**: `SPEC.md` §8.3 and Phase 3 (`ConfigurationAndSeedTests#testSeedDependentCollectionsHaveNonZeroCounts`, `@DisplayName` `"5 products, 12 demo batches..."`) specify **12** seeded demo batches (`DEMO-LOT-001`..`DEMO-LOT-012`). In Phase 4, when adding a pair of active batches of the same SKU (`RHSLT`) with identical `expiryDate` to exercise the D-18 same-SKU equal-expiry tie rule, a 13th batch (`DEMO-LOT-013`) was appended to `SeedRunner.seedBatches()` instead of pairing the existing active `RHSLT` batch (`DEMO-LOT-007`) with `DEMO-LOT-012`.
- **Fix applied**: Updated `SeedRunner.seedBatches()` so `DEMO-LOT-007` (`RHSLT`, `ACTIVE`) and `DEMO-LOT-012` (`RHSLT`, `ACTIVE`) share `sharedTieExpiry = today.plusDays(90)` within the 12 seeded demo batches (`DEMO-LOT-001`..`DEMO-LOT-012`), removed `DEMO-LOT-013` (and added `mongoTemplate.remove(Query.query(Criteria.where("sourceLotCode").is("DEMO-LOT-013")), Batch.class)` to clean up any legacy `DEMO-LOT-013` document), set the monthly sequence counter max to `12L`, and updated `ConfigurationAndSeedTests.java` line 242 to `assertThat(demoBatches).hasSize(12)`.

### 3. Random Class and Method Order (`backend/src/test/resources/junit-platform.properties`)

```properties
junit.jupiter.extensions.autodetection.enabled=true
junit.jupiter.testclass.order.default=org.junit.jupiter.api.ClassOrderer$Random
junit.jupiter.testmethod.order.default=org.junit.jupiter.api.MethodOrderer$Random
```

### 4. Three Consecutive `.\mvnw.cmd clean verify` Runs (409 Tests Each)

Command:

```powershell
.\mvnw.cmd clean verify
```

#### Run 1 of 3

```text
[INFO] Running com.tracex.SmtpEmailServiceTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 5.786 s -- in com.tracex.SmtpEmailServiceTest
[INFO] Running com.tracex.TokenAndSessionTests
[INFO] Tests run: 8, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.985 s -- in com.tracex.TokenAndSessionTests
[INFO] Running com.tracex.AuthLoginTests
[INFO] Tests run: 10, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 3.757 s -- in com.tracex.AuthLoginTests
[INFO] Running com.tracex.ConfigurationAndSeedTests
[INFO] Tests run: 12, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 3.686 s -- in com.tracex.ConfigurationAndSeedTests
[INFO] Running com.tracex.RouteCoverageTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.439 s -- in com.tracex.RouteCoverageTest
[INFO] Running com.tracex.AdminVsAdminRulesTest
[INFO] Tests run: 11, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 3.661 s -- in com.tracex.AdminVsAdminRulesTest
[INFO] Running com.tracex.FefoServiceTest
[INFO] Tests run: 11, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 2.363 s -- in com.tracex.FefoServiceTest
[INFO] Running com.tracex.ProductAndBatchTests
[INFO] Tests run: 37, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 2.405 s -- in com.tracex.ProductAndBatchTests
[INFO] Running com.tracex.BatchIndexTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.023 s -- in com.tracex.BatchIndexTest
[INFO] Running com.tracex.GlobalSafetyGuardAutoDetectionTest
[INFO] Tests run: 2, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.015 s -- in com.tracex.GlobalSafetyGuardAutoDetectionTest
[INFO] Running com.tracex.InspectionAndDispatchTests
[INFO] Tests run: 14, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 6.709 s -- in com.tracex.InspectionAndDispatchTests
[INFO] Running com.tracex.ErrorCodeSpecSyncTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.013 s -- in com.tracex.ErrorCodeSpecSyncTest
[INFO] Running com.tracex.OpenApiExportTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 2.147 s -- in com.tracex.OpenApiExportTest
[INFO] Running com.tracex.ForwardedHeadersEmpiricalTest
[INFO] Running com.tracex.ForwardedHeadersEmpiricalTest$FrameworkStrategyTests
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.008 s -- in com.tracex.ForwardedHeadersEmpiricalTest$FrameworkStrategyTests
[INFO] Running com.tracex.ForwardedHeadersEmpiricalTest$NativeStrategyTrustedProxyTests
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.787 s -- in com.tracex.ForwardedHeadersEmpiricalTest$NativeStrategyTrustedProxyTests
[INFO] Running com.tracex.ForwardedHeadersEmpiricalTest$NativeStrategyUntrustedDirectTests
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.665 s -- in com.tracex.ForwardedHeadersEmpiricalTest$NativeStrategyUntrustedDirectTests
[INFO] Tests run: 0, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 2.465 s -- in com.tracex.ForwardedHeadersEmpiricalTest
[INFO] Running com.tracex.AccessRequestAndUserFlowTests
[INFO] Tests run: 9, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 3.341 s -- in com.tracex.AccessRequestAndUserFlowTests
[INFO] Running com.tracex.RbacMatrixTest
[INFO] Tests run: 287, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.198 s -- in com.tracex.RbacMatrixTest
[INFO] Tests run: 409, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
[INFO] Total time:  48.325 s
```

#### Run 2 of 3

```text
[INFO] Running com.tracex.ProductAndBatchTests
[INFO] Tests run: 37, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 9.229 s -- in com.tracex.ProductAndBatchTests
[INFO] Running com.tracex.AdminVsAdminRulesTest
[INFO] Tests run: 11, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 3.608 s -- in com.tracex.AdminVsAdminRulesTest
[INFO] Running com.tracex.ConfigurationAndSeedTests
[INFO] Tests run: 12, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 3.493 s -- in com.tracex.ConfigurationAndSeedTests
[INFO] Running com.tracex.RouteCoverageTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.518 s -- in com.tracex.RouteCoverageTest
[INFO] Running com.tracex.ForwardedHeadersEmpiricalTest
[INFO] Running com.tracex.ForwardedHeadersEmpiricalTest$FrameworkStrategyTests
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.934 s -- in com.tracex.ForwardedHeadersEmpiricalTest$FrameworkStrategyTests
[INFO] Running com.tracex.ForwardedHeadersEmpiricalTest$NativeStrategyUntrustedDirectTests
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.016 s -- in com.tracex.ForwardedHeadersEmpiricalTest$NativeStrategyUntrustedDirectTests
[INFO] Running com.tracex.ForwardedHeadersEmpiricalTest$NativeStrategyTrustedProxyTests
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.887 s -- in com.tracex.ForwardedHeadersEmpiricalTest$NativeStrategyTrustedProxyTests
[INFO] Tests run: 0, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 3.842 s -- in com.tracex.ForwardedHeadersEmpiricalTest
[INFO] Running com.tracex.AccessRequestAndUserFlowTests
[INFO] Tests run: 9, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 3.641 s -- in com.tracex.AccessRequestAndUserFlowTests
[INFO] Running com.tracex.ErrorCodeSpecSyncTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.012 s -- in com.tracex.ErrorCodeSpecSyncTest
[INFO] Running com.tracex.GlobalSafetyGuardAutoDetectionTest
[INFO] Tests run: 2, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.011 s -- in com.tracex.GlobalSafetyGuardAutoDetectionTest
[INFO] Running com.tracex.FefoServiceTest
[INFO] Tests run: 11, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 2.205 s -- in com.tracex.FefoServiceTest
[INFO] Running com.tracex.RbacMatrixTest
[INFO] Tests run: 287, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.379 s -- in com.tracex.RbacMatrixTest
[INFO] Running com.tracex.AuthLoginTests
[INFO] Tests run: 10, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 3.568 s -- in com.tracex.AuthLoginTests
[INFO] Running com.tracex.TokenAndSessionTests
[INFO] Tests run: 8, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.623 s -- in com.tracex.TokenAndSessionTests
[INFO] Running com.tracex.SmtpEmailServiceTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.682 s -- in com.tracex.SmtpEmailServiceTest
[INFO] Running com.tracex.BatchIndexTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.006 s -- in com.tracex.BatchIndexTest
[INFO] Running com.tracex.InspectionAndDispatchTests
[INFO] Tests run: 14, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 6.615 s -- in com.tracex.InspectionAndDispatchTests
[INFO] Running com.tracex.OpenApiExportTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.661 s -- in com.tracex.OpenApiExportTest
[INFO] Tests run: 409, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
[INFO] Total time:  49.309 s
```

#### Run 3 of 3

```text
[INFO] Running com.tracex.FefoServiceTest
[INFO] Tests run: 11, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 8.546 s -- in com.tracex.FefoServiceTest
[INFO] Running com.tracex.RbacMatrixTest
[INFO] Tests run: 287, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.991 s -- in com.tracex.RbacMatrixTest
[INFO] Running com.tracex.RouteCoverageTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.823 s -- in com.tracex.RouteCoverageTest
[INFO] Running com.tracex.TokenAndSessionTests
[INFO] Tests run: 8, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.684 s -- in com.tracex.TokenAndSessionTests
[INFO] Running com.tracex.ErrorCodeSpecSyncTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.014 s -- in com.tracex.ErrorCodeSpecSyncTest
[INFO] Running com.tracex.AccessRequestAndUserFlowTests
[INFO] Tests run: 9, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 5.307 s -- in com.tracex.AccessRequestAndUserFlowTests
[INFO] Running com.tracex.InspectionAndDispatchTests
[INFO] Tests run: 14, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 7.048 s -- in com.tracex.InspectionAndDispatchTests
[INFO] Running com.tracex.ProductAndBatchTests
[INFO] Tests run: 37, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 2.344 s -- in com.tracex.ProductAndBatchTests
[INFO] Running com.tracex.AuthLoginTests
[INFO] Tests run: 10, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 3.508 s -- in com.tracex.AuthLoginTests
[INFO] Running com.tracex.SmtpEmailServiceTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.288 s -- in com.tracex.SmtpEmailServiceTest
[INFO] Running com.tracex.ForwardedHeadersEmpiricalTest
[INFO] Running com.tracex.ForwardedHeadersEmpiricalTest$NativeStrategyTrustedProxyTests
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.340 s -- in com.tracex.ForwardedHeadersEmpiricalTest$NativeStrategyTrustedProxyTests
[INFO] Running com.tracex.ForwardedHeadersEmpiricalTest$FrameworkStrategyTests
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.885 s -- in com.tracex.ForwardedHeadersEmpiricalTest$FrameworkStrategyTests
[INFO] Running com.tracex.ForwardedHeadersEmpiricalTest$NativeStrategyUntrustedDirectTests
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.715 s -- in com.tracex.ForwardedHeadersEmpiricalTest$NativeStrategyUntrustedDirectTests
[INFO] Tests run: 0, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 2.943 s -- in com.tracex.ForwardedHeadersEmpiricalTest
[INFO] Running com.tracex.OpenApiExportTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.700 s -- in com.tracex.OpenApiExportTest
[INFO] Running com.tracex.ConfigurationAndSeedTests
[INFO] Tests run: 12, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 2.193 s -- in com.tracex.ConfigurationAndSeedTests
[INFO] Running com.tracex.BatchIndexTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.008 s -- in com.tracex.BatchIndexTest
[INFO] Running com.tracex.AdminVsAdminRulesTest
[INFO] Tests run: 11, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 3.463 s -- in com.tracex.AdminVsAdminRulesTest
[INFO] Running com.tracex.GlobalSafetyGuardAutoDetectionTest
[INFO] Tests run: 2, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.009 s -- in com.tracex.GlobalSafetyGuardAutoDetectionTest
[INFO] Tests run: 409, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
[INFO] Total time:  48.895 s
```

### 5. All 12 Seeded Demo Batch Codes in `tracex_fresh_test` Start With Current Year and Month (`TX-2026-10-`)

Command:

```powershell
.\mvnw.cmd test "-Dtest=ConfigurationAndSeedTests#testSeedDependentCollectionsHaveNonZeroCounts"
```

Real output:

```text
SEEDED_BATCH: sourceLotCode=DEMO-LOT-001, batchCode=TX-2026-10-001, packDate=2026-03-19, expiryDate=2026-09-30, lifecycleState=ACTIVE
SEEDED_BATCH: sourceLotCode=DEMO-LOT-002, batchCode=TX-2026-10-002, packDate=2026-07-08, expiryDate=2026-10-06, lifecycleState=ACTIVE
SEEDED_BATCH: sourceLotCode=DEMO-LOT-003, batchCode=TX-2026-10-003, packDate=2025-10-12, expiryDate=2026-10-12, lifecycleState=ACTIVE
SEEDED_BATCH: sourceLotCode=DEMO-LOT-004, batchCode=TX-2026-10-004, packDate=2026-01-16, expiryDate=2026-10-13, lifecycleState=ACTIVE
SEEDED_BATCH: sourceLotCode=DEMO-LOT-005, batchCode=TX-2026-10-005, packDate=2026-08-06, expiryDate=2026-11-04, lifecycleState=ACTIVE
SEEDED_BATCH: sourceLotCode=DEMO-LOT-006, batchCode=TX-2026-10-006, packDate=2026-05-09, expiryDate=2026-11-05, lifecycleState=ACTIVE
SEEDED_BATCH: sourceLotCode=DEMO-LOT-007, batchCode=TX-2026-10-007, packDate=2025-01-03, expiryDate=2027-01-03, lifecycleState=ACTIVE
SEEDED_BATCH: sourceLotCode=DEMO-LOT-008, batchCode=TX-2026-10-008, packDate=2026-03-19, expiryDate=2027-03-19, lifecycleState=DISPATCHED
SEEDED_BATCH: sourceLotCode=DEMO-LOT-009, batchCode=TX-2026-10-009, packDate=2026-08-16, expiryDate=2027-02-12, lifecycleState=DISPATCHED
SEEDED_BATCH: sourceLotCode=DEMO-LOT-010, batchCode=TX-2026-10-010, packDate=2026-06-27, expiryDate=2026-09-25, lifecycleState=ACTIVE
SEEDED_BATCH: sourceLotCode=DEMO-LOT-011, batchCode=TX-2026-10-011, packDate=2026-03-09, expiryDate=2026-12-04, lifecycleState=ACTIVE
SEEDED_BATCH: sourceLotCode=DEMO-LOT-012, batchCode=TX-2026-10-012, packDate=2025-01-03, expiryDate=2027-01-03, lifecycleState=ACTIVE
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.161 s -- in com.tracex.ConfigurationAndSeedTests
[INFO] BUILD SUCCESS
```

---

## E4 — Frontend Static Checks (`npm ci`, `lint`, `typecheck`, `test`, `build`, `check:banned`, `check:contrast`, `check:api-drift`)

### 1. `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`

Commands:

```powershell
npm ci
npm run lint
npm run typecheck
npm test
$env:VITE_API_BASE_URL = "https://api.tracex.example.com"; npm run build
```

Real output:

```text
=== npm ci ===
added 426 packages, and audited 427 packages in 2m

=== npm run lint ===
> tracex-frontend@1.0.0 lint
> eslint .

=== npm run typecheck ===
> tracex-frontend@1.0.0 typecheck
> tsc --noEmit

=== npm test ===
> tracex-frontend@1.0.0 test
> vitest run

 RUN  v3.1.2 C:/Users/yashm/OneDrive/Desktop/TraceX/frontend

 ✓ src/lib/dates.test.ts (7 tests) 28ms
 ✓ src/auth/auth.test.tsx (8 tests) 356ms
 ✓ src/components/ui/ui.test.tsx (10 tests) 426ms

 Test Files  3 passed (3)
      Tests  25 passed (25)
   Start at  16:31:41
   Duration  2.04s (transform 322ms, setup 542ms, collect 1.24s, tests 810ms, environment 1.75s, prepare 294ms)

=== npm run build ===
> tracex-frontend@1.0.0 build
> tsc -b && vite build

vite v6.3.3 building for production...
transforming...
✓ 1710 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.85 kB │ gzip:   0.47 kB
dist/assets/index-DSvYkIBM.css   24.83 kB │ gzip:   5.21 kB
dist/assets/index-MubTUzxU.js   361.33 kB │ gzip: 109.27 kB
✓ built in 11.57s
```

### 2. `npm run check:banned` (Pass -> Planted Violation Fails -> Restored Pass)

Command:

```powershell
npm run check:banned
$targetFile = "src\App.tsx"
$origContent = Get-Content $targetFile -Raw
Set-Content -Path $targetFile -Value ($origContent + "`nexport const __planted = 'TODO lorem ipsum http://localhost:8080'; console.log(__planted); localStorage.getItem('x');`n") -NoNewline
npm run check:banned
Write-Host "Planted exit code: $LASTEXITCODE"
Set-Content -Path $targetFile -Value $origContent -NoNewline
npm run check:banned
```

Real output:

```text
=== 1. check:banned (pass) ===

> tracex-frontend@1.0.0 check:banned
> node scripts/check-banned-patterns.mjs

Banned pattern check PASSED: 0 violations found across src/ and index.html.
=== 2. check:banned (planted violation in src/App.tsx) ===

> tracex-frontend@1.0.0 check:banned
> node scripts/check-banned-patterns.mjs

Banned pattern check FAILED with 5 violation(s):
  [VIOLATION] src/App.tsx:104 - Banned 'TODO' marker found
  [VIOLATION] src/App.tsx:104 - Banned 'lorem ipsum' placeholder text found
  [VIOLATION] src/App.tsx:104 - Banned 'localStorage' usage outside src/lib/prefs.ts
  [VIOLATION] src/App.tsx:104 - Banned 'console.*' usage outside src/lib/logger.ts
  [VIOLATION] src/App.tsx:104 - Banned hardcoded 'http://localhost' in source code
Planted exit code: 1
=== 3. check:banned (restored pass) ===

> tracex-frontend@1.0.0 check:banned
> node scripts/check-banned-patterns.mjs

Banned pattern check PASSED: 0 violations found across src/ and index.html.
```

### 3. `npm run check:contrast` (Full 138-Pair Ratio Table Across All Palettes, Modes, and Accents)

Command:

```powershell
npm run check:contrast
```

Real output:

```text
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

### 4. `npm run check:api-drift`

Command:

```powershell
npm run check:api-drift
```

Real output:

```text
> tracex-frontend@1.0.0 check:api-drift
> node scripts/check-api-drift.mjs

OpenAPI schema drift check PASSED: src/api/generated/schema.d.ts and docs/openapi.json match backend/src/main/resources/openapi/tracex-api.yaml.
```

---

## E5 — Browser Evidence (`axe`, Reduced Motion, Keyboard-Only Run, Viewports, and Screenshots)

### 1. `axe-core` Results on Every Route in `light` and `dark` Across All Three Palettes (`E2E-10`)

```text
[E2E-10 AXE] route=/login palette=editorial mode=light -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/login palette=editorial mode=dark -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/login palette=obsidian mode=light -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/login palette=obsidian mode=dark -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/login palette=emerald mode=light -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/login palette=emerald mode=dark -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/request-access palette=editorial mode=light -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/request-access palette=editorial mode=dark -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/request-access palette=obsidian mode=light -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/request-access palette=obsidian mode=dark -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/request-access palette=emerald mode=light -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/request-access palette=emerald mode=dark -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/activate?token=sample-token palette=editorial mode=light -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/activate?token=sample-token palette=editorial mode=dark -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/activate?token=sample-token palette=obsidian mode=light -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/activate?token=sample-token palette=obsidian mode=dark -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/activate?token=sample-token palette=emerald mode=light -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/activate?token=sample-token palette=emerald mode=dark -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/verify-otp?email=demo%40tracex.demo palette=editorial mode=light -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/verify-otp?email=demo%40tracex.demo palette=editorial mode=dark -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/verify-otp?email=demo%40tracex.demo palette=obsidian mode=light -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/verify-otp?email=demo%40tracex.demo palette=obsidian mode=dark -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/verify-otp?email=demo%40tracex.demo palette=emerald mode=light -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/verify-otp?email=demo%40tracex.demo palette=emerald mode=dark -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/forgot-password palette=editorial mode=light -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/forgot-password palette=editorial mode=dark -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/forgot-password palette=obsidian mode=light -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/forgot-password palette=obsidian mode=dark -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/forgot-password palette=emerald mode=light -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/forgot-password palette=emerald mode=dark -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/reset-password?email=demo%40tracex.demo palette=editorial mode=light -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/reset-password?email=demo%40tracex.demo palette=editorial mode=dark -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/reset-password?email=demo%40tracex.demo palette=obsidian mode=light -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/reset-password?email=demo%40tracex.demo palette=obsidian mode=dark -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/reset-password?email=demo%40tracex.demo palette=emerald mode=light -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/reset-password?email=demo%40tracex.demo palette=emerald mode=dark -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/trace/sample-qr-token palette=editorial mode=light -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/trace/sample-qr-token palette=editorial mode=dark -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/trace/sample-qr-token palette=obsidian mode=light -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/trace/sample-qr-token palette=obsidian mode=dark -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/trace/sample-qr-token palette=emerald mode=light -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/trace/sample-qr-token palette=emerald mode=dark -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/privacy palette=editorial mode=light -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/privacy palette=editorial mode=dark -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/privacy palette=obsidian mode=light -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/privacy palette=obsidian mode=dark -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/privacy palette=emerald mode=light -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/privacy palette=emerald mode=dark -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/terms palette=editorial mode=light -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/terms palette=editorial mode=dark -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/terms palette=obsidian mode=light -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/terms palette=obsidian mode=dark -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/terms palette=emerald mode=light -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/terms palette=emerald mode=dark -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/_styleguide palette=editorial mode=light -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/_styleguide palette=editorial mode=dark -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/_styleguide palette=obsidian mode=light -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/_styleguide palette=obsidian mode=dark -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/_styleguide palette=emerald mode=light -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/_styleguide palette=emerald mode=dark -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/ palette=editorial mode=light -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/ palette=editorial mode=dark -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/ palette=obsidian mode=light -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/ palette=obsidian mode=dark -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/ palette=emerald mode=light -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/ palette=emerald mode=dark -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/admin-check palette=editorial mode=light -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/admin-check palette=editorial mode=dark -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/admin-check palette=obsidian mode=light -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/admin-check palette=obsidian mode=dark -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/admin-check palette=emerald mode=light -> critical=0 serious=0 moderate=0 minor=0
[E2E-10 AXE] route=/admin-check palette=emerald mode=dark -> critical=0 serious=0 moderate=0 minor=0
```

### 2. Computed `transitionDuration` and `animationDuration` With Reduced Motion Emulated (`E2E-09`)

```text
[E2E-09] Reduced motion computed durations -> {"btnTransition":"0s","btnAnimation":"0s","navTransition":"0s","navAnimation":"0s"}
```

### 3. Keyboard-Only Run Description (`E2E-09`)

1. Opened `/login` and pressed `Tab`: focus moved to the `"Skip to main content"` link; pressing `Enter` moved focus (`document.activeElement.id`) to `main-content`.
2. Focused the `Username` input, typed `superadmin`, pressed `Tab` to move to `Password`, typed the seed password, pressed `Tab` twice (past the `"Show password"` toggle button to the `"Sign in"` submit button), and pressed `Enter` to submit and land on `/`.
3. Focused the `"Inspect Active Session"` button (`data-testid="open-session-dialog-btn"`), pressed `Enter` to open the `"Active Session Details"` modal dialog (`role="dialog"`), pressed `Tab` twice and verified `document.activeElement.closest('[role="dialog"]')` remained inside the dialog focus trap, then pressed `Escape` to close the dialog and verified focus returned to `data-testid="open-session-dialog-btn"`.
4. Focused the theme toggle button (`Switch to dark/light theme`) and pressed `Enter`, verifying `document.documentElement.getAttribute('data-theme')` toggled between `light` and `dark`.

### 4. Measured `scrollWidth` and `clientWidth` at `375px`, `768px`, and `1280px` on Every Route (`E2E-11`)

```text
[E2E-11 VIEWPORT] route=/login viewport=375x812 -> scrollWidth=375 clientWidth=375
[E2E-11 VIEWPORT] route=/login viewport=768x1024 -> scrollWidth=768 clientWidth=768
[E2E-11 VIEWPORT] route=/login viewport=1280x800 -> scrollWidth=1280 clientWidth=1280
[E2E-11 VIEWPORT] route=/request-access viewport=375x812 -> scrollWidth=375 clientWidth=375
[E2E-11 VIEWPORT] route=/request-access viewport=768x1024 -> scrollWidth=768 clientWidth=768
[E2E-11 VIEWPORT] route=/request-access viewport=1280x800 -> scrollWidth=1280 clientWidth=1280
[E2E-11 VIEWPORT] route=/activate?token=sample-token viewport=375x812 -> scrollWidth=375 clientWidth=375
[E2E-11 VIEWPORT] route=/activate?token=sample-token viewport=768x1024 -> scrollWidth=768 clientWidth=768
[E2E-11 VIEWPORT] route=/activate?token=sample-token viewport=1280x800 -> scrollWidth=1280 clientWidth=1280
[E2E-11 VIEWPORT] route=/verify-otp?email=demo%40tracex.demo viewport=375x812 -> scrollWidth=375 clientWidth=375
[E2E-11 VIEWPORT] route=/verify-otp?email=demo%40tracex.demo viewport=768x1024 -> scrollWidth=768 clientWidth=768
[E2E-11 VIEWPORT] route=/verify-otp?email=demo%40tracex.demo viewport=1280x800 -> scrollWidth=1280 clientWidth=1280
[E2E-11 VIEWPORT] route=/forgot-password viewport=375x812 -> scrollWidth=375 clientWidth=375
[E2E-11 VIEWPORT] route=/forgot-password viewport=768x1024 -> scrollWidth=768 clientWidth=768
[E2E-11 VIEWPORT] route=/forgot-password viewport=1280x800 -> scrollWidth=1280 clientWidth=1280
[E2E-11 VIEWPORT] route=/reset-password?email=demo%40tracex.demo viewport=375x812 -> scrollWidth=375 clientWidth=375
[E2E-11 VIEWPORT] route=/reset-password?email=demo%40tracex.demo viewport=768x1024 -> scrollWidth=768 clientWidth=768
[E2E-11 VIEWPORT] route=/reset-password?email=demo%40tracex.demo viewport=1280x800 -> scrollWidth=1280 clientWidth=1280
[E2E-11 VIEWPORT] route=/trace/sample-qr-token viewport=375x812 -> scrollWidth=375 clientWidth=375
[E2E-11 VIEWPORT] route=/trace/sample-qr-token viewport=768x1024 -> scrollWidth=768 clientWidth=768
[E2E-11 VIEWPORT] route=/trace/sample-qr-token viewport=1280x800 -> scrollWidth=1280 clientWidth=1280
[E2E-11 VIEWPORT] route=/privacy viewport=375x812 -> scrollWidth=375 clientWidth=375
[E2E-11 VIEWPORT] route=/privacy viewport=768x1024 -> scrollWidth=768 clientWidth=768
[E2E-11 VIEWPORT] route=/privacy viewport=1280x800 -> scrollWidth=1280 clientWidth=1280
[E2E-11 VIEWPORT] route=/terms viewport=375x812 -> scrollWidth=375 clientWidth=375
[E2E-11 VIEWPORT] route=/terms viewport=768x1024 -> scrollWidth=768 clientWidth=768
[E2E-11 VIEWPORT] route=/terms viewport=1280x800 -> scrollWidth=1280 clientWidth=1280
[E2E-11 VIEWPORT] route=/_styleguide viewport=375x812 -> scrollWidth=375 clientWidth=375
[E2E-11 VIEWPORT] route=/_styleguide viewport=768x1024 -> scrollWidth=768 clientWidth=768
[E2E-11 VIEWPORT] route=/_styleguide viewport=1280x800 -> scrollWidth=1280 clientWidth=1280
[E2E-11 VIEWPORT] route=/ viewport=375x812 -> scrollWidth=375 clientWidth=375
[E2E-11 VIEWPORT] route=/ viewport=768x1024 -> scrollWidth=768 clientWidth=768
[E2E-11 VIEWPORT] route=/ viewport=1280x800 -> scrollWidth=1280 clientWidth=1280
[E2E-11 VIEWPORT] route=/admin-check viewport=375x812 -> scrollWidth=375 clientWidth=375
[E2E-11 VIEWPORT] route=/admin-check viewport=768x1024 -> scrollWidth=768 clientWidth=768
[E2E-11 VIEWPORT] route=/admin-check viewport=1280x800 -> scrollWidth=1280 clientWidth=1280
```

### 5. Screenshot Files in `docs/screenshots/phase-05/`

Command:

```powershell
Get-ChildItem "..\docs\screenshots\phase-05" | Sort-Object Name | Select-Object Name, Length | Format-Table -AutoSize
```

Real output:

```text
Name                              Length
----                              ------
route-01-login-1280.png            27495
route-01-login-375.png             23767
route-01-login-768.png             26986
route-02-request-access-1280.png   28619
route-02-request-access-375.png    25203
route-02-request-access-768.png    28247
route-03-activate-1280.png         33631
route-03-activate-375.png          30046
route-03-activate-768.png          33046
route-04-verify-otp-1280.png       27299
route-04-verify-otp-375.png        24614
route-04-verify-otp-768.png        26927
route-05-forgot-password-1280.png  24403
route-05-forgot-password-375.png   21710
route-05-forgot-password-768.png   24041
route-06-reset-password-1280.png   28077
route-06-reset-password-375.png    24648
route-06-reset-password-768.png    27681
route-07-trace-1280.png            21049
route-07-trace-375.png             18402
route-07-trace-768.png             20844
route-08-privacy-1280.png          20201
route-08-privacy-375.png           17338
route-08-privacy-768.png           20124
route-09-terms-1280.png            19209
route-09-terms-375.png             16459
route-09-terms-768.png             19142
route-10-styleguide-1280.png      165098
route-10-styleguide-375.png       166230
route-10-styleguide-768.png       164760
route-11-home-1280.png             60479
route-11-home-375.png              42302
route-11-home-768.png              43198
route-12-admin-check-1280.png      46806
route-12-admin-check-375.png       28752
route-12-admin-check-768.png       30317
```

---

## E6 — Production Build, `dist/` Hygiene, CSP Meta Tag, and Token/Logger Hygiene

### 1. Production Build Fast-Fail (`missing`, `http://`, `https://`) and `dist/` Inspection

Command:

```powershell
Remove-Item Env:\VITE_API_BASE_URL -ErrorAction SilentlyContinue
npm run build
Write-Host "Exit code without VITE_API_BASE_URL: $LASTEXITCODE"

$env:VITE_API_BASE_URL = "http://api.tracex.example.com"
npm run build
Write-Host "Exit code with http:// VITE_API_BASE_URL: $LASTEXITCODE"

$env:VITE_API_BASE_URL = "https://api.tracex.example.com"
npm run build
Write-Host "Exit code with https:// VITE_API_BASE_URL: $LASTEXITCODE"

$distFiles = Get-ChildItem -Path "dist" -Recurse -File
Write-Host "dist files: $($distFiles.Name -join ', ')"
$localhostMatches = $distFiles | Select-String -Pattern "localhost|127\.0\.0\.1|styleguide"
Write-Host "Matches for localhost|127.0.0.1|styleguide in dist/: $($localhostMatches.Count)"
Get-Content "dist\index.html" -Raw
```

Real output:

```text
=== 4. Build without VITE_API_BASE_URL (must fail) ===

> tracex-frontend@1.0.0 build
> tsc -b && vite build

error during build:
Error: PRODUCTION BUILD ERROR: VITE_API_BASE_URL is required for production builds and must be a valid https:// URL.
Exit code without VITE_API_BASE_URL: 1

=== 5. Build with http:// VITE_API_BASE_URL (must fail) ===

> tracex-frontend@1.0.0 build
> tsc -b && vite build

error during build:
Error: PRODUCTION BUILD ERROR: VITE_API_BASE_URL must use https:// in production builds (received: "http://api.tracex.example.com").
Exit code with http:// VITE_API_BASE_URL: 1

=== 6. Build with https:// VITE_API_BASE_URL (must succeed) ===

> tracex-frontend@1.0.0 build
> tsc -b && vite build

vite v6.3.3 building for production...
transforming...
✓ 1710 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.85 kB │ gzip:   0.47 kB
dist/assets/index-DSvYkIBM.css   24.83 kB │ gzip:   5.21 kB
dist/assets/index-MubTUzxU.js   361.33 kB │ gzip: 109.27 kB
✓ built in 11.57s
Exit code with https:// VITE_API_BASE_URL: 0

=== 7. Inspect dist/ for localhost, 127.0.0.1, styleguide, inline <script>, and CSP meta ===
dist files: index.html, index-DSvYkIBM.css, index-MubTUzxU.js
Matches for localhost|127.0.0.1|styleguide in dist/: 0
--- dist/index.html ---
<!doctype html>
<html lang="en" data-theme="light" data-palette="editorial" data-accent="cobalt">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="TraceX - Batch Freshness, Quality Inspection, and FEFO Dispatch System" />
    <title>TraceX - Batch Freshness and Traceability</title>
    <script type="module" crossorigin src="/assets/index-MubTUzxU.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-DSvYkIBM.css">
      <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://api.tracex.example.com; base-uri 'self'; form-action 'self'" />
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
```

### 2. Token Storage (`sessionStorage` under `tx_token`), Logout/401 Clearing, and Logger Redaction

- **Browser verification (`E2E-01` & `E2E-05`)**:
  - `sessionStorage.keys` equals `["tx_token"]`, `localStorage.getItem("tx_token")` is `null`, and `document.cookie` is `""` for all 6 seeded accounts.
  - Clicking Sign Out (`E2E-01`) or receiving a `401` after `logout-all` (`E2E-05`) immediately clears `window.sessionStorage.getItem("tx_token")` to `null`.
- **Unit test verification (`src/auth/auth.test.tsx` & `src/components/ui/ui.test.tsx`)**:
  - `src/auth/auth.test.tsx > stores JWT exclusively in sessionStorage under tx_token and never in localStorage or cookies`
  - `src/components/ui/ui.test.tsx > redacts tokens, passwords, OTPs, and authorization headers in logger`

---

## E7 — OpenAPI Single Source of Truth (`backend/src/main/resources/openapi/tracex-api.yaml`)

### 1. Repository OpenAPI File Inventory

| File Path | Size (Bytes) | Operation Count | Role |
|---|---|---|---|
| backend/src/main/resources/openapi/tracex-api.yaml | 40857 | 40 | Single source of truth (read by `gen:api`, `scripts/generate-openapi.ps1`, `check:api-drift`, and `OpenApiExportTest`) |
| docs/openapi.json | 30300 | 40 | Generated JSON export verified compare-only against `tracex-api.yaml` by `OpenApiExportTest` and `check:api-drift` |
| frontend/src/api/generated/schema.d.ts | 74489 | 40 | Generated TypeScript schema verified compare-only in memory against `tracex-api.yaml` by `check:api-drift` |

### 2. Split Between Generate Script and Compare-Only Check

- **Generate scripts (explicit file generation only)**:
  - `frontend/scripts/generate-openapi.mjs` (invoked via `npm run gen:api` in `frontend/package.json`) and `scripts/generate-openapi.ps1`: read `backend/src/main/resources/openapi/tracex-api.yaml` and write `docs/openapi.json` and `frontend/src/api/generated/schema.d.ts`.
- **Compare-only checks (zero file writes)**:
  - `frontend/scripts/check-api-drift.mjs` (invoked via `npm run check:api-drift`): contains zero `writeFileSync` / `mkdirSync` / temp-file operations. It parses `backend/src/main/resources/openapi/tracex-api.yaml` in memory, compares its canonical JSON structure against `docs/openapi.json`, runs `openapiTS(pathToFileURL(openApiSpecPath))` + `astToString(ast)` in memory to compare against `frontend/src/api/generated/schema.d.ts`, and fails with exit code `1` on any difference.
  - `backend/src/test/java/com/tracex/OpenApiExportTest.java`: strictly compare-only (`Files.readString` + Jackson tree equality assertions between `/v3/api-docs.yaml`, `/v3/api-docs`, `backend/src/main/resources/openapi/tracex-api.yaml`, and `docs/openapi.json`; zero `Files.writeString` calls).

In `frontend/package.json`:

```json
"gen:api": "node scripts/generate-openapi.mjs",
"check:api-drift": "node scripts/check-api-drift.mjs"
```

### 3. Verification: Passing, Failing with Planted Difference (`docs/openapi.json` and `schema.d.ts`), and Passing Again

Command:

```powershell
# 1. Passing check
npm run check:api-drift
Write-Output "STEP1_PASS_EXIT=$LASTEXITCODE"

# 2. Planted difference in docs/openapi.json (must fail without writing files)
$origJson = [System.IO.File]::ReadAllText("$PWD\..\docs\openapi.json")
[System.IO.File]::WriteAllText("$PWD\..\docs\openapi.json", $origJson.Replace('"title": "TraceX API"', '"title": "TraceX API DRIFT"'))
npm run check:api-drift
Write-Output "STEP2_FAIL_OPENAPI_JSON_EXIT=$LASTEXITCODE"
[System.IO.File]::WriteAllText("$PWD\..\docs\openapi.json", $origJson)

# 3. Planted difference in src/api/generated/schema.d.ts (must fail without writing files)
$origDts = [System.IO.File]::ReadAllText("$PWD\src\api\generated\schema.d.ts")
[System.IO.File]::WriteAllText("$PWD\src\api\generated\schema.d.ts", $origDts + "`n// planted drift`n")
npm run check:api-drift
Write-Output "STEP3_FAIL_SCHEMA_DTS_EXIT=$LASTEXITCODE"
[System.IO.File]::WriteAllText("$PWD\src\api\generated\schema.d.ts", $origDts)

# 4. Passing again after restoration
npm run check:api-drift
Write-Output "STEP4_PASS_RESTORED_EXIT=$LASTEXITCODE"
```

Real output:

```text
> tracex-frontend@1.0.0 check:api-drift
> node scripts/check-api-drift.mjs

OpenAPI schema drift check PASSED (compare-only, 0 files written): src/api/generated/schema.d.ts and docs/openapi.json match backend/src/main/resources/openapi/tracex-api.yaml.
STEP1_PASS_EXIT=0

> tracex-frontend@1.0.0 check:api-drift
> node scripts/check-api-drift.mjs

OpenAPI copy drift detected: docs/openapi.json does not match backend/src/main/resources/openapi/tracex-api.yaml. Run `npm run gen:api` to regenerate.
STEP2_FAIL_OPENAPI_JSON_EXIT=1

> tracex-frontend@1.0.0 check:api-drift
> node scripts/check-api-drift.mjs

OpenAPI schema drift detected: src/api/generated/schema.d.ts is out of sync with backend/src/main/resources/openapi/tracex-api.yaml. Run `npm run gen:api` to regenerate.
STEP3_FAIL_SCHEMA_DTS_EXIT=1

> tracex-frontend@1.0.0 check:api-drift
> node scripts/check-api-drift.mjs

OpenAPI schema drift check PASSED (compare-only, 0 files written): src/api/generated/schema.d.ts and docs/openapi.json match backend/src/main/resources/openapi/tracex-api.yaml.
STEP4_PASS_RESTORED_EXIT=0
```

---

## E8 — `PROGRESS.md` Verification and Markdown Table Linter (`scripts/lint-md-tables.ps1`)

- Confirmed `PROGRESS.md` Dependency Versions table lists `Node.js` (`20.20.2`), `npm` (`10.8.2`), and every frontend dependency and devDependency with exact versions from `frontend/package-lock.json`.
- Confirmed `OI-03` is marked `Closed` for the client side in Phase 5 with a note that hosting CSP headers come in Phase 14.
- Confirmed `D-16`, `D-17`, `D-18`, and `D-19` are marked `Resolved` in `PROGRESS.md` and `SPEC.md`.
- Confirmed `Changes to earlier phases` includes the complete Phase 4.1 (`V1–V8`), Phase 4.2 (`R1–R4`), Phase 5 (`Parts A0–F`), and Phase 5.0 (`E1–E8`) entries.

Command:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/lint-md-tables.ps1
```

Real output:

```text
=== Markdown Table Linter ===
Scanning 26 Markdown files...


=== Summary ===
Files checked: 26
Errors: 0
Warnings: 0
STATUS: PASSED (Zero problems found)
```


