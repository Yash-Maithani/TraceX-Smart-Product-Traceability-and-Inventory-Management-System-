# Audit: Problems, Security Smells, and Limitations
> Audit date: 2026-10-01

---

## Security Smells

### S-1: Token stored in localStorage (confirmed)
**Evidence (confirmed 2026-10-02)**: `frontend/src/api/client.js` line 15 — `const token = localStorage.getItem('hs_token')`. Line 19 — token sent as `Authorization: Bearer ${token}`. `frontend/src/pages/Login.jsx` lines 742–743 — on successful password login and Google login, token is written to `localStorage.setItem('hs_token', token)`. localStorage is accessible to any JavaScript on the page (XSS-vulnerable).
**Severity**: HIGH
**Fix in new build (D-1 RESOLVED)**: New build uses the same `Authorization: Bearer` header approach with token stored in `sessionStorage` or memory — not a cookie. Decision D-1 explicitly chose Authorization header. The `hs_token` key becomes `tx_token` in the new build.

### S-2: No refresh token mechanism
**Evidence**: JWT expires after 8h (source: `auth.js` line 98: `expiresIn: '8h'`). No refresh token endpoint in `auth.routes.js`. Users must log in again after 8h.
**Severity**: MEDIUM (usability impact; short window limits damage from stolen token)

### S-3: Batch list endpoint is unauthenticated
**Evidence**: `backend/src/routes/batches.routes.js` line 10 — `router.get('/', getAllBatches)` — no `protect` middleware.
**Severity**: MEDIUM — exposes farmer names, villages, yield data, production volumes to unauthenticated callers.
**Fix in new build**: Require authentication on batch list, or restrict returned fields for unauthenticated calls.

### S-4: FEFO dispatch queue is unauthenticated
**Evidence**: `backend/src/routes/dispatch.routes.js` line 3 — no `protect` middleware.
**Severity**: LOW — read-only aggregated view, but leaks operational data.

### S-5: Farmer PII sent to third-party AI
**Evidence**: `backend/src/services/aiService.js` lines 54–55 — `farmerName` and `village` sent in AI prompt to Google Gemini and NVIDIA APIs.
**Severity**: MEDIUM — privacy risk; no data processing agreement visible.

### S-6: Race condition in batch code generation
**Evidence**: `backend/src/utils/batchCodeGenerator.js` lines 10–22 — uses `findOne` + increment pattern without atomic lock. Two concurrent batch creates in the same month could generate the same batch code (unique index on `batchCode` would catch and reject the second one, but the create would fail).
**Severity**: MEDIUM — functional failure under concurrency; not a security issue.

### S-7: No secrets committed (confirmed)
**Evidence**: `.env.example` line 26 — `GEMINI_API_KEY=AIza_YOUR_KEY_HERE` (placeholder). Line 36 — `JWT_SECRET=your_jwt_secret_here` (placeholder). No `.env` file found in the repository root (only `.env.example`). No real key patterns found in audited source files.
**Severity**: N/A — this is a positive finding.

### S-8: CORS configuration
**Spring backend (confirmed)**: `SecurityConfig.java` line 83 — `config.setAllowedOriginPatterns(List.of("*"))` — wildcard CORS. Source read 2026-10-02.
**Reference backend (partially confirmed)**: `.env.example` line 21 shows `FRONTEND_URL=http://localhost:5173` suggesting allowlisted origins; main `server.js` not read. The Spring backend's wildcard CORS is the confirmed risk. The new build must use `FRONTEND_URL` as the sole allowed origin.
**Severity**: MEDIUM — permissive CORS in Spring backend.

### S-9: Dispatch coordinator cannot dispatch (logic gap)
**Evidence**: `requireAdmin.js` line 17 — `dispatch-coordinator` is Tier 3. The dispatch endpoint `PATCH /api/batches/:id/dispatch` has only `protect` — any authenticated user can dispatch. The `dispatch-coordinator` role is defined but never given exclusive rights. The role exists in name but adds no distinct permissions vs. other Tier 3 roles.
**Severity**: LOW — misleading design; not a security vulnerability.

---

## Limitations

### L-1: No pagination on inspections, notifications, messages
These endpoints return all documents. Could be slow with large data sets.

### L-2: Inspection 30-day TTL destroys audit trail
`Inspection.model.js` line 78 — auto-expires after 30 days. The batch keeps a `qualityCheck` snapshot, but detailed checklist items are lost. For food safety compliance this may be insufficient.

### L-3: No transaction support on batch create + QR
Batch creation, QR generation, and trace token derivation are separate operations. A server crash between steps leaves a batch without a valid QR. No MongoDB transaction wraps the create.

### L-4: Priority score not updated on status recalculation
`priorityScore` is stored on the Batch document and computed once at creation. It is not recalculated as days pass. The live `daysUntilExpiry` is recomputed on retrieval, but the stored score drifts.

### L-5: Import is CSV-only (no file upload to server)
**Confirmed**: `import.controller.js` lines 7–9 — "Rows arrive as already-parsed JSON (the browser reads the CSV), so there is no multipart upload and no file ever touches the server's disk." The server never sees the file format — only pre-parsed JSON rows. Whether XLSX is supported depends entirely on what the frontend parses before sending. The reference `csvParser.js` handles CSV only. XLSX support in the new build is pending D-5.

---

## Existing Tests

| Test file | What it covers |
|-----------|---------------|
| `backend/tests/expiryCalculator.test.js` | Expiry date and status threshold logic |
| `backend/tests/googleIdentity.test.js` | Google token verification service |
| `backend/tests/messageRetention.test.js` | Message 24h TTL behavior |
| `backend/tests/rbac.test.js` | Role-based access control middleware |
| `backend/tests/sessionRevocation.test.js` | tokenVersion bumping and rejection |
| `backend/tests/sharedStore.test.js` | Redis-like shared store behavior |
| `backend/tests/traceToken.test.js` | HMAC trace token derivation |
| `frontend/src/utils/csvParser.test.js` | CSV parsing utility |

No E2E tests. No integration tests. No CI configuration found in root.

---

## Scripts

| Script | Purpose |
|--------|---------|
| `backend/src/scripts/seedRichData.js` | Seeds realistic batch and product data |
| `backend/src/scripts/seedTestBatch.js` | Seeds a single test batch |
| `backend/src/scripts/seedUsers.js` | Seeds user accounts |
| `backend/src/scripts/setSuperAdmin.js` | Sets `isSuperAdmin: true` on a user by username |
| `backend/src/scripts/backfillTraceTokens.js` | Backfills HMAC trace tokens for batches created before the field existed |
| `start-all.bat` | Starts backend + frontend together |
| `start-backend.bat` | Starts backend only |
| `start-frontend.bat` | Starts frontend only |

---

## Environment Variables

From `.env.example`:

| Variable | Purpose |
|----------|---------|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `PORT` | Server port (default documented as 5001; Vite proxy uses 8080) |
| `NODE_ENV` | development / production |
| `PUBLIC_BASE_URL` | Base URL for QR codes |
| `FRONTEND_URL` | CORS allowed origin |
| `GEMINI_API_KEY` | Google Gemini API key |
| `GEMINI_CACHE_TTL_HOURS` | AI cache duration (default 4h) |
| `NVIDIA_API_KEY` | NVIDIA NIM API key (AI fallback) |
| `NVIDIA_MODEL` | NVIDIA model name |
| `JWT_SECRET` | JWT signing secret |
| `TRACE_TOKEN_SECRET` | HMAC key for QR trace tokens (falls back to JWT_SECRET) |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_SECURE`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM_NAME`, `EMAIL_FROM_ADDR` | Nodemailer email config |

Additional variables confirmed used in source code but omitted from `.env.example`:
- `REDIS_URL` — for shared store (rate limits, AI cache). Referenced in `backend/src/services/sharedStore.js` line 12.
- `GOOGLE_CLIENT_ID` — for Google OAuth. Referenced in `backend/src/controllers/googleAuth.controller.js` line 29.

---

## Docker / Deploy Config

- `vercel.json` exists in root — Vite frontend deployed to Vercel.
- `firebase.json` and `.firebaserc` exist — but Firebase/Firestore is unused in the application code (dead config).
- No `Dockerfile` or `docker-compose.yml` found.
- No CI configuration (`.github/workflows/`) — `.github/` folder exists but contents not audited.

---

## Documentation

| File | Contents |
|------|---------|
| `README.md` | Setup instructions, role list, feature overview |
| `CHANGELOG.md` | Detailed version history |
| `CONTRIBUTING.md` | Contribution guidelines |
| `SECURITY.md` | Security policy |
| `final_project_report.md` | Project summary report |
| `intern2_srs_guide.md` | Requirements document used during development |
| `intern-2/srs.md` | Alternative SRS |
| `intern-2/planning_report.md` | Planning notes |
| `intern-2/implementation_plan_Initial.md` | Initial plan |
