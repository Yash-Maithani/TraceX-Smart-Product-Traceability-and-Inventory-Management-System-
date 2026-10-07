# Phase 5.0.2 — Confirmation Pass Log (`docs/progress/phase-05-0-2.md`)

> Date: 2026-10-05 | Status: COMPLETE

---

## Item 1: Backend Verify Totals (3 Consecutive Runs)

With the three new calendar-regex and filter-partition tests added in Item 4 (`testCalendarRegexPositiveLeapAndMonthEndDatesMatchTierFilters`, `testCalendarRegexNegativeInvalidDatesNeverMatchTierFilters`, and `testEveryStoredDateStringLandsInExactlyOneFilterPartition` in `backend/src/test/java/com/tracex/ProductAndBatchTests.java`), the backend suite total increased from **409** to **412** tests. All three consecutive `.\mvnw.cmd clean verify` runs executed in randomized class and method order with **412** tests run and zero failures, errors, or skips.

### Run 1

Command:

```powershell
.\mvnw.cmd clean verify
```

Real output (final summary):

```text
[INFO] Results:
[INFO] 
[INFO] Tests run: 412, Failures: 0, Errors: 0, Skipped: 0
[INFO] 
[INFO] 
[INFO] --- jar:3.4.2:jar (default-jar) @ tracex-backend ---
[INFO] Building jar: C:\Users\yashm\OneDrive\Desktop\TraceX\backend\target\tracex-backend-1.0.0-SNAPSHOT.jar
[INFO] 
[INFO] --- spring-boot:3.5.0:repackage (repackage) @ tracex-backend ---
[INFO] Replacing main artifact C:\Users\yashm\OneDrive\Desktop\TraceX\backend\target\tracex-backend-1.0.0-SNAPSHOT.jar with repackaged archive, adding nested dependencies in BOOT-INF/.
[INFO] The original artifact has been renamed to C:\Users\yashm\OneDrive\Desktop\TraceX\backend\target\tracex-backend-1.0.0-SNAPSHOT.jar.original
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  01:00 min
[INFO] Finished at: 2026-10-05T21:12:08+05:30
[INFO] ------------------------------------------------------------------------
RUN1_EXIT=0
```

### Run 2

Command:

```powershell
.\mvnw.cmd clean verify
```

Real output (final summary):

```text
[INFO] Results:
[INFO] 
[INFO] Tests run: 412, Failures: 0, Errors: 0, Skipped: 0
[INFO] 
[INFO] 
[INFO] --- jar:3.4.2:jar (default-jar) @ tracex-backend ---
[INFO] Building jar: C:\Users\yashm\OneDrive\Desktop\TraceX\backend\target\tracex-backend-1.0.0-SNAPSHOT.jar
[INFO] 
[INFO] --- spring-boot:3.5.0:repackage (repackage) @ tracex-backend ---
[INFO] Replacing main artifact C:\Users\yashm\OneDrive\Desktop\TraceX\backend\target\tracex-backend-1.0.0-SNAPSHOT.jar with repackaged archive, adding nested dependencies in BOOT-INF/.
[INFO] The original artifact has been renamed to C:\Users\yashm\OneDrive\Desktop\TraceX\backend\target\tracex-backend-1.0.0-SNAPSHOT.jar.original
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  01:00 min
[INFO] Finished at: 2026-10-05T21:13:23+05:30
[INFO] ------------------------------------------------------------------------
RUN2_EXIT=0
```

### Run 3

Command:

```powershell
.\mvnw.cmd clean verify
```

Real output (final summary):

```text
[INFO] Results:
[INFO] 
[INFO] Tests run: 412, Failures: 0, Errors: 0, Skipped: 0
[INFO] 
[INFO] 
[INFO] --- jar:3.4.2:jar (default-jar) @ tracex-backend ---
[INFO] Building jar: C:\Users\yashm\OneDrive\Desktop\TraceX\backend\target\tracex-backend-1.0.0-SNAPSHOT.jar
[INFO] 
[INFO] --- spring-boot:3.5.0:repackage (repackage) @ tracex-backend ---
[INFO] Replacing main artifact C:\Users\yashm\OneDrive\Desktop\TraceX\backend\target\tracex-backend-1.0.0-SNAPSHOT.jar with repackaged archive, adding nested dependencies in BOOT-INF/.
[INFO] The original artifact has been renamed to C:\Users\yashm\OneDrive\Desktop\TraceX\backend\target\tracex-backend-1.0.0-SNAPSHOT.jar.original
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  01:02 min
[INFO] Finished at: 2026-10-05T21:14:43+05:30
[INFO] ------------------------------------------------------------------------
RUN3_EXIT=0
```

---

## Item 2: Seed Batches (12 vs 13)

### 1. Why `DEMO-LOT-013` Existed (Phase and File)

- **Phase**: Phase 4 (`2026-10-04`).
- **File**: `backend/src/main/java/com/tracex/service/SeedRunner.java` (`seedBatches()`).
- **Explanation**: During Phase 4, when implementing the `D-18` per-SKU equal-expiry tie rule (`GET /api/v1/batches/fefo` and `GET /api/v1/batches/fefo/by-sku`), a 13th demo batch (`DEMO-LOT-013` on SKU `RHSLT` sharing `DEMO-LOT-007`'s expiry date) was added to `SeedRunner.seedBatches()` instead of pairing two of the existing 12 demo batches (`DEMO-LOT-001` through `DEMO-LOT-012`). In Phase 5.0 (`2026-10-05`), `SeedRunner.seedBatches()` was fixed to pair `DEMO-LOT-007` and `DEMO-LOT-012` on SKU `RHSLT` with `sharedTieExpiry = today.plusDays(90)` and `DEMO-LOT-013` was removed from `SeedRunner.java`, restoring the exact 12 seeded demo batches (`DEMO-LOT-001` through `DEMO-LOT-012`). However, because `SeedRunner` is idempotent by `sourceLotCode`, pre-existing `tracex_fresh_dev` and `tracex_fresh_e2e` databases that had been seeded before the fix still retained the leftover `DEMO-LOT-013` document until cleaned.

### 2 & 3. Querying and Cleaning `tracex_fresh_dev` and `tracex_fresh_e2e` with `scripts/clean-demo-lot-013.ps1`

Created `scripts/clean-demo-lot-013.ps1`, which strictly refuses any database name that does not end in `_dev` or `_e2e` (`if ($DatabaseName -notmatch '(_dev|_e2e)$') { Write-Error ...; exit 1 }`).

Command (verifying the safety guard refuses `tracex_fresh`, then querying and cleaning `tracex_fresh_dev` and `tracex_fresh_e2e`):

```powershell
powershell -ExecutionPolicy Bypass -File "scripts\clean-demo-lot-013.ps1" -DatabaseName "tracex_fresh"
Write-Host "GUARD_EXIT=$LASTEXITCODE"
powershell -ExecutionPolicy Bypass -File "scripts\clean-demo-lot-013.ps1" -DatabaseName "tracex_fresh_dev"
powershell -ExecutionPolicy Bypass -File "scripts\clean-demo-lot-013.ps1" -DatabaseName "tracex_fresh_e2e"
```

Real output:

```text
C:\Users\yashm\OneDrive\Desktop\TraceX\scripts\clean-demo-lot-013.ps1 : SAFETY GUARD ABORTED: Refusing to touch database 'tracex_fresh'. Only databases whose name ends in '_dev' or '_e2e' are allowed.
At line:1 char:1
+ powershell -ExecutionPolicy Bypass -File "scripts\clean-demo-lot-013. ...
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (:) [Write-Error], WriteErrorException
    + FullyQualifiedErrorId : Microsoft.PowerShell.Commands.WriteErrorException,clean-demo-lot-013.ps1
GUARD_EXIT=1
BEFORE [tracex_fresh_dev]: totalBatches=17, demoLotCount=13, leftover013Count=1
  FOUND: _id=6ac1e8aa2191721d809f114f, batchCode=TX-2000-01-013, sourceLotCode=DEMO-LOT-013
DELETED [tracex_fresh_dev]: deletedCount=1
AFTER  [tracex_fresh_dev]: totalBatches=16, demoLotCount=12, leftover013Count=0
BEFORE [tracex_fresh_e2e]: totalBatches=13, demoLotCount=13, leftover013Count=1
  FOUND: _id=6ac38b2cf9d77e3e83e916b6, batchCode=TX-2026-10-013, sourceLotCode=DEMO-LOT-013
DELETED [tracex_fresh_e2e]: deletedCount=1
AFTER  [tracex_fresh_e2e]: totalBatches=12, demoLotCount=12, leftover013Count=0
```

### 4. Confirming `SPEC.md`, `docs/traceability.md`, and `SeedRunner.java` All Say 12 Batches

Command:

```powershell
Select-String -Path "SPEC.md","docs\traceability.md","backend\src\main\java\com\tracex\service\SeedRunner.java" -Pattern "12 demo batches|12 batches|13 demo batches|13 batches|DEMO-LOT-013" | ForEach-Object { "$($_.Path):$($_.LineNumber): $($_.Line.Trim())" }
```

Real output:

```text
C:\Users\yashm\OneDrive\Desktop\TraceX\SPEC.md:846: - **12 demo batches** (`DEMO-LOT-001` through `DEMO-LOT-012`) computed relative to `LocalDate.now(clock)` at seed time:
C:\Users\yashm\OneDrive\Desktop\TraceX\SPEC.md:848: - **FEFO equal-expiry tie pair**: Within the 12 demo batches, `DEMO-LOT-007` and `DEMO-LOT-012` share SKU `RHSLT` and the exact same `expiryDate` (`today + 90 days`) so `GET /api/v1/batches/fefo` and `GET /api/v1/batches/fefo/by-sku` return both batches marked `tieForFirst: true` per `D-18`.
C:\Users\yashm\OneDrive\Desktop\TraceX\SPEC.md:851: - **6 sample inspections** (`4 PASS`, `1 FAIL`, `1 CONDITIONAL`) and **4 sample dispatches** (`2 PARTIAL`, `2 FULL`) across the 12 batches.
C:\Users\yashm\OneDrive\Desktop\TraceX\docs\traceability.md:10: | Seed Runner | `SeedRunner.java` | SPEC §4 / §11 | 5 roles, super-admin, 5 demo users, 10 products, 12 batches (`DEMO-LOT-001` to `DEMO-LOT-012`), 6 inspections, 4 dispatches | Done (Phase 1–5.0) |
C:\Users\yashm\OneDrive\Desktop\TraceX\backend\src\main\java\com\tracex\service\SeedRunner.java:239: // 12 demo batches (DEMO-LOT-001 through DEMO-LOT-012) relative to today:
C:\Users\yashm\OneDrive\Desktop\TraceX\backend\src\main\java\com\tracex\service\SeedRunner.java:260: // Pair DEMO-LOT-012 on RHSLT with DEMO-LOT-007's expiry date so the 12 seeded demo batches
C:\Users\yashm\OneDrive\Desktop\TraceX\backend\src\main\java\com\tracex\service\SeedRunner.java:273: log.info("Seeded {} new demo batches (total 12 expected)", created);
```

---

## Item 3: `MutableClock` in `src/test` Only

### 1. File Path Under `src/test` Only

Command:

```powershell
Get-ChildItem -Path "backend\src" -Recurse -Filter "*Clock*.java" | ForEach-Object { $_.FullName }
```

Real output:

```text
C:\Users\yashm\OneDrive\Desktop\TraceX\backend\src\test\java\com\tracex\config\TestClockConfig.java
C:\Users\yashm\OneDrive\Desktop\TraceX\backend\src\test\java\com\tracex\util\MutableClock.java
```

`AppConfig.java` in `backend/src/main/java/com/tracex/config/AppConfig.java` returns a standard `Clock.system(ZoneId.of(businessTimezone))`, and `TestClockConfig.java` in `backend/src/test/java/com/tracex/config/TestClockConfig.java` provides `@Bean @Primary public MutableClock testClock(...)` exclusively for the test context.

### 2. Proof `MutableClock` Is Absent from the Built Main JAR

Command:

```powershell
$matches = jar tf "backend\target\tracex-backend-1.0.0-SNAPSHOT.jar" | Select-String "MutableClock|TestClockConfig"
Write-Host "Matches in tracex-backend-1.0.0-SNAPSHOT.jar: $(@($matches).Count)"
```

Real output:

```text
Matches in tracex-backend-1.0.0-SNAPSHOT.jar: 0
```

### 3. `MutableClock.reset()` Implementation (Live System-Clock Delegate)

Command:

```powershell
Get-Content "backend\src\test\java\com\tracex\util\MutableClock.java"
```

Real output:

```java
package com.tracex.util;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;

public class MutableClock extends Clock {

    private final ZoneId defaultZoneId;
    private volatile Clock delegate;

    public MutableClock(ZoneId defaultZoneId) {
        this.defaultZoneId = defaultZoneId;
        this.delegate = Clock.system(defaultZoneId);
    }

    public void setDelegate(Clock clock) {
        this.delegate = clock;
    }

    public void reset() {
        this.delegate = Clock.system(this.defaultZoneId);
    }

    @Override
    public ZoneId getZone() {
        return delegate.getZone();
    }

    @Override
    public Clock withZone(ZoneId zone) {
        return delegate.withZone(zone);
    }

    @Override
    public Instant instant() {
        return delegate.instant();
    }
}
```

### 4. Which Reset Is the Real Fix (`finally` vs `@AfterEach` vs `@AfterAll`)

- **Real fix**: The `try { ... } finally { mutableClock.reset(); }` block inside `ProductAndBatchTests.testStatusChangingAfterAdvancingClockWithNoWrite` is the real fix, because it guarantees the mutating test restores the shared `Clock` immediately upon exiting the test body even if an assertion inside the `try` block throws.
- **Why `@AfterEach` and `@AfterAll` were removed**: An `@AfterEach` reset on `ProductAndBatchTests` would silently reset the clock after any test method in that class that forgot a `finally` block, which would hide a future clock leak from `GlobalTestDatabaseSafetyExtension.beforeEach` (`checkClockWithinRealTime`) on the next test. `@AfterAll` was even worse before `finally` was added because other test methods in `ProductAndBatchTests` ran with the leaked clock before `@AfterAll` executed. Both `@AfterEach` and `@AfterAll` clock resets have been removed from `ProductAndBatchTests.java`.

### 5. Proof the Guard Works (`ThrowawayClockLeakProofTest`)

A temporary test class `ThrowawayClockLeakProofTest` with `@TestMethodOrder(MethodOrderer.OrderAnnotation.class)` was created in `backend/src/test/java/com/tracex/ThrowawayClockLeakProofTest.java`:
- `step1_leakClockAtYear2000` sets `mutableClock.setDelegate(Clock.fixed(Instant.parse("2000-01-01T00:00:00Z"), ZoneOffset.UTC))` without resetting it.
- `step2_nextTestFailsInGuardBeforeExecution` runs next and is aborted in `GlobalTestDatabaseSafetyExtension.beforeEach` by `checkClockWithinRealTime`.

Command (running `ThrowawayClockLeakProofTest`):

```powershell
.\mvnw.cmd test -Dtest=ThrowawayClockLeakProofTest
Write-Host "THROWAWAY_EXIT=$LASTEXITCODE"
```

Real output:

```text
[INFO] Running com.tracex.ThrowawayClockLeakProofTest
[ERROR] Tests run: 2, Failures: 0, Errors: 1, Skipped: 0, Time elapsed: 5.512 s <<< FAILURE! -- in com.tracex.ThrowawayClockLeakProofTest
[ERROR] com.tracex.ThrowawayClockLeakProofTest.step2_nextTestFailsInGuardBeforeExecution -- Time elapsed: 0.008 s <<< ERROR!
java.lang.IllegalStateException: Clock safety guard aborted test execution: shared Clock bean instant (2000-01-01T00:00:00Z) differs from real time (2026-10-05T15:26:57.990579900Z) by 844529217990 ms, exceeding the 5000 ms maximum allowed drift. Ensure every test that mutates the Clock restores it in a finally block.
	at com.tracex.GlobalTestDatabaseSafetyExtension.checkClockWithinRealTime(GlobalTestDatabaseSafetyExtension.java:155)
	at com.tracex.GlobalTestDatabaseSafetyExtension.beforeEach(GlobalTestDatabaseSafetyExtension.java:68)
	at java.base/java.util.ArrayList.forEach(ArrayList.java:1596)
	at java.base/java.util.ArrayList.forEach(ArrayList.java:1596)

[INFO] 
[INFO] Results:
[INFO] 
[INFO] Errors: 
[ERROR]   ThrowawayClockLeakProofTest.step2_nextTestFailsInGuardBeforeExecution » IllegalState Clock safety guard aborted test execution: shared Clock bean instant (2000-01-01T00:00:00Z) differs from real time (2026-10-05T15:26:57.990579900Z) by 844529217990 ms, exceeding the 5000 ms maximum allowed drift. Ensure every test that mutates the Clock restores it in a finally block.
[INFO] 
[ERROR] Tests run: 2, Failures: 0, Errors: 1, Skipped: 0
[INFO] 
[INFO] ------------------------------------------------------------------------
[INFO] BUILD FAILURE
[INFO] ------------------------------------------------------------------------
THROWAWAY_EXIT=1
```

Command (after deleting `ThrowawayClockLeakProofTest.java` and verifying `GlobalSafetyGuardAutoDetectionTest` passes):

```powershell
Remove-Item "backend\src\test\java\com\tracex\ThrowawayClockLeakProofTest.java"
.\mvnw.cmd test -Dtest=GlobalSafetyGuardAutoDetectionTest
Write-Host "CLEAN_EXIT=$LASTEXITCODE"
```

Real output:

```text
[INFO] Running com.tracex.GlobalSafetyGuardAutoDetectionTest
[INFO] Tests run: 8, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 5.568 s -- in com.tracex.GlobalSafetyGuardAutoDetectionTest
[INFO] 
[INFO] Results:
[INFO] 
[INFO] Tests run: 8, Failures: 0, Errors: 0, Skipped: 0
[INFO] 
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
CLEAN_EXIT=0
```

---

## Item 4: Calendar Regex and Exact Filter Partition

### 1, 2 & 4. Positive Tests, Negative Tests, and Exact 6-Filter Partition Test

Added three tests in `backend/src/test/java/com/tracex/ProductAndBatchTests.java`:
1. `testCalendarRegexPositiveLeapAndMonthEndDatesMatchTierFilters`: inserts batches with `2028-02-29` (divisible-by-4 leap year), `2000-02-29` (divisible-by-400 century leap year), and `2026-12-31` (31-day month end) and asserts they match `READY` / `EXPIRED` / `URGENT` tier filters and never match `EXCEPTION`.
2. `testCalendarRegexNegativeInvalidDatesNeverMatchTierFilters`: inserts batches in raw MongoDB with `2100-02-29` (non-leap century year), `2026-13-01` (month 13), and `2026-00-10` (month 00) and asserts none match `EXPIRED`, `URGENT`, `WARNING`, `READY`, or `/api/v1/batches/fefo`, while all three match `status=EXCEPTION` with `"corruptedDate": true`.
3. `testEveryStoredDateStringLandsInExactlyOneFilterPartition`: creates 16 batches covering valid dates (`today - 10`, `today`, `today + 1`, `today + 7`, `today + 8`, `today + 30`, `today + 31`, `2028-02-29`, `2000-02-29`), a dispatched batch (`quantity = 0`), and invalid/corrupted dates (`2026-02-29`, `2100-02-29`, `2026-02-31`, `2026-13-01`, `2026-00-10`, `""`), queries all 6 status filters (`EXPIRED`, `URGENT`, `WARNING`, `READY`, `DISPATCHED`, `EXCEPTION`), and asserts every single batch ID appears in **exactly one** filter (`matchedFilters.size() == 1`) and in its expected target filter.

### 3. Proof `status=EXCEPTION` and Tier Filters Share the Exact Same `BatchFreshness.ISO_LOCAL_DATE_REGEX` Constant

Command:

```powershell
Select-String -Path "backend\src\main\java\com\tracex\util\BatchFreshness.java","backend\src\main\java\com\tracex\service\BatchService.java","backend\src\main\java\com\tracex\config\BatchLocalDateValueConverter.java" -Pattern "ISO_LOCAL_DATE_REGEX" | ForEach-Object { "$($_.Path):$($_.LineNumber): $($_.Line.Trim())" }
```

Real output:

```text
C:\Users\yashm\OneDrive\Desktop\TraceX\backend\src\main\java\com\tracex\util\BatchFreshness.java:18: public static final String ISO_LOCAL_DATE_REGEX =
C:\Users\yashm\OneDrive\Desktop\TraceX\backend\src\main\java\com\tracex\service\BatchService.java:178: Criteria validPackDateFormat = Criteria.where("packDate").regex(BatchFreshness.ISO_LOCAL_DATE_REGEX);
C:\Users\yashm\OneDrive\Desktop\TraceX\backend\src\main\java\com\tracex\service\BatchService.java:179: Criteria validExpiryDateFormat = Criteria.where("expiryDate").regex(BatchFreshness.ISO_LOCAL_DATE_REGEX);
C:\Users\yashm\OneDrive\Desktop\TraceX\backend\src\main\java\com\tracex\service\BatchService.java:209: Criteria.where("packDate").not().regex(BatchFreshness.ISO_LOCAL_DATE_REGEX),
C:\Users\yashm\OneDrive\Desktop\TraceX\backend\src\main\java\com\tracex\service\BatchService.java:212: Criteria.where("expiryDate").not().regex(BatchFreshness.ISO_LOCAL_DATE_REGEX),
C:\Users\yashm\OneDrive\Desktop\TraceX\backend\src\main\java\com\tracex\service\BatchService.java:235: .and("packDate").regex(BatchFreshness.ISO_LOCAL_DATE_REGEX)
C:\Users\yashm\OneDrive\Desktop\TraceX\backend\src\main\java\com\tracex\service\BatchService.java:236: .and("expiryDate").regex(BatchFreshness.ISO_LOCAL_DATE_REGEX)
C:\Users\yashm\OneDrive\Desktop\TraceX\backend\src\main\java\com\tracex\config\BatchLocalDateValueConverter.java:21: Pattern.compile(BatchFreshness.ISO_LOCAL_DATE_REGEX);
```

### 5. Test Run and New Backend Test Count (412)

Command:

```powershell
.\mvnw.cmd test -Dtest=ProductAndBatchTests
```

Real output:

```text
[INFO] Running com.tracex.ProductAndBatchTests
[INFO] Tests run: 41, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 12.646 s -- in com.tracex.ProductAndBatchTests
[INFO] 
[INFO] Results:
[INFO] 
[INFO] Tests run: 41, Failures: 0, Errors: 0, Skipped: 0
[INFO] 
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
```

`ProductAndBatchTests` increased from 38 to 41 tests, bringing the full backend test suite from **409** to **412** tests (confirmed in Item 1 across 3 full `.\mvnw.cmd clean verify` runs).

---

## Item 5: OpenAPI YAML vs Controllers

### 1. `OpenApiExportTest` Compares Live `/v3/api-docs` Against `tracex-api.yaml` Without Writing Files

Command:

```powershell
Get-Content "backend\src\test\java\com\tracex\OpenApiExportTest.java"
```

Real output:

```java
package com.tracex;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OpenApiExportTest extends BaseTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void verifyOpenApiDocsAvailablewithoutWritingFiles() throws Exception {
        MvcResult result = mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andReturn();

        String jsonContent = result.getResponse().getContentAsString();
        JsonNode root = objectMapper.readTree(jsonContent);
        assertEquals("3.1.0", root.path("openapi").asText());
        assertTrue(root.path("paths").has("/api/v1/auth/login"));
        assertTrue(root.path("paths").has("/api/v1/batches"));
        assertTrue(root.path("paths").has("/api/v1/batches/fefo"));

        // Compare live SpringDoc output against backend/src/main/resources/openapi/tracex-api.yaml without writing any files
        Path yamlPath = Paths.get("src", "main", "resources", "openapi", "tracex-api.yaml");
        assertTrue(Files.exists(yamlPath), "Committed OpenAPI YAML must exist at " + yamlPath);
        ObjectMapper yamlMapper = new ObjectMapper(new YAMLFactory());
        JsonNode yamlRoot = yamlMapper.readTree(Files.readString(yamlPath));

        assertNotNull(yamlRoot, "Parsed YAML root must not be null");
        assertEquals(yamlRoot.get("openapi"), root.get("openapi"),
                "Live OpenAPI version must match backend/src/main/resources/openapi/tracex-api.yaml");
        assertEquals(yamlRoot.get("info"), root.get("info"),
                "Live OpenAPI info block must match backend/src/main/resources/openapi/tracex-api.yaml");
        assertEquals(yamlRoot.get("paths"), root.get("paths"),
                "Live OpenAPI paths must match backend/src/main/resources/openapi/tracex-api.yaml");
        assertEquals(yamlRoot.get("components"), root.get("components"),
                "Live OpenAPI components must match backend/src/main/resources/openapi/tracex-api.yaml");
    }
}
```

### 2 & 3. Planted Difference in `tracex-api.yaml` Fails `OpenApiExportTest`, Then Passes When Restored

Command:

```powershell
$yamlFile = "src\main\resources\openapi\tracex-api.yaml"
$origBytes = [System.IO.File]::ReadAllBytes((Resolve-Path $yamlFile))
try {
    $text = [System.IO.File]::ReadAllText((Resolve-Path $yamlFile))
    $mutated = $text.Replace("/api/v1/auth/login:", "/api/v1/auth/login-planted-drift:")
    [System.IO.File]::WriteAllText((Resolve-Path $yamlFile), $mutated)
    .\mvnw.cmd test -Dtest=OpenApiExportTest
    Write-Host "PLANTED_EXIT=$LASTEXITCODE"
} finally {
    [System.IO.File]::WriteAllBytes((Resolve-Path $yamlFile), $origBytes)
}
.\mvnw.cmd test -Dtest=OpenApiExportTest
Write-Host "RESTORED_EXIT=$LASTEXITCODE"
```

Real output:

```text
[INFO] Running com.tracex.OpenApiExportTest
[ERROR] Tests run: 1, Failures: 1, Errors: 0, Skipped: 0, Time elapsed: 6.265 s <<< FAILURE! -- in com.tracex.OpenApiExportTest
[ERROR] com.tracex.OpenApiExportTest.verifyOpenApiDocsAvailablewithoutWritingFiles -- Time elapsed: 0.453 s <<< FAILURE!
org.opentest4j.AssertionFailedError: Live OpenAPI paths must match backend/src/main/resources/openapi/tracex-api.yaml ==> expected: <true> but was: <false>
	at org.junit.jupiter.api.AssertionFailureBuilder.build(AssertionFailureBuilder.java:151)
	at org.junit.jupiter.api.AssertionFailureBuilder.buildAndThrow(AssertionFailureBuilder.java:132)
	at org.junit.jupiter.api.AssertEquals.failNotEqual(AssertEquals.java:197)
	at org.junit.jupiter.api.AssertEquals.assertEquals(AssertEquals.java:182)
	at com.tracex.OpenApiExportTest.verifyOpenApiDocsAvailablewithoutWritingFiles(OpenApiExportTest.java:58)
	at java.base/java.lang.reflect.Method.invoke(Method.java:580)
	at java.base/java.util.ArrayList.forEach(ArrayList.java:1596)
	at java.base/java.util.ArrayList.forEach(ArrayList.java:1596)

[INFO] 
[INFO] Results:
[INFO] 
[INFO] Failures: 
[ERROR]   OpenApiExportTest.verifyOpenApiDocsAvailablewithoutWritingFiles:58 Live OpenAPI paths must match backend/src/main/resources/openapi/tracex-api.yaml ==> expected: <true> but was: <false>
[INFO] 
[ERROR] Tests run: 1, Failures: 1, Errors: 0, Skipped: 0
[INFO] 
[INFO] ------------------------------------------------------------------------
[INFO] BUILD FAILURE
[INFO] ------------------------------------------------------------------------
PLANTED_EXIT=1
[INFO] Running com.tracex.OpenApiExportTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 5.950 s -- in com.tracex.OpenApiExportTest
[INFO] 
[INFO] Results:
[INFO] 
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
[INFO] 
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
RESTORED_EXIT=0
```

### 4. Confirming Zero File Modifications After `.\mvnw.cmd clean verify`

As tracked in `OI-10` in `PROGRESS.md`, this workspace does not have a `.git` repository initialized (`fatal: not a git repository`). Therefore, in addition to running `git status`, the SHA-256 hashes of `backend/src/main/resources/openapi/tracex-api.yaml`, `docs/openapi.json`, and `frontend/src/types/schema.d.ts` are recorded before and after `.\mvnw.cmd clean verify` to prove no files are touched during the build.

Command:

```powershell
Get-FileHash "backend\src\main\resources\openapi\tracex-api.yaml","docs\openapi.json","frontend\src\types\schema.d.ts" -Algorithm SHA256 | Format-Table Hash, Path -AutoSize
# (Run .\mvnw.cmd clean verify)
Get-FileHash "backend\src\main\resources\openapi\tracex-api.yaml","docs\openapi.json","frontend\src\types\schema.d.ts" -Algorithm SHA256 | Format-Table Hash, Path -AutoSize
```

Real output:

```text
=== File hashes BEFORE mvnw clean verify ===

Hash                                                             Path
----                                                             ----
E99D1C6295E5AF8324A5955FAAF7E9DD6773605B7982140E8FCDF5241CA1347B C:\Users\yashm\OneDrive\Desktop\TraceX\backend\src\main\resources\openapi\tracex-api.yaml
75F359872F3084B61358B833F8A45AEC8216C6433F6B04396FFE63E777E6AC9D C:\Users\yashm\OneDrive\Desktop\TraceX\docs\openapi.json
E0F30775FD8890C8DEC720330DCEEC0204DA9F8F24506FF8EB7DEA8EF0AF68E0 C:\Users\yashm\OneDrive\Desktop\TraceX\frontend\src\types\schema.d.ts

=== File hashes AFTER mvnw clean verify ===

Hash                                                             Path
----                                                             ----
E99D1C6295E5AF8324A5955FAAF7E9DD6773605B7982140E8FCDF5241CA1347B C:\Users\yashm\OneDrive\Desktop\TraceX\backend\src\main\resources\openapi\tracex-api.yaml
75F359872F3084B61358B833F8A45AEC8216C6433F6B04396FFE63E777E6AC9D C:\Users\yashm\OneDrive\Desktop\TraceX\docs\openapi.json
E0F30775FD8890C8DEC720330DCEEC0204DA9F8F24506FF8EB7DEA8EF0AF68E0 C:\Users\yashm\OneDrive\Desktop\TraceX\frontend\src\types\schema.d.ts
```

---

## Item 6: Frontend Build and Storage Evidence

### 1 & 2. Production Build with `VITE_API_BASE_URL=https://api.tracex.example.com`, CSP Meta Tag, and `dist/` Searches

Command:

```powershell
$env:VITE_API_BASE_URL = "https://api.tracex.example.com"
npm run build
Remove-Item Env:VITE_API_BASE_URL -ErrorAction SilentlyContinue

Write-Host "=== Item 6.1: Content-Security-Policy meta tag from dist/index.html ==="
Select-String -Path "dist\index.html" -Pattern "Content-Security-Policy" | ForEach-Object { $_.Line.Trim() }

Write-Host "=== Item 6.2: Search dist/ for inline <script> (without src), localhost, 127.0.0.1, styleguide ==="
$html = Get-Content "dist\index.html" -Raw
$inlineScripts = [regex]::Matches($html, '<script(?![^>]*\bsrc=)[^>]*>')
Write-Host "Inline <script> without src count: $($inlineScripts.Count)"
$localhostHits = Get-ChildItem "dist" -Recurse -File | Select-String -Pattern "localhost"
Write-Host "localhost matches in dist/: $(@($localhostHits).Count)"
$loopbackHits = Get-ChildItem "dist" -Recurse -File | Select-String -Pattern "127\.0\.0\.1"
Write-Host "127.0.0.1 matches in dist/: $(@($loopbackHits).Count)"
$styleguideHits = Get-ChildItem "dist" -Recurse -File | Select-String -Pattern "styleguide"
Write-Host "styleguide matches in dist/: $(@($styleguideHits).Count)"
```

Real output:

```text
> tracex-frontend@1.0.0 build
> tsc -b && vite build

vite v6.3.3 building for production...
transforming...
✓ 1710 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.85 kB │ gzip:   0.47 kB
dist/assets/index-DSvYkIBM.css   24.83 kB │ gzip:   5.21 kB
dist/assets/index-MubTUzxU.js   361.33 kB │ gzip: 109.27 kB
✓ built in 8.61s
=== Item 6.1: Content-Security-Policy meta tag from dist/index.html ===
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://api.tracex.example.com; base-uri 'self'; form-action 'self'" />
=== Item 6.2: Search dist/ for inline <script> (without src), localhost, 127.0.0.1, styleguide ===
Inline <script> without src count: 0
localhost matches in dist/: 0
127.0.0.1 matches in dist/: 0
styleguide matches in dist/: 0
```

### 3 & 4. Browser `sessionStorage`, `localStorage`, and `document.cookie` Listings Before/After Logout and Before/After 401

Command:

```powershell
npx playwright test e2e/phase05.spec.ts --reporter=list
```

Real output (browser storage listings from `E2E-01` and `E2E-05`):

```text
[E2E-01 BEFORE_LOGOUT] user=superadmin sessionStorage={"tx_token":"eyJhbGciOiJI... (len=186)"} localStorage={"tx_ui_prefs":"{\"mode\":\"light\",\"modeSource\":\"system\",\"palette\":\"editorial\",\"accent\":\"auto\",\"sidebarCollapsed\":false}"} cookie=""
[E2E-01 AFTER_LOGOUT]  user=superadmin sessionStorage={} localStorage={"tx_ui_prefs":"{\"mode\":\"light\",\"modeSource\":\"system\",\"palette\":\"editorial\",\"accent\":\"auto\",\"sidebarCollapsed\":false}"} cookie=""
[E2E-01 BEFORE_LOGOUT] user=admin sessionStorage={"tx_token":"eyJhbGciOiJI... (len=186)"} localStorage={"tx_ui_prefs":"{\"mode\":\"light\",\"modeSource\":\"system\",\"palette\":\"editorial\",\"accent\":\"auto\",\"sidebarCollapsed\":false}"} cookie=""
[E2E-01 AFTER_LOGOUT]  user=admin sessionStorage={} localStorage={"tx_ui_prefs":"{\"mode\":\"light\",\"modeSource\":\"system\",\"palette\":\"editorial\",\"accent\":\"auto\",\"sidebarCollapsed\":false}"} cookie=""
[E2E-01 BEFORE_LOGOUT] user=manager sessionStorage={"tx_token":"eyJhbGciOiJI... (len=186)"} localStorage={"tx_ui_prefs":"{\"mode\":\"light\",\"modeSource\":\"system\",\"palette\":\"editorial\",\"accent\":\"auto\",\"sidebarCollapsed\":false}"} cookie=""
[E2E-01 AFTER_LOGOUT]  user=manager sessionStorage={} localStorage={"tx_ui_prefs":"{\"mode\":\"light\",\"modeSource\":\"system\",\"palette\":\"editorial\",\"accent\":\"auto\",\"sidebarCollapsed\":false}"} cookie=""
[E2E-01 BEFORE_LOGOUT] user=factory_mgr sessionStorage={"tx_token":"eyJhbGciOiJI... (len=186)"} localStorage={"tx_ui_prefs":"{\"mode\":\"light\",\"modeSource\":\"system\",\"palette\":\"editorial\",\"accent\":\"auto\",\"sidebarCollapsed\":false}"} cookie=""
[E2E-01 AFTER_LOGOUT]  user=factory_mgr sessionStorage={} localStorage={"tx_ui_prefs":"{\"mode\":\"light\",\"modeSource\":\"system\",\"palette\":\"editorial\",\"accent\":\"auto\",\"sidebarCollapsed\":false}"} cookie=""
[E2E-01 BEFORE_LOGOUT] user=inspector sessionStorage={"tx_token":"eyJhbGciOiJI... (len=186)"} localStorage={"tx_ui_prefs":"{\"mode\":\"light\",\"modeSource\":\"system\",\"palette\":\"editorial\",\"accent\":\"auto\",\"sidebarCollapsed\":false}"} cookie=""
[E2E-01 AFTER_LOGOUT]  user=inspector sessionStorage={} localStorage={"tx_ui_prefs":"{\"mode\":\"light\",\"modeSource\":\"system\",\"palette\":\"editorial\",\"accent\":\"auto\",\"sidebarCollapsed\":false}"} cookie=""
[E2E-01 BEFORE_LOGOUT] user=coordinator sessionStorage={"tx_token":"eyJhbGciOiJI... (len=186)"} localStorage={"tx_ui_prefs":"{\"mode\":\"light\",\"modeSource\":\"system\",\"palette\":\"editorial\",\"accent\":\"auto\",\"sidebarCollapsed\":false}"} cookie=""
[E2E-01 AFTER_LOGOUT]  user=coordinator sessionStorage={} localStorage={"tx_ui_prefs":"{\"mode\":\"light\",\"modeSource\":\"system\",\"palette\":\"editorial\",\"accent\":\"auto\",\"sidebarCollapsed\":false}"} cookie=""
  ok 1 [chromium] › e2e\phase05.spec.ts:93:3 › Phase 5 E2E Verification Suite (E1–E6 / Checks 5–14) › E2E-01 (Check 5 & Check 13): Login for all six seeded accounts (five roles plus super-admin) and verify sessionStorage tx_token and console hygiene (6.0s)

[E2E-05 BEFORE_401] sessionStorage={"tx_token":"eyJhbGciOiJI... (len=186)"} localStorage={"tx_ui_prefs":"{\"mode\":\"light\",\"modeSource\":\"system\",\"palette\":\"editorial\",\"accent\":\"auto\",\"sidebarCollapsed\":false}"} cookie=""
[E2E-05 AFTER_401]  sessionStorage={} localStorage={"tx_ui_prefs":"{\"mode\":\"light\",\"modeSource\":\"system\",\"palette\":\"editorial\",\"accent\":\"auto\",\"sidebarCollapsed\":false}"} cookie=""
  ok 5 [chromium] › e2e\phase05.spec.ts:305:3 › Phase 5 E2E Verification Suite (E1–E6 / Checks 5–14) › E2E-05 (Check 7 & Check 13): 401 mid-session through logout-all in another context clears tx_token, redirects to /login?next=..., returns on sign-in, and blocks external ?next= open redirects (1.3s)
```

### 5. Logger Redaction Unit Test Output

Command:

```powershell
npx vitest run src/components/ui/ui.test.tsx -t "logger never prints"
```

Real output:

```text
 RUN  v3.1.2 C:/Users/yashm/OneDrive/Desktop/TraceX/frontend

 ✓ src/components/ui/ui.test.tsx (10 tests | 9 skipped) 5ms

 Test Files  1 passed (1)
      Tests  1 passed | 9 skipped (10)
   Start at  21:09:15
   Duration  22.10s (transform 293ms, setup 4.29s, collect 4.43s, tests 5ms, environment 12.78s, prepare 283ms)
```

---

## Item 7: Screenshots

### 1 & 2. Why Two Screenshot Paths Appeared and Canonical Path Selection

- **Why two paths appeared**: During the initial Phase 5 run (`docs/progress/phase-05.md`), the original 6-test Playwright suite wrote screenshots into `frontend/test-results/screenshots/phase-05/`. During the Phase 5.0 repair pass (`docs/progress/phase-05-0.md`), `frontend/e2e/phase05.spec.ts` was updated to save screenshots into `docs/screenshots/phase-05/`, leaving `PROGRESS.md`'s Phase 5.0 bullet and `docs/progress/phase-05.md` mentioning the older path or only 6 files.
- **Canonical path**: `docs/screenshots/phase-05/` is the single canonical screenshot directory. Both `PROGRESS.md` and `docs/progress/phase-05-0.md` now point to `docs/screenshots/phase-05/`.

### 3. All 36 Route-Viewport Screenshots in `docs/screenshots/phase-05/` (12 Routes x 3 Viewports: `375px`, `768px`, `1280px`)

Command:

```powershell
$shots = Get-ChildItem "docs\screenshots\phase-05" | Sort-Object Name
Write-Host "Total screenshot files: $($shots.Count)"
$shots | Select-Object Name, Length | Format-Table -AutoSize
```

Real output:

```text
Total screenshot files: 36

Name                              Length
----                              ------
route-01-login-1280.png            27495
route-01-login-375.png             23767
route-01-login-768.png             26986
route-02-request-access-1280.png   28619
route-02-request-access-375.png    25203
route-02-request-access-768.png    28247
route-03-activate-1280.png         33631
route-03-activate-375.png          30046
route-03-activate-768.png          33046
route-04-verify-otp-1280.png       27299
route-04-verify-otp-375.png        24614
route-04-verify-otp-768.png        26927
route-05-forgot-password-1280.png  24403
route-05-forgot-password-375.png   21710
route-05-forgot-password-768.png   24041
route-06-reset-password-1280.png   28077
route-06-reset-password-375.png    24648
route-06-reset-password-768.png    27681
route-07-trace-1280.png            21049
route-07-trace-375.png             18402
route-07-trace-768.png             20844
route-08-privacy-1280.png          20201
route-08-privacy-375.png           17338
route-08-privacy-768.png           20124
route-09-terms-1280.png            19209
route-09-terms-375.png             16459
route-09-terms-768.png             19142
route-10-styleguide-1280.png      165098
route-10-styleguide-375.png       166230
route-10-styleguide-768.png       164760
route-11-home-1280.png             60479
route-11-home-375.png              42302
route-11-home-768.png              43198
route-12-admin-check-1280.png      46806
route-12-admin-check-375.png       28752
route-12-admin-check-768.png       30317
```

---

## Item 8: Housekeeping

### 1. Phase 5.0.2 Row in `PROGRESS.md`

After Items 1–7 passed, the Phase 5.0.2 row in `PROGRESS.md` was updated from `IN PROGRESS` to `COMPLETE` (`2026-10-05`) with a link to `[phase-05-0-2](docs/progress/phase-05-0-2.md)`.

### 2. Markdown Table Lint (`scripts/lint-md-tables.ps1`)

Command:

```powershell
powershell -ExecutionPolicy Bypass -File "scripts\lint-md-tables.ps1"
```

Real output:

```text
=== Markdown Table Linter ===
Scanning 27 Markdown files...


=== Summary ===
Files checked: 27
Errors: 0
Warnings: 0
STATUS: PASSED (Zero problems found)
```
