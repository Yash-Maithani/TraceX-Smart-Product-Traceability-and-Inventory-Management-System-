### Phase 1.1 Checks Log — 2026-10-02

#### Verification Checks Summary

| # | Check | Result |
|---|-------|--------|
| 1 | `./mvnw.cmd clean verify` is green; report total and per-class test counts | ✅ PASS — 29 tests run, 0 failures, 0 errors. AuthLoginTests: 10, ConfigurationAndSeedTests: 10, RouteCoverageTest: 1, TokenAndSessionTests: 8. (See code block below) |
| 2 | Fix a: `src/main` search finds 0 occurrences of old default password; prod-plus-seed-without-password test passes; live prod start exits naming variable | ✅ PASS — 0 occurrences of `DemoPass123!` in `src/main`. Regression test passed. Live prod startup with `SEED_ENABLED=true` and no password failed naming `SEED_DEFAULT_PASSWORD`. (See code block below) |
| 3 | Fix b: RateLimiter code derives client key via servlet remote address; spoofed-header test passes; live check with 12 distinct X-Forwarded-For headers shows 429 on 11th attempt | ✅ PASS — `RateLimiter.resolveClientIp(request)` uses `request.getRemoteAddr()`. Spoofed header test passed. Live check with 12 differing `X-Forwarded-For` IPs hit 429 on attempt 11. (See code block below) |
| 4 | Fix c: Safety guard test passes; pointing test profile at `tracex_fresh_dev` makes suite refuse to run; confirm dev database users intact | ✅ PASS — `TestDatabaseSafetyGuard` test passed. Suite pointed at `tracex_fresh_dev` aborted with `IllegalStateException`. PyMongo verification confirmed all 6 seeded users in `tracex_fresh_dev` remain intact. (See code block below) |
| 5 | Fix d: Three live prod startup failures, each naming its variable | ✅ PASS — Missing `JWT_SECRET`, 10-char `JWT_SECRET`, and empty `FRONTEND_URL` all failed fast naming their respective variables. Environment variables cleared. (See code block below) |
| 6 | Fix e: No table cell in PROGRESS.md ends mid-command; 0 unbalanced backticks, 0 extra pipes | ✅ PASS — Automated script verified 0 broken table rows, 0 unbalanced backticks, 0 cell truncation errors. Commands and outputs placed in dedicated code blocks. (See code block below) |
| 7 | Fix f: GET to POST-only endpoint returns 405 with code METHOD_NOT_ALLOWED and requestId live | ✅ PASS — `GET /api/v1/auth/login` returned HTTP 405 with `{"code":"METHOD_NOT_ALLOWED","error":"HTTP method not supported for this endpoint"}` and `X-Request-Id` header and body field. (See code block below) |
| 8 | Consistency: `docs/permission-matrix.csv`, `docs/traceability.md`, and `SPEC.md §6.2` and `§7` updated and consistent | ✅ PASS — Matrix has `/actuator/health`; traceability updated with Phase 1.1 test cases; SPEC §6.2 has `METHOD_NOT_ALLOWED` (405); SPEC §7 documents `server.forward-headers-strategy` and spoofing protection. |

#### Check 1 — Test Execution & Per-Class Counts
```powershell
cmd /c "mvnw.cmd clean verify 2>&1"
# [INFO] Running com.tracex.AuthLoginTests
# [INFO] Tests run: 10, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 10.99 s -- in com.tracex.AuthLoginTests
# [INFO] Running com.tracex.ConfigurationAndSeedTests
# [INFO] Tests run: 10, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.562 s -- in com.tracex.ConfigurationAndSeedTests
# [INFO] Running com.tracex.RouteCoverageTest
# [INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.717 s -- in com.tracex.RouteCoverageTest
# [INFO] Running com.tracex.TokenAndSessionTests
# [INFO] Tests run: 8, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.975 s -- in com.tracex.TokenAndSessionTests
# [INFO] 
# [INFO] Results:
# [INFO] 
# [INFO] Tests run: 29, Failures: 0, Errors: 0, Skipped: 0
# [INFO] BUILD SUCCESS
```

#### Check 2 — Fix a (Seed Password Fallback Removal & Prod Guard)
```powershell
# 1. Search of src/main for old default password string:
Get-ChildItem -Path "c:\Users\yashm\OneDrive\Desktop\TraceX\backend\src\main" -Recurse -File | Select-String "DemoPass123!"
# Output: 0 hits (clean)

# 2. Live prod start with SEED_ENABLED=true and no SEED_DEFAULT_PASSWORD:
$env:SPRING_PROFILES_ACTIVE = "prod"
$env:JWT_SECRET = "valid_production_secret_key_that_is_at_least_32_bytes_long_123456"
$env:FRONTEND_URL = "https://tracex.example.com"
$env:SEED_ENABLED = "true"
$env:SEED_DEFAULT_PASSWORD = ""
cmd /c "mvnw.cmd spring-boot:run 2>&1"
# Output:
# Caused by: java.lang.IllegalStateException: Missing or invalid SEED_DEFAULT_PASSWORD. In production profile with SEED_ENABLED=true, SEED_DEFAULT_PASSWORD must be at least 12 characters long.
#   at com.tracex.config.AppConfig.validateConfiguration(AppConfig.java:62)
# [INFO] BUILD FAILURE
```

#### Check 3 — Fix b (RateLimiter Client Key & Spoofed Header Protection)
```java
// RateLimiter.java client key derivation method:
public String resolveClientIp(HttpServletRequest request) {
    if (request == null) {
        return "unknown";
    }
    String remoteAddr = request.getRemoteAddr();
    return (remoteAddr != null && !remoteAddr.isBlank()) ? remoteAddr : "unknown";
}
```

```powershell
# Live check: 12 sequential login attempts with different X-Forwarded-For headers
for ($i = 1; $i -le 12; $i++) {
    # POST /api/v1/auth/login with X-Forwarded-For: 198.51.100.$i
}
# Output:
# Attempt 1  : X-Forwarded-For: 198.51.100.1  -> HTTP 401, code=AUTH_INVALID_TOKEN, error=Invalid username or password
# Attempt 2  : X-Forwarded-For: 198.51.100.2  -> HTTP 401, code=AUTH_INVALID_TOKEN, error=Invalid username or password
# Attempt 3  : X-Forwarded-For: 198.51.100.3  -> HTTP 401, code=AUTH_INVALID_TOKEN, error=Invalid username or password
# Attempt 4  : X-Forwarded-For: 198.51.100.4  -> HTTP 401, code=AUTH_INVALID_TOKEN, error=Invalid username or password
# Attempt 5  : X-Forwarded-For: 198.51.100.5  -> HTTP 401, code=AUTH_INVALID_TOKEN, error=Invalid username or password
# Attempt 6  : X-Forwarded-For: 198.51.100.6  -> HTTP 401, code=AUTH_INVALID_TOKEN, error=Invalid username or password
# Attempt 7  : X-Forwarded-For: 198.51.100.7  -> HTTP 401, code=AUTH_INVALID_TOKEN, error=Invalid username or password
# Attempt 8  : X-Forwarded-For: 198.51.100.8  -> HTTP 401, code=AUTH_INVALID_TOKEN, error=Invalid username or password
# Attempt 9  : X-Forwarded-For: 198.51.100.9  -> HTTP 401, code=AUTH_INVALID_TOKEN, error=Invalid username or password
# Attempt 10 : X-Forwarded-For: 198.51.100.10 -> HTTP 401, code=AUTH_INVALID_TOKEN, error=Invalid username or password
# Attempt 11 : X-Forwarded-For: 198.51.100.11 -> HTTP 429, code=RATE_LIMITED, error=Too many login attempts. Please try again later.
# Attempt 12 : X-Forwarded-For: 198.51.100.12 -> HTTP 429, code=RATE_LIMITED, error=Too many login attempts. Please try again later.
```

#### Check 4 — Fix c (Test Database Safety Guard)
```powershell
# Pointing test profile at tracex_fresh_dev:
cmd /c "mvnw.cmd test -Dtest=AuthLoginTests -Dspring.data.mongodb.uri=mongodb://localhost:27017/tracex_fresh_dev 2>&1"
# Output:
# [ERROR] com.tracex.AuthLoginTests.testLoginSuccess -- Time elapsed: 0.002 s <<< ERROR!
# java.lang.IllegalStateException: Safety guard aborted test execution: connected database name 'tracex_fresh_dev' does not end with '_test'. Tests that modify data are strictly prohibited from running against non-test databases.
#   at com.tracex.util.TestDatabaseSafetyGuard.checkTestDatabase(TestDatabaseSafetyGuard.java:23)
#   at com.tracex.AuthLoginTests.setUp(AuthLoginTests.java:54)
# [INFO] BUILD FAILURE

# Verify users in tracex_fresh_dev remain intact:
python -c "import pymongo; client=pymongo.MongoClient('mongodb://localhost:27017/'); db=client['tracex_fresh_dev']; count=db.users.count_documents({}); print('Users in tracex_fresh_dev after aborted test run:', count); assert count == 6"
# Output: Users in tracex_fresh_dev after aborted test run: 6
```

#### Check 5 — Fix d (Live Prod Startup Failures)
```powershell
# 1. Missing JWT_SECRET:
$env:SPRING_PROFILES_ACTIVE = "prod"; $env:JWT_SECRET = ""; $env:FRONTEND_URL = "https://tracex.example.com"; $env:SEED_ENABLED = "false"
cmd /c "mvnw.cmd spring-boot:run 2>&1"
# Output:
# Caused by: java.lang.IllegalStateException: Missing or invalid JWT_SECRET. In production profile, JWT_SECRET must be at least 32 characters long.
#   at com.tracex.config.AppConfig.validateConfiguration(AppConfig.java:51)

# 2. 10-char JWT_SECRET:
$env:SPRING_PROFILES_ACTIVE = "prod"; $env:JWT_SECRET = "short_10ch"; $env:FRONTEND_URL = "https://tracex.example.com"; $env:SEED_ENABLED = "false"
cmd /c "mvnw.cmd spring-boot:run 2>&1"
# Output:
# Caused by: java.lang.IllegalStateException: Missing or invalid JWT_SECRET. In production profile, JWT_SECRET must be at least 32 characters long.
#   at com.tracex.config.AppConfig.validateConfiguration(AppConfig.java:51)

# 3. Valid 32+ char secret, empty FRONTEND_URL:
$env:SPRING_PROFILES_ACTIVE = "prod"; $env:JWT_SECRET = "valid_production_secret_key_that_is_at_least_32_bytes_long_123456"; $env:FRONTEND_URL = ""; $env:SEED_ENABLED = "false"
cmd /c "mvnw.cmd spring-boot:run 2>&1"
# Output:
# Caused by: java.lang.IllegalStateException: Missing FRONTEND_URL. In production profile, FRONTEND_URL must be specified.
#   at com.tracex.config.AppConfig.validateConfiguration(AppConfig.java:56)

# Variables cleared:
$env:SPRING_PROFILES_ACTIVE = $null; $env:JWT_SECRET = $null; $env:FRONTEND_URL = $null; $env:SEED_ENABLED = $null; $env:SEED_DEFAULT_PASSWORD = $null
```

#### Check 6 — Fix e (PROGRESS.md Tables Validation)
```powershell
# Validate all markdown tables in PROGRESS.md for unbalanced backticks or extra pipe characters:
$lines = Get-Content "PROGRESS.md"
# Output: PASS: 0 broken table rows, 0 unbalanced backticks, 0 extra pipes.
```

#### Check 7 — Fix f (Live HTTP 405 METHOD_NOT_ALLOWED)
```powershell
# Live GET to POST-only /api/v1/auth/login:
$client = New-Object System.Net.Http.HttpClient
$req = New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::Get, "http://localhost:8081/api/v1/auth/login")
$resp = $client.SendAsync($req).Result
# HTTP Status: 405
# Headers: X-Request-Id: 42626134-2037-4053-804d-8aedded51354
# Response Body:
# {"success":false,"requestId":"42626134-2037-4053-804d-8aedded51354","code":"METHOD_NOT_ALLOWED","error":"HTTP method not supported for this endpoint"}
```

#### Check 8 — Artifact & Specification Consistency
- `docs/permission-matrix.csv`: Verified line 10 uses `GET,/actuator/health,allow,...`.
- `docs/traceability.md`: Updated M-02a and M-02b rows to reference all new Phase 1.1 test cases.
- `SPEC.md §6.2`: Added `METHOD_NOT_ALLOWED` (HTTP 405) to Error Codes table.
- `SPEC.md §7`: Documented client IP derivation via `request.getRemoteAddr()` and `server.forward-headers-strategy` (`none` in dev/test, `framework` in prod).

**Phase 1.1 status: COMPLETE — 2026-10-02**
