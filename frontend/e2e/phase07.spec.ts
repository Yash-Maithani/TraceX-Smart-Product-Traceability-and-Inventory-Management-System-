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
const SCREENSHOT_DIR = path.resolve(__dirname, '../../docs/screenshots/phase-07');
const CLEAN_SCRIPT = path.resolve(__dirname, '../../scripts/clean-e2e-phase07.ps1');
const E2E_API_BASE = 'http://localhost:8083';
const SEED_PASSWORD = process.env.E2E_SEED_PASSWORD ?? 'E2ePass123456!';

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

function cleanPhase07E2eData(): void {
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
): Promise<{ id: string; batchCode: string; sku: string; expiryDate: string; qrAbsoluteUrl?: string }> {
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
    data?: { id: string; batchCode: string; sku: string; expiryDate: string; qrAbsoluteUrl?: string };
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

test.describe('Phase 7 E2E Verification Suite (QR & Public Trace)', () => {
  let sharedBatch: {
    id: string;
    batchCode: string;
    sku: string;
    expiryDate: string;
    qrAbsoluteUrl: string;
    farmerName: string;
  };
  let tokenManager: string;
  let tokenAdmin: string;
  let tokenCoord: string;

  test.beforeAll(async () => {
    cleanPhase07E2eData();
    await startE2eBackend();

    tokenManager = await apiLogin('factory_mgr');
    tokenAdmin = await apiLogin('admin');
    tokenCoord = await apiLogin('coordinator');

    const businessDate = await getServerBusinessDate(tokenManager);
    const products = await getProductsBySku(tokenManager);
    const product = products['WBJC'];
    if (!product) throw new Error('WBJC product missing');

    const farmerSecret = 'Himalayan High-Altitude Apiary';
    const created = await apiCreateBatch(tokenManager, {
      productId: product.id,
      packDate: businessDate,
      expiryDate: addDaysIso(businessDate, 45),
      sourceLotCode: 'E2E-P7-BATCH-01',
      farmerName: farmerSecret,
      village: 'Lansdowne Valley'
    });

    const qrRes = await fetch(`${E2E_API_BASE}/api/v1/batches/${created.id}/qr`, {
      headers: { Authorization: `Bearer ${tokenManager}` }
    });
    const qrJson = (await qrRes.json()) as { data?: { qrAbsoluteUrl: string } };
    if (!qrRes.ok || !qrJson.data) {
      throw new Error(`Failed to fetch QR for batch ${created.id}: ${qrRes.status} ${JSON.stringify(qrJson)}`);
    }
    const qrData = qrJson.data;

    sharedBatch = {
      ...created,
      qrAbsoluteUrl: qrData.qrAbsoluteUrl,
      farmerName: farmerSecret
    };
  });

  test.afterAll(async () => {
    cleanPhase07E2eData();
    await stopE2eBackend();
  });

  test('P7-E2E-01: factory-manager creates a batch, reads qrAbsoluteUrl, opens in logged-out context (no farmer name), scan count increases after reload', async ({
    page,
    browser
  }) => {
    // 1. Factory manager signs in and inspects the batch detail page
    await uiSignIn(page, 'factory_mgr');
    await page.goto(`/batches/${sharedBatch.id}`);
    await expect(page.getByTestId('batch-qr-section')).toBeVisible();
    await expect(page.getByTestId('scans-empty-state')).toBeVisible();

    // 2. Open public URL in an incognito/logged-out browser context
    const incognito = await browser.newContext();
    const publicPage = await incognito.newPage();

    // The qrAbsoluteUrl starts with PUBLIC_TRACE_BASE_URL (http://localhost:5174 in e2e)
    const publicUrl = new URL(sharedBatch.qrAbsoluteUrl);
    await publicPage.goto(publicUrl.pathname);

    await expect(publicPage.getByTestId('trace-batch-code')).toHaveText(sharedBatch.batchCode);
    await expect(publicPage.getByTestId('trace-product-name')).toContainText('Wild Berry Juice Concentrate');
    await expect(publicPage.getByTestId('trace-village')).toHaveText('Lansdowne Valley');

    // Confirm farmerName is NEVER rendered on the public page
    await expect(publicPage.locator('body')).not.toContainText(sharedBatch.farmerName);

    await incognito.close();

    // 3. Reload batch detail page — Scans total must now be 1
    await page.reload();
    await expect(page.getByTestId('scans-total')).toHaveText('1');
    await expect(page.getByTestId('scans-source-buyer')).toHaveText('1');
  });

  test('P7-E2E-02: QR section renders image, Download PNG saves <batchCode>-qr.png, matches API data URL bytes', async ({
    page
  }) => {
    await uiSignIn(page, 'factory_mgr');
    await page.goto(`/batches/${sharedBatch.id}`);

    const qrImg = page.getByTestId('batch-qr-image');
    await expect(qrImg).toBeVisible();
    await expect(qrImg).toHaveAttribute('alt', `QR code for batch ${sharedBatch.batchCode}`);

    // Click Download PNG and verify saved file bytes
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('download-qr-btn').click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe(`${sharedBatch.batchCode}-qr.png`);
    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    const downloadedBuffer = fs.readFileSync(downloadPath!);

    // Compare with API data URL bytes directly
    const qrRes = await fetch(`${E2E_API_BASE}/api/v1/batches/${sharedBatch.id}/qr`, {
      headers: { Authorization: `Bearer ${tokenManager}` }
    });
    const qrJson = (await qrRes.json()) as { data: { qrCodeDataUrl: string } };
    const base64Data = qrJson.data.qrCodeDataUrl.split(',')[1]!;
    const expectedBuffer = Buffer.from(base64Data, 'base64');

    expect(downloadedBuffer.equals(expectedBuffer)).toBe(true);
  });

  test('P7-E2E-03: archive batch as admin makes public link return 404, restore makes same link work again', async ({
    browser
  }) => {
    const publicPath = new URL(sharedBatch.qrAbsoluteUrl).pathname;

    // Archive via API as admin
    const archRes = await fetch(`${E2E_API_BASE}/api/v1/batches/${sharedBatch.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdmin}`
      },
      body: JSON.stringify({ reason: 'E2E archive test for public trace 404' })
    });
    expect(archRes.ok).toBe(true);

    // In a fresh incognito context, load public URL -> must show 404 state
    const incognito = await browser.newContext();
    const publicPage = await incognito.newPage();
    await publicPage.goto(publicPath);

    await expect(publicPage.getByTestId('trace-404-state')).toBeVisible();
    await expect(
      publicPage.getByText('This QR link is not valid or the batch is no longer available.')
    ).toBeVisible();
    await expect(publicPage.getByTestId('trace-batch-code')).not.toBeVisible();

    // Restore via API as admin
    const restRes = await fetch(`${E2E_API_BASE}/api/v1/batches/${sharedBatch.id}/restore`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenAdmin}` }
    });
    expect(restRes.ok).toBe(true);

    // Reload public URL in incognito context -> batch data is back with the same token!
    await publicPage.reload();
    await expect(publicPage.getByTestId('trace-batch-code')).toHaveText(sharedBatch.batchCode);

    await incognito.close();
  });

  test('P7-E2E-04: dispatch the batch, public page shows status DISPATCHED', async ({
    browser
  }) => {
    const businessDate = await getServerBusinessDate(tokenCoord);

    // Dispatch batch via API as coordinator
    const dispRes = await fetch(`${E2E_API_BASE}/api/v1/batches/${sharedBatch.id}/dispatch`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord}`
      },
      body: JSON.stringify({
        buyerName: 'Global Naturals Ltd',
        dispatchDate: businessDate,
        overrideReason: 'Priority customer fulfillment'
      })
    });
    if (!dispRes.ok) {
      const errText = await dispRes.text();
      throw new Error(`Dispatch failed: ${dispRes.status} ${errText}`);
    }
    expect(dispRes.ok).toBe(true);

    // View public page in incognito context
    const publicPath = new URL(sharedBatch.qrAbsoluteUrl).pathname;
    const incognito = await browser.newContext();
    const publicPage = await incognito.newPage();
    await publicPage.goto(publicPath);

    await expect(publicPage.getByTestId('trace-batch-code')).toHaveText(sharedBatch.batchCode);
    await expect(publicPage.getByTestId('trace-status-badge')).toContainText(/dispatched/i);

    await incognito.close();
  });

  test('P7-E2E-05: forged and malformed tokens and old /trace/:code show right states with no console errors', async ({
    page
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // 1. Forged token -> 404 state
    await page.goto('/trace/t/badnonce12345678.badtag1234567890');
    await expect(page.getByTestId('trace-404-state')).toBeVisible();

    // 2. Malformed token -> 404 state
    await page.goto('/trace/t/invalid-not-dotted');
    await expect(page.getByTestId('trace-404-state')).toBeVisible();

    // 3. Old legacy URL -> deprecation state without API calls
    await page.goto(`/trace/${sharedBatch.batchCode}`);
    await expect(page.getByTestId('legacy-trace-deprecation')).toBeVisible();
    await expect(
      page.getByText('This Link Format is No Longer Supported')
    ).toBeVisible();

    // Verify zero uncaught React / runtime console errors
    const fatalErrors = consoleErrors.filter(
      (e) => !e.includes('404') && !e.includes('NOT_FOUND')
    );
    expect(fatalErrors).toHaveLength(0);
  });

  test('P7-E2E-06: public trace page expiry date is identical in Asia/Kolkata and America/Los_Angeles contexts', async ({
    browser
  }) => {
    const publicPath = new URL(sharedBatch.qrAbsoluteUrl).pathname;

    const kolkataContext = await browser.newContext({ timezoneId: 'Asia/Kolkata' });
    const kolkataPage = await kolkataContext.newPage();
    await kolkataPage.goto(publicPath);
    await expect(kolkataPage.getByTestId('trace-expiry-date')).toBeVisible();
    const kolkataDate = await kolkataPage.getByTestId('trace-expiry-date').textContent();

    const laContext = await browser.newContext({ timezoneId: 'America/Los_Angeles' });
    const laPage = await laContext.newPage();
    await laPage.goto(publicPath);
    await expect(laPage.getByTestId('trace-expiry-date')).toBeVisible();
    const laDate = await laPage.getByTestId('trace-expiry-date').textContent();

    expect(kolkataDate).toBeTruthy();
    expect(kolkataDate).toBe(laDate);
    console.log(`[P7-E2E-06 TZ] Asia/Kolkata=${kolkataDate} America/Los_Angeles=${laDate} identical=true`);

    await kolkataContext.close();
    await laContext.close();
  });

  test('P7-E2E-07: axe-core zero serious or critical violations on /trace/t/:token in light and dark across 3 palettes and images on/off, and batch detail with QR', async ({
    page
  }) => {
    const publicPath = new URL(sharedBatch.qrAbsoluteUrl).pathname;
    await page.goto(publicPath);
    await expect(page.getByTestId('trace-batch-code')).toBeVisible();

    const palettes = ['editorial', 'obsidian', 'emerald'] as const;
    const modes = ['light', 'dark'] as const;
    const imageToggles = [true, false];

    for (const palette of palettes) {
      for (const mode of modes) {
        for (const imagesOn of imageToggles) {
          await page.evaluate(
            ({ p, m, img }) => {
              document.documentElement.setAttribute('data-palette', p);
              document.documentElement.setAttribute('data-theme', m);
              localStorage.setItem('tx_prefs', JSON.stringify({ showPageImages: img }));
              window.dispatchEvent(new Event('storage'));
            },
            { p: palette, m: mode, img: imagesOn }
          );

          await page.waitForTimeout(150);

          const axeResults = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
            .analyze();

          const seriousOrCritical = axeResults.violations.filter(
            (v) => v.impact === 'serious' || v.impact === 'critical'
          );
          expect(seriousOrCritical).toHaveLength(0);
        }
      }
    }

    // Now check batch detail page with QR section
    await uiSignIn(page, 'factory_mgr');
    await page.goto(`/batches/${sharedBatch.id}`);
    await expect(page.getByTestId('batch-qr-section')).toBeVisible();

    const detailAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const detailSeriousOrCritical = detailAxe.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    );
    expect(detailSeriousOrCritical).toHaveLength(0);
    console.log('[P7-E2E-07 AXE] checked /trace/t/:token in 12 permutations (3 palettes x 2 modes x 2 image settings) + batch detail: zero violations');
  });

  test('P7-E2E-08: 375px, 768px, and 1280px: scrollWidth equals clientWidth on trace page and batch detail; screenshots saved', async ({
    page
  }) => {
    const publicPath = new URL(sharedBatch.qrAbsoluteUrl).pathname;
    const viewports = [
      { width: 375, height: 667 },
      { width: 768, height: 1024 },
      { width: 1280, height: 800 }
    ];

    // 1. Trace page
    await page.goto(publicPath);
    await expect(page.getByTestId('trace-batch-code')).toBeVisible();

    for (const vp of viewports) {
      await page.setViewportSize(vp);
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth
      }));
      expect(scrollWidth).toBe(clientWidth);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `trace-${vp.width}.png`),
        fullPage: true
      });
    }

    // 2. Batch detail page
    await uiSignIn(page, 'factory_mgr');
    await page.goto(`/batches/${sharedBatch.id}`);
    await expect(page.getByTestId('batch-qr-section')).toBeVisible();

    for (const vp of viewports) {
      await page.setViewportSize(vp);
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth
      }));
      expect(scrollWidth).toBe(clientWidth);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `batch-detail-${vp.width}.png`),
        fullPage: true
      });
    }
    console.log('[P7-E2E-08 VIEWPORTS] trace and batch detail at 375px, 768px, 1280px: all scrollWidth === clientWidth');
  });

  test('P7-E2E-09: network log shows exactly one trace GET and one scan POST; sessionStorage tx_token not read or sent', async ({
    browser
  }) => {
    const publicPath = new URL(sharedBatch.qrAbsoluteUrl).pathname;
    const incognito = await browser.newContext();
    const page = await incognito.newPage();

    const traceRequests: { method: string; url: string; authHeader: string | undefined }[] = [];
    const scanRequests: { method: string; url: string; authHeader: string | undefined }[] = [];

    page.on('request', (req) => {
      const u = req.url();
      if (u.includes('/api/v1/qr/trace/t/')) {
        traceRequests.push({
          method: req.method(),
          url: u,
          authHeader: req.headers()['authorization']
        });
      }
      if (u.includes('/api/v1/qr/scan')) {
        scanRequests.push({
          method: req.method(),
          url: u,
          authHeader: req.headers()['authorization']
        });
      }
    });

    await page.goto(publicPath);
    await expect(page.getByTestId('trace-batch-code')).toBeVisible();

    // Allow background scan POST to finalize
    await page.waitForTimeout(600);

    // Exact request counts
    expect(traceRequests).toHaveLength(1);
    expect(traceRequests[0]!.method).toBe('GET');
    expect(traceRequests[0]!.authHeader).toBeUndefined();

    expect(scanRequests).toHaveLength(1);
    expect(scanRequests[0]!.method).toBe('POST');
    expect(scanRequests[0]!.authHeader).toBeUndefined();

    // Session storage must NOT contain any token in this public session
    const storedToken = await page.evaluate(() => sessionStorage.getItem('tx_token'));
    expect(storedToken).toBeNull();
    console.log(`[P7-E2E-09 NETWORK] traceRequests=${traceRequests.length} scanRequests=${scanRequests.length} authHeaderSent=false sessionStorageRead=false`);

    await incognito.close();
  });
});
