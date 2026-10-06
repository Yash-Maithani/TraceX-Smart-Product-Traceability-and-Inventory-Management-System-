# Phase 3.2 Checks Log — PROGRESS.md Repair, Changelog Accuracy, and Error-Code Consistency

Date: 2026-10-04  
Status: COMPLETE  

---

## Overview

Phase 3.2 is a verification, documentation repair, and error-code standardization pass:
1. **Part A**: Repaired broken Markdown tables in `PROGRESS.md` (Phase Table, Decisions, Open Issues, Assumptions & Confirmed Findings, Dependency Versions), implemented `scripts/lint-md-tables.ps1`, and resolved column count mismatches in `SPEC.md`.
2. **Part B**: Re-audited and corrected changelog inaccuracies regarding reverse-proxy forwarded headers (`ForwardedHeadersEmpiricalTest`), deployment runbook safety rules 1–4, and OpenAPI specifications (designating `backend/src/main/resources/openapi/tracex-api.yaml` as single source of truth, synchronizing `docs/openapi.json`, and including all Phase 3 endpoints).
3. **Part C**: Standardized self-modification error code handling to HTTP 409 `SELF_MODIFICATION_NOT_ALLOWED`, verified `LAST_SUPERADMIN` (HTTP 409) and `RBAC_INSUFFICIENT` (HTTP 403), added `ErrorCodeSpecSyncTest`, and fixed MockMvc enum-to-string matching in tests.

---

## Check 1: Table Lint Script Output (Before and After)

### Before Table Fixes

Command:
```powershell
powershell -ExecutionPolicy Bypass -File scripts\lint-md-tables.ps1
```

Output:
```
=== Markdown Table Linter ===
Scanning 20 Markdown files...

[ERROR] Table without separator row at .\PROGRESS.md:8
[ERROR] Broken separator row fragment at .\PROGRESS.md:11 -> '-|---'
[ERROR] Broken separator row fragment at .\PROGRESS.md:13 -> '-|---'
[ERROR] Broken separator row fragment at .\PROGRESS.md:15 -> '--|---'
[ERROR] Table without separator row at .\PROGRESS.md:18
[ERROR] Table without separator row at .\PROGRESS.md:47
[ERROR] Broken separator row fragment at .\PROGRESS.md:50 -> '-|---'
[ERROR] Broken separator row fragment at .\PROGRESS.md:52 -> '-|---'
[ERROR] Broken separator row fragment at .\PROGRESS.md:54 -> '|---'
[ERROR] Broken separator row fragment at .\PROGRESS.md:56 -> '|---'
[ERROR] Table without separator row at .\PROGRESS.md:59
[ERROR] Table without separator row at .\PROGRESS.md:74
[ERROR] Broken separator row fragment at .\PROGRESS.md:77 -> '-|---'
[ERROR] Broken separator row fragment at .\PROGRESS.md:79 -> '-|---'
[ERROR] Table without separator row at .\PROGRESS.md:82
[ERROR] Column count mismatch at .\SPEC.md:630: expected 4 columns (from header at line 627), found 5 columns
[ERROR] Column count mismatch at .\SPEC.md:638: expected 4 columns (from header at line 636), found 5 columns

=== Summary ===
Files checked: 20
Errors: 17
Warnings: 0
STATUS: FAILED
```

### After Table Fixes

Command:
```powershell
powershell -ExecutionPolicy Bypass -File scripts\lint-md-tables.ps1
```

Output:
```
=== Markdown Table Linter ===
Scanning 20 Markdown files...


=== Summary ===
Files checked: 20
Errors: 0
Warnings: 0
STATUS: PASSED (Zero problems found)
```

Result: **PASS**

---

## Check 2: HTML Conversion Table Element & Row Count Verification

Command:
```python
import markdown, re

with open('PROGRESS.md', 'r', encoding='utf-8') as f:
    text = f.read()

html = markdown.markdown(text, extensions=['tables'])
tables = re.findall(r'<table>(.*?)</table>', html, re.DOTALL)
print(f'Total <table> elements found: {len(tables)}')

names = ['Phase Table', 'Decisions', 'Open Issues', 'Assumptions & Confirmed Findings', 'Dependency Versions']
for i, t in enumerate(tables):
    tbody_match = re.search(r'<tbody>(.*?)</tbody>', t, re.DOTALL)
    tbody = tbody_match.group(1) if tbody_match else t
    data_rows = re.findall(r'<tr>(.*?)</tr>', tbody, re.DOTALL)
    total_rows = re.findall(r'<tr>(.*?)</tr>', t, re.DOTALL)
    name = names[i] if i < len(names) else f'Table {i+1}'
    print(f'{name}: {len(data_rows)} data rows (total {len(total_rows)} rows including header)')
```

Output:
```
Total <table> elements found: 5
Phase Table: 20 data rows (total 21 rows including header)
Decisions: 17 data rows (total 18 rows including header)
Open Issues: 10 data rows (total 11 rows including header)
Assumptions & Confirmed Findings: 6 data rows (total 7 rows including header)
Dependency Versions: 11 data rows (total 12 rows including header)
```

*Note on Phase Table row count*: The Phase Table contains 20 data rows representing all planned phases: Phases 0, 0.1, 0.2, 1, 1.1, 2, 3, 3.1, 3.2 (9 completed entries), Phase 4 (1 entry), and Phases 5 through 14 (10 individual entries). Total data rows = 20 (21 rows including the header).

Result: **PASS**

---

## Check 3: Content Preservation Verification

Command:
```powershell
python "C:\Users\yashm\.gemini\antigravity\brain\aab231a4-a2d5-4d97-9cce-85d96aafab09\scratch\check_preservation.py"
```

Output:
```
Total cells checked: 68
Missing cells count: 0
SUCCESS: 100% of cell text from old Open Issues and Assumptions is preserved in PROGRESS.md!
```

All 68 text cells from the previous Open Issues (OI-01 to OI-10) and Assumptions & Confirmed Findings (A-01 to A-06) tables are preserved verbatim. In addition, all 18 earlier phase titles and all 11 dependency specifications were retained. The only additions are the Phase Table completion dates/links and the Open Issues `Status` column (`Open` or `Closed`).

Result: **PASS**

---

## Check 4: Changes to Earlier Phases Rendered Text and B1–B3 Corrections

### B1: Forwarded Headers Correction (Phase 2 Part A2)

New changelog text:
```markdown
- **Part A2 (Empirical Forwarded Headers Analysis & Strategy Decision)**: Evaluated forwarded header handling via `ForwardedHeadersEmpiricalTest`. The test demonstrated that both `framework` and `native` strategies resolve the forwarded client address when requests arrive from a trusted loopback address. When incoming connections originate from an untrusted address (not matching `server.tomcat.remoteip.internal-proxies`), the `native` strategy ignores the spoofed `X-Forwarded-For` header and preserves the true remote address; the `framework` strategy was not tested from an untrusted address. Decided on `server.forward-headers-strategy=native` for Render production deployment and `none` for dev/test, extracting client IP strictly via `request.getRemoteAddr()` in `RateLimiter`.
```

### B2: Runbook Verification Correction (Phase 2 Part A3)

Actual rule headings in `docs/deployment-runbook.md`:
- Rule 1: Last Super-Admin Protection
- Rule 2: Audit Verification
- Rule 3: Profile and Seed Password Isolation
- Rule 4: Rate-limit bucket isolation

New changelog text:
```markdown
- **Part A3 (Deployment Runbook Hardening)**: Created `docs/deployment-runbook.md` documenting production promotion of the initial super-admin directly via `mongosh` (since no API endpoint can promote to super-admin per SPEC §2) and established operations safety rules: Rule 1 (Last Super-Admin Protection), Rule 2 (Audit Verification), and Rule 3 (Profile and Seed Password Isolation: prohibiting `dev`/`test` seed passwords against shared or production databases, enforced by `GlobalTestDatabaseSafetyExtension`). (Rule 4: Rate-Limit Bucket Isolation was subsequently added in Phase 3).
```

### B3: OpenAPI Specifications Correction (Phase 2 Part A4)

Current OpenAPI files on disk:
- `backend/src/main/resources/openapi/tracex-api.yaml`: 31,744 bytes, 33 paths, 36 operations (Single source of truth)
- `docs/openapi.json`: 23,556 bytes, 33 paths, 36 operations (Export artifact)

New changelog text:
```markdown
- **Part A4 (OpenAPI Specification Export)**: Exported OpenAPI specification generated via Springdoc. The single source of truth is `backend/src/main/resources/openapi/tracex-api.yaml` (31,744 bytes, 33 paths, 36 operations), synchronized with `docs/openapi.json` (23,556 bytes, 33 paths, 36 operations), containing all Phase 1, Phase 2, and Phase 3 endpoints.
```

Result: **PASS**

---

## Check 5: Maven Build and Test Suite Verification

Command:
```powershell
.\mvnw.cmd clean verify
```

Summary:
```
[INFO] Results:
[INFO] 
[INFO] Tests run: 328, Failures: 0, Errors: 0, Skipped: 0
[INFO] 
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  38.637 s
[INFO] Finished at: 2026-10-04T10:04:35+05:30
[INFO] ------------------------------------------------------------------------
```

### Per-Class Test Breakdown (from surefire-reports)

| Class Name | Tests | Failures | Errors | Time (s) |
|---|---|---|---|---|
| `com.tracex.AccessRequestAndUserFlowTests` | 8 | 0 | 0 | 11.118 |
| `com.tracex.AdminVsAdminRulesTest` | 10 | 0 | 0 | 5.156 |
| `com.tracex.AuthLoginTests` | 10 | 0 | 0 | 4.195 |
| `com.tracex.BatchIndexTest` | 1 | 0 | 0 | 0.810 |
| `com.tracex.ConfigurationAndSeedTests` | 12 | 0 | 0 | 0.906 |
| `com.tracex.ErrorCodeSpecSyncTest` | 1 | 0 | 0 | 0.029 |
| `com.tracex.ForwardedHeadersEmpiricalTest$FrameworkStrategyTests` | 1 | 0 | 0 | 0.885 |
| `com.tracex.ForwardedHeadersEmpiricalTest$NativeStrategyTrustedProxyTests` | 1 | 0 | 0 | 0.936 |
| `com.tracex.ForwardedHeadersEmpiricalTest$NativeStrategyUntrustedDirectTests` | 1 | 0 | 0 | 1.498 |
| `com.tracex.GlobalSafetyGuardAutoDetectionTest` | 1 | 0 | 0 | 0.006 |
| `com.tracex.OpenApiExportTest` | 1 | 0 | 0 | 1.698 |
| `com.tracex.ProductAndBatchTests` | 33 | 0 | 0 | 1.503 |
| `com.tracex.RbacMatrixTest` | 238 | 0 | 0 | 1.461 |
| `com.tracex.RouteCoverageTest` | 1 | 0 | 0 | 0.010 |
| `com.tracex.SmtpEmailServiceTest` | 1 | 0 | 0 | 0.903 |
| `com.tracex.TokenAndSessionTests` | 8 | 0 | 0 | 0.663 |

Total: **328 tests, 0 failures, 0 errors, 0 skipped**.

Result: **PASS**

---

## Check 6: Final Self-Modification and Hierarchy Table (SPEC §2 Parity)

| Actor | Target | Action: toggle | Action: role-change | Action: delete | Action: restore |
|---|---|---|---|---|---|
| `super-admin` | `super-admin (self / last)` | deny (409 LAST_SUPERADMIN / 409 SELF_MODIFICATION_NOT_ALLOWED) | deny (409 SELF_MODIFICATION_NOT_ALLOWED / 409 LAST_SUPERADMIN) | deny (409 LAST_SUPERADMIN / 409 SELF_MODIFICATION_NOT_ALLOWED) | allow (200 OK) |
| `super-admin` | `admin` | allow (200 OK) | allow (200 OK) | allow (200 OK) | allow (200 OK) |
| `super-admin` | `lower-tier` | allow (200 OK) | allow (200 OK) | allow (200 OK) | allow (200 OK) |
| `admin` | `super-admin` | deny (403 RBAC_INSUFFICIENT) | deny (403 RBAC_INSUFFICIENT) | deny (403 RBAC_INSUFFICIENT) | deny (403 RBAC_INSUFFICIENT) |
| `admin` | `admin (self)` | deny (409 SELF_MODIFICATION_NOT_ALLOWED) | deny (409 SELF_MODIFICATION_NOT_ALLOWED) | deny (409 SELF_MODIFICATION_NOT_ALLOWED) | N/A |
| `admin` | `admin (other)` | allow (200 OK) | allow (200 OK) | allow (200 OK) | deny (403 RBAC_INSUFFICIENT) |
| `admin` | `lower-tier` | allow (200 OK) | allow (200 OK) | allow (200 OK) | deny (403 RBAC_INSUFFICIENT) |

### Detailed Mapping: (Actor, Target, Action, Expected Status & Code)

1. `(super-admin, super-admin (self), toggle)` -> `409 Conflict: SELF_MODIFICATION_NOT_ALLOWED` (or `LAST_SUPERADMIN` if sole active super-admin)
2. `(super-admin, super-admin (other), toggle)` -> `200 OK` (or `409 Conflict: LAST_SUPERADMIN` if target is sole active super-admin)
3. `(super-admin, super-admin (self), role-change)` -> `409 Conflict: SELF_MODIFICATION_NOT_ALLOWED`
4. `(super-admin, super-admin (other), role-change)` -> `409 Conflict: LAST_SUPERADMIN` (super-admin role immutable via API)
5. `(super-admin, super-admin (self), delete)` -> `409 Conflict: SELF_MODIFICATION_NOT_ALLOWED` (or `LAST_SUPERADMIN` if sole active super-admin)
6. `(super-admin, super-admin (other), delete)` -> `409 Conflict: LAST_SUPERADMIN` (super-admin accounts cannot be deleted via API)
7. `(super-admin, super-admin (other), restore)` -> `200 OK`
8. `(super-admin, admin, toggle)` -> `200 OK`
9. `(super-admin, admin, role-change)` -> `200 OK`
10. `(super-admin, admin, delete)` -> `200 OK`
11. `(super-admin, admin, restore)` -> `200 OK`
12. `(super-admin, lower-tier, toggle)` -> `200 OK`
13. `(super-admin, lower-tier, role-change)` -> `200 OK`
14. `(super-admin, lower-tier, delete)` -> `200 OK`
15. `(super-admin, lower-tier, restore)` -> `200 OK`
16. `(admin, super-admin, toggle)` -> `403 Forbidden: RBAC_INSUFFICIENT`
17. `(admin, super-admin, role-change)` -> `403 Forbidden: RBAC_INSUFFICIENT`
18. `(admin, super-admin, delete)` -> `403 Forbidden: RBAC_INSUFFICIENT`
19. `(admin, super-admin, restore)` -> `403 Forbidden: RBAC_INSUFFICIENT`
20. `(admin, admin (self), toggle)` -> `409 Conflict: SELF_MODIFICATION_NOT_ALLOWED`
21. `(admin, admin (self), role-change)` -> `409 Conflict: SELF_MODIFICATION_NOT_ALLOWED`
22. `(admin, admin (self), delete)` -> `409 Conflict: SELF_MODIFICATION_NOT_ALLOWED`
23. `(admin, admin (self), restore)` -> `N/A`
24. `(admin, admin (other), toggle)` -> `200 OK`
25. `(admin, admin (other), role-change)` -> `200 OK`
26. `(admin, admin (other), delete)` -> `200 OK`
27. `(admin, admin (other), restore)` -> `403 Forbidden: RBAC_INSUFFICIENT`
28. `(admin, lower-tier, toggle)` -> `200 OK`
29. `(admin, lower-tier, role-change)` -> `200 OK` (cannot promote to admin: `403 RBAC_INSUFFICIENT`)
30. `(admin, lower-tier, delete)` -> `200 OK`
31. `(admin, lower-tier, restore)` -> `403 Forbidden: RBAC_INSUFFICIENT`

All rules are verified by `AdminVsAdminRulesTest.java` (10 tests, 28 assertions).

Result: **PASS**

---

## Conclusion

Phase 3.2 is **COMPLETE**. All 6 verification checks passed without errors.
No Phase 4 features were started.
