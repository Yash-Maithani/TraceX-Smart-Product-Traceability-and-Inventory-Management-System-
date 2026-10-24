import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { PageBackdrop, PageHeader, PageImagesToggle } from './index';
import { ThemeProvider } from '../../hooks/useTheme';
import {
  BACKDROP_KEYS,
  BACKDROP_KEY_ROUTES,
  getBackdropVariantForKey,
  resolveBackdropKeyForPath,
  SIGNED_IN_PAGE_BANNERS
} from '../../routes/backdrops';
// @ts-expect-error mjs script import for manifest check verification
import { validateBackdropManifest } from '../../../scripts/check-backdrops.mjs';
// @ts-expect-error mjs script import for contrast check verification
import { runContrastChecks } from '../../../scripts/check-contrast.mjs';
// @ts-expect-error mjs script import for banned pattern verification
import { scanDirectoryForBannedPatterns } from '../../../scripts/check-banned-patterns.mjs';

describe('Phase 5.1 Per-Page Photo Backdrops (Parts B, C & D)', () => {
  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-save-data');
  });

  it('renders PageBackdrop in banner, side, and full variants with decorative attributes, priority, and zero vitest-axe violations', async () => {
    const { container: bannerContainer } = render(
      <ThemeProvider>
        <PageBackdrop backdropKey="dashboard" variant="banner">
          <h1>Dashboard Banner</h1>
          <p>Operational overview</p>
        </PageBackdrop>
      </ThemeProvider>
    );

    const bannerRoot = screen.getByTestId('page-backdrop-banner-dashboard');
    expect(bannerRoot).toHaveAttribute('data-backdrop-variant', 'banner');
    expect(bannerRoot).toHaveAttribute('data-images-active', 'true');

    const bannerPicture = screen.getByTestId('backdrop-picture-dashboard');
    expect(bannerPicture).toHaveAttribute('aria-hidden', 'true');
    const bannerSources = bannerPicture.querySelectorAll('source');
    expect(bannerSources.length).toBe(2);
    expect(bannerSources[0]).toHaveAttribute('type', 'image/avif');
    expect(bannerSources[0]?.getAttribute('srcset')).toContain('640w');
    expect(bannerSources[0]?.getAttribute('srcset')).toContain('1280w');
    expect(bannerSources[0]?.getAttribute('srcset')).toContain('1920w');
    expect(bannerSources[1]).toHaveAttribute('type', 'image/webp');

    const bannerImg = bannerPicture.querySelector('img');
    expect(bannerImg).not.toBeNull();
    expect(bannerImg).toHaveAttribute('alt', '');
    expect(bannerImg).toHaveAttribute('aria-hidden', 'true');
    expect(bannerImg).toHaveAttribute('decoding', 'async');
    expect(bannerImg?.getAttribute('fetchpriority')?.toLowerCase()).toBe('high');
    expect(bannerImg).toHaveAttribute('width', '1920');
    expect(bannerImg).toHaveAttribute('height', '1080');

    expect(await axe(bannerContainer)).toHaveNoViolations();

    const { container: sideContainer } = render(
      <ThemeProvider>
        <PageBackdrop backdropKey="auth" variant="side">
          <h1>Sign in to TraceX</h1>
          <p>Enter your credentials</p>
        </PageBackdrop>
      </ThemeProvider>
    );

    const sideRoot = screen.getByTestId('page-backdrop-side-auth');
    expect(sideRoot).toHaveAttribute('data-backdrop-variant', 'side');
    const sideImg = screen.getByTestId('backdrop-picture-auth').querySelector('img');
    expect(sideImg?.getAttribute('fetchpriority')?.toLowerCase()).toBe('high');
    expect(sideImg?.getAttribute('sizes')).toBe('(min-width: 1024px) 55vw, 100vw');
    expect(await axe(sideContainer)).toHaveNoViolations();

    const { container: fullContainer } = render(
      <ThemeProvider>
        <PageBackdrop backdropKey="trace-public" variant="full">
          <h1>Public Batch Traceability</h1>
          <p>Verified batch origin</p>
        </PageBackdrop>
      </ThemeProvider>
    );

    const fullRoot = screen.getByTestId('page-backdrop-full-trace-public');
    expect(fullRoot).toHaveAttribute('data-backdrop-variant', 'full');
    const fullImg = screen.getByTestId('backdrop-picture-trace-public').querySelector('img');
    expect(fullImg?.getAttribute('fetchpriority')?.toLowerCase()).toBe('low');
    expect(await axe(fullContainer)).toHaveNoViolations();
  });

  it('falls back to flat surface token when the backdrop image errors', () => {
    render(
      <ThemeProvider>
        <PageBackdrop backdropKey="batches" variant="banner">
          <h1>Batches</h1>
        </PageBackdrop>
      </ThemeProvider>
    );

    const root = screen.getByTestId('page-backdrop-banner-batches');
    expect(root).toHaveAttribute('data-images-active', 'true');
    const img = screen.getByTestId('backdrop-picture-batches').querySelector('img')!;
    fireEvent.error(img);

    expect(root).toHaveAttribute('data-images-active', 'false');
    expect(screen.queryByTestId('backdrop-picture-batches')).toBeNull();
  });

  it('requests no image when showPageImages is off or when Save-Data is on', () => {
    const { unmount } = render(
      <ThemeProvider>
        <PageImagesToggle testId="test-toggle-images" />
        <PageBackdrop backdropKey="fefo" variant="banner">
          <h1>FEFO</h1>
        </PageBackdrop>
      </ThemeProvider>
    );

    expect(screen.getByTestId('backdrop-picture-fefo')).toBeInTheDocument();

    // Toggle showPageImages off
    fireEvent.click(screen.getByTestId('test-toggle-images'));
    expect(screen.queryByTestId('backdrop-picture-fefo')).toBeNull();
    expect(screen.getByTestId('page-backdrop-banner-fefo')).toHaveAttribute(
      'data-images-active',
      'false'
    );

    unmount();

    // Reset prefs to showPageImages: true, but enable Save-Data on html attribute
    window.localStorage.clear();
    document.documentElement.setAttribute('data-save-data', 'on');

    render(
      <ThemeProvider>
        <PageBackdrop backdropKey="inspections" variant="banner">
          <h1>Inspections</h1>
        </PageBackdrop>
      </ThemeProvider>
    );

    expect(screen.queryByTestId('backdrop-picture-inspections')).toBeNull();
    expect(screen.getByTestId('page-backdrop-banner-inspections')).toHaveAttribute(
      'data-images-active',
      'false'
    );
  });

  it('verifies route-to-key map covers all 14 keys and resolves exact, parameterized, and fallback paths', () => {
    expect(BACKDROP_KEYS).toHaveLength(14);
    for (const key of BACKDROP_KEYS) {
      expect(BACKDROP_KEY_ROUTES[key].length).toBeGreaterThan(0);
    }

    expect(resolveBackdropKeyForPath('/login')).toBe('auth');
    expect(resolveBackdropKeyForPath('/request-access')).toBe('auth');
    expect(resolveBackdropKeyForPath('/activate?token=abc')).toBe('auth');
    expect(resolveBackdropKeyForPath('/verify-otp')).toBe('auth');
    expect(resolveBackdropKeyForPath('/forgot-password')).toBe('auth-recovery');
    expect(resolveBackdropKeyForPath('/reset-password')).toBe('auth-recovery');
    expect(resolveBackdropKeyForPath('/')).toBe('dashboard');
    expect(resolveBackdropKeyForPath('/dashboard')).toBe('dashboard');
    expect(resolveBackdropKeyForPath('/batches')).toBe('batches');
    expect(resolveBackdropKeyForPath('/batches/new')).toBe('batches');
    expect(resolveBackdropKeyForPath('/batches/archived')).toBe('batches');
    expect(resolveBackdropKeyForPath('/batches/batch-001')).toBe('batches');
    expect(resolveBackdropKeyForPath('/fefo')).toBe('fefo');
    expect(resolveBackdropKeyForPath('/inspections')).toBe('inspections');
    expect(resolveBackdropKeyForPath('/dispatch')).toBe('dispatch');
    expect(resolveBackdropKeyForPath('/qr')).toBe('qr');
    expect(resolveBackdropKeyForPath('/trace/tok-123')).toBe('trace-public');
    expect(resolveBackdropKeyForPath('/trace/t/tok-123')).toBe('trace-public');
    expect(resolveBackdropKeyForPath('/team')).toBe('team');
    expect(resolveBackdropKeyForPath('/users')).toBe('team');
    expect(resolveBackdropKeyForPath('/import')).toBe('import');
    expect(resolveBackdropKeyForPath('/notifications')).toBe('notifications');
    expect(resolveBackdropKeyForPath('/profile')).toBe('settings');
    expect(resolveBackdropKeyForPath('/settings')).toBe('settings');
    expect(resolveBackdropKeyForPath('/privacy')).toBe('default');
    expect(resolveBackdropKeyForPath('/unknown-route')).toBe('default');

    expect(getBackdropVariantForKey('auth')).toBe('side');
    expect(getBackdropVariantForKey('auth-recovery')).toBe('side');
    expect(getBackdropVariantForKey('trace-public')).toBe('full');
    expect(getBackdropVariantForKey('dashboard')).toBe('banner');
  });

  it('renders PageHeader with backdropKey using the photo banner (D-20 reopened) and passes vitest-axe', async () => {
    const { container } = render(
      <ThemeProvider>
        <PageHeader
          title="Warehouse Dispatch"
          subtitle="FEFO-verified outbound shipments"
          breadcrumbs={[{ label: 'Operations' }, { label: 'Dispatch' }]}
          backdropKey="dispatch"
        />
      </ThemeProvider>
    );

    // Photo banners are on for signed-in pages (D-20 reopened in redesign R4)
    expect(SIGNED_IN_PAGE_BANNERS).toBe(true);
    expect(screen.getByTestId('page-backdrop-banner-dispatch')).toBeInTheDocument();
    expect(screen.getByTestId('page-header')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Warehouse Dispatch' })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('check-backdrops (redesign R4): accepts licensed photos, rejects placeholders, missing licences and unrecorded AI images', () => {
    const validEntries = BACKDROP_KEYS.map((key) => ({
      key,
      routes: [...BACKDROP_KEY_ROUTES[key]],
      source: 'Wikimedia Commons: Example',
      author: 'Example Photographer',
      licence: 'CC BY-SA 4.0',
      licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      approvedByOwner: true,
      objectPosition: 'center center',
      placeholder: false,
      aiGenerated: false
    }));

    const routeSet = new Set(Object.keys(BACKDROP_KEY_ROUTES));
    const validResult = validateBackdropManifest(validEntries, routeSet) as {
      errors: string[];
      warnings: string[];
    };
    expect(validResult.errors).toEqual([]);
    expect(validResult.warnings).toHaveLength(0);

    const plant = (key: string, change: Record<string, unknown>) =>
      validEntries.map((entry) => (entry.key === key ? { ...entry, ...change } : entry));

    // A placeholder is now an error, not a warning
    const placeholderResult = validateBackdropManifest(plant('qr', { placeholder: true }), routeSet) as { errors: string[] };
    expect(placeholderResult.errors.some((e) => e.includes('still a placeholder'))).toBe(true);

    // Missing licence, licence URL and owner approval
    const invalidResult = validateBackdropManifest(
      plant('dashboard', { licence: '', licenceUrl: '', approvedByOwner: false }),
      routeSet
    ) as { errors: string[] };
    expect(invalidResult.errors.some((e) => e.includes('missing a non-empty "licence"'))).toBe(true);
    expect(invalidResult.errors.some((e) => e.includes('missing a valid "licenceUrl"'))).toBe(true);
    expect(invalidResult.errors.some((e) => e.includes('"approvedByOwner": true'))).toBe(true);

    // AI images need the owner exception plus a tool and prompt record
    const aiResult = validateBackdropManifest(plant('team', { aiGenerated: true }), routeSet) as { errors: string[] };
    expect(aiResult.errors.some((e) => e.includes('AI-generated key'))).toBe(true);
    const aiOk = validateBackdropManifest(
      plant('team', { aiGenerated: true, aiTool: 'Example tool', aiPrompt: 'Example prompt' }),
      routeSet
    ) as { errors: string[] };
    expect(aiOk.errors).toEqual([]);
  });

  it('fails contrast check when backdrop scrim opacity is lowered too far over a pure white pixel', () => {
    const tokensPath = path.resolve(process.cwd(), 'src/styles/tokens.css');
    const originalCss = fs.readFileSync(tokensPath, 'utf8');
    const weakenedCss = originalCss.replace(
      '--backdrop-scrim: rgba(20, 20, 19, 0.66);',
      '--backdrop-scrim: rgba(20, 20, 19, 0.25);'
    );

    const result = runContrastChecks(weakenedCss) as {
      failures: number;
      results: { status: string; label: string }[];
    };
    expect(result.failures).toBeGreaterThan(0);
    expect(
      result.results.some(
        (r) => r.status === 'FAIL' && r.label.includes('banner-title on scrim over #ffffff')
      )
    ).toBe(true);
  });

  it('rejects hotlinked http/https image URLs, blur, and fixed background attachment in check-banned-patterns', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tracex-p51-banned-'));
    const tmpSrc = path.join(tmpDir, 'src');
    const tmpDesign = path.join(tmpDir, 'design-assets');
    fs.mkdirSync(tmpSrc, { recursive: true });
    fs.mkdirSync(tmpDesign, { recursive: true });

    fs.writeFileSync(
      path.join(tmpSrc, 'BadBackdrop.tsx'),
      'export const Bad = () => <img src="https://images.example.com/photo.jpg" alt="" />;',
      'utf8'
    );
    fs.writeFileSync(
      path.join(tmpSrc, 'BadBackdrop.module.css'),
      '.glass { backdrop-filter: blur(8px); background-attachment: fixed; }',
      'utf8'
    );

    try {
      const violations = scanDirectoryForBannedPatterns(tmpDir) as string[];
      expect(violations.some((v) => v.includes('Banned hotlinked http/https image URL'))).toBe(
        true
      );
      expect(violations.some((v) => v.includes('backdrop-filter'))).toBe(true);
      expect(violations.some((v) => v.includes('Banned parallax'))).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

