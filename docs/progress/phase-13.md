# Phase 13: Testing and Hardening

**Status**: COMPLETE (awaiting review before commit)  
**Date**: 2026-10-23  
**Baseline**: backend `723` tests, frontend `116` unit tests (`20` files), `48` Playwright E2E tests (`9` files)  
**Phase 13 Totals**: backend `735` tests (`+12`, `HardeningTests`), `0` failures; frontend `116` unit tests (`20` files, unchanged); Playwright ``48` passed (`9` files)`  
**New Dependencies Added**: `jacoco-maven-plugin` `0.8.12` (build plugin only, not shipped)

Phase 13 works through `OI-12`, the findings of the strict review (19 Oct 2026) that Phase 8.2 left open: `M1` to `M14` and `H10`. `H11` (CSP headers) stays in Phase 14 with the deployment.

## Part A: Fixes

| ID | Problem | Fix |
|---|---|---|
| M1 | Dispatch checked the quality hold before its atomic update, so an inspection that turned `FAILED` in between still let the batch go | `qualityCheck.status != FAILED` is part of the atomic dispatch filter in `BatchService`; a refused update reports `QUALITY_HOLD` |
| M2 | Check-then-act races: one invitation link could create two accounts; a second account could be made for an email that already had one; two chunks of one import saved at once could lose batch ids, so rollback missed batches | `UserService.activateAccount` refuses an email that already has an account (`409 CONFLICT`) and claims the invitation with one atomic update before creating the account (given back if the save fails). `ImportService.claimChunk` locks a running job for one chunk at a time (`ImportJob.chunkLockedAt`, `409` for a second chunk, a lock older than 2 minutes is ignored) |
| M3 | `?page=abc`, `?limit=0` or a huge `limit` reached the database or failed with `500` | `page >= 1` and `limit` `1` to `500` are checked (`422` on that field); `GlobalExceptionHandler` maps type mismatches to `422` and duplicate keys to `409` |
| M4 | The paginated list shape in SPEC §6.1 did not match the built API | SPEC now shows the built shape (list fields inside `data`) and the paging limits; no API change, so the frontend and OpenAPI are unchanged |
| M5 | SPEC §7 promised a global limit of 500 requests per address per 15 minutes; none existed, and the in-memory limiter never forgot an address | `GlobalRateLimitFilter` (every `/api/` request except `OPTIONS`, `429 RATE_LIMITED` with `Retry-After`; `tracex.rate-limit.global`, `5000` in `dev`, very high in `test` and `e2e`). `RateLimiter` drops buckets idle for over an hour every 1000 calls |
| M6 | `GET /api/v1/batches/{id}` returned archived batches (farmer name included) to every role, while the archive list is admin-only | Archived batches are `404` by id except for admins (`BatchController`) |
| M7 | The FEFO queue read every active batch and filtered by SKU and category in memory | The SKU and category filters are part of the MongoDB query (`FefoService`, case-insensitive exact match) |
| M8 | Batch actions recorded audit entries as `anonymous` (only the username was passed) and used the wall clock | `AuditService` looks up the user id from the username and takes the time from the injected `Clock` |
| M9 | Anyone could label a public scan "factory" or "QA", and scan IP hashes used the trace-token key itself, exposed through a public getter | Only a signed-in user's scan keeps its label; anonymous scans are always `buyer`. IP hashes use a key derived for that purpose (`TraceTokenService.keyedHash`); the key getter is gone |
| M10 | Two authorization styles: `@PreAuthorize` in some controllers, hand-written role checks in others | Every per-endpoint role rule is `@PreAuthorize` with a named rule from `security/Roles.java`; the hand-written checks in `BatchController`, `ImportController` and `InspectionController` are removed. `RbacMatrixTest` (all roles, all rows) passes unchanged |
| M11 | Any client `X-Request-Id` was copied into logs and audit entries | Only `8` to `64` letters, digits, `-` and `_` are kept; anything else gets a new UUID (`RequestIdContext`) |
| M12 | The inspection "latest" lock is in-process only | Documented, not changed: correctness across instances already comes from the partial unique index `batchId_isLatest_unique_idx` (a second "latest" write fails and is retried); the lock only orders writes inside one instance, and TraceX runs as one instance |
| M13 | The JWT was parsed and verified three times per request | `JwtAuthFilter` parses once and reads the subject and token version from the same claims |
| M14 | `.env.example` advised a forwarded-headers setting that trusts any proxy | `SERVER_FORWARD_HEADERS_STRATEGY=native` with a note on when to change it |
| KL-01 | Future `packDate` accepted | Kept as is (`D-23`); still listed under Known Limitations for the team to decide |

### Not done, and why

- **Database-level unique index on `users.email`**: tried, then removed. The demo seed and several existing tests reuse emails across accounts, and on an existing database with duplicates the index would either fail to build or make the seed fail at startup. The activation check above refuses new duplicates; Google sign-in already has a unique `googleEmail`. Revisit once the seed data is cleaned up.
- **Optimistic `@Version` on `ImportJob`**: replaced by the chunk lock, because old import jobs without a version field would be treated as new documents and fail to save.

## Part B: Continuous Integration and Coverage (H10)

- `.github/workflows/ci.yml`: on every push to `main` and every pull request. **Backend job**: Java 21 with a MongoDB 7 service container, `mvnw verify` (all backend tests plus the coverage report), report uploaded as the `backend-coverage` artifact. **Frontend job**: Node from `.nvmrc`, `npm ci`, lint, typecheck, banned-pattern, API-drift, permissions-drift and contrast checks, `vitest run`.
- Playwright stays a local step: it needs the full stack, the seed and the backend restart in `E2E-08`.
- `backend/pom.xml`: JaCoCo writes `target/site/jacoco/index.html` on `mvnw verify`. No minimum is enforced yet. First report: **87.7% of lines, 71.5% of branches, 87.5% of instructions**.
- The workflow has not run on GitHub yet; it runs on the first push after this phase is committed.

## Tests

`HardeningTests.java` (`12` tests): invitation used once; invitation for an existing email refused and left unused; import chunk lock and stale-lock takeover; bad `page` and `limit` return `422`; global limit returns `429` with `Retry-After` and skips non-API paths; idle buckets swept; archived batch `404` for a manager and `200` for an admin; audit entry resolves the actor id; keyed hash separated by purpose; anonymous scan stored as `buyer`, staff scan keeps `factory`; unsafe request ids replaced; malformed and tampered tokens `401`.

---

## Verification

### Verification 1: Backend clean verify

`.\mvnw.cmd clean verify` with the local MongoDB:
```text
[INFO] Tests run: 735, Failures: 0, Errors: 0, Skipped: 0
[INFO] --- jacoco:0.8.12:report (report) @ tracex-backend ---
[INFO] BUILD SUCCESS
```

### Verification 2: Frontend checks and unit tests

`npm run lint`, `npm run typecheck`, `npm run check:banned`, `npm run check:api-drift`, `npm run check:permissions-drift` and `npm run check:contrast` exit `0`; `npx vitest run`:
```text
 Test Files  20 passed (20)
      Tests  116 passed (116)
```

### Verification 3: Playwright full E2E run

Same procedure as Phase 8.2 Verification 4, backend started from the Phase 13 jar:
```text
  48 passed (4.6m)
```

### Verification 4: Markdown table linter

```text
Files checked: 47
Errors: 0
Warnings: 0
STATUS: PASSED (Zero problems found)
```
