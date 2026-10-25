# AI Phase: Useful AI (dispatch brief, Ask TraceX, inspection assistant)

> Date: 2026-10-24. Not committed (Yash commits). Builds on `88d25d3`. Requested by Yash: the course requires AI, and it must be useful.

## The rule for all three features

**The server decides, the AI helps a person decide faster, and a person confirms anything that changes data.** Every model answer is treated as untrusted input:
- it is checked against the server's own values;
- anything invented is dropped;
- nothing is saved or dispatched by the AI.

All features use one gateway (`service/ai/AiGateway.java`): Gemini first, NVIDIA as backup. Provider errors and raw model text are never logged or returned.

## 1. Dispatch brief (replaces the old "AI dispatch audit")

Problems found in the old audit (code review, 2026-10-24):
- The prompt had no inspection data, so the model could suggest shipping a batch that is on hold.
- Its "top 3" could disagree with the dispatch queue order.
- The answer was cached for 4 hours and never cleared when batches changed, so it could suggest a batch already dispatched.

Now:
- **Facts come from rules** and are always shown, even with no key:
  - **Ship next:** the first batch per product that is not on hold, in FEFO order.
  - **Needs attention:** expiring within 7 days, on hold, expired, and quality warnings (yield under 70%, or an expiry date that was not predicted).
- **The AI adds only a summary and patterns the rules cannot see**, such as one village supplying most stock, one product dominating, or many batches expiring in the same week. It runs only when a person clicks **Write AI summary**.
  - The prompt now includes each batch's latest inspection verdict.
  - A risk or summary that names a batch code not in the data is dropped.
- **Cache follows the data:** a fingerprint of codes, statuses, verdicts and days left. Any dispatch, inspection, new batch or archive makes a new summary necessary. "Write it again" forces one.
- **Limits:** 5 model calls per user per 15 minutes. When the limit is hit or the model fails, the facts still show with a plain note.
- **API:** `POST /api/v1/ai/dispatch-audit?ai=false` (facts only, no model call) or `?ai=true[&refresh=true]`. The response is `DispatchAdvice { nextToShip, urgent, onHold, expired, qualityWarnings, ai, aiNote }`.
- **UI:** `features/fefo/DispatchBriefPanel.tsx` on the Dispatch queue page. It shares the `fefo` query key, so it refreshes with the queue after a dispatch.

## 2. Ask TraceX (Ctrl+K search)

- **When it appears:** type a question of three or more words, for example "jam batches expiring this week, not inspected", and an **Ask TraceX** option appears in the command palette. It is offered only when an AI key is set.
- **What the model does:** it only proposes a filter of statuses, product, expiry range, text and inspection verdict.
- **What the server checks:**
  - Unknown statuses, SKUs, dates and verdicts are dropped.
  - Reversed dates are swapped.
- **How the answer is built:**
  - The server runs the filter through the normal batch list.
  - It writes the description of what was searched itself.
  - It returns up to 10 real batches and the total.
  - So the answer can never contain a batch that does not exist.
- **Prompt safety:** the question is fenced in the prompt and marked as a search request, not instructions.
- **Limits:** 20 questions per user per 15 minutes.
- **UI:**
  - The answer shows inside the palette with links to each batch.
  - "Open in the batch list" carries the parts the list can show: one status, product, dates and text.
- **API:** `POST /api/v1/ai/ask { question }` returns `AskAnswer { filter, description, total, batches, provider }`. Every signed-in role may ask; results are limited to batches they could already list.

## 3. Inspection assistant (Record inspection form)

- **What the inspector does:** writes notes in their own words, then clicks **Fill the form from my notes**. The model drafts the 8 checks, verdict, rating, findings and recommendation. The inspector reviews everything, then saves with the normal button.
- **What the server checks:**
  - Labels are always the fixed 8.
  - A check the notes do not mention stays "Not checked".
  - A Passed verdict with a failed check becomes Flagged.
  - The rating is kept between 1 and 5.
  - Each correction is listed in `adjustments` and shown to the inspector.
- **Rules still apply:** the normal create endpoint still enforces every rule, for example "Passed needs every check to pass".
- **Access:** only inspectors, admins and the super admin, the same roles as `POST /inspections`. Limited to 20 drafts per user per 15 minutes.
- **Privacy:** the hint asks inspectors to leave out personal names, because notes go to the AI service.
- **API:** `POST /api/v1/ai/inspection-draft { notes }` returns `InspectionDraft`.

## Privacy and docs

- The Privacy Policy and Terms list exactly what each feature sends and say that output is advice only.
- `SPEC.md` (AI privacy D-9) and `docs/setup/api-keys.md` are updated. The key guide now has a test step for each feature.
- `docs/permission-matrix.csv` has 2 new rows (73 in total). `permissions.generated.ts` was regenerated, and OpenAPI re-exported.

## Tests

| Check | Result |
|---|---|
| Backend | 764 tests, 0 failures. Includes `AiAuditTests` (7) and the new `AiAskAndDraftTests` (5), all with a fake model. `RbacMatrixTest` now has 511 cases. |
| Frontend unit | 142 passed: the dispatch brief (3), Ask TraceX in the palette (3) and the inspection assistant (2) |
| Playwright | 49 passed. `P11-E2E-01` now checks that, with no key, the brief shows rule facts, the AI block is hidden, `dispatch-audit` answers 200 with `aiNote: off`, and `ask` answers 503. |
| lint, typecheck, check:banned, check:contrast, check:backdrops, check:permissions-drift, check:api-drift, test:a11y | all pass |

## Real run with Yash's free Gemini key (2026-10-25)

The key sits in `backend/.env`, which git ignores. It was never printed or logged.

What broke, and the fixes:
- **Retired model:** `gemini-2.5-flash` (the Phase 11 default) answered **404**, because Google no longer offers it to new keys. `gemini-2.0-flash` answered 404 too.
- **Busy models:** `gemini-flash-latest` and `gemini-3.8-flash` answered **503 high demand**, and sometimes hung until the 45-second timeout.
- **Fix:** `GeminiProvider` now tries an ordered list (`GEMINI_MODELS`, default `gemini-flash-lite-latest,gemini-3.5-flash,gemini-flash-latest`).
  - A 404, 429 or 5xx, or no answer within 15 seconds, hands over to the next model.
  - A 400 or 403 stops, because another model would not help.
  - Only the model name and the HTTP status are logged.
  - It reads the first non-thinking text part, because newer models can add a separate thinking part.
- **Prompt:** the summary prompt now forbids calling an uninspected batch "approved", and forbids filler phrases. The model had written "four approved batches" when two were not inspected.

Results with the key (dev data):

| Feature | Result | Time |
|---|---|---|
| Dispatch brief, AI summary | Correct summary naming the held and expired batches, plus a HIGH risk that "9 of 11 batches come from Demo Village" | about 5 s |
| Ask: "show expired batches" | filter `EXPIRED`, 1 match (TX-2026-10-001) | about 4 s |
| Ask: "expiring soon batches of wild berry juice" | filter WBJC plus expiring or expiring soon, 1 match (TX-2026-10-014) | under 5 s |
| Ask: "which jam batches expire this week and are not inspected?" | filter ABHJAM, this week, not inspected: 0 matches. This is correct: the only jam batch in that window has a failed inspection. | about 1 s |
| Inspection assistant (broken seals, label smudge) | 8 checks filled, failing checks marked, verdict Flagged, findings and recommendation drafted | about 4 s |

Axe shows no serious or critical issues on the brief with the AI summary, the Ask answer in the palette, and the filled inspection form.

Backend tests after the fixes: 764, 0 failures.
