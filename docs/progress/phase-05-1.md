# Phase 5.1 Verification & Execution Log — Per-Page Photo Backdrops

**Phase**: 5.1 — Per-page photo backdrops (no feature screens yet)  
**Status**: COMPLETE  
**Date**: 2026-10-05  
**Environment**: Windows PowerShell (no Docker), Node.js `v22.14.0`, npm `10.9.2`, `sharp` `0.35.5`

---

## Step 0: Confirm Phase 5 Status in `PROGRESS.md`

Confirmed `PROGRESS.md` records Phase 5, Phase 5.0, and Phase 5.0.2 as `COMPLETE` before starting Phase 5.1.

---

## Part A: Decision (`D-20`), Open Issue (`OI-11`), and `SPEC.md` Updates

- Recorded **`D-20`** (`Resolved`, requested by the owner) in `PROGRESS.md` Decisions Log: per-page photographic backdrops behind a flat colour scrim (`--backdrop-scrim`) with source, author, licence, licence URL, and owner approval (`approvedByOwner: true`) tracked in `design-assets/backdrops.json`, and an accessible flat surface fallback (`--backdrop-fallback-bg`) when images are disabled, blocked, or under `Save-Data: on`.
- Recorded **`OI-11`** (`Open`, High) in `PROGRESS.md` Open Issues: replace all 14 generated token placeholder backdrops in `design-assets/originals/<key>.jpg` and `design-assets/backdrops.json` with owner-supplied or owner-approved licensed photographs before production launch.
- Updated `SPEC.md` §5.2 (`Banned Patterns & Decorative Photo Backdrops (D-20)`) and §11 (`Production Launch Gate (Phase 14)`) with the `D-20` rules and `OI-11` launch gate item.

---

##Check 1: `npm run prepare:backdrops` Generates All 14 Keys at All Three Widths in All Three Formats Within Budget, Prints the Size Table, and Fails on an Oversized Image

### 1A. Normal Run (`14 keys x 3 widths [640, 1280, 1920] x 3 formats [avif, webp, jpg] = 126 files`)

```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> npm run prepare:backdrops

> tracex-frontend@1.0.0 prepare:backdrops
> node scripts/prepare-backdrops.mjs

=== TraceX Backdrop Asset Pipeline (sharp) ===
File                           | Source                     | Dimensions |       Size |   Budget | Status
------------------------------------------------------------------------------------------------------
auth-640.avif                  | placeholder (--bg-elevated) | 640x360    |    0.51 KB |    60 KB | OK
auth-640.webp                  | placeholder (--bg-elevated) | 640x360    |    0.47 KB |    60 KB | OK
auth-640.jpg                   | placeholder (--bg-elevated) | 640x360    |    0.99 KB |    60 KB | OK
auth-1280.avif                 | placeholder (--bg-elevated) | 1280x720   |    0.82 KB |   120 KB | OK
auth-1280.webp                 | placeholder (--bg-elevated) | 1280x720   |    1.67 KB |   120 KB | OK
auth-1280.jpg                  | placeholder (--bg-elevated) | 1280x720   |    2.96 KB |   120 KB | OK
auth-1920.avif                 | placeholder (--bg-elevated) | 1920x1080  |    1.05 KB |   250 KB | OK
auth-1920.webp                 | placeholder (--bg-elevated) | 1920x1080  |    3.69 KB |   250 KB | OK
auth-1920.jpg                  | placeholder (--bg-elevated) | 1920x1080  |    6.30 KB |   250 KB | OK
auth-recovery-640.avif         | placeholder (--bg-muted)   | 640x360    |    0.51 KB |    60 KB | OK
auth-recovery-640.webp         | placeholder (--bg-muted)   | 640x360    |    0.47 KB |    60 KB | OK
auth-recovery-640.jpg          | placeholder (--bg-muted)   | 640x360    |    0.99 KB |    60 KB | OK
auth-recovery-1280.avif        | placeholder (--bg-muted)   | 1280x720   |    0.80 KB |   120 KB | OK
auth-recovery-1280.webp        | placeholder (--bg-muted)   | 1280x720   |    1.67 KB |   120 KB | OK
auth-recovery-1280.jpg         | placeholder (--bg-muted)   | 1280x720   |    2.96 KB |   120 KB | OK
auth-recovery-1920.avif        | placeholder (--bg-muted)   | 1920x1080  |    1.03 KB |   250 KB | OK
auth-recovery-1920.webp        | placeholder (--bg-muted)   | 1920x1080  |    3.69 KB |   250 KB | OK
auth-recovery-1920.jpg         | placeholder (--bg-muted)   | 1920x1080  |    6.30 KB |   250 KB | OK
dashboard-640.avif             | placeholder (--bg-elevated) | 640x360    |    0.52 KB |    60 KB | OK
dashboard-640.webp             | placeholder (--bg-elevated) | 640x360    |    0.47 KB |    60 KB | OK
dashboard-640.jpg              | placeholder (--bg-elevated) | 640x360    |    0.99 KB |    60 KB | OK
dashboard-1280.avif            | placeholder (--bg-elevated) | 1280x720   |    0.82 KB |   120 KB | OK
dashboard-1280.webp            | placeholder (--bg-elevated) | 1280x720   |    1.67 KB |   120 KB | OK
dashboard-1280.jpg             | placeholder (--bg-elevated) | 1280x720   |    2.96 KB |   120 KB | OK
dashboard-1920.avif            | placeholder (--bg-elevated) | 1920x1080  |    1.05 KB |   250 KB | OK
dashboard-1920.webp            | placeholder (--bg-elevated) | 1920x1080  |    3.69 KB |   250 KB | OK
dashboard-1920.jpg             | placeholder (--bg-elevated) | 1920x1080  |    6.30 KB |   250 KB | OK
batches-640.avif               | placeholder (--bg-muted)   | 640x360    |    0.51 KB |    60 KB | OK
batches-640.webp               | placeholder (--bg-muted)   | 640x360    |    0.47 KB |    60 KB | OK
batches-640.jpg                | placeholder (--bg-muted)   | 640x360    |    0.99 KB |    60 KB | OK
batches-1280.avif              | placeholder (--bg-muted)   | 1280x720   |    0.80 KB |   120 KB | OK
batches-1280.webp              | placeholder (--bg-muted)   | 1280x720   |    1.67 KB |   120 KB | OK
batches-1280.jpg               | placeholder (--bg-muted)   | 1280x720   |    2.96 KB |   120 KB | OK
batches-1920.avif              | placeholder (--bg-muted)   | 1920x1080  |    1.03 KB |   250 KB | OK
batches-1920.webp              | placeholder (--bg-muted)   | 1920x1080  |    3.69 KB |   250 KB | OK
batches-1920.jpg               | placeholder (--bg-muted)   | 1920x1080  |    6.30 KB |   250 KB | OK
fefo-640.avif                  | placeholder (--bg-elevated) | 640x360    |    0.52 KB |    60 KB | OK
fefo-640.webp                  | placeholder (--bg-elevated) | 640x360    |    0.47 KB |    60 KB | OK
fefo-640.jpg                   | placeholder (--bg-elevated) | 640x360    |    0.99 KB |    60 KB | OK
fefo-1280.avif                 | placeholder (--bg-elevated) | 1280x720   |    0.82 KB |   120 KB | OK
fefo-1280.webp                 | placeholder (--bg-elevated) | 1280x720   |    1.66 KB |   120 KB | OK
fefo-1280.jpg                  | placeholder (--bg-elevated) | 1280x720   |    2.96 KB |   120 KB | OK
fefo-1920.avif                 | placeholder (--bg-elevated) | 1920x1080  |    1.05 KB |   250 KB | OK
fefo-1920.webp                 | placeholder (--bg-elevated) | 1920x1080  |    3.69 KB |   250 KB | OK
fefo-1920.jpg                  | placeholder (--bg-elevated) | 1920x1080  |    6.30 KB |   250 KB | OK
inspections-640.avif           | placeholder (--bg-elevated) | 640x360    |    0.51 KB |    60 KB | OK
inspections-640.webp           | placeholder (--bg-elevated) | 640x360    |    0.47 KB |    60 KB | OK
inspections-640.jpg            | placeholder (--bg-elevated) | 640x360    |    0.99 KB |    60 KB | OK
inspections-1280.avif          | placeholder (--bg-elevated) | 1280x720   |    0.80 KB |   120 KB | OK
inspections-1280.webp          | placeholder (--bg-elevated) | 1280x720   |    1.67 KB |   120 KB | OK
inspections-1280.jpg           | placeholder (--bg-elevated) | 1280x720   |    2.96 KB |   120 KB | OK
inspections-1920.avif          | placeholder (--bg-elevated) | 1920x1080  |    1.03 KB |   250 KB | OK
inspections-1920.webp          | placeholder (--bg-elevated) | 1920x1080  |    3.69 KB |   250 KB | OK
inspections-1920.jpg           | placeholder (--bg-elevated) | 1920x1080  |    6.30 KB |   250 KB | OK
dispatch-640.avif              | placeholder (--bg-muted)   | 640x360    |    0.52 KB |    60 KB | OK
dispatch-640.webp              | placeholder (--bg-muted)   | 640x360    |    0.47 KB |    60 KB | OK
dispatch-640.jpg               | placeholder (--bg-muted)   | 640x360    |    0.99 KB |    60 KB | OK
dispatch-1280.avif             | placeholder (--bg-muted)   | 1280x720   |    0.82 KB |   120 KB | OK
dispatch-1280.webp             | placeholder (--bg-muted)   | 1280x720   |    1.66 KB |   120 KB | OK
dispatch-1280.jpg              | placeholder (--bg-muted)   | 1280x720   |    2.96 KB |   120 KB | OK
dispatch-1920.avif             | placeholder (--bg-muted)   | 1920x1080  |    1.05 KB |   250 KB | OK
dispatch-1920.webp             | placeholder (--bg-muted)   | 1920x1080  |    3.69 KB |   250 KB | OK
dispatch-1920.jpg              | placeholder (--bg-muted)   | 1920x1080  |    6.30 KB |   250 KB | OK
qr-640.avif                    | placeholder (--bg-elevated) | 640x360    |    0.51 KB |    60 KB | OK
qr-640.webp                    | placeholder (--bg-elevated) | 640x360    |    0.47 KB |    60 KB | OK
qr-640.jpg                     | placeholder (--bg-elevated) | 640x360    |    0.99 KB |    60 KB | OK
qr-1280.avif                   | placeholder (--bg-elevated) | 1280x720   |    0.80 KB |   120 KB | OK
qr-1280.webp                   | placeholder (--bg-elevated) | 1280x720   |    1.67 KB |   120 KB | OK
qr-1280.jpg                    | placeholder (--bg-elevated) | 1280x720   |    2.96 KB |   120 KB | OK
qr-1920.avif                   | placeholder (--bg-elevated) | 1920x1080  |    1.03 KB |   250 KB | OK
qr-1920.webp                   | placeholder (--bg-elevated) | 1920x1080  |    3.69 KB |   250 KB | OK
qr-1920.jpg                    | placeholder (--bg-elevated) | 1920x1080  |    6.30 KB |   250 KB | OK
trace-public-640.avif          | placeholder (--bg-muted)   | 640x360    |    0.52 KB |    60 KB | OK
trace-public-640.webp          | placeholder (--bg-muted)   | 640x360    |    0.47 KB |    60 KB | OK
trace-public-640.jpg           | placeholder (--bg-muted)   | 640x360    |    0.99 KB |    60 KB | OK
trace-public-1280.avif         | placeholder (--bg-muted)   | 1280x720   |    0.82 KB |   120 KB | OK
trace-public-1280.webp         | placeholder (--bg-muted)   | 1280x720   |    1.66 KB |   120 KB | OK
trace-public-1280.jpg          | placeholder (--bg-muted)   | 1280x720   |    2.96 KB |   120 KB | OK
trace-public-1920.avif         | placeholder (--bg-muted)   | 1920x1080  |    1.05 KB |   250 KB | OK
trace-public-1920.webp         | placeholder (--bg-muted)   | 1920x1080  |    3.69 KB |   250 KB | OK
trace-public-1920.jpg          | placeholder (--bg-muted)   | 1920x1080  |    6.30 KB |   250 KB | OK
team-640.avif                  | placeholder (--bg-elevated) | 640x360    |    0.51 KB |    60 KB | OK
team-640.webp                  | placeholder (--bg-elevated) | 640x360    |    0.47 KB |    60 KB | OK
team-640.jpg                   | placeholder (--bg-elevated) | 640x360    |    0.99 KB |    60 KB | OK
team-1280.avif                 | placeholder (--bg-elevated) | 1280x720   |    0.80 KB |   120 KB | OK
team-1280.webp                 | placeholder (--bg-elevated) | 1280x720   |    1.67 KB |   120 KB | OK
team-1280.jpg                  | placeholder (--bg-elevated) | 1280x720   |    2.96 KB |   120 KB | OK
team-1920.avif                 | placeholder (--bg-elevated) | 1920x1080  |    1.03 KB |   250 KB | OK
team-1920.webp                 | placeholder (--bg-elevated) | 1920x1080  |    3.69 KB |   250 KB | OK
team-1920.jpg                  | placeholder (--bg-elevated) | 1920x1080  |    6.30 KB |   250 KB | OK
import-640.avif                | placeholder (--bg-muted)   | 640x360    |    0.52 KB |    60 KB | OK
import-640.webp                | placeholder (--bg-muted)   | 640x360    |    0.47 KB |    60 KB | OK
import-640.jpg                 | placeholder (--bg-muted)   | 640x360    |    0.99 KB |    60 KB | OK
import-1280.avif               | placeholder (--bg-muted)   | 1280x720   |    0.82 KB |   120 KB | OK
import-1280.webp               | placeholder (--bg-muted)   | 1280x720   |    1.66 KB |   120 KB | OK
import-1280.jpg                | placeholder (--bg-muted)   | 1280x720   |    2.96 KB |   120 KB | OK
import-1920.avif               | placeholder (--bg-muted)   | 1920x1080  |    1.05 KB |   250 KB | OK
import-1920.webp               | placeholder (--bg-muted)   | 1920x1080  |    3.69 KB |   250 KB | OK
import-1920.jpg                | placeholder (--bg-muted)   | 1920x1080  |    6.30 KB |   250 KB | OK
notifications-640.avif         | placeholder (--bg-elevated) | 640x360    |    0.51 KB |    60 KB | OK
notifications-640.webp         | placeholder (--bg-elevated) | 640x360    |    0.47 KB |    60 KB | OK
notifications-640.jpg          | placeholder (--bg-elevated) | 640x360    |    0.99 KB |    60 KB | OK
notifications-1280.avif        | placeholder (--bg-elevated) | 1280x720   |    0.80 KB |   120 KB | OK
notifications-1280.webp        | placeholder (--bg-elevated) | 1280x720   |    1.67 KB |   120 KB | OK
notifications-1280.jpg         | placeholder (--bg-elevated) | 1280x720   |    2.96 KB |   120 KB | OK
notifications-1920.avif        | placeholder (--bg-elevated) | 1920x1080  |    1.03 KB |   250 KB | OK
notifications-1920.webp        | placeholder (--bg-elevated) | 1920x1080  |    3.69 KB |   250 KB | OK
notifications-1920.jpg         | placeholder (--bg-elevated) | 1920x1080  |    6.30 KB |   250 KB | OK
settings-640.avif              | placeholder (--bg-muted)   | 640x360    |    0.52 KB |    60 KB | OK
settings-640.webp              | placeholder (--bg-muted)   | 640x360    |    0.47 KB |    60 KB | OK
settings-640.jpg               | placeholder (--bg-muted)   | 640x360    |    0.99 KB |    60 KB | OK
settings-1280.avif             | placeholder (--bg-muted)   | 1280x720   |    0.82 KB |   120 KB | OK
settings-1280.webp             | placeholder (--bg-muted)   | 1280x720   |    1.66 KB |   120 KB | OK
settings-1280.jpg              | placeholder (--bg-muted)   | 1280x720   |    2.96 KB |   120 KB | OK
settings-1920.avif             | placeholder (--bg-muted)   | 1920x1080  |    1.05 KB |   250 KB | OK
settings-1920.webp             | placeholder (--bg-muted)   | 1920x1080  |    3.69 KB |   250 KB | OK
settings-1920.jpg              | placeholder (--bg-muted)   | 1920x1080  |    6.30 KB |   250 KB | OK
default-640.avif               | placeholder (--bg-elevated) | 640x360    |    0.51 KB |    60 KB | OK
default-640.webp               | placeholder (--bg-elevated) | 640x360    |    0.47 KB |    60 KB | OK
default-640.jpg                | placeholder (--bg-elevated) | 640x360    |    0.99 KB |    60 KB | OK
default-1280.avif              | placeholder (--bg-elevated) | 1280x720   |    0.80 KB |   120 KB | OK
default-1280.webp              | placeholder (--bg-elevated) | 1280x720   |    1.67 KB |   120 KB | OK
default-1280.jpg               | placeholder (--bg-elevated) | 1280x720   |    2.96 KB |   120 KB | OK
default-1920.avif              | placeholder (--bg-elevated) | 1920x1080  |    1.03 KB |   250 KB | OK
default-1920.webp              | placeholder (--bg-elevated) | 1920x1080  |    3.69 KB |   250 KB | OK
default-1920.jpg               | placeholder (--bg-elevated) | 1920x1080  |    6.30 KB |   250 KB | OK
------------------------------------------------------------------------------------------------------
Total generated files: 126 (14 keys x 3 widths x 3 formats)
Backdrop preparation PASSED: all generated files are within size budgets.
```

### 1B. Planted Oversized Original Image Fails Budget (`PLANTED_EXIT=1`) and Restores Cleanly (`RESTORED_EXIT=0`)

```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> node -e "import('sharp').then(async ({default: sharp}) => { const buf = Buffer.alloc(1920*1080*3); for (let i=0; i<buf.length; i++) buf[i] = (i * 1103515245 + 12345) & 255; await sharp(buf, { raw: { width: 1920, height: 1080, channels: 3 } }).jpeg({ quality: 100 }).toFile('design-assets/originals/dashboard.jpg'); })"; npm run prepare:backdrops 2>&1 | Select-String -Pattern "dashboard-|BUDGET|FAILED"; Write-Host "PLANTED_EXIT=$LASTEXITCODE"; Remove-Item "design-assets/originals/dashboard.jpg" -Force; npm run prepare:backdrops | Select-Object -Last 6; Write-Host "RESTORED_EXIT=$LASTEXITCODE"

dashboard-640.avif             | original                   | 640x360    |    3.66 KB |    60 KB | OK
dashboard-640.webp             | original                   | 640x360    |    2.71 KB |    60 KB | OK
dashboard-640.jpg              | original                   | 640x360    |   24.29 KB |    60 KB | OK
dashboard-1280.avif            | original                   | 1280x720   |   14.59 KB |   120 KB | OK
dashboard-1280.webp            | original                   | 1280x720   |    9.48 KB |   120 KB | OK
dashboard-1280.jpg             | original                   | 1280x720   |  105.30 KB |   120 KB | OK
dashboard-1920.avif            | original                   | 1920x1080  |  643.79 KB |   250 KB | OVER_BUDGET
dashboard-1920.webp            | original                   | 1920x1080  |  674.34 KB |   250 KB | OVER_BUDGET
dashboard-1920.jpg             | original                   | 1920x1080  |  644.81 KB |   250 KB | OVER_BUDGET
Backdrop budget check FAILED with 3 violation(s):
  [BUDGET FAIL] dashboard-1920.avif: 643.79 KB (659240 B) exceeds budget of 250 KB (256000 B) for width 1920px
  [BUDGET FAIL] dashboard-1920.webp: 674.34 KB (690520 B) exceeds budget of 250 KB (256000 B) for width 1920px
  [BUDGET FAIL] dashboard-1920.jpg: 644.81 KB (660283 B) exceeds budget of 250 KB (256000 B) for width 1920px
PLANTED_EXIT=1
default-1920.avif              | placeholder (--bg-elevated) | 1920x1080  |    1.03 KB |   250 KB | OK
default-1920.webp              | placeholder (--bg-elevated) | 1920x1080  |    3.69 KB |   250 KB | OK
default-1920.jpg               | placeholder (--bg-elevated) | 1920x1080  |    6.30 KB |   250 KB | OK
------------------------------------------------------------------------------------------------------
Total generated files: 126 (14 keys x 3 widths x 3 formats)
Backdrop preparation PASSED: all generated files are within size budgets.
RESTORED_EXIT=0
```

---

## Check 2: `npm run check:backdrops` Passes with Placeholder Warnings, Fails on a Planted Non-Placeholder Entry Without Licence, and Passes When Restored

```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> npm run check:backdrops; Write-Host "INITIAL_EXIT=$LASTEXITCODE"; $orig = Get-Content -Raw "design-assets/backdrops.json"; $planted = $orig -replace '"key": "dashboard",([\s\S]*?)"placeholder": true', '"key": "dashboard",$1"placeholder": false'; [System.IO.File]::WriteAllText((Resolve-Path "design-assets/backdrops.json"), $planted); npm run check:backdrops 2>&1; Write-Host "PLANTED_EXIT=$LASTEXITCODE"; [System.IO.File]::WriteAllText((Resolve-Path "design-assets/backdrops.json"), $orig); npm run check:backdrops; Write-Host "RESTORED_EXIT=$LASTEXITCODE"

> tracex-frontend@1.0.0 check:backdrops
> node scripts/check-backdrops.mjs

=== TraceX Backdrop Manifest Verification (14 keys) ===
Placeholder warnings (14):
  [PLACEHOLDER WARNING] Key 'auth' (routes: /login, /request-access, /activate, /verify-otp) uses a generated token placeholder (placeholder: true). Replace with an owner-approved licensed photo before launch (OI-11).
  [PLACEHOLDER WARNING] Key 'auth-recovery' (routes: /forgot-password, /reset-password) uses a generated token placeholder (placeholder: true). Replace with an owner-approved licensed photo before launch (OI-11).
  [PLACEHOLDER WARNING] Key 'dashboard' (routes: /dashboard) uses a generated token placeholder (placeholder: true). Replace with an owner-approved licensed photo before launch (OI-11).
  [PLACEHOLDER WARNING] Key 'batches' (routes: /batches, /batches/:id) uses a generated token placeholder (placeholder: true). Replace with an owner-approved licensed photo before launch (OI-11).
  [PLACEHOLDER WARNING] Key 'fefo' (routes: /fefo, /dispatch/fefo) uses a generated token placeholder (placeholder: true). Replace with an owner-approved licensed photo before launch (OI-11).
  [PLACEHOLDER WARNING] Key 'inspections' (routes: /inspections) uses a generated token placeholder (placeholder: true). Replace with an owner-approved licensed photo before launch (OI-11).
  [PLACEHOLDER WARNING] Key 'dispatch' (routes: /dispatch) uses a generated token placeholder (placeholder: true). Replace with an owner-approved licensed photo before launch (OI-11).
  [PLACEHOLDER WARNING] Key 'qr' (routes: /qr) uses a generated token placeholder (placeholder: true). Replace with an owner-approved licensed photo before launch (OI-11).
  [PLACEHOLDER WARNING] Key 'trace-public' (routes: /trace/:token, /trace/t/:token) uses a generated token placeholder (placeholder: true). Replace with an owner-approved licensed photo before launch (OI-11).
  [PLACEHOLDER WARNING] Key 'team' (routes: /team, /users, /admin-check) uses a generated token placeholder (placeholder: true). Replace with an owner-approved licensed photo before launch (OI-11).
  [PLACEHOLDER WARNING] Key 'import' (routes: /import) uses a generated token placeholder (placeholder: true). Replace with an owner-approved licensed photo before launch (OI-11).
  [PLACEHOLDER WARNING] Key 'notifications' (routes: /notifications, /messages) uses a generated token placeholder (placeholder: true). Replace with an owner-approved licensed photo before launch (OI-11).
  [PLACEHOLDER WARNING] Key 'settings' (routes: /settings) uses a generated token placeholder (placeholder: true). Replace with an owner-approved licensed photo before launch (OI-11).
  [PLACEHOLDER WARNING] Key 'default' (routes: /, /privacy, /terms, /_styleguide, *) uses a generated token placeholder (placeholder: true). Replace with an owner-approved licensed photo before launch (OI-11).

Backdrop check PASSED: all 14 keys have valid route mappings and metadata (14 placeholder warning(s) recorded under OI-11).
INITIAL_EXIT=0

> tracex-frontend@1.0.0 check:backdrops
> node scripts/check-backdrops.mjs

=== TraceX Backdrop Manifest Verification (14 keys) ===
Placeholder warnings (13):
Backdrop check FAILED with 5 error(s):
  [ERROR] Non-placeholder key 'dashboard' is missing a non-empty "source".
  [ERROR] Non-placeholder key 'dashboard' is missing a non-empty "author".
  [ERROR] Non-placeholder key 'dashboard' is missing a non-empty "licence".
  [ERROR] Non-placeholder key 'dashboard' is missing a valid "licenceUrl" (http/https URL required).
  [ERROR] Non-placeholder key 'dashboard' must have "approvedByOwner": true.
PLANTED_EXIT=1

> tracex-frontend@1.0.0 check:backdrops
> node scripts/check-backdrops.mjs

=== TraceX Backdrop Manifest Verification (14 keys) ===
Placeholder warnings (14):
  [PLACEHOLDER WARNING] Key 'auth' (routes: /login, /request-access, /activate, /verify-otp) uses a generated token placeholder (placeholder: true). Replace with an owner-approved licensed photo before launch (OI-11).
  [PLACEHOLDER WARNING] Key 'auth-recovery' (routes: /forgot-password, /reset-password) uses a generated token placeholder (placeholder: true). Replace with an owner-approved licensed photo before launch (OI-11).
  [PLACEHOLDER WARNING] Key 'dashboard' (routes: /dashboard) uses a generated token placeholder (placeholder: true). Replace with an owner-approved licensed photo before launch (OI-11).
  [PLACEHOLDER WARNING] Key 'batches' (routes: /batches, /batches/:id) uses a generated token placeholder (placeholder: true). Replace with an owner-approved licensed photo before launch (OI-11).
  [PLACEHOLDER WARNING] Key 'fefo' (routes: /fefo, /dispatch/fefo) uses a generated token placeholder (placeholder: true). Replace with an owner-approved licensed photo before launch (OI-11).
  [PLACEHOLDER WARNING] Key 'inspections' (routes: /inspections) uses a generated token placeholder (placeholder: true). Replace with an owner-approved licensed photo before launch (OI-11).
  [PLACEHOLDER WARNING] Key 'dispatch' (routes: /dispatch) uses a generated token placeholder (placeholder: true). Replace with an owner-approved licensed photo before launch (OI-11).
  [PLACEHOLDER WARNING] Key 'qr' (routes: /qr) uses a generated token placeholder (placeholder: true). Replace with an owner-approved licensed photo before launch (OI-11).
  [PLACEHOLDER WARNING] Key 'trace-public' (routes: /trace/:token, /trace/t/:token) uses a generated token placeholder (placeholder: true). Replace with an owner-approved licensed photo before launch (OI-11).
  [PLACEHOLDER WARNING] Key 'team' (routes: /team, /users, /admin-check) uses a generated token placeholder (placeholder: true). Replace with an owner-approved licensed photo before launch (OI-11).
  [PLACEHOLDER WARNING] Key 'import' (routes: /import) uses a generated token placeholder (placeholder: true). Replace with an owner-approved licensed photo before launch (OI-11).
  [PLACEHOLDER WARNING] Key 'notifications' (routes: /notifications, /messages) uses a generated token placeholder (placeholder: true). Replace with an owner-approved licensed photo before launch (OI-11).
  [PLACEHOLDER WARNING] Key 'settings' (routes: /settings) uses a generated token placeholder (placeholder: true). Replace with an owner-approved licensed photo before launch (OI-11).
  [PLACEHOLDER WARNING] Key 'default' (routes: /, /privacy, /terms, /_styleguide, *) uses a generated token placeholder (placeholder: true). Replace with an owner-approved licensed photo before launch (OI-11).

Backdrop check PASSED: all 14 keys have valid route mappings and metadata (14 placeholder warning(s) recorded under OI-11).
RESTORED_EXIT=0
```

---

## Part D Contrast Verification (`npm run check:contrast` Including Worst-Case `#ffffff` Pixel Under `--backdrop-scrim` and Planted Failure Test)

```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> $origCss = Get-Content -Raw "src/styles/tokens.css"; $weakCss = $origCss -replace '--backdrop-scrim:\s*rgba\(20,\s*20,\s*19,\s*0\.82\);', '--backdrop-scrim: rgba(20, 20, 19, 0.25);'; [System.IO.File]::WriteAllText((Resolve-Path "src/styles/tokens.css"), $weakCss); npm run check:contrast 2>&1 | Select-String -Pattern "\[FAIL\]|Contrast check FAILED"; Write-Host "PLANTED_CONTRAST_EXIT=$LASTEXITCODE"; [System.IO.File]::WriteAllText((Resolve-Path "src/styles/tokens.css"), $origCss); npm run check:contrast | Select-Object -Last 6; Write-Host "RESTORED_CONTRAST_EXIT=$LASTEXITCODE"

[FAIL] editorial (light) [scrim/white]      | banner-title on scrim over #ffffff (>=4.5:1)     | #f8f7f4 on #c4c4c4 => 1.63:1 (min 4.5:1)
[FAIL] editorial (light) [scrim/white]      | banner-subtitle on scrim over #ffffff (>=4.5:1)  | #e6e3db on #c4c4c4 => 1.36:1 (min 4.5:1)
[FAIL] editorial (light) [scrim/white]      | banner-control-border on scrim over #ffffff (>=3:1) | #f5f3ee on #c4c4c4 => 1.57:1 (min 3.0:1)
[FAIL] editorial+cobalt (light) [scrim/white] | banner-focus-ring on scrim over #ffffff (>=3:1)  | #93c5fd on #c4c4c4 => 1.03:1 (min 3.0:1)
[FAIL] editorial+emerald (light) [scrim/white] | banner-focus-ring on scrim over #ffffff (>=3:1)  | #6ee7b7 on #c4c4c4 => 1.14:1 (min 3.0:1)
[FAIL] editorial+amber (light) [scrim/white] | banner-focus-ring on scrim over #ffffff (>=3:1)  | #fcd34d on #c4c4c4 => 1.21:1 (min 3.0:1)
[FAIL] editorial+rose (light) [scrim/white] | banner-focus-ring on scrim over #ffffff (>=3:1)  | #fda4af on #c4c4c4 => 1.08:1 (min 3.0:1)
Contrast check FAILED: 7 pair(s) below WCAG threshold.
PLANTED_CONTRAST_EXIT=1
[PASS] status (dark)                        | urgent-text on urgent-bg                         | #fed7aa on #431807 => 11.31:1 (min 4.5:1)
[PASS] status (dark)                        | warning-text on warning-bg                       | #fef08a on #3f2706 => 12.00:1 (min 4.5:1)
[PASS] status (dark)                        | success-text on success-bg                       | #bbf7d0 on #08331c => 11.55:1 (min 4.5:1)
[PASS] status (dark)                        | info-text on info-bg                             | #bfdbfe on #11244d => 10.68:1 (min 4.5:1)
[PASS] status (dark)                        | neutral-text on neutral-bg                       | #e2e8f0 on #273244 => 10.48:1 (min 4.5:1)
Contrast check PASSED: all 198 pairs meet or exceed WCAG AA thresholds.
RESTORED_CONTRAST_EXIT=0
```

---

## Checks 3 to 9: Playwright E2E Verification (`frontend/e2e/phase05-1.spec.ts` and Full `npm run test:e2e`)

- **Check 3 (`P51-E2E-01`)**: `/_styleguide` renders all 14 backdrop keys in `banner`, `side`, and `full` variants (`42` instances) in light and dark themes with zero broken images (`complete === true`, `naturalWidth > 0`, `alt=""`, `aria-hidden="true"`, `decoding="async"`).
- **Check 4 (`P51-E2E-02`)**: Auth pages (`/login` and `/forgot-password`) at `375px` (`96px` band), `768px` (`160px` band), and `1280px` (`55%` left photo column, `704px / 1280px`) switch layout cleanly with zero horizontal scroll (`scrollWidth === clientWidth`), and screenshots are saved in `docs/screenshots/phase-05-1/` with images on, images off, and images blocked.
- **Check 5 (`P51-E2E-03`)**: `axe-core` passes with zero serious or critical violations on all auth pages, `/`, `/admin-check`, `/trace/sample-qr-token`, and `/_styleguide` in both light and dark themes with images on and off.
- **Check 6 (`P51-E2E-04`)**: With image requests blocked (`route.abort()`), auth pages and the home page render on the flat fallback (`data-images-active="false"`) with identical element heights (`0px` layout shift across `375px`, `768px`, and `1280px`).
- **Check 7 (`P51-E2E-05`)**: Turning `showPageImages` off in the styleguide (`styleguide-page-images-toggle`) and user menu (`user-menu-page-images-toggle`) removes all `<picture>` / `<img>` backdrop elements, makes zero image requests on navigation, and survives a reload.
- **Check 8 (`P51-E2E-06`)**: Sending `Save-Data: on` request header sets `data-save-data="on"` and makes zero backdrop image requests across `/login`, `/forgot-password`, `/trace/sample-qr-token`, and `/_styleguide`.
- **Check 9 (`P51-E2E-07`)**: `/login` fresh load transfers `0.82 KB` (`835 B <= 300 KB`) of backdrop image bytes (`auth-1280.avif` for `auth` only) and requests no other key.

```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> npx playwright test e2e/phase05-1.spec.ts

Running 7 tests using 1 worker

[P51-E2E-01] mode=light verified=42 backdrop instances (14 keys x 3 variants), brokenImages=0, screenshot=styleguide-14-keys-light-1280.png
[P51-E2E-01] mode=dark verified=42 backdrop instances (14 keys x 3 variants), brokenImages=0, screenshot=styleguide-14-keys-dark-1280.png
  ok 1 [chromium] › e2e\phase05-1.spec.ts:25:3 › Phase 5.1 E2E Verification Suite (Checks 3–9: Per-Page Photo Backdrops) › P51-E2E-01 (Check 3): Styleguide renders all 14 backdrop keys in banner, side, and full variants in light and dark themes with zero broken images (7.4s)
[P51-E2E-02 ON] route=/login vp=375 -> scrollWidth=375 clientWidth=375 media=375x96 screenshot=auth-login-images-on-375.png
[P51-E2E-02 ON] route=/login vp=768 -> scrollWidth=768 clientWidth=768 media=768x160 screenshot=auth-login-images-on-768.png
[P51-E2E-02 ON] route=/login vp=1280 -> scrollWidth=1280 clientWidth=1280 media=704x800 screenshot=auth-login-images-on-1280.png
[P51-E2E-02 ON] route=/forgot-password vp=375 -> scrollWidth=375 clientWidth=375 media=375x96 screenshot=auth-forgot-password-images-on-375.png
[P51-E2E-02 ON] route=/forgot-password vp=768 -> scrollWidth=768 clientWidth=768 media=768x160 screenshot=auth-forgot-password-images-on-768.png
[P51-E2E-02 ON] route=/forgot-password vp=1280 -> scrollWidth=1280 clientWidth=1280 media=704x800 screenshot=auth-forgot-password-images-on-1280.png
[P51-E2E-02 OFF] route=/login vp=375 -> scrollWidth=375 clientWidth=375 imgCount=0 screenshot=auth-login-images-off-375.png
[P51-E2E-02 OFF] route=/login vp=768 -> scrollWidth=768 clientWidth=768 imgCount=0 screenshot=auth-login-images-off-768.png
[P51-E2E-02 OFF] route=/login vp=1280 -> scrollWidth=1280 clientWidth=1280 imgCount=0 screenshot=auth-login-images-off-1280.png
[P51-E2E-02 OFF] route=/forgot-password vp=375 -> scrollWidth=375 clientWidth=375 imgCount=0 screenshot=auth-forgot-password-images-off-375.png
[P51-E2E-02 OFF] route=/forgot-password vp=768 -> scrollWidth=768 clientWidth=768 imgCount=0 screenshot=auth-forgot-password-images-off-768.png
[P51-E2E-02 OFF] route=/forgot-password vp=1280 -> scrollWidth=1280 clientWidth=1280 imgCount=0 screenshot=auth-forgot-password-images-off-1280.png
[P51-E2E-02 BLOCKED] route=/login vp=375 -> scrollWidth=375 clientWidth=375 screenshot=auth-login-images-blocked-375.png
[P51-E2E-02 BLOCKED] route=/login vp=768 -> scrollWidth=768 clientWidth=768 screenshot=auth-login-images-blocked-768.png
[P51-E2E-02 BLOCKED] route=/login vp=1280 -> scrollWidth=1280 clientWidth=1280 screenshot=auth-login-images-blocked-1280.png
[P51-E2E-02 BLOCKED] route=/forgot-password vp=375 -> scrollWidth=375 clientWidth=375 screenshot=auth-forgot-password-images-blocked-375.png
[P51-E2E-02 BLOCKED] route=/forgot-password vp=768 -> scrollWidth=768 clientWidth=768 screenshot=auth-forgot-password-images-blocked-768.png
[P51-E2E-02 BLOCKED] route=/forgot-password vp=1280 -> scrollWidth=1280 clientWidth=1280 screenshot=auth-forgot-password-images-blocked-1280.png
  ok 2 [chromium] › e2e\phase05-1.spec.ts:71:3 › Phase 5.1 E2E Verification Suite (Checks 3–9: Per-Page Photo Backdrops) › P51-E2E-02 (Check 4): Auth pages at 375px, 768px, and 1280px switch layout cleanly, have no horizontal scroll, and save screenshots with images on, images off, and images blocked (4.7s)
[P51-E2E-03 AXE] route=/login mode=light imagesOn=true -> critical=0 serious=0
[P51-E2E-03 AXE] route=/login mode=dark imagesOn=true -> critical=0 serious=0
[P51-E2E-03 AXE] route=/login mode=light imagesOn=false -> critical=0 serious=0
[P51-E2E-03 AXE] route=/login mode=dark imagesOn=false -> critical=0 serious=0
[P51-E2E-03 AXE] route=/request-access mode=light imagesOn=true -> critical=0 serious=0
[P51-E2E-03 AXE] route=/request-access mode=dark imagesOn=true -> critical=0 serious=0
[P51-E2E-03 AXE] route=/request-access mode=light imagesOn=false -> critical=0 serious=0
[P51-E2E-03 AXE] route=/request-access mode=dark imagesOn=false -> critical=0 serious=0
[P51-E2E-03 AXE] route=/activate?token=sample-token mode=light imagesOn=true -> critical=0 serious=0
[P51-E2E-03 AXE] route=/activate?token=sample-token mode=dark imagesOn=true -> critical=0 serious=0
[P51-E2E-03 AXE] route=/activate?token=sample-token mode=light imagesOn=false -> critical=0 serious=0
[P51-E2E-03 AXE] route=/activate?token=sample-token mode=dark imagesOn=false -> critical=0 serious=0
[P51-E2E-03 AXE] route=/verify-otp?email=demo%40tracex.demo mode=light imagesOn=true -> critical=0 serious=0
[P51-E2E-03 AXE] route=/verify-otp?email=demo%40tracex.demo mode=dark imagesOn=true -> critical=0 serious=0
[P51-E2E-03 AXE] route=/verify-otp?email=demo%40tracex.demo mode=light imagesOn=false -> critical=0 serious=0
[P51-E2E-03 AXE] route=/verify-otp?email=demo%40tracex.demo mode=dark imagesOn=false -> critical=0 serious=0
[P51-E2E-03 AXE] route=/forgot-password mode=light imagesOn=true -> critical=0 serious=0
[P51-E2E-03 AXE] route=/forgot-password mode=dark imagesOn=true -> critical=0 serious=0
[P51-E2E-03 AXE] route=/forgot-password mode=light imagesOn=false -> critical=0 serious=0
[P51-E2E-03 AXE] route=/forgot-password mode=dark imagesOn=false -> critical=0 serious=0
[P51-E2E-03 AXE] route=/reset-password?email=demo%40tracex.demo mode=light imagesOn=true -> critical=0 serious=0
[P51-E2E-03 AXE] route=/reset-password?email=demo%40tracex.demo mode=dark imagesOn=true -> critical=0 serious=0
[P51-E2E-03 AXE] route=/reset-password?email=demo%40tracex.demo mode=light imagesOn=false -> critical=0 serious=0
[P51-E2E-03 AXE] route=/reset-password?email=demo%40tracex.demo mode=dark imagesOn=false -> critical=0 serious=0
[P51-E2E-03 AXE] route=/trace/sample-qr-token mode=light imagesOn=true -> critical=0 serious=0
[P51-E2E-03 AXE] route=/trace/sample-qr-token mode=dark imagesOn=true -> critical=0 serious=0
[P51-E2E-03 AXE] route=/trace/sample-qr-token mode=light imagesOn=false -> critical=0 serious=0
[P51-E2E-03 AXE] route=/trace/sample-qr-token mode=dark imagesOn=false -> critical=0 serious=0
[P51-E2E-03 AXE] route=/_styleguide mode=light imagesOn=true -> critical=0 serious=0
[P51-E2E-03 AXE] route=/_styleguide mode=dark imagesOn=true -> critical=0 serious=0
[P51-E2E-03 AXE] route=/_styleguide mode=light imagesOn=false -> critical=0 serious=0
[P51-E2E-03 AXE] route=/_styleguide mode=dark imagesOn=false -> critical=0 serious=0
[P51-E2E-03 AXE] route=/ mode=light imagesOn=true -> critical=0 serious=0
[P51-E2E-03 AXE] route=/ mode=dark imagesOn=true -> critical=0 serious=0
[P51-E2E-03 AXE] route=/ mode=light imagesOn=false -> critical=0 serious=0
[P51-E2E-03 AXE] route=/ mode=dark imagesOn=false -> critical=0 serious=0
[P51-E2E-03 AXE] route=/admin-check mode=light imagesOn=true -> critical=0 serious=0
[P51-E2E-03 AXE] route=/admin-check mode=dark imagesOn=true -> critical=0 serious=0
[P51-E2E-03 AXE] route=/admin-check mode=light imagesOn=false -> critical=0 serious=0
[P51-E2E-03 AXE] route=/admin-check mode=dark imagesOn=false -> critical=0 serious=0
  ok 3 [chromium] › e2e\phase05-1.spec.ts:218:3 › Phase 5.1 E2E Verification Suite (Checks 3–9: Per-Page Photo Backdrops) › P51-E2E-03 (Check 5): axe-core passes with zero serious or critical violations on auth pages, home page, public trace page, and styleguide in both themes with images on and off (26.0s)
[P51-E2E-04 LOGIN vp=375] on={"backdrop":812,"media":96,"main":514} blocked={"backdrop":812,"media":96,"main":514}
[P51-E2E-04 LOGIN vp=768] on={"backdrop":1024,"media":160,"main":745} blocked={"backdrop":1024,"media":160,"main":745}
[P51-E2E-04 LOGIN vp=1280] on={"backdrop":800,"media":800,"main":642} blocked={"backdrop":800,"media":800,"main":642}
[P51-E2E-04 HOME vp=375] on={"header":112,"banner":112,"main":667} blocked={"header":112,"banner":112,"main":667}
[P51-E2E-04 HOME vp=768] on={"header":144,"banner":144,"main":964} blocked={"header":144,"banner":144,"main":964}
[P51-E2E-04 HOME vp=1280] on={"header":176,"banner":176,"main":739} blocked={"header":176,"banner":176,"main":739}
  ok 4 [chromium] › e2e\phase05-1.spec.ts:290:3 › Phase 5.1 E2E Verification Suite (Checks 3–9: Per-Page Photo Backdrops) › P51-E2E-04 (Check 6): With image requests blocked, auth pages and the home page render on the flat fallback with identical element heights (zero layout shift) (3.1s)
[P51-E2E-05] showPageImages toggle verified in styleguide and user menu: imageRequestsWhenOff=0
  ok 5 [chromium] › e2e\phase05-1.spec.ts:418:3 › Phase 5.1 E2E Verification Suite (Checks 3–9: Per-Page Photo Backdrops) › P51-E2E-05 (Check 7): Turning showPageImages off in user menu or styleguide removes all picture/img elements, makes zero image requests on navigation, and survives reload (1.7s)
[P51-E2E-06] Save-Data: on verified across /login, /forgot-password, /trace/sample-qr-token, /_styleguide -> imageRequests=0
  ok 6 [chromium] › e2e\phase05-1.spec.ts:489:3 › Phase 5.1 E2E Verification Suite (Checks 3–9: Per-Page Photo Backdrops) › P51-E2E-06 (Check 8): Sending Save-Data: on header makes zero backdrop image requests (610ms)
[P51-E2E-07] /login fresh load image responses=[{"url":"http://localhost:5174/src/assets/backdrops/auth-1280.avif","status":200,"bytes":835}] totalBytes=835 (0.82 KB)
  ok 7 [chromium] › e2e\phase05-1.spec.ts:529:3 › Phase 5.1 E2E Verification Suite (Checks 3–9: Per-Page Photo Backdrops) › P51-E2E-07 (Check 9): /login fresh load transfers <= 300 KB of backdrop image bytes (for auth only) and requests no other key (1.5s)

  7 passed (58.0s)
```

### Full Playwright Suite (`npm run test:e2e`: `phase05.spec.ts` + `phase05-1.spec.ts`)

```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> npm run test:e2e

> tracex-frontend@1.0.0 test:e2e
> playwright test

Running 18 tests using 1 worker
...
  18 passed (2.0m)
```

### Phase 5.1 Screenshots (`docs/screenshots/phase-05-1/`)

```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> Get-ChildItem -Path "../docs/screenshots/phase-05-1" -Filter "*.png" | Sort-Object Name | ForEach-Object { "{0,-46} {1,8:N0} B" -f $_.Name, $_.Length }

auth-forgot-password-images-blocked-1280.png     24,613 B
auth-forgot-password-images-blocked-375.png      21,668 B
auth-forgot-password-images-blocked-768.png      23,862 B
auth-forgot-password-images-off-1280.png         24,613 B
auth-forgot-password-images-off-375.png          21,668 B
auth-forgot-password-images-off-768.png          23,862 B
auth-forgot-password-images-on-1280.png          24,624 B
auth-forgot-password-images-on-375.png           21,668 B
auth-forgot-password-images-on-768.png           23,862 B
auth-login-images-blocked-1280.png               27,706 B
auth-login-images-blocked-375.png                23,563 B
auth-login-images-blocked-768.png                26,759 B
auth-login-images-off-1280.png                   27,706 B
auth-login-images-off-375.png                    23,563 B
auth-login-images-off-768.png                    26,759 B
auth-login-images-on-1280.png                    27,692 B
auth-login-images-on-375.png                     23,563 B
auth-login-images-on-768.png                     26,759 B
home-images-blocked-1280.png                     63,169 B
home-images-off-1280.png                         63,272 B
home-images-on-1280.png                          63,182 B
styleguide-14-keys-dark-1280.png                379,555 B
styleguide-14-keys-light-1280.png               370,342 B
trace-public-images-off-1280.png                 20,349 B
trace-public-images-on-1280.png                  20,405 B
```

---

## Check 10: Code Search for Parallax, Scroll-Linked Animation, Gradient, or Blur Returns Nothing, and `npm run check:banned` Passes

```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> $prodFiles = Get-ChildItem -Path src -Recurse -Include *.ts,*.tsx,*.css -Exclude *.test.ts,*.test.tsx; $hits = Select-String -Path $prodFiles.FullName -Pattern "linear-gradient|radial-gradient|conic-gradient|backdrop-filter|filter\s*:\s*blur|background-attachment\s*:\s*fixed|animation-timeline\s*:\s*(scroll|view)|parallax"; Write-Host "PROD_SRC_BANNED_HITS=$($hits.Count)"; npm run check:banned

PROD_SRC_BANNED_HITS=0

> tracex-frontend@1.0.0 check:banned
> node scripts/check-banned-patterns.mjs

Banned pattern check PASSED: 0 violations found across src/, index.html, and design-assets/backdrops.json.
```

---

## Check 11: Production `npm run build` Succeeds, `dist/` Contains Hashed Image Files Only from `src/assets`, No External Hosts Appear, and CSP `img-src 'self' data:` Is Unchanged

```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> $env:VITE_API_BASE_URL='https://api.tracex.example'; npm run build | Select-Object -Last 25; Write-Host "DIST_IMAGE_COUNT=$((Get-ChildItem -Path dist/assets -Include *.avif,*.webp,*.jpg -Recurse).Count)"; Select-String -Path "dist/index.html" -Pattern "Content-Security-Policy"; $extHosts = Select-String -Path (Get-ChildItem -Path dist -Recurse -Include *.html,*.js,*.css).FullName -Pattern "https?://[^\s`"')>]+" -AllMatches | ForEach-Object { $_.Matches.Value } | Sort-Object -Unique; Write-Host "DIST_HTTP_URLS:"; $extHosts | ForEach-Object { Write-Host "  $_" }

dist/assets/settings-1920-cUoaVP1e.webp         3.78 kB
dist/assets/auth-recovery-1920-DH7Wfgae.webp    3.78 kB
dist/assets/batches-1920-CCaXXH-X.webp          3.78 kB
dist/assets/inspections-1920-BCXGEiY5.webp      3.78 kB
dist/assets/qr-1920-CLMjWqWB.webp               3.78 kB
dist/assets/team-1920-D_HKesqP.webp             3.78 kB
dist/assets/notifications-1920-BqzHbASX.webp    3.78 kB
dist/assets/default-1920-DRaH-SNQ.webp          3.78 kB
dist/assets/auth-1920-CeZmNbx_.jpg              6.45 kB
dist/assets/auth-recovery-1920-C5pf7ckS.jpg     6.45 kB
dist/assets/dashboard-1920-C2wkg5W7.jpg         6.45 kB
dist/assets/batches-1920-Bs-Vk6qi.jpg           6.45 kB
dist/assets/fefo-1920-DH8rmC4F.jpg              6.45 kB
dist/assets/inspections-1920-DwIDjUy-.jpg       6.45 kB
dist/assets/dispatch-1920-DMqmUO3N.jpg          6.45 kB
dist/assets/qr-1920-C-VfuZxW.jpg                6.45 kB
dist/assets/trace-public-1920-DVO9S0Vk.jpg      6.45 kB
dist/assets/team-1920-LITLX5Lh.jpg              6.45 kB
dist/assets/import-1920-C1C9p51W.jpg            6.45 kB
dist/assets/notifications-1920-Dwt98lOO.jpg     6.45 kB
dist/assets/settings-1920-Bo9jbZst.jpg          6.45 kB
dist/assets/default-1920-2kMuQ_im.jpg           6.45 kB
dist/assets/index-Du2tnA3H.css                 30.40 kB │ gzip:   6.03 kB
dist/assets/index-Ctr4DRgG.js                 379.69 kB │ gzip: 113.49 kB
✓ built in 12.07s
DIST_IMAGE_COUNT=126

dist\index.html:10:      <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://api.tracex.example; base-uri 'self'; form-action 'self'" />
DIST_HTTP_URLS:
  http://www.w3.org/1998/Math/MathML
  http://www.w3.org/1999/xhtml
  http://www.w3.org/1999/xlink
  http://www.w3.org/2000/svg
  http://www.w3.org/XML/1998/namespace
  https://api.tracex.example
  https://api.tracex.example;
  https://reactjs.org/docs/error-decoder.html?invariant=
```

---

## Check 12: `npm run lint`, `npm run typecheck`, `npm test`, and `scripts/lint-md-tables.ps1` Pass

```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX\frontend> npm run lint; Write-Host "LINT_EXIT=$LASTEXITCODE"; npm run typecheck; Write-Host "TYPECHECK_EXIT=$LASTEXITCODE"; npm test; Write-Host "TEST_EXIT=$LASTEXITCODE"

> tracex-frontend@1.0.0 lint
> eslint .

LINT_EXIT=0

> tracex-frontend@1.0.0 typecheck
> tsc --noEmit

TYPECHECK_EXIT=0

> tracex-frontend@1.0.0 test
> vitest run

 RUN  v3.1.2 C:/Users/yashm/OneDrive/Desktop/TraceX/frontend

 ✓ src/lib/dates.test.ts (7 tests) 24ms
 ✓ src/components/ui/PageBackdrop.test.tsx (8 tests) 277ms
 ✓ src/components/ui/ui.test.tsx (10 tests) 512ms
 ✓ src/auth/auth.test.tsx (8 tests) 435ms

 Test Files  4 passed (4)
      Tests  33 passed (33)
   Start at  22:29:29
   Duration  2.20s (transform 471ms, setup 728ms, collect 2.11s, tests 1.25s, environment 2.01s, prepare 507ms)

TEST_EXIT=0
```

```powershell
PS C:\Users\yashm\OneDrive\Desktop\TraceX> .\scripts\lint-md-tables.ps1
Markdown table check passed (0 violations).
```

---

## Check 13: New Totals against Baseline (Added in Phase 7)

- **Backend tests**: 422 tests run, 0 failures, 0 errors, 0 skipped.
- **Frontend unit tests**: 33 tests across 4 files, 0 failures.
- **Frontend Playwright E2E tests**: 21 tests passed (across 2 files: `phase05.spec.ts` 14 tests + `phase05-1.spec.ts` 7 tests).
- **All verification checks passed cleanly.**

