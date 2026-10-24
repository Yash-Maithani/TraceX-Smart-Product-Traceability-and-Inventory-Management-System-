# TraceX Design System (DESIGN.md)

> Status: **Proposed, awaiting approval** (2026-10-23). Nothing here is built yet.
> Inputs: [docs/06-ui/AUDIT.md](docs/06-ui/AUDIT.md), [docs/06-ui/RESEARCH.md](docs/06-ui/RESEARCH.md), SPEC.md §5, `frontend/src/styles/tokens.css`.
> Skills used: web-design-system, design-system, frontend-design, ux-copy, design-handoff.
> Scope: frontend only. No API, RBAC, route or backend changes.

---

## 0. HARD UI RULES (non-negotiable)

1. No purple gradients.
2. No pill-shaped buttons. Radius 2-6px.
3. No fake reviews, testimonials, metrics, stats or customer counters. Real API data or a proper empty state only.
4. No vague hero or marketing text. Copy says plainly what the page does.
5. No emoji icons. lucide-react or inline SVG only.
6. No em dashes anywhere in UI text or copy.
7. No over-the-top scroll animations, parallax, cursor animations or custom cursors. Motion only where it carries meaning, 150ms or less, off under prefers-reduced-motion.
8. Real licensed photography first. AI images ONLY as the owner-approved TraceX fallback in Step 4, never with text, fake data or visible artefacts. No AI-sounding filler copy.
9. LAUNCH BLOCKERS, nothing ships until all are done: custom domain connected, real favicon (exists, recheck it), any "made with AI" / builder tag removed, Privacy Policy page live (exists, recheck), Terms & Conditions page live (exists, recheck).
Extend scripts/check-banned-patterns.mjs to also catch em dashes in src/strings and UI copy, and gradient usage in CSS.

---

## 1. Direction: the dispatch board

**Subject.** TraceX is the batch book of a small organic food company in Uttarakhand: factory managers create batches, inspectors grade them, dispatch coordinators ship the oldest-expiring stock first, and a shopper can scan a pack. People use it on a desktop in the office and on a phone on the factory floor.

**The one question every signed-in page answers first:** what needs action now, and what is next in line.

**Character.** A sharp operations console. Left-aligned, dense where the data is (tables), calm everywhere else. Crisp 1px borders instead of shadows and nested cards. One accent per palette, used only for the primary action, links, focus and the selected nav item. Status colours do the rest of the talking.

**The memorable element: the shelf-life rail.** Every batch, wherever it appears (table row, dashboard list, batch header, public trace page), carries a thin 4px rail showing how much of its shelf life is used, from pack date to expiry, filled in its status colour, with the days left printed beside it in tabular figures. It is computed in the browser from `packDate` and `expiryDate`, which every batch DTO already has. Nothing else on the page is decorative.

**What we deliberately do not do.** No banner photos above working pages, no tile grids with every number the same size, no ALL CAPS labels, no numbered section headings that are not a sequence, no arrows appended to button text, no middle-dot meta strings, no page-enter fade on every route.

```
+-----------+-----------------------------------------------------------+
| TraceX    |  Batches / TX-2026-10-002          [Ctrl K]  (o) Live  [bell] [display] |
|           +-----------------------------------------------------------+
| Operations|  Batches                                    [Archived] [Create batch] |
|  Dashboard|  [13 batches] [2 expiring this week] [1 on hold]          |
|  Batches  |  [Search......] [Status +] [SKU +]          Clear filters |
|  FEFO     |  +-----------------------------------------------------+  |
|  Inspect. |  | Code        Product         Status    Expires   Qty  |  |
|  Import   |  | TX-2026-10-002 Kumaon ...   Expiring  24 Oct  1 d  150 kg |
| Team      |  |             ======================------           |  |
|  Messages |  +-----------------------------------------------------+  |
|  Notif.   |                                                           |
|  Team     |                                                           |
| [YM] Name v                                                           |
+-----------+-----------------------------------------------------------+
```

---

## 2. Decisions that need your approval

### 2.1 Font: keep system fonts, or self-host IBM Plex? (ask)

The "system fonts only" rule lives in SPEC §5.1 and the `tokens.css` header. The header cites **D-21**, but D-21 in PROGRESS.md is the dashboard summary endpoint, so the font rule has no decision record of its own. Evidence:

| Option | For | Against |
|---|---|---|
| A. Keep system stack (`system-ui`) | Zero bytes, zero requests, already passing. | Renders as Segoe UI on Windows, Roboto on Android, San Francisco on Apple: the product looks different on every device the team will demo on. System monospace is Consolas on Windows, whose zero and capital O are close in batch codes. |
| **B. Self-host IBM Plex Sans + IBM Plex Mono (recommended)** | One consistent look; Plex Sans has tabular figures and clear 0/O, 1/l/I; Plex Mono gives batch codes and timestamps a distinct, legible voice that suits an industrial console. SIL Open Font License. | About 110 KB for 4 latin-subset WOFF2 files (Sans 400, 500, 600; Mono 500). Served from our own origin, `font-display: swap`, no external requests. |

Recommendation: **B**, recorded as a new decision (proposed **D-25**), with a CI check that no font URL points off-origin. If you say no, the system keeps option A and still adopts tabular numbers and the new type scale.

### 2.2 Photo backdrops: keep, tone down, or limit? (ask)

> **Update 2026-10-24:** Yash asked for imagery as a core goal. Proposal now: photo banners on signed-in page headers, a split sign-in layout and a full-bleed trace photo, with real licensed photos from [docs/06-ui/IMAGERY.md](docs/06-ui/IMAGERY.md). This reverses the 2026-10-23 limit; waiting for Yash to confirm. The text below is the earlier recommendation, kept for the record.


All 14 backdrops are flat placeholders today (OI-11). They cost 176px at the top of every signed-in page and clip header actions on phones (AUDIT #1, #2).

Recommendation: **limit backdrops to the sign-in pages and the public trace page.** Remove the `banner` variant from signed-in pages and replace it with the PageHeader below. Until licensed photos arrive, the auth side panel shows a solid brand panel (palette canvas colour, TraceX wordmark, and one plain line: "Batch records, inspections and dispatch for TraceX Technologies."), not an empty dark box. The `showPageImages` preference stays and controls the remaining two places. This changes D-20, which was a team decision, so it needs your OK.

### 2.3 Other decisions taken by default (tell me if you disagree)

| Decision | Default chosen | Why |
|---|---|---|
| Bulk actions on tables | Not added | No bulk endpoints; N calls with partial failure is worse UX. |
| Unsaved-changes guard | `beforeunload` plus a guard inside dialogs and the Import wizard | App uses `BrowserRouter`; React Router's `useBlocker` needs a data router, and switching routers is out of scope. |
| Date range pickers | Only if backend request B-2 is approved | Endpoints have no date filters. |
| Theme controls in the top bar | Moved into one "Display" menu; full controls in Settings | Three copies today. |
| Default density | 40px rows, user can pick 32 or 48 (saved in `tx_prefs`) | Carbon guidance. |

---

## 3. Tokens

Keep the token architecture as is: 3 palettes x light/dark x accents (auto, cobalt, emerald, amber, rose). Every pair keeps passing `npm run check:contrast`. Changes below are additions or renames; existing names stay as aliases for one phase so nothing breaks mid-way.

### 3.1 Colour roles

| Token | Role |
|---|---|
| `--bg-canvas` | App background behind content. |
| `--bg-surface` | Tables, panels, dialogs. |
| `--bg-elevated` | Table header, hover row, inputs on canvas. |
| `--bg-muted` | Skeleton blocks, disabled fills. |
| `--border-subtle` | All 1px dividers and panel borders. |
| `--border-strong` | Input borders, focused panel edge. |
| `--text-primary` / `--text-secondary` / `--text-muted` | Body, supporting, meta. |
| `--accent-primary` | Primary button, links, focus ring, selected nav. Nothing else. |
| `--sidebar-bg` (new) | Sidebar: one step darker than canvas in light mode, one step lighter in dark mode, so the shell reads as a frame. |

### 3.2 Status set (one meaning each, shape + icon + label, never colour alone)

| Status | When | Icon (lucide) | Tokens | Style |
|---|---|---|---|---|
| Fresh | READY, more than 30 days | `CircleCheck` | `--status-success-*` | subtle |
| Expiring | WARNING, 8 to 30 days | `Clock` | `--status-warning-*` | subtle |
| Expiring soon | URGENT, 1 to 7 days | `AlarmClock` | `--status-urgent-*` | subtle, bold text |
| Expired | EXPIRED | `CircleX` | `--status-danger-*` | **strong** (filled) |
| On hold | latest verdict FAILED | `Lock` | new `--status-hold-*` (deep red-brown light, muted rose dark) | **strong** |
| Dispatched | DISPATCHED | `Truck` | `--status-info-*` | subtle |
| Missing expiry | EXCEPTION | `CircleHelp` | `--status-neutral-*` | subtle, dashed border |
| Passed / Flagged / Failed / Not inspected | inspection verdicts | `ShieldCheck` / `ShieldAlert` / `ShieldX` / `Shield` | success / warning / danger / neutral | subtle |

Labels are sentence case. Internal enum names (URGENT, WARNING) never reach the screen. On hold is derived in the browser from `qualityCheck.status === 'FAILED'`, matching the server's `QUALITY_HOLD` rule (D-19).

### 3.3 Typography

| Token | Size / line height | Weight | Use |
|---|---|---|---|
| `--text-2xs` (new) | 11px / 16px | 500 | Keyboard hints only. |
| `--text-xs` | 12px / 16px | 400-500 | Meta, table secondary line. |
| `--text-sm` | 14px / 20px | 400 | Table cells, form help. |
| `--text-base` | 16px / 24px | 400 | Body, inputs. |
| `--text-lg` | 18px / 26px | 600 | Section titles. |
| `--text-xl` | 20px / 28px | 600 | Dialog titles. |
| `--text-2xl` | 24px / 32px | 600 | Page titles (mobile). |
| `--text-3xl` (new) | 30px / 36px | 600 | Page titles (desktop), metric values. |

- `--font-sans`: IBM Plex Sans (if 2.1 B) else the current system stack.
- `--font-mono`: IBM Plex Mono (if 2.1 B) else the current mono stack. Used for batch codes, lot codes, timestamps and request IDs only.
- Numbers in tables, tiles and the rail use `font-variant-numeric: tabular-nums`.
- No ALL CAPS anywhere; table headers sentence case, 12px, weight 500, `--text-secondary`.
- Reading text max width 70ch (legal pages, dialogs).

### 3.4 Spacing, layout, shape, depth, motion

| Group | Tokens |
|---|---|
| Spacing | Keep the 4px scale (`--space-1` to `--space-16`). Rules: 24px between page sections, 16px inside panels, 12px between form fields, 8px between inline controls. |
| Layout | `--sidebar-width: 15rem` (was 16.5), `--topbar-height: 3.5rem`, content max width 1440px, page gutter 24px desktop / 16px mobile. Breakpoints 640 / 1024 / 1280. |
| Radius | `--radius-xs 2px` (badges, rail), `--radius-sm 4px` (inputs, buttons), `--radius-md 6px` (panels, dialogs). `--radius-lg/xl/full` stay as 6px aliases. |
| Borders | `--border-width: 1px` everywhere; 2px only for the focus ring and the selected nav marker. |
| Elevation | `--shadow-sm` for dialogs, menus and the command palette only. Panels use borders, not shadows. |
| Row heights | `--row-compact 32px`, `--row-default 40px`, `--row-comfortable 48px`. |
| Touch targets | `--touch-target-min: 2.75rem` (44px) under 1024px. |
| Motion | `--duration-fast 100ms` (hover, press), `--duration-normal 150ms` (dialog, menu, toast, palette open). `--ease-standard` unchanged. Off under reduced motion. Route change has no animation. |

### 3.4b Image tokens (imagery phase)

| Token | Role |
|---|---|
| `--backdrop-scrim` | Flat overlay on every photo; about 0.60 light and 0.70 dark, final value set by `check:contrast` |
| `--backdrop-tint` | Per-palette colour grade under the scrim so all photos feel like one set |
| `--banner-title`, `--banner-subtitle`, `--banner-control-*` | Text and controls over photos (exist) |

### 3.5 Planned `tokens.css` diff (summary)

- Add `--text-2xs`, `--text-3xl`, line-height tokens per size, `--row-*`, `--sidebar-bg`, `--status-hold-bg/text/border` for light and dark, `--rail-track` per palette.
- Change `--sidebar-width`, `--topbar-height`, `--touch-target-min` (mobile only).
- Fix comment encoding and the D-21 citation.
- Add `@font-face` (if 2.1 B) pointing at `/fonts/*.woff2` in `public/`.

---

## 4. Components (all states)

Every component: default, hover, focus-visible (2px `--focus-ring`, 2px offset), active, disabled (`aria-disabled`, `--bg-muted` fill, `--text-muted` text, 3:1 border), loading, error. Existing components are reshaped, not replaced, so tests keep their `data-testid`s.

| Component | Variants / anatomy | Specific states and rules |
|---|---|---|
| **Button** | primary, secondary, quiet (was ghost), danger; sm 32px, md 40px; icon-only needs `aria-label`. | Loading: spinner replaces left icon, label stays, `aria-busy`. Only one primary per view region. Danger is never the default focus. |
| **Field** | label, control, help, error. | Error: `--status-danger-border`, message below with icon, linked by `aria-describedby`. Required marked with text "(required)" for screen readers. |
| **Select** | native select styled; FilterChip menu for filters. | Same as Field. |
| **FilterChip** (new) | suggested (`+ Status`), active (`Status: Expiring soon  x`). | "Clear filters" quiet link only when any chip is active. |
| **Table** | toolbar (search, chips, density, count), header, rows, footer pagination. | Sortable header buttons with `aria-sort`; arrow on hover, persistent on sorted column. Sticky header inside the scroll area. Loading: 6 skeleton rows of the current density. Empty: EmptyState in the table body. Error: ErrorState with retry in the body. Caption visually hidden. Codes, dates, numbers never wrap. Row hover `--bg-elevated`; whole row not clickable (link on the code) to keep keyboard order clean. |
| **Dialog** | title, body, footer actions right-aligned. | Focus trap, Escape closes unless the form is dirty (then asks), opens with 150ms rise. |
| **ConfirmDialog** | names the item and the effect; buttons are outcomes ("Archive batch" / "Keep batch"). | Safe button focused by default. Loading state on confirm. |
| **Toast** | success, error, info; title + one line; optional action link ("View batch"). | `aria-live="polite"` (errors `assertive`), 5s, pauses on hover/focus. Copy matches the action verb ("Batch archived"). |
| **StatusBadge** | statuses in 3.2; subtle and strong. | 2px radius, 20px high, 12px text, 14px icon. |
| **ShelfLifeRail** (new) | 4px track + fill + "N days left" / "Expired N days ago" / "Dispatched". | `role="img"` with `aria-label` "Shelf life 92% used, 1 day left". Hidden for dispatched batches. |
| **Tabs** | underline tabs with counts ("Users 7", "Requests 9"). | Arrow keys move, Home/End, `aria-selected`. |
| **Sidebar** | groups (Operations, Team), items with icon + label, selected marker 2px accent bar, user menu at the foot. | Collapses to a drawer under 1024px (existing focus trap kept). |
| **TopBar** | breadcrumbs (left), command palette trigger with "Ctrl K" hint, LiveIndicator, NotificationBell, Display menu. | On mobile: menu button, page title, palette icon, bell. |
| **Breadcrumbs** | `nav aria-label="Breadcrumb"`, last item `aria-current="page"`. | Shown on detail and archived pages. |
| **PageHeader** | title, count chips from the API, actions, optional photo banner. | Banner 176 / 144 / 112px that grows with content; flat scrim; title, subtitle and counts in white over the scrim; actions wrap under the title below 640px. Count chips link to the filtered view. |
| **AuthSplitLayout** | 40% photo panel (wordmark and one plain line over the scrim), 60% form panel; phones: 160px photo band, then the form. | Only a light/dark switch in the header. Same shell for every sign-in page. |
| **StatCard** | label, value (30px tabular), one-line context, link. | Neutral until the value is above zero, then a 2px left border in its status colour. Shows a dash and "Not available" if the field is null. Never hardcoded numbers. |
| **Timeline** | item: icon badge, title, time (mono), body; condensed items for minor events. | Ordered newest first on detail, oldest first on the public page. Group breaks stated in text. |
| **Skeleton** | text line, tile, table row, timeline item. | Only after 300ms of loading, to avoid flashes. |
| **EmptyState** | first use, no match, nothing yet, not allowed (role-aware). | Each has a title, one line on why, and one action (or who to ask). |
| **CommandPalette** (new) | input, groups: Pages, Batches (live search), Actions (role-filtered: Create batch, Record inspection). | Ctrl/Cmd+K or "/" opens, Escape closes, arrow keys move, Enter opens. Typing a full batch code jumps to it. `role="dialog"` + combobox/listbox pattern. Debounced 200ms. |
| **LiveIndicator** (new) | Live (green dot + "Live"), Reconnecting (amber + "Reconnecting"), Offline (neutral + "Offline"). | Tooltip with last event time. Polite live region announces changes. Needs `openEventStream` to report its state (frontend only). |
| **UserMenu** (new) | avatar initials, name, role; menu: Profile, Settings, Privacy Policy, Terms and Conditions, Sign out, Sign out everywhere. | Replaces the three sidebar buttons. |
| **DisplayMenu** (new) | theme toggle, palette, accent, density, page photos. | Mirrors Settings > Display. |

---

## 5. Copy (ux-copy)

Rules: plain verbs, sentence case, no jargon (no "server", "derived", "tier", "token", "append-only", "role-scoped"), no em dashes, numbers in figures, "1 day" / "2 days". Same verb from button to toast. All strings move to `frontend/src/strings/` split by feature (`common.ts`, `dashboard.ts`, `batches.ts`, `fefo.ts`, `inspections.ts`, `import.ts`, `team.ts`, `account.ts`, `auth.ts`, `public.ts`), re-exported from `strings/index.ts`, with `en.ts` kept as an alias until every import moves.

| Page | Title | Subtitle / count line | Primary action | Empty state | Error |
|---|---|---|---|---|---|
| Dashboard | Today | Stock as of 23 Oct 2026 | (role) Create batch / Open FEFO queue | "No batches yet. Create the first batch to start tracking freshness." / for roles that cannot create: "No batches yet. A factory manager or admin creates batches." | "Could not load today's summary. Check your connection and try again." |
| Batches | Batches | "13 batches", "2 expiring this week", "1 on hold" | Create batch | No match: "No batches match these filters." + Clear filters | "Could not load batches." + Try again |
| Batch detail | TX-2026-10-002 | Kumaon Royal Multigrain Crackers, 150 kg | Dispatch | Timeline empty: "Nothing has happened to this batch since it was packed." | "Could not load this batch." |
| Archive confirm | Archive TX-2026-10-002? | "It leaves the batch list and the FEFO queue, and its QR link stops working. An admin can restore it from Archived." | Archive batch / Keep batch | | |
| Archived | Archived batches | "Hidden from lists, FEFO and the public QR page." | Restore | "No archived batches." | |
| FEFO | Dispatch queue | "Ship the batch that expires first. 10 ready, 1 expired, 0 missing an expiry date." | Dispatch (next in line only) | "Nothing to dispatch. All active batches are expired or already shipped." | |
| On hold row | | "On hold: latest inspection failed. Record a new inspection to release it." | | | |
| Dispatch out of order | Dispatch TX-2026-10-005 out of order? | "TX-2026-10-002 (same SKU) expires sooner. Give a reason; it is saved in the audit log." | Dispatch with reason | | |
| Inspections | Inspections | "5 inspections. Each one is kept permanently." | Record inspection | "No inspections yet. Record one from here or from a batch." | |
| Import | Import batches from CSV | "Upload a CSV, match its columns, check the rows, then import." | Choose CSV file | "No imports yet." | Row errors: "Row 12: Pack date must be a date like 2026-10-23." |
| Rollback confirm | Undo import of 23 Oct, 14:05? | "Archives the 120 batches this import created. Batches already dispatched block the undo." | Undo import / Keep import | | |
| Team | Team | "7 people, 9 access requests waiting" | (row menu) | "No access requests waiting." | |
| Notifications | Notifications | "Last 7 days" | Mark all as read | "You are all caught up." | |
| Messages | Messages | "Channel for each role. Kept for 90 days. For decisions about a batch, comment on the batch." | Send | "No messages in this channel yet." | |
| Profile | Profile | | Save changes | | |
| Sign out everywhere | Sign out on every device? | "Every browser signed in to your account, including this one, is signed out now." | Sign out everywhere / Cancel | | |
| Settings | Settings | "Saved to your account and applied on every device." | (auto-save, toast "Display settings saved") | | |
| Forbidden | You do not have access to Team | "Your role is Dispatch Coordinator. Ask an administrator if you need access." | Go to dashboard | | |
| Not found | Page not found | "Check the address, or go back to the dashboard." | Go to dashboard | | |
| Sign in | Sign in to TraceX | "Use the username and password from your invitation." | Sign in | | "Username or password is wrong." |
| Public trace | Kumaon Royal Multigrain Crackers | "Batch TX-2026-10-002 from Demo Village, recorded in TraceX." | | "This QR link does not match a batch. It may be mistyped or the batch was withdrawn." | "Could not load this batch. Try again in a moment." |
| Public trace dates | | "Packed 26 Jul 2026", "Quality checked 4 Oct 2026, passed", "Best before 24 Oct 2026 (1 day left)" | | | |

Tooltips (only where a control is unclear): density ("Row height"), palette trigger ("Search pages and batches (Ctrl K)"), live dot ("Updates arrive without reloading. Last update 18:41."), rail ("Shelf life used since packing").

---

## 6. Page specs (design-handoff)

Breakpoints: mobile < 640, tablet 640 to 1023, desktop >= 1024. All pages: PageHeader, then content; skeleton after 300ms; ErrorState with retry; role-aware empty state.

### 6.1 App shell
- Desktop: sidebar 240px fixed, top bar 56px sticky. Content max 1440px, gutters 24px.
- Mobile: top bar with menu, title, palette icon, bell; drawer for nav; DisplayMenu inside the drawer.
- Keyboard: Ctrl+K / "/" palette, "?" shortcuts dialog, G then D/B/F/I to Dashboard, Batches, FEFO, Inspections.

### 6.2 Dashboard
1. **Needs action** row of 4 StatCards: Expired (to `/batches?status=EXPIRED`), Expiring in 7 days (URGENT), On hold (verdict FAILED, to `/inspections?verdict=FAILED`), Access requests (admins and managers only, to `/team?tab=requests`). Values from `GET /dashboard/summary`.
2. **Stock by freshness**: one horizontal stacked bar (Fresh, Expiring, Expiring soon, Expired, Missing expiry) with a legend listing counts; each segment links to the filtered list. Built with plain divs, no chart library.
3. **Next to dispatch**: the 5 `topExpiring` rows with rail, status, quantity, and "Open queue".
4. **Inspections**: four small counts (Passed, Flagged, Failed, Not inspected).
- Mobile: tiles 2 x 2, bar full width, list as cards.
- Dispatched today: only if B-1 is approved.

### 6.3 Batches
- Toolbar: search (debounced, `replace` history), chips Status and SKU, sort via headers, density, count.
- Columns: Code (mono, link), Product (name + SKU below), Status, Shelf life (rail + days), Expires (date), Quality, Quantity (right-aligned, tabular), Origin (lot mono + village).
- Mobile card: code, status, product, rail; tap the code to open.

### 6.4 Batch detail
- Header strip: code, product, status badges, rail, actions (Dispatch primary; Correct details, Archive in an overflow menu), breadcrumbs.
- Left column (2/3): Timeline (packed, note changes, inspections, dispatches, first and last scan, comments), then Comments composer.
- Right column (1/3): Facts list, QR panel (copy link, download, print label), Scans summary.
- Print: `@media print` hides shell; batch sheet A4 with facts, timeline and QR; "Print label" prints a 50 x 30 mm label (code, product, best before, QR).
- Unsaved: note and correction dialog guard.

### 6.5 Archived batches
- Tab under Batches ("Active", "Archived"). Table with search and pagination (client-side over the archived list).

### 6.6 FEFO and dispatch
- Header line with counts per section. Sections as tabs: Queue, Expired, Missing expiry.
- Queue table: rank, code, product, rail, status, quality, action. Row 1 per SKU gets the primary Dispatch; others secondary. On-hold rows show the hold badge and a disabled button with tooltip.
- Dispatch dialog: summary line, override reason when out of order, confirm.

### 6.7 Inspections
- Chips for verdict, tabs All / Mine with counts. Record inspection dialog unchanged in behaviour; checklist as a grid of 8 yes/no toggles with labels; verdict guard message inline.

### 6.8 Import
- Stepper with done / current / upcoming states. Column chips show human names only. Validation preview table with error rows first. Rollback confirm names job and count. Leave guard while a job is mapped but not committed.

### 6.9 Team
- Tabs Users / Requests / Recycle bin with counts. Search. Row menu (Change role, Deactivate, Delete). Delete and reject confirmations unchanged in behaviour, copy updated.

### 6.10 Notifications and messages
- Notifications grouped Today / Yesterday / Earlier, each row links to its record.
- Messages: channel list on the left (desktop), unread dot, composer pinned at the bottom.

### 6.11 Profile and settings
- Profile: details, password, sessions; plain copy. Settings: Display (moved here fully), Recent sign-ins table with "Unknown browser" for unparsed agents.

### 6.12 Auth pages
- Desktop: left panel 40% (brand panel or approved photo), right form 60%; mobile: no top band, wordmark above the form. Top bar has only the wordmark and a light/dark toggle.

### 6.13 Public QR trace
- Single column 560px max. Product name as the title, batch code (mono) and origin village. Rail with "Best before 24 Oct 2026, 1 day left" in consumer words (Fresh / Use soon / Past best before / Shipped). Short timeline: Packed, Quality checked (verdict), Shipped (status only). Traceability note. Footer: company line, Privacy Policy, Terms and Conditions with proper spacing. Invalid link: one panel, no nesting.

### 6.14 Legal pages
- Centred 70ch column, on-page contents list, no side panel, "Last updated" at the top.

### 6.15 Styleguide (`/_styleguide`)
- Every component in every state, all 6 palette/mode pairs and accents, the status set and rails, density examples.

---

## 7. Checks to add

`frontend/scripts/check-banned-patterns.mjs` extensions:

1. Em dash (U+2014) in **any line** of files under `src/strings/` (comments included) and in CSS `content:` values; em dash in JSX text nodes and string literals in `src/features`, `src/components`, `src/layouts` (already covered for code lines; keep).
2. Gradients in **any CSS line**, including ones that start with a comment marker on the same line as a declaration, plus `background-image: url(...)` data gradients and `image-set` gradients.
3. Off-origin font URLs (`@font-face` `src` with `http`), if fonts are adopted.
4. `text-transform: uppercase` in CSS (no ALL CAPS rule).
5. `border-radius` above 6px in TS style objects as well as CSS.
6. "made with", "built with", "powered by" (case-insensitive) in `src` and `index.html` (launch blocker 9).

Each extension gets a unit test (the checker is already imported by `src/components/ui/ui.test.tsx` and `PageBackdrop.test.tsx`).
