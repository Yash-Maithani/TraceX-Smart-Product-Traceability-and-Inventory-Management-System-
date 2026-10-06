import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './hooks/useTheme';
import { ErrorBoundary, Spinner, ToastProvider } from './components/ui';
import { AuthProvider } from './auth/AuthContext';
import { RequireAuth } from './auth/RequireAuth';
import { RequireRole } from './auth/RequireRole';
import { AppShell } from './layouts/AppShell';
import {
  ActivatePage,
  ArchivedBatchesPage,
  BatchDetailPage,
  BatchesPage,
  DashboardPage,
  FefoPage,
  ForgotPasswordPage,
  ImportPage,
  InspectionsPage,
  LoginPage,
  LegacyTracePage,
  NotFoundPage,
  PrivacyPage,
  ProfilePage,
  PublicTracePage,
  RequestAccessPage,
  ResetPasswordPage,
  TermsPage,
  VerifyOtpPage
} from './pages';

const DevStyleguidePage = import.meta.env.DEV
  ? lazy(() => import('./features/styleguide/StyleguidePage'))
  : null;

const defaultQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false
    }
  }
});

export function App({ queryClient = defaultQueryClient }: { queryClient?: QueryClient }) {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ToastProvider>
            <BrowserRouter>
              <AuthProvider>
                <Routes>
                  {/* Public Authentication & Onboarding Routes */}
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/request-access" element={<RequestAccessPage />} />
                  <Route path="/activate" element={<ActivatePage />} />
                  <Route path="/verify-otp" element={<VerifyOtpPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />

                  {/* Public Trace Routes (Phase 7 Token-Based & Legacy Deprecation) */}
                  <Route path="/trace/t/:token" element={<PublicTracePage />} />
                  <Route path="/trace/:code" element={<LegacyTracePage />} />
                  <Route path="/privacy" element={<PrivacyPage />} />
                  <Route path="/terms" element={<TermsPage />} />

                  {/* Dev-Only Styleguide Route (Dead-Code Eliminated in Production Builds) */}
                  {import.meta.env.DEV && DevStyleguidePage ? (
                    <Route
                      path="/_styleguide"
                      element={
                        <Suspense fallback={<Spinner size="lg" label="Loading…" />}>
                          <DevStyleguidePage />
                        </Suspense>
                      }
                    />
                  ) : null}

                  {/* Protected Application Shell Routes (Phase 6–8 Core Screens) */}
                  <Route
                    element={
                      <RequireAuth>
                        <AppShell />
                      </RequireAuth>
                    }
                  >
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/batches" element={<BatchesPage />} />
                    <Route
                      path="/batches/new"
                      element={
                        <RequireRole endpoint={{ method: 'POST', path: '/api/v1/batches' }}>
                          <BatchesPage openCreateInitially />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/batches/archived"
                      element={
                        <RequireRole endpoint={{ method: 'GET', path: '/api/v1/batches/archived' }}>
                          <ArchivedBatchesPage />
                        </RequireRole>
                      }
                    />
                    <Route path="/batches/:id" element={<BatchDetailPage />} />
                    <Route
                      path="/import"
                      element={
                        <RequireRole endpoint={{ method: 'GET', path: '/api/v1/import/schema' }}>
                          <ImportPage />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/fefo"
                      element={
                        <RequireRole endpoint={{ method: 'GET', path: '/api/v1/dispatch/fefo' }}>
                          <FefoPage />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/inspections"
                      element={
                        <RequireRole endpoint={{ method: 'GET', path: '/api/v1/inspections' }}>
                          <InspectionsPage />
                        </RequireRole>
                      }
                    />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/settings" element={<ProfilePage />} />
                  </Route>

                  {/* 404 Catch-All */}
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </AuthProvider>
            </BrowserRouter>
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
