# TraceX UI/UX Audit (before the redesign)

> Date: 2026-10-23. Baseline: commit `2587835` (Phase 13).
> Evidence: 83 screenshots in [docs/screenshots/before/](../screenshots/before/), captured from the running app (backend dev profile on 8081, Vite on 5174) at 1366px and 390px, signed in as each seed role, plus every public page.
> Method: web-review (UXKIN skill, run without UXKIN connected), design-critique and accessibility-review (design plugin), read alongside the source in `frontend/src`.
> Severity: **High** blocks or misleads a user, breaks on a phone, or fails accessibility. **Medium** makes the product look unfinished or slows work. **Low** is polish.

File names in this audit refer to the screenshots, for example `superadmin-batches-390.png`.

---

## 1. Top 10 issues

| # | Page | Problem | Severity | Fix |
|---|---|---|---|---|
| 1 | Every page with a header backdrop | All 14 backdrops are still placeholders (`placeholder: true` in `design-assets/backdrops.json`), so every signed-in page opens with a 176px empty grey box, and auth and legal pages give 55% of the screen to a flat dark panel. | High | Remove the banner backdrop from signed-in pages and use the space for a real page header with live counts. Keep photos for auth and public trace only, and show a solid brand panel until licensed photos arrive. Needs your OK (D-20). |
| 2 | Page header on phones (dashboard, batches, batch detail, FEFO, inspections, import) | At 390px the 112px banner clips the header actions: "Refresh", "All Batches", "FEFO Queue", "Create Batch" are cut in half (`superadmin-dashboard-390.png`, `superadmin-batches-390.png`). | High | Header grows with its content; actions wrap below the title on small screens. |
| 3 | FEFO queue | Every row has an identical primary "Dispatch" button, including a batch whose latest inspection is **Failed** (rank #2, `superadmin-fefo-1366.png`). The server will refuse it with `QUALITY_HOLD`, but the UI invites the click. | High | Show "On hold" with a lock icon and a disabled button with a tooltip ("Latest inspection failed. Record a new inspection to release it."). Only the next eligible row gets the primary style. |
| 4 | Batches list, FEFO, dashboard | Batch codes wrap onto two lines (`TX-2026-10-` / `001`) and dates wrap into three lines at 1366px. Columns have no width rules. | High | `white-space: nowrap` and a fixed min width for code, date and quantity columns; monospace with tabular figures. |
| 5 | Top bar (all signed-in pages and all public pages) | Theme, palette and accent controls sit permanently in the top bar, next to a duplicate in Settings and a third "Page images" toggle in the sidebar. On a phone they take three rows (`public-login-390.png`). On public pages a consumer sees "Editorial (Warm Paper)". | High | One "Display" menu (icon button) in the top bar; full controls stay in Settings. Remove theme controls from public pages except a single light/dark toggle. |
| 6 | Dashboard | No story. Six equal tiles with the label printed twice (heading "EXPIRED" plus badge "EXPIRED"), an "Operator:" card that repeats the sidebar, and a pending-requests card with no link. The tiles wrap 5 + 1. Nothing says what needs action today. | High | "Needs action" row first (Expired, Expiring in 7 days, On hold, Pending access requests), each tile linking to the filtered list; then the stock-by-freshness bar; then the next 5 to dispatch. Remove the operator card. |
| 7 | Whole app | No command palette or quick search. Finding a batch from any page means going to Batches and typing in the filter. | Medium | Ctrl+K palette: pages plus batch search using the existing `GET /api/v1/batches?search=`. |
| 8 | Batch detail | The batch's journey (packed, inspected, dispatched, scanned) is split over six equal cards with technical subtitles ("Embedded verdict snapshot on the batch document", "Cryptographic public traceability link"). No print view for the batch sheet or QR label. | Medium | One vertical timeline built from data the page already loads; key facts in a header strip; print stylesheet for a batch sheet and a QR label. |
| 9 | Live updates | The SSE stream reconnects silently (`lib/eventStream.ts`, backoff 1s to 30s). Nobody can tell whether the screen is live or stale. | Medium | LiveIndicator in the top bar: Live, Reconnecting, Offline, with the last update time. |
| 10 | Copy across the app | Internal jargon in user-facing text: "server-derived freshness status tiers", "computed by the server", "increment your account's tokenVersion", "Append-only", "Role-scoped", "(403)", raw role ids ("super-admin"), field names like `productSku` on the import page; grammar bugs ("1 days remaining"). | Medium | Rewrite with ux-copy into `src/strings`; plural helper for days. |

---

## 2. Global findings (shell, components, tokens)

| Area | Problem | Severity | Fix |
|---|---|---|---|
| Strings | `src/strings/en.ts` holds 119 lines; most page copy is hardcoded in components (SPEC §5.2 rule 4 is not met), e.g. `layouts/AppShell.tsx` confirm text, `components/ui/Table.tsx` "No records found", every page title. | Medium | Move all copy into `src/strings/*.ts` per feature during each phase. |
| Typography | No tabular numbers anywhere (`font-variant-numeric` appears in no file). Counts and quantities jitter between rows. Table headers and meta labels are ALL CAPS, which reads as template chrome. | Medium | `tabular-nums` on numbers, sentence-case headers, mono only for codes and timestamps. |
| Type scale | Largest size is 1.5rem; page titles, card titles and metric values sit within 2 steps, so hierarchy is flat. | Medium | Add 1.875rem for page titles and metric values; tighten the rest (see DESIGN.md). |
| Status badges | Same colour family for Urgent (orange) and Warning (amber); in dark mode they are hard to tell apart in a long table. No "On hold" state at all (Failed verdict is the hold). Dispatched rows still show "130D" days to expiry. | Medium | Distinct status set (fresh, expiring soon, expiring, expired, on hold, dispatched, exception) with shape + icon + label; hide days to expiry once dispatched. |
| Tables | Sorting exists in `Table.tsx` but no page uses it; sort is a separate dropdown. No sticky header, no density control, no row hover, caption repeats the page title as a visible box header. Pagination only on Batches and Inspections. | Medium | Sortable headers on server-sortable columns, sticky header, density toggle, caption visually hidden. |
| Sidebar footer | Three full-width buttons (Page images, Sign out, Sign out everywhere), legal links and a user card fill a third of the sidebar. | Low | User menu in the sidebar foot: name, role, menu with Profile, Settings, Sign out, Sign out everywhere. Legal links in the menu and the page footer. |
| Nav | "Archived Batches" is a sidebar item and also a button on the Batches page; Profile and Settings are separate items. 11 items with no grouping. | Low | Group: Operations (Dashboard, Batches, FEFO and dispatch, Inspections, Import), Team (Messages, Notifications, Team), and move Archived under Batches as a tab. |
| Motion | Page-enter animation on every route change (`pageEnter`) is the generic fade-in. | Low | Keep motion for user-triggered changes (dialog, toast, row expand) only. |
| Comments in tokens.css | Mojibake in comments (`Â§`, `â€”`) and the file header cites "D-21" for system fonts, but D-21 in PROGRESS.md is the dashboard summary endpoint. | Low | Fix the encoding; cite SPEC §5.1 instead. |
| Search box | Batches search writes to the URL on every keystroke with no debounce, so each letter is a request and a history entry; Back steps through "T", "TX", "TX-"... | Medium | 250ms debounce and `replace: true` for typing. |

---

## 3. Per-page UX gap audit

Legend: OK = present and good, Weak = present but needs work, Missing.

### 3.1 Dashboard (`/`)

| Check | State | Note / fix | Severity |
|---|---|---|---|
| Loading skeleton | Weak | One generic skeleton block; build skeletons shaped like the tiles. | Low |
| Empty state with next action | OK | "Go to Batches"; change to "Create a batch" for roles that can, and explain for roles that cannot. | Low |
| Error with retry | OK | | |
| Story (expiring, on hold, dispatched today) | Missing | See Top 10 #6. "Dispatched today" needs data the summary does not return (see Backend requests). | High |
| Role-aware | Weak | Pending requests card says "Visible only to Manager, Admin..." instead of linking to Team. | Low |
| "Refresh" button | Weak | Also re-validates the session (`refreshSession`), which is surprising; live updates make it mostly redundant. | Low |
| Mobile | Weak | Header actions clipped (Top 10 #2). | High |

### 3.2 Batches list (`/batches`)

| Check | State | Note / fix | Severity |
|---|---|---|---|
| Search / filter / sort / pagination | Weak | All present, but four labelled selects in a card take 140px; sort is a dropdown, not headers. Use a compact filter bar (search + status chips + SKU menu + "Clear filters" when active). | Medium |
| Counts in header | Missing | "13 batches" is known from `total`. Show it. | Medium |
| Sticky header, density | Missing | | Medium |
| Bulk actions | Missing | No bulk endpoint exists; bulk archive would be N calls. Recommend not adding (see Decisions). | Low |
| Empty state | OK | Distinguish "no batches yet" (first run) from "no match". | Low |
| Mobile | Weak | Cards are fine but long (`superadmin-batches-390.png` is 3716px tall for 13 rows); drop pack date and source lot from the card, keep code, product, status, expiry. | Medium |

### 3.3 Batch detail (`/batches/:id`)

| Check | State | Note / fix | Severity |
|---|---|---|---|
| Breadcrumbs | OK | Present; make them a real link row above the title. | Low |
| Timeline | Missing | Top 10 #8. | Medium |
| Confirm on destructive | OK | Archive uses ConfirmDialog. Name the effect: "Archive TX-2026-10-002? It leaves the FEFO queue and the public QR link stops working until restored." | Low |
| Unsaved changes | Missing | Note textarea and the raw-material correction dialog lose edits on navigation or Escape. | Medium |
| Print | Missing | | Medium |
| Days label | Weak | "1 days". | Low |
| Not found | OK | `superadmin-batch-detail-missing-*`. | |

### 3.4 Archived batches (`/batches/archived`)

| Check | State | Note / fix | Severity |
|---|---|---|---|
| Pagination / search | Missing | Will not scale. | Medium |
| Copy | Weak | "Soft-deleted production batches". Say "Archived batches are hidden from lists, FEFO and the public QR page. Restore one to bring it back." | Low |

### 3.5 FEFO and dispatch (`/fefo`)

| Check | State | Note / fix | Severity |
|---|---|---|---|
| Quality hold visible | Missing | Top 10 #3. | High |
| Primary action hierarchy | Weak | 10 primary buttons. | High |
| Dispatch override confirm | OK | The dispatch dialog asks for an override reason when out of order. Add a summary line ("You are dispatching #4 before #1 for WBJC") before submit. | Medium |
| Sections | Weak | Numbered headings "1. 2. 3." are not a sequence; use tabs or plain sections: Queue, Expired, Missing expiry. | Low |
| Copy | Weak | "URGENT → WARNING → READY", "corrupted expiry". | Low |

### 3.6 Inspections (`/inspections`)

| Check | State | Note / fix | Severity |
|---|---|---|---|
| Filter | Weak | One full-width select for verdict. Use chips. | Low |
| Date range | Missing | Inspections have dates; the endpoint has no date filter, so filter only the loaded page or ask for backend support. | Low |
| Form validation | OK | Field errors linked. | |
| Data check | Note | Two rows show batch `TX-2026-10-003` with different products (`superadmin-inspections-1366.png`). Likely dev data from a test batch; needs a check, outside UI scope. | Info |

### 3.7 Import (`/import`)

| Check | State | Note / fix | Severity |
|---|---|---|---|
| Stepper | OK | Five steps; make the current step and completed steps visually distinct. | Low |
| Rollback confirm | OK | ConfirmDialog present; name the job and the count of batches that will be archived. | Low |
| Copy | Weak | Field ids shown as chips (`productSku`). Show the column name only; ids in a details toggle for the CSV author. | Medium |
| Unsaved changes | Missing | Leaving mid-mapping loses the work. | Medium |

### 3.8 Team (`/team`)

| Check | State | Note / fix | Severity |
|---|---|---|---|
| Destructive styling | Weak | A filled red "Delete" in every row (`superadmin-team-1366.png`). Move Role, Deactivate, Delete into a row menu; red only inside the menu and the confirm. | Medium |
| Confirm dialogs | OK | Role change, delete and reject have dialogs. | |
| Search | Missing | Users list has no search. | Low |

### 3.9 Notifications and Messages

| Check | State | Note / fix | Severity |
|---|---|---|---|
| Notifications grouping | Weak | Flat list; group by day, link each to its record. | Low |
| Messages channel tabs | Weak | Super admin sees five tabs styled like filter buttons; unread counts missing. | Low |
| Empty states | OK | | |

### 3.10 Profile and Settings

| Check | State | Note / fix | Severity |
|---|---|---|---|
| Copy | Weak | "increment your account's tokenVersion". | Medium |
| Duplicate controls | Weak | Display settings exist in three places. | Medium |
| Sign-in history | Weak | "Other / Other" rows; show "Unknown browser". Timestamps wrap. | Low |

### 3.11 Auth pages (login, request access, activate, verify OTP, forgot and reset password)

| Check | State | Note / fix | Severity |
|---|---|---|---|
| Layout | Weak | Empty dark 55% panel (Top 10 #1); on phones a 96px dark band above the header. | High |
| Copy | OK | Plain and short. | |
| Form validation | OK | | |
| Theme controls | Weak | Palette and accent selects on a sign-in page. | Medium |

### 3.12 Public QR trace (`/trace/t/:token`)

| Check | State | Note / fix | Severity |
|---|---|---|---|
| Purpose for a shopper | Weak | Shows "Urgent" (an internal FEFO tier) to consumers. A shopper needs "Best before 24 Oct 2026, 1 day left". | High |
| Journey | Missing | The trace response has the pack date, the inspection date and a Dispatched status (no dispatch date); show them as a short timeline with the village as origin. | Medium |
| Layout | Weak | Card inside card inside dark panel; the invalid-link state nests three boxes (`public-trace-invalid-390.png`). | Medium |
| Footer | High | "Privacy PolicyTerms and Conditions" has no gap between links (`public-trace-public-1366.png`). | High |
| Theme controls | Weak | Consumers see palette and accent selects. | Medium |

### 3.13 Legal pages (`/privacy`, `/terms`)

| Check | State | Note / fix | Severity |
|---|---|---|---|
| Exists and live | OK | Real content, last updated 23 October 2026. | |
| Layout | Weak | Long text squeezed into the 45% column beside the empty panel (`public-privacy-1366.png`). Use a centred reading column (65 to 75 characters) with no side panel, and an on-page contents list. | Medium |

### 3.14 Not found and forbidden

| Check | State | Note / fix | Severity |
|---|---|---|---|
| Forbidden | Weak | Title shown twice (banner and card), "(403)", raw "super-admin". Say "Your role (Dispatch Coordinator) cannot open Team. Ask an administrator if you need access." | Medium |

---

## 4. Accessibility review (WCAG 2.1 AA)

Automated contrast passes today (`npm run check:contrast`, 162 checks). Findings from the screenshots and code:

| # | Issue | Criterion | Severity | Fix |
|---|---|---|---|---|
| 1 | Header actions clipped at 390px are partly unreachable visually. | 1.4.10 Reflow | High | Header reflows (Top 10 #2). |
| 2 | Status meaning carried by colour plus icon plus label: OK. But Urgent and Warning use near-identical icons (circle-alert vs triangle) at 13px. | 1.4.1 Use of Color | Low | Distinct icon per status, 14px. |
| 3 | Top bar buttons and icon buttons are 40px (`--touch-target-min: 2.5rem`). | 2.5.5 Target Size (AAA, advisory) | Low | 44px on touch layouts. |
| 4 | Table caption is rendered as a visible box title, then the same words again as page title. Screen readers announce it twice. | 1.3.1 | Low | Visually hidden caption. |
| 5 | Disabled "Send" button uses opacity only; on dark it reads as active blue. | 1.4.3 / 1.4.11 | Medium | Disabled token pair with 3:1 border. |
| 6 | No `aria-live` for live updates beyond toasts; reconnect state is silent. | 4.1.3 Status Messages | Medium | LiveIndicator with polite live region. |
| 7 | Focus ring visible everywhere checked; skip link present; drawer traps focus. | 2.4.7 | OK | |
| 8 | Keyboard: no shortcut to search; sort buttons unused. | 2.1.1 | Low | Ctrl+K and "/" for search, documented in a shortcuts dialog. |

---

## 5. Visual quality

- **Hierarchy:** page title, section title and metric value are all bold and within 4px of each other. The eye has nowhere to land first. The biggest element on most pages is the empty backdrop.
- **Density:** cards inside cards (filter card, table card with its own caption bar, section card wrapping tiles) waste 24 to 48px per level. Tables use 64 to 85px rows because cells wrap.
- **Spacing:** the 4px scale is used, but section gaps vary between 16 and 48px with no rule.
- **Backdrops:** with placeholders they add only noise. With real photos, they would still push the working content below the fold on every visit. They help on the sign-in page and the public trace page, where there is little content and a first impression matters.
- **What works:** the token system (3 palettes, light and dark, 4 accents) is solid and contrast-checked; status always has label and icon; forms, dialogs and error states are complete and consistent; the 6px radius and no-gradient rules are already enforced by `check:banned`.

---

## 6. HARD UI RULES check (today)

| Rule | Result | Evidence |
|---|---|---|
| 1 No purple gradients | Pass | `check:banned` rule 3 blocks all gradients. |
| 2 No pill buttons, radius 2 to 6px | Pass | `--radius-full: 6px`; checker rejects > 6px. |
| 3 No fake metrics | Pass | All numbers come from `GET /dashboard/summary` and lists. |
| 4 No vague hero text | Pass with notes | Subtitles are specific but jargon-heavy (section 1, #10). |
| 5 No emoji icons | Pass | lucide-react only; checker rejects emoji. |
| 6 No em dashes in UI text | Pass | Checker rule 10 covers `.ts/.tsx/.html` code lines; comment lines and CSS `content:` are not scanned (DESIGN.md plan extends this). |
| 7 No over-the-top motion | Pass | 150ms max, off under reduced motion. |
| 8 No AI filler copy | Pass with notes | No filler, but jargon (see above). |
| 9 Launch blockers | Not met | Favicon present (`public/favicon.svg`, `.ico`, apple touch icon). No "made with" tag found in `index.html` or `src`. Privacy and Terms pages live. Custom domain not connected. |

---

## 7. Backend requests (need your approval before any work)

| # | Need | Why | Frontend fallback if declined |
|---|---|---|---|
| B-1 | `dispatchedToday` (count) in `GET /api/v1/dashboard/summary`. | Dashboard "Dispatched today" tile. | Show total dispatched only, labelled as total. |
| B-2 | Optional `from` / `to` date filters on `GET /api/v1/inspections` and `GET /api/v1/batches` (expiry). | Date range pickers on Inspections and Batches. | No date range picker; sort by date instead. |

No other UX fix in this plan needs backend changes.

---

## 8. Imagery addendum (2026-10-24)

Re-checked after R1 to R3 (`docs/screenshots/after/`). Most Top 10 issues from section 1 are fixed in code (#2 clipped actions, #4 wrapping codes, #5 theme controls in the signed-in top bar, #6 dashboard story, #7 Ctrl+K, #8 batch timeline and print, #9 live indicator). What remains is mostly visual:

| # | Page | Problem | Severity | Fix |
|---|---|---|---|---|
| I-1 | All 14 backdrop slots | Still flat placeholders; the product has no photography at all, which is the main reason it reads as bland | High | IMAGERY.md: 28 verified real candidates, one per key chosen by Yash |
| I-2 | Sign-in, request access, activate, verify OTP, forgot and reset password | Empty dark 55% panel; palette and accent menus in the header | High | AuthSplitLayout: 40% photo panel, form right, only a light/dark switch (R6 scope, pulled forward into the imagery phase) |
| I-3 | Public QR trace | Card inside card inside an empty dark frame; consumer sees internal tier names | High | Full-bleed orchard photo, one solid panel, consumer wording (imagery phase plus R6) |
| I-4 | Signed-in pages | Since the D-20 change the header is plain; with real photos a 176px banner can give each area its own place without hiding data | Medium | Reopen D-20 behind the existing `SIGNED_IN_PAGE_BANNERS` switch |
| I-5 | `--backdrop-scrim` | 0.82 opacity hides almost all of a photo | Medium | Lower to about 0.60 / 0.70, proven by `check:contrast` |
