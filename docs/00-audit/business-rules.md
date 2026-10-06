# Audit: Business Rules
> Source files cited with file path and line number.
> Audit date: 2026-10-01

---

## BR-1: FEFO (First Expired, First Out)

### Priority Score Formula
Source: `backend/src/services/expiryCalculator.js` lines 29–33.

```js
function calculatePriorityScore(daysUntilExpiry, riskLevel) {
  let score = Math.max(0, 365 - daysUntilExpiry);
  if (riskLevel === 'HIGH')   score += 100;
  if (riskLevel === 'MEDIUM') score += 50;
  return score;
}
```

**Exact formula**: `score = max(0, 365 - daysUntilExpiry) + riskBonus`
Risk bonuses: HIGH = +100, MEDIUM = +50, LOW = +0.

> **HANDOFF claim "500+", "200+" bands**: These figures do NOT appear anywhere in source code. `grep` for `500` and `200` as numeric score thresholds returns no results in the backend source (searched all `.js` files in `backend/src`). The formula max output is `max(0, 365−0) + 100 = 465` (expired batch, HIGH risk). The HANDOFF was approximating score output ranges, not quoting code constants. **No such threshold exists.**

### Status Thresholds
Source: `backend/src/services/expiryCalculator.js` lines 21–26.

```js
function getBatchStatus(daysUntilExpiry) {
  if (daysUntilExpiry <= 0)  return 'EXPIRED';
  if (daysUntilExpiry <= 7)  return 'URGENT';
  if (daysUntilExpiry <= 30) return 'WARNING';
  return 'READY';
}
```

**Exact thresholds**:
- `EXPIRED`: daysUntilExpiry ≤ 0
- `URGENT`: daysUntilExpiry 1–7 (inclusive)
- `WARNING`: daysUntilExpiry 8–30 (inclusive)
- `READY`: daysUntilExpiry > 30

### FEFO Queue Sort Order
Source: `backend/src/controllers/dispatch.controller.js` lines 19–24.

```js
const priority = { URGENT: 0, WARNING: 1, READY: 2 };
enriched.sort((a, b) => {
  const pd = (priority[a.liveStatus] ?? 3) - (priority[b.liveStatus] ?? 3);
  if (pd !== 0) return pd;
  return a.daysUntilExpiry - b.daysUntilExpiry;
});
```

Primary sort: status tier (URGENT first). Secondary: daysUntilExpiry ascending (earliest expiry first).

**Note**: The FEFO queue does NOT filter out `isDeleted: true` batches. Source: dispatch.controller.js line 7 — filter only requires `status: { $in: ['READY', 'WARNING', 'URGENT'] }`. DISPATCHED and EXPIRED are excluded by status; deleted batches are NOT explicitly excluded. **This is a known defect to fix in the new build.**

### daysUntilExpiry Calculation
Source: `backend/src/services/expiryCalculator.js` lines 14–15.

```js
const now = new Date();
const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
```

`now` comes from `new Date()` — it is NOT injected. This prevents deterministic testing. The new build must inject a clock.

---

## BR-2: Batch Code and Counter

### Format
Source: `backend/src/utils/batchCodeGenerator.js` line 1 (comment), lines 6–8.

Format: `HS-YYYY-MM-NNN`

Example: `HS-2026-06-001`

> **HANDOFF claim `TX-YYYY-MM-NNN`**: The HANDOFF says `TX-` prefix. Source code uses `HS-` prefix. **Discrepancy — source wins.**

### Counter Reset
Source: `backend/src/utils/batchCodeGenerator.js` lines 10–13.

```js
const last = await Batch.findOne(
  { batchCode: { $regex: `^${prefix}` } },
  ...
);
```

The prefix includes `HS-YYYY-MM-`. The counter searches only within the current month's prefix. Therefore **the counter resets monthly**. Confirmed.

### Counter Sequence
Source: lines 16–20.

```js
let nextNum = 1;
if (last) {
  const parts = last.batchCode.split('-');
  nextNum = parseInt(parts[3], 10) + 1;
}
return `${prefix}${String(nextNum).padStart(3, '0')}`;
```

Padded to 3 digits. Sequence is 001, 002, ..., 999 per month. No atomic lock — race condition possible on concurrent creates.

---

## BR-3: Inspection Checklist and Verdict

### Checklist Items
Source: `backend/src/models/Inspection.model.js` lines 17–26.

8 fixed items:
1. Packaging integrity
2. Label accuracy & legibility
3. Expiry date visible & correct
4. Weight / quantity correct
5. No visible contamination
6. Colour & texture acceptable
7. Odour within acceptable range
8. Storage conditions met

Each item: `{ label, passed: Boolean|null, note: string max 200 chars }`.

### Verdict Options
Source: `backend/src/models/Inspection.model.js` lines 43–48.

Enum: `['PASSED', 'FAILED', 'FLAGGED']`

### Rating
Source: lines 49–55. Integer 1–5 (1 = very poor, 5 = excellent).

### Who Can Create
Source: `backend/src/routes/inspection.routes.js` line 13.
`requireQualityInspector` → quality-inspector + admin + super-admin.

### Append-Only / No Updates
Source: `Inspection.model.js` comment line 12: "No updates allowed — inspections are append-only for audit integrity."

### TTL
Source: `Inspection.model.js` line 78.
```js
createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 },
```
30-day MongoDB TTL.

### Quality Snapshot on Batch
Source: `backend/src/models/Batch.model.js` lines 93–98.
The batch stores a `qualityCheck` snapshot (`status`, `rating`, `inspectedAt`, `inspectorName`) so the public trace page shows quality data even after the inspection document expires.

---

## BR-4: Access-Request Approval and Provisioning

Source: `backend/src/models/AccessRequest.model.js`.

Fields: `name`, `email` (unique), `role`, `status` (pending/approved/rejected), `note`, `inviteToken` (SHA-256 hash), `inviteExpiry`, `inviteUsed: false`, `approvedBy`.

Approval flow (from routes + controller review):
1. User submits `POST /auth/request-access` → creates AccessRequest with status=pending.
2. Admin calls `POST /auth/requests/:id/approve` → sets status=approved, generates invite token, optionally sends email.
3. User receives invite link → `GET /invite?token=...` → `POST /auth/activate` → sets password → `POST /auth/verify-otp` → account active.
4. `inviteUsed` flag prevents token reuse.

Auto-provisioning: **No automatic provisioning**. All approvals require an admin action. Confirmed by route guard `requireAdminOrAbove` on approve endpoint.

---

## BR-5: Status Transitions, Archive, Soft-Delete, Restore

### Batch Status Machine
Allowed statuses (source: `Batch.model.js` line 62–67): `READY`, `WARNING`, `URGENT`, `DISPATCHED`, `EXPIRED`.

Transitions:
- READY / WARNING / URGENT → DISPATCHED: via `PATCH /api/batches/:id/dispatch` (admin guard inside controller: any authenticated user — see permissions audit discrepancy).
- Any → EXPIRED: recalculated live from `daysUntilExpiry`; not a stored state transition but a computed value via `getBatchStatus`.
- Any → archived (soft-delete): `DELETE /api/batches/:id` (admin only). Sets `isDeleted=true`, records `deletedAt`, `deletedBy`, `deleteNote`.
- Archived → active: `PATCH /api/batches/:id/restore` (admin only). Clears isDeleted fields.

### User Soft-Delete / Restore
Source: `User.model.js` lines 34–41, `auth.routes.js` lines 38–42.
- Admin soft-deletes: `DELETE /auth/users/:id` → sets `isDeleted=true`, `deletedBy`, `deletedAt`, `deleteNote`.
- Super-admin views recycle bin: `GET /auth/users/deleted`.
- Super-admin restores: `PATCH /auth/users/:id/restore`.
- A deleted user cannot log in (login query filters `isDeleted: { $ne: true }`).
- A deleted user's token is rejected on the next request (auth middleware checks `user.isDeleted`). Source: `auth.js` line 60–62.

---

## BR-6: Dispatch

Source: `backend/src/controllers/batches.controller.js` lines 123–154.

- Required field: `buyerName`.
- Optional: `dispatchDate` (defaults to `new Date()`).
- Action: sets status=DISPATCHED, buyerName, dispatchDate.
- Emits Socket.IO `batch:updated` event.
- Notifies manager and factory-manager roles via notification service.

**Guard**: Only `protect` middleware — no role restriction in the route. The controller itself has no role check. Any authenticated user can dispatch. Source: `batches.routes.js` line 30.

---

## BR-7: QR Content

Source: `backend/src/services/qrGenerator.js` lines 16–31.

The QR encodes: `${process.env.PUBLIC_BASE_URL}/trace/t/${traceToken}`

The `traceToken` is a 22-character HMAC-SHA256 (base64url) derived from the batch code, keyed by `TRACE_TOKEN_SECRET` (or `JWT_SECRET` as fallback). Source: `backend/src/utils/traceToken.js` lines 50–57, 66–71.

**HANDOFF claim "QR hardcoded to localhost"**: This was true in an earlier version. The audited code uses `process.env.PUBLIC_BASE_URL`. Hardcoding to localhost is only present as the `.env.example` default value (`PUBLIC_BASE_URL=http://localhost:5001`). The code itself is not hardcoded.
