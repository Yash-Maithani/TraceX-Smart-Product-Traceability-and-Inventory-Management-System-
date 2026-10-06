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
const FIXTURE_DIR = path.resolve(__dirname, './fixtures');
const FIXTURE_CSV_PATH = path.resolve(FIXTURE_DIR, 'e2e-phase08-batches.csv');
const CLEAN_SCRIPT = path.resolve(__dirname, '../../scripts/clean-e2e-phase08.ps1');
const E2E_API_BASE = 'http://localhost:8083';
const SEED_PASSWORD = process.env.E2E_SEED_PASSWORD ?? 'E2ePass123456!';

fs.mkdirSync(FIXTURE_DIR, { recursive: true });

function cleanPhase08E2eData(): void {
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

async function getFirstSeedProductSku(token: string): Promise<string> {
  const res = await fetch(`${E2E_API_BASE}/api/v1/products`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const body = (await res.json()) as {
    data?: Array<{ id: string; sku: string; productName: string }>;
  };
  const first = body.data?.[0];
  if (!first?.sku) {
    throw new Error('No seeded products found in tracex_fresh_e2e');
  }
  return first.sku;
}

async function uiSignIn(page: Page, username: string, password = SEED_PASSWORD): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/');
}

test.describe('Phase 8 Bulk CSV Import E2E Suite', () => {
  test.beforeAll(async () => {
    await startE2eBackend();
    cleanPhase08E2eData();
  });

  test.afterAll(async () => {
    cleanPhase08E2eData();
    await stopE2eBackend();
  });

  test('P8-E2E-01: owner imports fixture CSV (valid + duplicate + error), views result, rolls back, and re-imports successfully', async ({
    page
  }) => {
    cleanPhase08E2eData();
    const adminToken = await apiLogin('superadmin');
    const today = await getServerBusinessDate(adminToken);
    const packDate = addDaysIso(today, -5);
    const sku = await getFirstSeedProductSku(adminToken);

    const csvLines = [
      'sourceLotCode,productSku,packDate,quantityProduced,unit,yieldPercent,farmerName,village',
      `E2E-P8-LOT-01,${sku},${packDate},140,Kg,88,HiddenPIIFarmerOne,Sopore`,
      `E2E-P8-LOT-02,${sku},${packDate},165,Kg,90,HiddenPIIFarmerTwo,Anantnag`,
      `E2E-P8-LOT-01,${sku},${packDate},140,Kg,88,HiddenPIIFarmerOne,Sopore`,
      `E2E-P8-LOT-BAD,${sku},${packDate},-25,Kg,85,HiddenPIIFarmerBad,Baramulla`
    ];
    fs.writeFileSync(FIXTURE_CSV_PATH, csvLines.join('\r\n'), 'utf8');

    await uiSignIn(page, 'superadmin');

    // Navigate via sidebar link
    const sidebar = page.getByTestId('desktop-sidebar');
    const navLink = sidebar.getByRole('link', { name: 'Bulk Import' });
    await expect(navLink).toBeVisible();
    await navLink.click();
    await expect(page).toHaveURL('/import');
    await expect(page.getByTestId('import-page')).toBeVisible();

    // Upload fixture CSV
    const fileInput = page.getByTestId('import-file-input');
    await fileInput.setInputFiles(FIXTURE_CSV_PATH);

    // Step 2: Map columns
    await expect(page.getByTestId('import-map-section')).toBeVisible();
    await expect(page.getByTestId('import-validate-btn')).toBeEnabled();
    await page.getByTestId('import-validate-btn').click();

    // Step 3: Preview (2 insert, 1 skip, 1 error; no farmerName in preview)
    await expect(page.getByTestId('import-preview-section')).toBeVisible();
    await expect(page.getByTestId('summary-total-count')).toHaveText('4');
    await expect(page.getByTestId('summary-insert-count')).toHaveText('2');
    await expect(page.getByTestId('summary-skip-count')).toHaveText('1');
    await expect(page.getByTestId('summary-error-count')).toHaveText('1');

    const previewTableText = await page.getByTestId('import-preview-table').textContent();
    expect(previewTableText).not.toContain('HiddenPIIFarmerOne');
    expect(previewTableText).not.toContain('HiddenPIIFarmerTwo');

    // Axe check on /import preview
    const axePreview = await new AxeBuilder({ page }).analyze();
    const seriousPreview = axePreview.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    );
    expect(seriousPreview).toEqual([]);

    // Step 4 & 5: Commit -> Result
    await page.getByTestId('import-commit-btn').click();
    await expect(page.getByTestId('import-result-section')).toBeVisible();
    await expect(page.getByTestId('result-inserted-count')).toHaveText('2');
    await expect(page.getByTestId('result-skipped-count')).toHaveText('1');
    await expect(page.getByTestId('result-errored-count')).toHaveText('1');

    const jobId = (await page.getByTestId('result-job-id').textContent())?.trim() ?? '';
    expect(jobId).toBeTruthy();

    // Recent Imports table shows the job as Done
    const jobRow = page.getByTestId(`import-job-row-${jobId}`);
    await expect(jobRow).toBeVisible();
    await expect(page.getByTestId(`import-job-status-${jobId}`)).toHaveText('Done');

    // Rollback the import via ConfirmDialog
    await page.getByTestId(`rollback-job-btn-${jobId}`).click();
    await page.getByRole('button', { name: 'Confirm Rollback' }).click();

    await expect(page.getByTestId(`import-job-status-${jobId}`)).toHaveText('Rolled Back');

    // Re-import the exact same CSV file after rollback -> should insert 2 again
    await page.getByTestId('import-another-btn').click();
    await expect(page.getByTestId('import-upload-section')).toBeVisible();

    await page.getByTestId('import-file-input').setInputFiles(FIXTURE_CSV_PATH);
    await expect(page.getByTestId('import-map-section')).toBeVisible();
    await page.getByTestId('import-validate-btn').click();

    await expect(page.getByTestId('import-preview-section')).toBeVisible();
    await expect(page.getByTestId('summary-insert-count')).toHaveText('2');
    await page.getByTestId('import-commit-btn').click();

    await expect(page.getByTestId('import-result-section')).toBeVisible();
    await expect(page.getByTestId('result-inserted-count')).toHaveText('2');
  });

  test('P8-E2E-02: quality-inspector has no Bulk Import nav link and direct /import URL is denied (403)', async ({
    page
  }) => {
    await uiSignIn(page, 'inspector');

    const sidebar = page.getByTestId('desktop-sidebar');
    await expect(sidebar.getByRole('link', { name: 'Batches' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Bulk Import' })).toHaveCount(0);

    await page.goto('/import');
    await expect(page.getByTestId('forbidden-state')).toBeVisible();
    await expect(page.getByTestId('forbidden-state')).toContainText('Access Restricted (403)');
  });
});
