import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../hooks/useTheme';
import { ToastProvider } from '../../components/ui';
import { AuthProvider } from '../../auth/AuthContext';
import {
  ActivatePage,
  ForgotPasswordPage,
  NotFoundPage,
  PrivacyPage,
  ResetPasswordPage,
  TermsPage,
  VerifyOtpPage
} from '../../pages';
import { LegacyTracePage } from './LegacyTracePage';

function renderPublicRoute(initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={[initialEntry]}>
            <AuthProvider>
              <Routes>
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/terms" element={<TermsPage />} />
                <Route path="/trace/:code" element={<LegacyTracePage />} />
                <Route path="/activate" element={<ActivatePage />} />
                <Route path="/verify-otp" element={<VerifyOtpPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/" element={<div data-testid="home-landed">Home</div>} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </AuthProvider>
          </MemoryRouter>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

describe('PublicPages and Auth Recovery Success Paths', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders PrivacyPage, TermsPage, LegacyTracePage, and NotFoundPage', () => {
    const { unmount: u1 } = renderPublicRoute('/privacy');
    expect(screen.getByRole('heading', { name: /Privacy Policy/i })).toBeInTheDocument();
    u1();

    const { unmount: u2 } = renderPublicRoute('/terms');
    expect(screen.getByRole('heading', { name: /Terms of Use/i })).toBeInTheDocument();
    u2();

    const { unmount: u3 } = renderPublicRoute('/trace/TX-2026-10-001');
    expect(screen.getByText(/TX-2026-10-001/i)).toBeInTheDocument();
    expect(screen.getByText(/Direct batch code lookup URLs have been deprecated/i)).toBeInTheDocument();
    u3();

    const { unmount: u4 } = renderPublicRoute('/non-existent-route');
    expect(screen.getByRole('heading', { level: 1, name: /Page not found/i })).toBeInTheDocument();
    u4();
  });

  it('submits ActivatePage and VerifyOtpPage successfully', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: { email: 'asha@tracex.demo', message: 'OTP sent' }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              token: 'jwt-verified-123',
              user: {
                id: 'u-1',
                name: 'Asha Rao',
                username: 'asha.rao',
                email: 'asha@tracex.demo',
                role: 'dispatch-coordinator'
              }
            }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

    renderPublicRoute('/activate?token=valid-invite-token');
    fireEvent.change(screen.getByLabelText(/^New Password/i), {
      target: { value: 'StrongPass123!' }
    });
    fireEvent.change(screen.getByLabelText(/Confirm Password/i), {
      target: { value: 'StrongPass123!' }
    });
    fireEvent.click(screen.getByRole('button', { name: /Activate Account/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/Verification Code/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Verification Code/i), {
      target: { value: '123456' }
    });
    fireEvent.click(screen.getByRole('button', { name: /Verify and Sign In/i }));

    await waitFor(() => {
      expect(screen.getByTestId('home-landed')).toBeInTheDocument();
    });
  });

  it('submits ForgotPasswordPage and ResetPasswordPage successfully', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: { message: 'Reset OTP sent' }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: { resetToken: 'rst-tok-123' }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: { message: 'Password reset complete' }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

    renderPublicRoute('/forgot-password');
    fireEvent.change(screen.getByLabelText(/Email Address/i), {
      target: { value: 'asha@tracex.demo' }
    });
    fireEvent.click(screen.getByRole('button', { name: /Send Reset Code/i }));

    await waitFor(() => {
      expect(screen.getByTestId('forgot-password-success')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Continue to Reset Password/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/Verification Code/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Verification Code/i), {
      target: { value: '654321' }
    });
    fireEvent.click(screen.getByRole('button', { name: /Verify Reset Code/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/^New Password/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/^New Password/i), {
      target: { value: 'NewResetPass123!' }
    });
    fireEvent.change(screen.getByLabelText(/Confirm Password/i), {
      target: { value: 'NewResetPass123!' }
    });
    fireEvent.click(screen.getByRole('button', { name: /Reset Password/i }));

    await waitFor(() => {
      expect(screen.getByTestId('reset-password-success')).toBeInTheDocument();
    });
  });
});
