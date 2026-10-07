# TraceX — PROGRESS.md
> Updated: 2026-10-06 (Phase 8 COMPLETE)

---

## Phase Table

| Phase | Title | Status | Completed | Log |
|---|---|---|---|---|
| 0 | Audit reference, write SPEC.md | COMPLETE | 2026-10-01 | [phase-00](docs/progress/phase-00.md) |
| 0.1 | Correct SPEC.md, finish audit, apply team decisions | COMPLETE | 2026-10-02 | [phase-00-1](docs/progress/phase-00-1.md) |
| 0.2 | Reconcile PROGRESS.md with the build plan, settle D-3 and D-5 | COMPLETE | 2026-10-02 | [phase-00-2](docs/progress/phase-00-2.md) |
| 1 | Backend foundation (Spring Boot, security, envelope, seed, Docker v1) | COMPLETE | 2026-10-02 | [phase-01](docs/progress/phase-01.md) |
| 1.1 | Backend foundation fixes (password, rate limiter, safety guard, prod fast-fail, 405) | COMPLETE | 2026-10-02 | [phase-01-1](docs/progress/phase-01-1.md) |
| 2 | Users, access requests, RBAC matrix suite, audit log | COMPLETE | 2026-10-02 | [phase-02](docs/progress/phase-02.md) |
| 3 | Products and batches | COMPLETE | 2026-10-04 | [phase-03](docs/progress/phase-03.md) |
| 3.1 | Verification and repair pass | COMPLETE | 2026-10-04 | [phase-03](docs/progress/phase-03.md) |
| 3.2 | PROGRESS.md repair, changelog accuracy, error-code consistency | COMPLETE | 2026-10-04 | [phase-03-2](docs/progress/phase-03-2.md) |
| 4 | FEFO, inspections, dispatch | COMPLETE | 2026-10-04 | [phase-04](docs/progress/phase-04.md) |
| 4.1 | Phase 4 verification and repair pass | COMPLETE | 2026-10-04 | [phase-04-1](docs/progress/phase-04-1.md) |
| 4.2 | Date-only representation, scoped converter, EXCEPTION representation | COMPLETE | 2026-10-04 | [phase-04-2](docs/progress/phase-04-2.md) |
| 5 | Frontend foundation (shell, design system, auth, states) | COMPLETE | 2026-10-05 | [phase-05](docs/progress/phase-05.md) |
| 5.0 | Phase 5 verification and repair pass | COMPLETE | 2026-10-05 | [phase-05-0](docs/progress/phase-05-0.md) |
| 5.0.2 | Phase 5.0.2 confirmation pass | COMPLETE | 2026-10-05 | [phase-05-0-2](docs/progress/phase-05-0-2.md) |
| 5.1 | Per-page photo backdrops | COMPLETE | 2026-10-05 | [phase-05-1](docs/progress/phase-05-1.md) |
| 6 | Core feature UI (dashboard, batches, FEFO, inspections, dispatch) | COMPLETE | 2026-10-06 | [phase-06](docs/progress/phase-06.md) |
| 7 | QR and public trace (token-based) | COMPLETE | 2026-10-06 | [phase-07](docs/progress/phase-07.md) |
| 7.1 | Phase 7 evidence and test repair | COMPLETE | 2026-10-06 | [phase-07-1](docs/progress/phase-07-1.md) |
| 8.0 | Import reference extraction, SPEC §3.7, and Phase 7.1 carry-over | COMPLETE | 2026-10-06 | [phase-08-0](docs/progress/phase-08-0.md) |
| 8 | Import | COMPLETE | 2026-10-06 | [phase-08](docs/progress/phase-08.md) |
| 9 | Team admin UI, settings, login history | NOT STARTED | | |
| 10 | Notifications, messages, live updates (SSE) | NOT STARTED | | |
| 11 | AI and Google OAuth (conditional on the audit) | NOT STARTED | | |
| 12 | UI refinement, legal pages, favicon, documentation | NOT STARTED | | |
| 13 | Testing and hardening | NOT STARTED | | |
| 14 | Production preparation and deployment | NOT STARTED | | |

---

## Decisions

| ID | Decision | Status | Outcome | Where recorded |
|---|---|---|---|---|
| D-1 | Token storage: Authorization header vs httpOnly cookie | Resolved | Authorization header (`sessionStorage` under key `tx_token`) | SPEC §7, §8.1 |
| D-2 | Refresh tokens vs single long JWT | Resolved | Single 8h token, no refresh; per-request `tokenVersion` check revokes immediately | SPEC §6.1, §7 |
| D-3 | Google OAuth: was it a real working feature? | Resolved | Include as Should-have in Phase 11, enabled only when `GOOGLE_CLIENT_ID` (backend) and `VITE_GOOGLE_CLIENT_ID` (frontend) are set; unverified until the team supplies a client ID | SPEC §6.1, §11 |
| D-4 | Live-update mechanism: SSE vs Socket.IO vs polling | Resolved | SSE (fetch-based stream reader, authenticated like REST) | SPEC §6.1, §10 |
| D-5 | XLSX import: support alongside CSV? | Resolved | CSV only; XLSX is not parsed anywhere in the reference and is excluded from scope | SPEC §6.3, §8.1 |
| D-6 | FEFO defaults | Resolved | Accept §3.1 with fixes (`§3.1` is authoritative) | SPEC §3.1 |
| D-7 | Dev ports: API 8081, Vite 5174 | Resolved | Accept (API 8081, Vite 5174) | SPEC §8.3 |
| D-8 | Database name: `tracex_fresh` | Resolved | Accept (`tracex_fresh`) | SPEC §8.3 |
| D-9 | Farmer PII in AI prompts | Resolved | Omit `farmerName`; send `village` only | SPEC §7 |
| D-10 | Dispatch coordinator permissions | Resolved | `dispatch-coordinator`, `admin`, and `super-admin` may dispatch and override FEFO with reason; `dispatch-coordinator` cannot create batches | SPEC §2, §3.6 |
| D-11 | Batch code prefix: TX- vs HS- | Resolved | `TX-` (`TX-YYYY-MM-NNN`) | SPEC §3.2 |
| D-12 | Expired batches in dispatch queue | Resolved | Never dispatchable (`409 BATCH_EXPIRED`); excluded from FEFO `queue` and shown in `expired` | SPEC §3.1, §6.3 |
| D-13 | Inspection verdict logic | Resolved | Inspector sets verdict; server rejects `PASSED` when any checklist item is explicitly `false` | SPEC §3.3 |
| D-14 | Out-of-order dispatch | Resolved | Blocked (`409 DISPATCH_OUT_OF_ORDER`) unless `overrideReason` provided; override is audited | SPEC §3.5 |
| D-15 | Inspection TTL | Resolved | No TTL on Inspection documents — inspections are permanent | SPEC §3.3, §4 |
| D-16 | Freshness status tier (EXPIRED/URGENT/WARNING/READY/EXCEPTION/DISPATCHED) | Resolved | Derived at runtime from `expiryDate` (`LocalDate`) and injected `Clock` bean; never stored in MongoDB (only `lifecycleState` `ACTIVE`/`DISPATCHED` and `isDeleted` are stored). Compute logic lives in `BatchFreshness.java` | SPEC §3.1, §4 |
| D-17 | Date storage and comparison timezone | Resolved | Business calendar dates (`packDate`, `expiryDate`, `dispatchDate`, and `dispatchHistory[].dispatchDate`) are date-only values (`LocalDate`), stored in MongoDB and serialized in JSON as `"YYYY-MM-DD"` strings. All date-only display comparisons ("days until expiry") use `BUSINESS_TIME_ZONE` env var (default `Asia/Kolkata`) via the backend `Clock` bean. Audit/event timestamps remain UTC `Instant`s | SPEC §3.1, §4, §8.1 |
| D-18 | FEFO scope (per-SKU vs global) | Resolved | "Out of order" is evaluated per SKU: a batch is out of order if an eligible batch of the same SKU has a strictly earlier `expiryDate`. Batches with the same `expiryDate` are a tie and neither is out of order. The `category` and `sku` query filters on the FEFO endpoint apply before ordering | SPEC §3.1, §3.6 |
| D-19 | Quality hold on dispatch | Resolved | Reference `backend/src/controllers/batches.controller.js` lines 123–154 does not check `qualityCheck` or inspection status before dispatching. New build blocks dispatch when a batch's latest inspection verdict is `FAILED` (`409 QUALITY_HOLD`); a batch whose latest verdict is `FLAGGED` is dispatchable and returns a warning in the response | SPEC §3.6, §6.2 |
| D-20 | Per-page photographic backdrops | Resolved | Team decision: real team-supplied/approved photographs (with recorded source, author, licence, and licence URL in `design-assets/backdrops.json`) are allowed solely as decorative backdrops (`alt=""`, `aria-hidden="true"`) behind a flat colour overlay token (`--backdrop-scrim`), with content always on solid surface tokens and a flat fallback when images are off, blocked, or `Save-Data` is set. AI-generated imagery, fake UI screenshots, fake testimonials/logos, data-bearing imagery, unpermitted identifiable people, gradients, glass/blur, parallax, and hotlinked URLs remain banned | SPEC §5.2, §11 |
| D-21 | Server-computed dashboard summary endpoint (`GET /api/v1/dashboard/summary`) | Resolved | Reference `frontend/src/pages/Dashboard.jsx` lines 3186–3224 computed KPI counts and expiring-soon lists in the browser over a single page of batches. New build adds `GET /api/v1/dashboard/summary` (any authenticated role, matrix phase 6) returning server-computed counts (`EXPIRED`, `URGENT`, `WARNING`, `READY`, `EXCEPTION`) built with the exact `BatchFreshness.applyStatusFilter` builders, `dispatched` total, top 5 expiring batches from `FefoService`, latest-inspection verdict counts (`PASSED`, `FAILED`, `FLAGGED`, `none`), role-scoped `pendingAccessRequests` (`manager`/`admin`/`super-admin` only; `null` for others), and `businessDate` | SPEC §6.3, `docs/06-ui/screen-map.md` |
| D-22 | Trace token design (opaque HMAC token) | Resolved | Team decision: traceToken is opaque (16-byte SecureRandom nonce + 16-byte HMAC-SHA256(TRACE_TOKEN_SECRET, nonce) tag, base64url `<nonce>.<tag>`). Stored on batch in unique sparse indexed field `traceToken`. Verification is constant-time tag check before DB read. Token never changes for batch lifetime. Archiving returns 404, restoring makes link work. Dispatched batches remain publicly traceable showing status DISPATCHED. TRACE_TOKEN_SECRET must be stable. Prod profile fails fast if missing or < 32 chars. QR PNG returned as data URL | SPEC §4, §6.3, §7, §8.1, `docs/deployment-runbook.md` |
| D-23 | Import batch creation & validation code path | Resolved | Import commit creates batches through the same `BatchService` creation path as `POST /api/v1/batches` (so each imported batch gets an atomic `TX-YYYY-MM-NNN` batch code from `BatchCodeGenerator`, a `traceToken`, runtime freshness derivation, and standard validation), never by writing documents directly. Row validation reuses existing batch validators with no copied rules (`POST /api/v1/batches` does not reject future `packDate`, so import does not add a future-`packDate` rule) | SPEC §3.7 |
| D-24 | Import rollback semantics & guards | Resolved | Rollback soft-deletes only the batches the job inserted (`insertedBatchIds`), skipping any already-archived (`isDeleted: true`) batches and archiving the remaining active ones via `BatchService.archiveBatch` (`DELETE /api/v1/batches/{id}`) with reason `"Import rollback <jobId>"`, returning `{ archived, alreadyArchived }` and recording a job-level `IMPORT_ROLLED_BACK` audit entry; it never hard-deletes and does not undo updates made to existing batches. A `"running"` job with no update for `tracex.import.stale-running-minutes` (default `15`) is lazily marked `"failed"` (with `finishedAt` set) on list, detail, commit, and rollback. Rollback is allowed for `"done"` OR `"failed"` jobs with non-empty `insertedBatchIds`; it checks all preconditions first and returns HTTP `409 CONFLICT` (changing nothing) if any inserted batch has been dispatched (`lifecycleState == "DISPATCHED"`), if status is `"running"` or `"rolled_back"`, or if `insertedBatchIds` is empty | SPEC §3.7 |

---

## Open Issues

| ID | Issue | Severity | Status | Found in | Addressed in |
|---|---|---|---|---|---|
| OI-01 | FEFO queue does not filter `isDeleted: true` batches — they appear in the queue if status is READY/WARNING/URGENT | MEDIUM | Closed | `backend/src/controllers/dispatch.controller.js` line 7 | SPEC §3.1, §6.3 (Phase 4) |
| OI-02 | Batch code generation uses non-atomic findOne+increment; race condition on concurrent creates | MEDIUM | Closed | `backend/src/utils/batchCodeGenerator.js` lines 10–22 | SPEC §3.2, §4 (`counters` collection) (Phase 3) |
| OI-03 | Reference stores JWT in localStorage under key `hs_token` (confirmed). New build stores token in `sessionStorage` under key `tx_token` per D-1 / Step 0 (memory-only rejected due to reload logout; localStorage prohibited). XSS mitigations (strict CSP, short 8h expiry, per-request tokenVersion check) documented in SPEC §7 risk register. Closed for client side in Phase 5; hosting CSP headers come in Phase 14 | HIGH | Closed | `frontend/src/api/client.js` line 15; `frontend/src/pages/Login.jsx` line 742 | SPEC §7 (D-1, Step 0) (Phase 1 & Phase 5; hosting CSP headers in Phase 14) |
| OI-04 | Batch list (GET /api/batches) and FEFO queue (GET /api/dispatch/fefo) are unauthenticated in reference — expose PII | MEDIUM | Closed | `backend/src/routes/batches.routes.js` line 10, `backend/src/routes/dispatch.routes.js` line 3 | SPEC §6.3 (Phase 3 & Phase 4) |
| OI-05 | farmerName sent to third-party AI providers — privacy risk | MEDIUM | Open | `backend/src/services/aiService.js` lines 54–55 | SPEC §7 (D-9) (Phase 11) |
| OI-06 | Dispatch coordinator role has no distinct permissions; any authenticated user can dispatch in reference | LOW | Closed | `backend/src/routes/dispatch.routes.js` line 3; `backend/src/middleware/requireAdmin.js` line 17 | SPEC §2, §3.6 (D-10) (Phase 4) |
| OI-07 | `inspections` 30-day TTL destroys quality audit trail | MEDIUM | Closed | `backend/src/models/Inspection.model.js` line 78 | SPEC §3.3, §4 (D-15) (Phase 4) |
| OI-08 | Priority score not recalculated as days pass; stored value drifts | LOW | Closed | `backend/src/models/Batch.model.js`; `backend/src/services/expiryCalculator.js` lines 29–33 | SPEC §3.1 (display-only; canonical sort by status tier + expiryDate) (Phase 4) |
| OI-09 | HANDOFF.md uses `TX-` prefix; source code uses `HS-` prefix — resolved to `TX-` | LOW | Closed | `backend/src/utils/batchCodeGenerator.js` line 8 | SPEC §3.2 (D-11 resolved: `TX-` prefix adopted) (Phase 3) |
| OI-10 | `.git` directory presence in reference — confirmed absent via `Test-Path` (downloaded zip, not cloned git repo) | INFO | Closed | Reference workspace root | Resolved / Closed in Audit |
| OI-11 | All placeholder backdrops (`placeholder: true` in `design-assets/backdrops.json`) must be replaced with real licensed team-approved photos before launch | MEDIUM | Open | `design-assets/backdrops.json` | SPEC §5.2, §11 (Phase 14 launch gate) |

---

## Assumptions & Confirmed Findings

| ID | Finding / Clarification | Basis & Source Citation |
|---|---|---|
| A-01 | The Node.js backend was the reference implementation; Spring Boot was a partial port | `docs/00-audit/inventory.md` — Spring source audited: `BatchController`, `DispatchController`, `InspectionController`, `TraceController` present; AI, import, notifications, login history, messages absent. |
| A-02 | The active runtime port of Node backend is 8080 (not 5001 as in `.env.example`) | `frontend/vite.config.js` lines 10–12 proxies to 8080; `frontend/src/api/client.js` line 5 defaults to `http://localhost:8080`. New build uses port 8081. |
| A-03 | Firebase / Firestore is dead code in the reference application | `frontend/src/context/AuthContext.jsx` lines 1–66 contains Firebase auth boilerplate, but `frontend/src/pages/Login.jsx` lines 719–754 bypasses it and uses `@react-oauth/google` calling the backend REST API directly. |
| A-04 | The `shared/` folder listed in root structure does not exist | `Get-ChildItem` on reference root confirms `shared/` is absent. |
| A-05 | Bulk import is CSV only (no file upload to server) | `backend/src/controllers/import.controller.js` lines 7–9 confirms rows arrive as pre-parsed JSON; `backend/package.json` and `frontend/package.json` contain no XLSX libraries; `frontend/src/utils/csvParser.js` lines 1–50 parses CSV text only. D-5 resolved as CSV only. |
| A-06 | Controller bodies fully audited | All 1312 lines of `backend/src/controllers/auth.controller.js` audited: login lines 58–113, requestAccess 129–156, approve 178–243, reject 248–280, activate 288–374, verifyOtp 380–422, resendOtp 429–468, listUsers 474–512, toggleUserStatus 518–550, linkGoogle 553–617, unlinkGoogle 624–643, resendInvite 667–720, removeRequest 727–746, forgotPassword 750–845, verifyResetOtp 850–890, resetPassword 895–950, changePassword 955–1010, logoutAll 1015–1035, updateSettings 1040–1080, getMe 1085–1110, updateProfile 1115–1150, listDeletedUsers 1155–1190, restoreUser 1195–1240, hardDeleteUser 1245–1290, directory 1295–1312. |

---

## Dependency Versions

| Dependency | Version |
|---|---|
| Java | 21 (Eclipse Temurin 21.0.12.1+1-LTS) |
| Spring Boot | 3.2.5 |
| Spring Data MongoDB | 4.2.5 (via Spring Boot BOM) |
| MongoDB Java Driver | 4.11.2 (via Spring Boot BOM) |
| JJWT (jjwt-api / jjwt-impl / jjwt-jackson) | 0.12.5 |
| Springdoc OpenAPI | 2.5.0 |
| Maven Surefire | 3.2.5 |
| Maven Wrapper | 3.3.2 |
| Spring Boot Starter Mail | 3.2.5 (via Spring Boot BOM) |
| GreenMail JUnit5 | 2.0.1 |
| ZXing (core / javase) | 3.5.3 |
| Spring Security Test | 6.2.4 (via Spring Boot BOM) |
| Node.js | 20.20.2 |
| npm | 10.8.2 |
| react | 18.3.1 |
| react-dom | 18.3.1 |
| react-router-dom | 6.30.0 |
| @tanstack/react-query | 5.74.4 |
| react-hook-form | 7.56.1 |
| @hookform/resolvers | 5.0.1 |
| zod | 3.24.3 |
| lucide-react | 0.503.0 |
| vite | 6.3.3 |
| @vitejs/plugin-react | 4.4.1 |
| typescript | 5.8.3 |
| eslint | 9.25.1 |
| @eslint/js | 9.25.1 |
| typescript-eslint | 8.31.0 |
| eslint-plugin-jsx-a11y | 6.10.2 |
| eslint-plugin-react-hooks | 5.2.0 |
| globals | 16.0.0 |
| openapi-typescript | 7.6.1 |
| sharp | 0.35.5 |
| vitest | 3.1.2 |
| @vitest/coverage-v8 | 3.1.2 |
| jsdom | 26.1.0 |
| @testing-library/react | 16.3.0 |
| @testing-library/user-event | 14.6.1 |
| @testing-library/jest-dom | 6.6.3 |
| axe-core | 4.10.3 |
| vitest-axe | 0.1.0 |
| @playwright/test | 1.52.0 |
| @axe-core/playwright | 4.10.2 |
| @types/node | 22.14.1 |
| @types/react | 18.3.20 |
| @types/react-dom | 18.3.6 |

---

## Changes to earlier phases

### Phase 0 → 0.1 corrections applied
- **Stack**: SPEC.md rewritten for Java/Spring Boot backend, React/Vite/TypeScript frontend. Removed all Jest, Vercel, Railway, Redis references.
- **Decisions D-1 through D-15**: All applied; D-3 and D-5 remained OPEN with stated blockers.
- **§6 paths**: Changed from `/api/` to `/api/v1/`. Error envelope adds `requestId` and `fieldErrors`. OpenAPI spec location added.
- **§6.3 auth**: `GET /api/v1/batches`, `/:id`, `/:id/qr`, `/:id/scans`, `GET /api/v1/dispatch/fefo` moved from public to authenticated. Trace-by-batchCode removed. Forgot-password documented as always-200. Public trace DTO whitelisted (no farmerName, no internal IDs).
- **§8.2**: `PUBLIC_BASE_URL` renamed to `PUBLIC_TRACE_BASE_URL`; defined as the frontend origin; production refuses localhost/private addresses.
- **§3.1**: `priorityScore` marked display-only. Sort order is by status tier + expiryDate, not score. Expired batches excluded from queue (D-12). "archive" and "soft-delete" are the same concept throughout. Emergency-dispatch path removed from §3.5 diagram.
- **§3.3**: Inspection TTL removed (D-15). Verdict server validation rule added (D-13).
- **§3.5**: Out-of-order dispatch override documented with audit trail (D-14). Last-super-admin guard added.
- **§2**: Five role values (not six) plus isSuperAdmin flag. Last-super-admin guard described.
- **§4**: Added `counters`, `audit_logs`, `dispatches` (as `dispatchHistory[]` on Batch) collections. All schemas confirmed from source files. Inspection TTL removed.
- **§7**: Rate limits added for login, request-access, forgot-password, public trace. Import row cap confirmed (500/chunk). Farmer PII exclusion from AI added (D-9).
- **§5.2**: Banned patterns expanded to 12 items.
- **§8.1**: Spring Mail env vars added. Dev ports confirmed. Spring Boot env vars.
- **§9**: Stack changed to JUnit 5/Testcontainers/Vitest/Playwright. Naming convention updated.
- **§10**: Deployment to Firebase Hosting + Render Docker + Atlas. Docker section added.
- **§11**: Feature finding vocabulary added (Verified/Implemented-NV/Not implemented/Blocked).
- **Audit files**: All 9 Unconfirmed entries resolved. Spring Boot section in inventory.md updated with confirmed controller/model list. HANDOFF discrepancy on InspectionController corrected.
- **permission-matrix.csv**: Paths updated to `/api/v1/`. Dispatch-coordinator explicitly denied on create/inspect. Manager explicitly denied on dispatch/inspect. Notes column added for context.

---

### Phase 0.1 → 0.2 corrections applied
- **Phase Table**: Aligned with the 15-phase plan (1: Backend foundation, 2: Users/RBAC, 3: Products/Batches, 4: FEFO/Inspections/Dispatch, 5: Frontend foundation, 6: Core feature UI, 7: QR/trace, 8: Import, 9: Admin UI, 10: Notifications/SSE, 11: AI/OAuth, 12: UI refinement, 13: Testing, 14: Deployment).
- **D-3 RESOLVED**: Google OAuth confirmed wired end-to-end (`frontend/src/main.jsx` line 23, `frontend/src/pages/Login.jsx` lines 719–754, `backend/src/services/googleIdentity.js` lines 14–62, `backend/src/controllers/googleAuth.controller.js` lines 29–84, `backend/src/controllers/auth.controller.js` lines 553–643). Resolved as Should-have in Phase 11, enabled only when `GOOGLE_CLIENT_ID` / `VITE_GOOGLE_CLIENT_ID` are provided.
- **D-5 RESOLVED**: XLSX support confirmed absent from entire reference codebase (`import.controller.js` lines 7–9 accepts pre-parsed JSON rows only; `backend/package.json` and `frontend/package.json` contain no spreadsheet libraries; `csvParser.js` lines 1–50 parses CSV text only). Resolved as CSV only; XLSX excluded from scope.
- **OI-03 & Storage**: Updated OI-03 to reflect confirmed finding from `frontend/src/api/client.js` line 15 (`localStorage.getItem('hs_token')`) and confirmed D-1 resolution (Authorization header; client stores token in memory/sessionStorage, key `tx_token`).
- **All Open Issues**: Added "Addressed in" column linking each issue to its SPEC section and target build phase.
- **Dispatch & Override Roles**: Updated SPEC §2, §3.6, and `docs/permission-matrix.csv` to state explicitly that `dispatch-coordinator`, `admin`, and `super-admin` are authorized to dispatch and to override FEFO order with an audited reason; all other roles are denied.
- **Super-Admin Test Modeling**: Defined explicitly in SPEC §2 how super-admin is modeled in tests (user document with `isSuperAdmin: true` and baseline `role: 'admin'`).
- **Hedge-Word Cleanup**: Scanned and eliminated all hedge words (`likely`, `unconfirmed`, `not confirmed`, `not fully read`, `assum`, `probably`, `TBD`) across `docs/00-audit/` and `SPEC.md`.
- **Traceability Matrix**: Re-aligned `docs/traceability.md` requirement phase mappings to the 15-phase plan.

---

### Phase 0.2 → Phase 1 Step 0 corrections applied
- **Token Storage Decision (Step 0)**: Resolved client token storage to `sessionStorage` under key `tx_token`. Memory-only was rejected because it would log the user out on every page reload (no refresh tokens per D-2). Added XSS risk and 3-tier mitigations (strict CSP, 8h token expiry, per-request `tokenVersion` check) to SPEC §7 Risk Register.
- **OI-03 Updated**: Corrected to explicitly specify `sessionStorage` under `tx_token` with SPEC §7 risk mitigations.

---

### Phase 0.2 → Phase 1 corrections applied (Pre-checks)
- **Pre-check A (HealthController & Actuator Configuration)**:
  - DELETED `backend/src/main/java/com/tracex/controller/HealthController.java` — was a hand-written controller that always returned `{"status":"UP"}` without a real MongoDB indicator. Replaced by Spring Actuator's `/actuator/health` endpoint only.
  - `application.properties`: Changed `management.endpoint.health.show-details` from `always` to `never`. Removed `show-components` (was added accidentally). Production and dev profiles now return `{"status":"UP"}` with no component details (safe).
  - `application-test.properties`: Added `management.endpoint.health.show-details=always` and `show-components=always` so `testActuatorHealthReportsDatabaseUp` can assert `$.components.mongo.status`.
  - `SecurityConfig.java`: Removed `/api/v1/health` from `permitAll` list (endpoint deleted).
  - `docs/permission-matrix.csv`: Replaced `GET,/api/v1/health` row with `GET,/actuator/health`.
  - `ConfigurationAndSeedTests.java`: Updated `testRequestIdOnEveryResponse` to check `X-Request-Id` header on `/actuator/health` and `requestId` body on `/api/v1/auth/me` error; restored `$.components.mongo.status` assertion in `testActuatorHealthReportsDatabaseUp`.
  - `GlobalExceptionHandler.java`: Added `HttpRequestMethodNotSupportedException` → 405 and `NoHandlerFoundException` → 404 handlers so wrong-method and unknown-route return proper TraceX-envelope responses instead of falling through to 500 INTERNAL_ERROR.
- **Pre-check B (Testcontainers Deviation)**:
  - Integration tests run against a local MongoDB standalone (`localhost:27017`) in the `test` profile using database `tracex_fresh_test`. Docker is not installed on this machine, so Testcontainers (SPEC §9) cannot be used. **Deviation recorded**: SPEC §9 mandates Testcontainers; current tests use a local MongoDB instance. Test database is `tracex_fresh_test` — isolated from `tracex_fresh_dev` and `tracex_fresh` by name.
- **Pre-check C (Test Controller Isolation)**: TestRestrictedController confirmed in `src/test/java` only, not in main jar.

---

### Phase 1 → 1.1 corrections applied (Fixes a to f)
- **Fix a (Seed Password)**: Removed fallback password `:DemoPass123!` from `SeedRunner.java` and from base `application.properties`. `SeedRunner` now requires `SEED_DEFAULT_PASSWORD` whenever seeding runs. `AppConfig.java` validates that in `prod` profile with `SEED_ENABLED=true`, `SEED_DEFAULT_PASSWORD` must be present and at least 12 characters, else fast-fails with `IllegalStateException` naming `SEED_DEFAULT_PASSWORD`. `application-dev.properties` configures `DevPass123456!`; `application-test.properties` and test resources configure `TestPass123456!`. Search of `src/main` for `DemoPass123!` yields 0 results. Added regression test `testProdProfileFailsFastWithoutValidSeedDefaultPasswordWhenSeedEnabled`.
- **Fix b (Rate Limiter Client Key & Forwarded Headers)**: Added `resolveClientIp(HttpServletRequest)` to `RateLimiter.java`, strictly using `request.getRemoteAddr()`. Removed direct `X-Forwarded-For` parsing from `AuthController.java` to prevent IP spoofing. Configured `server.forward-headers-strategy=none` in base `application.properties` (dev and test) and `${SERVER_FORWARD_HEADERS_STRATEGY:framework}` in `application-prod.properties` *(Note: Phase 2 superseded this with native `server.forward-headers-strategy=native` based on empirical proxy testing)*. Documented in SPEC §7. Added regression test `testSpoofedForwardedHeadersDoNotBypassRateLimit`. Verified live with 12 sequential requests carrying unique `X-Forwarded-For` IPs (429 on 11th).
- **Fix c (Test Database Safety Guard)**: Created `TestDatabaseSafetyGuard.checkTestDatabase(MongoTemplate)` enforcing that tests modifying data only execute against databases ending in `_test`. Wired into `@BeforeEach` of `AuthLoginTests`, `TokenAndSessionTests`, and `ConfigurationAndSeedTests`. Added regression test `testSafetyGuardAbortsWhenDatabaseNameDoesNotEndWithTest`. Verified live that pointing test profile at `tracex_fresh_dev` immediately aborts with `IllegalStateException` and leaves all 6 dev users untouched.
- **Fix d (Live Prod Profile Fail-Fast Checks)**: Re-ran Phase 1 Check 3 live via PowerShell environment variables (`$env:SPRING_PROFILES_ACTIVE='prod'`) for missing `JWT_SECRET`, 10-char `JWT_SECRET`, empty `FRONTEND_URL`, and missing `SEED_DEFAULT_PASSWORD`. All 4 failed startup naming their respective variable. Variables cleared afterwards.
- **Fix e (PROGRESS.md Tables Clean-Up)**: Cleaned markdown tables to eliminate all unescaped pipe characters in Phase 0.2 Check 4, Phase 1 Check 6, and Phase 1 Check 11 that previously caused column truncation. Moved raw commands and outputs into dedicated code blocks.
- **Fix f (HTTP 405 METHOD_NOT_ALLOWED)**: Added `ErrorCode.METHOD_NOT_ALLOWED = "METHOD_NOT_ALLOWED"`, documented in SPEC §6.2 (405), mapped in `GlobalExceptionHandler.handleMethodNotAllowed`, added regression test `testWrongHttpMethodReturns405MethodNotAllowed`, and verified live that `GET /api/v1/auth/login` returns HTTP 405 with `METHOD_NOT_ALLOWED` and `X-Request-Id`.

---

### Phase 2 Carry-Over Fixes & Architecture (Parts A1–A4)
- **Part A1 (Global Test Database Safety Guard)**: Created `GlobalTestDatabaseSafetyExtension` registered via `junit-platform.properties` (with `junit.jupiter.extensions.autodetection.enabled=true`) and `META-INF/services/org.junit.jupiter.api.extension.Extension`. Automatically verifies every Spring test connects exclusively to databases ending with `_test`, aborting execution if any test targets `tracex_fresh_dev` or `tracex_fresh`.
- **Part A2 (Empirical Forwarded Headers Analysis & Strategy Decision)**: Evaluated forwarded header handling via `ForwardedHeadersEmpiricalTest`. The test demonstrated that both `framework` and `native` strategies resolve the forwarded client address when requests arrive from a trusted loopback address. When incoming connections originate from an untrusted address (not matching `server.tomcat.remoteip.internal-proxies`), the `native` strategy ignores the spoofed `X-Forwarded-For` header and preserves the true remote address; the `framework` strategy was not tested from an untrusted address. Decided on `server.forward-headers-strategy=native` for Render production deployment and `none` for dev/test, extracting client IP strictly via `request.getRemoteAddr()` in `RateLimiter`.
- **Part A3 (Deployment Runbook Hardening)**: Created `docs/deployment-runbook.md` documenting production promotion of the initial super-admin directly via `mongosh` (since no API endpoint can promote to super-admin per SPEC §2) and established operations safety rules: Rule 1 (Last Super-Admin Protection), Rule 2 (Audit Verification), and Rule 3 (Profile and Seed Password Isolation: prohibiting `dev`/`test` seed passwords against shared or production databases, enforced by `GlobalTestDatabaseSafetyExtension`). (Rule 4: Rate-Limit Bucket Isolation was subsequently added in Phase 3).
- **Part A4 (OpenAPI Specification Export)**: Exported OpenAPI specification generated via Springdoc. The single source of truth is `backend/src/main/resources/openapi/tracex-api.yaml` (31,744 bytes, 33 paths, 36 operations), synchronized with `docs/openapi.json` (23,556 bytes, 33 paths, 36 operations), containing all Phase 1, Phase 2, and Phase 3 endpoints.

---

### Phase 3 Changes & Housekeeping (Parts A–J)
- **Part A1 (PROGRESS.md Split)**: Split monolithic `PROGRESS.md` by moving phase checks logs verbatim to `docs/progress/phase-00.md` through `docs/progress/phase-03.md`. Verified line counts.
- **Part A2 (Admin-vs-Admin Rules Table)**: Added complete 28-cell Admin-vs-Admin Action Rules matrix to SPEC.md §2.
- **Part A3 & G (Anonymous Matrix Column)**: Added `anonymous` column to `docs/permission-matrix.csv`, requiring `AUTH_NO_TOKEN` (HTTP 401) for non-public endpoints.
- **Part A5 (Rate-Limit Bucket Isolation Check)**: Added Rule 4 to `docs/deployment-runbook.md` to verify rate-limit isolation between distinct networks post-deploy.
- **Part B1 & B2 (D-16 & D-17 Decisions)**: Succeeded D-16 (freshness status is dynamically derived at runtime from `expiryDate` + `Clock`, not stored in MongoDB) and D-17 (business timezone default `Asia/Kolkata` for date comparisons).
- **Part C & D (Product & Batch Models, Atomic Codes, Freshness)**: Created `Product`, `Counter`, `Batch` (with `@Version` for optimistic locking). Implemented atomic monthly batch code generator (`BatchCodeGenerator`, `TX-YYYY-MM-NNN`) and unified `BatchFreshness` thresholds. Handled `OptimisticLockingFailureException` -> 409 `CONFLICT`.
- **Part E & F (Controllers, Service, Seeding)**: Built `ProductController` and `BatchController` (CRUD, archive, restore, note history, raw-material correction, audit trail). Idempotently seeded 5 products and 12 demo batches across freshness tiers.

---

### Phase 3.1 Verification & Repair Pass (F1–F5)
- **F1 (Changes to Earlier Phases Integrity)**: Restored all historical changes across Phases 0, 0.1, 0.2, 1, 1.1, 2, 3 into a single merged section in `PROGRESS.md`. Added note superseding framework strategy with native.
- **F2 (SeedRunner Bypass Removal & Loud Failure)**: Removed fallback password bypass from `SeedRunner.java`. Bound property to `tracex.seed.default-password`. Enforced loud startup/seed failure naming `SEED_DEFAULT_PASSWORD` in every profile whenever seeding is enabled and password is missing. Added regression test `testSeedRunnerFailsLoudlyWhenSeedEnabledAndPasswordMissing` and verified non-zero seed counts.
- **F3 (Admin-vs-Admin 28-Cell Test Suite)**: Created `AdminVsAdminRulesTest.java` verifying all 28 cells of the SPEC §2 Admin-vs-Admin matrix. Corrected `UserService` guard order so secondary admins receive 403 `RBAC_INSUFFICIENT` for all operations targeting super-admins.
- **F4 (Comprehensive Product & Batch Test Inventory)**: Added 33 dedicated tests in `ProductAndBatchTests.java` covering 50-thread concurrent contiguous generation, month rollover, year rollover, 1000th 4-digit sequence, fixed-clock boundary tiers, dynamic clock advancement with zero writes, 23:30 UTC timezone boundary, 422 `VALIDATION_ERROR` with field errors, predicted/base/manual expiry formulas, literal regex search, non-whitelisted sort 422 rejection, concurrent edit 409 conflict, archive/restore visibility, 401 on missing token across all endpoints, and farmer PII exclusion from audit logs.
- **F5 (Re-run 15 Checks & Live Dev Server Trace)**: Re-ran all 15 Phase 3 checks live with real command outputs logged into `docs/progress/phase-03.md`.

---

### Phase 3.2 Repair Pass (Parts A–C)
- **Part A (Markdown Table Normalization & Linter)**: Rebuilt Phase Table (19 rows), Decisions (17 rows), Open Issues (10 rows + Status column), Assumptions (6 rows), and Dependency Versions (11 rows) in `PROGRESS.md` with strict header/separator/row syntax. Developed `scripts/lint-md-tables.ps1` to detect missing separators, column mismatches, broken separator fragments, and unescaped pipes across all project markdown files. Fixed column count discrepancies in `SPEC.md` §6.3 Notifications and AI Audit tables.
- **Part B (Changelog Accuracy Corrections)**:
  - B1 (Forwarded Headers): Corrected description to accurately reflect `ForwardedHeadersEmpiricalTest`: both `framework` and `native` resolve headers from trusted loopback, `native` ignores spoofed headers from untrusted connections, and `framework` was untrusted-untested. Removed unrelated 12 sequential requests claim.
  - B2 (Runbook Verification): Aligned changelog with actual rules in `docs/deployment-runbook.md` (Rule 1: Last Super-Admin Protection, Rule 2: Audit Verification, Rule 3: Profile and Seed Password Isolation, Rule 4: Rate-Limit Bucket Isolation).
  - B3 (OpenAPI Single Source of Truth): Regenerated clean OpenAPI 3.0.1 specifications containing all 33 paths and 36 operations (including all Phase 3 endpoints). Single source of truth designated as `backend/src/main/resources/openapi/tracex-api.yaml` (31,744 bytes), with synchronized `docs/openapi.json` export (23,556 bytes). Removed stale corrupted byte-dump file.
- **Part C (Error Code Consistency & Spec Synchronization)**:
  - C1: Standardized self-modification denial to HTTP 409 `SELF_MODIFICATION_NOT_ALLOWED` across user toggle, role update, and delete actions. Preserved HTTP 409 `LAST_SUPERADMIN` for removing the last active super-admin, and HTTP 403 `RBAC_INSUFFICIENT` for hierarchy violations. Updated `UserService`, `SPEC.md` §2 28-cell matrix, `SPEC.md` §6.2 error codes table, and test suite.
  - C2: Added `ErrorCodeSpecSyncTest` enforcing strict bidirectional synchronization between `ErrorCode` enum and `SPEC.md` §6.2 table. Fixed MockMvc enum-to-string value matching across integration tests.

---

### Phase 4 Carry-Over Fixes & Spec Refinements
- **OpenAPI vs Permission Matrix Parity**: Identified why Phase 3.2 had 36 OpenAPI operations vs 34 active matrix rows (1 Actuator `/actuator/health` row outside `/api/v1` scan, plus 3 test-only routes from `TestRestrictedController` on the test classpath). Configured `springdoc.paths-to-exclude=/api/v1/test/**` in `application.properties` and `src/test/resources/application.properties`, and added 1-to-1 parity assertions in `OpenApiExportTest` (40 `/api/v1/**` OpenAPI operations = 40 `/api/v1/**` matrix rows for `phase <= 4`, plus 1 `/actuator/health` row = 41 active matrix rows).
- **SPEC §2 Precedence Rule**: Documented explicit precedence in `SPEC.md` §2 when the actor is the sole active super-admin targeting themselves (`LAST_SUPERADMIN` wins on `toggle` and `delete`; `SELF_MODIFICATION_NOT_ALLOWED` wins on `role-change`) and added `testPrecedenceWhenBothSelfModificationAndLastSuperAdminApply_toggleRoleChangeDelete` in `AdminVsAdminRulesTest`.
- **SPEC §3.1, §3.3, §3.6, §4, §6.2, §6.3 Updates**: Recorded `D-18` (per-SKU FEFO scope and tie rule, enforced with HTTP 409 `DISPATCH_OUT_OF_ORDER`) and `D-19` (quality hold on `FAILED` verdict -> HTTP 409 `QUALITY_HOLD`; `FLAGGED` allowed with warning) as `Proposed`, verified `DISPATCH_OUT_OF_ORDER` and added `BATCH_EXPIRED` and `QUALITY_HOLD` to `ErrorCode` and `SPEC.md` §6.2, documented the `inspections` partial unique index (`{ batchId: 1 }` where `{ isLatest: true }`) and standalone MongoDB ordered write sequence in `SPEC.md` §4, and centralized freshness thresholds in `BatchFreshness`.

---

### Phase 4.1 Verification & Repair Pass (V1–V8)
- **V1 (Test Inventory & Gap Additions)**: Audited every test method in `FefoServiceTest`, `InspectionAndDispatchTests`, and `OpenApiExportTest`. Added missing tests in `FefoServiceTest` for empty queue (`testEmptyFefoQueue`), dynamic re-ranking across raw-material edit, dispatch, archive, and restore (`testOrderAfterEditDispatchArchiveAndRestore`), and the `23:30 UTC` (`05:00 IST` next day) `Asia/Kolkata` business-zone boundary across FEFO and dispatch (`testBusinessTimezone2330UtcBoundaryInFefoAndDispatch`), and expanded `testDispatchExpiredTodayAndYesterdayReturnsBatchExpired` in `InspectionAndDispatchTests` to also assert that expiring tomorrow (`+1` day) succeeds (`200 OK`).
- **V2 (Tolerant Reads on Corrupted `expiryDate`)**: Registered `AppConfig.LenientStringToInstantConverter` (`@ReadingConverter`) in `MongoCustomConversions` so unparseable BSON string timestamps (e.g. `"not-a-date"`) log a warning and deserialize as `null` rather than throwing HTTP 500 on `GET /api/v1/batches` and `GET /api/v1/batches/{id}`. Added `exceptionReason` to `BatchSummaryDto`, updated `BatchFreshness.calculateStatus` and `BatchService.enrichSummary` to map `expiryDate == null` on non-dispatched batches to `status = "EXCEPTION"`, `daysUntilExpiry = 0`, and `exceptionReason`, and documented this representation in `SPEC.md` §3.1. Added `testCorruptedExpiryDateDoesNotBreakFefoOrBatchReads` verifying missing, `null`, and `"not-a-date"` raw documents across `GET /api/v1/dispatch/fefo`, `GET /api/v1/batches`, and `GET /api/v1/batches/{id}` with full cleanup.
- **V3 (`priorityScore` Display-Only Verification)**: Verified in `FefoService` and `FefoServiceTest#testPriorityScoreDoesNotAffectQueueOrdering` that `priorityScore` is display-only (`Math.max(0, 100 - daysUntilExpiry * 3)`) and never influences FEFO queue ordering (which sorts strictly by freshness tier then `expiryDate` ascending, then `createdAt` ascending, then `batchCode` ascending).
- **V4 (Dispatch Race, Out-of-Order Override, and Quality-Hold Verification)**: Verified in `InspectionAndDispatchTests` that 20-thread concurrent dispatch on the same batch allows exactly 1 HTTP 200 and 19 HTTP 409 `ALREADY_DISPATCHED`, per-SKU out-of-order dispatch returns HTTP 409 `DISPATCH_OUT_OF_ORDER` without `overrideReason` and succeeds with an audited reason, same-expiry ties (`D-18`) allow either batch without override, and `FAILED` latest inspection blocks dispatch with HTTP 409 `QUALITY_HOLD` (`D-19`) while `FLAGGED` succeeds with a warning.
- **V5 (Inspection Append-Only 405 & Concurrency Partial Unique Index)**: Verified in `InspectionAndDispatchTests` that `PUT`/`PATCH`/`DELETE` on `/api/v1/inspections` return HTTP 405 `METHOD_NOT_ALLOWED`, no TTL index exists on `inspections` (`D-15`), and the partial unique index `{ batchId: 1 }` where `{ isLatest: true }` guarantees exactly one `isLatest: true` document under 20-thread concurrent inspection creation.
- **V6 (OpenAPI 1-to-1 Matrix Parity)**: Verified in `OpenApiExportTest` that the 40 `/api/v1/**` OpenAPI operations match the 40 `/api/v1/**` rows in `docs/permission-matrix.csv` for `phase <= 4` (plus `/actuator/health` = 41 active rows), with `TestRestrictedController` excluded via `springdoc.paths-to-exclude=/api/v1/test/**`.
- **V7 (Decisions Table Outcome Column)**: Added the `Outcome` column to the `Decisions` table (`D-1` through `D-19`) in `PROGRESS.md` using wording from `SPEC.md`.
- **V8 (16 Phase 4 Checks Re-Verified Live)**: Re-ran and logged all 16 Phase 4 verification checks with real command outputs in `docs/progress/phase-04-1.md`.

---

### Phase 4.2 Repair Pass (R1–R4)
- **R1 (Date-Only Storage & Serialization for `packDate` and `expiryDate`)**: Migrated `packDate` and `expiryDate` from `Instant` (previously stored as BSON `Date` and serialized as ISO-8601 instant strings) to `LocalDate` across `Batch`, `BatchSummaryDto`, `BatchDetailDto`, `BatchCreateDto`, `BatchRawMaterialDto`, `BatchFreshness`, `BatchService`, `FefoService`, and `SeedRunner`. Both fields are now persisted in MongoDB as `"YYYY-MM-DD"` BSON strings via `@ValueConverter(BatchLocalDateValueConverter.class)` and returned by the API as `"YYYY-MM-DD"` strings (`type: "string", format: "date"` in OpenAPI). Added `testCreateAndReadBatchDateRoundTripAcrossTimeZones` verifying seeded batch storage and create-and-read round-trip of `"2026-10-09"` with the JVM default time zone set to `UTC`, `Asia/Kolkata`, and `America/Los_Angeles`.
- **R2 (Property-Scoped Lenient Converter & Fail-Closed Security Expiries)**: Removed global `LenientStringToInstantConverter` and `mongoCustomConversions()` from `AppConfig.java` and scoped date-read leniency strictly to `Batch.packDate` and `Batch.expiryDate` via `@ValueConverter(BatchLocalDateValueConverter.class)`. Added fail-closed read guards (`findAccessRequestByInviteTokenOrFailClosed`, `findUserByEmailOrFailClosed`) in `UserService.java` so corrupted `inviteExpiry`, `otpExpiry`, or `resetTokenExpiry` values in MongoDB fail closed with HTTP `401 AUTH_INVALID_TOKEN` and the standard error envelope. Added `testCorruptedSecurityExpiriesFailClosed` in `AccessRequestAndUserFlowTests.java`.
- **R3 (`EXCEPTION` Representation, Nullable `daysUntilExpiry`, OpenAPI Enum, and `status=EXCEPTION` Filter)**: Changed `BatchSummaryDto.daysUntilExpiry` to nullable `Long` and updated `BatchService.enrichSummary` and `FefoService` to return `daysUntilExpiry: null` (instead of `0`) whenever `expiryDate` is missing, `null`, or unparseable (`status: "EXCEPTION"`), with `exceptionReason` populated only when `status` is `"EXCEPTION"`. Added `@Schema(allowableValues = {"EXPIRED", "URGENT", "WARNING", "READY", "EXCEPTION", "DISPATCHED"})` on `BatchSummaryDto.status`, added `status=EXCEPTION` filtering to `BatchFreshness.applyStatusFilter`, updated `SPEC.md` (§3.1, §4, §6.3) and regenerated OpenAPI specs, and added `testExceptionStatusFilterAndNullableDaysUntilExpiry` in `ProductAndBatchTests.java`.

---

### Phase 5 Backend Carry-Over & Frontend Foundation (Parts A0–F)
- **A0-1 (Tier Filters & Corrupted Dates)**: Added ISO date pattern constraint to `EXPIRED`, `URGENT`, `WARNING`, and `READY` tier queries in `BatchService.buildFilterCriteria` so corrupted string values such as `"not-a-date"` never match tier filters and are returned only by `status=EXCEPTION` and FEFO `exceptions`.
- **A0-2 (Business Dates `dispatchDate` and `dispatchHistory[].dispatchDate`)**: Migrated `Batch.dispatchDate`, `Batch.DispatchHistoryEntry.dispatchDate`, and `BatchDetailDto.dispatchDate` from `Instant` to `LocalDate` (`"YYYY-MM-DD"` string in MongoDB storage and API JSON), updated `DispatchService` and `SeedRunner`, regenerated OpenAPI exports (`backend/src/main/resources/openapi/tracex-api.yaml` and `docs/openapi.json`), updated `SPEC.md` §4 and §6.3, and added `testDispatchDateRoundTripAcrossTimeZones` across `UTC`, `Asia/Kolkata`, and `America/Los_Angeles`.
- **A0-3 (Clock Leakage & Random Test Order)**: Updated `SeedRunner.seedBatches` to derive the `TX-YYYY-MM-NNN` batch code prefix from the injected `Clock` (`LocalDate.now(clock)`), restored `TimeZone.getDefault()` after each test in `GlobalTestDatabaseSafetyExtension`, and enabled random method ordering via `junit-platform.properties`.
- **Part A (Frontend Toolchain, Strict Config, Generated API Schema, and Lexical Date Helpers)**: Scaffolded `frontend/` with Vite 6, React 18, TypeScript 5.8 (`strict: true`, `noUncheckedIndexedAccess: true`), ESLint 9 (`jsx-a11y`, `react-hooks`), Vitest + `vitest-axe`, and Playwright + `@axe-core/playwright`. Configured production build guard in `vite.config.ts` requiring `VITE_API_BASE_URL` with `https://` and injecting a strict Content-Security-Policy `<meta>` tag. Added `src/api/generated/schema.d.ts`, `src/lib/dates.ts` (lexical `"YYYY-MM-DD"` comparison/formatting without `new Date("YYYY-MM-DD")`), and `src/lib/logger.ts` (redacting tokens, passwords, OTPs, and `Authorization` headers).
- **Part B (Design Tokens, 3 Palettes x 2 Modes x 4 Accents, Contrast & Banned-Pattern Scripts)**: Built `src/styles/tokens.css` and `src/styles/base.css` implementing 3 palettes (`editorial`, `technical`, `warm`) across `light` and `dark` modes plus 4 accents (`cobalt`, `emerald`, `amber`, `plum`). Added `scripts/check-contrast.mjs` (verifying 138 text/surface/badge/focus token pairs against WCAG 2.1 AA thresholds) and `scripts/check-banned-patterns.mjs` (enforcing SPEC §5.2 banned visual/code patterns and prohibiting raw hex/rgb literals outside `tokens.css`).
- **Part C (Accessible Shared UI Primitives & States)**: Implemented accessible primitives in `src/components/ui/`: `Button`, `Field`, `PasswordInput`, `Select`, `StatusBadge` (pairing icon + text label for all 6 freshness/lifecycle tiers and 3 inspection verdicts), `Table`, `Pagination`, `Dialog` (with focus trap, `Escape` close, and trigger focus return), `ConfirmDialog`, `Toast`, `Skeleton`, `EmptyState`, `ErrorState`, `ForbiddenState`, `OfflineBanner`, `SkipLink`, `ThemeToggle`, and `ErrorBoundary`.
- **Part D (API Client, `sessionStorage` Token Store, Auth Context, Route Guards, and 6 Auth Screens)**: Implemented `src/api/client.ts` (attaching `Authorization: Bearer <token>`, parsing TraceX error envelopes, and dispatching `401` session-expired events), `src/auth/tokenStore.ts` (storing JWT exclusively in `sessionStorage` under `tx_token`), `src/auth/AuthContext.tsx`, `src/auth/RequireAuth.tsx` (preserving relative `?next=` path and rejecting protocol-relative/external URLs), `src/auth/RequireRole.tsx`, and the 6 auth screens (`LoginPage`, `RequestAccessPage`, `ActivateAccountPage`, `VerifyOtpPage`, `ForgotPasswordPage`, `ResetPasswordPage`).
- **Part E (Responsive AppShell, Role-Filtered Navigation, and Dev-Only Styleguide)**: Built `src/components/layout/AppShell.tsx` (skip link, role-filtered sidebar/drawer navigation, active `aria-current="page"`, offline banner polling `/actuator/health`, user profile badge, sign-out button, and theme customizer) and gated `/_styleguide` strictly behind `import.meta.env.DEV` so production builds exclude `StyleguidePage`.
- **Part F (Backend E2E Profile & Reset Script)**: Added `backend/src/main/resources/application-e2e.properties` (`tracex_fresh_e2e`, port `8083`, `tracex.mail.sink.enabled=true`, `management.health.mail.enabled=false`, raised rate limits `1000`) and `scripts/e2e-reset.ps1` (refuses to touch any database other than `tracex_fresh_e2e`). Updated `SPEC.md` (§3.6, §4, §5.1, §6.3, §8.1, §8.3) and `docs/traceability.md`.

---

### Phase 5.0 Verification & Repair Pass (E1–E8)
- **E1 & E5 (Playwright E2E Suite Expansion & Browser Evidence)**: Split and expanded `frontend/e2e/phase05.spec.ts` into 11 dedicated Playwright E2E tests (`E2E-01` through `E2E-11`) and mapped all 16 Phase 5 checks to concrete unit/E2E tests and commands in `docs/progress/phase-05-0.md`. Verified in headless Chromium: login for all 6 seeded accounts (`superadmin`, `admin`, `manager`, `factory_mgr`, `inspector`, `coordinator`), login failure server message, full invite onboarding flow via dev mail sink, forgot/reset password flow, 401 mid-session via `logout-all` with `?next=` preservation and open-redirect blocking, deactivated user login, 403 forbidden state on `/admin-check`, offline banner and recovery with real backend stop/restart, keyboard-only login/dialog/theme flow with reduced-motion `0s` duration check, `axe-core` across all 12 routes in all 3 palettes and both modes (72 scans, 0 violations), and `375px`/`768px`/`1280px` viewport `scrollWidth`/`clientWidth` measurements and full-page screenshots in `docs/screenshots/phase-05/`.
- **E2 & E3 (Backend Part A0 Regression Tests, Strict Calendar Regex, MutableClock Restoration, 12 Seeded Batches Fix, and 3x `mvnw.cmd clean verify`)**:
  - Tightened `BatchFreshness.ISO_LOCAL_DATE_REGEX` to a strict Gregorian calendar regex so impossible dates such as `"2026-02-31"`, `"2026-02-29"` (non-leap year), and `"2026-04-31"` never match `EXPIRED`, `URGENT`, `WARNING`, or `READY` tier filters and are routed to `status=EXCEPTION`.
  - Added `ProductAndBatchTests#testA01CorruptedExpiryMissingNullAndNotADateAgainstAllFiveFiltersAndFefo` (`missing`, `null`, and `"not-a-date"` against all 5 status filters and `GET /api/v1/dispatch/fefo`), `ProductAndBatchTests#testImpossibleCalendarDatesNeverMatchTierFiltersAndRouteToException` (`"2026-02-31"`, `"2026-02-29"`, `"2026-04-31"`), and `InspectionAndDispatchTests#testDispatchHistoryDispatchDateAcrossThreeTimeZones` (`dispatchHistory[].dispatchDate` round-trip across `UTC`, `Asia/Kolkata`, and `America/Los_Angeles`), bringing the backend suite to **409 tests**.
  - Identified and fixed the `Clock` and counter-key leak in `ProductAndBatchTests` (`testStatusChangingAfterAdvancingClockWithNoWrite`, `testMonthRollover`, `testYearRollover`, `testThousandthBatchProducesFourDigitSequence`): introduced `MutableClock`, updated `testStatusChangingAfterAdvancingClockWithNoWrite` to shift the shared `MutableClock` across `t0`, `t0+2d`, `t0+25d`, `t0+35d` and restore it via `mutableClock.reset()` in `finally`, cleaned up temporary counter keys in `finally` blocks, and verified `TestDatabaseSafetyGuard.checkClockWithinRealTime(Clock)` (`<= 5000ms` drift) passes before every test across 3 consecutive random-class/random-method `.\mvnw.cmd clean verify` runs (`409/409` passing).
  - Fixed the 13 vs 12 seeded demo batches discrepancy in `SeedRunner.java` and `ConfigurationAndSeedTests.java`: configured `DEMO-LOT-007` and `DEMO-LOT-012` (both `RHSLT`, `ACTIVE`) to share `today.plusDays(90)` to exercise the `D-18` tie rule within the 12 demo batches (`DEMO-LOT-001` through `DEMO-LOT-012`), removed `DEMO-LOT-013`, and verified all 12 seeded demo batches in MongoDB have `TX-2026-10-001`..`TX-2026-10-012` codes.
- **E4 (Frontend Static Checks, Unit Tests, Contrast Table, and Banned-Pattern Proof)**: Re-ran and logged `npm ci`, `npm run lint`, `npm run typecheck`, `npm test -- --run` (`25/25` unit tests), `npm run check:contrast` (all 138 token pairs across 3 palettes x 2 modes + 4 accents), and `npm run check:banned` (passing, failing with exit code `1` on planted violations, and passing after cleanup).
- **E6 (Production Build Guard, Bundle Inspection, CSP Meta Tag, and Token Storage Proof)**: Verified `npm run build` fails fast without `VITE_API_BASE_URL` (exit `1`) and with `http://` `VITE_API_BASE_URL` (exit `1`), succeeds with `https://api.tracex.example.com` (exit `0`), produces 0 matches in `dist/` for `localhost`, `127.0.0.1`, or `styleguide`, injects the strict production CSP `<meta>` tag in `dist/index.html`, and stores JWT exclusively in `sessionStorage` under `tx_token` with redaction in `src/lib/logger.ts`.
- **E7 (Split OpenAPI Generate Script vs. Compare-Only Drift Check)**: Split OpenAPI handling into explicit generation scripts (`frontend/scripts/generate-openapi.mjs` via `npm run gen:api` and `scripts/generate-openapi.ps1`) and strictly compare-only checks (`frontend/scripts/check-api-drift.mjs` via `npm run check:api-drift` and `OpenApiExportTest.java`) that write zero files. Verified `npm run check:api-drift` passing (`exit 0`), failing on planted drift in `docs/openapi.json` (`exit 1`), failing on planted drift in `src/api/generated/schema.d.ts` (`exit 1`), and passing again when restored (`exit 0`).
- **E8 (`PROGRESS.md` Completion, `D-16`–`D-19` Resolution, and Markdown Table Linter)**: Marked `D-16` through `D-19` as `Resolved` in `PROGRESS.md` and `SPEC.md`, completed changelog entries for Phases `4.1`, `5`, and `5.0`, marked Phase `5.0` `COMPLETE`, and verified `scripts/lint-md-tables.ps1` passes with 0 errors and 0 warnings.

---

### Phase 5.0.2 Confirmation Pass (Items 1–8)
- **Item 1 (Three Consecutive `.\mvnw.cmd clean verify` Runs)**: Executed 3 consecutive full backend verification runs under random class and random method order (`412` tests, `0` failures, `0` errors, `0` skipped on every run).
- **Item 2 (Seed Batches 12 vs 13 Cleanup in `_dev` and `_e2e`)**: Documented that `DEMO-LOT-013` was added in Phase 4 in `SeedRunner.java` to test `D-18` same-SKU equal-expiry ties. Created `scripts/clean-demo-lot-013.ps1` (with a strict suffix guard refusing any database not ending in `_dev` or `_e2e`), verified it aborts with exit code `1` on `tracex_fresh`, removed the 1 leftover `DEMO-LOT-013` document from both `tracex_fresh_dev` (`demoLotCount: 13 -> 12`) and `tracex_fresh_e2e` (`demoLotCount: 13 -> 12`), and confirmed via `Select-String` that `SPEC.md` (§8.3), `docs/traceability.md` (`M-02b`), and `SeedRunner.java` all explicitly document 12 demo batches (`DEMO-LOT-001` through `DEMO-LOT-012`).
- **Item 3 (`MutableClock` Isolated to `src/test` Only & Single `finally` Reset)**: Moved `MutableClock.java` from `src/main` to `backend/src/test/java/com/tracex/util/MutableClock.java` with `@Primary` test bean configuration in `backend/src/test/java/com/tracex/config/TestClockConfig.java`, restored `AppConfig.clock()` in `src/main` to `Clock.system(ZoneId.of(businessTimezone))`, and proved via `jar tf` that `MutableClock` and `TestClockConfig` have `0` matches in `target/tracex-backend-1.0.0-SNAPSHOT.jar`. Updated `MutableClock.reset()` to assign `Clock.system(this.defaultZoneId)` (live system-clock delegate, never a snapshot), removed redundant `@AfterEach`/`@AfterAll` clock resets from `ProductAndBatchTests` so the `finally { mutableClock.reset(); }` block in `testStatusChangingAfterAdvancingClockWithNoWrite` is the single real fix, and demonstrated with a throwaway year-2000 leak test that `TestDatabaseSafetyGuard.checkClockWithinRealTime` aborts the next test immediately (`exit 1`) before deleting the throwaway test and confirming the suite is green (`exit 0`).
- **Item 4 (Calendar Regex Positive, Negative, Shared Constant, and Partition Tests)**: Enforced `BatchFreshness.ISO_LOCAL_DATE_REGEX` in `BatchLocalDateValueConverter.tryParseLocalDate` and added 3 new tests in `ProductAndBatchTests` (`testCalendarRegexPositiveLeapAndMonthEndDatesMatchTierFilters` for `2028-02-29`, `2000-02-29`, `2026-12-31`; `testCalendarRegexNegativeInvalidDatesNeverMatchTierFilters` for `2100-02-29`, `2026-13-01`, `2026-00-10`; and `testEveryStoredDateStringLandsInExactlyOneFilterPartition` proving every stored date string lands in exactly 1 filter and never 0 or >= 2), bringing the backend total to **412 tests**.
- **Item 5 (OpenAPI YAML vs. Live Controllers Compare-Only Check)**: Added `yamlRoot.get("info")` comparison alongside `paths` and `components` in `OpenApiExportTest.java`, verified planting a path change in `backend/src/main/resources/openapi/tracex-api.yaml` fails `OpenApiExportTest` (`exit 1`) without writing files, verified restoring `tracex-api.yaml` passes (`exit 0`), and proved via `Get-FileHash` before and after `.\mvnw.cmd clean verify` that zero OpenAPI or schema files are modified during `verify`.
- **Item 6 (Frontend Production Build, CSP, `dist/` Searches, Browser Storage Listings, and Logger Redaction)**: Recorded the exact `Content-Security-Policy` `<meta>` tag from `dist/index.html`, verified `0` matches in `dist/` for inline `<script>` (without `src`), `localhost`, `127.0.0.1`, and `styleguide`, logged full Playwright browser `sessionStorage`, `localStorage`, and `document.cookie` snapshots before/after login, before/after logout (`E2E-01`), and before/after a `401` (`E2E-05`), and ran the logger redaction unit test in `src/components/ui/ui.test.tsx`.
- **Item 7 (Unified `docs/screenshots/phase-05/` Path and All 36 Route-Viewport Screenshots)**: Standardized all screenshot references to `docs/screenshots/phase-05/` and updated Playwright `E2E-11` to capture all 12 routes at `375px`, `768px`, and `1280px` (**36 PNG files**) in `docs/screenshots/phase-05/`.
- **Item 8 (Housekeeping & Full Verification Suite)**: Logged `docs/progress/phase-05-0-2.md`, verified `scripts/lint-md-tables.ps1` passes with 0 errors and 0 warnings across 27 Markdown files, and re-verified `.\mvnw.cmd clean verify`, `npm run lint`, `npm run typecheck`, `npm test -- --run`, `npm run check:banned`, `npm run check:contrast`, and `npm run check:api-drift`.

---

### Phase 5.1 Per-Page Photo Backdrops (Parts A–D)
- **Part A (Decision `D-20`, Open Issue `OI-11`, and `SPEC.md` Updates)**: Recorded `D-20` (`Resolved`, team decision: per-page photographic backdrops behind a flat scrim `--backdrop-scrim`, with AI-generated imagery, fake UI, gradients, glass/blur, and parallax/motion remaining banned) and `OI-11` (`Open`, replace all 14 placeholder backdrops with real licensed team-approved photos before launch) in `PROGRESS.md` and updated `SPEC.md` §5.2 and §11.
- **Part B (Asset Pipeline & Manifest Validation)**: Added `sharp@0.35.5` (devDependency), `frontend/design-assets/backdrops.json` (14 keys: `auth`, `auth-recovery`, `dashboard`, `batches`, `fefo`, `inspections`, `dispatch`, `qr`, `trace-public`, `team`, `import`, `notifications`, `settings`, `default`), `frontend/scripts/prepare-backdrops.mjs` (generating widths `640`, `1280`, and `1920` in AVIF, WebP, and JPEG into `frontend/src/assets/backdrops/` — 126 image files + `index.ts` — and enforcing `<= 60 KB` / `<= 120 KB` / `<= 250 KB` budgets), and `frontend/scripts/check-backdrops.mjs` (`npm run check:backdrops`, validating route mappings and required licence metadata for non-placeholder entries while warning on placeholders). Wired `npm run prepare:backdrops` into `predev` and `prebuild`.
- **Part C (`PageBackdrop` Component, Route Map, Preferences, and Layouts)**: Created `frontend/src/routes/backdrops.ts` as the single route-to-key map; implemented `frontend/src/components/ui/PageBackdrop.tsx` supporting `banner` (`176px` / `144px` / `112px`), `side` (`55%` column / `160px` band / `96px` band), and `full` variants with `<picture>` (AVIF, WebP, JPEG `srcset` and `sizes`), `alt=""`, `aria-hidden="true"`, `decoding="async"`, `fetchpriority="high"` for visible banner/side images, zero layout shift, flat token fallback on load error, `showPageImages` user preference (`tx_prefs` in `localStorage`, default `true`) with toggle in the user menu and `/_styleguide`, `Save-Data: on` suppression, and `@media print` hiding. Extended `PageHeader` with `backdropKey`, applied `side` (`auth` / `auth-recovery`) to `AuthLayout`, `banner` (`default` / route key) to signed-in placeholder home pages, `full` (`trace-public`) to `PublicTracePlaceholderPage`, and added all 14 keys across all 3 variants to `StyleguidePage`.
- **Part D (Worst-Case Scrim Contrast & Banned-Pattern Gates, Unit & E2E Tests)**: Extended `frontend/scripts/check-contrast.mjs` to verify worst-case pure white (`#ffffff`) and pure black (`#000000`) image pixels under `--backdrop-scrim` (`>= 4.5:1` for `--backdrop-text` and `--backdrop-text-muted`, `>= 3:1` for focus ring and controls across all 6 palette/mode pairs; 162 total checks) and extended `frontend/scripts/check-banned-patterns.mjs` to reject hotlinked `http`/`https` image URLs in `src/` and `design-assets/backdrops.json`, `backdrop-filter`, and parallax patterns. Added unit tests in `frontend/src/components/ui/PageBackdrop.test.tsx` (`33/33` total unit tests passing) and Playwright E2E tests in `frontend/e2e/phase05-1.spec.ts` (`18/18` total E2E tests passing), and captured 25 screenshots in `docs/screenshots/phase-05-1/`. Logged all 12 verification checks in `docs/progress/phase-05-1.md`.

---

### Phase 6 Changes to Earlier Phase Files
- **`SPEC.md` (§6.3), `docs/permission-matrix.csv`, `backend/src/main/resources/openapi/tracex-api.yaml`, `docs/openapi.json`, `frontend/src/api/generated/schema.d.ts`, `backend/src/test/java/com/tracex/OpenApiExportTest.java`, `backend/src/test/java/com/tracex/RbacMatrixTest.java`**: Added `GET /api/v1/dashboard/summary` (`D-21` `Proposed`, phase 6) and updated active OpenAPI/matrix parity checks to `phase <= 6` (`42` active matrix rows, `41` `/api/v1/**` OpenAPI operations).
- **`frontend/src/App.tsx`, `frontend/src/components/layout/AppShell.tsx`, `frontend/src/routes/backdrops.ts`, `frontend/e2e/phase05.spec.ts`, `frontend/e2e/phase05-1.spec.ts`**: Replaced Phase 5 placeholder `HomePage.tsx` and `RoleDemoPage.tsx` (`/admin-check`) with the Phase 6 core screens (`DashboardPage`, `BatchesPage`, `BatchDetailPage`, `ArchivedBatchesPage`, `FefoPage`, `InspectionsPage`, `ProfilePage`), wired generated permission helpers from `src/auth/permissions.generated.ts`, and updated `/admin-check` references in `phase05.spec.ts` and `phase05-1.spec.ts` to `/batches/archived`.
- **`frontend/src/components/ui/ui.module.css`, `frontend/src/components/ui/PageBackdrop.tsx`, `frontend/src/components/ui/States.tsx`, `frontend/src/components/ui/Toast.tsx`**: Added `overflow-y: auto` and `max-height: calc(100vh - 2rem)` on `.dialogPanel` so tall dialogs scroll within the viewport, and aligned optional props with `exactOptionalPropertyTypes: true`.
- **`frontend/scripts/check-banned-patterns.mjs`, `frontend/package.json`, `frontend/vitest.config.ts`**: Added Rule 16 banning client-side comparisons on `daysUntilExpiry` and hardcoded `7` or `30` day freshness thresholds, added `gen:permissions`, `check:permissions-drift`, and `test:coverage` scripts, and configured `@vitest/coverage-v8@3.1.2` thresholds (`>= 70%` statements).
- **`docs/00-audit/feature-parity.md` & `docs/traceability.md`**: Updated status and Phase 6 test references for dashboard, batches, FEFO, inspections, dispatch, archive/restore, and profile features. Full Phase 6 log in [docs/progress/phase-06.md](docs/progress/phase-06.md).

---

### Phase 7 Changes to Earlier Phase Files
- **`backend/pom.xml`**: Added `com.google.zxing:core:3.5.3` and `com.google.zxing:javase:3.5.3` for 512px PNG QR code generation with error correction level M. Verified no test classes leak into repackaged jar.
- **`backend/src/main/java/com/tracex/model/Batch.java` & `BatchService.java`**: Added `traceToken` field with unique sparse index. Added `qrAbsoluteUrl` to batch creation response (201). Added `BatchTraceTokenBackfillRunner.java` to backfill missing tokens for existing batches idempotently on startup.
- **`backend/src/main/java/com/tracex/service/SeedRunner.java`**: Fixed `upsertBatch` query to match on `sourceLotCode` or `batchCode` so seeded batches are idempotent without unique key collisions on restart. Added regression test `ConfigurationAndSeedTests#testSeedTwiceDoesNotThrowDuplicateKeyAndPreserves12DemoBatches`.
- **`backend/src/main/java/com/tracex/config/AppConfig.java`**: Added fail-fast validations in `prod` profile requiring `TRACE_TOKEN_SECRET` >= 32 chars and rejecting localhost/loopback/private IP `PUBLIC_TRACE_BASE_URL`.
- **`backend/src/main/java/com/tracex/security/SecurityConfig.java`**: Added `GET /api/v1/qr/trace/t/**` and `POST /api/v1/qr/scan` to `permitAll()`. All other QR and batch endpoints remain authenticated.
- **`SPEC.md` (§3.1, §4, §5, §6.3, §7, §8.1, §10)**: Corrected `priorityScore` formula documentation, color palette tokens, health endpoint to `/actuator/health`, prod runbook, rate limit table for `POST /api/v1/qr/scan`, and `ScanEvent` collection schema.
- **`docs/permission-matrix.csv`, `backend/src/main/resources/openapi/tracex-api.yaml`, `docs/openapi.json`, `frontend/src/api/generated/schema.d.ts`**: Updated for Phase 7 endpoints (`46` active rows, `45` `/api/v1/**` OpenAPI operations).
- **`frontend/src/api/types.ts` & `endpoints.ts`**: Added `BatchQrDto`, `BatchScansDto`, `PublicTraceDto`, `ScanRequestDto` and endpoints `fetchBatchQr`, `fetchBatchScans`, `fetchPublicTrace`, `recordPublicScan`.
- **`frontend/src/auth/permissions.generated.ts`**: Added `canViewBatchQr` and `canViewBatchScans`.
- **`frontend/src/lib/logger.ts`**: Redacts trace tokens in URLs, payloads, and messages.
- **`frontend/index.html`**: Added `<meta name="referrer" content="no-referrer" />`.
- **`frontend/src/features/batches/BatchDetailPage.tsx`**: Added QR section (with 512px image, download link, public URL copy) and Scans section (with total, last scanned, device breakdown, and source breakdown).
- **`frontend/src/features/public/PublicTracePage.tsx` & `LegacyTracePage.tsx`**: Added unauthenticated public trace page with full `trace-public` backdrop and robots meta tag; added friendly legacy deprecation page for `/trace/:code`.
- **`docs/00-audit/feature-parity.md` & `docs/traceability.md`**: Updated rows 15, 16, 17, 19, 21 to Verified (Phase 7), updated M-01 (TEST-M-01) and M-05 (TEST-M-05) to Phase 7 PASS. Full Phase 7 log in [docs/progress/phase-07.md](docs/progress/phase-07.md).

---

### Phase 7.1 Evidence and Test Repair
- **Backend Test Counts & Concurrency Repair**: Verified 477 passing backend tests across 3 consecutive `mvnw.cmd clean verify` runs (`mvnw-verify-run1.txt`, `run2.txt`, `run3.txt`). Reconciled Phase 6 baseline (`423` tests) to Phase 7.1 (`477` tests, `+54` total across Phases 7 & 7.1): `TraceTokenTests` (`+4`), `PublicTraceAndScanTests` (`+11`), `BatchQrAndScansTests` (`+10`), `ConfigurationAndSeedTests` (`+1`, `12 -> 13`), `RbacMatrixTest` (`+28`, `294 -> 322`), `RouteCoverageTest` (`0` delta, `1 -> 1`, already present in Phase 5.0/6), and 15 unchanged classes totaling `117` (`116` + `1` `RouteCoverageTest`; `117 + 12 + 294 = 423`). Fixed `QrService.getBatchQr` to atomically set `traceToken` via `findAndModify` where `traceToken` is null, preventing concurrent overwrites and optimistic lock failures (`BatchQrAndScansTests#testTwoConcurrentGetsOnBatchWithNoTokenEndWithExactlyOneStoredTokenAndBothResponsesUseIt`). Optimized `getBatchScans` using native Mongo aggregation queries.
- **Frontend Unit Suite Realignment**: Expanded frontend unit tests from the Phase 6 baseline of `54` tests in `11` files (`docs/progress/phase-06.md` Check 5) by `+21` tests (`+9` in Phase 7 to `63` in `12` files, `+12` in Phase 7.1 to `75` in `13` files) with `90.12%` statements coverage (`frontend-unit.txt`). Added tests in `src/lib/logger.test.ts`, `src/features/public/PublicTracePage.test.tsx`, `src/features/batches/BatchDetailPage.test.tsx`, and `src/api/endpoints.test.ts`.
- **Planted Failures & Empirical Verification**: Planted and proved 4 failing tests and their clean restorations: `farmerName` in public DTO, forged token validation, banned client-side freshness comparison, and OpenAPI copy drift.
- **Production Fail-Fast & Packaging Checks**: Proved fast-fail at startup for missing `TRACE_TOKEN_SECRET`, 10-char secret, and localhost `PUBLIC_TRACE_BASE_URL`. Confirmed ZXing `core-3.5.3.jar` and `javase-3.5.3.jar` in `BOOT-INF/lib/` and 0 test class leaks in production JAR (`jar-tf-check.txt`).
- **Live Token Flow & Mongo Checks**: Verified live token creation, QR generation, anonymous public retrieval, forged token rejection, and identical 404 on archive on port 8081 (`live-token-flow.txt`). Verified 64-char hex `ipHash`, 0 raw IPs, and 12 demo lots across `tracex_fresh_dev` and `tracex_fresh_e2e` (`mongo-evidence.txt`).
- **Playwright Full Suite**: Executed full 37-test Playwright suite in 3.5 minutes (`playwright-full.txt`), verified console logs for timezone independence, zero Axe violations across 12 palette/mode/image permutations, viewport responsiveness, and single-scan network dispatch. Full Phase 7.1 log in [docs/progress/phase-07-1.md](docs/progress/phase-07-1.md).

---

### Phase 8.0 Carry-Over Corrections, Reference Extraction, and SPEC §3.7 (No Import Code)
- **Part 0 Item 1 (Phase 7.1 Test Count Arithmetic Reconciliation)**: Corrected `docs/progress/phase-07-1.md` and `PROGRESS.md` so per-class deltas sum to `+54` (`RouteCoverageTest` delta corrected from `+1` to `0`, `1 -> 1`; 15 unchanged classes sum to `117` [`116` + `1` `RouteCoverageTest`]; `117 + 12 + 294 = 423` Phase 6 baseline), documented the deterministic derivation of the Phase 6 per-class baseline from `docs/progress/phase-05-0.md` lines 277–315, `docs/progress/phase-05-0-2.md` Item 4, and `docs/progress/phase-06.md` lines 22 & 26, and corrected the frontend unit test baseline in `phase-07-1.md` from `63 (12 files)` to the true Phase 6 baseline of `54 (11 files)` (`+21` tests and `+2` files across Phases 7 and 7.1 to reach `75` in `13` files).
- **Part 0 Item 2 (`qrAbsoluteUrl` `5173` vs `5174` Fix)**: Identified why Phase 7.1 `live-token-flow.txt` showed `http://localhost:5173`: `backend/src/main/resources/application-dev.properties` line 8 had `tracex.security.public-trace-base-url=${PUBLIC_TRACE_BASE_URL:http://localhost:5173}`, overriding `application.properties` (`http://localhost:5174`). Updated `application-dev.properties` line 8 to `http://localhost:5174`, verified 0 remaining matches for `5173` across scripts, `.env` files, and profile files, cleared `PUBLIC_TRACE_BASE_URL` in PowerShell, restarted the `dev` backend on port `8081`, created a batch via `POST /api/v1/batches`, and verified `qrAbsoluteUrl` starts with `http://localhost:5174` (`part0-dev-5174-and-health.txt`).
- **Part 0 Item 3 (`management.health.mail.enabled=false` Scoped to `dev`, `test`, and `e2e` Profiles)**: Removed `management.health.mail.enabled=false` from base `backend/src/main/resources/application.properties` and added it to `application-dev.properties` and `application-test.properties` (`application-e2e.properties` already had `management.health.mail.enabled=false` and was not modified), because those three profiles use `DevMailSink` (`tracex.mail.sink.enabled=true`) with no SMTP server on `localhost:587`, whereas `prod` uses `SmtpEmailService`. Documented in `SPEC.md` §8.3, verified `/actuator/health` returns `{"status":"UP"}` under `dev` and `prod` (`actuator-health.txt`), and verified `.\mvnw.cmd clean verify` passes (`477` tests, `0` failures, `mvnw-verify.txt`).
- **Part A (Bulk Import Reference Extraction)**: Audited `import.controller.js`, `ImportJob.model.js`, `import.routes.js`, `requireAdmin.js`, `expiryCalculator.js`, `productContract.js`, `ImportPanel.jsx`, `useImport.js`, `csvParser.js`, `csvParser.test.js`, and `rbac.test.js` in the reference workspace and wrote `docs/00-audit/import-reference.md` covering all 11 required sections with exact file/line citations and verbatim code excerpts (`<= 15` lines each).
- **Part B (`SPEC.md` §3.7, Deviations Table, `D-23`, `D-24`, Role Wording, and Open Questions)**: Added `SPEC.md` §3.7 (`Bulk Import`) and the 3-column Deviations Table, recorded `D-23` and `D-24` as `Proposed` in `PROGRESS.md` and `SPEC.md`, aligned `SPEC.md` §2 and §6.3 importer role wording with `requireImporter` and `docs/permission-matrix.csv` (`super-admin`, `admin`, `manager`, `factory-manager`), verified `scripts/lint-md-tables.ps1` passed across `34` Markdown files (`lint-md-tables.txt`), and documented Phase 8 open questions in [docs/progress/phase-08-0.md](docs/progress/phase-08-0.md).

---

### Phase 8 Bulk CSV Import (Backend + UI)
- **Part 0 & Part A (Phase 8.0 Log Corrections, Decisions, `D-23` & `D-24` Resolved)**: Corrected `docs/progress/phase-08-0.md` and `PROGRESS.md` for `management.health.mail.enabled=false` (`application-e2e.properties` already had it and was not modified) and the Markdown table linter count (`34` files in Phase 8.0; `35` files in Phase 8). Applied all 10 Part A decisions in `SPEC.md` §3.7 and `PROGRESS.md` and marked `D-23` and `D-24` as `Resolved`.
- **Part B (Backend Import Engine, `BatchService` Reuse, OpenAPI & RBAC)**: Added `ImportJob.java`, `ImportJobRepository.java`, `ImportDtos.java`, `ImportService.java`, and `ImportController.java` implementing all 7 `/api/v1/import*` endpoints (`GET /schema`, `POST /map-headers`, `POST /validate`, `POST /commit`, `GET /`, `GET /:id`, `POST /:id/rollback`) authorized for `super-admin`, `admin`, `manager`, and `factory-manager`. Extracted `BatchService.createBatchForProduct` so single-batch creation (`POST /api/v1/batches`) and bulk import commit (`POST /api/v1/import/commit`) share one code path (`TX-YYYY-MM-NNN` atomic code, `traceToken`, runtime freshness derivation, and `BATCH_CREATED` audit). Added lazy stale-job detection (`tracex.import.stale-running-minutes`, default `15`), `500`-entry `rowErrors` cap with `rowErrorsTruncated`, cross-chunk `priorKeys` deduplication, `isDeleted=false` dedupe queries, and safe rollback via `BatchService.archiveBatch` (`"Import rollback <jobId>"`) with `409 CONFLICT` when any inserted batch is `DISPATCHED`. Updated `tracex-api.yaml` (`52` operations), `docs/openapi.json`, `RouteCoverageTest.java` (`phase <= 8`, `53` active matrix rows), `OpenApiExportTest.java`, `RbacMatrixTest.java` (`322 -> 371`, `+49`), and added `ImportTests.java` (`16` tests). Backend total: **`542` tests, `0` failures** (`mvnw-clean-verify.txt`).
- **Part C & Part D (Frontend RFC-4180 CSV Parser, `/import` Wizard + History UI, Unit & E2E Tests)**: Created `frontend/src/features/import/csvParser.ts` (RFC-4180 quotes, BOM strip, CRLF/LF, blank line skip, `10 MB` and `10,000`-row client guards, static sample CSV generator) and `ImportPage.tsx` (stepped Upload -> Map Columns -> Validate & Preview -> Commit Progress -> Result with Rollback + Job History drawer, `import-data` banner backdrop, and client-side `.xlsx`/`.xls` rejection per `D-5`). Wired `/import` into `navConfig.ts`, `AppShell.tsx`, `pages/index.ts`, and `App.tsx`. Added `csvParser.test.ts` (`8` tests) and `ImportPage.test.tsx` (`5` tests) — frontend unit total: **`88` tests in `15` files, `0` failures** (`frontend-checks-and-unit-tests.txt`). Added `frontend/e2e/phase08.spec.ts` (`P8-E2E-01` and `P8-E2E-02`) — Playwright E2E total: **`39` passed across `5` files** (`playwright-full.txt`). Proved all 3 planted failures (`A`, `B`, `C`) fail and pass on revert, verified live dev import + rollback on port `8081` (`live-dev-import-flow.txt`), updated `docs/00-audit/feature-parity.md` and `docs/06-ui/screen-map.md`, and verified `scripts/lint-md-tables.ps1` passes across `35` Markdown files (`lint-md-tables.txt`). Full log in [docs/progress/phase-08.md](docs/progress/phase-08.md).
