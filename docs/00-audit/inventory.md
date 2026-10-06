# Audit: Inventory
> Reference: `c:\Users\yashm\OneDrive\Desktop\TraceX-Smart-Product-Traceability-and-Inventory-Management-System`
> Audit date: 2026-10-01

---

## Frontend Pages

| File | Route | Auth required | Description |
|------|-------|---------------|-------------|
| `frontend/src/pages/Home.jsx` | `/` | No | Landing/marketing page |
| `frontend/src/pages/About.jsx` | `/about` | No | About page |
| `frontend/src/pages/Login.jsx` | `/login` | No | Login + Google OAuth button |
| `frontend/src/pages/TracePage.jsx` | `/trace/t/:token` and `/trace/:batchCode` | No | Public QR scan page |
| `frontend/src/pages/InvitePage.jsx` | `/invite` | No | New-user invite/activation page |
| `frontend/src/pages/Dashboard.jsx` | `/dashboard` | Yes (ProtectedRoute) | Main app — all tabs |
| `frontend/src/pages/NotFound.jsx` | `*` | No | 404 catch-all |
| `frontend/src/pages/ComponentShowcase.jsx` | `/showcase` | No | Developer-only UI component demo |

Source: `frontend/src/App.jsx` lines 57–81.

---

## Frontend Components

| Component | Purpose |
|-----------|---------|
| `ProtectedRoute.jsx` | Redirects to /login if no token in AuthContext |
| `Navbar.jsx` | Top navigation bar |
| `Hero.jsx` | Landing hero section |
| `BatchForm.jsx` | Create-batch form |
| `BatchCard.jsx` | Single batch display card |
| `BatchTable.jsx` | Paginated batch list table |
| `DispatchModal.jsx` | Dispatch confirmation modal |
| `InspectionModal.jsx` | Inspection form + checklist |
| `ImportPanel.jsx` | CSV/XLSX bulk import UI |
| `NotificationPanel.jsx` | In-app notification feed |
| `MessageThread.jsx` | Internal messaging UI |
| `SettingsPanel.jsx` | User preferences panel |
| `TeamPanel.jsx` | Team directory panel |
| `ThemePicker.jsx` | Color palette picker |
| `ThemeToggle.jsx` | Dark/light mode toggle |
| `WalkthroughTour.jsx` | Guided onboarding tour |
| `WelcomeChoiceModal.jsx` | First-login welcome dialog |
| `ui/Badge.jsx`, `ui/Button.jsx`, `ui/Card.jsx`, `ui/Input.jsx`, `ui/Loader.jsx`, `ui/Modal.jsx`, `ui/Toast.jsx` | Shared UI primitives |

---

## Frontend Hooks

| Hook | API calls | Backend |
|------|-----------|---------|
| `useAuth.js` | `/auth/login`, `/auth/me`, `/auth/google/token` | Node |
| `useBatches.js` | `/api/batches`, `/api/batches/:id`, `/api/batches/:id/dispatch`, `/api/batches/:id/note`, `/api/batches/:id/raw-material`, `/api/batches/:id/restore`, `/api/batches/archived`, `/api/batches/:id/scans` | Node |
| `useDispatch.js` | `/api/dispatch/fefo` | Node |
| `useInspections.js` | `/api/inspections`, `/api/inspections/:id`, `/api/inspections/batch/:batchId` | Node |
| `useImport.js` | `/api/import/schema`, `/api/import/validate`, `/api/import/commit`, `/api/import`, `/api/import/:id/rollback` | Node |
| `useNotifications.js` | `/api/notifications`, `/api/notifications/:id/read`, `/api/notifications/read-all` | Node |
| `useMessages.js` | `/api/messages` | Node |
| `useProducts.js` | `/api/products` | Node (cross-collection read via Mongoose) |
| `useSocket.js` | Socket.IO to `VITE_API_BASE_URL` | Node (Socket.IO server) |
| `useAIAudit.js` | `/api/ai/dispatch-audit` | Node |
| `useTrace.js` | `/api/qr/trace/t/:token`, `/api/qr/trace/:batchCode` | Node |
| `useSettingsMutation.js` | `/auth/me/settings` | Node |
| `useTheme.js` | No API — localStorage only | Frontend-only |

---

## Frontend Context / Config

| File | Purpose |
|------|---------|
| `context/AuthContext.jsx` | JWT token stored in localStorage, provides `user`, `login`, `logout` |
| `context/SettingsContext.jsx` | Theme/palette preferences |
| `context/WalkthroughContext.jsx` | Walkthrough tour state |
| `config/firebase.js` | Firebase SDK init (present but **not used** in production flow — see discrepancies) |
| `config/walkthroughSteps.js` | Tour step definitions |
| `services/firestoreService.js` | Firestore read/write helpers — **unused** in all hooks |
| `utils/csvParser.js` | Client-side CSV parser utility |

---

## Backend A — Node.js/Express (Intended Product)

### Controllers
| File | Routes | Classification |
|------|--------|---------------|
| `auth.controller.js` | login, requestAccess, activate, verifyOtp, resendOtp, forgotPassword, verifyResetOtp, resetPassword, listRequests, approve, reject, resendInvite, removeRequest, getDirectory, listUsers, listDeletedUsers, toggleUserStatus, changeRole, restoreUser, deleteUser, linkGoogle, unlinkGoogle, getMe, updateProfile, updateSettings, changePassword, logoutAll, getLoginHistory | Node-backed |
| `googleAuth.controller.js` | googleLogin | Node-backed |
| `batches.controller.js` | createBatch, getAllBatches, getBatchById, recordDispatch, updateBatchNote, updateRawMaterial, getArchivedBatches, softDeleteBatch, restoreBatch, getBatchScans | Node-backed |
| `dispatch.controller.js` | getFEFOQueue | Node-backed |
| `inspection.controller.js` | createInspection, listInspections, getById, getByBatch, myInspections | Node-backed |
| `import.controller.js` | getImportSchema, mapHeaders, validateImport, commitImport, listImports, getImport, rollbackImport | Node-backed |
| `notifications.controller.js` | list, markRead, markAllRead | Node-backed |
| `products.controller.js` | list products from shared `products` collection | Node-backed |
| `qr.controller.js` | trace by token, trace by batchCode | Node-backed |
| `ai.controller.js` | runAudit | Node-backed |

### Models
| File | Collection |
|------|-----------|
| `User.model.js` | `users` |
| `Batch.model.js` | `batches` |
| `Inspection.model.js` | `inspections` (30-day TTL) |
| `AccessRequest.model.js` | `accessrequests` |
| `ImportJob.model.js` | `importjobs` |
| `LoginEvent.model.js` | `loginevents` |
| `Message.model.js` | `messages` |
| `Notification.model.js` | `notifications` |
| `ScanEvent.model.js` | `scanevents` |

### Routes
| Route file | Mount point |
|-----------|------------|
| `auth.routes.js` | `/auth` |
| `batches.routes.js` | `/api/batches` |
| `dispatch.routes.js` | `/api/dispatch` |
| `inspection.routes.js` | `/api/inspections` |
| `import.routes.js` | `/api/import` |
| `notifications.routes.js` | `/api/notifications` |
| `messages.routes.js` | `/api/messages` |
| `products.routes.js` | `/api/products` |
| `qr.routes.js` | `/api/qr` |
| `ai.routes.js` | `/api/ai` |

### Services
`aiService.js`, `emailService.js`, `expiryCalculator.js`, `googleIdentity.js`, `loginHistory.service.js`, `notificationService.js`, `qrGenerator.js`, `sharedStore.js`

### Utilities
`batchCodeGenerator.js`, `productContract.js`, `traceToken.js`

### Scripts
`seedRichData.js`, `seedTestBatch.js`, `seedUsers.js`, `setSuperAdmin.js`, `backfillTraceTokens.js`

### Tests
`expiryCalculator.test.js`, `googleIdentity.test.js`, `messageRetention.test.js`, `rbac.test.js`, `sessionRevocation.test.js`, `sharedStore.test.js`, `traceToken.test.js`

---

## Backend B — Spring Boot Java (`tracex-backend/`)

**Classification: Partial port. Not connected to the frontend. More complete than HANDOFF implied.**

Source: `Get-ChildItem tracex-backend/src -Recurse` (2026-10-02).

### Controllers confirmed in Spring source
| File | Routes exposed |
|------|---------------|
| `BatchController.java` | CRUD, dispatch, soft-delete, restore |
| `DispatchController.java` | FEFO queue |
| `InspectionController.java` | POST /api/inspections, GET /api/inspections/batch/:batchId |
| `TraceController.java` | Public trace endpoint |

**No Spring controller for**: AI audit, bulk import, notifications, login history, messages, access-request approval.

### Models confirmed in Spring source
`Batch.java`, `BatchStatus.java`, `ChecklistItem.java`, `Inspection.java`, `InspectionStatus.java`, `InspectorRef.java`, `QualityCheck.java`, `AccessRequest.java`, `RequestStatus.java`, `User.java`, `Role.java`, `ScanEvent.java`, `ScanSource.java`

### Role enum (Spring)
Source: `tracex-backend/src/main/java/com/tracex/model/Role.java` lines 10–15.
Five values: `ADMIN`, `MANAGER`, `FACTORY_MANAGER`, `QUALITY_INSPECTOR`, `DISPATCH_COORDINATOR`. No `super-admin` enum — the `isSuperAdmin` flag is a Node.js concept only.

### Security (Spring)
Source: `SecurityConfig.java` lines 48–56.
Public (permitAll): `POST /auth/login`, `GET /api/batches`, `GET /api/batches/{id}`, `GET /api/batches/{id}/qr`, `GET /api/dispatch/fefo`, `GET /trace/t/**`.
CORS: `allowedOriginPatterns(List.of("*"))` — permissive wildcard. Source: `SecurityConfig.java` line 83.

### InspectionController — HANDOFF discrepancy resolved
HANDOFF claimed inspection was absent from Spring. **Contradicted**: `InspectionController.java` exists with POST (quality-inspector/admin guard) and GET by batch. Source: `InspectionController.java` lines 34–63.

---

## Duplication / Obsolescence

| Item | Status |
|------|--------|
| `tracex-backend/` Spring Boot | Partial port; wired to same DB; no AI/import/notifications/login-history/messages |
| `frontend/src/config/firebase.js` | Present but unused — Firebase never called from any hook |
| `frontend/src/services/firestoreService.js` | Dead code |
| `frontend/src/pages/ComponentShowcase.jsx` | Developer-only, never linked in production nav |
| `intern-2/` planning docs | Documentation only, no code |
