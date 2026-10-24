# Redesign Phase R5: Dispatch queue, dispatch dialog, inspections and import

> Date: 2026-10-24. Not committed (Yash commits). Builds on the uncommitted R1 to R4 work.

## Dispatch queue (`/fefo`)

- Title "Dispatch queue". The header line gives the real counts: "N ready, N expired, N missing an expiry date".
- **Tabs:** Ready to ship, Expired and Missing expiry, each with a count. The open tab is kept in the URL (`?tab=`). These replace the numbered sections "1. 2. 3.".
- **Filters:** Category and Product filter chips plus "Clear filters", in place of the two full-width selects.
- **Table columns:** Order (#rank), Batch (code, product, SKU), Shelf life rail, Expires (date and freshness label), Quality and Dispatch.
- **Next for this product:** the first batch per product that is not on hold, in the server's order, is tagged "Next for this product" and gets the primary Dispatch button. Every other row gets a secondary button. The grouping lives in `features/fefo/queueModel.ts`; the order itself is never computed on the page.
- **On hold:** a batch whose latest inspection failed shows the On hold badge. Its Dispatch button is disabled, with the reason written next to it: "Latest inspection failed. Record a new inspection to release it."
- The Expired and Missing expiry tabs each explain what to do next ("Expired N days ago" uses the shared shelf-life wording).
- Phones show the same rows as cards.

## Dispatch dialog

- **Summary line:** "Expires Oct 25, 2026 (1 day left). Quality: Passed."
- **Plain errors:** each error code gets a plain title, for example "Another batch of this product expires sooner". The out-of-order message names the batch that expires sooner and gives two choices: "Dispatch TX-… first, or give a reason to ship this one now." The code stays on the banner as `data-error-code` for tests and support.
- **Out of order:** the title becomes "Dispatch TX-… out of order?". The reason field is labelled "Reason for shipping out of order" with the hint "Saved in the audit log", and the button reads "Dispatch with reason".
- **Blocked before sending:** an on-hold or expired batch is stopped before any request is sent. The dialog shows why, and the fields and button are disabled. The batch detail page also disables its Dispatch button and shows the reason beside it. The server rules (409 `QUALITY_HOLD` / `BATCH_EXPIRED`) are unchanged and still covered by the browser tests through the API.

## Inspections (`/inspections`)

- **Backend B-2 (approved), inspections part:**
  - `GET /api/v1/inspections` and `GET /api/v1/inspections/my` take optional `from` and `to`. These are inclusive business dates in the business timezone, applied to when the inspection was recorded.
  - A reversed range or a malformed date returns 422.
  - New `InspectionDateRangeTests` (3 tests).
  - OpenAPI re-exported, `gen:api` run, `check:api-drift` passes.
- **Bug fixed:** `fetchMyInspections` expected a plain list, but the server returns a page (`{ data, total, ... }`), so the "My inspections" tab could not show its rows. It now reads the page, and the endpoint test covers it.
- **Tabs and filters:**
  - Tabs "Latest per batch" and "Recorded by me", each with a count.
  - A Verdict filter chip and a "Recorded" date range chip (the new shared `DateRangeChip`, also used by Batches).
  - Tab and filters are kept in the URL, so the dashboard's `?verdict=FAILED` link still works.
- **Empty states:** separate ones for first use, for "Recorded by me" and for no matches (with Clear filters).
- **Record dialog:**
  - Plain verdict options ("Failed: the batch goes on hold").
  - The checklist is a two-column grid of the 8 checks.
  - Inline guard: "A Passed verdict needs every checked item to pass." The server still decides.
- **Read-only record:** shows the checklist as a list with Pass, Fail or Not checked.

## Import (`/import`)

- **Title and steps:**
  - The page is now titled "Import batches from CSV".
  - The step list (Upload, Match columns, Check rows, Import, Done) is an ordered list with `aria-current="step"` and visible done, current and upcoming states.
  - Bug fixed: the done style used tokens that do not exist (`--status-ready-*`), so done steps had no colour.
- **Column names, not field ids:**
  - Columns show human names only. The exact header ids for CSV authors sit behind "Exact column names for the CSV header".
  - Missing-column warnings and row errors name the column ("Quantity Produced"), never the field id (`quantityProduced`).
- **Check rows:**
  - Error rows are listed first, then duplicates, then rows to import.
  - Filter chips show counts.
  - Tables have a hidden caption and column scopes.
- **Undo:**
  - "Rollback" is now "Undo import" (a quiet button in the row, red only in the confirm).
  - The confirm names the file and time and gives the count of batches it archives, with the buttons "Undo import" and "Keep import".
- **Leave warning (RD-2):** the browser warns before leaving while columns are matched, rows are checked or an import is saving.
- **Plain progress wording:** "Part 2 of 2 failed" in place of "Chunk", with no job ids in sentences.

## Shared

- `PageHeader` meta text and banner action notes take the over-photo colour inside a banner (`--meta-text`). A plain meta line on the FEFO banner was failing contrast before this fix.
- New strings files: `strings/fefo.ts`, `strings/inspections.ts` and `strings/import.ts`. `DATE_RANGE_STRINGS` was added to `strings/common.ts`.

## Found during R5

- **B-3 (approved by Yash and done):** the server's out-of-order check (`FefoService.findEarlierEligibleBatchForSameSku`) used to count an on-hold batch as "earlier eligible". So when the earliest batch of a product was on hold, shipping the next one asked for an override reason, even though the held batch cannot be shipped. Held batches (latest verdict FAILED) are now skipped in that check. The held batch itself is still refused with `QUALITY_HOLD`. New test: `InspectionAndDispatchTests.testHeldEarlierBatchDoesNotForceOverride`. No API contract change.
- **RD-3 (still open):** dev data has two batches coded TX-2026-10-003 with different products (seen again on Inspections).

## Tests

- **Unit (137):**
  - `queueModel.test.ts` (new).
  - The FEFO test now covers tab counts, next per product, a held row disabled with its note, and the tabs.
  - The import test checks errors-first ordering and column names in messages.
  - The endpoints test covers the page shape for My inspections.
- **Backend (744):** includes the new `InspectionDateRangeTests` (3) and the B-3 test.
- **Playwright (49):**
  - `phase06` now expects a disabled Dispatch button with its reason for held and expired batches, and still asserts the server's 409 through the API.
  - The FEFO product filter uses the chip.
  - The out-of-order banner is checked by `data-error-code`.
  - `phase08` uses "Undo import" and the "Undone" status; `phase11` uses the new heading.
- **Checks:** lint, typecheck, check:banned, check:contrast (212), check:backdrops and test:a11y all pass. Axe shows no serious or critical issues on the dispatch queue, the dispatch dialog, a held batch, inspections, the record dialog and import, at 1366 and 390, light and dark.
