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

async function api(token: string, method: string, path: string, body?: unknown): Promise<Response> {
  return fetch(`${E2E_API_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? null : JSON.stringify(body)
  });
}

async function uiSignIn(page: Page, username: string, password = SEED_PASSWORD): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/');
}

test.describe('Phase 10.1 Messages and Record Comments E2E Suite', () => {
  const stamp = Date.now();
  const createdMessageIds: string[] = [];

  test.beforeAll(async () => {
    await startE2eBackend();
  });

  test.afterAll(async () => {
    // Soft-delete what this suite posted so later runs start from a readable channel
    const adminToken = await apiLogin('admin');
    for (const id of createdMessageIds) {
      await api(adminToken, 'DELETE', `/api/v1/messages/${id}`);
    }
    await stopE2eBackend();
  });

  test('P101-E2E-01: an admin channel message reaches a super admin live, and the page passes axe', async ({ page, browser }) => {
    const superContext = await browser.newContext();
    const superPage = await superContext.newPage();
    await uiSignIn(superPage, 'superadmin');
    await superPage.goto('/messages');
    await superPage.getByTestId('channel-tab-admin').click();
    await expect(superPage.getByTestId('channel-panel-admin')).toBeVisible();
    await superPage.waitForTimeout(1000);

    await uiSignIn(page, 'admin');
    await page.getByRole('link', { name: 'Messages' }).first().click();
    await expect(page).toHaveURL('/messages');
    // A regular admin has exactly one channel, so there are no tabs
    await expect(page.getByRole('tablist', { name: 'Channels' })).toHaveCount(0);
    const text = `Handover ${stamp}: cold room 2 is full`;
    await page.getByTestId('channel-input').fill(text);
    await page.getByTestId('channel-send-btn').click();
    await expect(page.getByTestId('channel-list')).toContainText(text);

    // No reload on the super admin's side
    await expect(superPage.getByTestId('channel-list')).toContainText(text);
    const serious = (await new AxeBuilder({ page }).analyze()).violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    );
    expect(serious).toEqual([]);
    await superContext.close();

    const token = await apiLogin('admin');
    const feed = (await (await api(token, 'GET', '/api/v1/messages/channel/admin')).json()) as {
      data: Array<{ id: string; body?: string }>;
    };
    createdMessageIds.push(...feed.data.filter((m) => m.body === text).map((m) => m.id));
  });

  test('P101-E2E-02: a comment on a batch is saved on the batch page; coordinators cannot open inspection comments', async ({ page }) => {
    const factoryToken = await apiLogin('factory_mgr');
    const batches = (await (await api(factoryToken, 'GET', '/api/v1/batches?limit=1')).json()) as {
      data: { data: Array<{ id: string }> };
    };
    const batchId = batches.data.data[0]!.id;

    await uiSignIn(page, 'factory_mgr');
    await page.goto(`/batches/${batchId}`);
    const section = page.getByTestId('batch-comments-section');
    await expect(section).toBeVisible();
    const comment = `Held back ${stamp} for the Delhi order`;
    await section.getByTestId('batch-comments-input').fill(comment);
    await section.getByTestId('batch-comments-send-btn').click();
    await expect(section.getByTestId('batch-comments-list')).toContainText(comment);

    await page.reload();
    await expect(page.getByTestId('batch-comments-list')).toContainText(comment);

    const thread = (await (await api(factoryToken, 'GET', `/api/v1/messages/record/batch/${batchId}`)).json()) as {
      data: Array<{ id: string; body?: string }>;
    };
    createdMessageIds.push(...thread.data.filter((m) => m.body === comment).map((m) => m.id));

    const coordinatorToken = await apiLogin('coordinator');
    const inspections = (await (await api(await apiLogin('inspector'), 'GET', '/api/v1/inspections')).json()) as {
      data: { data?: Array<{ id: string }> };
    };
    const inspectionId = inspections.data.data?.[0]?.id;
    if (inspectionId) {
      const res = await api(coordinatorToken, 'GET', `/api/v1/messages/record/inspection/${inspectionId}`);
      expect(res.status).toBe(403);
    }
  });
});
