import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { startE2eBackend, stopE2eBackend } from './backendServer';
import { BACKDROP_KEYS } from '../src/routes/backdrops';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOT_DIR = path.resolve(__dirname, '../../docs/screenshots/phase-05-1');
const SEED_PASSWORD = process.env.E2E_SEED_PASSWORD ?? 'E2ePass123456!';

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

test.describe('Phase 5.1 E2E Verification Suite (Checks 3–9: Per-Page Photo Backdrops)', () => {
  test.beforeAll(async () => {
    await startE2eBackend();
  });

  test.afterAll(async () => {
    await stopE2eBackend();
  });

  test('P51-E2E-01 (Check 3): Styleguide renders all 14 backdrop keys in banner, side, and full variants in light and dark themes with zero broken images', async ({
    page
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/_styleguide');

    for (const mode of ['light', 'dark'] as const) {
      await page.evaluate((m) => {
        document.documentElement.setAttribute('data-theme', m);
      }, mode);

      for (const variant of ['banner', 'side', 'full'] as const) {
        for (const key of BACKDROP_KEYS) {
          const testId = `sg-backdrop-${variant}-${key}`;
          const locator = page.getByTestId(testId);
          await expect(locator).toBeVisible();

          const imgState = await locator.locator('img').evaluate((img: HTMLImageElement) => ({
            complete: img.complete,
            naturalWidth: img.naturalWidth,
            alt: img.getAttribute('alt'),
            ariaHidden: img.getAttribute('aria-hidden'),
            decoding: img.getAttribute('decoding')
          }));

          expect(
            imgState.complete && imgState.naturalWidth > 0,
            `Broken image for ${testId} in ${mode} mode`
          ).toBe(true);
          expect(imgState.alt).toBe('');
          expect(imgState.ariaHidden).toBe('true');
          expect(imgState.decoding).toBe('async');
        }
      }

      const shotName = `styleguide-14-keys-${mode}-1280.png`;
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, shotName),
        fullPage: true
      });
      console.log(
        `[P51-E2E-01] mode=${mode} verified=42 backdrop instances (14 keys x 3 variants), brokenImages=0, screenshot=${shotName}`
      );
    }
  });

  test('P51-E2E-02 (Check 4): Auth pages at 375px, 768px, and 1280px switch layout cleanly, have no horizontal scroll, and save screenshots with images on, images off, and images blocked', async ({
    browser
  }) => {
    const viewports = [
      { width: 375, height: 812, expectedMediaHeight: 96 },
      { width: 768, height: 1024, expectedMediaHeight: 160 },
      { width: 1280, height: 800, expectedLeftRatio: 0.55 }
    ] as const;

    const authPages = [
      { route: '/login', slug: 'login', key: 'auth' },
      { route: '/forgot-password', slug: 'forgot-password', key: 'auth-recovery' }
    ] as const;

    // 1. Images ON
    const ctxOn = await browser.newContext();
    const pageOn = await ctxOn.newPage();
    for (const ap of authPages) {
      for (const vp of viewports) {
        await pageOn.setViewportSize({ width: vp.width, height: vp.height });
        await pageOn.goto(ap.route);

        const metrics = await pageOn.evaluate((key) => {
          const media = document.querySelector(
            `[data-testid="backdrop-side-media-${key}"]`
          ) as HTMLElement;
          const root = document.querySelector(
            `[data-testid="page-backdrop-side-${key}"]`
          ) as HTMLElement;
          const mediaRect = media.getBoundingClientRect();
          const rootRect = root.getBoundingClientRect();
          return {
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
            mediaWidth: Math.round(mediaRect.width),
            mediaHeight: Math.round(mediaRect.height),
            rootWidth: Math.round(rootRect.width),
            imagesActive: root.getAttribute('data-images-active')
          };
        }, ap.key);

        expect(metrics.scrollWidth <= metrics.clientWidth).toBe(true);
        expect(metrics.imagesActive).toBe('true');

        if ('expectedMediaHeight' in vp) {
          expect(metrics.mediaHeight).toBe(vp.expectedMediaHeight);
        } else {
          expect(Math.abs(metrics.mediaWidth / metrics.rootWidth - vp.expectedLeftRatio)).toBeLessThan(
            0.02
          );
        }

        const fileName = `auth-${ap.slug}-images-on-${vp.width}.png`;
        await pageOn.screenshot({
          path: path.join(SCREENSHOT_DIR, fileName),
          fullPage: true
        });
        console.log(
          `[P51-E2E-02 ON] route=${ap.route} vp=${vp.width} -> scrollWidth=${metrics.scrollWidth} clientWidth=${metrics.clientWidth} media=${metrics.mediaWidth}x${metrics.mediaHeight} screenshot=${fileName}`
        );
      }
    }
    await ctxOn.close();

    // 2. Images OFF (showPageImages = false)
    const ctxOff = await browser.newContext();
    const pageOff = await ctxOff.newPage();
    await pageOff.goto('/login');
    await pageOff.evaluate(() => {
      window.localStorage.setItem(
        'tx_ui_prefs',
        JSON.stringify({
          palette: 'editorial',
          mode: 'light',
          modeSource: 'manual',
          accent: 'auto',
          sidebarCollapsed: false,
          showPageImages: false
        })
      );
    });
    for (const ap of authPages) {
      for (const vp of viewports) {
        await pageOff.setViewportSize({ width: vp.width, height: vp.height });
        await pageOff.goto(ap.route);

        const metrics = await pageOff.evaluate((key) => {
          const root = document.querySelector(
            `[data-testid="page-backdrop-side-${key}"]`
          ) as HTMLElement;
          return {
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
            imagesActive: root.getAttribute('data-images-active'),
            imgCount: root.querySelectorAll('img').length
          };
        }, ap.key);

        expect(metrics.scrollWidth <= metrics.clientWidth).toBe(true);
        expect(metrics.imagesActive).toBe('false');
        expect(metrics.imgCount).toBe(0);

        const fileName = `auth-${ap.slug}-images-off-${vp.width}.png`;
        await pageOff.screenshot({
          path: path.join(SCREENSHOT_DIR, fileName),
          fullPage: true
        });
        console.log(
          `[P51-E2E-02 OFF] route=${ap.route} vp=${vp.width} -> scrollWidth=${metrics.scrollWidth} clientWidth=${metrics.clientWidth} imgCount=${metrics.imgCount} screenshot=${fileName}`
        );
      }
    }
    await ctxOff.close();

    // 3. Images BLOCKED (network abort)
    const ctxBlocked = await browser.newContext();
    const pageBlocked = await ctxBlocked.newPage();
    await pageBlocked.route(/\.(avif|webp|jpg)(\?.*)?$/i, (route) => route.abort());
    for (const ap of authPages) {
      for (const vp of viewports) {
        await pageBlocked.setViewportSize({ width: vp.width, height: vp.height });
        await pageBlocked.goto(ap.route);

        await expect(pageBlocked.getByTestId(`page-backdrop-side-${ap.key}`)).toHaveAttribute(
          'data-images-active',
          'false'
        );

        const metrics = await pageBlocked.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth
        }));
        expect(metrics.scrollWidth <= metrics.clientWidth).toBe(true);

        const fileName = `auth-${ap.slug}-images-blocked-${vp.width}.png`;
        await pageBlocked.screenshot({
          path: path.join(SCREENSHOT_DIR, fileName),
          fullPage: true
        });
        console.log(
          `[P51-E2E-02 BLOCKED] route=${ap.route} vp=${vp.width} -> scrollWidth=${metrics.scrollWidth} clientWidth=${metrics.clientWidth} screenshot=${fileName}`
        );
      }
    }
    await ctxBlocked.close();
  });

  test('P51-E2E-03 (Check 5): axe-core passes with zero serious or critical violations on auth pages, home page, public trace page, and styleguide in both themes with images on and off', async ({
    page
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });

    const publicRoutesToScan = [
      '/login',
      '/request-access',
      '/activate?token=sample-token',
      '/verify-otp?email=demo%40tracex.demo',
      '/forgot-password',
      '/reset-password?email=demo%40tracex.demo',
      '/trace/sample-qr-token',
      '/_styleguide'
    ] as const;

    const runScanPass = async (routePath: string, imagesOn: boolean) => {
      await page.goto(routePath);
      for (const mode of ['light', 'dark'] as const) {
        await page.evaluate(
          ({ m, show }) => {
            window.localStorage.setItem(
              'tx_ui_prefs',
              JSON.stringify({
                palette: 'editorial',
                mode: m,
                modeSource: 'manual',
                accent: 'auto',
                sidebarCollapsed: false,
                showPageImages: show
              })
            );
            document.documentElement.setAttribute('data-theme', m);
          },
          { m: mode, show: imagesOn }
        );
        await page.reload();

        const results = await new AxeBuilder({ page }).analyze();
        const seriousOrCritical = results.violations.filter(
          (v) => v.impact === 'serious' || v.impact === 'critical'
        );
        console.log(
          `[P51-E2E-03 AXE] route=${routePath} mode=${mode} imagesOn=${imagesOn} -> critical=${
            results.violations.filter((v) => v.impact === 'critical').length
          } serious=${results.violations.filter((v) => v.impact === 'serious').length}`
        );
        expect(
          seriousOrCritical,
          `axe violations on ${routePath} (mode=${mode}, imagesOn=${imagesOn})`
        ).toEqual([]);
      }
    };

    for (const routePath of publicRoutesToScan) {
      await runScanPass(routePath, true);
      await runScanPass(routePath, false);
    }

    // Sign in and scan '/' (home page) and '/admin-check' in both themes with images on and off
    await page.goto('/login');
    await page.getByLabel('Username').fill('superadmin');
    await page.getByLabel(/^Password/).fill(SEED_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/');

    await runScanPass('/', true);
    await runScanPass('/', false);
    await runScanPass('/batches/archived', true);
    await runScanPass('/batches/archived', false);
  });

  test('P51-E2E-04 (Check 6): With image requests blocked, auth pages and the home page render on the flat fallback with identical element heights (zero layout shift)', async ({
    browser
  }) => {
    const viewports = [
      { width: 375, height: 812 },
      { width: 768, height: 1024 },
      { width: 1280, height: 800 }
    ] as const;

    // Measure heights with images ON
    const ctxOn = await browser.newContext();
    const pageOn = await ctxOn.newPage();

    // Measure heights with images BLOCKED
    const ctxBlocked = await browser.newContext();
    const pageBlocked = await ctxBlocked.newPage();
    await pageBlocked.route(/\.(avif|webp|jpg)(\?.*)?$/i, (route) => route.abort());

    for (const vp of viewports) {
      await pageOn.setViewportSize(vp);
      await pageBlocked.setViewportSize(vp);

      await pageOn.goto('/login');
      await pageBlocked.goto('/login');
      await expect(pageBlocked.getByTestId('page-backdrop-side-auth')).toHaveAttribute(
        'data-images-active',
        'false'
      );

      const loginOnHeights = await pageOn.evaluate(() => ({
        backdrop: Math.round(
          document.querySelector('[data-testid="page-backdrop-side-auth"]')!.getBoundingClientRect()
            .height
        ),
        media: Math.round(
          document.querySelector('[data-testid="backdrop-side-media-auth"]')!.getBoundingClientRect()
            .height
        ),
        main: Math.round(document.getElementById('main-content')!.getBoundingClientRect().height)
      }));

      const loginBlockedHeights = await pageBlocked.evaluate(() => ({
        backdrop: Math.round(
          document.querySelector('[data-testid="page-backdrop-side-auth"]')!.getBoundingClientRect()
            .height
        ),
        media: Math.round(
          document.querySelector('[data-testid="backdrop-side-media-auth"]')!.getBoundingClientRect()
            .height
        ),
        main: Math.round(document.getElementById('main-content')!.getBoundingClientRect().height)
      }));

      console.log(
        `[P51-E2E-04 LOGIN vp=${vp.width}] on=${JSON.stringify(loginOnHeights)} blocked=${JSON.stringify(loginBlockedHeights)}`
      );
      expect(loginBlockedHeights).toEqual(loginOnHeights);
    }

    // Sign in on both contexts and compare Home page ('/') heights across viewports
    await pageOn.goto('/login');
    await pageOn.getByLabel('Username').fill('superadmin');
    await pageOn.getByLabel(/^Password/).fill(SEED_PASSWORD);
    await pageOn.getByRole('button', { name: 'Sign in' }).click();
    await expect(pageOn).toHaveURL('/');

    await pageBlocked.goto('/login');
    await pageBlocked.getByLabel('Username').fill('superadmin');
    await pageBlocked.getByLabel(/^Password/).fill(SEED_PASSWORD);
    await pageBlocked.getByRole('button', { name: 'Sign in' }).click();
    await expect(pageBlocked).toHaveURL('/');

    for (const vp of viewports) {
      await pageOn.setViewportSize(vp);
      await pageBlocked.setViewportSize(vp);
      await pageOn.goto('/');
      await pageBlocked.goto('/');

      await expect(pageOn.getByTestId('dashboard-summary-ready')).toBeVisible();
      await expect(pageBlocked.getByTestId('dashboard-summary-ready')).toBeVisible();
      await expect(pageBlocked.getByTestId('page-backdrop-banner-dashboard')).toHaveAttribute(
        'data-images-active',
        'false'
      );

      const homeOnHeights = await pageOn.evaluate(() => ({
        header: Math.round(
          document.querySelector('[data-testid="page-header"]')!.getBoundingClientRect().height
        ),
        banner: Math.round(
          document
            .querySelector('[data-testid="page-backdrop-banner-dashboard"]')!
            .getBoundingClientRect().height
        ),
        main: Math.round(document.getElementById('main-content')!.getBoundingClientRect().height)
      }));

      const homeBlockedHeights = await pageBlocked.evaluate(() => ({
        header: Math.round(
          document.querySelector('[data-testid="page-header"]')!.getBoundingClientRect().height
        ),
        banner: Math.round(
          document
            .querySelector('[data-testid="page-backdrop-banner-dashboard"]')!
            .getBoundingClientRect().height
        ),
        main: Math.round(document.getElementById('main-content')!.getBoundingClientRect().height)
      }));

      console.log(
        `[P51-E2E-04 HOME vp=${vp.width}] on=${JSON.stringify(homeOnHeights)} blocked=${JSON.stringify(homeBlockedHeights)}`
      );
      expect(homeBlockedHeights).toEqual(homeOnHeights);

      if (vp.width === 1280) {
        await pageOn.screenshot({
          path: path.join(SCREENSHOT_DIR, 'home-images-on-1280.png'),
          fullPage: true
        });
        await pageBlocked.screenshot({
          path: path.join(SCREENSHOT_DIR, 'home-images-blocked-1280.png'),
          fullPage: true
        });
      }
    }

    await ctxOn.close();
    await ctxBlocked.close();
  });

  test('P51-E2E-05 (Check 7): Turning showPageImages off in user menu or styleguide removes all picture/img elements, makes zero image requests on navigation, and survives reload', async ({
    page
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // 1. Styleguide toggle
    await page.goto('/_styleguide');
    await expect(page.getByTestId('sg-backdrops-section')).toBeVisible();
    expect(await page.locator('picture').count()).toBe(42);

    await page.getByTestId('styleguide-page-images-toggle').click();
    expect(await page.locator('picture').count()).toBe(0);
    expect(await page.locator('img[data-backdrop-key]').count()).toBe(0);

    // Reload and confirm preference survives
    const imageRequestsAfterToggle: string[] = [];
    page.on('request', (req) => {
      if (/\.(avif|webp|jpg)(\?.*)?$/i.test(req.url())) {
        imageRequestsAfterToggle.push(req.url());
      }
    });

    await page.reload();
    expect(await page.locator('picture').count()).toBe(0);
    expect(imageRequestsAfterToggle).toEqual([]);

    // Navigate to /login, /forgot-password, /trace/sample-qr-token while off -> zero image requests
    await page.goto('/login');
    expect(await page.locator('picture').count()).toBe(0);
    await page.goto('/forgot-password');
    expect(await page.locator('picture').count()).toBe(0);
    await page.goto('/trace/sample-qr-token');
    expect(await page.locator('picture').count()).toBe(0);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'trace-public-images-off-1280.png'),
      fullPage: true
    });
    expect(imageRequestsAfterToggle).toEqual([]);

    // 2. Sign in, toggle ON then OFF in the user menu, verify reload and navigation
    await page.goto('/login');
    await page.getByLabel('Username').fill('superadmin');
    await page.getByLabel(/^Password/).fill(SEED_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'home-images-off-1280.png'),
      fullPage: true
    });

    // Turn back ON in user menu
    await page.getByTestId('user-menu-page-images-toggle').click();
    expect(await page.locator('picture').count()).toBe(1);

    // Turn OFF in user menu
    await page.getByTestId('user-menu-page-images-toggle').click();
    expect(await page.locator('picture').count()).toBe(0);

    imageRequestsAfterToggle.length = 0;
    await page.reload();
    expect(await page.locator('picture').count()).toBe(0);
    await page.goto('/batches/archived');
    expect(await page.locator('picture').count()).toBe(0);
    expect(imageRequestsAfterToggle).toEqual([]);

    console.log(
      `[P51-E2E-05] showPageImages toggle verified in styleguide and user menu: imageRequestsWhenOff=${imageRequestsAfterToggle.length}`
    );
  });

  test('P51-E2E-06 (Check 8): Sending Save-Data: on header makes zero backdrop image requests', async ({
    browser
  }) => {
    const context = await browser.newContext({
      extraHTTPHeaders: {
        'Save-Data': 'on'
      }
    });
    const page = await context.newPage();

    const imageRequests: string[] = [];
    page.on('request', (req) => {
      if (/\.(avif|webp|jpg)(\?.*)?$/i.test(req.url())) {
        imageRequests.push(req.url());
      }
    });

    await page.goto('/login');
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-save-data'))).toBe(
      'on'
    );
    expect(await page.locator('picture').count()).toBe(0);

    await page.goto('/forgot-password');
    expect(await page.locator('picture').count()).toBe(0);

    await page.goto('/trace/sample-qr-token');
    expect(await page.locator('picture').count()).toBe(0);

    await page.goto('/_styleguide');
    expect(await page.locator('picture').count()).toBe(0);

    console.log(
      `[P51-E2E-06] Save-Data: on verified across /login, /forgot-password, /trace/sample-qr-token, /_styleguide -> imageRequests=${imageRequests.length}`
    );
    expect(imageRequests).toEqual([]);

    await context.close();
  });

  test('P51-E2E-07 (Check 9): /login fresh load transfers <= 300 KB of backdrop image bytes (for auth only) and requests no other key', async ({
    browser
  }) => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 }
    });
    const page = await context.newPage();

    const loadedImages: { url: string; status: number; bytes: number }[] = [];
    page.on('response', async (res) => {
      const url = res.url();
      if (/\.(avif|webp|jpg)(\?.*)?$/i.test(url)) {
        const body = await res.body().catch(() => Buffer.alloc(0));
        loadedImages.push({
          url,
          status: res.status(),
          bytes: body.byteLength
        });
      }
    });

    await page.goto('/login', { waitUntil: 'networkidle' });

    const totalBytes = loadedImages.reduce((acc, item) => acc + item.bytes, 0);
    console.log(
      `[P51-E2E-07] /login fresh load image responses=${JSON.stringify(loadedImages)} totalBytes=${totalBytes} (${(
        totalBytes / 1024
      ).toFixed(2)} KB)`
    );

    expect(loadedImages.length).toBeGreaterThanOrEqual(1);
    expect(totalBytes).toBeLessThanOrEqual(300 * 1024);

    for (const img of loadedImages) {
      expect(img.url).toMatch(/\/auth-(640|1280|1920).*?\.(avif|webp|jpg)/i);
      expect(img.url).not.toMatch(/\/auth-recovery-/i);
      for (const otherKey of BACKDROP_KEYS) {
        if (otherKey !== 'auth') {
          expect(img.url).not.toContain(`/${otherKey}-`);
        }
      }
    }

    // Also capture trace-public with images on for completeness
    await page.goto('/trace/sample-qr-token', { waitUntil: 'networkidle' });
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'trace-public-images-on-1280.png'),
      fullPage: true
    });

    await context.close();
  });
});
