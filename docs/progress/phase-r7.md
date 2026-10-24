# Redesign Phase R7: Final polish, before/after and launch check

> Date: 2026-10-24. Not committed (Yash commits). Builds on commit `5224c7f` plus the uncommitted R6 work. Frontend and docs only.

## Re-audit

- [AUDIT.md](../06-ui/AUDIT.md) now opens with **§0 After the redesign**:
  - All 10 top issues are marked fixed, each with where it was fixed.
  - An "after" line for every other area.
  - A short list of what is still open (all Low or Info, plus the custom domain).
- A source sweep finds none of the old jargon in the UI ("tokenVersion", "JWT", "(403)", "append-only", "server-derived", "days remaining", "FEFO Rank", "Freshness Tier").

## Polish in this phase

- **Remaining Title Case labels moved to sentence case:**
  - Batch detail field labels and the correction form ("Reason for the correction").
  - Create batch dialog ("Create batch", "Expiry date (optional)", "Village").
  - The error boundary ("Something went wrong").
  - The old trace link page ("This link format is no longer supported").
- **Sidebar names match the page titles:** Dispatch queue, Inspections, Import, Team, Profile and Archived batches. The forbidden page uses the same names.
- **Command palette:** each page has `keywords` in `navConfig.ts`, so the old names still find it ("fefo" finds Dispatch queue, "bulk" finds Import, "access" finds Team).

## Docs

- `SPEC.md` §5 now points to `DESIGN.md` as the UI source of truth and lists what changed. SPEC is kept, not replaced.
- `README.md` links DESIGN.md and the redesign evidence (audit, research, imagery, before and after screenshots).
- `docs/project-guide.md` lists the R1 to R7 phases, the `strings` and `design-assets` folders, the on-screen status names and the full check list.
- After screenshots refreshed: 83 files matching `before/`, plus `guest-home-*` for the public home page.

## Launch checklist (HARD UI RULE 9)

| Item | State |
|---|---|
| Custom domain connected | **Open. Needs Yash** (DNS and hosting are outside the code) |
| Real favicon | Done: `favicon.svg`, `favicon.ico` and `apple-touch-icon.png`, linked in `index.html` |
| No "made with AI" or builder tag | Done: none in `src`, `public` or `index.html`; `check:banned` guards it |
| Privacy Policy live | Done: `/privacy`, with contents list and photo credits |
| Terms and Conditions live | Done: `/terms`, with contents list |

## Tests

| Check | Result |
|---|---|
| Frontend unit (vitest) | 137 passed (the palette test now finds Dispatch queue by "fefo") |
| Playwright | 49 passed (`phase06`, `phase08` and `phase09` use the new sidebar names) |
| lint, typecheck, check:banned, check:contrast, check:backdrops, test:a11y | all pass |
| Backend | 744, unchanged since B-3 (no backend change in R6 or R7) |
| Axe on the home page | no serious or critical issues at 1366 and 390, light and dark |
