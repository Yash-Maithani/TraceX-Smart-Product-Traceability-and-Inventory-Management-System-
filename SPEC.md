# TraceX — System Specification (SPEC.md)
> Version: 0.3 (Phase 8.0 — import reference extraction, §3.7 Bulk Import, D-23 & D-24 proposed)
> Last updated: 2026-10-06

---

## ⚠ Decisions Needed from the Owner

| # | Decision | Default Proposed | Status |
|---|----------|-----------------|--------|
| D-1 | Token storage: Authorization header vs httpOnly cookie | Authorization header | **RESOLVED — Authorization header** |
| D-2 | Refresh tokens vs single long JWT | Single 8h token; per-request tokenVersion check revokes immediately | **RESOLVED — single token, no refresh** |
| D-3 | Google OAuth: was it a real working feature? | Treat as real; include if confirmed by audit | **RESOLVED — Include as Should-have in Phase 11, enabled only when GOOGLE_CLIENT_ID (backend) and VITE_GOOGLE_CLIENT_ID (frontend) are set; unverified until owner supplies a client ID. Audit confirms Google OAuth is wired end-to-end: frontend uses `@react-oauth/google` (`frontend/src/main.jsx` line 23, `frontend/src/pages/Login.jsx` lines 719–754, `frontend/src/components/SettingsPanel.jsx` lines 397–450) calling `POST /auth/google/token`; backend verifies tokens via Google userinfo endpoint (`backend/src/services/googleIdentity.js` lines 14–62, `backend/src/controllers/googleAuth.controller.js` lines 29–84) and links/unlinks in `backend/src/controllers/auth.controller.js` lines 553–643.** |
| D-4 | Live-update mechanism: SSE vs Socket.IO vs polling | SSE (fetch-based stream reader, authenticated like REST) | **RESOLVED — SSE** |
| D-5 | XLSX import: support alongside CSV? | Support both | **RESOLVED — CSV only. XLSX is not parsed anywhere in the reference, client or server: `backend/src/controllers/import.controller.js` lines 7–9 accepts pre-parsed JSON rows only; neither `backend/package.json` nor `frontend/package.json` contains any XLSX/excel/sheet dependency; `frontend/src/utils/csvParser.js` lines 1–50 parses CSV text only. New build supports CSV bulk import in Phase 8; XLSX is excluded.** |
| D-6 | FEFO defaults | Accept §3.1 with fixes | **RESOLVED — §3.1 is authoritative** |
| D-7 | Dev ports: API 8081, Vite 5174 | Accept | **RESOLVED** |
| D-8 | Database name: `tracex_fresh` | Accept | **RESOLVED** |
| D-9 | Farmer PII in AI prompts | Omit farmerName; send village only | **RESOLVED** |
| D-10 | Dispatch coordinator permissions | Exclusive right to dispatch; cannot create batches | **RESOLVED** |
| D-11 | Batch code prefix: TX- vs HS- | TX- | **RESOLVED — TX-** |
| D-12 | Expired batches in dispatch queue | Never dispatchable; excluded from FEFO queue | **RESOLVED** |
| D-13 | Inspection verdict logic | Inspector sets verdict; server rejects PASSED when any checklist item is explicitly `false` | **RESOLVED** |
| D-14 | Out-of-order dispatch | Blocked unless override flag + reason provided; override is audited | **RESOLVED** |
| D-15 | Inspection TTL | No TTL on Inspection documents | **RESOLVED — inspections are permanent** |
| D-16 | Freshness status tier (EXPIRED/URGENT/WARNING/READY/EXCEPTION/DISPATCHED) | Derived at runtime from `expiryDate` (`LocalDate`) and injected `Clock` bean; never stored in MongoDB (only `lifecycleState` `ACTIVE`/`DISPATCHED` and `isDeleted` are stored). Compute logic lives in `BatchFreshness.java` | **RESOLVED** |
| D-17 | Date storage and comparison timezone | Business dates (`packDate`, `expiryDate`, `dispatchDate`, and `dispatchHistory[].dispatchDate`) are date-only values (`LocalDate`), stored in MongoDB and serialized in JSON as `"YYYY-MM-DD"` strings. All date-only display comparisons ("days until expiry") use `BUSINESS_TIME_ZONE` env var (default `Asia/Kolkata`) via the backend `Clock` bean. Audit/event timestamps (`createdAt`, `updatedAt`, `dispatchedAt`, etc.) remain UTC `Instant`s | **RESOLVED** |
| D-18 | FEFO scope (per-SKU vs global) | "Out of order" is evaluated per SKU: a batch is out of order if an eligible batch of the same SKU has a strictly earlier expiryDate. Batches with the same expiryDate are a tie and neither is out of order. The category and sku query filters on the FEFO endpoint apply before ordering | **RESOLVED** |
| D-19 | Quality hold on dispatch | Reference `backend/src/controllers/batches.controller.js` lines 123–154 does not check `qualityCheck` or inspection status before dispatching. New build blocks dispatch when a batch's latest inspection verdict is `FAILED` (`409 QUALITY_HOLD`); a batch whose latest verdict is `FLAGGED` is dispatchable and returns a warning in the response | **RESOLVED** |
| D-20 | Per-page photographic backdrops | Real owner-supplied/approved photographs (with recorded `source`, `author`, `licence`, and `licenceUrl` in `design-assets/backdrops.json`) allowed solely as decorative backdrops (`alt=""`, `aria-hidden="true"`) behind a flat colour overlay token (`--backdrop-scrim`), with content on solid surface tokens and a flat fallback when images are off, blocked, or `Save-Data` is set | **RESOLVED — requested by owner** |
| D-21 | Server-computed dashboard summary endpoint (`GET /api/v1/dashboard/summary`) | Reference `frontend/src/pages/Dashboard.jsx` lines 3186–3224 computed KPI counts and expiring-soon lists in the browser over a single page of batches. New build adds `GET /api/v1/dashboard/summary` (any authenticated role, matrix phase 6) returning server-computed counts (`EXPIRED`, `URGENT`, `WARNING`, `READY`, `EXCEPTION`) built with the exact `BatchFreshness.applyStatusFilter` builders, `dispatched` total, top 5 expiring batches from `FefoService`, latest-inspection verdict counts (`PASSED`, `FAILED`, `FLAGGED`, `none`), role-scoped `pendingAccessRequests` (`manager`/`admin`/`super-admin` only; `null` for others), and `businessDate` | **RESOLVED** |
| D-22 | Trace token design (opaque HMAC token) | traceToken is opaque (16-byte SecureRandom nonce + 16-byte HMAC-SHA256(TRACE_TOKEN_SECRET, nonce) tag, base64url `<nonce>.<tag>`). Stored on batch in unique sparse indexed field `traceToken`. Verification is constant-time tag check before DB read. Token never changes for batch lifetime. Archiving returns 404, restoring makes link work. Dispatched batches remain publicly traceable showing status DISPATCHED. TRACE_TOKEN_SECRET must be stable. Prod profile fails fast if missing or < 32 chars. QR PNG returned as data URL | **RESOLVED — owner-delegated to planner** |
| D-23 | Import batch creation & validation code path | Import commit creates batches through the same `BatchService` creation path as `POST /api/v1/batches` (so each imported batch gets an atomic `TX-YYYY-MM-NNN` batch code from `BatchCodeGenerator`, a `traceToken`, runtime freshness derivation, and standard validation), never by writing documents directly. Row validation reuses existing batch validators with no copied rules (`POST /api/v1/batches` does not reject future `packDate`, so import does not add a future-`packDate` rule) | **RESOLVED** |
| D-24 | Import rollback semantics & guards | Rollback soft-deletes only the batches the job inserted (`insertedBatchIds`), skipping any already-archived (`isDeleted: true`) batches and archiving the remaining active ones via `BatchService.archiveBatch` (`DELETE /api/v1/batches/{id}`) with reason `"Import rollback <jobId>"`, returning `{ archived, alreadyArchived }` and recording a job-level `IMPORT_ROLLED_BACK` audit entry; it never hard-deletes and does not undo updates made to existing batches. A `"running"` job with no update for `tracex.import.stale-running-minutes` (default `15`) is lazily marked `"failed"` (with `finishedAt` set) on list, detail, commit, and rollback. Rollback is allowed for `"done"` OR `"failed"` jobs with non-empty `insertedBatchIds`; it checks all preconditions first and returns HTTP `409 CONFLICT` (changing nothing) if any inserted batch has been dispatched (`lifecycleState == "DISPATCHED"`), if status is `"running"` or `"rolled_back"`, or if `insertedBatchIds` is empty | **RESOLVED** |

---

## §1 — Product, Scope, Actors, MoSCoW

### Product
TraceX is a batch-traceability and inventory-management system for an organic food company (TraceX Technologies, Uttarakhand, India). It records the journey of produce batches from raw-material sourcing through production, quality inspection, and dispatch. Consumers scan a QR code on a product and receive a provenance page with no login required.

### Technology Stack (New Build)
- **Backend**: Java 21 / Spring Boot 3, Spring Security 6, Spring Data MongoDB, Spring Mail
- **Database**: MongoDB Atlas, database `tracex_fresh`
- **Frontend**: Vite + React 18 + TypeScript
- **Tests**: JUnit 5, Testcontainers (backend); Vitest, Playwright (frontend/E2E)
- **Deployment**: Firebase Hosting (frontend), Render with Docker (backend), MongoDB Atlas

### Scope In
- Batch lifecycle management (create, inspect, dispatch, archive, restore)
- FEFO dispatch queue
- Role-based access control (5 roles + isSuperAdmin flag)
- Access-request + invite-based onboarding
- Public QR trace page (opaque token only)
- Quality inspection with structured checklist
- Bulk CSV import (CSV only per D-5; XLSX excluded from scope)
- In-app notifications + SSE live updates
- AI-powered dispatch audit (Gemini + NVIDIA fallback)
- Admin panel (user management, soft-delete, recycle bin)
- Login history, session revocation
- Role-channel messaging + record comments

### Scope Out (this version)
- Hard-delete of batches (traceability is permanent)
- Consumer-facing mobile app
- ERP/WMS integration
- Google OAuth (Phase 11 Should-have per D-3, enabled only when GOOGLE_CLIENT_ID / VITE_GOOGLE_CLIENT_ID are set)

### Actors
| Actor | Description |
|-------|-------------|
| Consumer | Public user who scans a QR code; no login |
| Factory Manager | Creates batches, edits notes/raw-material, bulk imports |
| Quality Inspector | Submits inspections |
| Dispatch Coordinator | Records dispatches |
| Manager | Read-only admin panel; reads access requests |
| Admin | Full user and batch management |
| Super Admin | System owner flag; hard-delete users, restore, set isSuperAdmin |

### MoSCoW Priorities

**Must Have**
- M-01: Authenticated batch CRUD (create, read, soft-delete, restore)
- M-02: JWT auth with tokenVersion session revocation (per-request DB check)
- M-03: Role-based access control (5 roles + isSuperAdmin flag as specified in §2)
- M-04: FEFO dispatch queue (sorted by status tier then expiryDate; expired batches excluded)
- M-05: Public QR trace page (no auth; opaque HMAC token only; returns whitelisted DTO)
- M-06: Quality inspection (8-item checklist, PASSED/FAILED/FLAGGED verdict, 1–5 rating; no TTL)
- M-07: Access-request + invite flow (admin approves, email invite, OTP activation)
- M-08: Admin panel (user CRUD, role change, toggle active, soft-delete, recycle bin)
- M-09: In-app notifications + SSE live updates
- M-10: Batch code generation `TX-YYYY-MM-NNN` with monthly counter reset and atomic allocation

**Should Have**
- S-01: AI dispatch audit (Gemini 2.5 Flash + NVIDIA fallback, 4h cache)
- S-02: Bulk CSV import with rollback
- S-03: Login history (per-user LoginEvent records, 30-day TTL)
- S-04: Forgot password OTP email flow
- S-05: Role-channel messages + record comments
- S-06: Dispatch coordinator out-of-order override with audit
- S-07: Google OAuth login link/unlink (conditional on GOOGLE_CLIENT_ID and VITE_GOOGLE_CLIENT_ID; Phase 11)

**Could Have**
- C-01: Walkthrough tour (onboarding)

**Won't Have (this version)**
- W-01: Hard-delete of batches
- W-02: Consumer-facing mobile app
- W-03: ERP integration
- W-04: XLSX import support (reference codebase is CSV-only; XLSX excluded)

---

## §2 — Roles and Permission Matrix

### Role Definitions

**Five role values** plus one flag. The `role` field takes exactly these string values:
- `admin` (Tier 1)
- `manager` (Tier 2)
- `factory-manager` (Tier 3)
- `quality-inspector` (Tier 3)
- `dispatch-coordinator` (Tier 3)

**`isSuperAdmin: true` flag** (Tier 0) — not a sixth role value. It may coexist with any role string. It grants all permissions above Tier 1. No API endpoint may set this flag to `true`. The system must also guard against the last super-admin being deactivated or deleted, leaving the system without an owner.

Source for confirmed role values: `backend/src/models/User.model.js` lines 22–26; `backend/src/middleware/requireAdmin.js` lines 16–23; `tracex-backend/src/main/java/com/tracex/model/Role.java` lines 10–15 (five Java enum values matching the five role strings).

### Key Permission Rules
- A deactivated (`isActive: false`), soft-deleted (`isDeleted: true`), or demoted user is denied on their very next request via tokenVersion check and DB re-read — even if the token is still within its 8h window. Source: `backend/src/middleware/auth.js` lines 60–72.
- No API endpoint may set `isSuperAdmin: true`. Only the `setSuperAdmin.js` migration script or Atlas console. Source: `User.model.js` comment lines 29–32.
- The system must reject a deactivation or deletion that would leave zero active super-admins.


### Admin-vs-Admin Action Rules

| Actor | Target | toggle | role-change | delete | restore |
|---|---|---|---|---|---|
| super-admin | super-admin | deny (`409 LAST_SUPERADMIN` if sole active super-admin; else `409 SELF_MODIFICATION_NOT_ALLOWED` on self, `200 OK` on other active super-admin) | deny (`409 SELF_MODIFICATION_NOT_ALLOWED` on self; `409 LAST_SUPERADMIN` on other super-admin) | deny (`409 LAST_SUPERADMIN` if sole active super-admin or targeting other super-admin; `409 SELF_MODIFICATION_NOT_ALLOWED` on self when >= 2 active super-admins exist) | allow (200 OK) |
| super-admin | admin | allow (200 OK) | allow (200 OK) | allow (200 OK) | allow (200 OK) |
| super-admin | any lower | allow (200 OK) | allow (200 OK) | allow (200 OK) | allow (200 OK) |
| admin | super-admin | deny (403 RBAC_INSUFFICIENT) | deny (403 RBAC_INSUFFICIENT) | deny (403 RBAC_INSUFFICIENT) | deny (403 RBAC_INSUFFICIENT) |
| admin | admin (self) | deny (409 SELF_MODIFICATION_NOT_ALLOWED) | deny (409 SELF_MODIFICATION_NOT_ALLOWED) | deny (409 SELF_MODIFICATION_NOT_ALLOWED) | N/A |
| admin | admin (other) | allow (200 OK) | allow (200 OK) | allow (200 OK) | deny (403 RBAC_INSUFFICIENT) |
| admin | any lower | allow (200 OK) | allow (200 OK) | allow (200 OK) | deny (403 RBAC_INSUFFICIENT) |

**Precedence rule (`LAST_SUPERADMIN` vs `SELF_MODIFICATION_NOT_ALLOWED`)**:
- In `toggle` (`PATCH /api/v1/auth/users/:id/toggle`, `UserService.java` lines 379–383) and `delete` (`DELETE /api/v1/auth/users/:id`, `UserService.java` lines 450–454), when the actor targets their own account AND is the last active super-admin (`countByIsSuperAdminTrueAndIsActiveTrueAndIsDeletedFalse() <= 1`), `LAST_SUPERADMIN` (HTTP 409) wins over `SELF_MODIFICATION_NOT_ALLOWED` (HTTP 409). When two or more active super-admins exist, self-toggle and self-delete return `409 SELF_MODIFICATION_NOT_ALLOWED`.
- In `role-change` (`PATCH /api/v1/auth/users/:id/role`, `UserService.java` lines 415–431), self-modification is checked first and always returns `409 SELF_MODIFICATION_NOT_ALLOWED` (even if the actor is the sole active super-admin), whereas attempting to change another super-admin's role returns `409 LAST_SUPERADMIN` (super-admin role immutability).

### Permission Matrix
See `docs/permission-matrix.csv` for the full machine-readable matrix. Key highlights:
- **Factory-manager**: create batches, edit notes, edit raw material, bulk import; cannot dispatch, cannot manage users.
- **Quality-inspector**: submit and read inspections; cannot create batches, dispatch, or import.
- **Dispatch-coordinator**: dispatch batches (including override with reason); cannot create batches, inspect, or import.
- **Manager**: read-only admin panel (users, requests, directory) and bulk import (`GET`/`POST /api/v1/import*`); cannot write users or create/edit individual batches directly.
- **Admin**: all of the above plus user CRUD, batch archive/restore, bulk import, and batch dispatch (including FEFO override with reason).
- **Super-admin flag**: everything admin can do plus recycle-bin (deleted users), hard-delete users, bulk import, and batch dispatch (including FEFO override with reason).

#### Bulk Import Permissions (`D-23` / `D-24` — Resolved)
In the reference (`backend/src/routes/import.routes.js` line 7 and `backend/src/middleware/requireAdmin.js` lines 109–116), all seven `/api/import/*` endpoints use `requireImporter`, which allows any user with `isSuperAdmin === true` or `role` in `['admin', 'manager', 'factory-manager']`, and denies `quality-inspector` and `dispatch-coordinator` with HTTP 403. `docs/permission-matrix.csv` (lines 48–54, `phase=8`) matches `requireImporter` 1-to-1: `super-admin`, `admin`, `manager`, and `factory-manager` are `allow`, while `quality-inspector`, `dispatch-coordinator`, and `anonymous` (`401 AUTH_NO_TOKEN`) are `deny`. All seven `/api/v1/import*` endpoints in Phase 8 therefore authorize `super-admin`, `admin`, `manager`, and `factory-manager`, and reject `quality-inspector` and `dispatch-coordinator` with HTTP 403 `RBAC_INSUFFICIENT`.

#### Dispatch & FEFO Override Permissions
Exactly three actors may dispatch batches (`PATCH /api/v1/batches/:id/dispatch`) and may override the FEFO order (by supplying a non-empty `overrideReason` string):
1. `dispatch-coordinator`
2. `admin`
3. `super-admin` (any user with `isSuperAdmin: true`)

All other roles (`factory-manager`, `quality-inspector`, `manager`) are denied dispatch and cannot override the FEFO order.

#### Super-Admin Modeling in Tests
In RBAC test suites and permission verification (e.g. `TEST-M-03`), the super-admin actor is modeled as a user document with `isSuperAdmin: true` alongside their assigned role string (e.g. `{ username: 'superadmin', role: 'admin', isSuperAdmin: true }` or `{ username: 'factory_sa', role: 'factory-manager', isSuperAdmin: true }`). In `docs/permission-matrix.csv`, the `super-admin` column represents this state, distinct from standard `admin` (`role: 'admin'`, `isSuperAdmin: false`).

---

## §3 — Business Rules

### §3.1 — FEFO (First Expired, First Out)

**Single responsibility**: `FefoService` (`backend/src/main/java/com/tracex/service/FefoService.java`) is the sole service that decides FEFO eligibility, 3-group classification (`queue`, `expired`, `exceptions`), queue ordering, 1-based `rank` assignment, per-SKU out-of-order evaluation, and `priorityScore` computation. `BatchFreshness` (`backend/src/main/java/com/tracex/util/BatchFreshness.java`) is the sole class holding tier thresholds (`URGENT_THRESHOLD_DAYS = 7`, `WARNING_THRESHOLD_DAYS = 30`).

**Eligible batches**: `isDeleted: false` AND `lifecycleState == "ACTIVE"` (not `DISPATCHED`) AND derived status is `READY`, `WARNING`, or `URGENT` (`daysUntilExpiry > 0`) AND `expiryDate` is a valid non-null date.

Note: "soft-deleted" and "archived" refer to the same concept throughout this spec — a batch where `isDeleted: true`. There is no separate "archive" field.

**Three FEFO response groups** (`GET /api/v1/dispatch/fefo?category=&sku=`):
- **`queue`**: Eligible batches (`URGENT`: `daysUntilExpiry` 1–7 inclusive; `WARNING`: `daysUntilExpiry` 8–30 inclusive; `READY`: `daysUntilExpiry > 30`), sorted in canonical FEFO order and assigned a 1-based `rank` (`1, 2, ...`).
- **`expired`**: Active, non-deleted batches with a valid `expiryDate` where `daysUntilExpiry <= 0` (including batches expiring today, where `daysUntilExpiry == 0`). Shown in a separate read-only list; **never dispatchable** (D-12). Never included in `queue`.
- **`exceptions`**: Active, non-deleted batches with a missing (field omitted), `null`, or unparseable (e.g. `"not-a-date"`) `expiryDate`. Each item in `exceptions` has `expiryDate: null`, `status: "EXCEPTION"`, `daysUntilExpiry: null`, `rank: null`, and a populated `exceptionReason` string (`"Missing expiryDate"`, `"Null expiryDate"`, or `"Unparseable expiryDate: <raw>"`). Never included in `queue` or `expired`.
- **Tolerant batch list & detail reads (`GET /api/v1/batches` and `GET /api/v1/batches/:id`) and property-scoped converter**: Leniency is restricted strictly to `Batch.packDate` and `Batch.expiryDate` via `@ValueConverter(BatchLocalDateValueConverter.class)` (not a global converter). Security-critical `Instant` expiry fields (`AccessRequest.inviteExpiry`, `User.otpExpiry`, `User.resetTokenExpiry`) have no lenient converter and **fail closed** (`401 AUTH_INVALID_TOKEN` with the standard error envelope) if corrupted in MongoDB. In `GET /api/v1/batches` and `GET /api/v1/batches/:id`, any non-dispatched batch whose `expiryDate` is missing, `null`, or unparseable is returned with `expiryDate: null`, `status: "EXCEPTION"`, `daysUntilExpiry: null`, and `exceptionReason: "Missing, null, or unparseable expiryDate"`.
- **Computed `status` values and `status` filter**: Across `BatchSummaryDto` and `BatchDetailDto`, `status` takes one of six values: `EXPIRED`, `URGENT`, `WARNING`, `READY`, `EXCEPTION`, or `DISPATCHED`. `exceptionReason` is populated only when `status` is `EXCEPTION` (and `null` for all other statuses); `daysUntilExpiry` is `null` when `expiryDate` is missing, `null`, or unparseable (`status: "EXCEPTION"`). The batch list filter `GET /api/v1/batches?status=<STATUS>` supports all six statuses (`EXPIRED`, `URGENT`, `WARNING`, `READY`, `EXCEPTION`, `DISPATCHED`), where `status=EXCEPTION` returns active, non-deleted batches whose `expiryDate` in MongoDB is missing, `null`, or does not match `"YYYY-MM-DD"`.
- Dispatched (`lifecycleState == "DISPATCHED"`) and archived (`isDeleted: true`) batches are excluded from all three FEFO groups.

Source: `backend/src/services/expiryCalculator.js` lines 21–26 (exact thresholds confirmed).

**Sort order within `queue`** (primary to quaternary):
1. Status tier: `URGENT` (0) → `WARNING` (1) → `READY` (2)
2. `daysUntilExpiry` ascending (`expiryDate` ascending, earliest expiry first)
3. `createdAt` ascending
4. `batchCode` ascending as final deterministic tie-break

**Per-SKU out-of-order evaluation (D-18)**: "Out of order" is evaluated per SKU. A batch is out of order if and only if another FEFO-eligible batch (`isDeleted: false`, `lifecycleState: "ACTIVE"`, valid `expiryDate`, `daysUntilExpiry > 0`) of the **same `sku`** has a strictly earlier `expiryDate` (`other.expiryDate < target.expiryDate`, or strictly smaller `daysUntilExpiry`). Batches of the same SKU with identical `expiryDate` are a tie and neither is out of order.

**Priority score (`priorityScore`)**: stored on batch for display purposes only. Confirmed displayed in the reference UI at `frontend/src/pages/Dashboard.jsx` line 1006 (`{b.priorityScore?.toFixed(1)}`) and `frontend/src/components/BatchDetailDrawer.jsx` line 328 (`label="Priority Score" value={batch.priorityScore}`). It is computed in `FefoService` and NEVER used for FEFO ordering. Formula (display only):
```
priorityScore = max(0, 365 − daysUntilExpiry) + riskBonus
riskBonus: HIGH = +100, MEDIUM = +50, LOW = 0
```
Source: `backend/src/services/expiryCalculator.js` lines 29–33.

**Clock**: "today" always comes from an injected `Clock` bean (Spring) configured with `BUSINESS_TIME_ZONE` (default `Asia/Kolkata`, D-17) — never `new Date()` directly — to enable deterministic tests.

**Category/product filter**: `category` (matched via `Product.category`) and `sku` query parameters on `GET /api/v1/dispatch/fefo` are applied before grouping, ordering, and 1-based `rank` assignment (D-18).

### §3.2 — Batch Code and Counter

Format: `TX-YYYY-MM-NNN`
- YYYY: 4-digit year
- MM: 2-digit month (01–12)
- NNN: 3-digit sequence starting at 001, padded with zeros
- Counter resets each month. Source: reference `batchCodeGenerator.js` uses month prefix — confirmed monthly reset.
- **Atomic allocation**: new build uses a `counters` collection (`{ _id: "batch_TX-YYYY-MM", seq: N }`) with `findOneAndUpdate + $inc` to prevent race conditions. This fixes the race condition documented in problems.md OI-02.
- Prefix `TX-` confirmed by D-11. Reference used `HS-` — discrepancy noted in `discrepancies.md`.

### §3.3 — Inspection Checklist and Verdict

**Checklist** (8 fixed items, confirmed from `backend/src/models/Inspection.model.js` lines 17–26):
1. Packaging integrity
2. Label accuracy & legibility
3. Expiry date visible & correct
4. Weight / quantity correct
5. No visible contamination
6. Colour & texture acceptable
7. Odour within acceptable range
8. Storage conditions met

Each item (`Inspection.model.js` lines 28–32): `label` (must match one of the 8 fixed labels; unknown labels are rejected with HTTP 422 `VALIDATION_ERROR`), `passed` (`Boolean | null`; `null` = not assessed), optional `note` (max 200 chars; line 31).

**Verdict and field validation rules** (D-13, `Inspection.model.js` lines 43–65):
- Inspector explicitly sets `status` to `PASSED`, `FAILED`, or `FLAGGED` (lines 43–48).
- Server **rejects** a `PASSED` verdict if any checklist item has `passed === false` (explicitly failed). Server returns HTTP 422 `VALIDATION_ERROR` with a `fieldErrors` entry on `status`.
- A checklist item with `passed === null` (not assessed) does not block `PASSED`.
- `rating`: integer `1`–`5` (1 = very poor, 5 = excellent; lines 50–55). Required.
- `findings`: optional string, max 1000 chars (line 64).
- `recommendation`: optional string, max 400 chars (line 65).
- Client-supplied `isLatest` in request body is ignored; server always manages `isLatest` (`Inspection.model.js` line 75).

**Which batches may be inspected** (confirmed from `backend/src/controllers/inspection.controller.js` lines 39–42):
- If the batch does not exist or is soft-deleted (`batch.isDeleted == true`), return HTTP 404 `NOT_FOUND` (`inspection.controller.js` line 41).
- If the batch is already dispatched (`batch.lifecycleState == "DISPATCHED"`), return HTTP 409 `CONFLICT` (`inspection.controller.js` line 42: `"Cannot inspect a dispatched batch"`).
- Only non-deleted, `ACTIVE` batches may be inspected.

**Append-only**: inspections cannot be updated or deleted after creation. `PUT`, `PATCH`, and `DELETE` on `/api/v1/inspections` or `/api/v1/inspections/{id}` return HTTP 405 `METHOD_NOT_ALLOWED`.

**No TTL** (D-15): Inspection documents are permanent. The reference had a 30-day TTL on inspections — this is removed in the new build. Source for reference TTL: `Inspection.model.js` line 78.

**Quality snapshot on Batch**: when an inspection is created, denormalize `qualityCheck.status`, `qualityCheck.rating`, `qualityCheck.inspectedAt`, `qualityCheck.inspectorName` onto the Batch document (`inspection.controller.js` lines 78–91). This preserves quality data independent of inspection document lifetime.

**isLatest flag**: the previous inspection for the same batch has `isLatest` set to `false` when a new one is submitted (`inspection.controller.js` lines 45–49).

**Who can create**: `quality-inspector`, `admin`, `super-admin` (confirmed from `requireAdmin.js` lines 94–98).
**Who can read**: `quality-inspector`, `factory-manager`, `manager`, `admin`, `super-admin`. `dispatch-coordinator` is denied (`403 RBAC_INSUFFICIENT`) on all `/api/v1/inspections*` routes.

### §3.4 — Access-Request Approval and Provisioning

1. Anyone submits `POST /api/v1/auth/request-access` with name, email, desired role.
2. Unique email constraint prevents duplicate submissions. Source: `AccessRequest.model.js` line 6.
3. Admin approves → generates raw invite token (32 cryptographically secure random bytes), stores SHA-256 hash in `inviteToken`, sets `inviteExpiry` (48h), sends branded email with invite link (`${FRONTEND_URL}/activate?token=...`).
4. User opens `/activate?token=...` → `POST /api/v1/auth/activate` (username derived: first word of name lowercased, non-alphanumeric stripped, incremental numeric suffix on collision; password set, min 8 chars) → dispatches 6-digit OTP (10 min expiry, SHA-256 hashed) → `POST /api/v1/auth/verify-otp` (5-attempt lockout) → account active, JWT issued.
5. `inviteUsed: true` prevents token reuse.
6. No automatic provisioning — all approvals require an admin action.

### §3.5 — Status Transitions, Archive, Soft-Delete, Restore

**"Soft-delete" and "archive" are the same concept**: setting `isDeleted: true`. There is no separate archive state.

**Batch status machine**:
```
READY ──┐
WARNING ─┼──► DISPATCHED  (terminal for normal flow)
URGENT ──┘

EXPIRED      (computed live; never dispatchable — D-12)

Any live status ──► soft-deleted (isDeleted=true; admin only)
Soft-deleted  ──►  restored (isDeleted=false; admin only)
```

Note: the emergency-dispatch path from EXPIRED is removed per D-12.

**Out-of-order dispatch** (D-14, D-18): if an eligible batch of the same `sku` has a strictly earlier `expiryDate`, the API blocks the dispatch with HTTP 409 `DISPATCH_OUT_OF_ORDER` naming the earlier `batchCode` unless a non-blank `overrideReason` string is provided. When an override is used, it is recorded in the batch's `dispatchHistory[]` (`outOfOrder: true`, `overrideReason`) and `noteHistory[]` with the actor, timestamp, and reason, and written to `audit_logs`.

**User soft-delete / restore**:
- Admin deletes → `isDeleted: true`, `deletedBy`, `deletedAt`, `deleteNote`.
- Soft-deleted user: blocked at next request by `auth` middleware (isDeleted check, source: `auth.js` line 60).
- Super-admin recycle bin shows deleted users.
- Super-admin restores or hard-deletes permanently.
- Guard: system must refuse to delete or deactivate the last active super-admin.

### §3.6 — Dispatch

**Endpoint**: `PATCH /api/v1/batches/:id/dispatch`
**Request body**: `{ buyerName, dispatchDate?, overrideReason? }`
- `buyerName`: required (`backend/src/controllers/batches.controller.js` line 126), trimmed (`backend/src/models/Batch.model.js` line 102), 1–200 characters (reference `Batch.model.js` line 102 has no explicit maxlength; capped at 200 chars in rebuild). Blank or > 200 chars returns HTTP 422 `VALIDATION_ERROR` with `fieldErrors` on `buyerName`.
- `dispatchDate`: optional date-only value (`LocalDate`, `"YYYY-MM-DD"` string, D-17); defaults to `LocalDate.now(clock)` in the business timezone (`Asia/Kolkata`, D-17). `dispatchDate` cannot be before `packDate` (`dispatchDate < packDate`) and cannot be in the future (`dispatchDate > today`); violating either returns HTTP 422 `VALIDATION_ERROR` with `fieldErrors` on `dispatchDate`.
- `overrideReason`: optional string (max 500 chars); required (non-blank) when dispatching out of FEFO order for the same SKU (D-14, D-18).

**Who can dispatch and override FEFO**: `dispatch-coordinator`, `admin`, and `super-admin` may dispatch batches (`PATCH /api/v1/batches/:id/dispatch`). Role authorization is checked **first**, before any database lookup, so unauthorized roles (`factory-manager`, `quality-inspector`, `manager`) always receive HTTP 403 `RBAC_INSUFFICIENT` even for a non-existent batch ID.

**Rule evaluation order**:
1. **Exists and not soft-deleted**: batch must exist and have `isDeleted == false`, else HTTP 404 `NOT_FOUND`.
2. **Not already dispatched**: `lifecycleState` must not be `"DISPATCHED"`, else HTTP 409 `CONFLICT`.
3. **Not expired (D-12)**: `daysUntilExpiry` (in business timezone) must be `> 0` (`expiryLocal > todayLocal`). A batch expiring today (`daysUntilExpiry == 0`) or in the past (`daysUntilExpiry < 0`) is rejected with HTTP 409 `BATCH_EXPIRED`.
4. **Quality hold (D-19)**: Reference `batches.controller.js` lines 123–154 does not check inspection status on dispatch. Per D-19, if the batch's latest inspection verdict (`qualityCheck.status`) is `"FAILED"`, dispatch is blocked with HTTP 409 `QUALITY_HOLD`. If the latest verdict is `"FLAGGED"`, dispatch is allowed and the response includes a warning message.
5. **Per-SKU FEFO order (D-18)**: `FefoService` checks whether any other eligible batch of the same `sku` (`isDeleted == false`, `lifecycleState == "ACTIVE"`, valid `expiryDate`, `daysUntilExpiry > 0`) has a strictly earlier `expiryDate` (`other.expiryDate < batch.expiryDate`). Equal `expiryDate` is a tie (neither is out of order). If a strictly earlier batch exists and `overrideReason` is null or blank, reject with HTTP 409 `DISPATCH_OUT_OF_ORDER` naming the `batchCode` that should be dispatched first. If `overrideReason` is provided, allow the dispatch with `outOfOrder = true`.

**Atomic conditional update**:
Dispatch executes a single atomic `findAndModify` on `batches` matching `{ _id: id, isDeleted: false, lifecycleState: "ACTIVE", expiryDate: { $gte: startOfTomorrowInBusinessZone, $regex: "^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])$" } }`, setting `lifecycleState = "DISPATCHED"`, `buyerName`, `dispatchDate` (`"YYYY-MM-DD"`), and pushing to `dispatchHistory[]` (and `noteHistory[]` on override). If `findAndModify` returns `null` due to a concurrent state change, the service reloads the batch and returns the specific HTTP 404 / 409 (`CONFLICT` or `BATCH_EXPIRED`) error. Two concurrent dispatch requests on the same batch will therefore result in exactly one HTTP 200 and one HTTP 409 `CONFLICT`.

**Audit**: Records `BATCH_DISPATCHED` in `audit_logs` with `batchCode`, `outOfOrder` flag, and `overrideReason` (if any). Never includes `buyerName` or `farmerName` (PII).

### §3.7 — Bulk Import (`docs/00-audit/import-reference.md`)

**Endpoints** (all under `/api/v1/import`, authorized for `super-admin`, `admin`, `manager`, and `factory-manager`; `quality-inspector` and `dispatch-coordinator` receive HTTP `403 RBAC_INSUFFICIENT`; unauthenticated requests receive HTTP `401 AUTH_NO_TOKEN`):
1. `GET /api/v1/import/schema`: Returns the 9 canonical import columns (`productSku`, `productName`, `sourceLotCode`, `farmerName`, `village`, `quantityProduced`, `unit`, `yieldPercent`, `packDate`), `maxChunkRows: 500`, and `dedupeRule: "Source Lot Code + Product SKU + Pack Date"`.
2. `POST /api/v1/import/map-headers`: Accepts `{ headers: string[] }`, normalises each header (`toLowerCase().replace(/[^a-z0-9]/g, '')`), matches against each column's `key`, `label`, and `aliases` in order without reusing a sheet header, and returns `{ mapping: Record<string, string>, unmappedRequired: string[] }` (`productSku` is removed from `unmappedRequired` when `productName` is mapped).
3. `POST /api/v1/import/validate`: Dry-run validation and deduplication over a chunk of rows (`1..500` rows per request) with optional `priorKeys: string[]` carried from earlier preview chunks. Returns `{ summary: { total, insert, skip, error }, preview: [...] }` with zero database writes. Every row with `verdict == "insert"` includes `insertKey` (`SKU|LOT|YYYY-MM-DD`) so the client can pass accumulated keys as `priorKeys` on subsequent chunks; preview items never include `farmerName`.
4. `POST /api/v1/import/commit`: Commits a chunk of rows (`1..500` rows per request) within a maximum job cap of **10,000 rows per job**. Creates or updates an `ImportJob` (`importjobs` collection) and creates valid non-duplicate batches via `BatchService` (`D-23`, `Proposed`).
5. `GET /api/v1/import`: Lists recent `ImportJob` summaries (newest first, up to 25, without `rowErrors` or `insertedBatchIds`), lazily transitioning any stale `"running"` jobs first.
6. `GET /api/v1/import/:id`: Returns full `ImportJob` detail including `rowErrors` (`{ rowNumber, field, message, sourceLotCode }`, capped at `200` stored errors with `rowErrorsTruncated` flag), lazily transitioning the job if it is stale `"running"`.
7. `POST /api/v1/import/:id/rollback`: Soft-deletes batches inserted by the job (`D-24`, `Proposed`), returning `{ archived, alreadyArchived }`.

**Format, Row Caps, Job Join/Ownership, and Stale Running Recovery (`D-5`, §6.2, §7)**:
- **CSV only (`D-5`)**: Browser parses `.csv` files in memory (`stripBom`, `detectDelimiter` over `,` / `;` / `\t`, RFC-4180 quotes and `""` escapes, CRLF/LF/CR line endings, skipping blank lines); `.xls`/`.xlsx` and any non-`.csv` files are rejected client-side, and files exceeding `10,000` rows are rejected client-side. No file ever touches server disk.
- **Chunk & job caps (`422 VALIDATION_ERROR`)**: Because `SPEC.md` §6.2 and `ErrorCode.java` define no oversize/413 code, empty `rows` (`0` rows), `rows.size() > 500` (`MAX_CHUNK_ROWS = 500`), `totalRows > 10,000`, and any multi-chunk commit where `job.processedRows + rows.size() > 10,000` all return HTTP `422 VALIDATION_ERROR` with a `fieldErrors` entry on `"rows"`.
- **Job join & ownership**: A `/commit` request with a `jobId` requires the job to exist and `job.createdBy == actor.username`; otherwise the server returns HTTP `404 NOT_FOUND` (never revealing other users' jobs). After applying the lazy stale check, `job.status` must be `"running"`, otherwise the server returns HTTP `409 CONFLICT`.
- **Stuck `"running"` jobs**: `ImportJob` tracks `updatedAt` (updated on job creation and each chunk commit). A `"running"` job with no update for `tracex.import.stale-running-minutes` (default `15`, overridable in tests, evaluated against the injected `Clock` bean) is lazily marked `"failed"` with `finishedAt` set whenever `list`, `detail`, `commit`, or `rollback` is called (no background scheduler).
- **Final job status rule**: Skipped rows never count as errors. When a job finishes (`isFinal == true`), `status` is set to `"failed"` **only** when `inserted == 0 && errored > 0`; otherwise `status` is `"done"` (including an all-duplicate file where `inserted == 0`, `skipped == N`, and `errored == 0`).

**Validation & Batch Creation Code Path (`D-11`, `D-16`, `D-17`, `D-22`, `D-23` `Proposed`)**:
- **Single creation path (`D-23`, `Proposed`)**: Import commit creates every batch through the same `BatchService` creation code path as `POST /api/v1/batches`, never by writing batch documents directly to MongoDB. Row validation reuses the existing batch field validators with no copied validation rules:
  - `productSku` (or case-insensitive exact `productName` fallback) must resolve to an active catalogue `Product` passing the product contract (`baseShelfLifeDays >= 1`).
  - `sourceLotCode` (uppercased), `farmerName`, and `village`: required non-blank trimmed strings (`sourceLotCode` and `village` max 100 chars; `farmerName` max 200 chars).
  - `quantityProduced`: finite number `>= 1` (commas stripped).
  - `unit`: normalised via `UNIT_ALIASES` to `Kg`, `Units`, or `Liters`.
  - `yieldPercent`: finite number `0..100` inclusive (`%` suffix stripped).
  - `packDate`: parsed as a strict Gregorian calendar `LocalDate` (`YYYY-MM-DD`, `DD/MM/YYYY`, `DD-MM-YYYY`, or `DD.MM.YYYY` with impossible dates like `31/02/2026` rejected by `ResolverStyle.STRICT`, never rolled over) and stored/serialized as a `"YYYY-MM-DD"` date-only string (`D-17`). Because `POST /api/v1/batches` (`BatchCreateDto` / `BatchService.createBatch`) does not reject a future `packDate`, bulk import behaves identically and does not add a future-`packDate` rejection rule.
- **Derived values via `BatchService` (`D-11`, `D-16`, `D-17`, `D-22`, `D-23`)**:
  - `batchCode`: Allocated atomically per batch via `BatchCodeGenerator` (`counters` collection `findAndModify + $inc`) with prefix `TX-YYYY-MM-NNN` (`D-11`, `OI-02`) in business timezone `Asia/Kolkata` (`D-17`).
  - `expiryDate`: Computed as `LocalDate` (`"YYYY-MM-DD"`) from `packDate` plus `predictedShelfLifeDays` (or `baseShelfLifeDays`).
  - `lifecycleState`: Stored as `"ACTIVE"`; freshness `status` (`READY`, `WARNING`, `URGENT`, `EXPIRED`, `EXCEPTION`, `DISPATCHED`) is derived at read time via `BatchFreshness` and **never stored in MongoDB** (`D-16`).
  - `traceToken`: Generated with the opaque HMAC `traceToken` (`D-22`).
  - `noteHistory`: Initialized with `"Bulk imported from <fileName> (import #<jobId>)"`.

**Deduplication & Cross-Chunk Row Verdicts**:
- Dedupe policy is **skip-not-upsert** (`ImportJob.updated` is always `0`).
- Composite dedupe key (`insertKey`): `${product.sku.toUpperCase()}|${sourceLotCode.toUpperCase()}|${packDate}` (`packDate` formatted as `"YYYY-MM-DD"`).
- Active (`isDeleted: false`) batches in MongoDB matching the composite key cause the row to receive `verdict: "skip"` (`"Already imported — lot <lot> / <sku> / <YYYY-MM-DD>"`). Archived/rolled-back (`isDeleted: true`) batches do **not** block re-importing.
- Duplicate rows within the same chunk or matching `priorKeys` sent from earlier `/validate` chunks receive `verdict: "skip"` (`"Duplicate of an earlier row in this file (same lot, product and pack date)"`). `/commit` needs no `priorKeys` because earlier chunks are already saved in MongoDB and caught by the active-batch (`isDeleted: false`) lookup.

**Rollback Semantics (`D-24`, `Proposed`)**:
- `POST /api/v1/import/:id/rollback` soft-deletes **only** the batches inserted by that job (`insertedBatchIds`). Batches in `insertedBatchIds` that are already archived (`isDeleted: true`) are skipped (`alreadyArchived` count), and the remaining active batches are archived via `BatchService.archiveBatch` (the same operation as `DELETE /api/v1/batches/{id}`) with delete reason `"Import rollback <jobId>"`, returning `{ archived, alreadyArchived }` and recording a job-level `IMPORT_ROLLED_BACK` audit entry.
- Rollback **never hard-deletes** batches, **does not undo updates made to existing batches**, and is not claimed to be a multi-document database transaction: it checks all preconditions across the job and all `insertedBatchIds` first, and only then archives active batches.
- Rollback is allowed for jobs with `status == "done"` **or** `status == "failed"` (including a stuck `"running"` job lazily transitioned to `"failed"`) that have a non-empty `insertedBatchIds`. Rollback returns HTTP `409 CONFLICT` (changing nothing) when:
  1. Any batch in `insertedBatchIds` has been dispatched (`lifecycleState == "DISPATCHED"`),
  2. The job `status` is `"running"` (not yet stale) or `"rolled_back"` (already rolled back), or
  3. `insertedBatchIds` is empty.

**Privacy & Audit Rules (`D-9`, §7)**:
- `/validate` preview items never include `farmerName`.
- `ImportJob.rowErrors` stores only `{ rowNumber, field, message, sourceLotCode }`, never raw cell values (`value`).
- Job-level audit entries `IMPORT_FINISHED` and `IMPORT_ROLLED_BACK` record `jobId`, counts, and actor with zero PII. Per-batch creation and archive audit entries follow `BatchService` (`BATCH_CREATED`, `BATCH_ARCHIVED`).
- `farmerName` never appears in application logs, `audit_logs`, or any import endpoint response.
- Formula-injection prefixes (`=`, `+`, `-`, `@`, `\t`, `\r`) are neutralized by prefixing a single quote (`'`) when exporting CSV error reports.

#### Deviations from Reference Implementation (Bulk Import)

| Reference behaviour | New build behaviour | Reason |
|---|---|---|
| `preallocateBatchCodes` (`import.controller.js` lines 273–289) uses non-atomic `Batch.findOne` + in-memory increment with prefix `HS-YYYY-MM-NNN` | Each imported batch allocates `TX-YYYY-MM-NNN` atomically from the `counters` collection via `BatchCodeGenerator` (`BatchService`) | Resolved `D-11` (`TX-` prefix), `OI-02` (atomic counter), and `D-23` (`Proposed` single batch creation path) |
| `commitImport` (`import.controller.js` lines 506–562) writes directly via `Batch.insertMany` and duplicates validation/expiry/QR logic | `commitImport` delegates batch creation and validation to `BatchService` (`POST /api/v1/batches` code path) | `D-23` (`Proposed`): single source of truth for batch creation, validation, `traceToken`, and `BatchFreshness` |
| `parseDate` (`import.controller.js` lines 132–154) stores UTC `Date` timestamps and silently rolls over invalid calendar dates (e.g. `31/02/2026` -> `2026-03-03`) | `packDate` and `expiryDate` are strict `LocalDate` values stored and serialized as `"YYYY-MM-DD"` strings in `Asia/Kolkata`; invalid calendar dates are rejected | Resolved `D-17` (date-only `LocalDate` strings in `Asia/Kolkata`) and Phase 5.0 strict calendar validation |
| `commitImport` (`import.controller.js` lines 534–535) stores `status` (`READY`/`WARNING`/`URGENT`/`EXPIRED`) in MongoDB | Only `lifecycleState` (`"ACTIVE"`) is stored; freshness `status` is derived at read time via `BatchFreshness` and never persisted | Resolved `D-16` (runtime freshness derivation) |
| `generateBatchQR(batchCode)` (`import.controller.js` line 517) generates QR codes keyed by `batchCode` or non-HMAC token | Generates opaque HMAC-SHA256 `traceToken` (`<nonce>.<tag>`) and `${PUBLIC_TRACE_BASE_URL}/trace/t/${traceToken}` | Resolved `D-22` (opaque HMAC trace token) |
| `findExistingKeys` (`import.controller.js` lines 254–264) queries `Batch.find({ sourceLotCode: { $in: lots } })` without `isDeleted: false`, so rolled-back/archived batches block re-import | Dedupe lookup queries only active, non-deleted batches (`isDeleted: false`), and `/validate` supports `insertKey` / `priorKeys` across chunks | Defect fix: rolling back an import or archiving a batch must allow re-importing, and cross-chunk preview duplicates are caught |
| `rollbackImport` (`import.controller.js` lines 662–672) silently soft-deletes already-dispatched batches and writes no `audit_logs` entry | Rollback checks all preconditions first, returns HTTP `409 CONFLICT` (changing nothing) if any inserted batch is `DISPATCHED`, if `status` is `running` or `rolled_back`, or if `insertedBatchIds` is empty; allows rollback of `done` or `failed` jobs, skips already-archived batches, archives active ones via `BatchService` (`"Import rollback <jobId>"`), returns `{ archived, alreadyArchived }`, and records `IMPORT_ROLLED_BACK` | `D-24` (`Proposed`): prevents corrupting dispatched inventory records, recovers partial failed jobs, and preserves audit trail |
| `import.controller.js` lines 429, 479 return HTTP `400` (empty rows) or `413` (`> 500` rows) with `{ success: false, message }`, enforce no total job row cap, and leave interrupted jobs stuck in `running` | Returns `422 VALIDATION_ERROR` with `fieldErrors.rows` on `0` rows, `> 500` rows/chunk, or `> 10,000` rows/job; enforces `job.createdBy == actor.username` (`404`) and `job.status == "running"` (`409`); lazily marks stale `running` jobs `failed` after `tracex.import.stale-running-minutes` (`15`) | SPEC §6.1, §6.2, and §7 upload & security rules |
| `commitImport` (`import.controller.js` lines 602–606, 679) emits Socket.IO `io.emit('batch:created', ...)` | Emits SSE events (`batch:created`, `import:finished`) via `/api/v1/notifications/stream` (Phase 10) | Resolved `D-4` (SSE instead of Socket.IO) |
| `validateImport` (`import.controller.js` line 453) includes `farmerName` in preview and `rowErrors` stores raw PII values (`value`) | `/validate` preview omits `farmerName`; `rowErrors` stores only `{ rowNumber, field, message, sourceLotCode }` (no raw cell values); `farmerName` is never logged or written to `audit_logs` | Resolved `D-9` & SPEC §7 privacy rules |

---

## §4 — Data Model

### Collections

#### `users`
Fields (confirmed from `User.model.js`):
`username` (unique, lowercase), `passwordHash`, `name`, `email`, `phone`, `preferences.{mode, palette, accent}`, `googleEmail` (partial unique index where string type), `googleLinkedAt`, `role` (enum: 5 values), `isActive`, `isSuperAdmin`, `isDeleted`, `deletedBy`, `deletedAt`, `deleteNote`, `promotedBy`, `promotedAt`, `previousRole`, `emailVerified`, `otpCode` (hashed 6-digit), `otpExpiry`, `otpAttempts` (lock after 5), `resetToken`, `resetTokenExpiry`, `tokenVersion` (default 0), `createdAt`, `updatedAt`.

Indexes: `username` (unique), `googleEmail` (partial unique: `$type: 'string'`), `isDeleted`.

#### `batches`
Fields (confirmed from `Batch.model.js`):
`productId`, `productName`, `sku`, `sourceLotCode`, `farmerName`, `village`, `quantityProduced`, `unit` (Kg/Units/Liters), `yieldPercent` (0–100), `batchCode` (unique), `packDate` (`LocalDate`, stored in MongoDB and serialized in JSON as `"YYYY-MM-DD"` string via `BatchLocalDateValueConverter` per D-17), `expiryDate` (`LocalDate`, stored in MongoDB and serialized in JSON as `"YYYY-MM-DD"` string via `BatchLocalDateValueConverter` per D-17), `dataSource` (predicted/fallback), `shelfLifeSource` (predicted/base/manual), `lifecycleState` (`ACTIVE`/`DISPATCHED`; runtime `status` is derived per D-16 as one of `EXPIRED`, `URGENT`, `WARNING`, `READY`, `EXCEPTION`, `DISPATCHED`), `priorityScore` (display only), `qrCodeDataUrl`, `qrAbsoluteUrl`, `traceToken` (unique sparse index), `qualityCheck.{status, rating, inspectedAt, inspectorName}`, `dispatchDate` (`LocalDate`, stored in MongoDB and serialized in JSON as `"YYYY-MM-DD"` string via `BatchLocalDateValueConverter` per D-17), `buyerName`, `dispatchHistory[]`, `traceabilityNote`, `createdBy`, `noteHistory[]`, `isDeleted`, `deletedAt`, `deletedBy`, `deleteNote`, `createdAt`, `updatedAt`.

Indexes: `batchCode` (unique), `sku`, `isDeleted+lifecycleState+expiryDate`, `traceToken` (unique, sparse).

#### `inspections`
Fields (confirmed from `Inspection.model.js` lines 17–79):
`batchId`, `batchCode`, `productName`, `sku`, `status` (PASSED/FAILED/FLAGGED), `rating` (1–5), `checklist[]` (8 items: `label`, `passed` Boolean|null, `note` max 200), `findings` (max 1000), `recommendation` (max 400), `inspectedBy.{userId, name, username}`, `isLatest`, `createdAt`.

**No TTL** (D-15 — permanent records).
**Indexes**:
- **Partial unique index**: `{ batchId: 1 }` with `unique: true` and `partialFilterExpression: { isLatest: true }` (`batchId_isLatest_unique_idx`), guaranteeing at the database level that at most one inspection per batch can have `isLatest: true`.
- Supporting indexes: `batchCode`, `batchId + createdAt desc`, `inspectedBy.userId + createdAt desc`, `status + isLatest + createdAt desc`.

**Concurrency & Non-Transactional Operation Ordering (Standalone MongoDB)**:
Standalone MongoDB does not support multi-document ACID transactions. To guarantee that concurrent inspection submissions on the same batch never violate the partial unique index, never lose an inspection document, and converge `Batch.qualityCheck` to the latest inspection:
1. Submissions on the same `batchId` acquire a per-batch in-process lock (with retry on `DuplicateKeyException`).
2. Step 1: `updateMany({ batchId, isLatest: true }, { $set: { isLatest: false } })` clears `isLatest` on any prior inspection for that batch.
3. Step 2: Insert the new `Inspection` document with `isLatest: true`.
4. Step 3: Update `Batch.qualityCheck` (`{ status, rating, inspectedAt, inspectorName }`) to match the current `isLatest: true` inspection for that batch.
Because the immutable `Inspection` document is persisted before the denormalized `Batch.qualityCheck` update, a mid-flight process crash between Step 2 and Step 3 can at worst leave a temporarily stale `qualityCheck` snapshot on `Batch` (until the next inspection), and **never** loses an `Inspection` audit record.

#### `accessrequests`
Fields (confirmed from `AccessRequest.model.js`):
`name`, `email` (unique), `role`, `status` (pending/approved/rejected), `note`, `inviteToken` (SHA-256 hash), `inviteExpiry`, `inviteUsed` (default false), `approvedBy`, `createdAt`, `updatedAt`.

#### `importjobs`
Fields (confirmed from `ImportJob.model.js`):
`fileName`, `entity` (enum: 'batch'), `status` (running/done/failed/rolled_back), `totalRows`, `processedRows`, `inserted`, `updated`, `skipped`, `errored`, `insertedBatchIds[]`, `rowErrors[]` (capped at 200), `rowErrorsTruncated`, `createdBy`, `createdByRole`, `finishedAt`, `rolledBackAt`, `rolledBackBy`, `createdAt`, `updatedAt`.

Indexes: `status`, `createdAt desc`, `insertedBatchIds`.

Rollback behavior: soft-deletes inserted batches (never hard-deletes). Source: `ImportJob.model.js` comment lines 10–13.

**Import constraint** (confirmed from `import.controller.js` line 40): max 500 rows per chunk request.

#### `loginevents`
Fields (confirmed from `LoginEvent.model.js`):
`userId`, `username`, `city`, `country`, `countryCode`, `browser`, `os`, `device`, `method` (password/google), `createdAt`.

TTL: 30 days (MongoDB TTL index on `createdAt`, expires after 2,592,000 seconds). Source: `LoginEvent.model.js` line 17.

Indexes: `createdAt` (TTL), `userId+createdAt desc`.

#### `messages`
Fields (confirmed from `Message.model.js`):
`scope` (record/channel), `refType` (batch/inspection/null), `refId` (ObjectId/null), `channelRole` (one of 5 role strings/null), `body` (max 2000), `authorId`, `authorName`, `authorRole`, `editHistory[]`, `editedAt`, `isDeleted`, `deletedAt`, `deletedBy`, `expiresAt` (null = permanent), `createdAt`, `updatedAt`.

Retention:
- `scope: 'record'` (batch/inspection comments): permanent (`expiresAt: null`). Source: `Message.model.js` line 113.
- `scope: 'channel'` (role chat): 90-day TTL via `expiresAt`. Source: `Message.model.js` line 29, 114.

TTL index: `{ expiresAt: 1 }, { expireAfterSeconds: 0 }` — documents with `expiresAt: null` are never expired. Source: `Message.model.js` line 106.

#### `notifications`
Fields (confirmed from `Notification.model.js`):
`recipientRole` (one of 5 roles or 'super-admin'), `recipientUserId` (null = broadcast to all with role), `type` (batch_created/batch_imported/batch_dispatched/inspection_completed/admin_action/system), `title` (max 120), `message` (max 400), `refId`, `refType`, `triggeredBy.{userId, name, role}`, `read` (default false), `createdAt`.

TTL: 7 days. Source: `Notification.model.js` line 60.

Indexes: `recipientRole`, `recipientUserId`, `recipientRole+read+createdAt desc`.

#### `scanevents`
Fields (confirmed from `ScanEvent.model.js` and D-22):
`id`, `batchId`, `batchCode`, `scannedAt` (`Instant` UTC from injected `Clock`), `source` (factory/buyer/QA; default buyer), `deviceType` (Mobile/Tablet/Desktop/Unknown parsed from User-Agent), `ipHash` (HMAC-SHA256 keyed with `TRACE_TOKEN_SECRET` over `request.getRemoteAddr()`, lowercase hex-encoded; raw IP and raw User-Agent are NEVER stored or logged).

Indexes: `batchId`, `batchId + scannedAt desc`.

#### `counters` (new in rebuild)
`{ _id: "batch_TX-YYYY-MM", seq: N }` — atomic batch-code counter using `findOneAndUpdate + $inc + upsert`. Replaces the non-atomic `findOne + +1` pattern in the reference.

#### `audit_logs` (new in rebuild)
Append-only log for security-sensitive events: role changes, user deletions, super-admin actions, out-of-order dispatch overrides, failed login attempts above threshold. Fields: `action`, `actorId`, `actorUsername`, `targetId`, `targetType`, `before`, `after`, `reason`, `requestId`, `createdAt`.

#### `dispatches` (new in rebuild — stored as `dispatchHistory[]` on `batches`)
Dispatch events and out-of-order dispatch overrides are stored as a subdocument array `dispatchHistory[]` on the `Batch` document (mirroring `noteHistory[]`), rather than a separate collection. Fields per entry: `dispatchedBy`, `dispatchedAt` (`Instant`), `buyerName`, `dispatchDate` (`LocalDate`, `"YYYY-MM-DD"` string via `BatchLocalDateValueConverter` per D-17), `overrideReason`, `outOfOrder`.

#### `products` (shared read-only collection)
Fields include `productName`, `sku`, `baseShelfLifeDays`, `predictedShelfLifeDays`, `predictedExpiryTemplate`, `riskLevel`. (Inferred from `batches.controller.js` and `productContract.js`.)

### Soft-Delete Convention
All user-facing collections use `isDeleted: Boolean (default false)` + `deletedAt: Date` + `deletedBy: String` + `deleteNote: String`.

### Seed Strategy
Seed scripts for dev, test, and demo data live in `backend/src/main/resources/seed/` (Spring) or a `seed/` CLI directory. Separate seed profiles for `tracex_fresh_dev` and `tracex_fresh_test`.

---

## §5 — UI

### §5.1 — Design Tokens

```
border-radius:      ≤ 6px on all interactive controls and badges (--radius-xs: 2px, --radius-sm: 4px, --radius-md: 6px)
gradients:          none
shadows:            single subtle elevation only (--shadow-sm: 0 1px 2px 0 rgba(15, 23, 42, 0.08))
type scale:         xs (0.75rem) / sm (0.875rem) / base (1rem) / lg (1.125rem) / xl (1.25rem) / 2xl (1.5rem)
spacing scale:      4px base unit (4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
motion durations:   ≤ 150ms (--duration-fast: 100ms, --duration-normal: 150ms; 0s under prefers-reduced-motion: reduce)
status colors:      ALWAYS paired with a text label AND an icon — never color alone
dark/light modes:   html[data-theme="light"|"dark"] (system default via prefers-color-scheme + manual toggle)
color palettes:     3 palettes via html[data-palette="editorial"|"obsidian"|"emerald"]
accent color:       configurable per user (auto = follow palette, or cobalt / emerald / amber / rose)
```

**Palette Token Values (`frontend/src/styles/tokens.css`)**:

| Palette | Mode | `--bg-canvas` | `--bg-surface` | `--bg-elevated` | `--text-primary` | `--text-secondary` | `--text-muted` | `--border-subtle` | `--border-strong` |
|---|---|---|---|---|---|---|---|---|---|
| `editorial` (Warm Paper) | `light` | `#f8f7f4` | `#ffffff` | `#f1efe9` | `#141413` | `#4a4843` | `#5c5953` | `#dcd8ce` | `#736e64` |
| `editorial` (Warm Paper) | `dark` | `#121210` | `#1b1b18` | `#252521` | `#f5f3ee` | `#c9c5bc` | `#a6a196` | `#33322d` | `#8c877b` |
| `obsidian` (Cool Slate) | `light` | `#f4f6f9` | `#ffffff` | `#eaeff5` | `#0f172a` | `#334155` | `#475569` | `#cbd5e1` | `#64748b` |
| `obsidian` (Cool Slate) | `dark` | `#0b0f19` | `#111827` | `#1e293b` | `#f8fafc` | `#cbd5e1` | `#94a3b8` | `#263248` | `#7c8ea6` |
| `emerald` (Botanical) | `light` | `#f3f7f5` | `#ffffff` | `#e7f0ec` | `#0c1f17` | `#28473a` | `#3d5c4f` | `#c5d9d0` | `#5c7d6f` |
| `emerald` (Botanical) | `dark` | `#091410` | `#102019` | `#182e25` | `#eef7f3` | `#bfd6cc` | `#94b5a7` | `#213b30` | `#6f9686` |

**Accent Token Values (`auto` maps `editorial -> cobalt`, `obsidian -> amber`, `emerald -> emerald`)**:

| Accent | Mode | `--accent-primary` | `--accent-primary-hover` | `--accent-on-primary` | `--accent-subtle-bg` | `--accent-subtle-text` | `--focus-ring` |
|---|---|---|---|---|---|---|---|
| `cobalt` | `light` | `#1d4ed8` | `#1e40af` | `#ffffff` | `#dbeafe` | `#1e3a8a` | `#1d4ed8` |
| `cobalt` | `dark` | `#60a5fa` | `#93c5fd` | `#0b1329` | `#1e3a8a` | `#dbeafe` | `#60a5fa` |
| `emerald` | `light` | `#047857` | `#065f46` | `#ffffff` | `#d1fae5` | `#064e3b` | `#047857` |
| `emerald` | `dark` | `#34d399` | `#6ee7b7` | `#052016` | `#064e3b` | `#d1fae5` | `#34d399` |
| `amber` | `light` | `#b45309` | `#92400e` | `#ffffff` | `#fef3c7` | `#78350f` | `#b45309` |
| `amber` | `dark` | `#fbbf24` | `#fcd34d` | `#211202` | `#78350f` | `#fef3c7` | `#fbbf24` |
| `rose` | `light` | `#be123c` | `#9f1239` | `#ffffff` | `#ffe4e6` | `#881337` | `#be123c` |
| `rose` | `dark` | `#fb7185` | `#fda4af` | `#29060d` | `#881337` | `#ffe4e6` | `#fb7185` |

### §5.2 — Banned Patterns & Decorative Photo Backdrops (`D-20`)

The following patterns are banned in all new build code:

1. **`window.alert`, `window.confirm`, `window.prompt`** — use modal components.
2. **Inline styles for layout** (`style={{}}` for positioning/sizing) — use CSS modules or Tailwind utility classes.
3. **Color as the sole status indicator** — always pair status color with a text label and an icon.
4. **Hardcoded user-facing strings** — use constants or i18n keys.
5. **`useEffect` for data fetching** — use TanStack Query hooks.
6. **Direct `fetch()` in components** — use the shared typed API client.
7. **`console.log` in production code** — use a structured logger utility.
8. **Gradient backgrounds or decorative shadows** — design token constraint (`linear-gradient`, `radial-gradient`, `conic-gradient` are banned).
9. **Uncontrolled inputs** — all form inputs must be controlled and validated.
10. **Optimistic UI without rollback** — every optimistic update must have an `onError` rollback.
11. **`any` TypeScript type** — use specific types; `unknown` is acceptable as a temporary placeholder.
12. **Secrets or environment variables embedded in frontend bundle** — only `VITE_` prefixed vars are allowed, and none must contain secrets.
13. **Hotlinked external image URLs (`http://` or `https://` image URLs in `src/` or `design-assets/backdrops.json`), AI-generated imagery, fake UI screenshots, fake testimonials or customer logos, imagery that carries data or meaning, photos with identifiable people unless the licence clearly permits it, glass or blur panels (`backdrop-filter`, `filter: blur(...)`), and any parallax or scroll-linked motion.**

#### Per-Page Decorative Photo Backdrops (`D-20` — Resolved, requested by the owner)
- **Allowed**: Real photographs supplied or approved by the owner, with `source`, `author`, `licence`, `licenceUrl`, and `approvedByOwner: true` recorded in `design-assets/backdrops.json`, used strictly as decorative backdrops (`alt=""`, `aria-hidden="true"`) behind a flat colour overlay token (`--backdrop-scrim`). Until the owner's licensed photos arrive, `scripts/prepare-backdrops.mjs` generates flat neutral placeholders from design token colours (`placeholder: true` in `design-assets/backdrops.json`, tracked under `OI-11`).
- **Asset pipeline & budgets**: Originals live in `design-assets/originals/<key>.jpg` across 14 keys (`auth`, `auth-recovery`, `dashboard`, `batches`, `fefo`, `inspections`, `dispatch`, `qr`, `trace-public`, `team`, `import`, `notifications`, `settings`, `default`). `scripts/prepare-backdrops.mjs` (`sharp`) generates widths `640`, `1280`, and `1920` in AVIF, WebP, and JPEG into `src/assets/backdrops/` with hashed asset filenames via Vite (`npm run prepare:backdrops`, wired into `predev` and `prebuild`). Enforced size budgets: banner images at most `60 KB` at `640` wide and `120 KB` at `1280` wide; auth and public trace images at most `250 KB` at `1920` wide.
- **Variants & solid surface rule**: `src/routes/backdrops.ts` is the sole route-to-key map. `PageBackdrop` supports three variants:
  - `banner`: sits behind `PageHeader` at `176px` high on desktop (`>=1024px`), `144px` on tablet (`640px–1023px`), and `112px` on mobile (`<640px`), with title and subtitle over a flat colour scrim (`--backdrop-scrim`) verified at `>= 4.5:1` (text) and `>= 3.0:1` (focus ring and controls) against a worst-case pure white (`#ffffff`) image pixel under the scrim.
  - `side`: two-column layout on auth pages at `>=1024px` (`55%` photo column on the left, solid form panel on the right), `160px` band above the form below `1024px`, and `96px` band below `640px`.
  - `full`: full-bleed photo behind a solid content panel on the public trace page.
- **Flat fallback, user preference & `Save-Data`**: Content (forms, tables, cards) always sits on solid surface tokens (`--bg-surface` / `--bg-elevated`), never directly on the photo. If an image errors or is blocked, or when the user preference `showPageImages` (default `true` in `src/lib/prefs.ts`) is turned off, or when the browser sends `Save-Data: on`, `PageBackdrop` renders a flat surface token (`--backdrop-fallback-bg`) with identical reserved dimensions (zero layout shift) and requests no image when disabled. Backdrops are hidden in `@media print`.

### §5.3 — Required States

Every interactive element must handle:
- **Loading**: spinner or skeleton; `aria-busy="true"`
- **Error**: error message visible inline, not behind empty state
- **Empty**: explicit empty state (not a blank space)
- **Disabled**: visually distinct; `aria-disabled="true"`
- **Success**: toast confirmation or inline feedback

### §5.4 — Accessibility Baseline

- All interactive elements keyboard-navigable (Tab, Enter, Space, Escape, Arrow keys for menus)
- Skip-to-content link at page top (confirmed in reference: `App.jsx` line 52)
- ARIA labels on all icon-only buttons
- Color contrast ≥ 4.5:1 for normal text (WCAG 2.1 AA)
- Focus ring visible at all times (no `outline: none` without a visible replacement)
- Form errors linked to inputs via `aria-describedby`

---

## §6 — API Contract

### §6.1 — Response and Error Envelope

All responses use `/api/v1/` prefix.

**Success**:
```json
{
  "success": true,
  "requestId": "uuid-v4",
  "data": <payload>,
  "message": "<optional string>"
}
```

**Paginated list**:
```json
{
  "success": true,
  "requestId": "uuid-v4",
  "total": 0,
  "page": 1,
  "limit": 50,
  "count": 0,
  "data": []
}
```

**Error**:
```json
{
  "success": false,
  "requestId": "uuid-v4",
  "code": "<ERROR_CODE>",
  "error": "<human-readable message>",
  "fieldErrors": [
    { "field": "fieldName", "message": "what is wrong" }
  ]
}
```

`fieldErrors` is present only on 422 VALIDATION_ERROR responses. `requestId` is a per-request UUID4 logged server-side.

**OpenAPI spec location**: `backend/src/main/resources/openapi/tracex-api.yaml` (generated via springdoc-openapi; served at `/api/v1/docs`).

### §6.2 — Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| `AUTH_NO_TOKEN` | 401 | No Authorization header |
| `AUTH_INVALID_TOKEN` | 401 | Token signature invalid or expired |
| `AUTH_SESSION_REVOKED` | 401 | tokenVersion mismatch |
| `AUTH_ACCOUNT_DELETED` | 401 | Account soft-deleted |
| `AUTH_ACCOUNT_INACTIVE` | 403 | Account deactivated |
| `RBAC_INSUFFICIENT` | 403 | Role too low for this action |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Duplicate or state conflict |
| `DISPATCH_OUT_OF_ORDER` | 409 | Batch is not next in FEFO queue; override required |
| `DISPATCH_EXPIRED` | 409 | Expired batch cannot be dispatched |
| `BATCH_EXPIRED` | 409 | Batch is expired (`daysUntilExpiry <= 0`) and cannot be dispatched |
| `QUALITY_HOLD` | 409 | Batch latest inspection verdict is `FAILED`; dispatch blocked (D-19) |
| `VALIDATION_ERROR` | 422 | Request body failed validation |
| `METHOD_NOT_ALLOWED` | 405 | HTTP method not supported for this endpoint |
| `RATE_LIMITED` | 429 | Too many requests |
| `AI_UNAVAILABLE` | 503 | Both AI providers unavailable |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `LAST_SUPERADMIN` | 409 | Action would leave no active super-admin |
| `SELF_MODIFICATION_NOT_ALLOWED` | 409 | Cannot modify or delete your own account |

### §6.3 — Endpoint Table

> All paths are under `/api/v1/`. Only endpoints listed here as **public** require no Authorization header. Everything else requires `Authorization: Bearer <token>`.

**Public endpoints** (no auth): login, request-access, password flows, health check, and trace-by-opaque-token only.

#### Authentication & Self-Service

| Method | Path | Auth | Min Role | Notes |
|--------|------|------|----------|-------|
| POST | /api/v1/auth/login | **public** | — | Returns `{token, user}` |
| POST | /api/v1/auth/request-access | **public** | — | Generic 200 even if email exists (anti-enumeration) |
| POST | /api/v1/auth/activate | **public** | — | Invite token + password |
| POST | /api/v1/auth/verify-otp | **public** | — | |
| POST | /api/v1/auth/verify-otp/resend | **public** | — | |
| POST | /api/v1/auth/forgot-password | **public** | — | **Always returns generic 200** regardless of whether email exists (anti-enumeration) |
| POST | /api/v1/auth/verify-reset-otp | **public** | — | |
| POST | /api/v1/auth/reset-password | **public** | — | |
| GET | /actuator/health | **public** | — | Spring Boot Actuator health check returning `{ "status": "UP" }` |
| GET | /api/v1/auth/me | Bearer | any | Own profile |
| PATCH | /api/v1/auth/me | Bearer | any | Update profile |
| PATCH | /api/v1/auth/me/settings | Bearer | any | Theme/palette preferences |
| POST | /api/v1/auth/me/change-password | Bearer | any | Revokes all sessions |
| POST | /api/v1/auth/me/logout-all | Bearer | any | Revokes all sessions |
| GET | /api/v1/auth/me/login-history | Bearer | any | |
| POST | /api/v1/auth/me/google-link | Bearer | any | Phase 11 (Should-have, conditional on `GOOGLE_CLIENT_ID` per D-3) |
| DELETE | /api/v1/auth/me/google-link | Bearer | any | Phase 11 (Should-have, conditional on `GOOGLE_CLIENT_ID` per D-3) |

#### Admin Panel — Access Requests

| Method | Path | Auth | Min Role |
|--------|------|------|----------|
| GET | /api/v1/auth/requests | Bearer | manager |
| POST | /api/v1/auth/requests/:id/approve | Bearer | admin |
| POST | /api/v1/auth/requests/:id/reject | Bearer | admin |
| POST | /api/v1/auth/requests/:id/resend | Bearer | admin |
| DELETE | /api/v1/auth/requests/:id | Bearer | admin |

#### Admin Panel — Users

| Method | Path | Auth | Min Role |
|--------|------|------|----------|
| GET | /api/v1/auth/directory | Bearer | manager |
| GET | /api/v1/auth/users | Bearer | manager |
| GET | /api/v1/auth/users/deleted | Bearer | super-admin |
| PATCH | /api/v1/auth/users/:id/toggle | Bearer | admin |
| PATCH | /api/v1/auth/users/:id/role | Bearer | admin |
| DELETE | /api/v1/auth/users/:id | Bearer | admin |
| PATCH | /api/v1/auth/users/:id/restore | Bearer | super-admin |

#### Batches

| Method | Path | Auth | Min Role | Notes |
|--------|------|------|----------|-------|
| GET | /api/v1/batches | Bearer | any | Requires auth (D-6 fix); `status` filter supports `EXPIRED`, `URGENT`, `WARNING`, `READY`, `EXCEPTION`, `DISPATCHED` |
| POST | /api/v1/batches | Bearer | factory-manager | `packDate` and `expiryDate` accepted and returned as `"YYYY-MM-DD"` date-only strings |
| GET | /api/v1/batches/archived | Bearer | admin | |
| GET | /api/v1/batches/:id | Bearer | any | Requires auth; returns `packDate` and `expiryDate` as `"YYYY-MM-DD"` (`daysUntilExpiry: null` and `exceptionReason` populated when `status == "EXCEPTION"`) |
| PATCH | /api/v1/batches/:id/dispatch | Bearer | dispatch-coordinator | D-10, D-18, D-19; includes optional overrideReason |
| PATCH | /api/v1/batches/:id/note | Bearer | factory-manager | |
| PATCH | /api/v1/batches/:id/raw-material | Bearer | factory-manager | `packDate` and `expiryDate` accepted as `"YYYY-MM-DD"` date-only strings |
| DELETE | /api/v1/batches/:id | Bearer | admin | Soft-delete |
| PATCH | /api/v1/batches/:id/restore | Bearer | admin | |
| GET | /api/v1/batches/:id/qr | Bearer | any | Requires auth |
| GET | /api/v1/batches/:id/scans | Bearer | any | Requires auth |

**Batch DTO date and status contract (`BatchSummaryDto` / `BatchDetailDto`)**:
- `packDate`, `expiryDate`, `dispatchDate`, and `dispatchHistory[].dispatchDate` are serialized as `"YYYY-MM-DD"` strings (`type: "string", format: "date"` in OpenAPI) with zero time-zone shift across server/JVM time zones (D-17, A0-2).
- `status` is an enum of `["EXPIRED", "URGENT", "WARNING", "READY", "EXCEPTION", "DISPATCHED"]`.
- When a non-dispatched batch has a missing, `null`, or unparseable `expiryDate`, `status` is `"EXCEPTION"`, `expiryDate` is `null`, `daysUntilExpiry` is `null`, and `exceptionReason` is populated. For all other statuses, `exceptionReason` is `null` and `daysUntilExpiry` is an integer (`Long`).

#### Dispatch / FEFO

| Method | Path | Auth | Min Role | Notes |
|--------|------|------|----------|-------|
| GET | /api/v1/dispatch/fefo | Bearer | any | Requires auth; supports optional `category` and `sku` query filters; returns `{ queue, expired, exceptions }` where `queue` items carry 1-based `rank` |

#### Public Trace (the only truly public data endpoint)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | /api/v1/qr/trace/t/:token | **public** | Returns whitelisted DTO only (see below) |

**Trace-by-batchCode is removed** (correction #3). The public trace endpoint resolves only the opaque HMAC token.

**Public trace DTO** (whitelisted fields — no PII, no internal IDs):
```json
{
  "batchCode": "TX-2026-10-001",
  "productName": "Organic Turmeric Powder",
  "sku": "TRM-001",
  "village": "Lansdowne",
  "packDate": "2026-09-15",
  "expiryDate": "2026-12-15",
  "status": "READY",
  "qualityCheck": {
    "status": "PASSED",
    "rating": 4,
    "inspectedAt": "2026-09-16T10:00:00Z"
  },
  "traceabilityNote": "Best before 2026-12-15"
}
```

Fields explicitly omitted: `farmerName`, `qrCodeDataUrl`, `priorityScore`, `traceToken`, `createdBy`, `noteHistory`, `dispatchHistory`, `productId`, `_id`.

#### QR Scan Recording

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | /api/v1/qr/scan | **public** | Records scan event; IP hashed before storage |

#### Inspections

| Method | Path | Auth | Min Role |
|--------|------|------|----------|
| GET | /api/v1/inspections | Bearer | quality-inspector |
| POST | /api/v1/inspections | Bearer | quality-inspector |
| GET | /api/v1/inspections/my | Bearer | quality-inspector |
| GET | /api/v1/inspections/batch/:batchId | Bearer | quality-inspector |
| GET | /api/v1/inspections/:id | Bearer | quality-inspector |

#### Bulk Import

> Authorized roles (matching `requireImporter` in `requireAdmin.js` lines 109–116 and `docs/permission-matrix.csv` phase 8): `factory-manager`, `manager`, `admin`, and `super-admin` (`quality-inspector` and `dispatch-coordinator` are denied with `403 RBAC_INSUFFICIENT`).

| Method | Path | Auth | Min Role |
|--------|------|------|----------|
| GET | /api/v1/import/schema | Bearer | factory-manager |
| POST | /api/v1/import/map-headers | Bearer | factory-manager |
| POST | /api/v1/import/validate | Bearer | factory-manager |
| POST | /api/v1/import/commit | Bearer | factory-manager |
| GET | /api/v1/import | Bearer | factory-manager |
| GET | /api/v1/import/:id | Bearer | factory-manager |
| POST | /api/v1/import/:id/rollback | Bearer | factory-manager |

#### Notifications

| Method | Path | Auth | Min Role | Notes |
|--------|------|------|----------|-------|
| GET | /api/v1/notifications | Bearer | any | |
| GET | /api/v1/notifications/stream | Bearer | any | SSE endpoint (D-4) |
| PATCH | /api/v1/notifications/:id/read | Bearer | any | |
| PATCH | /api/v1/notifications/read-all | Bearer | any | |

#### AI Audit

| Method | Path | Auth | Min Role | Notes |
|--------|------|------|----------|-------|
| POST | /api/v1/ai/dispatch-audit | Bearer | any | Rate-limited |

#### Products

| Method | Path | Auth | Min Role |
|--------|------|------|----------|
| GET | /api/v1/products | Bearer | any |

#### Dashboard Summary (`D-21` — Resolved)

| Method | Path | Auth | Min Role | Notes |
|--------|------|------|----------|-------|
| GET | /api/v1/dashboard/summary | Bearer | any | Server-computed counts (`EXPIRED`, `URGENT`, `WARNING`, `READY`, `EXCEPTION`) built with the exact `BatchFreshness.applyStatusFilter` filter builders, `dispatched` total, top 5 expiring batches from `FefoService`, latest-inspection verdict counts (`PASSED`, `FAILED`, `FLAGGED`, `none`), `pendingAccessRequests` (`manager`, `admin`, and `super-admin` only; `null` for others), and `businessDate` (`"YYYY-MM-DD"`) |

---

## §7 — Security

### Token Storage (D-1)
Authorization header (`Bearer <token>`). The client stores the token in `sessionStorage` under the key `tx_token`. Memory-only storage was rejected because it would log the user out on every page reload (no refresh tokens per D-2). `localStorage` is prohibited due to persistent cross-tab XSS vulnerability. Server reads `Authorization: Bearer <token>` on every authenticated request. Source confirmed: `auth.js` line 40–41.

#### Risk Register: XSS & Token Storage Mitigation
Storing tokens in `sessionStorage` limits persistence to the active browser tab, but the token remains accessible to scripts within the same execution context if an XSS vulnerability occurs. The platform applies three mandatory mitigations:
1. **Strict Content Security Policy (CSP)**: Disallow untrusted inline scripts and external script sources (`script-src 'self'`).
2. **Short Token Expiry**: Token lifespan is capped at 8 hours (single JWT per D-2).
3. **Per-Request `tokenVersion` Check**: On every authenticated request, the server re-validates `tokenVersion` against MongoDB. Any logout-all, password reset, or account deactivation takes effect instantly across all tabs and sessions.

### Session Invalidation
Per-request DB check: `isDeleted`, `isActive`, and `tokenVersion`. A deactivated, deleted, or demoted user is denied on their very next request. Source: `auth.js` lines 52–91.

`revokeSessions()` bumps `tokenVersion` by 1, invalidating all tokens for that user. Called on: password change, password reset, deactivation, deletion, "logout all". Source: `auth.js` lines 110–117.

### Password & Credential Policies
- **Password Policy**: Minimum 8 characters required on registration, activation, reset, and password change (source: `auth.controller.js` line 294).
- **OTP Policy**: 6-digit SecureRandom string, SHA-256 hashed in database, 10-minute validity window. Maximum 5 consecutive failed attempts before account lockout (source: `auth.controller.js` lines 328–342, 398, 843–850).
- **Password Reset Flow**: `POST /auth/forgot-password` dispatches a 6-digit OTP (anti-enumeration defense: returns identical success message whether email exists or not). `POST /auth/verify-reset-otp` exchanges OTP for a one-time 32-byte raw `resetToken` (SHA-256 hashed in DB, 5-minute validity window). `POST /auth/reset-password` consumes token, applies new password, and immediately increments `tokenVersion` to revoke all active sessions.

### Admin-vs-Admin Rules & Hierarchy
- **Super-Admin Immutability**: Super-admin accounts cannot have their role changed (`ErrorCode.LAST_SUPERADMIN`, 409 Conflict) and cannot be deleted (`ErrorCode.LAST_SUPERADMIN`, 409 Conflict).
- **Last Active Super-Admin Protection**: The system strictly prevents deactivating or deleting the last active super-administrator (`ErrorCode.LAST_SUPERADMIN`, 409 Conflict).
- **Self-Action Prevention**: Users cannot modify their own active status, cannot change their own role, and cannot delete their own account (`ErrorCode.CONFLICT`, 409 Conflict).
- **Secondary Admin Restrictions**: Secondary administrators cannot modify, deactivate, or delete administrator or super-administrator accounts, and cannot grant administrator role to anyone (`ErrorCode.RBAC_INSUFFICIENT`, 403 Forbidden).
- **Recycle Bin**: Soft-deleted accounts can only be viewed and restored by super-administrators (`GET /auth/users/deleted`, `PATCH /auth/users/:id/restore`).

### Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /api/v1/auth/login` | 10 / IP | 15 min |
| `POST /api/v1/auth/request-access` | 5 / IP | 15 min |
| `POST /api/v1/auth/forgot-password` | 5 / IP | 15 min |
| `GET /api/v1/qr/trace/t/:token` (public trace) | 60 / IP | 1 min |
| `POST /api/v1/qr/scan` (public scan recording) | 60 / IP | 1 min |
| `POST /api/v1/ai/dispatch-audit` | 5 / IP | 15 min |
| Global API | 500 / IP | 15 min |

#### Client IP Resolution & Forwarded Headers
Client IP for rate limiting is derived strictly via the servlet remote address (`request.getRemoteAddr()`). Client-supplied headers (such as `X-Forwarded-For`) are never parsed directly by application code to prevent IP spoofing attacks.

Forwarded headers are handled exclusively through Spring Boot's `server.forward-headers-strategy`:
- **Development & Test**: `server.forward-headers-strategy=none` (off). `request.getRemoteAddr()` returns the local connection address, ensuring spoofed headers cannot bypass rate limits.
- **Production**: `server.forward-headers-strategy=${SERVER_FORWARD_HEADERS_STRATEGY:native}`.
  - **Empirical test results**: Tested both `framework` and `native` in `ForwardedHeadersEmpiricalTest`. While both resolve `X-Forwarded-For` from loopback, Tomcat's `native` strategy (`RemoteIpValve`) actively validates incoming connections against `internalProxies` (RFC-1918 private subnets and loopback). Untrusted direct connections cannot spoof `X-Forwarded-For` because Tomcat rejects forwarded headers from non-internal IPs, keeping `request.getRemoteAddr()` pinned to the client's actual socket address. Spring's `framework` strategy lacks default proxy-filtering, leaving direct connections vulnerable to spoofing.
  - **Render Deployment Assumption**: On Render, traffic passes through Render's reverse proxy/load balancer, which forwards requests over private internal networks (matching Tomcat's default `internalProxies` regex) with the real client IP in `X-Forwarded-For`. Thus, `native` securely derives the real client IP for rate limiting without trusting direct spoofed connections.

### Upload Rules (Bulk Import)
- Max request body for commit: 500 rows per chunk (confirmed from `import.controller.js` line 40).
- Max total file rows: **Proposed** 10,000 rows across all chunks per job.
- Accepted formats: CSV only (D-5 resolved as CSV only; XLSX excluded from scope).
- No file ever touches disk: client sends pre-parsed JSON rows. Source: `import.controller.js` lines 7–9.

### Logging Rules
- Never log token values, passwords, OTP codes, or resetToken.
- Log `requestId` on every request and response.
- Log session revocations (source: `auth.js` line 113).
- Log AI provider failures (source: `aiService.js` lines 138, 144).
- `passwordHash` and `resetToken` are excluded from `SESSION_FIELDS` — never reach request logs. Source: `auth.js` line 33.

### Privacy of Scan Events
`ScanEvent` stores `ipHash` (hashed before storage — never plain text). Source: `ScanEvent.model.js` line 24–25.
No consumer PII stored. Device type and source only.

### AI Privacy (D-9)
`farmerName` is NOT sent to third-party AI APIs. Only `village`, `batchCode`, `productName`, `sku`, `status`, `daysUntilExpiry`, `quantity`, `unit`, `yieldPercent`, `dataSource` are sent.

### Last-Super-Admin Guard
Any operation (deactivate, delete) that would leave zero active super-admins must be rejected with `HTTP 409 LAST_SUPERADMIN`.

---

## §8 — Configuration

### §8.1 — Ports and Environment Variables

**Dev & E2E ports** (D-7, Phase 5 Part F):
- New API (Spring Boot `dev`): **8081**
- New API (Spring Boot `test`): **8082**
- New API (Spring Boot `e2e` for Playwright browser tests): **8083**
- New Vite dev / E2E server: **5174**
- Reference workspace backend (if running concurrently): **8080**

| Variable | Purpose | Required |
|----------|---------|----------|
| `SPRING_DATA_MONGODB_URI` | MongoDB Atlas URI | Yes |
| `SERVER_PORT` | API port (default 8081; 8083 in `e2e`) | No |
| `SPRING_PROFILES_ACTIVE` | `dev` / `test` / `e2e` / `prod` | No |
| `JWT_SECRET` | JWT signing secret (≥ 32 chars) | Yes |
| `SEED_DEFAULT_PASSWORD` | Seeded account password in `dev` / `prod` (when seeding enabled) | When `SEED_ENABLED=true` |
| `E2E_SEED_PASSWORD` | Seeded account password in `e2e` profile (default `E2ePass123456!`) | No (`e2e` only) |
| `TRACE_TOKEN_SECRET` | HMAC key for QR trace tokens (dev/test/e2e may fall back to JWT_SECRET; prod profile fails fast at startup naming TRACE_TOKEN_SECRET if missing or < 32 chars) | Yes (production) |
| `PUBLIC_TRACE_BASE_URL` | Frontend origin encoded in QR codes (see §8.2) | Yes (production) |
| `FRONTEND_URL` | CORS allowed origin (`http://localhost:5174` in `dev` / `e2e`) | Yes |
| `GEMINI_API_KEY` | Google Gemini API key | For AI feature |
| `GEMINI_CACHE_TTL_HOURS` | AI cache duration in hours (default 4) | No |
| `NVIDIA_API_KEY` | NVIDIA NIM API key (AI fallback) | No |
| `NVIDIA_MODEL` | NVIDIA model name | No |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Phase 11 (Should-have per D-3; enabled only when provided) |
| `SPRING_MAIL_HOST` | SMTP host (e.g. smtp.gmail.com) | For email |
| `SPRING_MAIL_PORT` | SMTP port (e.g. 465) | For email |
| `SPRING_MAIL_USERNAME` | SMTP username | For email |
| `SPRING_MAIL_PASSWORD` | SMTP app password | For email |
| `SPRING_MAIL_PROPERTIES_MAIL_SMTP_AUTH` | true | For email |
| `SPRING_MAIL_PROPERTIES_MAIL_SMTP_STARTTLS_ENABLE` | true | For email |
| `EMAIL_FROM_NAME` | Display name in sent emails | For email |
| `EMAIL_FROM_ADDR` | From address | For email |

### §8.2 — PUBLIC_TRACE_BASE_URL

**Renamed from `PUBLIC_BASE_URL`** to `PUBLIC_TRACE_BASE_URL` to make the purpose explicit.

This is the **frontend origin** (e.g. `https://tracex-app.web.app`). The QR code encodes `${PUBLIC_TRACE_BASE_URL}/trace/t/${traceToken}` — the frontend route, not the API route. The frontend trace page then calls the API to resolve the token.

Rules:
- Must NOT end with `/`.
- In production: the server **refuses to start** if `PUBLIC_TRACE_BASE_URL` resolves to `localhost`, `127.0.0.1`, `::1`, or any RFC 1918 private address (10.x.x.x, 172.16–31.x.x, 192.168.x.x).
- In development/test/e2e profiles: localhost is allowed.
- If unset in production, the health endpoint returns degraded status.

### §8.3 — Profiles

| Profile | Database | API Port | Vite Port | Notes |
|---------|---------|---------|----------|-------|
| `dev` (development) | `tracex_fresh_dev` | 8081 | 5174 | Dev mail sink (`target/dev-mail`), `management.health.mail.enabled=false`, seeding enabled (6 users, 3 access requests, 5 products, 12 demo batches, 5 inspections) |
| `test` | `tracex_fresh_test` | 8082 | — | Integration test profile (`GlobalTestDatabaseSafetyExtension` enforces `_test` suffix), `management.health.mail.enabled=false` (GreenMail starts on demand in `SmtpEmailServiceTest`) |
| `e2e` | `tracex_fresh_e2e` | 8083 | 5174 | Browser E2E profile: dev mail sink on, `management.health.mail.enabled=false`, seeding on (`E2E_SEED_PASSWORD`, 12 demo batches), CORS `http://localhost:5174`, raised rate limits (`1000` / 15m), reset via `scripts/e2e-reset.ps1` |
| `prod` (production) | `tracex_fresh` | 8081 | (Firebase CDN) | Strict startup validation, SMTP mail (`SmtpEmailService`), `native` forwarded-headers strategy |

**Actuator mail health indicator (`management.health.mail.enabled`, Phase 8.0 Part 0.3)**:
- `management.health.mail.enabled=false` is configured in `application-dev.properties`, `application-test.properties`, and `application-e2e.properties` (and removed from base `application.properties`).
- **Reason**: In `dev`, `test`, and `e2e`, `tracex.mail.sink.enabled=true` activates `DevMailSink` (file-based mail sink) and no SMTP server listens on `localhost:587` unless GreenMail is explicitly started by `SmtpEmailServiceTest`; leaving `MailHealthIndicator` enabled in those profiles would cause `/actuator/health` to report `DOWN` due to an unused dummy `JavaMailSender` bean. Removing it from base `application.properties` ensures `prod` (`tracex.mail.sink.enabled=false`, where real SMTP is used) does not silently inherit a global mail-health suppression unless explicitly configured.

**Seeded dataset (`SeedRunner.java`)**: When `SEED_ENABLED=true`, idempotently seeds 6 users (`superadmin`, `admin`, `manager`, `factory_mgr`, `inspector`, `coordinator`), 3 access requests, 5 products (`WBJC`, `KMGC`, `RHSLT`, `ABHJAM`, `WBDRP`), **12 demo batches** (`DEMO-LOT-001` through `DEMO-LOT-012`), and 5 inspections.

### §8.4 — Database Naming

New database: **`tracex_fresh`** (D-8). Avoids MongoDB error 13297 (`DatabaseDifferCase`) — case collision with reference database `TraceX`.

### §8.5 — Live-Update Mechanism (D-4)

**SSE (Server-Sent Events)** via `GET /api/v1/notifications/stream`.
- Authenticated like a REST endpoint (Authorization header on the initial request).
- Connection is long-lived; server sends `data: <json>\n\n` frames for each notification event.
- Client uses the browser `EventSource` API (or a fetch-based stream reader for auth header support, since `EventSource` does not support custom headers).
- Events: `batch:created`, `batch:updated`, `batch:dispatched`, `import:finished`, `inspection:created`.
- No Socket.IO in the new build.

---

## §9 — Test Strategy

### Stack
- **Backend unit tests**: JUnit 5, Mockito
- **Backend integration tests**: JUnit 5 + Testcontainers (real MongoDB in Docker)
- **Frontend unit tests**: Vitest
- **E2E tests**: Playwright

### Naming Convention
| Test type | Suffix | Location |
|-----------|--------|---------|
| Unit | `*Test.java` | `src/test/java/…` |
| Integration | `*IT.java` | `src/test/java/…` |
| Frontend unit | `*.test.ts(x)` | `src/` beside the component |
| E2E | `*.spec.ts` | `e2e/` |

### Test IDs
Format: `TEST-M-{N}` for Must requirements, `TEST-S-{N}` for Should.

### Acceptance Criteria

**TEST-M-01** — Batch CRUD
> **Given** a factory-manager JWT  
> **When** `POST /api/v1/batches` with valid fields  
> **Then** HTTP 201, `batchCode` matches `TX-\d{4}-\d{2}-\d{3}`, `qrAbsoluteUrl` starts with `PUBLIC_TRACE_BASE_URL`

**TEST-M-02** — Session revocation
> **Given** a user is logged in with a valid token  
> **When** an admin deactivates that user's account  
> **Then** the user's next API request returns HTTP 403 `AUTH_ACCOUNT_INACTIVE`

**TEST-M-03** — RBAC
> **Given** a quality-inspector JWT  
> **When** `DELETE /api/v1/batches/:id`  
> **Then** HTTP 403 `RBAC_INSUFFICIENT`

**TEST-M-04** — FEFO order and expired exclusion
> **Given** batches with URGENT, WARNING, READY, and EXPIRED statuses  
> **When** `GET /api/v1/dispatch/fefo`  
> **Then** URGENT before WARNING before READY; EXPIRED absent from response

**TEST-M-05** — Public trace
> **Given** a batch with a traceToken; no Authorization header  
> **When** `GET /api/v1/qr/trace/t/:token`  
> **Then** HTTP 200 with whitelisted DTO; `farmerName` not present

**TEST-M-06** — Inspection verdict server validation
> **Given** a quality-inspector JWT; batchId exists  
> **When** `POST /api/v1/inspections` with `status: "PASSED"` and one checklist item `passed: false`  
> **Then** HTTP 422 `VALIDATION_ERROR` with fieldError on checklist

**TEST-M-07** — Access request and invite
> **Given** a pending AccessRequest  
> **When** admin calls `POST /api/v1/auth/requests/:id/approve`  
> **Then** `inviteToken` set (hashed), `status: approved`, email service called

**TEST-M-08** — User soft-delete blocks login
> **Given** an admin soft-deletes a user  
> **When** that user calls `POST /api/v1/auth/login`  
> **Then** HTTP 401 (isDeleted filter in login query)

**TEST-M-09** — SSE notification delivery
> **Given** a connected SSE stream for a factory-manager  
> **When** a batch is created  
> **Then** a `batch:created` event is sent on the stream

**TEST-M-10** — Batch code uniqueness under concurrency
> **Given** two concurrent `POST /api/v1/batches` requests in the same month  
> **When** both complete  
> **Then** both batches have unique codes with sequential numbers

See `docs/traceability.md` for the full requirement-to-test map.

---

## §10 — Deployment

### Targets
- **Frontend**: Firebase Hosting (confirmed: `intern-2/srs.md` line 38 — `TraceX2026-bb904.web.app`)
- **Backend**: Render with Docker (containerized Spring Boot)
- **Database**: MongoDB Atlas

### Docker
New build provides `Dockerfile` and `docker-compose.yml` for local dev and Render deployment. Rate limiting uses in-memory counters (acceptable for single-container Render deployments; no external cache required).

### Runbook Outline
1. Set all required env vars (see §8.1).
2. Run `mvn package -DskipTests` → produces `tracex-backend-1.0.0-SNAPSHOT.jar`.
3. Start: `java -jar target/tracex-backend-1.0.0-SNAPSHOT.jar --spring.profiles.active=prod`.
4. Seed: configure `SEED_ENABLED=true` and `SEED_DEFAULT_PASSWORD` (min 12 chars). `dev` and `test` profiles seed automatically; `prod` seeds only when `SEED_ENABLED=true`.
5. Set super-admin: the initial super-admin is promoted directly in MongoDB via `mongosh` per `docs/deployment-runbook.md` (no API endpoint can promote super-admin).
6. Verify: `GET /actuator/health` → `{ "status": "UP" }`.

---

## §11 — Standing Rules

### Status Vocabulary (PROGRESS.md phases)
- `NOT STARTED` — phase has not begun
- `IN PROGRESS` — work started, not all checks pass
- `COMPLETE` — all verification checks recorded and pass
- `BLOCKED` — dependency or decision required

### Feature Finding Vocabulary (audit documents)
- **Verified** — auditor ran the feature and confirmed it works end-to-end
- **Implemented, not externally verified** — code exists and is internally consistent, but auditor did not run it
- **Not implemented** — feature is absent from code
- **Blocked** — feature depends on an external service or decision not yet resolved

### Anti-Fabrication Rule
Every statement in any audit document must cite the source file and line number. Never record unsourced claims without citing what source would verify them. Never invent data.

### Trade-Off Order
When a decision must be made under uncertainty:
1. Correctness
2. Security
3. Performance
4. Developer experience

### Phase Gate & Launch Gate
Do not begin a phase until:
1. All checks from the previous phase pass and are recorded in PROGRESS.md.
2. Any blocking decisions for that phase are RESOLVED.
3. The owner has reviewed the deliverables of the previous phase.

**Production Launch Gate (Phase 14)**:
1. All placeholder backdrops (`placeholder: true` in `design-assets/backdrops.json`, tracked as `OI-11`) must be replaced with real owner-supplied or owner-approved licensed photographs (`placeholder: false`, `approvedByOwner: true`, with `source`, `author`, `licence`, and `licenceUrl` recorded and verified by `npm run check:backdrops` with zero placeholder warnings).
