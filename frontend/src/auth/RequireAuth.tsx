/**
 * RequireAuth is a client-side UX guard that only hides UI and redirects unauthenticated
 * browsers to `/login`. It is NOT a security boundary: the backend server stays the sole
 * authority on authentication and authorization for every request (SPEC §7, Phase 5 Part D).
 */
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Spinner } from '../components/ui/Spinner';

/**
 * Sanitizes `?next=` redirect targets to internal relative paths only.
 * Rejects protocol-relative URLs (`//evil.com`), absolute URLs (`https://evil.com`),
 * backslashes, and control characters to prevent open redirects.
 */
export function sanitizeNextPath(raw: string | null | undefined): string {
  if (!raw || typeof raw !== 'string') {
    return '/';
  }
  const trimmed = raw.trim();
  if (
    !trimmed.startsWith('/') ||
    trimmed.startsWith('//') ||
    trimmed.includes('://') ||
    trimmed.includes('\\') ||
    /^\/[^/]*:/.test(trimmed)
  ) {
    return '/';
  }
  if (trimmed.startsWith('/login')) {
    return '/';
  }
  return trimmed;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { token, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <main id="main-content" tabIndex={-1}>
        <Spinner size="lg" label="Verifying session…" />
      </main>
    );
  }

  if (!token || !isAuthenticated) {
    const requestedPath = `${location.pathname}${location.search}`;
    const safeNext = sanitizeNextPath(requestedPath);
    const search = safeNext !== '/' ? `?next=${encodeURIComponent(safeNext)}` : '';
    return <Navigate to={`/login${search}`} replace />;
  }

  return <>{children}</>;
}
