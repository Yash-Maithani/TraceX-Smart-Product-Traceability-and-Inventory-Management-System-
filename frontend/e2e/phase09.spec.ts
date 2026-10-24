import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { startE2eBackend, stopE2eBackend } from './backendServer';

const E2E_API_BASE = 'http://localhost:8083';
const SEED_PASSWORD = process.env.E2E_SEED_PASSWORD ?? 'E2ePass123456!';
const DEFAULT_SETTINGS = { mode: 'system', palette: 'editorial', accent: 'auto', showPageImages: true };

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

async function seriousViolations(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  return result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
}

test.describe('Phase 9 Team, Settings and Sign-in History E2E Suite', () => {
  const applicantEmail = `p9-e2e-${Date.now()}@example.com`;

  test.beforeAll(async () => {
    await startE2eBackend();
    await fetch(`${E2E_API_BASE}/api/v1/auth/request-access`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Phase Nine Applicant', email: applicantEmail, role: 'quality-inspector' })
    });
  });

  test.afterAll(async () => {
    const adminToken = await apiLogin('admin');
    const list = (await (await api(adminToken, 'GET', '/api/v1/auth/requests')).json()) as {
      data?: Array<{ id: string; email: string }>;
    };
    for (const r of list.data ?? []) {
      if (r.email === applicantEmail) {
        await api(adminToken, 'DELETE', `/api/v1/auth/requests/${r.id}`);
      }
    }
    // Leave the seeded accounts' display settings as defaults for later runs
    for (const username of ['manager', 'coordinator']) {
      await api(await apiLogin(username), 'PATCH', '/api/v1/auth/me/settings', DEFAULT_SETTINGS);
    }
    await stopE2eBackend();
  });

  test('P9-E2E-01: admin approves an access request on the Team page; manager sees the same lists read-only', async ({
    page,
    browser
  }) => {
    await uiSignIn(page, 'admin');
    await page.getByRole('link', { name: 'Team', exact: true }).first().click();
    await expect(page).toHaveURL('/team');
    await expect(page.getByTestId('team-page')).toBeVisible();
    // Admin cannot act on the super admin or on themselves
    await expect(page.getByTestId('team-actions-btn-superadmin')).toHaveCount(0);
    await expect(page.getByTestId('team-actions-btn-admin')).toHaveCount(0);
    await expect(page.getByTestId('team-actions-btn-manager')).toBeVisible();
    await expect(page.getByTestId('team-tab-recycle')).toHaveCount(0);

    await page.getByTestId('team-tab-requests').click();
    await page.getByTestId(`request-approve-btn-${applicantEmail}`).click();
    await expect(page.getByTestId(`request-resend-btn-${applicantEmail}`)).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);

    const managerContext = await browser.newContext();
    const managerPage = await managerContext.newPage();
    await uiSignIn(managerPage, 'manager');
    await managerPage.goto('/team');
    await expect(managerPage.getByTestId('team-page')).toBeVisible();
    await expect(managerPage.getByTestId('team-actions-btn-coordinator')).toHaveCount(0);
    await managerPage.getByTestId('team-tab-requests').click();
    await expect(managerPage.getByText(applicantEmail)).toBeVisible();
    await expect(managerPage.getByTestId(`request-resend-btn-${applicantEmail}`)).toHaveCount(0);
    await managerContext.close();
  });

  test('P9-E2E-02: a role without team access gets the 403 state on /team and has no Team link', async ({ page }) => {
    await uiSignIn(page, 'inspector');
    await expect(page.getByRole('link', { name: 'Team', exact: true })).toHaveCount(0);
    await page.goto('/team');
    await expect(page.getByTestId('forbidden-state')).toBeVisible();
  });

  test('P9-E2E-03: display settings saved in one browser are applied when signing in from another', async ({
    page,
    browser
  }) => {
    await uiSignIn(page, 'coordinator');
    await page.goto('/settings');
    await expect(page.getByTestId('settings-page')).toBeVisible();
    await page.getByTestId('settings-mode-select').selectOption('dark');
    await page.getByTestId('settings-palette-select').selectOption('obsidian');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // Wait until the account has the new settings before opening the second browser
    const token = await apiLogin('coordinator');
    await expect
      .poll(async () => {
        const me = (await (await api(token, 'GET', '/api/v1/auth/me')).json()) as {
          data?: { preferences?: { mode?: string; palette?: string } };
        };
        return `${me.data?.preferences?.mode}/${me.data?.preferences?.palette}`;
      })
      .toBe('dark/obsidian');

    const otherContext = await browser.newContext({ colorScheme: 'light' });
    const otherPage = await otherContext.newPage();
    await uiSignIn(otherPage, 'coordinator');
    await expect(otherPage.locator('html')).toHaveAttribute('data-theme', 'dark');
    await otherPage.goto('/settings');
    await expect(otherPage.getByTestId('settings-palette-select')).toHaveValue('obsidian');
    await otherContext.close();
  });

  test('P9-E2E-04: the Settings page lists this browser sign-in and passes axe', async ({ page }) => {
    await uiSignIn(page, 'factory_mgr');
    await page.goto('/settings');
    const card = page.getByTestId('settings-login-history-card');
    await expect(card.getByTestId('login-history-time').first()).toBeVisible();
    await expect(card.getByText('Chrome').first()).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });
});
