# TraceX — Handoff Summary

> **Status of this document**: These are claims based on intern notes and a quick walk-through.
> Phase 0 of the new project audits every claim against actual file contents.

## Architecture

- **Frontend**: Vite + React 18, React Router v6, TanStack Query, Socket.IO client
- **Backend A (product)**: Node.js 20 + Express 5, Mongoose, Socket.IO server, JWT auth
- **Backend B (experimental)**: Spring Boot 3 Java port — partially implemented, not wired to the frontend
- **Database**: MongoDB Atlas, database name `TraceX` (note: prior name `tracex` caused a case-mismatch error, code 13297)
- **Ports**: Node backend on 8080 (claimed), Vite on 5173 (claimed); `.env.example` says port 5001

## Roles (claimed)

1. `super-admin` — identified by `isSuperAdmin: true` flag, not the role string
2. `admin` — full user and batch management
3. `manager` — read-only admin panel, can approve requests (claimed, verify)
4. `factory-manager` — create batches, bulk import
5. `quality-inspector` — submit inspections
6. `dispatch-coordinator` — dispatch batches

## Key business rules (claimed)

- **Batch code**: `HS-YYYY-MM-NNN` format, counter resets monthly (claim — verify)
- **FEFO scoring**: `score = 365 - daysUntilExpiry + riskBonus`; HIGH +100, MEDIUM +50, LOW 0.
  Thresholds approximately: URGENT ≤7 days, WARNING ≤30 days, READY >30 days.
  The HANDOFF says "500+" and "200+" bands — these values were not verified against source.
- **QR**: encodes a public URL; the HANDOFF says it was hardcoded to `localhost` — audit must verify whether `PUBLIC_BASE_URL` was introduced
- **Inspection checklist**: 8 standard items, verdict PASSED/FAILED/FLAGGED, rating 1-5, 30-day TTL
- **Soft delete**: batches and users support soft delete; only super-admin can hard-delete users
- **Session revocation**: `tokenVersion` counter on User, bumped on password change / deactivation / deletion

## Features claimed to be excluded from the Java port

Google OAuth, CSV import, notifications, login history, settings persistence, Socket.IO, Gemini AI

## Known problems (claimed)

- No `.git` directory in reference workspace (repo was downloaded, not cloned)
- Firebase config and `firestoreService.js` exist in frontend but are not used
- Some dashboard API calls have no Spring controller equivalent
- CORS was originally permissive (`*`)
- Some secrets may have been committed (verify)

## Live-update mechanism

Socket.IO on Node backend; frontend `useSocket.js` subscribes to `batch:created`,
`batch:updated`, `batch:deleted`, `batch:restored`, `batch:noteUpdated`.
Polling hooks may also exist — audit must verify.
