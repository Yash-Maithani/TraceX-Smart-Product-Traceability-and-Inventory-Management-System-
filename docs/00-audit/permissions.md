# Audit: Permissions
> Source files: `backend/src/middleware/auth.js`, `backend/src/middleware/requireAdmin.js`, `backend/src/routes/*.js`
> Audit date: 2026-10-01

---

## Role Definitions (from source)

Source: `backend/src/middleware/requireAdmin.js` lines 16–23.

```
ROLE_TIER = {
  'factory-manager':      3,
  'quality-inspector':    3,
  'dispatch-coordinator': 3,
  'manager':              2,
  'admin':                1,
  // super-admin is tier 0 — identified by isSuperAdmin flag, not this map
}
```

**Roles confirmed in source:**
1. `super-admin` — Tier 0 (identified by `isSuperAdmin: true` flag on User document, NOT by role string)
2. `admin` — Tier 1
3. `manager` — Tier 2
4. `factory-manager` — Tier 3
5. `quality-inspector` — Tier 3
6. `dispatch-coordinator` — Tier 3

Source: `backend/src/models/User.model.js` line 22–26 (role enum).

---

## RBAC Middleware Functions

Source: `backend/src/middleware/requireAdmin.js`

| Middleware | Allows |
|-----------|--------|
| `requireAdmin` | admin + super-admin (line 34–38) |
| `requireAdminOrAbove` | alias for requireAdmin (line 44–46) |
| `requireSuperAdmin` | super-admin only (line 52–58) |
| `requireManagerOrAbove` | manager + admin + super-admin (line 64–68) |
| `requireQIOrAbove` | quality-inspector + factory-manager + dispatch-coordinator + manager + admin + super-admin (line 83–88) |
| `requireQualityInspector` | quality-inspector + admin + super-admin (line 94–98) |
| `requireImporter` | factory-manager + manager + admin + super-admin (line 109–116) |

---

## Permission Matrix (derived from route middleware)

| Action | super-admin | admin | manager | factory-manager | quality-inspector | dispatch-coordinator |
|--------|:-----------:|:-----:|:-------:|:---------------:|:-----------------:|:--------------------:|
| **Auth** | | | | | | |
| Login | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Request access | Public | Public | Public | Public | Public | Public |
| Forgot password | Public | Public | Public | Public | Public | Public |
| **Self-service** | | | | | | |
| View own profile | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Update own profile | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Update own settings | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Change own password | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Logout all sessions | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| View own login history | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Link/unlink Google | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Batches** | | | | | | |
| List batches (active) | Public* | Public* | Public* | Public* | Public* | Public* |
| View batch by ID | Public* | Public* | Public* | Public* | Public* | Public* |
| Create batch | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Dispatch batch | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Edit traceability note | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Edit raw material | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Archive (soft-delete) batch | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Restore archived batch | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| View archived batches | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Download QR | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| View scan analytics | Public* | Public* | Public* | Public* | Public* | Public* |
| **Dispatch** | | | | | | |
| FEFO queue | Public* | Public* | Public* | Public* | Public* | Public* |
| **Inspections** | | | | | | |
| List inspections | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create inspection | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ |
| **Import** | | | | | | |
| Schema / map / validate / commit / rollback | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| **Notifications** | | | | | | |
| View own notifications | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Mark read / mark all read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **AI Audit** | | | | | | |
| Trigger dispatch audit | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Admin Panel** | | | | | | |
| List users | ✓ | ✓ | ✓ (read-only) | ✗ | ✗ | ✗ |
| Toggle user active | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Change user role | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Soft-delete user | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| View deleted users (recycle bin) | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Restore deleted user | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| List access requests | ✓ | ✓ | ✓ (read-only) | ✗ | ✗ | ✗ |
| Approve / reject requests | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Resend / remove requests | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Team directory | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |

\* These endpoints do NOT have `protect` middleware. They are genuinely unauthenticated.

Source: `backend/src/routes/batches.routes.js` lines 10–11 (GET / and GET /:id/scans have no `protect`), line 26 (GET /:id has no `protect`); `backend/src/routes/dispatch.routes.js` line 3 (no `protect`).

---

## Disagreements Between Sources

| Claim | Source A | Source B | Resolution |
|-------|---------|---------|-----------|
| Batch list requires auth | HANDOFF.md (implied) | `batches.routes.js` line 10 — no `protect` | **Routes win**: batch list is public |
| Dispatch FEFO requires auth | HANDOFF.md (implied) | `dispatch.routes.js` line 3 — no `protect` | **Routes win**: FEFO is public |
| `manager` can create batches | Role description | `batches.routes.js` line 29 — only `protect`, no role check in createBatch route | **Code wins**: any authenticated user can call POST /api/batches; controller does not filter by role |
| `dispatch-coordinator` can dispatch | Role name implies it | `batches.routes.js` line 30 — only `protect`, no role guard | **Code wins**: any authenticated user can call PATCH /api/batches/:id/dispatch |
| `quality-inspector` cannot import | requireImporter excludes them | Consistent | Confirmed |

---

## Super-Admin Flag

`isSuperAdmin` is set only via `backend/src/scripts/setSuperAdmin.js` (a manual migration script) or directly in MongoDB Atlas. No API endpoint can set it to `true`. Source: `User.model.js` comment at line 29–32.
