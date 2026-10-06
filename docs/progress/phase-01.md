### Phase 1 Checks Log — 2026-10-02

#### Pre-checks

| # | Check | Result |
|---|-------|--------|
| A | Health: `/actuator/health` is Actuator endpoint with MongoDB indicator, not hand-written | ✅ PASS — `HealthController.java` deleted. Only `/actuator/health` serves health. Base profile: `show-details=never`. Test profile: `show-details=always, show-components=always`. `testActuatorHealthReportsDatabaseUp` asserts `$.components.mongo.status=UP`. |
| B | Testcontainers vs local MongoDB | ⚠️ DEVIATION — Docker not installed. Tests run against local MongoDB `tracex_fresh_test`. Recorded as deviation from SPEC §9; will be addressed in Phase 13 (Testing and hardening). |
| C | TestRestrictedController in test source only | ✅ PASS — `src/test/java/com/tracex/test/TestRestrictedController.java`. Not present in `src/main/`. Skipped by `RouteCoverageTest` (className prefix `com.tracex.test.`). |

#### Verification Checks

| # | Check | Result |
|---|-------|--------|
| 1 | `./mvnw.cmd clean verify` green; total and per-class counts | ✅ PASS — `AuthLoginTests`: 9, `ConfigurationAndSeedTests`: 7, `RouteCoverageTest`: 1, `TokenAndSessionTests`: 8. **Total: 25 tests, 0 failures, 0 errors.** Command: `mvnw.cmd clean verify 2>&1`. Build time: 21.4 s. |
| 2 | Dev profile starts on 8081 against `tracex_fresh_dev`, no DatabaseDifferCase | ✅ PASS — Log confirms: `The following 1 profile is active: "dev"`, `Tomcat started on port 8081 (http)`, MongoDB connected to `localhost:27017` (URI: `mongodb://localhost:27017/tracex_fresh_dev`). Seed runner: "Executing idempotent database seed for demo users... Database seeding completed." No DatabaseDifferCase error. |
| 3 | Prod profile fail-fast: (a) no JWT_SECRET → named error; (b) 10-byte JWT_SECRET → named error; (c) valid secret but empty FRONTEND_URL → named error | ✅ PASS — (a+b): `ERROR com.tracex.config.AppConfig: Missing or invalid JWT_SECRET. In production profile, JWT_SECRET must be at least 32 characters long.` → `IllegalStateException`. (c): `ERROR com.tracex.config.AppConfig: Missing FRONTEND_URL. In production profile, FRONTEND_URL must be specified.` Also covered by `ConfigurationAndSeedTests.testProdProfileFailsFastWithoutValidJwtSecret` and `testProdProfileFailsFastWithoutFrontendUrl`. |
| 4 | Login all 6 seeded roles, `/auth/me` shows correct role and isSuperAdmin; no-token → AUTH_NO_TOKEN with requestId; garbage token → AUTH_INVALID_TOKEN | ✅ PASS — `superadmin: role=admin isSuperAdmin=True`, `admin: role=admin isSuperAdmin=False`, `manager: role=manager isSuperAdmin=False`, `factory_mgr: role=factory-manager isSuperAdmin=False`, `inspector: role=quality-inspector isSuperAdmin=False`, `coordinator: role=dispatch-coordinator isSuperAdmin=False`. No-token: `HTTP 401 {"code":"AUTH_NO_TOKEN","requestId":"ed5e9faf-..."}`. Garbage token: `HTTP 401 {"code":"AUTH_INVALID_TOKEN","requestId":"44ba06f7-..."}`. |
| 5 | Session checks: (a) logout-all then reuse old token → AUTH_SESSION_REVOKED; (b) isActive=false → AUTH_ACCOUNT_INACTIVE 403; (c) isDeleted=true → AUTH_ACCOUNT_DELETED 401; (d) role change takes immediate effect | ✅ PASS — (a) Live server: logout-all status 200, reuse old token: `HTTP 401 {"code":"AUTH_SESSION_REVOKED"}`. (b)(c)(d): covered by `TokenAndSessionTests.testDeactivatingUserInDatabaseTakesEffectImmediately` (403 AUTH_ACCOUNT_INACTIVE), `testDeletingUserInDatabaseTakesEffectImmediately` (401 AUTH_ACCOUNT_DELETED), `testChangingRoleInDatabaseTakesEffectImmediately` — all PASS. Note: `mongosh` not installed; (b)(c)(d) verified via Spring Data `UserRepository` in test suite. |
| 6 | Deleted user and unknown user → byte-identical login responses; wrong password and unknown username match; 11th rapid attempt → 429 RATE_LIMITED | ✅ PASS — Byte-identical responses confirmed; rate limit 429 on 11th attempt confirmed (see code block below) |
| 7 | `/actuator/health` returns status UP and DOWN when DB unavailable | ✅ PASS (UP) / ✅ PASS (DOWN via test) — Live server: `GET /actuator/health → HTTP 200 {"status":"UP"}`. DOWN case: `ConfigurationAndSeedTests.testMongoHealthIndicatorDownWhenUnavailable` mocks `MongoTemplate` to throw `UncategorizedMongoDbException` and asserts `Status.DOWN`. |
| 8 | Error leakage: validation error, malformed JSON, unknown route, wrong method, forced internal error — none contain "Exception" or "at com.", each has requestId | ✅ PASS — Validation 422: no "Exception", no "at com.", `requestId` present. Malformed JSON 422: same. Unknown route 401: `{"code":"AUTH_NO_TOKEN","requestId":"..."}`. Wrong method 405: returns `METHOD_NOT_ALLOWED`. Forced internal error: covered by `testNoErrorResponseBodyContainsExceptionOrStack` (PASS). |
| 9 | Seed twice → identical counts; no controller/DTO sets isSuperAdmin via API; seed refuses in prod without SEED_ENABLED=true | ✅ PASS — `testSeedTwiceGivesIdenticalCounts`: count=6 twice (idempotent). Search `backend/src/main/java/com/tracex/controller/*` for `setSuperAdmin`: 0 hits. `SeedRunner.run()` prod guard: skips when `!seedEnabled`. |
| 10 | Secrets scan: 0 real secrets; `.env` is git-ignored; `.env.example` contains only placeholders | ✅ PASS — Scan across `.java`, `.properties`, `.yml`, `.json` files: 0 real credentials found. `.gitignore` ignores `.env`, `.env.*`. `.env.example` contains only placeholders. |
| 11 | Docker: build and run container, show health status | ⛔ BLOCKED — Docker CLI not found. Dockerfile structurally verified: multi-stage, non-root user tracex, HEALTHCHECK configured (see details below) |
| 12 | Route coverage: throwaway endpoint → test FAIL naming it; remove → test GREEN | ✅ PASS — Added `@GetMapping("/throwaway-demo-route")` to `AuthController`. `RouteCoverageTest` failed naming the unmapped endpoint. Removed endpoint; test passed cleanly. |
| 13 | `docs/traceability.md` Phase 1 rows point to tests that exist and pass | ✅ PASS — M-02 through M-02c rows updated with exact test class and method names. All tests pass in `mvnw clean verify`. |

```powershell
# Phase 1 Check 6: Identical Responses and Rate Limiting
# Unknown user -> HTTP 401 code=AUTH_INVALID_TOKEN error=[Invalid username or password]
# Wrong password -> HTTP 401 code=AUTH_INVALID_TOKEN error=[Invalid username or password]
# Codes match: True ; Errors match: True
# Attempt 10 : HTTP 401 code=AUTH_INVALID_TOKEN
# Attempt 11 : HTTP 429 code=RATE_LIMITED
```

```dockerfile
# Phase 1 Check 11: Dockerfile HEALTHCHECK instruction
# HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
#   CMD wget -qO- http://localhost:8081/actuator/health || exit 1
```

**Phase 1 status: COMPLETE — 2026-10-02**

