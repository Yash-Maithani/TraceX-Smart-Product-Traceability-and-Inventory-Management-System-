# Phase 3 Checks Log - 2026-10-04 (Phase 3.1 Verification & Repair Pass)

## Check 1 - Full Build Verification (`mvnw clean verify`) with Per-Class Counts

Command:
```powershell
cmd /c "mvnw.cmd clean verify"
```

Output:
```
[INFO] Scanning for projects...
[INFO] 
[INFO] ---------------------< com.tracex:tracex-backend >----------------------
[INFO] Building tracex-backend 1.0.0-SNAPSHOT
[INFO]   from pom.xml
[INFO] --------------------------------[ jar ]---------------------------------
[INFO] 
[INFO] --- clean:3.3.2:clean (default-clean) @ tracex-backend ---
[INFO] 
[INFO] --- resources:3.3.1:resources (default-resources) @ tracex-backend ---
[INFO] Copying 4 resources from src\main\resources to target\classes
[INFO] Copying 7 resources from src\main\resources to target\classes
[INFO] 
[INFO] --- compiler:3.11.0:compile (default-compile) @ tracex-backend ---
[INFO] Changes detected - recompiling the module!
[INFO] Compiling 36 source files with javac [debug target 21] to target\classes
[INFO] 
[INFO] --- resources:3.3.1:testResources (default-testResources) @ tracex-backend ---
[INFO] Copying 4 resources from src\test\resources to target\test-classes
[INFO] 
[INFO] --- compiler:3.11.0:testCompile (default-testCompile) @ tracex-backend ---
[INFO] Changes detected - recompiling the module!
[INFO] Compiling 15 source files with javac [debug target 21] to target\test-classes
[INFO] 
[INFO] --- surefire:3.2.5:test (default-test) @ tracex-backend ---
[INFO] Using auto detected provider org.apache.maven.surefire.junitplatform.JUnitPlatformProvider
[INFO] 
[INFO] -------------------------------------------------------
[INFO]  T E S T S
[INFO] -------------------------------------------------------
[INFO] Running com.tracex.AccessRequestAndUserFlowTests
[INFO] Tests run: 8, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 11.88 s -- in com.tracex.AccessRequestAndUserFlowTests
[INFO] Running com.tracex.AdminVsAdminRulesTest
[INFO] Tests run: 10, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 5.749 s -- in com.tracex.AdminVsAdminRulesTest
[INFO] Running com.tracex.AuthLoginTests
[INFO] Tests run: 10, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 4.508 s -- in com.tracex.AuthLoginTests
[INFO] Running com.tracex.BatchIndexTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.855 s -- in com.tracex.BatchIndexTest
[INFO] Running com.tracex.ConfigurationAndSeedTests
[INFO] Tests run: 12, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.981 s -- in com.tracex.ConfigurationAndSeedTests
[INFO] Running com.tracex.ForwardedHeadersEmpiricalTest$NativeStrategyUntrustedDirectTests
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.575 s -- in com.tracex.ForwardedHeadersEmpiricalTest$NativeStrategyUntrustedDirectTests
[INFO] Running com.tracex.ForwardedHeadersEmpiricalTest$NativeStrategyTrustedProxyTests
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.032 s -- in com.tracex.ForwardedHeadersEmpiricalTest$NativeStrategyTrustedProxyTests
[INFO] Running com.tracex.ForwardedHeadersEmpiricalTest$FrameworkStrategyTests
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.896 s -- in com.tracex.ForwardedHeadersEmpiricalTest$FrameworkStrategyTests
[INFO] Running com.tracex.ForwardedHeadersEmpiricalTest
[INFO] Tests run: 0, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 3.506 s -- in com.tracex.ForwardedHeadersEmpiricalTest
[INFO] Running com.tracex.GlobalSafetyGuardAutoDetectionTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.009 s -- in com.tracex.GlobalSafetyGuardAutoDetectionTest
[INFO] Running com.tracex.ProductAndBatchTests
[INFO] Tests run: 33, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.417 s -- in com.tracex.ProductAndBatchTests
[INFO] Running com.tracex.RbacMatrixTest
[INFO] Tests run: 238, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.556 s -- in com.tracex.RbacMatrixTest
[INFO] Running com.tracex.RouteCoverageTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.011 s -- in com.tracex.RouteCoverageTest
[INFO] Running com.tracex.SmtpEmailServiceTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.963 s -- in com.tracex.SmtpEmailServiceTest
[INFO] Running com.tracex.TokenAndSessionTests
[INFO] Tests run: 8, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.715 s -- in com.tracex.TokenAndSessionTests
[INFO] 
[INFO] Results:
[INFO] 
[INFO] Tests run: 326, Failures: 0, Errors: 0, Skipped: 0
[INFO] 
[INFO] --- jar:3.3.0:jar (default-jar) @ tracex-backend ---
[INFO] Building jar: C:\Users\yashm\OneDrive\Desktop\TraceX\backend\target\tracex-backend-1.0.0-SNAPSHOT.jar
[INFO] 
[INFO] --- spring-boot:3.2.5:repackage (repackage) @ tracex-backend ---
[INFO] Replacing main artifact C:\Users\yashm\OneDrive\Desktop\TraceX\backend\target\tracex-backend-1.0.0-SNAPSHOT.jar with repackaged archive, adding nested dependencies in BOOT-INF/.
[INFO] The original artifact has been renamed to C:\Users\yashm\OneDrive\Desktop\TraceX\backend\target\tracex-backend-1.0.0-SNAPSHOT.jar.original
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  39.334 s
[INFO] Finished at: 2026-10-04T09:26:22+05:30
[INFO] ------------------------------------------------------------------------
```
Result: PASS

---

## Check 2 - Live Dev Server: `GET /api/v1/products`

Command:
```powershell
$body = @{ username = 'factory_mgr'; password = 'DevPass123456!' } | ConvertTo-Json
$loginRes = Invoke-RestMethod -Uri 'http://localhost:8081/api/v1/auth/login' -Method Post -Body $body -ContentType 'application/json'
$headers = @{ Authorization = "Bearer $($loginRes.data.token)" }
$prodRes = Invoke-RestMethod -Uri 'http://localhost:8081/api/v1/products' -Method Get -Headers $headers
$prodRes | ConvertTo-Json -Depth 5
```

Output:
```json
{
    "success":  true,
    "requestId":  "4c4f5206-951d-4ca6-b858-97f03a94dcd3",
    "data":  [
                 {
                     "id":  "6ac1c437b820d073691b4e9a",
                     "productName":  "Wild Berry Juice Concentrate",
                     "sku":  "WBJC",
                     "category":  "Beverages",
                     "baseShelfLifeDays":  180,
                     "predictedShelfLifeDays":  null,
                     "predictedExpiryTemplate":  null,
                     "riskLevel":  "LOW",
                     "createdAt":  "2026-10-04T03:12:55.495Z",
                     "updatedAt":  "2026-10-04T03:59:59.624Z"
                 },
                 {
                     "id":  "6ac1c437b820d073691b4e9b",
                     "productName":  "Kumaon Royal Multigrain Crackers",
                     "sku":  "KMGC",
                     "category":  "Snacks",
                     "baseShelfLifeDays":  90,
                     "predictedShelfLifeDays":  null,
                     "predictedExpiryTemplate":  null,
                     "riskLevel":  "MEDIUM",
                     "createdAt":  "2026-10-04T03:12:55.512Z",
                     "updatedAt":  "2026-10-04T03:59:59.627Z"
                 },
                 {
                     "id":  "6ac1c437b820d073691b4e9c",
                     "productName":  "Himalayan Rock Salt (Sendha Namak)",
                     "sku":  "RHSLT",
                     "category":  "Condiments",
                     "baseShelfLifeDays":  730,
                     "predictedShelfLifeDays":  null,
                     "predictedExpiryTemplate":  null,
                     "riskLevel":  "LOW",
                     "createdAt":  "2026-10-04T03:12:55.515Z",
                     "updatedAt":  "2026-10-04T03:59:59.629Z"
                 },
                 {
                     "id":  "6ac1c437b820d073691b4e9d",
                     "productName":  "Apricot & Berry Himalayan Jam",
                     "sku":  "ABHJAM",
                     "category":  "Spreads",
                     "baseShelfLifeDays":  365,
                     "predictedShelfLifeDays":  null,
                     "predictedExpiryTemplate":  null,
                     "riskLevel":  "MEDIUM",
                     "createdAt":  "2026-10-04T03:12:55.517Z",
                     "updatedAt":  "2026-10-04T03:59:59.632Z"
                 },
                 {
                     "id":  "6ac1c437b820d073691b4e9e",
                     "productName":  "Wild Berry Dried Pulp (Tray-Dried)",
                     "sku":  "WBDRP",
                     "category":  "Ingredients",
                     "baseShelfLifeDays":  270,
                     "predictedShelfLifeDays":  null,
                     "predictedExpiryTemplate":  null,
                     "riskLevel":  "LOW",
                     "createdAt":  "2026-10-04T03:12:55.519Z",
                     "updatedAt":  "2026-10-04T03:59:59.635Z"
                 }
             ]
}
```
Result: PASS

---

## Check 3 - Live Dev Server: `POST /api/v1/batches`

Command:
```powershell
$body = @{ username = 'factory_mgr'; password = 'DevPass123456!' } | ConvertTo-Json
$loginRes = Invoke-RestMethod -Uri 'http://localhost:8081/api/v1/auth/login' -Method Post -Body $body -ContentType 'application/json'
$headers = @{ Authorization = "Bearer $($loginRes.data.token)" }

$createPayload = @{
    productId = '6ac1c437b820d073691b4e9a'
    packDate = '2026-10-04T00:00:00Z'
    quantityProduced = 250
    unit = 'Kg'
    yieldPercent = 92.5
    sourceLotCode = 'LOT-LIVE-2026'
    farmerName = 'Ramesh Chandra'
    village = 'Mukteshwar'
    traceabilityNote = 'Fresh harvest batch for verification'
} | ConvertTo-Json

$batchRes = Invoke-RestMethod -Uri 'http://localhost:8081/api/v1/batches' -Method Post -Headers $headers -Body $createPayload -ContentType 'application/json'
$batchRes | ConvertTo-Json -Depth 5
```

Output:
```json
{
    "success":  true,
    "requestId":  "e4e5176d-fbe1-4be5-a56c-6d08a20a1fa6",
    "data":  {
                 "id":  "6ac1cf8d573e634e8abfb05f",
                 "batchCode":  "TX-2026-10-002",
                 "productName":  "Wild Berry Juice Concentrate",
                 "sku":  "WBJC",
                 "sourceLotCode":  "LOT-LIVE-2026",
                 "farmerName":  "Ramesh Chandra",
                 "village":  "Mukteshwar",
                 "quantityProduced":  250,
                 "unit":  "Kg",
                 "yieldPercent":  92.5,
                 "packDate":  "2026-10-04T00:00:00Z",
                 "expiryDate":  "2027-04-02T00:00:00Z",
                 "dataSource":  "fallback",
                 "shelfLifeSource":  "base",
                 "lifecycleState":  "ACTIVE",
                 "status":  "READY",
                 "daysUntilExpiry":  180,
                 "priorityScore":  185.0,
                 "createdBy":  "factory_mgr",
                 "createdAt":  "2026-10-04T04:01:17.828085500Z",
                 "updatedAt":  "2026-10-04T04:01:17.828085500Z",
                 "traceabilityNote":  "Fresh harvest batch for verification",
                 "noteHistory":  [

                                 ],
                 "deletedAt":  null,
                 "deletedBy":  null,
                 "deleteNote":  null,
                 "dispatchDate":  null,
                 "buyerName":  null,
                 "deleted":  false
             }
}
```
Result: PASS

---

## Check 4 - Batch Code Format Validation

Command:
```powershell
"TX-2026-10-002" -match "^TX-\d{4}-\d{2}-\d{3,}$"
```

Output:
```
True
```
Result: PASS

---

## Check 5 - Documentation Integrity (`docs/progress/` Listing)

Command:
```powershell
Get-ChildItem docs/progress
```

Output:
```
    Directory: C:\Users\yashm\OneDrive\Desktop\TraceX\docs\progress

Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a----         10/4/2026   8:22 AM           1034 phase-00-1.md
-a----         10/4/2026   8:22 AM           1916 phase-00-2.md
-a----         10/4/2026   8:22 AM           1779 phase-00.md
-a----         10/4/2026   8:22 AM          10878 phase-01-1.md
-a----         10/4/2026   8:22 AM           6786 phase-01.md
-a----         10/4/2026   8:22 AM          17479 phase-02.md
-a----         10/4/2026   9:33 AM           6311 phase-03.md
```
Result: PASS

---

## Check 6 - PROGRESS.md and Split Checks Line Count

Command:
```powershell
$pCount = (Get-Content PROGRESS.md).Count
$subCount = (Get-ChildItem docs/progress/*.md | Get-Content).Count
Write-Host "Lines in PROGRESS.md: $pCount"
Write-Host "Lines in docs/progress/*.md combined: $subCount"
Write-Host "Total lines across all progress docs: $($pCount + $subCount)"
```

Output:
```
Lines in PROGRESS.md: 204
Lines in docs/progress/*.md combined: 1311
Total lines across all progress docs: 1515
```
Result: PASS

---

## Check 7 - RBAC Matrix Suite Count (`RbacMatrixTest`)

Command:
```powershell
cmd /c "mvnw.cmd test -Dtest=RbacMatrixTest"
```

Output:
```
[INFO] Running com.tracex.RbacMatrixTest
2026-10-04T09:33:24.653+05:30  INFO 1896 --- [           main] com.tracex.RbacMatrixTest                : Generated 238 dynamic tests for 34 active phase rows
[INFO] Tests run: 238, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 8.139 s -- in com.tracex.RbacMatrixTest
[INFO] 
[INFO] Results:
[INFO] 
[INFO] Tests run: 238, Failures: 0, Errors: 0, Skipped: 0
[INFO] 
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  10.692 s
[INFO] Finished at: 2026-10-04T09:33:26+05:30
```
Result: PASS

---

## Check 8 - Audit Log Check (No Farmer PII in Summary)

Command:
```powershell
python -c "from pymongo import MongoClient; client = MongoClient('mongodb://localhost:27017'); db = client['tracex_fresh_dev']; log = db.audit_logs.find_one({'action': 'BATCH_CREATED', 'targetId': '6ac1cf8d573e634e8abfb05f'}); print(log)"
```

Output:
```
{'_id': ObjectId('6ac1cf8d573e634e8abfb060'), 'action': 'BATCH_CREATED', 'actorId': 'anonymous', 'actorUsername': 'factory_mgr', 'targetId': '6ac1cf8d573e634e8abfb05f', 'targetType': 'BATCH', 'summary': 'Batch created: TX-2026-10-002', 'requestId': 'e4e5176d-fbe1-4be5-a56c-6d08a20a1fa6', 'createdAt': datetime.datetime(2026, 10, 4, 4, 1, 17, 838000), '_class': 'com.tracex.model.AuditLog'}
```
Result: PASS

---

## Check 9 - MongoDB Batches Index Information & `BatchIndexTest`

Command 1 (Index query via PyMongo):
```powershell
python -c "from pymongo import MongoClient; client = MongoClient('mongodb://localhost:27017'); db = client['tracex_fresh_test']; print('Indexes on batches:'); [print(idx) for idx in db.batches.list_indexes()]"
```

Output:
```
Indexes on batches:
SON([('v', 2), ('key', SON([('_id', 1)])), ('name', '_id_')])
SON([('v', 2), ('key', SON([('isDeleted', 1), ('lifecycleState', 1), ('expiryDate', 1)])), ('name', 'isDeleted_lifecycleState_expiryDate_idx')])
SON([('v', 2), ('key', SON([('sku', 1)])), ('name', 'sku')])
SON([('v', 2), ('key', SON([('batchCode', 1)])), ('name', 'batchCode'), ('unique', True)])
```

Command 2 (`BatchIndexTest` execution):
```powershell
cmd /c "mvnw.cmd test -Dtest=BatchIndexTest"
```

Output:
```
[INFO] Running com.tracex.BatchIndexTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 6.146 s -- in com.tracex.BatchIndexTest
[INFO] 
[INFO] Results:
[INFO] 
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
[INFO] 
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  8.554 s
[INFO] Finished at: 2026-10-04T09:29:09+05:30
```
Result: PASS

---

## Check 10 - Seed Check & Idempotency (`testSeedTwiceGivesIdenticalCounts`)

Command 1 (`testSeedTwiceGivesIdenticalCounts` execution):
```powershell
cmd /c "mvnw.cmd test -Dtest=ConfigurationAndSeedTests#testSeedTwiceGivesIdenticalCounts"
```

Output:
```
[INFO] Running com.tracex.ConfigurationAndSeedTests
2026-10-04T09:29:20.557+05:30  INFO 29576 --- [           main] com.tracex.service.SeedRunner            : Executing idempotent database seed for demo users and access requests...
Seeding products...
Seeding batches...
2026-10-04T09:29:20.924+05:30  INFO 29576 --- [           main] com.tracex.service.SeedRunner            : Database seeding completed.
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 6.172 s -- in com.tracex.ConfigurationAndSeedTests
[INFO] 
[INFO] Results:
[INFO] 
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
[INFO] 
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  8.404 s
[INFO] Finished at: 2026-10-04T09:29:21+05:30
```

Command 2 (Seed counts in dev database):
```powershell
python -c "from pymongo import MongoClient; client = MongoClient('mongodb://localhost:27017'); db = client['tracex_fresh_dev']; print('Products:', db.products.count_documents({})); print('Batches:', db.batches.count_documents({})); print('Users:', db.users.count_documents({})); print('AccessRequests:', db.access_requests.count_documents({}))"
```

Output:
```
Products: 5
Batches: 14
Users: 7
AccessRequests: 0
```
Result: PASS

---

## Check 11 - Optimistic Locking Test (409 Conflict)

Command 1 (`testOptimisticLockingConflict`):
```powershell
cmd /c "mvnw.cmd test -Dtest=ProductAndBatchTests#testOptimisticLockingConflict"
```

Output:
```
[INFO] Running com.tracex.ProductAndBatchTests
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 6.962 s -- in com.tracex.ProductAndBatchTests
[INFO] 
[INFO] Results:
[INFO] 
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
[INFO] 
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  9.472 s
[INFO] Finished at: 2026-10-04T09:32:43+05:30
```

Command 2 (`testTwoConcurrentEditsOneSuccessOneConflict409`):
```powershell
cmd /c "mvnw.cmd test -Dtest=ProductAndBatchTests#testTwoConcurrentEditsOneSuccessOneConflict409"
```

Output:
```
[INFO] Running com.tracex.ProductAndBatchTests
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 6.045 s -- in com.tracex.ProductAndBatchTests
[INFO] 
[INFO] Results:
[INFO] 
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
[INFO] 
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  8.329 s
[INFO] Finished at: 2026-10-04T09:33:01+05:30
```
Result: PASS

---

## Check 12 - Permission Matrix Anonymous Column

Command:
```powershell
Get-Content docs\permission-matrix.csv -Head 15
```

Output:
```
phase,method,path,super-admin,admin,manager,factory-manager,quality-inspector,dispatch-coordinator,anonymous,notes
1,POST,/api/v1/auth/login,allow,allow,allow,allow,allow,allow,allow,public
2,POST,/api/v1/auth/request-access,allow,allow,allow,allow,allow,allow,allow,public
2,POST,/api/v1/auth/activate,allow,allow,allow,allow,allow,allow,allow,public
2,POST,/api/v1/auth/verify-otp,allow,allow,allow,allow,allow,allow,allow,public
2,POST,/api/v1/auth/verify-otp/resend,allow,allow,allow,allow,allow,allow,allow,public
2,POST,/api/v1/auth/forgot-password,allow,allow,allow,allow,allow,allow,allow,public - generic 200 always
2,POST,/api/v1/auth/verify-reset-otp,allow,allow,allow,allow,allow,allow,allow,public
2,POST,/api/v1/auth/reset-password,allow,allow,allow,allow,allow,allow,allow,public
1,GET,/actuator/health,allow,allow,allow,allow,allow,allow,allow,public - Spring Actuator endpoint
1,GET,/api/v1/auth/me,allow,allow,allow,allow,allow,allow,deny,
2,PATCH,/api/v1/auth/me,allow,allow,allow,allow,allow,allow,deny,
9,PATCH,/api/v1/auth/me/settings,allow,allow,allow,allow,allow,allow,deny,
2,POST,/api/v1/auth/me/change-password,allow,allow,allow,allow,allow,allow,deny,revokes sessions
1,POST,/api/v1/auth/me/logout-all,allow,allow,allow,allow,allow,allow,deny,revokes sessions
```
Result: PASS

---

## Check 13 - SPEC.md Decisions D-16 and D-17

Command:
```powershell
Select-String -Path SPEC.md -Pattern "D-16|D-17" -Context 0,2
```

Output:
```
> SPEC.md:25:| D-16 | Freshness status tier (READY/WARNING/URGENT/EXPIRED) is derived at runtime from expiryDate and 
the injected Clock bean. It is never stored in MongoDB. The status field is NOT stored on the Batch document for 
freshness. Exception: DISPATCHED and ARCHIVED are lifecycle states that ARE stored. The freshness compute logic lives 
exclusively in BatchFreshness.java. | RESOLVED |
> SPEC.md:26:| D-17 | All date-only display comparisons ("days until expiry") use the BUSINESS_TIME_ZONE env var 
(default Asia/Kolkata). The backend Clock bean is configured at this zone for ZonedDateTime computations. This does 
NOT affect stored UTC timestamps. | RESOLVED |
```
Result: PASS

---

## Check 14 - Admin-vs-Admin Rules Table in SPEC.md

Command:
```powershell
Select-String -Path SPEC.md -Pattern "Admin-vs-Admin Action Rules" -Context 0,10
```

Output:
```
> SPEC.md:129:### Admin-vs-Admin Action Rules
  SPEC.md:130:
  SPEC.md:131:| Actor | Target | toggle | role-change | delete | restore |
  SPEC.md:132:|---|---|---|---|---|---|
  SPEC.md:133:| super-admin | super-admin | deny (last-SA guard) | deny (self) | deny (last-SA guard) | allow |
  SPEC.md:134:| super-admin | admin | allow | allow | allow | allow |
  SPEC.md:135:| super-admin | any lower | allow | allow | allow | allow |
  SPEC.md:136:| admin | super-admin | deny (RBAC) | deny (RBAC) | deny (RBAC) | deny (RBAC) |
  SPEC.md:137:| admin | admin (self) | deny (self) | deny (self) | deny (self) | N/A |
  SPEC.md:138:| admin | admin (other) | allow | allow | allow | deny (RBAC - only super-admin may restore) |
  SPEC.md:139:| admin | any lower | allow | allow | allow | deny (RBAC) |
```
Result: PASS

---

## Check 15 - Concurrency Test 10x and Live Dev Server Lifecycle Trace

### 15a: 50-Thread Parallel Batch Creations Test Repeated 10 Times

Command:
```powershell
powershell -Command "1..10 | ForEach-Object { Write-Host '=== RUN ' $_ ' ==='; cmd /c 'mvnw.cmd test -Dtest=ProductAndBatchTests#testFiftyParallelBatchCreationsGivingUniqueContiguousCodes -DtrimStackTrace=false -Dlogging.level.root=WARN' | Select-String -Pattern 'Tests run:|BUILD' }"
```

Output:
```
=== RUN 1 ===
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 5.763 s -- in com.tracex.ProductAndBatchTests
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
=== RUN 2 ===
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 6.325 s -- in com.tracex.ProductAndBatchTests
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
=== RUN 3 ===
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 6.388 s -- in com.tracex.ProductAndBatchTests
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
=== RUN 4 ===
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 6.058 s -- in com.tracex.ProductAndBatchTests
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
=== RUN 5 ===
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 7.551 s -- in com.tracex.ProductAndBatchTests
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
=== RUN 6 ===
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 6.868 s -- in com.tracex.ProductAndBatchTests
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
=== RUN 7 ===
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 5.953 s -- in com.tracex.ProductAndBatchTests
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
=== RUN 8 ===
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 5.887 s -- in com.tracex.ProductAndBatchTests
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
=== RUN 9 ===
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 6.142 s -- in com.tracex.ProductAndBatchTests
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
=== RUN 10 ===
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 6.467 s -- in com.tracex.ProductAndBatchTests
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

### 15b: Live Dev-Server Batch Lifecycle Trace

1. **Login as Factory Manager**:
```powershell
$body = @{ username = 'factory_mgr'; password = 'DevPass123456!' } | ConvertTo-Json
$loginRes = Invoke-RestMethod -Uri 'http://localhost:8081/api/v1/auth/login' -Method Post -Body $body -ContentType 'application/json'
# HTTP 200 OK -> Token received
```

2. **Create Batch as Factory Manager**:
```powershell
$createPayload = @{
    productId = '6ac1c437b820d073691b4e9a'
    packDate = '2026-10-04T00:00:00Z'
    quantityProduced = 250
    unit = 'Kg'
    yieldPercent = 92.5
    sourceLotCode = 'LOT-LIVE-2026'
    farmerName = 'Ramesh Chandra'
    village = 'Mukteshwar'
    traceabilityNote = 'Fresh harvest batch for verification'
} | ConvertTo-Json
$batchRes = Invoke-RestMethod -Uri 'http://localhost:8081/api/v1/batches' -Method Post -Headers @{ Authorization = "Bearer $($loginRes.data.token)" } -Body $createPayload -ContentType 'application/json'
```
Response:
```json
{
    "success":  true,
    "requestId":  "e4e5176d-fbe1-4be5-a56c-6d08a20a1fa6",
    "data":  {
                 "id":  "6ac1cf8d573e634e8abfb05f",
                 "batchCode":  "TX-2026-10-002",
                 "productName":  "Wild Berry Juice Concentrate",
                 "sku":  "WBJC",
                 "sourceLotCode":  "LOT-LIVE-2026",
                 "farmerName":  "Ramesh Chandra",
                 "village":  "Mukteshwar",
                 "quantityProduced":  250,
                 "unit":  "Kg",
                 "yieldPercent":  92.5,
                 "packDate":  "2026-10-04T00:00:00Z",
                 "expiryDate":  "2027-04-02T00:00:00Z",
                 "dataSource":  "fallback",
                 "shelfLifeSource":  "base",
                 "lifecycleState":  "ACTIVE",
                 "status":  "READY",
                 "daysUntilExpiry":  180,
                 "priorityScore":  185.0,
                 "createdBy":  "factory_mgr",
                 "createdAt":  "2026-10-04T04:01:17.828085500Z",
                 "updatedAt":  "2026-10-04T04:01:17.828085500Z",
                 "traceabilityNote":  "Fresh harvest batch for verification",
                 "noteHistory":  [],
                 "deleted":  false
             }
}
```

3. **List Batch**:
```powershell
$listRes = Invoke-RestMethod -Uri 'http://localhost:8081/api/v1/batches?search=TX-2026-10-002' -Method Get -Headers @{ Authorization = "Bearer $($loginRes.data.token)" }
```
Response:
```json
{
    "success":  true,
    "requestId":  "11e11f32-b9b3-4d9d-a89c-2c5a3654f1ba",
    "data":  {
                 "data":  [
                              {
                                  "id":  "6ac1cf8d573e634e8abfb05f",
                                  "batchCode":  "TX-2026-10-002",
                                  "productName":  "Wild Berry Juice Concentrate",
                                  "sku":  "WBJC",
                                  "sourceLotCode":  "LOT-LIVE-2026",
                                  "farmerName":  "Ramesh Chandra",
                                  "village":  "Mukteshwar",
                                  "quantityProduced":  250,
                                  "unit":  "Kg",
                                  "yieldPercent":  92.5,
                                  "packDate":  "2026-10-04T00:00:00Z",
                                  "expiryDate":  "2027-04-02T00:00:00Z",
                                  "lifecycleState":  "ACTIVE",
                                  "status":  "READY",
                                  "daysUntilExpiry":  180,
                                  "priorityScore":  185.0,
                                  "createdBy":  "factory_mgr",
                                  "deleted":  false
                              }
                          ],
                 "total":  1,
                 "page":  1,
                 "limit":  50,
                 "count":  1
             }
}
```

4. **Add Note to Batch**:
```powershell
$notePayload = @{ note = 'Quality inspection scheduled for afternoon' } | ConvertTo-Json
$noteRes = Invoke-RestMethod -Uri 'http://localhost:8081/api/v1/batches/6ac1cf8d573e634e8abfb05f/note' -Method Patch -Headers @{ Authorization = "Bearer $($loginRes.data.token)" } -Body $notePayload -ContentType 'application/json'
```
Response:
```json
{
    "success":  true,
    "requestId":  "793b2335-7768-430a-b784-80359e271392",
    "data":  {
                 "id":  "6ac1cf8d573e634e8abfb05f",
                 "batchCode":  "TX-2026-10-002",
                 "traceabilityNote":  "Quality inspection scheduled for afternoon",
                 "noteHistory":  [
                                     {
                                         "note":  "Fresh harvest batch for verification",
                                         "editedBy":  "factory_mgr",
                                         "editedAt":  "2026-10-04T04:01:37.764532500Z"
                                     }
                                 ],
                 "deleted":  false
             }
}
```

5. **Archive Batch (as Admin)**:
```powershell
$adminBody = @{ username = 'admin'; password = 'DevPass123456!' } | ConvertTo-Json
$adminLogin = Invoke-RestMethod -Uri 'http://localhost:8081/api/v1/auth/login' -Method Post -Body $adminBody -ContentType 'application/json'
$archivePayload = @{ deleteNote = 'Archived for QA review' } | ConvertTo-Json
$archiveRes = Invoke-RestMethod -Uri 'http://localhost:8081/api/v1/batches/6ac1cf8d573e634e8abfb05f' -Method Delete -Headers @{ Authorization = "Bearer $($adminLogin.data.token)" } -Body $archivePayload -ContentType 'application/json'
```
Response:
```json
{
    "success":  true,
    "requestId":  "29f04e22-7434-4fbc-afd8-bda25c598965",
    "data":  {
                 "id":  "6ac1cf8d573e634e8abfb05f",
                 "batchCode":  "TX-2026-10-002",
                 "deletedAt":  "2026-10-04T04:01:41.380664500Z",
                 "deletedBy":  "admin",
                 "deleted":  true
             }
}
```

6. **Restore Batch (as Admin)**:
```powershell
$restoreRes = Invoke-RestMethod -Uri 'http://localhost:8081/api/v1/batches/6ac1cf8d573e634e8abfb05f/restore' -Method Patch -Headers @{ Authorization = "Bearer $($adminLogin.data.token)" } -ContentType 'application/json'
```
Response:
```json
{
    "success":  true,
    "requestId":  "c3a77da3-80ed-4700-b846-cbba14120aa3",
    "data":  {
                 "id":  "6ac1cf8d573e634e8abfb05f",
                 "batchCode":  "TX-2026-10-002",
                 "deletedAt":  null,
                 "deletedBy":  null,
                 "deleted":  false
             }
}
```
Result: PASS
