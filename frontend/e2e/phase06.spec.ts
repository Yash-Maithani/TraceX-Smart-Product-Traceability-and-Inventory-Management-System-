import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { startE2eBackend, stopE2eBackend } from './backendServer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const SCREENSHOT_DIR = path.resolve(__dirname, '../../docs/screenshots/phase-06');
const CLEAN_SCRIPT = path.resolve(__dirname, '../../scripts/clean-e2e-phase06.ps1');
const E2E_API_BASE = 'http://localhost:8083';
const SEED_PASSWORD = process.env.E2E_SEED_PASSWORD ?? 'E2ePass123456!';

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

function cleanPhase06E2eData(): void {
  execSync(
    `powershell -NoProfile -ExecutionPolicy Bypass -File "${CLEAN_SCRIPT}" -DatabaseName "tracex_fresh_e2e"`,
    { cwd: ROOT_DIR, stdio: 'pipe' }
  );
}

function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map((n) => Number.parseInt(n, 10));
  const dt = new Date(Date.UTC(y!, m! - 1, d! + days));
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function apiLogin(username: string, password = SEED_PASSWORD): Promise<string> {
  const res = await fetch(`${E2E_API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const body = (await res.json()) as { data?: { token?: string } };
  if (!res.ok || !body.data?.token) {
    throw new Error(`API login failed for ${username}: status ${res.status}`);
  }
  return body.data.token;
}

async function getServerBusinessDate(token: string): Promise<string> {
  const res = await fetch(`${E2E_API_BASE}/api/v1/dashboard/summary`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const body = (await res.json()) as { data?: { businessDate?: string } };
  return body.data?.businessDate ?? '2026-10-06';
}

async function getProductsBySku(
  token: string
): Promise<Record<string, { id: string; sku: string; productName: string }>> {
  const res = await fetch(`${E2E_API_BASE}/api/v1/products`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const body = (await res.json()) as {
    data?: Array<{ id: string; sku: string; productName: string }>;
  };
  const map: Record<string, { id: string; sku: string; productName: string }> = {};
  for (const p of body.data ?? []) {
    map[p.sku] = p;
  }
  return map;
}

async function apiCreateBatch(
  token: string,
  payload: {
    productId: string;
    packDate: string;
    expiryDate: string;
    sourceLotCode: string;
    farmerName?: string;
    village?: string;
    quantityProduced?: number;
    unit?: string;
    yieldPercent?: number;
  }
): Promise<{ id: string; batchCode: string; sku: string; expiryDate: string }> {
  const res = await fetch(`${E2E_API_BASE}/api/v1/batches`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      productId: payload.productId,
      packDate: payload.packDate,
      expiryDate: payload.expiryDate,
      quantityProduced: payload.quantityProduced ?? 120,
      unit: payload.unit ?? 'Kg',
      yieldPercent: payload.yieldPercent ?? 85,
      sourceLotCode: payload.sourceLotCode,
      farmerName: payload.farmerName ?? 'E2E Farmer',
      village: payload.village ?? 'E2E Village'
    })
  });
  const body = (await res.json()) as {
    data?: { id: string; batchCode: string; sku: string; expiryDate: string };
  };
  if (!res.ok || !body.data) {
    throw new Error(`Failed to create batch ${payload.sourceLotCode}: ${res.status}`);
  }
  return body.data;
}

async function uiSignIn(page: Page, username: string, password = SEED_PASSWORD): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/');
}

test.describe('Phase 6 E2E Verification Suite (Core Feature UI & Checks 6, 8, 9)', () => {
  test.beforeAll(async () => {
    cleanPhase06E2eData();
    await startE2eBackend();
  });

  test.afterAll(async () => {
    cleanPhase06E2eData();
    await stopE2eBackend();
  });

  test('P6-E2E-01: Dashboard metrics match server summary and clicking a tier card filters the batch list', async ({
    page
  }) => {
    const token = await apiLogin('manager');
    const summaryRes = await fetch(`${E2E_API_BASE}/api/v1/dashboard/summary`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(summaryRes.ok).toBe(true);
    const summaryBody = (await summaryRes.json()) as {
      data: {
        expired: number;
        urgent: number;
        warning: number;
        ready: number;
        exception: number;
        dispatched: number;
        pendingAccessRequests: number | null;
        inspectionVerdicts: {
          PASSED: number;
          FLAGGED: number;
          FAILED: number;
          none: number;
        };
      };
    };
    const serverSummary = summaryBody.data;

    await uiSignIn(page, 'manager');
    await expect(page.getByTestId('dashboard-summary-ready')).toBeVisible();

    await expect(page.getByTestId('dashboard-count-EXPIRED')).toHaveText(
      String(serverSummary.expired)
    );
    await expect(page.getByTestId('dashboard-count-URGENT')).toHaveText(
      String(serverSummary.urgent)
    );
    await expect(page.getByTestId('dashboard-count-WARNING')).toHaveText(
      String(serverSummary.warning)
    );
    await expect(page.getByTestId('dashboard-count-READY')).toHaveText(
      String(serverSummary.ready)
    );
    await expect(page.getByTestId('dashboard-count-EXCEPTION')).toHaveText(
      String(serverSummary.exception)
    );
    await expect(page.getByTestId('dashboard-count-DISPATCHED')).toHaveText(
      String(serverSummary.dispatched)
    );

    await expect(page.getByTestId('verdict-count-PASSED')).toHaveText(
      String(serverSummary.inspectionVerdicts.PASSED)
    );
    await expect(page.getByTestId('verdict-count-FLAGGED')).toHaveText(
      String(serverSummary.inspectionVerdicts.FLAGGED)
    );
    await expect(page.getByTestId('verdict-count-FAILED')).toHaveText(
      String(serverSummary.inspectionVerdicts.FAILED)
    );
    await expect(page.getByTestId('verdict-count-none')).toHaveText(
      String(serverSummary.inspectionVerdicts.none)
    );

    await expect(page.getByTestId('dashboard-pending-requests')).toBeVisible();
    await expect(page.getByTestId('pending-requests-count')).toHaveText(
      String(serverSummary.pendingAccessRequests)
    );

    // Click URGENT metric card -> navigates to /batches?status=URGENT
    await page.getByTestId('dashboard-metric-URGENT').click();
    await expect(page).toHaveURL(/\/batches\?status=URGENT/);
    await expect(page.getByTestId('batches-filter-status')).toHaveValue('URGENT');
    await expect(page.getByTestId('batches-desktop-table')).toBeVisible();
  });

  test('P6-E2E-02: Create a batch as factory-manager, see generated batchCode, add a note, and edit raw material', async ({
    page
  }) => {
    const token = await apiLogin('factory_mgr');
    const businessDate = await getServerBusinessDate(token);

    await uiSignIn(page, 'factory_mgr');
    // Factory manager must not see pendingAccessRequests
    await expect(page.getByTestId('dashboard-summary-ready')).toBeVisible();
    await expect(page.getByTestId('dashboard-pending-requests')).toHaveCount(0);

    await page.goto('/batches');
    await page.getByTestId('open-create-batch-btn').click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByTestId('create-batch-pack-date').fill(addDaysIso(businessDate, -5));
    await page.getByTestId('create-batch-expiry-date').fill(addDaysIso(businessDate, 45));
    await page.getByTestId('create-batch-quantity').fill('180');
    await page.getByTestId('create-batch-yield').fill('88.5');
    await page.getByTestId('create-batch-lot-code').fill('E2E-P6-CREATE-01');
    await page.getByTestId('create-batch-farmer-name').fill('Kundan Bisht');
    await page.getByTestId('create-batch-village').fill('Almora');
    await page.getByTestId('create-batch-note').fill('Initial E2E harvest note');

    await page.getByTestId('create-batch-submit-btn').click();
    await expect(page.getByTestId('created-batch-banner')).toBeVisible();
    const allocatedCode =
      (await page.getByTestId('created-batch-code').textContent())?.trim() ?? '';
    expect(allocatedCode).toMatch(/^TX-\d{4}-\d{2}-\d{3,4}$/);

    // Navigate to the new batch detail page
    await page.getByTestId('view-created-batch-btn').click();
    await expect(page).toHaveURL(/\/batches\/[a-f0-9]+$/i);
    await expect(page.getByTestId('detail-batch-code')).toHaveText(allocatedCode);
    await expect(page.getByTestId('detail-farmer-village')).toHaveText('Kundan Bisht — Almora');

    // Add / update traceability note
    await page.getByTestId('batch-note-input').fill('Updated E2E note after moisture check');
    await page.getByTestId('save-batch-note-btn').click();
    await expect(page.getByTestId('batch-note-section')).toContainText(
      'Updated E2E note after moisture check'
    );
    await expect(page.getByTestId('batch-note-history')).toContainText(
      'Initial E2E harvest note'
    );

    // Edit raw-material fields with required reason
    await page.getByTestId('open-raw-material-btn').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByTestId('raw-farmer-name').fill('Kundan Singh Bisht');
    await page.getByTestId('raw-village').fill('Ranikhet');
    await page.getByTestId('raw-quantity').fill('195');
    await page.getByTestId('raw-reason').fill('Weighbridge ticket correction #402');
    await page.getByTestId('save-raw-material-btn').click();

    await expect(page.getByTestId('detail-farmer-village')).toHaveText(
      'Kundan Singh Bisht — Ranikhet'
    );
    await expect(page.getByTestId('detail-quantity')).toContainText('195 Kg');
  });

  test('P6-E2E-03: Quality inspector 422 PASSED-with-fail check, PASSED badge, FAILED quality hold block, and FLAGGED dispatch warning', async ({
    page
  }) => {
    const fmToken = await apiLogin('factory_mgr');
    const businessDate = await getServerBusinessDate(fmToken);
    const products = await getProductsBySku(fmToken);

    const batchPass = await apiCreateBatch(fmToken, {
      productId: products.WBJC!.id,
      packDate: addDaysIso(businessDate, -10),
      expiryDate: addDaysIso(businessDate, 50),
      sourceLotCode: 'E2E-P6-INSP-PASS'
    });
    const batchFail = await apiCreateBatch(fmToken, {
      productId: products.KMGC!.id,
      packDate: addDaysIso(businessDate, -10),
      expiryDate: addDaysIso(businessDate, 50),
      sourceLotCode: 'E2E-P6-INSP-FAIL'
    });
    // Give batchFlag earliest expiry (+1d) on SKU WBDRP so it is #1 in FEFO for WBDRP
    const batchFlag = await apiCreateBatch(fmToken, {
      productId: products.WBDRP!.id,
      packDate: addDaysIso(businessDate, -10),
      expiryDate: addDaysIso(businessDate, 1),
      sourceLotCode: 'E2E-P6-INSP-FLAG'
    });

    await uiSignIn(page, 'inspector');
    await page.goto('/inspections');

    // 1. Try PASSED with a false checklist item -> server 422 error
    await page.getByTestId('open-create-inspection-btn').click();
    await page.getByTestId('inspection-batch-select').selectOption(batchPass.id);
    await page.getByTestId('inspection-verdict-select').selectOption('PASSED');
    await page.getByTestId('checklist-fail-0').click();
    await page.getByTestId('submit-inspection-btn').click();

    await expect(page.getByTestId('create-inspection-error')).toBeVisible();
    await expect(page.getByTestId('create-inspection-error')).toContainText(/PASSED|fail/i);

    // 2. Fix item 0 to Pass and submit PASSED inspection -> see badge on batch
    await page.getByTestId('checklist-pass-0').click();
    await page.getByTestId('inspection-findings-input').fill('All 8 points verified in lab');
    await page.getByTestId('submit-inspection-btn').click();
    await expect(page.getByRole('dialog')).toBeHidden();

    await page.goto(`/batches/${batchPass.id}`);
    await expect(page.getByTestId('batch-quality-snapshot')).toContainText('PASSED');

    // 3. Record FAILED inspection on batchFail
    await page.goto('/inspections');
    await page.getByTestId('open-create-inspection-btn').click();
    await page.getByTestId('inspection-batch-select').selectOption(batchFail.id);
    await page.getByTestId('inspection-verdict-select').selectOption('FAILED');
    await page.getByTestId('inspection-rating-select').selectOption('2');
    await page.getByTestId('checklist-fail-0').click();
    await page.getByTestId('inspection-findings-input').fill('Seal integrity failure');
    await page.getByTestId('submit-inspection-btn').click();
    await expect(page.getByRole('dialog')).toBeHidden();

    // 4. Record FLAGGED inspection on batchFlag
    await page.getByTestId('open-create-inspection-btn').click();
    await page.getByTestId('inspection-batch-select').selectOption(batchFlag.id);
    await page.getByTestId('inspection-verdict-select').selectOption('FLAGGED');
    await page.getByTestId('inspection-rating-select').selectOption('3');
    await page.getByTestId('inspection-findings-input').fill('Minor label alignment variance');
    await page.getByTestId('submit-inspection-btn').click();
    await expect(page.getByRole('dialog')).toBeHidden();

    // Sign in as dispatch coordinator to test QUALITY_HOLD block and FLAGGED warning
    await page.getByTestId('sign-out-btn').click();
    await uiSignIn(page, 'coordinator');

    // FAILED batch -> dispatch blocked with 409 QUALITY_HOLD
    await page.goto(`/batches/${batchFail.id}`);
    await page.getByTestId('open-dispatch-dialog-btn').click();
    await page.getByTestId('dispatch-buyer-input').fill('Quality Hold Test Buyer');
    await page.getByTestId('dispatch-submit-btn').click();
    await expect(page.getByTestId('dispatch-error-banner')).toBeVisible();
    await expect(page.getByTestId('dispatch-error-banner')).toContainText('QUALITY_HOLD');
    await expect(page.getByTestId('dispatch-submit-btn')).toBeDisabled();
    await page.getByTestId('dispatch-cancel-btn').click();

    // FLAGGED batch -> shows advisory in dialog and warning banner on dispatch
    await page.goto(`/batches/${batchFlag.id}`);
    await page.getByTestId('open-dispatch-dialog-btn').click();
    await expect(page.getByTestId('dispatch-flagged-advisory')).toBeVisible();
    await page.getByTestId('dispatch-buyer-input').fill('Flagged Advisory Buyer');
    await page.getByTestId('dispatch-submit-btn').click();
    await expect(page.getByTestId('batch-dispatch-warning')).toBeVisible();
  });

  test('P6-E2E-04: FEFO dispatch in order succeeds; out-of-order without overrideReason is blocked and shows earlier batchCode; out-of-order with overrideReason succeeds; expired batch is blocked with BATCH_EXPIRED', async ({
    page
  }) => {
    const fmToken = await apiLogin('factory_mgr');
    const businessDate = await getServerBusinessDate(fmToken);
    const products = await getProductsBySku(fmToken);

    // Create two batches on SKU RHSLT expiring in +2d and +5d (ahead of DEMO-LOT-007 at +90d)
    const batchEarlier = await apiCreateBatch(fmToken, {
      productId: products.RHSLT!.id,
      packDate: addDaysIso(businessDate, -10),
      expiryDate: addDaysIso(businessDate, 2),
      sourceLotCode: 'E2E-P6-FEFO-EARLIER'
    });
    const batchLater = await apiCreateBatch(fmToken, {
      productId: products.RHSLT!.id,
      packDate: addDaysIso(businessDate, -10),
      expiryDate: addDaysIso(businessDate, 5),
      sourceLotCode: 'E2E-P6-FEFO-LATER'
    });

    await uiSignIn(page, 'coordinator');
    await page.goto('/fefo');
    await page.getByTestId('fefo-filter-sku').selectOption('RHSLT');

    // 1. Out-of-order dispatch of batchLater without overrideReason -> blocked with DISPATCH_OUT_OF_ORDER showing batchEarlier.batchCode
    await page.getByTestId(`fefo-dispatch-btn-${batchLater.batchCode}`).click();
    await page.getByTestId('dispatch-buyer-input').fill('Out Of Order Buyer');
    await page.getByTestId('dispatch-submit-btn').click();

    await expect(page.getByTestId('dispatch-error-banner')).toContainText('DISPATCH_OUT_OF_ORDER');
    await expect(page.getByTestId('dispatch-earlier-batch-code')).toContainText(
      batchEarlier.batchCode
    );

    // 2. Provide overrideReason -> out-of-order dispatch succeeds
    await page
      .getByTestId('dispatch-override-reason-input')
      .fill('Buyer requested specific packaging lot for regional distributor');
    await page.getByTestId('dispatch-submit-btn').click();
    await expect(page.getByRole('dialog')).toBeHidden();

    // 3. In-order FEFO dispatch of batchEarlier -> succeeds without override
    await page.getByTestId(`fefo-dispatch-btn-${batchEarlier.batchCode}`).click();
    await page.getByTestId('dispatch-buyer-input').fill('In Order FEFO Buyer');
    await page.getByTestId('dispatch-submit-btn').click();
    await expect(page.getByRole('dialog')).toBeHidden();

    // 4. Expired batch dispatch -> blocked with 409 BATCH_EXPIRED
    const fefoRes = await fetch(`${E2E_API_BASE}/api/v1/dispatch/fefo`, {
      headers: { Authorization: `Bearer ${fmToken}` }
    });
    const fefoBody = (await fefoRes.json()) as {
      data?: { expired?: Array<{ id: string; batchCode: string }> };
    };
    const expiredBatch = fefoBody.data?.expired?.[0];
    expect(expiredBatch).toBeDefined();

    await page.goto(`/batches/${expiredBatch!.id}`);
    await page.getByTestId('open-dispatch-dialog-btn').click();
    await page.getByTestId('dispatch-buyer-input').fill('Expired Attempt Buyer');
    await page.getByTestId('dispatch-submit-btn').click();
    await expect(page.getByTestId('dispatch-error-banner')).toContainText('BATCH_EXPIRED');
    await expect(page.getByTestId('dispatch-submit-btn')).toBeDisabled();
  });

  test('P6-E2E-05: Archive and restore as admin; non-admin sees no archive button and gets 403 on archived route; dispatch-coordinator sees no create-batch or inspect controls', async ({
    page
  }) => {
    const fmToken = await apiLogin('factory_mgr');
    const businessDate = await getServerBusinessDate(fmToken);
    const products = await getProductsBySku(fmToken);

    const batchToArchive = await apiCreateBatch(fmToken, {
      productId: products.ABHJAM!.id,
      packDate: addDaysIso(businessDate, -5),
      expiryDate: addDaysIso(businessDate, 60),
      sourceLotCode: 'E2E-P6-ARCHIVE-01'
    });

    // 1. Admin archives and restores batch
    await uiSignIn(page, 'admin');
    await page.goto(`/batches/${batchToArchive.id}`);
    await page.getByTestId('open-archive-dialog-btn').click();
    await page.getByLabel(/Archive Reason/i).fill('Duplicate E2E test entry');
    await page.getByRole('button', { name: 'Archive Batch' }).click();

    await expect(page).toHaveURL('/batches/archived');
    await expect(page.getByTestId(`archived-code-${batchToArchive.batchCode}`)).toBeVisible();

    await page.getByTestId(`restore-batch-btn-${batchToArchive.batchCode}`).click();
    await expect(page.getByTestId(`archived-code-${batchToArchive.batchCode}`)).toHaveCount(0);

    // 2. Non-admin (factory_mgr) sees no archive button and gets 403 on /batches/archived
    await page.getByTestId('sign-out-btn').click();
    await uiSignIn(page, 'factory_mgr');
    await page.goto(`/batches/${batchToArchive.id}`);
    await expect(page.getByTestId('detail-batch-code')).toHaveText(batchToArchive.batchCode);
    await expect(page.getByTestId('open-archive-dialog-btn')).toHaveCount(0);

    await page.goto('/batches');
    await expect(page.getByTestId('view-archived-batches-btn')).toHaveCount(0);

    await page.goto('/batches/archived');
    await expect(page.getByTestId('forbidden-state')).toBeVisible();

    // 3. Dispatch coordinator sees no create-batch or inspect controls
    await page.getByTestId('sign-out-btn').click();
    await uiSignIn(page, 'coordinator');
    await page.goto('/batches');
    await expect(page.getByTestId('batches-desktop-table')).toBeVisible();
    await expect(page.getByTestId('open-create-batch-btn')).toHaveCount(0);
    await expect(page.getByTestId('desktop-sidebar')).not.toContainText('Quality Inspections');

    await page.goto(`/batches/${batchToArchive.id}`);
    await expect(page.getByTestId('inspections-role-restricted-msg')).toBeVisible();

    await page.goto('/inspections');
    await expect(page.getByTestId('forbidden-state')).toBeVisible();
  });

  test('P6-E2E-06: Edit profile and change password, keeping the session signed in via rotated token', async ({
    page
  }) => {
    const tempPass = 'RotatedPass98765!';

    await uiSignIn(page, 'manager');
    await page.goto('/profile');

    const tokenBefore = await page.evaluate(() => window.sessionStorage.getItem('tx_token'));
    expect(tokenBefore).toBeTruthy();

    // Edit profile phone
    await page.getByTestId('profile-phone-input').fill('+91 98111 22333');
    await page.getByTestId('profile-save-btn').click();
    await page.reload();
    await expect(page.getByTestId('profile-phone-input')).toHaveValue('+91 98111 22333');

    // Change password -> rotates token in sessionStorage and keeps session signed in
    await page.getByTestId('profile-current-password').fill(SEED_PASSWORD);
    await page.getByTestId('profile-new-password').fill(tempPass);
    await page.getByTestId('profile-change-password-btn').click();

    await expect
      .poll(async () => page.evaluate(() => window.sessionStorage.getItem('tx_token')))
      .not.toBe(tokenBefore);

    // Navigate to protected route to prove the rotated token keeps the session authenticated
    await page.goto('/batches');
    await expect(page.getByTestId('batches-desktop-table')).toBeVisible();

    // Restore SEED_PASSWORD for manager
    await page.goto('/profile');
    await page.getByTestId('profile-current-password').fill(tempPass);
    await page.getByTestId('profile-new-password').fill(SEED_PASSWORD);
    await page.getByTestId('profile-change-password-btn').click();
    await expect(page.getByTestId('profile-current-password')).toHaveValue('');
  });

  test('P6-E2E-07 (Check 8): Two Playwright contexts with Asia/Kolkata and America/Los_Angeles show the exact same expiry date string for the same batch', async ({
    browser
  }) => {
    const contextIST = await browser.newContext({ timezoneId: 'Asia/Kolkata' });
    const contextLA = await browser.newContext({ timezoneId: 'America/Los_Angeles' });

    try {
      const pageIST = await contextIST.newPage();
      const pageLA = await contextLA.newPage();

      await uiSignIn(pageIST, 'manager');
      await uiSignIn(pageLA, 'manager');

      await pageIST.goto('/batches');
      await pageLA.goto('/batches');

      const firstBatchCode =
        (
          await pageIST.locator('[data-testid^="batch-link-"]').first().textContent()
        )?.trim() ?? '';
      expect(firstBatchCode).toMatch(/^TX-/);

      const listExpiryIST = (
        await pageIST.getByTestId(`batch-expiry-${firstBatchCode}`).textContent()
      )?.trim();
      const listExpiryLA = (
        await pageLA.getByTestId(`batch-expiry-${firstBatchCode}`).textContent()
      )?.trim();

      await pageIST.getByTestId(`batch-link-${firstBatchCode}`).click();
      await pageLA.getByTestId(`batch-link-${firstBatchCode}`).click();

      const detailExpiryIST = (
        await pageIST.getByTestId('detail-expiry-date').textContent()
      )?.trim();
      const detailExpiryLA = (
        await pageLA.getByTestId('detail-expiry-date').textContent()
      )?.trim();
      const detailPackIST = (await pageIST.getByTestId('detail-pack-date').textContent())?.trim();
      const detailPackLA = (await pageLA.getByTestId('detail-pack-date').textContent())?.trim();

      console.log(
        `[P6-E2E-07 TZ] batch=${firstBatchCode} Asia/Kolkata={listExpiry:${listExpiryIST}, detailExpiry:${detailExpiryIST}, detailPack:${detailPackIST}} America/Los_Angeles={listExpiry:${listExpiryLA}, detailExpiry:${detailExpiryLA}, detailPack:${detailPackLA}}`
      );

      expect(listExpiryIST).toBeTruthy();
      expect(listExpiryIST).toBe(listExpiryLA);
      expect(detailExpiryIST).toBe(detailExpiryLA);
      expect(detailPackIST).toBe(detailPackLA);
    } finally {
      await contextIST.close();
      await contextLA.close();
    }
  });

  test('P6-E2E-08 (Check 9): Delayed and failed response test proves no success toast appears before server confirmation', async ({
    page
  }) => {
    await uiSignIn(page, 'factory_mgr');
    await page.goto('/batches');
    await page.getByTestId('open-create-batch-btn').click();

    await page.getByTestId('create-batch-lot-code').fill('E2E-P6-DELAY-FAIL');
    await page.getByTestId('create-batch-farmer-name').fill('Delayed Farmer');
    await page.getByTestId('create-batch-village').fill('Nainital');

    // 1. Intercept POST /api/v1/batches with a controlled gate that eventually fails (HTTP 500)
    let releaseFailedGate!: () => void;
    const failedGatePromise = new Promise<void>((resolve) => {
      releaseFailedGate = resolve;
    });

    await page.route('**/api/v1/batches', async (route) => {
      if (route.request().method() === 'POST') {
        await failedGatePromise;
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            code: 'INTERNAL_ERROR',
            error: 'Simulated server failure before confirmation',
            fieldErrors: []
          })
        });
      } else {
        await route.continue();
      }
    });

    await page.getByTestId('create-batch-submit-btn').click();

    // While in-flight before server responds: button is disabled, and NO success toast or banner exists
    await expect(page.getByTestId('create-batch-submit-btn')).toBeDisabled();
    await expect(page.getByText('Batch created', { exact: true })).toHaveCount(0);
    await expect(page.getByTestId('created-batch-banner')).toHaveCount(0);
    console.log(
      '[P6-E2E-08 IN_FLIGHT_BEFORE_FAIL] submitDisabled=true, successToastCount=0, createdBannerCount=0'
    );

    releaseFailedGate();

    await expect(page.getByTestId('create-batch-error')).toContainText(
      'Simulated server failure before confirmation'
    );
    await expect(page.getByText('Batch created', { exact: true })).toHaveCount(0);
    console.log(
      '[P6-E2E-08 AFTER_500_FAIL] errorBannerVisible=true, successToastCount=0'
    );

    await page.unroute('**/api/v1/batches');

    // 2. Intercept POST /api/v1/batches with a delayed gate that forwards to the real backend
    let releaseSuccessGate!: () => void;
    const successGatePromise = new Promise<void>((resolve) => {
      releaseSuccessGate = resolve;
    });

    await page.route('**/api/v1/batches', async (route) => {
      if (route.request().method() === 'POST') {
        await successGatePromise;
        await route.continue();
      } else {
        await route.continue();
      }
    });

    await page.getByTestId('create-batch-lot-code').fill('E2E-P6-DELAY-OK');
    await page.getByTestId('create-batch-submit-btn').click();

    await expect(page.getByTestId('create-batch-submit-btn')).toBeDisabled();
    await expect(page.getByText('Batch created', { exact: true })).toHaveCount(0);
    await expect(page.getByTestId('created-batch-banner')).toHaveCount(0);
    console.log(
      '[P6-E2E-08 IN_FLIGHT_BEFORE_SUCCESS] submitDisabled=true, successToastCount=0, createdBannerCount=0'
    );

    releaseSuccessGate();

    await expect(page.getByTestId('created-batch-banner')).toBeVisible();
    await expect(page.getByText('Batch created', { exact: true })).toBeVisible();
    console.log(
      '[P6-E2E-08 AFTER_201_SUCCESS] createdBannerVisible=true, successToastVisible=true'
    );

    await page.unroute('**/api/v1/batches');
  });

  test('P6-E2E-09: axe-core accessibility scan on every Phase 6 route in light and dark modes', async ({
    page
  }) => {
    const adminToken = await apiLogin('superadmin');
    const batchesRes = await fetch(`${E2E_API_BASE}/api/v1/batches?page=1&limit=1`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const batchesBody = (await batchesRes.json()) as {
      data?: { data?: Array<{ id: string }> };
    };
    const sampleBatchId = batchesBody.data?.data?.[0]?.id ?? '';
    expect(sampleBatchId).toBeTruthy();

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await uiSignIn(page, 'superadmin');

    const phase06Routes = [
      '/',
      '/dashboard',
      '/batches',
      '/batches/new',
      `/batches/${sampleBatchId}`,
      '/batches/archived',
      '/fefo',
      '/inspections',
      '/profile',
      '/settings'
    ];

    for (const routePath of phase06Routes) {
      await page.goto(routePath);
      for (const mode of ['light', 'dark'] as const) {
        await page.evaluate((m) => {
          document.documentElement.setAttribute('data-palette', 'editorial');
          document.documentElement.setAttribute('data-theme', m);
        }, mode);

        const results = await new AxeBuilder({ page }).analyze();
        const seriousOrCritical = results.violations.filter(
          (v) => v.impact === 'serious' || v.impact === 'critical'
        );
        console.log(
          `[P6-E2E-09 AXE] route=${routePath} mode=${mode} -> violations=${results.violations.length} seriousOrCritical=${seriousOrCritical.length}`
        );
        expect(
          seriousOrCritical,
          `axe serious/critical violations on ${routePath} (${mode})`
        ).toEqual([]);
      }
    }
  });

  test('P6-E2E-10: 375px mobile viewport measurements and screenshots in docs/screenshots/phase-06/', async ({
    page
  }) => {
    for (const existing of fs.readdirSync(SCREENSHOT_DIR)) {
      if (existing.endsWith('.png')) {
        fs.unlinkSync(path.join(SCREENSHOT_DIR, existing));
      }
    }

    const adminToken = await apiLogin('superadmin');
    const batchesRes = await fetch(`${E2E_API_BASE}/api/v1/batches?page=1&limit=1`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const batchesBody = (await batchesRes.json()) as {
      data?: { data?: Array<{ id: string }> };
    };
    const sampleBatchId = batchesBody.data?.data?.[0]?.id ?? '';
    expect(sampleBatchId).toBeTruthy();

    await page.setViewportSize({ width: 375, height: 812 });
    await uiSignIn(page, 'superadmin');

    const targets = [
      { route: '/dashboard', file: '01-dashboard-375.png', waitTestId: 'dashboard-summary-ready' },
      { route: '/batches', file: '02-batches-list-375.png', waitTestId: 'batches-mobile-cards' },
      { route: '/batches/new', file: '03-batches-create-375.png', waitTestId: 'create-batch-submit-btn' },
      {
        route: `/batches/${sampleBatchId}`,
        file: '04-batch-detail-375.png',
        waitTestId: 'batch-overview-section'
      },
      {
        route: '/batches/archived',
        file: '05-batches-archived-375.png',
        waitTestId: 'archived-batches-page'
      },
      { route: '/fefo', file: '06-fefo-queue-375.png', waitTestId: 'fefo-queue-section' },
      { route: '/inspections', file: '07-inspections-375.png', waitTestId: 'inspections-page' },
      { route: '/profile', file: '08-profile-375.png', waitTestId: 'profile-page' }
    ];

    for (const target of targets) {
      await page.goto(target.route);
      await expect(page.getByTestId(target.waitTestId)).toBeVisible();
      const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth
      }));
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, target.file),
        fullPage: true
      });
      console.log(
        `[P6-E2E-10 375px] route=${target.route} -> scrollWidth=${metrics.scrollWidth} clientWidth=${metrics.clientWidth} file=${target.file}`
      );
      expect(
        metrics.scrollWidth <= metrics.clientWidth,
        `Horizontal overflow at 375px on ${target.route}: scrollWidth=${metrics.scrollWidth} > clientWidth=${metrics.clientWidth}`
      ).toBe(true);
    }
  });
});
