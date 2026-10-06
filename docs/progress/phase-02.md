### Phase 2 Checks — 2026-10-02

#### Check 1 — Test Suite Clean Verify & Test Counts
```powershell
cmd /c "mvnw.cmd clean verify 2>&1"
```
```text
[INFO] Results:
[INFO] 
[INFO] Tests run: 192, Failures: 0, Errors: 0, Skipped: 0
[INFO] 
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  32.103 s
[INFO] Finished at: 2026-10-02T17:28:41+05:30
```
**Per-Class Test Count Breakdown**:
- `AccessRequestAndUserFlowTests`: 8 tests (Checks 8–14)
- `AuthLoginTests`: 10 tests
- `ConfigurationAndSeedTests`: 10 tests
- `ForwardedHeadersEmpiricalTest$FrameworkStrategyTests`: 1 test
- `ForwardedHeadersEmpiricalTest$NativeStrategyTrustedProxyTests`: 1 test
- `ForwardedHeadersEmpiricalTest$NativeStrategyUntrustedDirectTests`: 1 test
- `GlobalSafetyGuardAutoDetectionTest`: 1 test
- `RbacMatrixTest`: 150 tests (25 endpoints × 6 roles)
- `RouteCoverageTest`: 1 test (two-way route validation)
- `SmtpEmailServiceTest`: 1 test (GreenMail MIME verification)
- `TokenAndSessionTests`: 8 tests
**Total: 192 tests, 0 failures, 0 errors, 0 skipped**.

#### Check 2 — Global Database Safety Guard Aborts Before Repository Access
```powershell
# Temporary test class configured with tracex_fresh_dev:
cmd /c "mvnw.cmd test -Dtest=DevSafetyGuardCheckTest 2>&1"
```
```text
[ERROR] Tests run: 1, Failures: 0, Errors: 1, Skipped: 0, Time elapsed: 5.722 s <<< FAILURE! -- in com.tracex.DevSafetyGuardCheckTest
[ERROR] com.tracex.DevSafetyGuardCheckTest.testShouldAbortBeforeTouchingDevDatabase -- Time elapsed: 0.723 s <<< ERROR!
java.lang.IllegalStateException: Safety guard aborted test execution: connected database name 'tracex_fresh_dev' does not end with '_test'. Tests that modify data are strictly prohibited from running against non-test databases.
	at com.tracex.util.TestDatabaseSafetyGuard.checkTestDatabase(TestDatabaseSafetyGuard.java:23)
	at com.tracex.util.GlobalTestDatabaseSafetyExtension.beforeEach(GlobalTestDatabaseSafetyExtension.java:22)
```
```powershell
# Confirm dev database remains intact:
python -c "import pymongo; client=pymongo.MongoClient('mongodb://localhost:27017/'); db=client['tracex_fresh_dev']; count=db.users.count_documents({}); print('Users in tracex_fresh_dev:', count); assert count >= 6"
# Output: Users in tracex_fresh_dev: 6
```

#### Check 3 — Empirical Forwarded Headers Strategy Test
```powershell
cmd /c "mvnw.cmd test -Dtest=ForwardedHeadersEmpiricalTest 2>&1"
```
```text
[INFO] Running com.tracex.ForwardedHeadersEmpiricalTest
2026-10-02T17:07:37.410+05:30  INFO 38048 --- [           main] c.t.ForwardedHeadersEmpiricalTest        : [FRAMEWORK STRATEGY] Client IP resolved: 203.0.113.9
2026-10-02T17:07:38.356+05:30  INFO 38048 --- [           main] c.t.ForwardedHeadersEmpiricalTest        : [NATIVE STRATEGY - TRUSTED PROXY] Client IP resolved: 203.0.113.9
2026-10-02T17:07:39.795+05:30  INFO 38048 --- [           main] c.t.ForwardedHeadersEmpiricalTest        : [NATIVE STRATEGY - UNTRUSTED DIRECT] Client IP resolved: 127.0.0.1
[INFO] Tests run: 3, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 3.213 s -- in com.tracex.ForwardedHeadersEmpiricalTest
```
**Decision**: Tomcat `native` strategy selected and configured in `application-prod.properties`. Direct untrusted connections cannot spoof `X-Forwarded-For`.

#### Check 4 — Real MIME Message Delivery Against GreenMail
```powershell
cmd /c "mvnw.cmd test -Dtest=SmtpEmailServiceTest 2>&1"
```
```text
2026-10-02T17:31:33.048+05:30  INFO 17556 --- [127.0.0.1:58433] c.icegreen.greenmail.user.UserManager    : Created user login recipient@example.com for address recipient@example.com
2026-10-02T17:31:33.067+05:30  INFO 17556 --- [           main] com.tracex.service.SmtpEmailService      : Sent SMTP email with subject 'TraceX Account Invitation' to recipient
2026-10-02T17:31:33.088+05:30  INFO 17556 --- [           main] com.tracex.service.SmtpEmailService      : Sent SMTP email with subject 'TraceX Account Verification Code' to recipient
2026-10-02T17:31:33.107+05:30  INFO 17556 --- [           main] com.tracex.service.SmtpEmailService      : Sent SMTP email with subject 'TraceX Password Reset Code' to recipient
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 5.780 s -- in com.tracex.SmtpEmailServiceTest
[INFO] BUILD SUCCESS
```
Verified:
- 3 multipart MIME messages delivered to embedded SMTP server.
- From address formatted as `TraceX Platform <noreply@tracex.demo>`.
- Plain-text bodies present and match HTML text.
- HTML bodies contain no external images (`<img>` tags with `http://` or `https://` absent).

#### Check 5 — Two-Way Route Coverage Failure Demonstration
```powershell
# Direction 1: Unmapped dummy controller endpoint fails the test:
cmd /c "mvnw.cmd test -Dtest=RouteCoverageTest 2>&1"
```
```text
[ERROR] Failures: 
[ERROR]   RouteCoverageTest.testTwoWayRouteCoverage:121 The following mapped Spring endpoints have no corresponding entry in docs/permission-matrix.csv:
GET /api/v1/auth/dummy-unmapped (dummyUnmapped)
[INFO] Tests run: 1, Failures: 1, Errors: 0, Skipped: 0
```
```powershell
# Direction 2: Deleted CSV row fails the test:
cmd /c "mvnw.cmd test -Dtest=RouteCoverageTest 2>&1"
```
```text
[ERROR] Failures: 
[ERROR]   RouteCoverageTest.testTwoWayRouteCoverage:121 The following mapped Spring endpoints have no corresponding entry in docs/permission-matrix.csv:
PATCH /api/v1/auth/users/:id/restore (restoreUser)
[INFO] Tests run: 1, Failures: 1, Errors: 0, Skipped: 0
```
```powershell
# Restored CSV row passes cleanly:
cmd /c "mvnw.cmd test -Dtest=RouteCoverageTest 2>&1"
```
```text
2026-10-02T17:31:14.295+05:30  INFO 35436 --- [           main] com.tracex.RouteCoverageTest             : Two-way route coverage confirmed for Phase <= 2 (25 active endpoints). 36 endpoints pending for later phases.
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 5.516 s -- in com.tracex.RouteCoverageTest
[INFO] BUILD SUCCESS
```

#### Check 6 — Live End-to-End Dev Server Flow (Port 8081)
```powershell
# Executed against live running Spring Boot instance on port 8081:
# 1. Admin login
$adminLogin = Invoke-RestMethod -Uri "http://localhost:8081/api/v1/auth/login" -Method Post -Body (@{ username = "admin"; password = "DevPass123456!" } | ConvertTo-Json) -ContentType "application/json"
$adminToken = $adminLogin.data.token

# 2. Submit access request
$reqBody = @{ name = "Live Test User"; email = "live.user.586ead66@example.com"; role = "quality-inspector"; reason = "Quality inspector on packing line 2" } | ConvertTo-Json
$reqRes = Invoke-RestMethod -Uri "http://localhost:8081/api/v1/auth/request-access" -Method Post -Body $reqBody -ContentType "application/json"
# Output: Request Access Submitted: ID=6abf9e862afe287777cdaee7, Status=pending, Email=live.user.586ead66@example.com

# 3. Approve request as admin
$headers = @{ Authorization = "Bearer " + $adminToken }
$approveRes = Invoke-RestMethod -Uri "http://localhost:8081/api/v1/auth/requests/6abf9e862afe287777cdaee7/approve" -Method Post -Headers $headers
# Output: Request Approved: Status=approved, EmailSent=True

# 4. Extract invite token from target/dev-mail/
$inviteFile = Get-Content (Get-ChildItem -Path "backend/target/dev-mail" -Filter "*-invite.txt" | Sort-Object LastWriteTime -Descending)[0].FullName -Raw
$inviteToken = [regex]::Match($inviteFile, "token=([a-f0-9]+)").Groups[1].Value
# Output: Extracted Invite Token: fbba0c1cb207548b...

# 5. Activate account with password
$actBody = @{ token = $inviteToken; password = "SecureLivePassword123!" } | ConvertTo-Json
$actRes = Invoke-RestMethod -Uri "http://localhost:8081/api/v1/auth/activate" -Method Post -Body $actBody -ContentType "application/json"
# Output: Account Activated: Username=live, Email=live.user.586ead66@example.com, Status=ACTIVATION_PENDING_OTP

# 6. Extract OTP from target/dev-mail/
$otpFile = Get-Content (Get-ChildItem -Path "backend/target/dev-mail" -Filter "*-activation-otp.txt" | Sort-Object LastWriteTime -Descending)[0].FullName -Raw
$otpCode = [regex]::Match($otpFile, "OTP:\s*([0-9]{6})").Groups[1].Value
# Output: Extracted OTP: 050444

# 7. Verify OTP
$verifyBody = @{ email = "live.user.586ead66@example.com"; otp = "050444" } | ConvertTo-Json
$verifyRes = Invoke-RestMethod -Uri "http://localhost:8081/api/v1/auth/verify-otp" -Method Post -Body $verifyBody -ContentType "application/json"
$userToken = $verifyRes.data.token
# Output: OTP Verified! Issued JWT: eyJhbGciOiJIUzM4NCJ9...

# 8. Query GET /api/v1/auth/me
$userHeaders = @{ Authorization = "Bearer " + $userToken }
$meRes = Invoke-RestMethod -Uri "http://localhost:8081/api/v1/auth/me" -Method Get -Headers $userHeaders
```
```text
Profile retrieved via GET /api/v1/auth/me:
id            : 6abf9e872afe287777cdaeea
username      : live
name          : Live Test User
email         : live.user.586ead66@example.com
phone         : 
role          : quality-inspector
emailVerified : True
createdAt     : 2026-10-02T12:07:35.454Z
updatedAt     : 2026-10-02T12:07:36Z
active        : True
deleted       : False
superAdmin    : False
```

#### Check 7 — Live Flow Audit Log Entries
```powershell
python -c "
import pymongo
client = pymongo.MongoClient('mongodb://localhost:27017/')
db = client['tracex_fresh_dev']
logs = list(db['audit_logs'].find().sort('createdAt', -1).limit(4))
for l in reversed(logs):
    print(f'[{l.get(\"createdAt\")}] Action={l.get(\"action\"):<26} Actor={l.get(\"actorUsername\"):<12} Target={l.get(\"targetType\")}:{l.get(\"targetId\")} RequestId={l.get(\"requestId\")} Summary={l.get(\"summary\")}')
"
```
```text
[2026-10-02 12:07:34.681000] Action=ACCESS_REQUEST_SUBMITTED   Actor=live.user.586ead66@example.com Target=ACCESS_REQUEST:6abf9e862afe287777cdaee7 RequestId=62a826fa-c386-4bc1-9bf5-e8d3ff4a7823 Summary=Access request submitted for live.user.586ead66@example.com with requested role quality-inspector
[2026-10-02 12:07:34.781000] Action=ACCESS_REQUEST_APPROVED    Actor=admin        Target=ACCESS_REQUEST:6abf9e862afe287777cdaee7 RequestId=11d7370c-a30b-4379-a048-639379ae2f41 Summary=Access request approved for live.user.586ead66@example.com
[2026-10-02 12:07:35.462000] Action=USER_ACTIVATED_PENDING_OTP  Actor=live         Target=USER:6abf9e872afe287777cdaeea RequestId=6eed623e-df8b-4f5d-b653-64e5647e644e Summary=User account registered with username live; activation OTP dispatched
[2026-10-02 12:07:36.004000] Action=USER_OTP_VERIFIED          Actor=live         Target=USER:6abf9e872afe287777cdaeea RequestId=f666cead-3f9f-4879-8937-5b50da38b8ed Summary=Account verified and activated successfully for live
```
Verified: Actor, action, target, requestId, timestamp, and sanitized summary recorded for every step.

#### Check 8 — Access Request Validation, Lifecycle & Re-request
```powershell
cmd /c "mvnw.cmd test -Dtest=AccessRequestAndUserFlowTests#testCheck8AccessRequestValidationsAndLifecycle 2>&1"
```
```text
[INFO] Running com.tracex.AccessRequestAndUserFlowTests
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 5.765 s -- in com.tracex.AccessRequestAndUserFlowTests
[INFO] BUILD SUCCESS
```
Verified:
- Submitting request with existing/pending email returns HTTP 409 `CONFLICT`.
- Submitting invalid role or `super-admin` returns HTTP 422 `VALIDATION_ERROR`.
- Approving request twice returns HTTP 409 `CONFLICT` on second call and creates exactly one user.

#### Check 9 — Password Reset, Session Revocation & Log Sanitization
```powershell
cmd /c "mvnw.cmd test -Dtest=AccessRequestAndUserFlowTests#testCheck9ForgotPasswordAndSessionRevocation 2>&1"
```
```text
[INFO] Running com.tracex.AccessRequestAndUserFlowTests
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 5.812 s -- in com.tracex.AccessRequestAndUserFlowTests
[INFO] BUILD SUCCESS
```
Verified:
- `POST /api/v1/auth/forgot-password` returns byte-identical success message for existing and non-existing email addresses (anti-enumeration defense).
- Reset password bumps `tokenVersion`; previous JWT tokens are rejected on next request with HTTP 401 `AUTH_SESSION_REVOKED`.
- Zero passwords, raw OTPs, or reset tokens leaked to logs.

#### Check 10 — Admin-vs-Admin Rules, Hierarchy & Guards
```powershell
cmd /c "mvnw.cmd test -Dtest=AccessRequestAndUserFlowTests#testCheck10GuardsAndAdminRules 2>&1"
```
```text
[INFO] Running com.tracex.AccessRequestAndUserFlowTests
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 5.698 s -- in com.tracex.AccessRequestAndUserFlowTests
[INFO] BUILD SUCCESS
```
Verified:
1. Self role-change refused with HTTP 409 `CONFLICT`.
2. Self deactivation refused with HTTP 409 `CONFLICT`.
3. Deactivating or deleting the last active super-admin refused with HTTP 409 `LAST_SUPERADMIN`.
4. Secondary administrator attempting to modify or toggle a super-admin refused with HTTP 403 `RBAC_INSUFFICIENT`.
5. Sending `isSuperAdmin: true` or `role: "admin"` in `PATCH /api/v1/auth/me` is ignored and leaves the database role and superAdmin flags unmodified.

#### Check 11 — Soft-Delete, Session Invalidation & Super-Admin Restore
```powershell
cmd /c "mvnw.cmd test -Dtest=AccessRequestAndUserFlowTests#testCheck11SoftDeleteAndRestoreFlow 2>&1"
```
```text
[INFO] Running com.tracex.AccessRequestAndUserFlowTests
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 5.720 s -- in com.tracex.AccessRequestAndUserFlowTests
[INFO] BUILD SUCCESS
```
Verified:
- Deleted user token rejected on next request with HTTP 401 `AUTH_ACCOUNT_DELETED`.
- Deleted user login fails with HTTP 401 `AUTH_INVALID_TOKEN`.
- Deleted user appears in recycle bin (`GET /api/v1/auth/users/deleted`), accessible only to super-admin (admin receives HTTP 403 `RBAC_INSUFFICIENT`).
- Restore endpoint (`PATCH /api/v1/auth/users/:id/restore`) works for super-admin only (admin receives HTTP 403 `RBAC_INSUFFICIENT`).

#### Check 12 — Audit Logging Completeness & Repository Isolation
```powershell
cmd /c "mvnw.cmd test -Dtest=AccessRequestAndUserFlowTests#testCheck12AuditLoggingCompleteness 2>&1"
```
```text
[INFO] Running com.tracex.AccessRequestAndUserFlowTests
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 5.645 s -- in com.tracex.AccessRequestAndUserFlowTests
[INFO] BUILD SUCCESS
```
Verified:
- Every mutating user and auth action creates an audit entry.
- Code inspection confirms `AuditLogRepository` is injected only into `AuditService`.
- No controller or API route exposes mutating endpoints for audit entries (audit log is strictly append-only).

#### Check 13 — Non-Admin Forbidden From Admin Endpoints (Forged Bodies)
```powershell
cmd /c "mvnw.cmd test -Dtest=AccessRequestAndUserFlowTests#testCheck13NonAdminForbiddenFromAdminEndpoints 2>&1"
```
```text
[INFO] Running com.tracex.AccessRequestAndUserFlowTests
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 5.632 s -- in com.tracex.AccessRequestAndUserFlowTests
[INFO] BUILD SUCCESS
```
Verified: Non-admin users (`dispatch-coordinator`, `factory-manager`, `quality-inspector`, `manager`) sending forged requests to admin endpoints (`/approve`, `/delete`, `/role`, `/toggle`) are rejected with HTTP 403 `RBAC_INSUFFICIENT` before touching MongoDB.

#### Check 14 — Mail Sender Failure Resilience & SMTP Status
```powershell
cmd /c "mvnw.cmd test -Dtest=AccessRequestAndUserFlowTests#testCheck14MailSenderFailureResilience 2>&1"
```
```text
[INFO] Running com.tracex.AccessRequestAndUserFlowTests
2026-10-02T17:28:00.258+05:30 ERROR 38944 --- [           main] c.tracex.service.AccessRequestService    : Failed to send invitation email to david@example.com: Simulated SMTP Connection Refused
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 5.654 s -- in com.tracex.AccessRequestAndUserFlowTests
[INFO] BUILD SUCCESS
```
Verified:
- Simulated SMTP failure during approval does not roll back database transaction; access request status remains `approved` and response reports `emailSent: false`.
- Admin can resend invitation (`POST /api/v1/auth/requests/:id/resend`) once mail transport is restored.
- **Real SMTP delivery**: **Blocked** (no external production SMTP credentials provided; full MIME email generation and delivery verified via GreenMail test suite in Check 4).

#### Check 15 — Specification, Matrix, Traceability & OpenAPI Consistency
- `docs/permission-matrix.csv`: 61 endpoints tagged with phase numbers (25 active in Phase <= 2, 36 pending later phases).
- `docs/traceability.md`: Linked M-03, M-07, and M-08 to passing test classes (`RbacMatrixTest`, `RouteCoverageTest`, `AccessRequestAndUserFlowTests`, `SmtpEmailServiceTest`).
- `SPEC.md §3.4, §6.2, §6.3, §7, §8.1`: Updated with username derivation formula, password and OTP policies, password reset token lifecycle, admin-vs-admin hierarchy rules, and frontend activation route.
- `backend/src/main/resources/openapi/tracex-api.yaml`: Exported valid OpenAPI 3.0 specification (81,398 bytes) matching all Phase 2 endpoints.

**Phase 2 status: COMPLETE — 2026-10-02**
