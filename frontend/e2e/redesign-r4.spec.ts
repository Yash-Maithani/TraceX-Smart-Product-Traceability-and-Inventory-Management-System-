import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { startE2eBackend, stopE2eBackend } from './backendServer';

const SEED_PASSWORD = process.env.E2E_SEED_PASSWORD ?? 'E2ePass123456!';

/**
 * Redesign R4.1: a signed-out visitor at `/` sees the public home page, not a jump to sign-in.
 * Signing in still lands on the dashboard at `/`, and signing out returns to sign-in.
 */
test.describe('Redesign R4.1 public home page', () => {
  test.beforeAll(async () => {
    await startE2eBackend();
  });

  test.afterAll(async () => {
    await stopE2eBackend();
  });

  test('R4-E2E-01: guest home page leads to sign-in, and a signed-in user gets the dashboard at /', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page).toHaveURL('/');
    await expect(page.getByTestId('home-page')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Batch traceability for TraceX Technologies');

    for (const width of [1280, 375]) {
      await page.setViewportSize({ width, height: 800 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(overflow).toBe(false);
      for (const mode of ['light', 'dark']) {
        await page.evaluate((m) => document.documentElement.setAttribute('data-theme', m), mode);
        const results = await new AxeBuilder({ page }).analyze();
        const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
        expect(serious.map((v) => v.id)).toEqual([]);
      }
    }

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByTestId('home-hero-request-access').click();
    await expect(page).toHaveURL('/request-access');
    await page.goBack();

    await page.getByTestId('home-hero-sign-in').click();
    await expect(page).toHaveURL('/login');
    await page.getByLabel('Username').fill('manager');
    await page.getByLabel(/^Password/).fill(SEED_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/');
    await expect(page.getByTestId('desktop-sidebar')).toBeVisible();
    await expect(page.getByTestId('home-page')).toHaveCount(0);

    await page.getByTestId('sign-out-btn').click();
    await expect(page).toHaveURL('/login');
  });
});
