# Redesign Phase R3: Batches list, batch detail and archived

> Date: 2026-10-24. Not committed (Yash commits). Builds on the uncommitted R1 and R2 work.

## Backend request B-2 (batches part)

- `GET /api/v1/batches` takes optional `expiryFrom` and `expiryTo` (ISO dates, both inclusive).
- A reversed range or a malformed date returns `422`.
- Missing, empty or broken expiry dates never match a range. The query always sets both bounds, `0000-01-01` and `9999-12-31` by default, and expiry dates are stored as `"YYYY-MM-DD"` strings (D-17).
- The range works together with the status, SKU and search filters.
- New `BatchExpiryRangeTests` (4 tests): inclusive range, one-sided ranges with broken dates, the range with a status filter, and the 422 cases.
- OpenAPI re-exported; `gen:api` run; `check:api-drift` passes. No RBAC or route change.

## Batches list (`/batches`)

**Header and switch**
- Count chip with the real total, and Create batch as the only primary action.
- Active / Archived switch. These are two links, not ARIA tabs, because they are two pages.

**Toolbar**
- A search box that waits 250ms after typing stops and replaces the URL instead of adding history (AUDIT: Back no longer steps through every keystroke).
- Status and Product filter chips, an Expiry date-range chip (two date fields, Apply and Clear dates), and "Clear filters" shown only when a filter is active.

**Table**
- Sortable headers (Code, Product, Expires, Quantity) use the existing `sort=field:dir` parameter.
- The new Shelf life column shows the rail.
- Quality shows "On hold" for a failed latest inspection.
- Codes and dates never wrap. Quantity is right-aligned with tabular figures.

**Empty states**
- "No batches match these filters" with Clear filters.
- A first-run state for an empty database, worded for the user's role.

**Phones:** cards trimmed to the code, badges, product, rail and quantity.

## Archived (`/batches/archived`)

- Shares the Active / Archived switch.
- The archived endpoint returns the whole list, so search (code, product, SKU, reason) and paging of 20 run in the browser.
- New copy; the middle-dot meta string is gone.

## Batch detail (`/batches/:id`)

**Header strip**
- Code, product, status, On hold when held, the shelf-life rail and the quantity.
- Print, Correct details and Archive are quiet buttons (Archive in red text); Dispatch is the one primary.
- The planned overflow menu was not used: quiet buttons keep one click and the existing test ids.

**History timeline** (new, main column)
- Shows the pack date, note edits, every inspection (coloured by verdict), every dispatch (out-of-order ones show their reason) and the last scan, newest first.
- Uses data the page already loads; no new requests.

**Layout**
- Main column: History, Inspections, Dispatches, Comments.
- Side column: Details, Latest inspection, QR code, Scans, Traceability note.
- The duplicate badges are gone from Details, and the verdict reads "Passed", not "PASSED".

**Print**
- Print gives an A4 batch sheet without the app frame or buttons.
- Print label gives a 50 x 30 mm label with the QR code, code, product and best-before date.
- Both print black on white in every theme (print token overrides in `tokens.css`).

**Unsaved changes**
- `beforeunload` warns while the note or the correction form has unsaved edits.
- Closing the correction dialog with edits asks "Discard your changes?".

**Copy:** all in `strings/batchDetail.ts`. Gone: "Cryptographic public traceability link", "Embedded verdict snapshot", "Append-only", "soft-deletes", "Archive Batch". New archive confirm: "Archive TX-...? It leaves the batch list and the dispatch queue, and its QR link stops working."

## Tests

| Suite | Result |
|---|---|
| Backend (`mvnw clean verify`) | **740** run, 0 failures (+4) |
| Frontend unit | **132** passed in 21 files (batches tests now cover chips, the debounced search, header sort, the date range, the timeline order and the discard guard) |
| Playwright | **48** passed |
| lint, typecheck, `check:banned`, `check:contrast` (212), `check:backdrops`, `check:api-drift` | all pass |

Test updates:
- Unit tests: the status filter is a chip; archive copy now reads "Reason for archiving" and "Archive batch"; the scans empty state now reads "No scans yet".
- `e2e/phase06.spec.ts`: the status chip text, the archive dialog labels, and the verdict text "Passed".

## Reviews on changed pages

- **web-review and design-critique** (`docs/screenshots/after/`):
  - The list reads left to right as code, product, status, shelf life, then date.
  - The detail page answers "what happened to this batch" in the History panel at the top.
  - Left for R7: the Origin column can still scroll sideways inside the table at 1366px.
- **accessibility-review**:
  - axe found no serious or critical issues on the list, the filtered list, archived and detail, in light and dark, at 1366px and 390px. It was re-checked with reduced motion after the first scan flagged contrast while the theme transition was still running.
  - Filter chips and the date range return focus on Escape.
  - Timeline badges have text alternatives.
  - Neither width has horizontal overflow.

## HARD UI RULES check

All of rules 1 to 8 pass. In particular:
- Rule 3: counts come from the API.
- Rule 6: the gate is clean.
- Rule 7: no new motion.

Rule 9 is unchanged: the custom domain is still not connected.
