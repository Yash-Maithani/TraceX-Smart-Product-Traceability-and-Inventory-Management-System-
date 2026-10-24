# Redesign Phase R6: Team, settings, profile, forbidden, QR trace, legal and styleguide

> Date: 2026-10-24. Not committed (Yash commits). Builds on commit `5224c7f` (R1 to R5). Frontend only; no API or backend change.

## Team (`/team`)

- **Tabs:** People, Access requests and Deleted, with counts. Access requests counts pending ones. The open tab is kept in the URL (`?tab=requests` still works from the dashboard).
- **Search:** one search box filters the open list by name, username or email.
- **Row menu:** Change role, Activate or Deactivate, and Delete account move into a row menu ("…"). Red appears only on "Delete account" inside the menu and on the confirm button (AUDIT §3.8). Access requests keep Approve and Resend invite as buttons; Reject and Remove request sit in the row menu.
- **Layout:** the lists are now plain lists with a fixed action column, not scrolling tables, so a row menu is never clipped and rows line up.
- **Confirms name the person and the effect:**
  - "Delete the account of …?" with the buttons "Delete account" and "Keep account".
  - "Reject the request from …?" with the buttons "Reject request" and "Keep request".
- New `strings/team.ts`.

## Forbidden and not found

- **Forbidden:** a single centred card, not a banner plus a card repeating the title.
  - The title names the page: "You do not have access to Team & Access".
  - The body names the viewer's role: "Your role is Quality Inspector. Ask an administrator if you need access."
  - Required roles use their labels, and "super-admin" now reads "Super administrator".
  - No "(403)" anywhere.
- **Not found:** the title is "Page not found", with a plain line and one "Go to the home page" button. There is no nested empty-state box.

## Settings and profile

- **Settings:**
  - Sign-in history shows "Unknown browser" and "Unknown system" where the server recorded "Other".
  - Times no longer wrap.
  - The accent option is "Palette default".
- **Profile:**
  - No internal terms: "tokenVersion" and "JWT" are gone. Changing your password now says "Every other browser signed in to your account is signed out. This one stays signed in."
  - Sign out everywhere uses the same confirm as the account menu, with the buttons "Sign out everywhere" and "Stay signed in".
  - Labels are in sentence case.

## Public QR trace page (`/trace/t/:token`)

- **Shopper wording** (new `strings/trace.ts`):
  - The product name is the heading, followed by "This is a recorded TraceX batch." and the batch code.
  - Key facts come first: **Best before**, Packed, From (village) and Product code.
  - The freshness status is translated for shoppers, for example "Fresh", "Best used soon" or "Dispatched to the seller", instead of internal tiers such as "Urgent".
- **Journey:** a short journey shows where the batch has been: collected from the village, packed, quality check, and dispatched when it applies.
- **Layout:**
  - One solid panel over the orchard photo. The inner card is gone (AUDIT §3.12).
  - Invalid and error links show a plain heading and line, with no nested boxes.
  - The header has only the wordmark and the light/dark switch.
  - The footer links are spaced and labelled. They were "Privacy PolicyTerms and Conditions" with no gap.
- **Privacy text:** updated to match what the page now shows (village, dates, freshness and the latest quality check, never the farmer's name or contacts).

## Legal pages

- Privacy and Terms open with an "On this page" contents list linking to each section, including Photo credits.
- The reading column stays at 70 characters.
- Facts rechecked against the code. The browser-storage line now includes the table row height that R1 added.
- Launch checks:
  - The favicon files (`favicon.svg`, `favicon.ico`, `apple-touch-icon.png`) exist and are linked in `index.html`.
  - No "made with" or builder tag anywhere. The only match is the checker's own test fixture.

## Styleguide (`/_styleguide`, dev only)

- New "Console components" section:
  - Stat cards in every tone, plus a link card and the unavailable state.
  - Tabs with counts and a tab panel.
  - Filter chips (empty and active) and the date range chip.
  - The shelf-life rail in all five states.
  - A timeline with every tone and a condensed entry.
  - Links styled as buttons, and keyboard keys.

## Tests

- **Unit (137):**
  - The team tests open the row menu for role, activation and delete, and check search.
  - The trace tests check shopper wording (no "urgent") and the journey.
- **Playwright (49):**
  - `phase09` checks the row-menu trigger.
  - `phase08` uses the new forbidden title.
- **Checks:** lint, typecheck, check:banned, check:contrast, check:backdrops and test:a11y all pass. Axe shows no serious or critical issues on team (with the menu open), access requests, settings, profile, forbidden, not found, trace, invalid trace, privacy and the styleguide, at 1366 and 390, light and dark. No horizontal overflow.
- **Backend:** 744 tests, unchanged since B-3.
