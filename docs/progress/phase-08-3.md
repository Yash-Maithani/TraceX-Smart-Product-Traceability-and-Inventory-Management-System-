# Phase 8.3: UI Copy Cleanup (No New Features)

**Status**: COMPLETE  
**Date**: 2026-10-22  
**Baseline**: `89` frontend unit tests (`15` files), `39` Playwright E2E tests (`5` files)  
**Phase 8.3 Totals**: `90` frontend unit tests (`15` files, `+1`), `39` Playwright E2E tests (`5` files), `0` failures  
**New Dependencies Added**: None

Phase 8.3 is the small UI pass agreed before Phase 9. It fixes the two copy failures from the UI hard rules audit (21 Oct 2026): internal spec codes shown to users, and em dashes in visible text. The favicon, the Privacy Policy and Terms pages, the custom domain and any animation work stay in Phase 12 as planned. No layout, colour or behaviour changes.

---

## Part A: Internal Spec Codes Removed from Visible Text

| File | Before | After |
|---|---|---|
| `features/auth/ActivatePage.tsx`, `ResetPasswordPage.tsx` | Minimum 8 characters (SPEC §7). | Minimum 8 characters. |
| `features/batches/DispatchDialog.tsx` | Required by D-14/D-18 because... | Required because an earlier-expiring batch of the same SKU is still in the queue. The reason is recorded in the audit log. |
| `features/fefo/FefoPage.tsx` | Excluded from the dispatchable FEFO queue per D-12. Attempting to dispatch returns HTTP 409 BATCH_EXPIRED. | These batches have passed their expiry date and cannot be dispatched. |
| `features/import/ImportPage.tsx`, `csvParser.ts` | ...not accepted (D-5). / ...redacted from preview and logs per D-9. | ...not accepted. / Farmer names are hidden from the preview and never written to logs. |
| `features/inspections/InspectionsPage.tsx` | ...records (D-13, D-15). / ...quality record (D-15). | Every inspection is kept permanently. / Inspections cannot be changed or deleted after they are saved. |
| `features/dashboard/DashboardPage.tsx`, `BatchDetailPage.tsx` | Server-computed freshness... | Freshness and dispatch queue as of {date} / Freshness status and where the raw material came from |

Unused leftovers deleted: `STRINGS.home` ("Phase 5 placeholder"), `STRINGS.publicPages.tracePlaceholder*` ("scheduled for Phase 10") and the unrouted `TracePlaceholderPage`.

## Part B: Em Dashes Replaced

- New `src/lib/format.ts` exports `EMPTY_VALUE = 'Not recorded'` (Yash's choice in the audit doc) and `formatDays(days, unit)`. Every empty-value dash now shows "Not recorded", including `formatBusinessDate` and `formatTimestamp` in `src/lib/dates.ts` and the public trace page.
- Separators use a colon, a comma or a middle dot: `SKU · Product`, `Farmer, Village`, `5: Excellent`, `PASSED (cleared for dispatch)`, `Expired Batches: Blocked from Dispatch`, `Inspection Record: TX-...`, `Ignore this column`.
- Tests that expected the dash were updated (`dates.test.ts`, `PublicTracePage.test.tsx`, `e2e/phase06.spec.ts` farmer and village text).

## Part C: Banned-Pattern Check

`frontend/scripts/check-banned-patterns.mjs` gains rule 10 (no em dash in non-comment lines of `.ts`, `.tsx` and `.html`) and rule 11 (no `(SPEC §`, `(D-n`, `per D-n` or `D-n/D-n` in non-comment lines of `.ts` and `.tsx`), so neither can come back. `ui.test.tsx` · `flags em dashes and internal spec references in user-visible text, but not in comments` plants both and checks that comments are ignored.

---

## Verification

### Verification 1: Frontend checks and unit tests

`npm run lint`, `npm run typecheck` and `npm run check:banned` exit `0` (`frontend-*.txt`). `npx vitest run` (`frontend-unit.txt`):
```text
 Test Files  15 passed (15)
      Tests  90 passed (90)
```

### Verification 2: Playwright full E2E run

Same procedure as Phase 8.2 Verification 4, captured to `docs/progress/evidence/phase-08-3/playwright-full.txt`:
```text
  39 passed (3.1m)
```

### Verification 3: Markdown table linter

```text
Files checked: 39
Errors: 0
Warnings: 0
STATUS: PASSED (Zero problems found)
```
