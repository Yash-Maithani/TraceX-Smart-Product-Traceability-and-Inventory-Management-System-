# Phase 9: Team Admin UI, Settings, and Login History

**Status**: COMPLETE  
**Date**: 2026-10-22  
**Baseline**: `561` backend tests, `90` frontend unit tests (`15` files), `39` Playwright E2E tests (`5` files)  
**Phase 9 Totals**: `582` backend tests (`+21`: `+14` in `RbacMatrixTest`, `+7` in `SettingsAndLoginHistoryTests`), `98` frontend unit tests (`16` files, `+8`), `43` Playwright E2E tests (`6` files, `+4` in `phase09.spec.ts`), `0` failures  
**New Dependencies Added**: None (`0` backend, `0` frontend)

Phase 9 delivers the admin screens for the account and access-request APIs built in Phase 2 (M-08), display settings saved to the account, and login history (S-03). It follows the Phase 8.2 security fixes, which hardened the same code first.

## Decisions Taken (defaults posted in the project thread, 22 Oct 2026)

| Topic | Decision |
|---|---|
| Team screen | One `/team` page with Users, Access Requests and Recycle Bin tabs. `manager` sees Users and Access Requests read-only; `admin` and super-admin can change them; only super-admin sees the Recycle Bin. |
| Hidden actions | The page hides actions the server would refuse (yourself, any super-admin, and admins unless you are a super-admin; the `admin` role option only for super-admins), using the SPEC §2 Admin-vs-Admin table. The server stays the authority. |
| Settings sync | `mode`, `palette`, `accent` and `showPageImages` are saved to the account; the sidebar state stays local. Saved settings win at sign-in; if the account has none, the current local settings are saved to it; later changes save automatically after 800 ms. |
| Login history fields | `browser`, `os`, `device` and `method` only. No IP address and no city or country (the reference used a geo-IP lookup the new build does not have). |

---

## Part A: Backend

- `model/LoginEvent.java` (`loginevents`): TTL index `createdAt_ttl_idx` (`2,592,000` s) and `userId_createdAt_desc_idx`.
- `util/UserAgentParser.java`: broad browser, OS and device families; `QrService` now uses it for scan device types.
- `AuthService.login` writes a `LoginEvent` after a successful sign-in only; a failure to write it is logged (exception class only) and never blocks sign-in.
- `User.preferences` and `UserSummaryDto.preferences` (`null` until first saved).
- `PATCH /api/v1/auth/me/settings` (`UpdateSettingsDto`, `@Pattern` per field, 422 with `fieldErrors` on unknown values) and `GET /api/v1/auth/me/login-history` (own events, last 30 days, newest first, at most 50).
- Phase 9 rows of `docs/permission-matrix.csv` are active: `RbacMatrixTest` `371 -> 385` (`55` rows), `RouteCoverageTest` and `OpenApiExportTest` at `phase <= 9`. OpenAPI regenerated.
- `SettingsAndLoginHistoryTests.java` (`7` tests): saved and partial settings, `null` before first save, invalid values, sign-ins recorded with browser/OS/device and failed sign-ins not recorded, own and recent history only, index check, parser cases.

## Part B: Frontend

- `features/team/TeamPage.tsx` (`/team`, guarded by `GET /api/v1/auth/users`): role change, activate or deactivate, delete with an optional reason, approve, reject with an optional note, resend invite, remove request, and restore from the recycle bin. Every action shows a toast and refreshes the lists.
- `features/settings/SettingsPage.tsx` (`/settings`): theme (match device, light, dark), palette, accent, page photos, and a Recent sign-ins table. `/settings` previously showed the Profile page.
- `hooks/usePreferencesSync.ts`, mounted in `AppShell.tsx`, and `useTheme().applyAccountPreferences`.
- `routes/navConfig.ts`: Team & Access enabled, Settings added; Profile & Security now uses the shield icon.
- `api/endpoints.ts` and `api/types.ts`: Phase 9 calls and generated types.
- `TeamAndSettings.test.tsx` (`8` tests): super-admin with a `factory-manager` role sees every action and restores a user; admin cannot act on another admin and cannot grant `admin`; manager is read-only; approve, resend and reject; delete with reason; Settings list and theme change; sync applies saved settings without echoing them back, then saves a change; sync saves local settings to an account with none.
- `e2e/phase09.spec.ts` (`4` tests): admin approves a request on `/team` while a manager sees it read-only (axe clean); an inspector has no Team link and gets the 403 state; settings saved in one browser apply in another; Settings lists the sign-in (axe clean). `afterAll` removes the test request and resets the two accounts' settings.
- `docs/06-ui/screen-map.md`, `docs/traceability.md` (M-08 PASS, new S-03 row) and `SPEC.md` (§4 `loginevents`, §6.3 settings) updated.

---

## Verification

### Verification 1: Backend clean verify (`582` tests, `0` failures)

```powershell
cd backend; .\mvnw.cmd clean verify 2>&1 | Out-File -Encoding utf8 ..\docs\progress\evidence\phase-09\mvnw-clean-verify.txt
```
```text
[INFO] Tests run: 582, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

### Verification 2: Frontend checks and unit tests

`npm run lint`, `npm run typecheck`, `npm run check:banned`, `npm run check:api-drift` and `npm run check:permissions-drift` exit `0`; `npx vitest run`:
```text
 Test Files  16 passed (16)
      Tests  98 passed (98)
```

### Verification 3: Playwright full E2E run

Same procedure as Phase 8.2 Verification 4 (`playwright-full.txt`):
```text
  43 passed (3.2m)
```

### Verification 4: Markdown table linter

```text
Files checked: 40
Errors: 0
Warnings: 0
STATUS: PASSED (Zero problems found)
```
