import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  clearToken,
  getToken,
  setToken,
  TOKEN_STORAGE_KEY
} from './tokenStore';
import { apiRequest, ApiError, registerUnauthorizedHandler } from '../api/client';
import { RequireAuth, sanitizeNextPath } from './RequireAuth';
import { RequireRole } from './RequireRole';
import { AuthProvider } from './AuthContext';
import { ThemeProvider } from '../hooks/useTheme';
import {
  ActivatePage,
  ForgotPasswordPage,
  LoginPage,
  RequestAccessPage,
  ResetPasswordPage,
  VerifyOtpPage
} from '../pages';

function renderWithAuthRouter(initialEntries: string[] = ['/login']) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MemoryRouter initialEntries={initialEntries}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/request-access" element={<RequestAccessPage />} />
              <Route path="/activate" element={<ActivatePage />} />
              <Route path="/verify-otp" element={<VerifyOtpPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route
                path="/"
                element={
                  <RequireAuth>
                    <div data-testid="protected-home">Home Content</div>
                  </RequireAuth>
                }
              />
              <Route
                path="/admin-check"
                element={
                  <RequireAuth>
                    <RequireRole allowedRoles={['admin']}>
                      <div data-testid="admin-only-view">Admin Content</div>
                    </RequireRole>
                  </RequireAuth>
                }
              />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

describe('API Client, Token Store, Route Guards, and Auth Screens (Part D)', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    registerUnauthorizedHandler(null);
    vi.restoreAllMocks();
  });

  it('stores JWT exclusively in sessionStorage under tx_token and never in localStorage or cookies', () => {
    expect(getToken()).toBeNull();
    setToken('jwt-test-token-123');
    expect(getToken()).toBe('jwt-test-token-123');
    expect(window.sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBe('jwt-test-token-123');
    expect(Object.keys(window.sessionStorage)).toEqual([TOKEN_STORAGE_KEY]);
    expect(window.localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    expect(document.cookie).not.toContain('jwt-test-token-123');

    clearToken();
    expect(getToken()).toBeNull();
    expect(Object.keys(window.sessionStorage)).toEqual([]);
  });

  it('sanitizes ?next= redirect paths and blocks external or protocol-relative URLs', () => {
    expect(sanitizeNextPath('/admin-check')).toBe('/admin-check');
    expect(sanitizeNextPath('/batches?status=URGENT')).toBe('/batches?status=URGENT');
    expect(sanitizeNextPath('https://evil.example/phish')).toBe('/');
    expect(sanitizeNextPath('http://evil.example')).toBe('/');
    expect(sanitizeNextPath('//evil.example/path')).toBe('/');
    expect(sanitizeNextPath('/\\evil.example')).toBe('/');
    expect(sanitizeNextPath('javascript:alert(1)')).toBe('/');
    expect(sanitizeNextPath('/login')).toBe('/');
    expect(sanitizeNextPath(null)).toBe('/');
  });

  it('attaches Authorization header, parses envelope, and maps 401, 403, 429, and network errors', async () => {
    setToken('sample-jwt');
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    // 1. 200 OK
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, data: { ok: true }, requestId: 'req-1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );
    const okRes = await apiRequest<{ ok: boolean }>('/api/v1/auth/me');
    expect(okRes.data.ok).toBe(true);
    const reqHeaders = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(reqHeaders.get('Authorization')).toBe('Bearer sample-jwt');

    // 2. 429 RATE_LIMITED
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          code: 'RATE_LIMITED',
          error: 'Too many login attempts. Please try again later.',
          requestId: 'req-429'
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      )
    );
    await expect(apiRequest('/api/v1/auth/login', { method: 'POST' })).rejects.toMatchObject({
      status: 429,
      code: 'RATE_LIMITED',
      requestId: 'req-429'
    });

    // 3. 401 AUTH_SESSION_REVOKED clears token and invokes handler
    const onUnauth = vi.fn();
    registerUnauthorizedHandler(onUnauth);
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          code: 'AUTH_SESSION_REVOKED',
          error: 'Session has been revoked'
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    );
    await expect(apiRequest('/api/v1/auth/me')).rejects.toBeInstanceOf(ApiError);
    expect(getToken()).toBeNull();
    expect(onUnauth).toHaveBeenCalledWith('AUTH_SESSION_REVOKED', 'Session has been revoked');

    // 4. Network failure
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(apiRequest('/api/v1/auth/me')).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR'
    });
  });

  it('redirects unauthenticated users to /login?next=... and renders ForbiddenState for insufficient role', async () => {
    renderWithAuthRouter(['/admin-check']);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Sign in to TraceX/i })).toBeInTheDocument();
    });

    // Now simulate a signed-in quality-inspector visiting /admin-check
    window.sessionStorage.clear();
    setToken('qi-token');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            id: 'u2',
            username: 'qinspector',
            name: 'Quality Inspector User',
            email: 'qi@tracex.local',
            role: 'quality-inspector',
            active: true,
            superAdmin: false
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    renderWithAuthRouter(['/admin-check']);
    await waitFor(() => {
      expect(screen.getByTestId('forbidden-state')).toBeInTheDocument();
    });
  });

  it('validates LoginPage inputs and displays server error message on invalid credentials', async () => {
    renderWithAuthRouter(['/login']);

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => {
      expect(screen.getByText(/Username or email is required/i)).toBeInTheDocument();
      expect(screen.getByText(/Password is required/i)).toBeInTheDocument();
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          code: 'AUTH_INVALID_CREDENTIALS',
          error: 'Invalid username or password'
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    );

    fireEvent.change(screen.getByLabelText(/Username/i), { target: { value: 'superadmin' } });
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'WrongPass!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(screen.getByTestId('login-error-banner')).toHaveTextContent(
        'Invalid username or password'
      );
    });
  });

  it('validates RequestAccessPage and displays server field errors under matching fields', async () => {
    renderWithAuthRouter(['/request-access']);

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          code: 'VALIDATION_ERROR',
          error: 'Validation failed',
          fieldErrors: [{ field: 'email', message: 'An access request for this email already exists' }]
        }),
        { status: 422, headers: { 'Content-Type': 'application/json' } }
      )
    );

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Asha Rao' } });
    fireEvent.change(screen.getByLabelText(/Email Address/i), {
      target: { value: 'asha@tracex.local' }
    });
    fireEvent.click(screen.getByRole('button', { name: /Submit Request/i }));

    await waitFor(() => {
      expect(
        screen.getByText('An access request for this email already exists')
      ).toBeInTheDocument();
    });
  });

  it('validates ActivatePage password policy (min 8 chars + match) and VerifyOtpPage 6-digit OTP', async () => {
    renderWithAuthRouter(['/activate?token=inv-token-123']);

    fireEvent.change(screen.getByLabelText(/^New Password/i), { target: { value: 'short' } });
    fireEvent.change(screen.getByLabelText(/Confirm Password/i), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: /Activate Account/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Password must be at least 8 characters long/i)
      ).toBeInTheDocument();
    });

    renderWithAuthRouter(['/verify-otp?email=asha%40tracex.local']);
    fireEvent.change(screen.getByLabelText(/Verification Code/i), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: /Verify and Sign In/i }));

    await waitFor(() => {
      expect(screen.getByText(/Enter the 6-digit verification code/i)).toBeInTheDocument();
    });
  });

  it('validates ForgotPasswordPage and ResetPasswordPage two-step reset flow', async () => {
    renderWithAuthRouter(['/forgot-password']);
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'not-an-email' } });
    fireEvent.click(screen.getByRole('button', { name: /Send Reset Code/i }));

    await waitFor(() => {
      expect(screen.getByText(/Enter a valid email address/i)).toBeInTheDocument();
    });

    renderWithAuthRouter(['/reset-password?email=admin%40tracex.local']);
    fireEvent.change(screen.getByLabelText(/Verification Code/i), { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: /Verify Reset Code/i }));

    await waitFor(() => {
      expect(screen.getByText(/Enter the 6-digit verification code/i)).toBeInTheDocument();
    });
  });
});
