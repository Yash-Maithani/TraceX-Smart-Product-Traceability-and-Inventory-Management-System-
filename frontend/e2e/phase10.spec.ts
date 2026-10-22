import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { startE2eBackend, stopE2eBackend } from './backendServer';

const E2E_API_BASE = 'http://localhost:8083';
const SEED_PASSWORD = process.env.E2E_SEED_PASSWORD ?? 'E2ePass123456!';

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

async function api<T>(token: string, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${E2E_API_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? null : JSON.stringify(body)
  });
  return (await res.json()) as T;
}

async function uiSignIn(page: Page, username: string, password = SEED_PASSWORD): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/');
}

async function createBatchAs(token: string): Promise<{ id: string; batchCode: string }> {
  const products = await api<{ data: Array<{ id: string }> }>(token, 'GET', '/api/v1/products');
  const created = await api<{ data: { id: string; batchCode: string } }>(token, 'POST', '/api/v1/batches', {
    productId: products.data[0]!.id,
    sourceLotCode: `P10-LOT-${Date.now()}`,
    farmerName: 'HiddenPIIFarmerP10',
    village: 'Almora',
    quantityProduced: 25,
    unit: 'Kg',
    yieldPercent: 90,
    packDate: new Date().toISOString().slice(0, 10)
  });
  return created.data;
}

test.describe('Phase 10 Notifications and Live Updates E2E Suite', () => {
  const createdBatchIds: string[] = [];

  test.beforeAll(async () => {
    await startE2eBackend();
    // Start every account in this suite from a clean, all-read state
    for (const username of ['inspector', 'factory_mgr']) {
      await api(await apiLogin(username), 'PATCH', '/api/v1/notifications/read-all');
    }
  });

  test.afterAll(async () => {
    const adminToken = await apiLogin('admin');
    for (const id of createdBatchIds) {
      await api(adminToken, 'DELETE', `/api/v1/batches/${id}`, { reason: 'Phase 10 E2E cleanup' });
    }
    await stopE2eBackend();
  });

  test('P10-E2E-01: the bell updates live when another user creates a batch, and the notification can be read', async ({
    page
  }) => {
    await uiSignIn(page, 'inspector');
    await expect(page.getByTestId('notification-bell')).toBeVisible();
    await expect(page.getByTestId('notification-bell-count')).toHaveCount(0);
    // Give the live connection a moment to open before the event happens
    await page.waitForTimeout(1000);

    const factoryToken = await apiLogin('factory_mgr');
    const batch = await createBatchAs(factoryToken);
    createdBatchIds.push(batch.id);

    // No reload: the stream pushes the event, the toast shows, and the bell count appears
    await expect(page.getByText(`New batch ${batch.batchCode}`).first()).toBeVisible();
    await expect(page.getByTestId('notification-bell-count')).toHaveText('1');

    await page.getByTestId('notification-bell').click();
    await expect(page).toHaveURL('/notifications');
    await expect(page.getByTestId('notifications-list')).toContainText(batch.batchCode);
    await expect(page.getByTestId('notifications-list')).not.toContainText('HiddenPIIFarmerP10');
    const serious = (await new AxeBuilder({ page }).analyze()).violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    );
    expect(serious).toEqual([]);

    await page.getByTestId('notifications-read-all-btn').click();
    await expect(page.getByTestId('notification-bell-count')).toHaveCount(0);
  });

  test('P10-E2E-02: the person who created the batch is not notified about it', async () => {
    const factoryToken = await apiLogin('factory_mgr');
    const batch = await createBatchAs(factoryToken);
    createdBatchIds.push(batch.id);

    // Match on the batch id: earlier suites' cleanup scripts reset the batch-code counter, so codes repeat
    const mine = await api<{ data: { items: Array<{ refId?: string }> } }>(factoryToken, 'GET', '/api/v1/notifications');
    expect(mine.data.items.some((n) => n.refId === batch.id)).toBe(false);

    const inspectorToken = await apiLogin('inspector');
    const theirs = await api<{ data: { items: Array<{ refId?: string }> } }>(inspectorToken, 'GET', '/api/v1/notifications');
    expect(theirs.data.items.some((n) => n.refId === batch.id)).toBe(true);
  });
});
