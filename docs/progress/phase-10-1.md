# Phase 10.1: Role-Channel Messages and Record Comments (S-05)

**Status**: COMPLETE  
**Date**: 2026-10-22  
**Baseline**: `618` backend tests, `104` frontend unit tests (`17` files), `45` Playwright E2E tests (`7` files)  
**Phase 10.1 Totals**: `676` backend tests (`+58`: `+49` in `RbacMatrixTest`, `+9` in `MessageTests`), `108` frontend unit tests (`18` files, `+4`), `47` Playwright E2E tests (`8` files, `+2` in `phase10-1.spec.ts`), `0` failures  
**New Dependencies Added**: None (`0` backend, `0` frontend)

Phase 10.1 adds S-05, split out of Phase 10: one chat channel per role, and comments on batches and inspections. The rules are ported from the reference at `TracX-Hemshakti(Build)` (`backend/src/controllers/messages.controller.js`, `backend/src/models/Message.model.js`, `backend/src/routes/messages.routes.js`).

## Decisions Taken (defaults posted in the project thread, 22 Oct 2026)

| Topic | Decision |
|---|---|
| Channels | One per role. A user opens their own role's channel; a super-admin opens all five (reference `channelsFor`). Messages expire after 90 days. There is no company-wide channel. |
| Record comments | On batches and inspections, kept permanently. Batch threads are open to every role. Inspection threads follow `GET /api/v1/inspections`, so `dispatch-coordinator` is refused (deviation: the reference let every signed-in user in). |
| Edit and delete | Edit: author only, previous text kept in `editHistory`. Delete: author, `admin` or super-admin, soft delete that keeps the slot and hides the body. A message in a conversation the caller cannot open is a `404`. |
| Live updates | `message:new` is pushed (ids only) to users who can open that conversation. No bell notification is stored, so the bell stays for business events. |
| Permission matrix | 7 new rows, phase `10`, with per-conversation rules in the notes. |

---

## Part A: Backend

- `model/Message.java`: `scope`, `refType`, `refId`, `channelRole`, `body` (2,000), author fields, `editHistory[]`, soft-delete fields, `expiresAt` (TTL `expiresAt_ttl_idx`, `expireAfterSeconds 0`; null means kept forever), plus `record_thread_idx` and `channel_feed_idx`.
- `service/MessageService.java` and `controller/MessageController.java`: the 7 endpoints. Validation errors are `422 VALIDATION_ERROR` with field errors (the reference used `400`).
- `docs/permission-matrix.csv`: 7 rows; `src/auth/permissions.generated.ts` regenerated (`69` rules). `RbacMatrixTest` `462`, `RouteCoverageTest` and `OpenApiExportTest` `66` active rows. OpenAPI regenerated.
- `MessageTests.java` (`9` tests): channel visibility and super-admin access; feed order, 90-day expiry and channel activity; permanent batch comments; inspection thread refused for coordinators, unknown record `404`, wrong type `422`; body validation; author-only edit with history; soft-delete rules and `409` on editing a deleted message; `404` for a message in a channel the caller cannot open; TTL index.

## Part B: Frontend

- `features/messages/MessageThread.tsx`: shared list and composer (2,000-character limit with a counter), Edit for the author, Delete for the author or a moderator, "Message deleted" for removed messages, "(edited)" marker.
- `features/messages/MessagesPage.tsx` (`/messages`): opens your channel directly; a super-admin gets one tab per channel with message counts.
- `features/messages/RecordComments.tsx`: on the batch detail page (Comments section) and in the inspection record dialog.
- `features/messages/useMessageActions.ts`, `api/endpoints.ts`, `api/types.ts`, `useLiveUpdates.ts` (`message:new`), Messages nav entry (`MessageSquare` icon).
- `BatchDetailPage.test.tsx` now stubs the comments fetch so its own error-state assertions stay unambiguous.
- `Messages.test.tsx` (`4` tests) and `e2e/phase10-1.spec.ts` (`2` tests): an admin's channel message reaches a super-admin's open page without a reload (axe clean); a batch comment is saved and survives a reload; a coordinator gets `403` on an inspection thread. `afterAll` soft-deletes what the suite posted.

## Part C: Documentation

`SPEC.md` (§4 `messages` build notes, §6.3 Messages table), `docs/06-ui/screen-map.md` (row 60), `docs/traceability.md` (new S-05 row) and `PROGRESS.md`.

---

## Verification

### Verification 1: Backend clean verify (`676` tests, `0` failures)

```text
[INFO] Tests run: 676, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

### Verification 2: Frontend checks and unit tests

`npm run lint`, `npm run typecheck`, `npm run check:banned`, `npm run check:api-drift` and `npm run check:permissions-drift` exit `0`; `npx vitest run`:
```text
 Test Files  18 passed (18)
      Tests  108 passed (108)
```

### Verification 3: Playwright full E2E run

Same procedure as Phase 8.2 Verification 4 (`playwright-full.txt`). A first run was started while `npx vitest run` was also running in `frontend/`; the Vite server Playwright had started stopped answering partway through and 21 tests failed with `ERR_CONNECTION_REFUSED` (plus one image-toggle assertion). The suite was rerun on its own with nothing else running:
```text
  47 passed (3.7m)
```

### Verification 4: Markdown table linter

```text
Files checked: 43
Errors: 0
Warnings: 0
STATUS: PASSED (Zero problems found)
```
