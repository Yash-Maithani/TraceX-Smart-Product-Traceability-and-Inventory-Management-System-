import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe } from 'vitest-axe';
import { ThemeProvider } from '../../hooks/useTheme';
import { ToastProvider } from '../../components/ui';
import { AuthProvider } from '../../auth/AuthContext';
import { RequireAuth } from '../../auth/RequireAuth';
import { HomePage } from './HomePage';

function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={[path]}>
            <AuthProvider>
              <Routes>
                <Route path="/login" element={<div data-testid="login-landed">Login</div>} />
                <Route
                  element={
                    <RequireAuth guestHome={<HomePage />}>
                      <div data-testid="app-shell">Shell</div>
                    </RequireAuth>
                  }
                >
                  <Route path="/" element={null} />
                  <Route path="/batches" element={null} />
                </Route>
              </Routes>
            </AuthProvider>
          </MemoryRouter>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

describe('Public home page (redesign R4.1)', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('shows signed-out visitors the home page at / with ways to sign in and request access', async () => {
    const { container } = renderAt('/');
    expect(await screen.findByTestId('home-page')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Batch traceability for TraceX Technologies' })).toBeInTheDocument();
    expect(screen.getByTestId('home-hero-sign-in')).toHaveAttribute('href', '/login');
    expect(screen.getByTestId('home-hero-request-access')).toHaveAttribute('href', '/request-access');
    expect(screen.getByRole('heading', { level: 2, name: 'How it works' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy');
    expect(screen.queryByTestId('app-shell')).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows no numbers or customer claims, only real feature copy', async () => {
    renderAt('/');
    const text = (await screen.findByTestId('home-page')).textContent ?? '';
    // Hard rule 3: the only digits allowed are the step numbers 1 to 4 and the copyright year
    const digits = text.replace(/Copyright \d{4}/, '').match(/\d+/g) ?? [];
    expect(digits.every((d) => ['1', '2', '3', '4'].includes(d))).toBe(true);
    expect(text).not.toMatch(/—/);
  });

  it('still sends signed-out visitors on other protected pages to sign-in', async () => {
    renderAt('/batches');
    expect(await screen.findByTestId('login-landed')).toBeInTheDocument();
    expect(screen.queryByTestId('home-page')).not.toBeInTheDocument();
  });
});
