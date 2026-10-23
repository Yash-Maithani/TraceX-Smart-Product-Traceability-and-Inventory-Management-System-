import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PrivacyPage, TermsPage } from './PublicPages';
import { LEGAL_UPDATED, PRIVACY_SECTIONS, TERMS_SECTIONS } from './legalContent';
import { ThemeProvider } from '../../hooks/useTheme';
import { ToastProvider } from '../../components/ui';

function renderPage(ui: React.ReactNode) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ThemeProvider>
        <ToastProvider>
          <MemoryRouter>{ui}</MemoryRouter>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

describe('Legal pages and app icons (Phase 12)', () => {
  it('Privacy Policy lists what is stored, browser storage, retention, and that AI never gets farmer names', () => {
    renderPage(<PrivacyPage />);
    for (const s of PRIVACY_SECTIONS) {
      expect(screen.getByRole('heading', { level: 2, name: s.heading })).toBeInTheDocument();
    }
    const text = screen.getByTestId('privacy-content').textContent ?? '';
    expect(text).toContain('Farmer names are never sent');
    expect(text).toContain('for 30 days');
    expect(text).toContain('session storage');
    expect(text).toContain('No advertising or tracking cookies');
    expect(text).toContain(`Last updated ${LEGAL_UPDATED}`);
  });

  it('Terms and Conditions cover accounts, acceptable use, AI advice, liability, ending access and governing law', () => {
    renderPage(<TermsPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Terms and Conditions' })).toBeInTheDocument();
    for (const s of TERMS_SECTIONS) {
      expect(screen.getByRole('heading', { level: 2, name: s.heading })).toBeInTheDocument();
    }
    expect(screen.getByTestId('terms-content').textContent).toContain('governed by the laws of India');
  });

  it('index.html links the SVG favicon, the ICO fallback and the Apple touch icon, and the files exist', () => {
    const root = path.resolve(__dirname, '../../..');
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    expect(html).toContain('<link rel="icon" href="/favicon.svg" type="image/svg+xml" />');
    expect(html).toContain('<link rel="icon" href="/favicon.ico" sizes="32x32" />');
    expect(html).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png" />');
    for (const f of ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png']) {
      expect(fs.existsSync(path.join(root, 'public', f))).toBe(true);
    }
  });
});
