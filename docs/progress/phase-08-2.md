# Phase 8.2: Security Fixes from the Strict Review

**Status**: COMPLETE  
**Date**: 2026-10-22  
**Baseline**: `542` backend tests, `88` frontend unit tests (`15` files), `39` Playwright E2E tests (`5` files)  
**Phase 8.2 Totals**: `561` backend tests (`+19` in `SecurityFixesTests`), `89` frontend unit tests (`15` files, `+1`), `39` Playwright E2E tests (`5` files), `0` failures  
**New Dependencies Added**: None (`0` backend, `0` frontend)

Phase 8.2 fixes the Critical findings (C1 to C3) and the High findings H1 to H9 of the strict PBL review dated 19 Oct 2026. They sit in the account, access-request and import code that Phase 9 puts an admin UI on, so they are fixed first. H10, H11 and M1 to M14 are recorded as `OI-12` for Phase 13 (H11 for Phase 14).

---

## Part A: Critical Findings

### C1. A deactivated user could reactivate themselves through `/verify-otp`
- `User` gains `otpPurpose` (`ACTIVATION` or `PASSWORD_RESET`) and `otpLockedUntil`.
- `UserService.verifyOtp` rejects any account whose email is already verified, and any OTP whose purpose is not `ACTIVATION`. `verifyResetOtp` only accepts `PASSWORD_RESET`. `resetPassword` also requires an active account.
- `toggleUserStatus` clears the OTP and reset token when it deactivates a user.
- Tests: `resetOtpCannotReactivateDeactivatedUser`, `deactivationClearsOutstandingCodes`, `activationOtpRejectedByResetEndpoint`.

### C2. A rejected access request could still create an account
- `AccessRequestService.rejectRequest` clears `inviteToken` and `inviteExpiry`, and refuses to reject a request that is already rejected or whose invite was used (`409 CONFLICT`).
- `UserService.activateAccount` requires `status == APPROVED`.
- Tests: `rejectedInviteCannotActivate`, `nonApprovedRequestCannotActivate`.

### C3. Insecure by default when the profile is not set
- `application.properties`: `spring.profiles.active` has no default, and `tracex.mail.sink.enabled` defaults to `false` (real SMTP). Only `dev`, `test` and `e2e` turn the mail sink on.
- `AppConfig`: production fail-fast checks run unless `dev`, `test` or `e2e` is active, so a missing profile fails safe.
- `JwtService`: no hard-coded default secret and no zero-padding; a missing or short secret stops startup (also fixes M13's padding).
- `TraceTokenService`: no hard-coded fallback secret.
- `DevMailSink`: no `matchIfMissing`.
- `backend/Dockerfile`: `ENV SPRING_PROFILES_ACTIVE=prod`.
- `README.md` explains that the `dev` profile must be named.
- Tests: `noProfileRunsProductionChecks`, `jwtServiceRejectsShortSecret`.

## Part B: High Findings in Code

| Finding | Fix | Test (`SecurityFixesTests`) |
|---|---|---|
| H1 Super-admin with a non-admin role locked out | `@PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")` on every admin-only endpoint in `UserController` and `AccessRequestController` | `superAdminWithNonAdminRoleCanUseAdminEndpoints` |
| H2 `request-access` leaked existing emails | Duplicate email or existing account returns the same generic 200 body and stores nothing | `requestAccessDoesNotRevealExistingAccounts`; `AccessRequestAndUserFlowTests.testCheck8ValidationAndConflictRules` updated |
| H3 OTP lockout bypass | Each guess is reserved with an atomic `findAndModify` before comparing; a new code does not reset the counter; lockout lasts 15 minutes; `/verify-otp` and `/verify-reset-otp` limited per IP (`tracex.rate-limit.verify-otp`, default `20` per 15 minutes) | `forgotPasswordDoesNotResetAttempts`, `lockoutExpires`, `parallelGuessesAreCountedAtomically` |
| H4 Email change without a password | `PATCH /me` is `@Valid`; `UpdateProfileDto` gains `@Email`/`@Size` and `currentPassword`; changing the email needs the current password and clears outstanding codes. `ProfilePage.tsx` shows a Current Password field only when the email changes | `emailChangeNeedsCurrentPassword`, `profileEmailIsValidated`; `FefoAndInspectionsAndProfile.test.tsx` Â· `asks for the current password only when the email changes` |
| H5 Login revealed deactivated accounts | `AuthService.login` checks the password before account status | `loginChecksPasswordBeforeStatus` |
| H6 Dispatched batch data could be rewritten | `updateRawMaterial` returns `409` for `DISPATCHED` batches, requires `expiryDate` after `packDate`, recomputes `priorityScore`, and records old and new values in the note history and the audit `before`/`after` (`farmerName` redacted there, per `D-9`) | `dispatchedBatchRawMaterialIsFrozen`, `expiryMustFollowPackDate`, `correctionRecordsBeforeAndAfter` |
| H7 Anyone could roll back anyone's import | `ImportService.rollback` allows only the job's creator, an `admin`, or a super-admin (`403 RBAC_INSUFFICIENT` otherwise) | `rollbackRequiresOwnerOrAdmin` |

The OpenAPI contract was regenerated (`OpenApiExportTest -Dexport.openapi=true`, then `frontend/scripts/generate-openapi.mjs`) for the new `request-access` response and `UpdateProfileDto.currentPassword`.

## Part C: High Findings in Documentation

### H8. One source of truth for RBAC
`SPEC.md` Â§2 now says `docs/permission-matrix.csv` (enforced by `RbacMatrixTest`) decides who may call each endpoint, and the Admin-vs-Admin table (enforced by `AdminVsAdminRulesTest`) decides what an allowed actor may do to a target. Three contradictions were corrected to match the code and tests:
- Admin acting on another admin: the table now says deny (`403 RBAC_INSUFFICIENT`), as the code and `AdminVsAdminRulesTest` do.
- Manager: may create batches and edit notes and raw material, as the matrix allows.
- Self-action error code: `SELF_MODIFICATION_NOT_ALLOWED`, not `CONFLICT`.
Stale `UserService.java` line numbers were replaced with method names. SPEC Â§6.3 and Â§7 describe the new OTP, profile, raw-material, request-access and rollback rules.

### H9. Traceability matrix cited tests that do not exist
A script read every `` `Class` Â· `method` `` citation in `docs/traceability.md` and checked it against `backend/src/test/java`. `16` of `71` did not exist; each was replaced with the real test that covers it (for example `testBatchCodeIsMonthlyAndAtomic` became `testFiftyParallelBatchCreationsGivingUniqueContiguousCodes`, `testMonthRollover` and `testYearRollover`). After the change the script reports `0` missing. M-08 now says its UI is Phase 9, M-09 is Phase 10, and `S-02` and `SEC-8.2` rows were added.

---

## Verification

### Verification 1: Backend clean verify

Command:
```powershell
cd backend; .\mvnw.cmd clean verify 2>&1 | Tee-Object -FilePath ..\docs\progress\evidence\phase-08-2\mvnw-clean-verify.txt
```

Output (`mvnw-clean-verify.txt` tail):
```text
[INFO] Tests run: 561, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

### Verification 2: Frontend checks and unit tests

Commands (each captured to `docs/progress/evidence/phase-08-2/frontend-<name>.txt`): `npm run lint`, `npm run typecheck`, `npm run check:banned`, `npm run check:api-drift`, `npm run check:permissions-drift` (all exit `0`), then `npx vitest run`.

Output (`frontend-unit.txt` tail):
```text
 Test Files  15 passed (15)
      Tests  89 passed (89)
```

### Verification 3: Markdown table linter

```text
Files checked: 38
Errors: 0
Warnings: 0
STATUS: PASSED (Zero problems found)
```

### Verification 4: Playwright full E2E run

Backend started with `.\mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=e2e"` after `scripts/e2e-reset.ps1`; then `npx playwright test` captured to `playwright-full.txt`. The backend must be started from the freshly built jar (`java -jar target/tracex-backend-1.0.0-SNAPSHOT.jar --spring.profiles.active=e2e`), because `E2E-08` stops it and restarts it from that jar, and no Vite dev server may already be listening on port `5174` (Playwright reuses it, and a dev-mode server talks to the dev backend). Screenshots and the Phase 8 CSV fixture that the run regenerates were reverted so earlier phases' evidence is unchanged.

```text
  39 passed (2.8m)
```
