# Audit: Discrepancies Between HANDOFF.md and Source Files
> Audit date: 2026-10-01

Each row cites the source file that contradicts or confirms the HANDOFF claim.

---

## 1. No `.git` directory

**HANDOFF claim**: No `.git` directory (repo was downloaded, not cloned).

**Verification**: `Test-Path "...\..git"` returns `False` (run 2026-10-02).

**Status**: **Confirmed** — no `.git` directory. The workspace was downloaded, not cloned.

---

## 2. MongoDB database name `TraceX` and case-mismatch history

**HANDOFF claim**: Database is named `TraceX`; there was a prior `tracex` (lowercase) that caused MongoDB error 13297 (DatabaseDifferCase).

**Verification**: `.env.example` line 11 shows connection string ending in `/TraceX?retryWrites=...`. Database name `TraceX` confirmed in env example.

**Case-mismatch history**: Cannot be confirmed without `mongosh` access or MongoDB Atlas console. No file in the reference workspace records this error.

**Status**: `TraceX` database name **Confirmed** from `.env.example` line 11. Case-mismatch history **cannot be confirmed from files** — requires Atlas console. This is irrelevant to the new build which uses `tracex_fresh` (D-8).

---

## 3. Port 8080 and the Vite proxy

**HANDOFF claim**: Node backend runs on port 8080; Vite proxies to port 8080.

**Verification**: 
- `frontend/vite.config.js` lines 10–12 — Vite proxies `/api`, `/auth`, `/health` to `http://localhost:8080`. **Confirmed**.
- `.env.example` line 14 — `PORT=5001`. **Contradiction**: `.env.example` says port 5001, Vite config says 8080.
- `frontend/src/hooks/useSocket.js` line 12 — `SOCKET_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'`. **Confirms 8080 as default fallback**.

**Status**: The Vite proxy targets 8080 (source: `vite.config.js` lines 10–12). The `.env.example` says 5001. The frontend `api/client.js` line 5 defaults to `http://localhost:8080`. The runtime default for the reference backend is **8080** — the `.env.example` port 5001 is an outdated or incorrect documentation artifact. The new build runs on 8081 to avoid conflicts.

---

## 4. QR origin hardcoded to localhost

**HANDOFF claim**: QR origin is hardcoded to `localhost`.

**Verification**: `backend/src/services/qrGenerator.js` line 18 — 
```js
const absoluteUrl = `${process.env.PUBLIC_BASE_URL}/trace/t/${traceToken}`;
```
This is NOT hardcoded. It reads `PUBLIC_BASE_URL` from environment.

`backend/.env.example` line 19 — default value `PUBLIC_BASE_URL=http://localhost:5001`. This is the example, not hardcoded in code.

**Status**: **Discrepancy** — HANDOFF is wrong. The code uses an env var. The default in the example file points to localhost, which is why it appeared hardcoded when run locally.

---

## 5. Dashboard calls with no Spring controller

**HANDOFF claim**: Some dashboard API calls have no Spring controller equivalent.

**Verification**: The Spring Boot `tracex-backend/src` has been fully listed (2026-10-02).

Controllers **present** in Spring: `BatchController`, `DispatchController`, `InspectionController`, `TraceController`.

Controllers **absent** from Spring: AI audit, bulk import, notifications, login history, messages, access-request approval/rejection.

**Status**: **Partially confirmed** — HANDOFF claim that inspection was absent is **Contradicted** (InspectionController.java exists: source `InspectionController.java` lines 34–63). The remaining absent features (AI, import, notifications, login history, messages) are confirmed absent.

---

## 6. Features excluded from the Java port

**HANDOFF claim**: Google OAuth, CSV import, notifications, login history, settings persistence, Socket.IO, Gemini excluded from Java port.

**Verification** (from Spring Boot src file listing — no corresponding controller/service found):
- Google OAuth: **Confirmed absent** — no GoogleAuthController or OAuth2 config found in Spring src.
- CSV/XLSX import: **Confirmed absent** — no ImportController.
- Notifications: **Confirmed absent** — no NotificationController.
- Login history: **Confirmed absent** — no LoginEventService.
- Settings persistence (user preferences): **Confirmed absent** — Spring `User.java` fields (read 2026-10-02): `id`, `username`, `passwordHash`, `name`, `email`, `role`, `isActive`, `isDeleted`, `deletedAt`, `createdAt`, `updatedAt`. No `preferences` field. Source: `tracex-backend/src/main/java/com/tracex/model/User.java` lines 14–32.
- Socket.IO: **Confirmed absent** — Spring uses REST only; no WebSocket config found.
- Gemini AI: **Confirmed absent** — no AiController.

**Status**: All 7 confirmed. Settings persistence absent from Spring User entity.

---

## 7. Socket.IO and polling hooks

**HANDOFF claim**: Socket.IO used for live updates; polling hooks may also exist.

**Verification**:
- `frontend/src/hooks/useSocket.js` line 9 — `import { io } from 'socket.io-client'`. Socket.IO **confirmed**.
- Socket.IO events handled: `batch:created`, `batch:updated` (lines 39–55).
- `backend/src/controllers/batches.controller.js` lines 67–68, 135–136 — server emits `batch:created` and `batch:updated` via `req.app.get('io')`.

**Polling**: React Query staleTime-based refetch acts as soft polling. `useDispatch.js` line 23 — `staleTime: 60 * 1000`. No explicit `setInterval` polling hooks found in any hook file (confirmed: `useBatches.js`, `useDispatch.js`, `useSocket.js` all fully read). The HANDOFF's "polling hooks" refers to React Query background refetch — no dedicated polling.

**Status**: Socket.IO **confirmed**. Dedicated polling hooks **not found**. React Query background refetch exists.

---

## 8. Batch code prefix TX- vs HS-

**HANDOFF claim**: Batch code format `TX-YYYY-MM-NNN`.

**Verification**: `backend/src/utils/batchCodeGenerator.js` line 8 — `const prefix = \`HS-${year}-${month}-\``.

**Status**: **Discrepancy** — code uses `HS-` prefix, not `TX-`.

---

## 9. FEFO scoring "500+" and "200+" bands

**HANDOFF claim**: FEFO priority score has "500+" and "200+" urgency bands.

**Verification**: No score threshold of 500 or 200 exists anywhere in source. The formula max output is `365 + 100 = 465` (for a batch expiring today with HIGH risk). Sort is by status tier and then daysUntilExpiry, not by score threshold bands.

**Status**: **Discrepancy** — these thresholds do not exist in source. HANDOFF was describing approximate score ranges, not code constants.

---

## 10. JWT token storage

**HANDOFF claim**: Not explicitly stated.

**Verification**: `frontend/src/api/client.js` line 15 — `const token = localStorage.getItem('hs_token')`. Line 19 — token sent as `Authorization: Bearer ${token}`. Source read 2026-10-02. Server reads `req.headers.authorization` expecting `Bearer <token>`. Source: `backend/src/middleware/auth.js` line 40–41.

**Status**: **Confirmed** — JWT stored in `localStorage` under key `hs_token`, sent as `Authorization: Bearer` header. Decision D-1 accepts this approach for the new build. Token key in new build: `tx_token`.

