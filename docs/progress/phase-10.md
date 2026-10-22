# Phase 10: Notifications and Live Updates (M-09)

**Status**: COMPLETE  
**Date**: 2026-10-22  
**Baseline**: `582` backend tests, `98` frontend unit tests (`16` files), `43` Playwright E2E tests (`6` files)  
**Phase 10 Totals**: `618` backend tests (`+36`: `+28` in `RbacMatrixTest`, `+8` in `NotificationTests`), `104` frontend unit tests (`17` files, `+6`), `45` Playwright E2E tests (`7` files, `+2` in `phase10.spec.ts`), `0` failures  
**New Dependencies Added**: None (`0` backend, `0` frontend)

Phase 10 builds M-09, the last unbuilt Must-have: in-app notifications and SSE live updates (D-4, SPEC §8.5). Role-channel messages and record comments (S-05, a Should-have with no rows in `docs/permission-matrix.csv` yet) moved to Phase 10.1 so this change stays reviewable.

## Decisions Taken (defaults posted in the project thread, 22 Oct 2026)

| Topic | Decision |
|---|---|
| Who is notified | New batch: `quality-inspector`, `dispatch-coordinator`, `manager`, `admin`. Import finished: the importer, plus the new-batch roles when batches were added. Dispatch: `factory-manager`, `manager`, `admin`. Inspection: `factory-manager`, `manager`, `admin`, `dispatch-coordinator`. New access request: `admin`. A super-admin also receives `admin` notifications. Nobody is notified about their own action. |
| Read state | Per user (`readBy`), not the reference's single shared `read` flag. |
| Live updates | One stream per signed-in tab. Lists, the dashboard and the bell refresh without a reload; stored notifications also show a toast. The stream closes when the user is deactivated, deleted or their sessions are revoked. |
| Retention | 7 days (TTL index), as in SPEC §4. |

---

## Part A: Backend

- `model/Notification.java`: `recipientRoles[]`, `recipientUserId`, `type`, `title` (120), `message` (400), `refType`, `refId`, `triggeredBy`, `readBy[]`, `createdAt` (TTL `createdAt_ttl_idx`, 604,800 s).
- `service/NotificationService.java`: event methods (`batchCreated`, `batchDispatched`, `inspectionCompleted`, `importFinished`, `accessRequestSubmitted`), live-only `broadcastChange`, `listFor`, `markRead`, `markAllRead`. A failure is logged with the exception class only and never fails the action that raised it. No message contains `farmerName` (D-9).
- `service/NotificationStreamRegistry.java`: `SseEmitter` per connection (30-minute timeout), a `ready` first frame, and a 25-second heartbeat that re-reads the user and closes the stream on deactivation, deletion or a `tokenVersion` change.
- `controller/NotificationController.java`: the four Phase 10 endpoints. `BatchController`, `InspectionController`, `ImportController` and `AuthController` raise the events after the action succeeds.
- `SecurityConfig.java`: permits `DispatcherType.ASYNC`, the dispatch that ends an SSE response after the original request was authenticated.
- `RbacMatrixTest` (`413`), `RouteCoverageTest` and `OpenApiExportTest` (`59` active rows) now include Phase 10. OpenAPI regenerated.
- `NotificationTests.java` (`8` tests): watchers notified and creator not (no farmer name stored); read state per user; read-all scoped to the caller and `404` on someone else's notification; failed inspection mentions quality hold; super-admin with a `factory-manager` role receives admin notifications; **TEST-M-09** stream receives `batch:created`; stream closes after session revocation; TTL index.

## Part B: Frontend

- `src/lib/eventStream.ts`: `parseSseChunk` and `openEventStream` (reconnects with backoff from 1 s to 30 s; stops on 401 or 403).
- `src/api/client.ts`: `openAuthorizedStream`, so every network call still goes through the API client (ESLint `no-restricted-globals`).
- `src/hooks/useLiveUpdates.ts`, mounted in `AppShell.tsx`: maps each event to the queries it makes stale and shows a toast for stored notifications.
- `src/layouts/NotificationBell.tsx`: top-bar bell with the unread count and an accessible label.
- `src/features/notifications/NotificationsPage.tsx` (`/notifications`): list, Open link, mark one or all as read. Nav entry added (`bell` icon).
- `Notifications.test.tsx` (`6` tests): SSE parsing, stream delivery and 401 stop, live event handling, read and read-all, bell count, links.
- `e2e/phase10.spec.ts` (`2` tests; the first run failed P10-E2E-02 because it matched notifications by batch code, and earlier suites' cleanup scripts reset the code counter so codes repeat; it now matches by batch id): the inspector's bell and toast update live when the factory manager creates a batch (no reload, no farmer name, axe clean), then read-all clears the bell; the creator is not notified about their own batch.

## Part C: Documentation

`SPEC.md` (§4 `notifications`, §6.3 Notifications, §8.5), `docs/06-ui/screen-map.md` (row 59), `docs/traceability.md` (M-09 PASS), `PROGRESS.md` (Phase 10 row, new Phase 10.1 row) and a correction note in `docs/progress/phase-08.md` decision 9, which claimed an import notification and audit actions that the code never had.

---

## Verification

### Verification 1: Backend clean verify (`618` tests, `0` failures)

```text
[INFO] Tests run: 618, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

### Verification 2: Frontend checks and unit tests

`npm run lint`, `npm run typecheck`, `npm run check:banned`, `npm run check:api-drift` and `npm run check:permissions-drift` exit `0`; `npx vitest run`:
```text
 Test Files  17 passed (17)
      Tests  104 passed (104)
```

### Verification 3: Playwright full E2E run

Same procedure as Phase 8.2 Verification 4 (`playwright-full.txt`):
```text
  45 passed (3.5m)
```

### Verification 4: Markdown table linter

```text
Files checked: 41
Errors: 0
Warnings: 0
STATUS: PASSED (Zero problems found)
```
