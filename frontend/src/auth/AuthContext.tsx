import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiRequest, registerUnauthorizedHandler } from '../api/client';
import type { LoginResponseDto, UserSummaryDto } from '../api/types';
import { clearToken, getToken, setToken, subscribeTokenChange } from './tokenStore';
import { sanitizeNextPath } from './RequireAuth';

interface AuthContextValue {
  user: UserSummaryDto | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<UserSummaryDto>;
  setAuthenticatedSession: (token: string, user: UserSummaryDto) => void;
  logout: () => void;
  logoutAll: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const PUBLIC_AUTH_PATHS = new Set([
  '/login',
  '/request-access',
  '/activate',
  '/verify-otp',
  '/forgot-password',
  '/reset-password'
]);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  const token = useSyncExternalStore(subscribeTokenChange, getToken, () => null);

  // Data fetching exclusively through TanStack Query hooks, never useEffect (Part D)
  const meQuery = useQuery({
    queryKey: ['auth', 'me', token],
    queryFn: async () => {
      const res = await apiRequest<UserSummaryDto>('/api/v1/auth/me', {
        method: 'GET'
      });
      return res.data;
    },
    enabled: Boolean(token),
    retry: false,
    staleTime: 60_000
  });

  useEffect(() => {
    registerUnauthorizedHandler((_code, _message) => {
      queryClient.removeQueries({ queryKey: ['auth', 'me'] });
      const currentPath = `${location.pathname}${location.search}`;
      if (!PUBLIC_AUTH_PATHS.has(location.pathname)) {
        const safeNext = sanitizeNextPath(currentPath);
        const query = safeNext && safeNext !== '/' ? `?next=${encodeURIComponent(safeNext)}` : '';
        navigate(`/login${query}`, { replace: true });
      }
    });
    return () => {
      registerUnauthorizedHandler(null);
    };
  }, [location.pathname, location.search, navigate, queryClient]);

  const setAuthenticatedSession = useCallback(
    (newToken: string, user: UserSummaryDto) => {
      setToken(newToken);
      queryClient.setQueryData(['auth', 'me', newToken], user);
    },
    [queryClient]
  );

  const login = useCallback(
    async (username: string, password: string): Promise<UserSummaryDto> => {
      const res = await apiRequest<LoginResponseDto>('/api/v1/auth/login', {
        method: 'POST',
        body: { username, password },
        skipAuth: true,
        skipUnauthorizedRedirect: true
      });
      const jwt = res.data.token;
      const user = res.data.user;
      if (!jwt || !user) {
        throw new Error('Malformed login response from server.');
      }
      setAuthenticatedSession(jwt, user);
      return user;
    },
    [setAuthenticatedSession]
  );

  const logout = useCallback(() => {
    clearToken();
    queryClient.removeQueries({ queryKey: ['auth', 'me'] });
    navigate('/login', { replace: true });
  }, [navigate, queryClient]);

  const logoutAll = useCallback(async () => {
    try {
      await apiRequest('/api/v1/auth/me/logout-all', {
        method: 'POST',
        skipUnauthorizedRedirect: true
      });
    } finally {
      clearToken();
      queryClient.removeQueries({ queryKey: ['auth', 'me'] });
      navigate('/login', { replace: true });
    }
  }, [navigate, queryClient]);

  const refreshSession = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
  }, [queryClient]);

  const user = token ? (meQuery.data ?? null) : null;
  const isLoading = Boolean(token) && meQuery.isPending;
  const isAuthenticated = Boolean(token && user);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated,
        login,
        setAuthenticatedSession,
        logout,
        logoutAll,
        refreshSession
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
