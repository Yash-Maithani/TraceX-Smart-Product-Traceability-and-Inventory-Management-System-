import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { waitForDevEmail } from './mailHelper';
import { startE2eBackend, stopE2eBackend } from './backendServer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOT_DIR = path.resolve(__dirname, '../../docs/screenshots/phase-05');
const E2E_API_BASE = 'http://localhost:8083';
const SEED_PASSWORD = process.env.E2E_SEED_PASSWORD ?? 'E2ePass123456!';

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const SEEDED_ROLES = [
  {
    username: 'superadmin',
    expectedName: '[DEMO] Super Administrator',
    expectedRole: 'Administrator',
    isSuperAdmin: true
  },
  {
    username: 'admin',
    expectedName: '[DEMO] Staff Administrator',
    expectedRole: 'Administrator',
    isSuperAdmin: false
  },
  {
    username: 'manager',
    expectedName: '[DEMO] Operations Manager',
    expectedRole: 'Manager',
    isSuperAdmin: false
  },
  {
    username: 'factory_mgr',
    expectedName: '[DEMO] Factory Manager',
    expectedRole: 'Factory Manager',
    isSuperAdmin: false
  },
  {
    username: 'inspector',
    expectedName: '[DEMO] Quality Inspector',
    expectedRole: 'Quality Inspector',
    isSuperAdmin: false
  },
  {
    username: 'coordinator',
    expectedName: '[DEMO] Dispatch Coordinator',
    expectedRole: 'Dispatch Coordinator',
    isSuperAdmin: false
  }
] as const;

const PUBLIC_ROUTES = [
  '/login',
  '/request-access',
  '/activate?token=sample-token',
  '/verify-otp?email=demo%40tracex.demo',
  '/forgot-password',
  '/reset-password?email=demo%40tracex.demo',
  '/trace/sample-qr-token',
  '/privacy',
  '/terms',
  '/_styleguide'
] as const;

const AUTH_ROUTES = ['/', '/batches/archived'] as const;

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

test.describe('Phase 5 E2E Verification Suite (E1–E6 / Checks 5–14)', () => {
  test.beforeAll(async () => {
    await startE2eBackend();
  });

  test.afterAll(async () => {
    await stopE2eBackend();
  });

  test('E2E-01 (Check 5 & Check 13): Login for all six seeded accounts (five roles plus super-admin) and verify sessionStorage tx_token and console hygiene', async ({
    page
  }) => {
    const consoleMessages: string[] = [];
    page.on('console', (msg) => {
      consoleMessages.push(msg.text());
    });

    for (const account of SEEDED_ROLES) {
      await page.goto('/login');
      await page.getByLabel('Username').fill(account.username);
      await page.getByLabel(/^Password/).fill(SEED_PASSWORD);
      await page.getByRole('button', { name: 'Sign in' }).click();

      await expect(page).toHaveURL('/');
      await expect(page.getByTestId('home-user-name')).toHaveText(account.expectedName);
      await expect(page.getByTestId('home-user-role')).toHaveText(account.expectedRole);

      const storageBeforeLogout = await page.evaluate(() => ({
        sessionStorage: Object.fromEntries(
          Object.entries(window.sessionStorage).map(([k, v]) => [
            k,
            k === 'tx_token' ? `${v.slice(0, 12)}... (len=${v.length})` : v
          ])
        ),
        sessionKeys: Object.keys(window.sessionStorage),
        txToken: window.sessionStorage.getItem('tx_token'),
        localStorage: Object.fromEntries(Object.entries(window.localStorage)),
        localKeys: Object.keys(window.localStorage),
        localTxToken: window.localStorage.getItem('tx_token'),
        cookies: document.cookie
      }));

      expect(storageBeforeLogout.sessionKeys).toEqual(['tx_token']);
      expect(storageBeforeLogout.txToken).toBeTruthy();
      expect(storageBeforeLogout.localTxToken).toBeNull();
      expect(storageBeforeLogout.cookies).toBe('');

      const joinedConsole = consoleMessages.join('\n');
      expect(joinedConsole).not.toContain(storageBeforeLogout.txToken!);
      expect(joinedConsole).not.toContain(SEED_PASSWORD);

      console.log(
        `[E2E-01 BEFORE_LOGOUT] user=${account.username} sessionStorage=${JSON.stringify(storageBeforeLogout.sessionStorage)} localStorage=${JSON.stringify(storageBeforeLogout.localStorage)} cookie=${JSON.stringify(storageBeforeLogout.cookies)}`
      );

      await page.getByTestId('sign-out-btn').click();
      await expect(page).toHaveURL('/login');
      const storageAfterLogout = await page.evaluate(() => ({
        sessionStorage: Object.fromEntries(Object.entries(window.sessionStorage)),
        txToken: window.sessionStorage.getItem('tx_token'),
        localStorage: Object.fromEntries(Object.entries(window.localStorage)),
        localTxToken: window.localStorage.getItem('tx_token'),
        cookies: document.cookie
      }));
      console.log(
        `[E2E-01 AFTER_LOGOUT]  user=${account.username} sessionStorage=${JSON.stringify(storageAfterLogout.sessionStorage)} localStorage=${JSON.stringify(storageAfterLogout.localStorage)} cookie=${JSON.stringify(storageAfterLogout.cookies)}`
      );
      expect(storageAfterLogout.txToken).toBeNull();
      expect(Object.keys(storageAfterLogout.sessionStorage)).toEqual([]);
    }
  });

  test('E2E-02 (Check 5): Login failure with wrong password displays the server error message', async ({
    page
  }) => {
    await page.goto('/login');
    await page.getByLabel('Username').fill('superadmin');
    await page.getByLabel(/^Password/).fill('WrongPassword999!');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByTestId('login-error-banner')).toHaveText('Invalid username or password');
  });

  test('E2E-03 (Check 6): Full invite onboarding flow (request access, approve via API, read invite from dev mail sink, activate, read OTP, verify, land signed in)', async ({
    page
  }) => {
    const uniqueSuffix = Date.now().toString().slice(-5);
    const applicantName = `AshaVerma${uniqueSuffix} Rao`;
    const applicantEmail = `asha.${uniqueSuffix}@tracex.demo`;
    const initialPass = 'InvitePass12345!';

    await page.goto('/request-access');
    await page.getByLabel(/Full Name/i).fill(applicantName);
    await page.getByLabel(/Email Address/i).fill(applicantEmail);
    await page.getByLabel(/^Role/i).selectOption('dispatch-coordinator');
    await page.getByRole('button', { name: /Submit Request/i }).click();
    await expect(page.getByTestId('request-access-success')).toBeVisible();

    const adminToken = await apiLogin('superadmin');
    const listRes = await fetch(`${E2E_API_BASE}/api/v1/auth/requests`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const listBody = (await listRes.json()) as {
      data?: Array<{ id: string; email: string; status: string }>;
    };
    const pendingReq = listBody.data?.find(
      (r) => r.email.toLowerCase() === applicantEmail.toLowerCase() && r.status === 'pending'
    );
    expect(pendingReq).toBeDefined();

    const approveRes = await fetch(`${E2E_API_BASE}/api/v1/auth/requests/${pendingReq!.id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect(approveRes.ok).toBe(true);

    const inviteMail = await waitForDevEmail(applicantEmail, 'invite');
    expect(inviteMail.inviteToken).toBeTruthy();

    await page.goto(`/activate?token=${encodeURIComponent(inviteMail.inviteToken!)}`);
    await page.getByLabel(/^New Password/i).fill(initialPass);
    await page.getByLabel(/Confirm Password/i).fill(initialPass);
    await page.getByRole('button', { name: /Activate Account/i }).click();

    await expect(page).toHaveURL(/\/verify-otp/);
    const otpMail = await waitForDevEmail(applicantEmail, 'activation-otp');
    expect(otpMail.otp).toMatch(/^\d{6}$/);

    await page.getByLabel(/Verification Code/i).fill(otpMail.otp!);
    await page.getByRole('button', { name: /Verify and Sign In/i }).click();

    await expect(page).toHaveURL('/');
    await expect(page.getByTestId('home-user-name')).toHaveText(applicantName);
    await expect(page.getByTestId('home-user-role')).toHaveText('Dispatch Coordinator');
    const derivedUsername = (await page.getByTestId('home-user-username').textContent())?.trim() ?? '';
    expect(derivedUsername.length).toBeGreaterThan(0);

    await page.getByTestId('sign-out-btn').click();
    await expect(page).toHaveURL('/login');

    await page.getByLabel('Username').fill(derivedUsername);
    await page.getByLabel(/^Password/).fill(initialPass);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/');
    await page.getByTestId('sign-out-btn').click();
  });

  test('E2E-04 (Check 6): Forgot and reset password flow end-to-end in browser', async ({
    page
  }) => {
    const uniqueSuffix = Date.now().toString().slice(-5);
    const resetApplicantName = `RohanMehta${uniqueSuffix} Nair`;
    const resetApplicantEmail = `rohan.${uniqueSuffix}@tracex.demo`;
    const initialPass = 'InitialPass12345!';
    const resetPass = 'ResetPass67890!';

    // Provision active user via request -> approve -> activate -> verify-otp
    await page.goto('/request-access');
    await page.getByLabel(/Full Name/i).fill(resetApplicantName);
    await page.getByLabel(/Email Address/i).fill(resetApplicantEmail);
    await page.getByLabel(/^Role/i).selectOption('quality-inspector');
    await page.getByRole('button', { name: /Submit Request/i }).click();
    await expect(page.getByTestId('request-access-success')).toBeVisible();

    const adminToken = await apiLogin('superadmin');
    const listRes = await fetch(`${E2E_API_BASE}/api/v1/auth/requests`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const listBody = (await listRes.json()) as {
      data?: Array<{ id: string; email: string; status: string }>;
    };
    const pendingReq = listBody.data?.find(
      (r) => r.email.toLowerCase() === resetApplicantEmail.toLowerCase() && r.status === 'pending'
    );
    expect(pendingReq).toBeDefined();

    await fetch(`${E2E_API_BASE}/api/v1/auth/requests/${pendingReq!.id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    const inviteMail = await waitForDevEmail(resetApplicantEmail, 'invite');
    await page.goto(`/activate?token=${encodeURIComponent(inviteMail.inviteToken!)}`);
    await page.getByLabel(/^New Password/i).fill(initialPass);
    await page.getByLabel(/Confirm Password/i).fill(initialPass);
    await page.getByRole('button', { name: /Activate Account/i }).click();

    await expect(page).toHaveURL(/\/verify-otp/);
    const otpMail = await waitForDevEmail(resetApplicantEmail, 'activation-otp');
    await page.getByLabel(/Verification Code/i).fill(otpMail.otp!);
    await page.getByRole('button', { name: /Verify and Sign In/i }).click();
    await expect(page).toHaveURL('/');
    const derivedUsername = (await page.getByTestId('home-user-username').textContent())?.trim() ?? '';
    await page.getByTestId('sign-out-btn').click();

    // Forgot password -> read reset OTP -> verify reset OTP -> reset password -> login with new password
    await page.goto('/forgot-password');
    await page.getByLabel(/Email Address/i).fill(resetApplicantEmail);
    await page.getByRole('button', { name: /Send Reset Code/i }).click();
    await expect(page.getByTestId('forgot-password-success')).toBeVisible();
    await page.getByRole('button', { name: /Continue to Reset Password/i }).click();

    await expect(page).toHaveURL(/\/reset-password/);
    const resetMail = await waitForDevEmail(resetApplicantEmail, 'password-reset-otp');
    expect(resetMail.otp).toMatch(/^\d{6}$/);

    await page.getByLabel(/Verification Code/i).fill(resetMail.otp!);
    await page.getByRole('button', { name: /Verify Reset Code/i }).click();

    await page.getByLabel(/^New Password/i).fill(resetPass);
    await page.getByLabel(/Confirm Password/i).fill(resetPass);
    await page.getByRole('button', { name: /Reset Password/i }).click();
    await expect(page.getByTestId('reset-password-success')).toBeVisible();

    await page.goto('/login');
    await page.getByLabel('Username').fill(derivedUsername);
    await page.getByLabel(/^Password/).fill(resetPass);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/');
    await page.getByTestId('sign-out-btn').click();
  });

  test('E2E-05 (Check 7 & Check 13): 401 mid-session through logout-all in another context clears tx_token, redirects to /login?next=..., returns on sign-in, and blocks external ?next= open redirects', async ({
    page
  }) => {
    await page.goto('/login');
    await page.getByLabel('Username').fill('superadmin');
    await page.getByLabel(/^Password/).fill(SEED_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/');
    await page.goto('/batches/archived');
    await expect(page).toHaveURL('/batches/archived');
    await expect(page.getByRole('heading', { name: 'Archived Batches' })).toBeVisible();

    const storageBefore401 = await page.evaluate(() => ({
      sessionStorage: Object.fromEntries(
        Object.entries(window.sessionStorage).map(([k, v]) => [
          k,
          k === 'tx_token' ? `${v.slice(0, 12)}... (len=${v.length})` : v
        ])
      ),
      rawToken: window.sessionStorage.getItem('tx_token'),
      localStorage: Object.fromEntries(Object.entries(window.localStorage)),
      cookies: document.cookie
    }));
    expect(storageBefore401.rawToken).toBeTruthy();
    console.log(
      `[E2E-05 BEFORE_401] sessionStorage=${JSON.stringify(storageBefore401.sessionStorage)} localStorage=${JSON.stringify(storageBefore401.localStorage)} cookie=${JSON.stringify(storageBefore401.cookies)}`
    );

    // Revoke session from external context
    const revokeRes = await fetch(`${E2E_API_BASE}/api/v1/auth/me/logout-all`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${storageBefore401.rawToken!}` }
    });
    expect(revokeRes.ok).toBe(true);

    // Trigger authenticated API call mid-session
    await page.goto('/batches/archived');
    await expect(page).toHaveURL('/login?next=%2Fbatches%2Farchived');
    await expect(page.getByTestId('session-expired-banner')).toBeVisible();
    const storageAfter401 = await page.evaluate(() => ({
      sessionStorage: Object.fromEntries(Object.entries(window.sessionStorage)),
      rawToken: window.sessionStorage.getItem('tx_token'),
      localStorage: Object.fromEntries(Object.entries(window.localStorage)),
      cookies: document.cookie
    }));
    console.log(
      `[E2E-05 AFTER_401]  sessionStorage=${JSON.stringify(storageAfter401.sessionStorage)} localStorage=${JSON.stringify(storageAfter401.localStorage)} cookie=${JSON.stringify(storageAfter401.cookies)}`
    );
    expect(storageAfter401.rawToken).toBeNull();
    expect(Object.keys(storageAfter401.sessionStorage)).toEqual([]);

    // Sign back in and confirm return to preserved /batches/archived path
    await page.getByLabel('Username').fill('superadmin');
    await page.getByLabel(/^Password/).fill(SEED_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/batches/archived');
    await page.getByTestId('sign-out-btn').click();

    // Open-redirect protection (?next=https://evil.example)
    await page.goto('/login?next=https%3A%2F%2Fevil.example%2Fphish');
    await page.getByLabel('Username').fill('manager');
    await page.getByLabel(/^Password/).fill(SEED_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('http://localhost:5174/');
    await page.getByTestId('sign-out-btn').click();
  });

  test('E2E-06 (Check 7): Deactivated user login displays the deactivated account message', async ({
    page
  }) => {
    const adminToken = await apiLogin('superadmin');
    const usersRes = await fetch(`${E2E_API_BASE}/api/v1/auth/users`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const usersBody = (await usersRes.json()) as {
      data?: Array<{ id: string; username: string; active: boolean }>;
    };
    const coordUser = usersBody.data?.find((u) => u.username === 'coordinator');
    expect(coordUser).toBeDefined();

    await fetch(`${E2E_API_BASE}/api/v1/auth/users/${coordUser!.id}/toggle`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    try {
      await page.goto('/login');
      await page.getByLabel('Username').fill('coordinator');
      await page.getByLabel(/^Password/).fill(SEED_PASSWORD);
      await page.getByRole('button', { name: 'Sign in' }).click();
      await expect(page.getByTestId('login-error-banner')).toContainText(/deactivated/i);
    } finally {
      await fetch(`${E2E_API_BASE}/api/v1/auth/users/${coordUser!.id}/toggle`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
    }
  });

  test('E2E-07 (Check 7): Lower role on restricted route (/batches/archived) sees the 403 forbidden state', async ({
    page
  }) => {
    await page.goto('/login');
    await page.getByLabel('Username').fill('inspector');
    await page.getByLabel(/^Password/).fill(SEED_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/');

    await page.goto('/batches/archived');
    await expect(page).toHaveURL('/batches/archived');
    await expect(page.getByTestId('forbidden-state')).toBeVisible();
    await page.getByTestId('sign-out-btn').click();
  });

  test('E2E-08 (Check 7): Offline banner appears when the real backend is stopped and recovers when restarted', async ({
    page
  }) => {
    await page.goto('/login');
    await page.getByLabel('Username').fill('manager');
    await page.getByLabel(/^Password/).fill(SEED_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/');

    await stopE2eBackend();
    try {
      await page.getByTestId('verify-session-btn').click();
      await expect(page.getByTestId('offline-banner')).toBeVisible();
    } finally {
      await startE2eBackend();
    }

    await page.getByTestId('verify-session-btn').click();
    await expect(page.getByTestId('offline-banner')).toBeHidden();
    await page.getByTestId('sign-out-btn').click();
  });

  test('E2E-09 (Check 8 & Check 9): Keyboard-only login, skip link, dialog focus trap/Escape/restore, theme toggle, and reduced-motion 0s durations', async ({
    page
  }) => {
    await page.goto('/login');

    // Keyboard-only skip link on login page
    await page.keyboard.press('Tab');
    const skipFocused = await page.evaluate(() => document.activeElement?.textContent?.trim());
    expect(skipFocused).toBe('Skip to main content');
    await page.keyboard.press('Enter');
    const mainFocused = await page.evaluate(() => document.activeElement?.id);
    expect(mainFocused).toBe('main-content');

    // Keyboard-only login
    await page.getByLabel('Username').focus();
    await page.keyboard.type('superadmin');
    await page.keyboard.press('Tab');
    await page.keyboard.type(SEED_PASSWORD);
    await page.keyboard.press('Tab'); // Show password button
    await page.keyboard.press('Tab'); // Sign in button
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL('/');

    // Keyboard-only Dialog open, focus trap, Escape, focus return
    const dialogTrigger = page.getByTestId('sign-out-all-btn');
    await dialogTrigger.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const activeInsideDialog = await page.evaluate(() =>
      Boolean(document.activeElement?.closest('[role="dialog"]'))
    );
    expect(activeInsideDialog).toBe(true);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    const returnedTestId = await page.evaluate(() =>
      document.activeElement?.getAttribute('data-testid')
    );
    expect(returnedTestId).toBe('sign-out-all-btn');

    // Keyboard-only theme toggle
    const themeBefore = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    );
    const themeBtn = page.getByRole('button', { name: /Switch to (dark|light) theme/i });
    await themeBtn.focus();
    await page.keyboard.press('Enter');
    const themeAfter = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    );
    expect(themeAfter).not.toBe(themeBefore);

    // Check 9: Emulate reduced motion and assert transitionDuration and animationDuration are 0s
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const durations = await page.evaluate(() => {
      const btn = document.querySelector('button')!;
      const navLink = document.querySelector('nav a')!;
      const btnStyle = window.getComputedStyle(btn);
      const navStyle = window.getComputedStyle(navLink);
      return {
        btnTransition: btnStyle.transitionDuration,
        btnAnimation: btnStyle.animationDuration,
        navTransition: navStyle.transitionDuration,
        navAnimation: navStyle.animationDuration
      };
    });
    console.log(
      `[E2E-09] Reduced motion computed durations -> ${JSON.stringify(durations)}`
    );
    expect(durations).toEqual({
      btnTransition: '0s',
      btnAnimation: '0s',
      navTransition: '0s',
      navAnimation: '0s'
    });
  });

  test('E2E-10 (Check 10 & Check 14): axe-core accessibility scan on every route in light and dark for all three palettes, plus runtime switching and reload persistence', async ({
    page
  }) => {
    // Check 14: System setting default when localStorage is empty
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/login');
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe(
      'dark'
    );

    await page.emulateMedia({ colorScheme: 'light' });
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe(
      'light'
    );

    // Runtime switch and reload persistence
    await page.getByLabel('Color palette').selectOption('obsidian');
    await page.getByRole('button', { name: /Switch to dark theme/i }).click();
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-palette'))).toBe(
      'obsidian'
    );
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe(
      'dark'
    );
    await page.reload();
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-palette'))).toBe(
      'obsidian'
    );
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe(
      'dark'
    );

    const palettes = ['editorial', 'obsidian', 'emerald'] as const;
    const modes = ['light', 'dark'] as const;

    // Disable CSS transition interpolation during rapid palette x mode attribute switching
    await page.emulateMedia({ reducedMotion: 'reduce' });

    const scanRoute = async (routePath: string) => {
      await page.goto(routePath);
      for (const palette of palettes) {
        for (const mode of modes) {
          await page.evaluate(
            ({ p, m }) => {
              document.documentElement.setAttribute('data-palette', p);
              document.documentElement.setAttribute('data-theme', m);
            },
            { p: palette, m: mode }
          );
          const results = await new AxeBuilder({ page }).analyze();
          const counts = {
            critical: results.violations.filter((v) => v.impact === 'critical').length,
            serious: results.violations.filter((v) => v.impact === 'serious').length,
            moderate: results.violations.filter((v) => v.impact === 'moderate').length,
            minor: results.violations.filter((v) => v.impact === 'minor').length
          };
          console.log(
            `[E2E-10 AXE] route=${routePath} palette=${palette} mode=${mode} -> critical=${counts.critical} serious=${counts.serious} moderate=${counts.moderate} minor=${counts.minor}`
          );
          const seriousOrCritical = results.violations.filter(
            (v) => v.impact === 'serious' || v.impact === 'critical'
          );
          expect(
            seriousOrCritical,
            `axe violations on ${routePath} (${palette}/${mode})`
          ).toEqual([]);
        }
      }
    };

    for (const routePath of PUBLIC_ROUTES) {
      await scanRoute(routePath);
    }

    // Authenticated routes ('/' and '/admin-check')
    await page.goto('/login');
    await page.getByLabel('Username').fill('superadmin');
    await page.getByLabel(/^Password/).fill(SEED_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/');

    for (const authRoute of AUTH_ROUTES) {
      await scanRoute(authRoute);
    }
  });

  test('E2E-11 (Check 11): Responsive viewports (375px, 768px, 1280px) scrollWidth and clientWidth measurements on every route, adaptive navigation, and all 36 route screenshots', async ({
    page
  }) => {
    for (const existing of fs.readdirSync(SCREENSHOT_DIR)) {
      if (existing.endsWith('.png')) {
        fs.unlinkSync(path.join(SCREENSHOT_DIR, existing));
      }
    }

    const viewports = [
      { width: 375, height: 812 },
      { width: 768, height: 1024 },
      { width: 1280, height: 800 }
    ];

    const routeSlugMap: Record<string, string> = {
      '/login': '01-login',
      '/request-access': '02-request-access',
      '/activate?token=sample-token': '03-activate',
      '/verify-otp?email=demo%40tracex.demo': '04-verify-otp',
      '/forgot-password': '05-forgot-password',
      '/reset-password?email=demo%40tracex.demo': '06-reset-password',
      '/trace/sample-qr-token': '07-trace',
      '/privacy': '08-privacy',
      '/terms': '09-terms',
      '/_styleguide': '10-styleguide',
      '/': '11-home',
      '/batches/archived': '12-admin-check'
    };

    const measureAndCaptureRouteViewports = async (route: string) => {
      const slug = routeSlugMap[route] ?? route.replace(/[^a-z0-9]+/gi, '-');
      for (const vp of viewports) {
        await page.setViewportSize(vp);
        await page.goto(route);
        const metrics = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          innerWidth: window.innerWidth
        }));
        const fileName = `route-${slug}-${vp.width}.png`;
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, fileName),
          fullPage: true
        });
        console.log(
          `[E2E-11 VIEWPORT] route=${route} viewport=${vp.width}x${vp.height} -> scrollWidth=${metrics.scrollWidth} clientWidth=${metrics.clientWidth} screenshot=${fileName}`
        );
        expect(
          metrics.scrollWidth <= metrics.clientWidth,
          `Horizontal overflow on ${route} at ${vp.width}px: scrollWidth=${metrics.scrollWidth} > clientWidth=${metrics.clientWidth}`
        ).toBe(true);
      }
    };

    for (const route of PUBLIC_ROUTES) {
      await measureAndCaptureRouteViewports(route);
    }

    // Sign in and measure + capture authenticated routes + adaptive navigation breakpoint (<1024px vs >=1024px)
    await page.goto('/login');
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-palette', 'editorial');
      document.documentElement.setAttribute('data-theme', 'light');
    });
    await page.getByLabel('Username').fill('superadmin');
    await page.getByLabel(/^Password/).fill(SEED_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/');

    for (const authRoute of AUTH_ROUTES) {
      await measureAndCaptureRouteViewports(authRoute);
    }

    await page.goto('/');
    // At 1280px: desktop sidebar visible, mobile menu button hidden
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.getByTestId('desktop-sidebar')).toBeVisible();
    await expect(page.getByTestId('mobile-menu-btn')).toBeHidden();

    // At 768px: desktop sidebar hidden, mobile menu button visible
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.getByTestId('desktop-sidebar')).toBeHidden();
    await expect(page.getByTestId('mobile-menu-btn')).toBeVisible();

    // At 375px: desktop sidebar hidden, mobile menu button opens drawer
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.getByTestId('desktop-sidebar')).toBeHidden();
    await expect(page.getByTestId('mobile-menu-btn')).toBeVisible();

    await page.getByTestId('mobile-menu-btn').click();
    await expect(page.getByTestId('mobile-drawer')).toBeVisible();
  });
});

