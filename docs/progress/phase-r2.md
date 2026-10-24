# Redesign Phase R2: Dashboard, notifications and messages (plus R1 follow-ups)

> Date: 2026-10-24. Baseline: commit `2587835` plus the uncommitted R1 work. Not committed (Yash commits).
> Yash's answers on 2026-10-23: IBM Plex yes (D-25); photos only on sign-in and QR pages, "for now but might change" (D-20 change); backend requests B-1 and B-2 "if you want". B-1 is done here; B-2 (date filters) is planned for R3 and R4.

## R1 follow-ups

| Change | Files |
|---|---|
| **D-25 fonts.** IBM Plex Sans 400/500/600 and IBM Plex Mono 400/500, latin subset, from `@fontsource/ibm-plex-sans` and `@fontsource/ibm-plex-mono` 5.3.0 (SIL OFL 1.1, exact versions). Vite bundles the WOFF2 files (about 100 KB in all), so there are no outside font requests. `--weight-bold` is now 600 because 700 is not loaded. | `frontend/package.json`, `src/main.tsx`, `src/styles/tokens.css` |
| **D-20 change.** Signed-in pages no longer draw a photo banner. One switch, `SIGNED_IN_PAGE_BANNERS = false` in `src/routes/backdrops.ts`, turns them back on; pages still pass their keys and all 14 assets stay. Sign-in pages (side) and the public trace page (full) keep their photos. | `src/routes/backdrops.ts`, `components/ui/States.tsx` |
| `ButtonLink`: a link styled as a button, so navigation is no longer a button nested inside a link. | `components/ui/ButtonLink.tsx`, `ui.module.css` |

## Backend request B-1: dispatched today

- `GET /api/v1/dashboard/summary` returns `dispatchedToday`: non-archived batches with a dispatch entry on today's business date (an exact `"YYYY-MM-DD"` match, D-17). A batch dispatched twice today counts once.
- New test `DashboardSummaryTests.testDispatchedTodayCountsOnlyTodaysDispatches` covers today, yesterday, a double dispatch and an archived batch.
- OpenAPI regenerated (`-Dexport.openapi=true`), then `npm run gen:api`; `check:api-drift` passes. Files: `DashboardSummaryDto.java`, `DashboardService.java`, `tracex-api.yaml`, `docs/openapi.json`, `schema.d.ts`.
- No RBAC or route change.

## Dashboard (`/`)

- Title **Today**, with the business date and a "Signed in as" line (it keeps the test ids the sign-in tests use).
- **Needs action** tiles: Expired, Expiring in 7 days, On hold (latest inspection failed), Dispatched today, and Access requests (admins and managers only). Each tile links to a filtered view and shows its status colour only when its count is above zero.
- **Next to dispatch**: the server's top 5, each with a rank, status, an On hold badge when held, the shelf-life rail and the quantity.
- **Stock by freshness**: one stacked bar, plus a legend whose rows link to the filtered batch list (the `dashboard-metric-*` and `dashboard-count-*` ids moved here).
- **Latest inspections**: four counts.
- The empty state depends on the role: roles that can create batches get a "Create batch" button; others are told who creates batches.
- The operator card and the duplicated tier labels are gone.
- `/inspections?verdict=FAILED` and `/team?tab=requests` now open those pages already filtered (state read from the URL; no route change).

## Notifications and messages

- Notifications are grouped into Today, Yesterday, then the date. Each has an unread dot, a monospace time and an "Open" link; access requests open the Requests tab. All copy is in `strings/inbox.ts`.
- Messages use the shared `Tabs` component (ARIA tabs, arrow keys, counts) with a labelled tab panel, and the copy moved to `strings/inbox.ts`. Not done: unread dots (channels have no per-user read state in the API) and a pinned composer.

## Tests

| Suite | Result |
|---|---|
| Backend (`mvnw clean verify`) | **736** run, 0 failures (+1) |
| Frontend unit | **132** passed in 21 files (+1 grouping test; dashboard tests extended) |
| Playwright | **48** passed |
| lint, typecheck, `check:banned`, `check:contrast` (212), `check:backdrops`, `check:api-drift` | all pass |

Test updates:
- Dashboard empty and error copy.
- Notification link for access requests.
- Message tab count now shows `4` instead of `(4)`.
- `PageBackdrop.test.tsx` checks that signed-in headers draw no banner.
- `e2e/phase05-1.spec.ts` checks that the dashboard has no banner and that the page-photos preference flips `data-page-images`.

## Reviews on changed pages

- **web-review and design-critique** (screenshots in `docs/screenshots/after/`):
  - The dashboard now opens on its title and the needs-action row, with no grey box.
  - The eye goes to the coloured left edges of the tiles that have work, then to the dispatch list.
  - At 390px the tiles sit two to a row and the list stacks under each code.
  - Left for R7: the "Signed in as" line is small, and the wide gap above "Needs action" was tightened but could be tighter still.
- **accessibility-review**: axe found no serious or critical issues on the dashboard, notifications and messages, in light and dark, as manager and as inspector, at 1366px and 390px. Neither width has horizontal overflow. The stock bar has a text alternative ("11 active batches by freshness"), and verdict counts use `dl`.

## HARD UI RULES check

All of rules 1 to 8 pass. In particular:
- Rule 3: every number comes from the summary API, and a missing value shows "Not available".
- Rule 6: the gate is clean.
- Rule 7: no new motion.

Rule 9 is unchanged: the custom domain is still not connected.
