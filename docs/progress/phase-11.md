# Phase 11: AI Dispatch Audit and Google Sign-in (S-01, S-07)

**Status**: COMPLETE (both features switch on when their keys are set)  
**Date**: 2026-10-23  
**Baseline**: `676` backend tests, `108` frontend unit tests (`18` files), `47` Playwright E2E tests (`8` files)  
**Phase 11 Totals**: `723` backend tests (`+47`: `+35` in `RbacMatrixTest`, `+6` in `AiAuditTests`, `+6` in `GoogleSignInTests`), `113` frontend unit tests (`19` files, `+5`), `48` Playwright E2E tests (`9` files, `+1` in `phase11.spec.ts`), `0` failures  
**New Dependencies Added**: None (`0` backend, `0` frontend; HTTP calls use the JDK `HttpClient`)

Phase 11 ports the reference AI dispatch audit (`TracX-Hemshakti(Build)/backend/src/services/aiService.js`) and Google sign-in (`googleAuth.controller.js`, `auth.controller.js` `linkGoogle` / `unlinkGoogle`). Yash will add the real keys after the project is finished, so both features are built to stay hidden and refuse cleanly until then, and every test uses fakes. How to get and set the keys: [docs/setup/api-keys.md](../setup/api-keys.md).

## Decisions Taken

| Topic | Decision |
|---|---|
| Keys | Read only by the backend from environment variables, or from an untracked `backend/.env` (`spring.config.import=optional:file:.env[.properties]`). `.env.example` values are empty, so copying it never "switches on" a fake key. The Google client ID is public by design and is the only value in a `VITE_` variable. |
| AI privacy (D-9, `OI-05`) | The prompt carries batch code, product, SKU, status, days to expiry, quantity, unit, yield, village and data source. Never `farmerName`. |
| AI output | Treated as untrusted: batch codes not in the input are dropped, expired batches are never dispatch picks, severities are normalised, text is length-capped. The UI says the advice can be wrong and nothing is dispatched by it. |
| AI limits | 5 audits per 15 minutes per user (the reference used per IP); answers cached for 4 hours unless "Run again" is pressed. Provider errors and raw model text are never logged or returned. |
| Google token | The Google Identity Services ID token, checked for our `aud`, a Google `iss`, `email_verified` and expiry. The reference accepted an access token and only called `userinfo`, which does not prove the token was issued to TraceX. |
| Google accounts | Sign-in only for accounts that linked that Google email while signed in; nothing is auto-created. One Google account per TraceX account. Deactivated accounts are refused. Sign-ins are recorded with `method = "google"`. |

---

## Part A: Backend

- `service/ai/AiProvider.java`, `GeminiProvider.java` (`gemini-2.5-flash`, key in the `x-goog-api-key` header), `NvidiaProvider.java` (`meta/llama-3.1-70b-instruct`), `AiAuditService.java`, `controller/AiController.java`, `dto/AiAuditDtos.java`.
- `security/GoogleTokenVerifier.java`, `dto/GoogleCredentialDto.java`, `AuthService.googleLogin`, `UserService.linkGoogle` / `unlinkGoogle`, `AuthController` (`POST /api/v1/auth/google/token`, `POST` / `DELETE /api/v1/auth/me/google-link`), `User.googleEmail` (unique sparse index) and `googleLinkedAt`, `UserSummaryDto.googleEmail`, `SecurityConfig` (public `google/token`).
- `ErrorCode`: `GOOGLE_SIGN_IN_UNAVAILABLE` (503) and `AUTH_GOOGLE_NOT_LINKED` (403), added to SPEC §6.2 (`ErrorCodeSpecSyncTest` passes).
- `application.properties`: `.env` import and the `tracex.ai.*`, `tracex.google.client-id` and `tracex.rate-limit.ai-audit` settings. The `test` and `e2e` profiles blank every key so tests never reach a real provider even if a developer has a `backend/.env`.
- `docs/permission-matrix.csv`: `POST /api/v1/auth/google/token` (public) and `GET /api/v1/ai/status` added; the existing Phase 11 rows are active. `RbacMatrixTest` `497`, `RouteCoverageTest` and `OpenApiExportTest` `71` rows.
- `AiAuditTests.java` (`6`): disabled without keys; prompt has village but no farmer name and invented or expired picks are dropped; NVIDIA fallback and total failure without leaking provider detail; cache and refresh; unreadable output is `503`; per-user limit.
- `GoogleSignInTests.java` (`6`): link then sign in (login event `google`); not linked `403`, bad token `401`, empty body `422`; one Google account per user (`409`); unlink and deactivation; not configured `503`; claim checks for audience, issuer, verified email and expiry.
- Checked by hand: with a temporary `backend/.env` holding only a dummy `GOOGLE_CLIENT_ID`, the packaged jar answered `401` (configured) instead of `503`; the file was then deleted.

## Part B: Frontend

- `features/fefo/AiAuditPanel.tsx` on `/fefo`: hidden unless `GET /api/v1/ai/status` says enabled; Run audit and Run again; summary, dispatch picks, urgent batches, quality warnings, risks, provider and time.
- `lib/googleIdentity.ts` and `components/GoogleSignInButton.tsx`: Google's script is loaded only when `VITE_GOOGLE_CLIENT_ID` is set; nothing renders otherwise.
- `LoginPage.tsx`: Google button below the form. `features/profile/GoogleLinkCard.tsx` on `/profile`: link with Google, or unlink.
- `vite.config.ts`: the production CSP allows Google's script, style, frame and connect origins only when the client ID is set. `vite-env.d.ts` types the two `VITE_` variables. `frontend/.env.example` gains an empty `VITE_GOOGLE_CLIENT_ID`.
- `AiAndGoogle.test.tsx` (`5` tests) and `e2e/phase11.spec.ts` (`1` test: with no keys the AI panel and Google buttons are hidden and the API answers `503`).

## Part C: Documentation

[docs/setup/api-keys.md](../setup/api-keys.md) (new), `README.md`, `SPEC.md` (§6.2 error codes, §6.3 auth and AI rows), `docs/06-ui/screen-map.md` (rows 2, 3, 4, 61), `docs/traceability.md` (S-01 and S-07 rows), `PROGRESS.md` (`OI-05` closed).

**Not verified**: calls to the real Gemini, NVIDIA and Google services, because no keys exist yet. Once keys are added, follow Step 4 of the guide to check both features by hand.

---

## Verification

### Verification 1: Backend clean verify (`723` tests, `0` failures)

```text
[INFO] Tests run: 723, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

### Verification 2: Frontend checks and unit tests

`npm run lint`, `npm run typecheck`, `npm run check:banned`, `npm run check:api-drift` and `npm run check:permissions-drift` exit `0`; `npx vitest run`:
```text
 Test Files  19 passed (19)
      Tests  113 passed (113)
```

### Verification 3: Playwright full E2E run

Same procedure as Phase 8.2 Verification 4 (`playwright-full.txt`), with nothing else running:
```text
  48 passed (3.9m)
```

### Verification 4: Markdown table linter

```text
Files checked: 44
Errors: 0
Warnings: 0
STATUS: PASSED (Zero problems found)
```
