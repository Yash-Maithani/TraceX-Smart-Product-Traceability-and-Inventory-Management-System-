# TraceX Phase 6 — UI Screen Map & Parity Matrix (`docs/06-ui/screen-map.md`)

This document maps every feature row in `docs/00-audit/feature-parity.md` (and the reference UI components in `frontend/src/pages/Dashboard.jsx`, `CreateBatchModal.jsx`, `BatchDetailDrawer.jsx`, `DispatchModal.jsx`, `InspectionModal.jsx`, and `SettingsPanel.jsx`) to the new Phase 6 pages, backend `/api/v1/` endpoints, and automated verification tests. Rows belonging to later phases are explicitly tagged with their target build phase.

---

## 1. Core Feature Screen-to-Endpoint-to-Test Map (Phase 6 & Completed Auth/Foundation)

| Parity Row / Feature | Reference UI Source | New Page / Component (`frontend/src/`) | Backend Endpoint(s) (`/api/v1/`) | Target Phase | Automated Tests |
|---|---|---|---|---|---|
| Dashboard KPI summary cards (`EXPIRED`, `URGENT`, `WARNING`, `READY`, `EXCEPTION`, `DISPATCHED`), inspection verdict breakdown (`PASSED`, `FAILED`, `FLAGGED`, `none`), role-scoped `pendingAccessRequests`, and top 5 expiring-soon batches | `Dashboard.jsx` lines 257–482 (`OverviewTab`), lines 3186–3224 (`stats` useMemo) | `features/dashboard/DashboardPage.tsx` (`/` and `/dashboard`) | `GET /api/v1/dashboard/summary` (`D-21` Proposed) | Phase 6 | `DashboardSummaryTests.java`; `features/dashboard/DashboardPage.test.tsx`; `e2e/phase06.spec.ts` (`E2E-01`) |
| Product list for batch creation and SKU/category filter dropdowns | `CreateBatchModal.jsx` line 55; `Dashboard.jsx` line 774 | `features/batches/CreateBatchDialog.tsx`, `features/batches/BatchesPage.tsx`, `features/fefo/FefoPage.tsx` | `GET /api/v1/products` | Phase 6 | `ProductAndBatchTests.java`; `features/batches/BatchesPage.test.tsx`; `e2e/phase06.spec.ts` (`E2E-02`) |
| Batch list with URL-state filters (`status`, `sku`, `search`, `sort`, `page`, `limit`), server status badge, quality badge, pagination, and `<768px` mobile card layout | `Dashboard.jsx` lines 489–765 (`BatchesTab`) | `features/batches/BatchesPage.tsx` (`/batches`) | `GET /api/v1/batches` | Phase 6 | `ProductAndBatchTests.java`; `features/batches/BatchesPage.test.tsx`; `e2e/phase06.spec.ts` (`E2E-01`, `E2E-02`, `E2E-08`) |
| Create batch form (product select, `packDate`, optional `expiryDate` override, `quantityProduced`, `unit`, `yieldPercent`, `sourceLotCode`, `farmerName`, `village`, `traceabilityNote`, `fieldErrors` display, generated `batchCode` confirmation) | `CreateBatchModal.jsx` lines 1–312 | `features/batches/CreateBatchDialog.tsx` (`/batches` & `/batches/new`) | `POST /api/v1/batches`, `GET /api/v1/products` | Phase 6 | `ProductAndBatchTests.java`; `features/batches/BatchesPage.test.tsx`; `e2e/phase06.spec.ts` (`E2E-02`) |
| Batch detail view (fields, `status`, `daysUntilExpiry`, `exceptionReason`, `qualityCheck` snapshot, `noteHistory`, `dispatchHistory`, inspections list for allowed roles) | `BatchDetailDrawer.jsx` lines 1–685 (`DetailsTab`, `QualityTab`, `HistoryTab`) | `features/batches/BatchDetailPage.tsx` (`/batches/:id`) | `GET /api/v1/batches/:id`, `GET /api/v1/inspections/batch/:batchId` | Phase 6 | `ProductAndBatchTests.java`; `features/batches/BatchDetailPage.test.tsx`; `e2e/phase06.spec.ts` (`E2E-02`, `E2E-03`) |
| Batch traceability note add/edit with `noteHistory` append | `BatchDetailDrawer.jsx` lines 250–310 | `features/batches/BatchDetailPage.tsx` (`/batches/:id`) | `PATCH /api/v1/batches/:id/note` | Phase 6 | `ProductAndBatchTests.java`; `features/batches/BatchDetailPage.test.tsx`; `e2e/phase06.spec.ts` (`E2E-02`) |
| Raw-material correction (`farmerName`, `village`, `sourceLotCode`, `quantityProduced`, `unit`, `yieldPercent`, `packDate`, `expiryDate`, mandatory `reason`) | `BatchDetailDrawer.jsx` lines 312–425 | `features/batches/BatchDetailPage.tsx` (`/batches/:id`) | `PATCH /api/v1/batches/:id/raw-material` | Phase 6 | `ProductAndBatchTests.java`; `features/batches/BatchDetailPage.test.tsx`; `e2e/phase06.spec.ts` (`E2E-02`) |
| Soft-delete (archive) batch with reason in `ConfirmDialog` (`admin` and `super-admin` only) | `BatchDetailDrawer.jsx` lines 195–238 | `features/batches/BatchDetailPage.tsx` (`/batches/:id`) | `DELETE /api/v1/batches/:id` | Phase 6 | `ProductAndBatchTests.java`; `features/batches/BatchDetailPage.test.tsx`; `e2e/phase06.spec.ts` (`E2E-05`) |
| Archived batches list and restore (`admin` and `super-admin` only) | `Dashboard.jsx` lines 2420–2485 (`Recycle Bin` batch section) | `features/batches/ArchivedBatchesPage.tsx` (`/batches/archived`) | `GET /api/v1/batches/archived`, `PATCH /api/v1/batches/:id/restore` | Phase 6 | `ProductAndBatchTests.java`; `features/batches/ArchivedBatchesPage.test.tsx`; `e2e/phase06.spec.ts` (`E2E-05`) |
| FEFO dispatch queue (`queue` with 1-based `rank`, `expired`, and `exceptions` with `exceptionReason` rendered in server order, `sku` and `category` filters) | `Dashboard.jsx` lines 768–980 (`FefoTab`) | `features/fefo/FefoPage.tsx` (`/fefo`) | `GET /api/v1/dispatch/fefo` | Phase 6 | `FefoServiceTest.java`; `features/fefo/FefoPage.test.tsx`; `e2e/phase06.spec.ts` (`E2E-04`) |
| Dispatch batch dialog (`buyerName`, optional `dispatchDate`, handling `409 BATCH_EXPIRED`, `409 DISPATCH_OUT_OF_ORDER` showing earlier batch code + required `overrideReason`, `409 QUALITY_HOLD`, `FLAGGED` warning banner, and `409 CONFLICT`) | `DispatchModal.jsx` lines 1–195 | `features/batches/DispatchDialog.tsx` (invoked from `/fefo` and `/batches/:id`) | `PATCH /api/v1/batches/:id/dispatch` | Phase 6 | `InspectionAndDispatchTests.java`; `features/batches/DispatchDialog.test.tsx`; `e2e/phase06.spec.ts` (`E2E-03`, `E2E-04`) |
| Quality inspections list (All Inspections + My Inspections tabs), batch filter, and read-only inspection detail modal | `Dashboard.jsx` lines 1135–1340 (`InspectionsTab`); `BatchDetailDrawer.jsx` lines 490–565 | `features/inspections/InspectionsPage.tsx` (`/inspections`) | `GET /api/v1/inspections`, `GET /api/v1/inspections/my`, `GET /api/v1/inspections/batch/:batchId`, `GET /api/v1/inspections/:id` | Phase 6 | `InspectionAndDispatchTests.java`; `features/inspections/InspectionsPage.test.tsx`; `e2e/phase06.spec.ts` (`E2E-03`) |
| Create quality inspection (8-item checklist with `true` Pass / `false` Fail / `null` N/A and 200-char note, verdict `PASSED`/`FAILED`/`FLAGGED`, rating `1`–`5`, `findings`, `recommendation`, server `PASSED` validation error display) | `InspectionModal.jsx` lines 1–290 | `features/inspections/InspectionsPage.tsx` (`/inspections`) | `POST /api/v1/inspections` | Phase 6 | `InspectionAndDispatchTests.java`; `features/inspections/InspectionsPage.test.tsx`; `e2e/phase06.spec.ts` (`E2E-03`) |
| User profile view & edit (`name`, `email`, `phone`), change password (rotates session token in `sessionStorage`), and sign out everywhere (`logout-all`) | `SettingsPanel.jsx` lines 1–396 (`Profile` and `Security` sections) | `features/profile/ProfilePage.tsx` (`/profile` and `/settings`) | `GET /api/v1/auth/me`, `PATCH /api/v1/auth/me`, `POST /api/v1/auth/me/change-password`, `POST /api/v1/auth/me/logout-all` | Phase 6 | `TokenAndSessionTests.java`; `features/profile/ProfilePage.test.tsx`; `e2e/phase06.spec.ts` (`E2E-06`) |
| Login, request access, invite activation, 2FA OTP verification, forgot/reset password, and session revocation handling | `Login.jsx` lines 1–880 | `features/auth/*.tsx` (`/login`, `/request-access`, `/activate`, `/verify-otp`, `/forgot-password`, `/reset-password`) | `POST /api/v1/auth/login`, `/request-access`, `/activate`, `/verify-otp`, `/verify-otp/resend`, `/forgot-password`, `/verify-reset-otp`, `/reset-password` | Phase 5 (Complete) | `AuthLoginTests.java`, `AccessRequestAndUserFlowTests.java`; `e2e/phase05.spec.ts` (`E2E-01`–`E2E-06`) |
| Bulk CSV import (5-step wizard: upload UTF-8 CSV, map headers, dry-run validate in 200-row chunks with `priorKeys` and no `farmerName` in preview, chunked commit with mid-chunk failure halt, result & formula-safe error report download, recent jobs detail & safe rollback) | `ImportPanel.jsx`, `useImport.js`, `csvParser.js` | `features/import/ImportPage.tsx` (`/import`), `features/import/csvParser.ts` | `GET /api/v1/import/schema`, `POST /api/v1/import/map-headers`, `POST /api/v1/import/validate`, `POST /api/v1/import/commit`, `GET /api/v1/import`, `GET /api/v1/import/:id`, `POST /api/v1/import/:id/rollback` | Phase 8 | `ImportTests.java`; `features/import/csvParser.test.ts`, `features/import/ImportPage.test.tsx`; `e2e/phase08.spec.ts` (`P8-E2E-01`, `P8-E2E-02`) |

---

## 2. Complete 62-Row Parity Table Mapping (`docs/00-audit/feature-parity.md`)

| # | Category | Feature (`docs/00-audit/feature-parity.md`) | Target Phase | Phase 6 Status / Route & Endpoint Mapping |
|---|---|---|---|---|
| 1 | Authentication | Username/password login (`POST /api/v1/auth/login`) | Phase 5 | Complete (`/login`) |
| 2 | Authentication | Google OAuth login (`POST /api/v1/auth/google/token`) | Phase 11 | Deferred to Phase 11 (`D-3`) |
| 3 | Authentication | Google account link (`POST /api/v1/auth/me/google-link`) | Phase 11 | Deferred to Phase 11 (`D-3`) |
| 4 | Authentication | Google account unlink (`DELETE /api/v1/auth/me/google-link`) | Phase 11 | Deferred to Phase 11 (`D-3`) |
| 5 | Authentication | Current user profile (`GET /api/v1/auth/me`) | Phase 5 & 6 | Complete (`AuthContext.tsx` + `/profile` `ProfilePage.tsx`) |
| 6 | Authentication | Update profile (`PATCH /api/v1/auth/me`) | Phase 6 | Implemented in `/profile` (`ProfilePage.tsx`) |
| 7 | Authentication | Change password (`POST /api/v1/auth/me/change-password`) | Phase 6 | Implemented in `/profile` (`ProfilePage.tsx`; stores rotated `token` in `sessionStorage`) |
| 8 | Authentication | Logout all sessions (`POST /api/v1/auth/me/logout-all`) | Phase 5 & 6 | Complete (`AppShell.tsx` + `/profile` `ProfilePage.tsx`) |
| 9 | Authentication | Forgot password — send OTP (`POST /api/v1/auth/forgot-password`) | Phase 5 | Complete (`/forgot-password`) |
| 10 | Authentication | Forgot password — verify OTP (`POST /api/v1/auth/verify-reset-otp`) | Phase 5 | Complete (`/reset-password`) |
| 11 | Authentication | Forgot password — reset (`POST /api/v1/auth/reset-password`) | Phase 5 | Complete (`/reset-password`) |
| 12 | Onboarding | Request access (`POST /api/v1/auth/request-access`) | Phase 5 | Complete (`/request-access`) |
| 13 | Onboarding | List access requests (`GET /api/v1/auth/requests`) | Phase 9 | Backend complete (Phase 2); Admin UI in Phase 9 (`pendingAccessRequests` count shown on Phase 6 Dashboard for `manager`/`admin`/`super-admin`) |
| 14 | Onboarding | Approve access request (`POST /api/v1/auth/requests/:id/approve`) | Phase 9 | Backend complete (Phase 2); Admin UI in Phase 9 |
| 15 | Onboarding | Reject access request (`POST /api/v1/auth/requests/:id/reject`) | Phase 9 | Backend complete (Phase 2); Admin UI in Phase 9 |
| 16 | Onboarding | Resend invite email (`POST /api/v1/auth/requests/:id/resend`) | Phase 9 | Backend complete (Phase 2); Admin UI in Phase 9 |
| 17 | Onboarding | Delete access request (`DELETE /api/v1/auth/requests/:id`) | Phase 9 | Backend complete (Phase 2); Admin UI in Phase 9 |
| 18 | Onboarding | Activate account via invite token (`POST /api/v1/auth/activate`) | Phase 5 | Complete (`/activate`) |
| 19 | Onboarding | Verify activation OTP (`POST /api/v1/auth/verify-otp`) | Phase 5 | Complete (`/verify-otp`) |
| 20 | Onboarding | Resend activation OTP (`POST /api/v1/auth/verify-otp/resend`) | Phase 5 | Complete (`/verify-otp`) |
| 21 | User Management | List active users (`GET /api/v1/auth/users`) | Phase 9 | Backend complete (Phase 2); Team Admin UI in Phase 9 |
| 22 | User Management | User directory (`GET /api/v1/auth/directory`) | Phase 9 | Backend complete (Phase 2); Team Admin UI in Phase 9 |
| 23 | User Management | Toggle user active/inactive (`PATCH /api/v1/auth/users/:id/toggle`) | Phase 9 | Backend complete (Phase 2); Team Admin UI in Phase 9 |
| 24 | User Management | Change user role (`PATCH /api/v1/auth/users/:id/role`) | Phase 9 | Backend complete (Phase 2); Team Admin UI in Phase 9 |
| 25 | User Management | Soft-delete user (`DELETE /api/v1/auth/users/:id`) | Phase 9 | Backend complete (Phase 2); Team Admin UI in Phase 9 |
| 26 | User Management | List soft-deleted users (`GET /api/v1/auth/users/deleted`) | Phase 9 | Backend complete (Phase 2); Team Admin UI in Phase 9 |
| 27 | User Management | Restore soft-deleted user (`PATCH /api/v1/auth/users/:id/restore`) | Phase 9 | Backend complete (Phase 2); Team Admin UI in Phase 9 |
| 28 | User Management | Hard-delete user | Excluded | Excluded per SPEC §2 (`users` are never hard-deleted via API) |
| 29 | User Management | Update user settings (`PATCH /api/v1/auth/me/settings`) | Phase 9 | Server-synced settings in Phase 9 (local preferences in `src/lib/prefs.ts` active since Phase 5) |
| 30 | User Management | Login history (`GET /api/v1/auth/me/login-history`) | Phase 9 | Deferred to Phase 9 |
| 31 | Products | List products (`GET /api/v1/products`) | Phase 6 | Implemented in `CreateBatchDialog.tsx`, `BatchesPage.tsx`, and `FefoPage.tsx` |
| 32 | Batches | Create batch (`POST /api/v1/batches`) | Phase 6 | Implemented in `CreateBatchDialog.tsx` (`/batches` and `/batches/new`) |
| 33 | Batches | List batches with filter/pagination (`GET /api/v1/batches`) | Phase 6 | Implemented in `BatchesPage.tsx` (`/batches`) with URL search params |
| 34 | Batches | Get single batch (`GET /api/v1/batches/:id`) | Phase 6 | Implemented in `BatchDetailPage.tsx` (`/batches/:id`) |
| 35 | Batches | Dispatch batch (`PATCH /api/v1/batches/:id/dispatch`) | Phase 6 | Implemented in `DispatchDialog.tsx` (used in `/fefo` and `/batches/:id`) |
| 36 | Batches | Update traceability note (`PATCH /api/v1/batches/:id/note`) | Phase 6 | Implemented in `BatchDetailPage.tsx` (`/batches/:id`) |
| 37 | Batches | Update raw material fields (`PATCH /api/v1/batches/:id/raw-material`) | Phase 6 | Implemented in `BatchDetailPage.tsx` (`/batches/:id`) |
| 38 | Batches | Soft-delete (archive) batch (`DELETE /api/v1/batches/:id`) | Phase 6 | Implemented in `BatchDetailPage.tsx` (`/batches/:id`) via `ConfirmDialog` |
| 39 | Batches | List archived batches (`GET /api/v1/batches/archived`) | Phase 6 | Implemented in `ArchivedBatchesPage.tsx` (`/batches/archived`) |
| 40 | Batches | Restore archived batch (`PATCH /api/v1/batches/:id/restore`) | Phase 6 | Implemented in `ArchivedBatchesPage.tsx` (`/batches/archived`) |
| 41 | Batches | Get QR code for batch (`GET /api/v1/batches/:id/qr`) | Phase 7 | Implemented in `BatchDetailPage.tsx` (`/batches/:id` QR section); tested in `BatchDetailPage.test.tsx`, `P7-E2E-02` |
| 42 | Batches | Get scan analytics for batch (`GET /api/v1/batches/:id/scans`) | Phase 7 | Implemented in `BatchDetailPage.tsx` (`/batches/:id` Scans section); tested in `BatchDetailPage.test.tsx`, `P7-E2E-01` |
| 43 | FEFO Dispatch | FEFO queue (`GET /api/v1/dispatch/fefo`) | Phase 6 | Implemented in `FefoPage.tsx` (`/fefo`) and top-5 summary in `DashboardPage.tsx` (`/`) |
| 44 | QR & Trace | Public trace by batchCode | Removed | Removed per SPEC §6.3 correction #3 (opaque HMAC token only) |
| 45 | QR & Trace | Public trace by HMAC token (`GET /api/v1/qr/trace/t/:token`) | Phase 7 | Implemented in `PublicTracePage.tsx` (`/trace/t/:token`); tested in `PublicTracePage.test.tsx`, `P7-E2E-01`, `P7-E2E-05`, `P7-E2E-06` |
| 46 | QR & Trace | Record QR scan event (`POST /api/v1/qr/scan`) | Phase 7 | Implemented in `PublicTracePage.tsx` (background POST on trace load); tested in `PublicTracePage.test.tsx`, `P7-E2E-01`, `P7-E2E-09` |
| 47 | Inspections | Create inspection (`POST /api/v1/inspections`) | Phase 6 | Implemented in `InspectionsPage.tsx` (`/inspections`) |
| 48 | Inspections | List all inspections (`GET /api/v1/inspections`) | Phase 6 | Implemented in `InspectionsPage.tsx` (`/inspections`) |
| 49 | Inspections | My inspections (`GET /api/v1/inspections/my`) | Phase 6 | Implemented in `InspectionsPage.tsx` (`/inspections` — "My Inspections" tab) |
| 50 | Inspections | Inspections for a batch (`GET /api/v1/inspections/batch/:batchId`) | Phase 6 | Implemented in `BatchDetailPage.tsx` (`/batches/:id`) and `InspectionsPage.tsx` |
| 51 | Inspections | Single inspection detail (`GET /api/v1/inspections/:id`) | Phase 6 | Implemented in `InspectionsPage.tsx` (`/inspections` detail dialog) |
| 52 | Bulk Import | Import schema (`GET /api/v1/import/schema`) | Phase 8 | Implemented in `ImportPage.tsx` (`/import`); tested in `ImportTests.java`, `ImportPage.test.tsx`, `P8-E2E-01` |
| 53 | Bulk Import | Deterministic header mapping (`POST /api/v1/import/map-headers`) | Phase 8 | Implemented in `ImportPage.tsx` (`/import` Step 2); tested in `ImportTests.java`, `ImportPage.test.tsx`, `P8-E2E-01` |
| 54 | Bulk Import | Validate import rows (`POST /api/v1/import/validate`) | Phase 8 | Implemented in `ImportPage.tsx` (`/import` Step 3); tested in `ImportTests.java`, `ImportPage.test.tsx`, `P8-E2E-01` |
| 55 | Bulk Import | Commit import (`POST /api/v1/import/commit`) | Phase 8 | Implemented in `ImportPage.tsx` (`/import` Step 4); tested in `ImportTests.java`, `ImportPage.test.tsx`, `P8-E2E-01` |
| 56 | Bulk Import | List import history (`GET /api/v1/import`) | Phase 8 | Implemented in `ImportPage.tsx` (`/import` Recent Imports); tested in `ImportTests.java`, `ImportPage.test.tsx`, `P8-E2E-01` |
| 57 | Bulk Import | Single import record (`GET /api/v1/import/:id`) | Phase 8 | Implemented in `ImportPage.tsx` (`/import` Job Details dialog); tested in `ImportTests.java`, `ImportPage.test.tsx` |
| 58 | Bulk Import | Rollback import (`POST /api/v1/import/:id/rollback`) | Phase 8 | Implemented in `ImportPage.tsx` (`/import` Rollback `ConfirmDialog`); tested in `ImportTests.java`, `ImportPage.test.tsx`, `P8-E2E-01` |
| 59 | Notifications | List notifications, SSE stream, mark read | Phase 10 | Deferred to Phase 10 |
| 60 | Role Messages | List/post role-channel messages & record comments | Phase 10 | Deferred to Phase 10 |
| 61 | AI Dispatch Audit | AI dispatch risk analysis (`POST /api/v1/ai/dispatch-audit`) | Phase 11 | Deferred to Phase 11 |
| 62 | Health | Health check (`GET /actuator/health`) | Phase 1 & 5 | Complete (`OfflineBanner.tsx`) |

---

## 3. Documented Deviations & Architectural Decisions

1. **Server-Computed Dashboard Summary (`D-21` Proposed — `GET /api/v1/dashboard/summary`)**:
   - **Reference behavior**: `frontend/src/pages/Dashboard.jsx` lines 3186–3224 computed KPI counts (`total`, `urgent`, `warning`, `ready`, `dispatched`) and the expiring-soon list in the browser over whatever batch slice was loaded in state.
   - **Phase 6 behavior & rationale**: Per SPEC §3.1 and `D-16`, the frontend must never compute freshness tiers or FEFO ordering. `GET /api/v1/dashboard/summary` computes `EXPIRED`, `URGENT`, `WARNING`, `READY`, and `EXCEPTION` counts on the server using the exact `BatchFreshness.applyStatusFilter` query builders as `GET /api/v1/batches`, retrieves the top 5 expiring batches directly from `FefoService.getFefoQueue`, aggregates latest-inspection verdict counts (`PASSED`, `FAILED`, `FLAGGED`, `none`) across active batches, and returns `pendingAccessRequests` only for `manager`, `admin`, and `super-admin` (`null` for other roles).
2. **No Admin Paginated Audit-Log Endpoint Added in Phase 6**:
   - **Audit verification**: Auditing `frontend/src/pages/Dashboard.jsx` (`AdminPanelTab` lines 2106–2110) and `docs/00-audit/feature-parity.md` (rows 1–62) confirms the reference application had no admin activity/audit-log screen (`AdminPanelTab` only had `users`, `requests`, and `deleted` sub-views). The per-batch timeline in `BatchDetailDrawer.jsx` (`HistoryTab` lines 632–669) was built from `batch.createdAt`, `batch.noteHistory`, `batch.dispatchHistory`, and `batch.deletedAt` returned by `GET /api/v1/batches/:id`. Therefore, per Phase 6 Part B instructions ("Add an admin-only paginated audit endpoint only if the screen map shows the reference had an activity view"), no admin audit endpoint is added.
3. **Server-Side Search & Sort with URL State on `/batches`**:
   - **Reference behavior**: `Dashboard.jsx` lines 491–493 and 570–598 filtered (`batchCode`, `productName`, `farmerName`, `sourceLotCode`) and sorted (`expiry`, `code`, `product`) batches in memory inside React component state.
   - **Phase 6 behavior & rationale**: `BatchesPage.tsx` binds `status`, `sku`, `search`, `sort`, `page`, and `limit` to the URL query string (`useSearchParams`) and delegates filtering, literal-escaped regex search (`batchCode`, `productName`, `sourceLotCode`, `farmerName`), and whitelisted sorting (`expiryDate`, `createdAt`, `batchCode`, `productName`, `quantityProduced`) to `GET /api/v1/batches`.
4. **FEFO Out-of-Order Override & Quality-Hold Enforcement in Dispatch Dialog (`D-14`, `D-18`, `D-19`)**:
   - **Reference behavior**: `DispatchModal.jsx` lines 1–195 submitted `buyerName` and `dispatchDate` without handling server-side FEFO ordering or inspection holds.
   - **Phase 6 behavior & rationale**: `DispatchDialog.tsx` handles `409 BATCH_EXPIRED`, `409 QUALITY_HOLD` (blocking dispatch when latest inspection verdict is `FAILED`), `409 DISPATCH_OUT_OF_ORDER` (extracting and displaying the earlier-expiring same-SKU batch code from the server error message and revealing a required `overrideReason` textarea for `dispatch-coordinator`, `admin`, and `super-admin`), `409 CONFLICT`, and displays the server's `warning` banner when dispatching a `FLAGGED` batch.
5. **Append-Only Inspections & Server Verdict Validation (`D-13`, `D-15`)**:
   - **Reference behavior**: `Inspection.model.js` line 78 had a 30-day TTL index and allowed `PASSED` verdicts even when checklist items failed.
   - **Phase 6 behavior & rationale**: Inspections are permanent and read-only after creation (`POST /api/v1/inspections`). Each of the 8 checklist items supports `true` (Pass), `false` (Fail), or `null` (Not assessed) plus a note up to 200 characters. Selecting `PASSED` when any item is `false` returns HTTP 422 `VALIDATION_ERROR` from the server and highlights the error inline.
6. **Generated UI Permissions (`src/auth/permissions.generated.ts`)**:
   - **Reference behavior**: Role checks were scattered across JSX conditionals in `Dashboard.jsx`.
   - **Phase 6 behavior & rationale**: `npm run gen:permissions` generates `src/auth/permissions.generated.ts` directly from `docs/permission-matrix.csv`, and `npm run check:permissions-drift` verifies zero drift. Navigation links and action buttons (Create Batch, Inspect, Dispatch, Edit Note, Correct Raw Material, Archive, Restore) use `permissions.generated.ts` while the backend enforces every permission rule.
