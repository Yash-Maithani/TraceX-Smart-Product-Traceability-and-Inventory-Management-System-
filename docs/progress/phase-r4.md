# Redesign Phase R4: Imagery

> Date: 2026-10-24. Not committed (Yash commits). Builds on the uncommitted R1 to R3 work. Plan: [IMAGERY.md](../06-ui/IMAGERY.md).

## Yash's answers

1. Banners on signed-in pages: yes. Sign-in: a small preview of the product on the photo with two ways in. Request access was chosen over "create account" because accounts are approved by an administrator.
2. Photo picks: Claude's choice.
3. Download the originals: yes.
4. Unsplash and Pexels licences: yes.

## Photos

- 14 of 14 keys use real, licensed photos. AI images used: 0.
- Every original is in `frontend/design-assets/originals/<key>.jpg`. Nothing is hotlinked.
- Each one was checked by eye for text, logos, faces, screens and artefacts. Where the first choice failed that check or cropped badly, another listed candidate was used:
  - **auth:** option B (Ketan Pandey, Unsplash).
  - **dashboard:** option B (tea estate, Vasanth Kedige, Unsplash).
  - **batches:** option B (warehouse shelves, Tiger Lily, Pexels).
  - **dispatch:** option B (loading dock doors, BOOM Photography, Pexels).
  - **import:** the tomato crates (Serghey Savchuk, Unsplash) listed under inspections, because both clipboard options showed readable form text.
- The full list with links is in `backdrops.json` and on the Privacy page.
- Eight photos are cropped (`crop` in `backdrops.json`) to remove edges with text or clutter.
- `backdrops.json` records source, source page, author, licence, licence page, `approvedByOwner: true`, `placeholder: false` and `aiGenerated: false` for every key.

## Pipeline and gates

- `prepare-backdrops.mjs`: applies the crop, then steps the quality down until each file is within budget. All 126 files (14 keys, 3 sizes, AVIF/WebP/JPEG) are within the 60 / 120 / 250 KB budgets.
- `check:backdrops` now fails on `placeholder: true`, on a missing source, author or licence, and on `aiGenerated: true` without owner approval plus an `aiTool` and `aiPrompt` record. A new unit test covers it.
- `check:banned`: a manifest `"sourceUrl"` may point at an Unsplash photo page, because it is a credit link and not an image source. Everything else is still banned.

## Treatment

- Flat scrim, no gradient: `--backdrop-scrim` 0.66 in light and 0.74 in dark for all three palettes (was 0.82). Light banner subtitles and focus rings were lightened so `check:contrast` passes (212 pairs) against a worst-case white pixel.
- The `--backdrop-tint` idea from the plan was dropped: the per-palette scrim already makes the set look consistent, and a second layer would only lower contrast.
- `SIGNED_IN_PAGE_BANNERS = true`: signed-in pages show their photo in the page header again. The Page photos switch, Save-Data and print still hide every photo with no layout shift.

## Sign-in layout

- `AuthLayout` is reworked into a split layout. The photo sits on the left with a product preview: the heading "Batch records from farm to dispatch", a one-line description, three feature lines, the real status labels (no numbers), and the **Sign in** and **Request access** buttons. The form sits on the right.
- On phones the preview is a short band with the heading and the two buttons above the form.
- The header holds only the wordmark and the light/dark switch. The palette menu now lives only in signed-in Settings. The footer links to the Privacy Policy and Terms.
- Reading pages (privacy, terms, not found) use a photo band on top and a centred reading column.
- The public QR trace page keeps its full-bleed photo (Chaubatia orchards) behind one solid panel. The copy rework stays in R6.

## Photo credits

- The Privacy Policy has a new "Photo credits" section listing every photo's source, photographer and licence, with links.
- The list is read from `backdrops.json`, so it cannot drift. `LEGAL_UPDATED` is now 24 October 2026.

## Tests

- `PageBackdrop.test.tsx`: banners on, the new `check:backdrops` rules, and the scrim test updated to the new value.
- `e2e/phase05-1.spec.ts`: banners on the dashboard again, and the sign-in photo band height is now a minimum on phones and tablets.
- `e2e/phase05.spec.ts` (E2E-10): the palette is seeded through stored preferences, because the sign-in header no longer has a palette menu.

## Results

| Check | Result |
|---|---|
| Backend `mvnw clean verify` | 740 tests, 0 failures |
| Frontend unit (vitest) | 132 passed |
| Playwright | 48 passed |
| lint, typecheck | pass |
| check:banned, check:contrast (212), check:backdrops (14 keys, 0 placeholders) | pass |
| test:a11y | 11 passed; axe clean on sign-in, request access, privacy, dashboard, batches and FEFO at 1366 and 390, light and dark |

After screenshots refreshed: [docs/screenshots/after/](../screenshots/after/) (83).

OI-11 (replace placeholder photos before launch) is closed.

## R4.1: Public home page (added 2026-10-24)

Yash asked for a page that shows visitors what TraceX is before asking them to sign in (reference: the TracX-Hemshakti home page, layout idea only; none of its images, numbers or copy were reused).

- **Route:** a signed-out visitor at `/` now sees `HomePage` instead of being sent to `/login`. `RequireAuth` takes a `guestHome` prop and shows it only at `/`. Every other protected route still sends guests to sign-in, and signed-in users still get the dashboard at `/`. No new routes and no backend change.
- **Sections:**
  - Sticky header with section links, the light/dark switch and Sign in.
  - Photo hero (the `auth` terraces photo) with Sign in and Request access.
  - How it works (four steps) and What's inside (six parts of the app).
  - The real freshness labels and the five roles.
  - A call to action and a footer with the Privacy and Terms links.
- **Hard rules:** no numbers, stats or customer claims (a unit test checks the page text), no gradients, radius from tokens, lucide icons, no em dashes, and hover colour is the only motion. The copyright line reads "Copyright 2026" because `check:banned` treats the © sign as an emoji.
- **Links:** the TraceX wordmark on the sign-in, legal and trace pages now links to `/`.
- **Files:**
  - `src/features/public/HomePage.tsx`, `home.module.css` and `HomePage.test.tsx` (3 tests including axe).
  - `src/strings/home.ts`.
  - `src/auth/RequireAuth.tsx`, `src/App.tsx` and `src/pages/index.ts`.
  - `e2e/redesign-r4.spec.ts` (R4-E2E-01: guest home, no overflow at 1280 and 375, axe in light and dark, Request access and Sign in links, then sign-in lands on the dashboard and sign-out returns to sign-in).
- **Results:**
  - Unit: 135 passed.
  - Playwright: 49 passed.
  - Lint, typecheck, check:banned, check:contrast, check:backdrops and test:a11y pass.
  - Screenshots: `docs/screenshots/after/guest-home-*.png`.
