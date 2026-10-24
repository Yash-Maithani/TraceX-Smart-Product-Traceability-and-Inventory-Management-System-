# Redesign Phase R1: Tokens, core components and app shell

> Date: 2026-10-23. Baseline: commit `2587835`. Not committed (Yash commits).
> Backup before any change: `_local-archive/frontend-backup-2026-10-23-pre-redesign/` (git-ignored, see its `RESTORE.txt`).
> Defaults used while the four questions in DESIGN.md §2 are open: system fonts kept (no D-25 yet), page photos kept (D-20 unchanged), no backend changes (B-1, B-2 not done).

## What changed

| Area | Change | Files |
|---|---|---|
| Tokens | Type scale to `--text-3xl` (and `--text-2xs`), row heights (`--row-compact/default/comfortable`), `--content-max-width`, 44px touch targets under 1024px, new On hold status tokens, `--sidebar-bg`, `--rail-track`; fixed broken comment encoding and the wrong D-21 citation. | `src/styles/tokens.css` |
| Contrast gate | New pairs: hold text on hold bg, text-secondary and text-muted on bg-elevated (sidebar and table meta). 212 pairs pass. | `scripts/check-contrast.mjs` |
| Status badges | Sentence-case labels (Fresh, Expiring, Expiring soon, Expired, Missing expiry, Dispatched), distinct icons, strong fill only for Expired and the new On hold, 2px radius. `isOnHold()` derives hold from a FAILED latest inspection (D-19). | `components/ui/statusMap.ts`, `StatusBadge.tsx`, `strings/status.ts` |
| Buttons and fields | 4px radius, real disabled colours instead of opacity, press feedback, input hover border, no wrapping labels. | `components/ui/ui.module.css` |
| Table | Sticky header (table scrolls in its own box on desktop), sentence-case headers, density from Display settings, `nowrap` and `numeric` column options, skeleton rows while loading, caption for screen readers only, unsorted arrow on hover only, keyboard-focusable scroll region, copy moved to `strings/common.ts`. | `components/ui/Table.tsx`, `ui.module.css` |
| Page header | Banner grows with its content so actions never clip on phones (AUDIT #2); linked breadcrumbs; `meta` slot for count chips; 30px titles on desktop. | `components/ui/States.tsx`, `ui.module.css` |
| New components | Popover, FilterChip, Tabs, StatCard (real data only), Timeline, ShelfLifeRail, LiveIndicator, Kbd, CommandPalette, DisplayMenu, ShortcutsDialog. | `components/ui/Console.tsx`, `Popover.tsx`, `ShelfLifeRail.tsx`, `CommandPalette.tsx`, `DisplayMenu.tsx`, `console.module.css` |
| Live state | The SSE stream reports Connecting, Live, Reconnecting, Offline and the last event time. | `lib/liveStatus.ts`, `hooks/useLiveUpdates.ts` |
| Preferences | Local-only row height (`tableDensity`), not sent to the account settings API. | `lib/prefs.ts`, `hooks/useTheme.tsx` |
| App shell | Sidebar grouped (Operations, Team and account) with a 2px selected marker, initials avatar, compact sign-out buttons and legal links; sticky top bar with search (Ctrl K), live indicator, bell, shortcuts and the Display menu; theme, palette, accent, row height and page photos moved into the Display menu; route fade removed; content width 1440px. Shortcuts: Ctrl K and "/" search, "?" list, G then D, B, F or I. | `layouts/AppShell.tsx`, `AppShell.module.css`, `routes/navConfig.ts` (group only, same paths) |
| Global styles | No ALL CAPS anywhere; batch codes never wrap; tabular metric values; no hover effect on non-interactive cards. | `features/core/core.module.css`, `features/import/ImportPage.module.css`, `features/public/public.module.css`, `features/dashboard/DashboardPage.tsx` (labels only) |
| Strings | New `strings/common.ts`, `strings/status.ts`, `strings/index.ts`; `en.ts` kept. | `src/strings/` |
| Banned-pattern gate | New rules: em dash on any line in `src/strings`, em dash in CSS `content`, gradients on comment-led CSS lines, `text-transform: uppercase`, off-origin font URLs, "made with / built with / powered by", radius above 6px in TS style objects. | `scripts/check-banned-patterns.mjs` |

## Not done in R1 (waiting for answers)

- IBM Plex fonts (D-25).
- Removing banner photos from signed-in pages (D-20 change).
- Dispatched today tile and date filters (B-1, B-2).
- Moving each page's copy into feature string files happens with each page in R2 to R6.

## Tests

| Suite | Result |
|---|---|
| Backend (`mvnw clean verify`) | **735** run, 0 failures, 0 errors |
| Frontend unit (`vitest run`) | **131** passed in 21 files (+15: new `components/ui/console.test.tsx`) |
| `test:a11y` | 11 passed |
| Playwright | **48** passed |
| `lint`, `typecheck` | clean |
| `check:banned` | 0 violations |
| `check:contrast` | 212 pairs pass |
| `check:backdrops` | pass (14 placeholder warnings, OI-11) |

Test updates: `PublicTracePage.test.tsx` expects "Missing expiry" instead of "Exception"; `e2e/phase05.spec.ts` switches theme through the Display menu; `e2e/phase05-1.spec.ts` opens the Display menu before the page-photos toggle.

The first Playwright run found two real problems, both fixed: the phone top bar was 25px too wide at 375px (live label now hidden visually on phones, tighter gaps), and scrollable tables were not keyboard-reachable (axe `scrollable-region-focusable`).

## Reviews on changed pages

- **web-review and design-critique** (screenshots in `docs/screenshots/after/`): header actions no longer clip at 390px; batch codes stay on one line; titles and tables read clearer with sentence-case headers and tabular numbers; the top bar holds one search and one settings button instead of three controls. Still open for later phases: the empty banner photos on every page (needs D-20 answer), dashboard story (R2), filter bar size (R3), FEFO hold state (R4).
- **accessibility-review**: axe clean on the command palette and on every Playwright-scanned route in light and dark; palette uses combobox + listbox with `aria-activedescendant`; Display menu and filter chips return focus to their trigger on Escape; tabs support arrow keys, Home and End; live state is announced politely.

## HARD UI RULES check

| Rule | R1 result |
|---|---|
| 1 No purple gradients | Pass (gate extended) |
| 2 Radius 2 to 6px, no pills | Pass (2px badges, 4px controls, 6px panels) |
| 3 No fake numbers | Pass (StatCard shows a dash and "Not available" without data) |
| 4 No vague text | Pass |
| 5 No emoji | Pass |
| 6 No em dashes | Pass (gate extended to `src/strings` and CSS content) |
| 7 Motion 150ms or less, meaningful only | Pass (route fade removed; popover and palette 150ms, off under reduced motion) |
| 8 No filler copy | Pass |
| 9 Launch blockers | Unchanged: custom domain still not connected |
