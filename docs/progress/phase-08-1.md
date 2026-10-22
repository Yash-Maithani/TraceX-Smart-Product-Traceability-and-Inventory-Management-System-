# Phase 8.1: Phase 8 Import Corrections (No New Features)

**Status**: COMPLETE  
**Date**: 2026-10-22  
**Baseline**: `542` backend tests, `88` frontend unit tests (`15` files)  
**Phase 8.1 Totals**: `542` backend tests (`0` new; one existing test gained assertions), `88` frontend unit tests (`15` files), `0` failures  
**New Dependencies Added**: None (`0` backend, `0` frontend)

Phase 8.1 corrects documentation and logging gaps found after Phase 8 closed. No endpoint, schema, or UI behaviour changes.

---

## Part A: `rowErrors` Cap Documentation (`500` -> `200`)

`ImportService.MAX_STORED_ERRORS` is `200` (`backend/src/main/java/com/tracex/service/ImportService.java` line 46), and `SPEC.md` §3.7 already says `200`. Two Phase 8 log entries said `500`:

- `PROGRESS.md` (Phase 8 Part B summary): `500`-entry -> `200`-entry `rowErrors` cap.
- `docs/progress/phase-08.md` (Part A decision 6): capped at `500` -> capped at `200`.

Search evidence before and after: `docs/progress/evidence/phase-08-1/rowerrors-cap-before.txt`, `rowerrors-cap-after.txt`.

## Part B: Stored `ImportJob` Cap Assertion

The existing row-error cap test in `backend/src/test/java/com/tracex/ImportTests.java` only checked the API response. It now also loads the stored `ImportJob` from MongoDB and asserts `rowErrors` has `200` entries and `rowErrorsTruncated == true`, so the cap is proven at the persistence layer.

## Part C: Row-Failure Log Line (No PII, `D-9`)

When a row fails during batch creation at commit, `ImportService` previously recorded the `RowError` silently. It now logs a `WARN` with only the row number, the exception class name, and the request id:

```text
Import row {} failed during batch creation: exceptionClass={}, requestId={}
```

The exception message and row values are not logged, so `farmerName` cannot reach application logs. `ImportTests.testNoFarmerNameInPreviewRowErrorsAuditOrCapturedLogs` still passes.

## Part D: Known Limitations Section

Added a `Known Limitations` section to `PROGRESS.md` recording `KL-01` (future `packDate` accepted on both single-create and import, per `D-23`, to revisit in Phase 13) and `KL-02` (a browser closed mid-import leaves the job `"running"` until the stale window passes, then it becomes `"failed"` and can be rolled back).

---

## Verification

### Backend (`542` tests, `0` failures)

Command:
```powershell
cd backend; .\mvnw.cmd clean verify 2>&1 | Tee-Object -FilePath ..\docs\progress\evidence\phase-08-1\mvnw-clean-verify.txt
```

Output (`mvnw-clean-verify.txt` tail):
```text
[INFO] Tests run: 542, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

The `ERROR` lines from `AppConfig` and `SeedRunner` in the log are expected output of the prod fail-fast tests in `ConfigurationAndSeedTests`.

### Frontend Unit (`88` tests in `15` files, `0` failures)

Command:
```powershell
cd frontend; npx vitest run 2>&1 | Tee-Object -FilePath ..\docs\progress\evidence\phase-08-1\frontend-unit.txt
```

Output (`frontend-unit.txt` tail):
```text
 Test Files  15 passed (15)
      Tests  88 passed (88)
```

### Markdown Table Linter

Command:
```powershell
powershell -ExecutionPolicy Bypass -File scripts\lint-md-tables.ps1 2>&1 | Tee-Object -FilePath docs\progress\evidence\phase-08-1\lint-md-tables.txt
```

Output (`lint-md-tables.txt`): `STATUS: PASSED (Zero problems found)` across `37` Markdown files (`36` before this log was added).
