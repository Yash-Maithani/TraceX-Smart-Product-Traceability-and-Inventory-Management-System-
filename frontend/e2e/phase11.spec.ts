import { expect, test, type Page } from '@playwright/test';
import { startE2eBackend, stopE2eBackend } from './backendServer';

const E2E_API_BASE = 'http://localhost:8083';
const SEED_PASSWORD = process.env.E2E_SEED_PASSWORD ?? 'E2ePass123456!';

async function apiLogin(username: string): Promise<string> {
  const res = await fetch(`${E2E_API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: SEED_PASSWORD })
  });
  const body = (await res.json()) as { data?: { token?: string } };
  if (!body.data?.token) throw new Error(`API login failed for ${username}`);
  return body.data.token;
}

async function uiSignIn(page: Page, username: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel(/^Password/).fill(SEED_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/');
}

/**
 * Phase 11 without keys: the e2e profile blanks GEMINI_API_KEY, NVIDIA_API_KEY and GOOGLE_CLIENT_ID,
 * so both features must stay out of sight and the API must refuse cleanly. The real providers are
 * covered by AiAuditTests and GoogleSignInTests with fakes.
 */
test.describe('Phase 11 AI Audit and Google Sign-in (switched off) E2E Suite', () => {
  test.beforeAll(async () => {
    await startE2eBackend();
  });

  test.afterAll(async () => {
    await stopE2eBackend();
  });

  test('P11-E2E-01: with no keys the AI panel and Google buttons are hidden and the API answers 503', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByTestId('login-google-section')).toHaveCount(0);

    await uiSignIn(page, 'coordinator');
    await page.goto('/fefo');
    await expect(page.getByRole('heading', { name: 'FEFO Dispatch Queue' }).first()).toBeVisible();
    await expect(page.getByTestId('ai-audit-panel')).toHaveCount(0);
    await page.goto('/profile');
    await expect(page.getByTestId('profile-google-card')).toHaveCount(0);

    const token = await apiLogin('coordinator');
    const status = (await (await fetch(`${E2E_API_BASE}/api/v1/ai/status`, { headers: { Authorization: `Bearer ${token}` } })).json()) as {
      data: { enabled: boolean };
    };
    expect(status.data.enabled).toBe(false);
    const audit = await fetch(`${E2E_API_BASE}/api/v1/ai/dispatch-audit`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    expect(audit.status).toBe(503);
    const google = await fetch(`${E2E_API_BASE}/api/v1/auth/google/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: 'not-a-real-token' })
    });
    expect(google.status).toBe(503);
  });
});
