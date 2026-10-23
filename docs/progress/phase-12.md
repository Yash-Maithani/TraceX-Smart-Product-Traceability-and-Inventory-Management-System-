# Phase 12: UI Polish, Legal Pages, Favicon and Documentation

**Status**: COMPLETE  
**Date**: 2026-10-23  
**Baseline**: `113` frontend unit tests (`19` files), `48` Playwright E2E tests (`9` files); backend unchanged at `723`  
**Phase 12 Totals**: `116` frontend unit tests (`20` files, `+3`), `48` Playwright E2E tests (`9` files), `0` failures; backend `723` (no backend changes)  
**New Dependencies Added**: None (`sharp`, already a dev dependency, renders the icons)

Phase 12 closes the remaining fails from the UI hard rules audit (21 Oct 2026) that belong before go-live, adds the subtle animations Yash asked for in the project study, and makes the documentation readable for team members. The custom domain stays in Phase 14.

## Part A: Privacy Policy and Terms and Conditions

- `features/public/legalContent.ts`: the text of both pages as data, in plain language. Every statement matches the code: what each collection stores, the retention indexes (sign-ins 30 days, notifications 7 days, channel messages 90 days, comments and audit log kept), browser storage (`sessionStorage` token, `localStorage` display settings, no tracking cookies), emails sent, who sees what (public trace page never shows farmer names; AI and Google only when switched on, never farmer names to AI), choices, security, acceptable use, AI advice, liability, ending access and governing law (India). `Last updated 23 October 2026`.
- `features/public/PublicPages.tsx`: renders the sections in a wider card (`AuthLayout` `wide` prop, `46rem`).
- "Terms of Use" renamed "Terms and Conditions" in the three public footers and `STRINGS`; the one-sentence placeholders and the empty `src/pages/LegalPage.tsx` were removed.
- `layouts/AppShell.tsx`: Privacy Policy and Terms and Conditions links in the signed-in sidebar, which had none.
- No contact email is printed, because none has been agreed; the pages point to "your TraceX administrator". Add an address in `legalContent.ts` when one exists.

## Part B: Subtle Animations

All at `--duration-normal` (150 ms, the SPEC §5 limit), position only, so text never fades and colour contrast is identical in every frame (axe scans stay stable). The existing reduced-motion block in `tokens.css` sets every duration to `0s`.

| Where | Effect |
|---|---|
| Every signed-in page | Content settles up by 4 px when it opens (`AppShell.module.css` `.pageEnter`, keyed by route) |
| Dialogs | Backdrop fades in; panel rises 6 px from 99% scale |
| Toasts | Slide in 12 px from the right |
| Section cards | Border darkens on hover |
| Sidebar links | Background and colour ease on hover |

No scroll effects, no cursor effects, no animation library. The corrupted dash in the `tokens.css` reduced-motion comment was fixed.

## Part C: Favicon and App Icons

- `public/favicon.svg`: a white T on the cobalt accent (`#1d4ed8`) with a small emerald trace mark.
- `public/favicon.ico` (32 px, PNG inside an ICO container) and `public/apple-touch-icon.png` (180 px), built by `scripts/generate-icons.mjs` from the SVG.
- `index.html`: icon links and `theme-color`.

## Part D: Documentation for the Team

- `docs/project-guide.md` (new, "Start Here"): what TraceX does in five steps, who can do what, how it is built and where the code lives, how to run it, how the phases are organised, a glossary of the codes used in the other documents (`D-12`, `M-01`, `OI-05`, FEFO, quality hold, RBAC, SSE), and the checks to run before committing.
- `README.md`: link to the guide, Prerequisites (Java 21, Node 20, local MongoDB, PowerShell), the steps needed before the browser tests, and a Documentation list that marks `docs/BRIEF.md` and `docs/HANDOFF.md` as historical.
- `docs/BRIEF.md` and `docs/HANDOFF.md`: a banner saying they describe the old Node.js app.

## Tests

- `features/public/LegalAndIcons.test.tsx` (`3` tests): every Privacy Policy section renders and states the farmer-name, retention, storage and no-tracking facts plus the date; every Terms section renders with governing law; `index.html` links the three icons and the files exist.
- `PublicPages.test.tsx`: heading updated to "Terms and Conditions".
- `e2e/phase05-1.spec.ts` P51-E2E-05 repaired. It failed in the first Phase 12 run (and once in Phase 10.1) because since Phase 9 the account's saved display settings apply at sign-in, so the photo toggle could start from whatever an earlier test had saved, and a reload could happen before the change was saved. The test now sets the account to "photos off" through the API before signing in and waits for each save before toggling again or reloading. No app code changed for this.

---

## Verification

### Verification 1: Frontend checks and unit tests

`npm run lint`, `npm run typecheck`, `npm run check:banned`, `npm run check:api-drift`, `npm run check:permissions-drift` and `npm run check:contrast` exit `0`; `npx vitest run`:
```text
 Test Files  20 passed (20)
      Tests  116 passed (116)
```

### Verification 2: Playwright full E2E run

Same procedure as Phase 8.2 Verification 4 (`playwright-full.txt`), with the Phase 11 jar (no backend changes):
```text
  48 passed (4.8m)
```

### Verification 3: Markdown table linter

```text
Files checked: 46
Errors: 0
Warnings: 0
STATUS: PASSED (Zero problems found)
```
