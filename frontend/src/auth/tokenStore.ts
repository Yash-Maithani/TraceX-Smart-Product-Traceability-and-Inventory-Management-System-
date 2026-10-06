/**
 * Session-scoped JWT token storage (SPEC §7 Token Storage, D-1, Phase 5 Part D).
 * - Stores the JWT exclusively in `sessionStorage` under key `tx_token`.
 * - Never touches `localStorage`, cookies, or URL query parameters, and adds no other keys to `sessionStorage`.
 */

export const TOKEN_STORAGE_KEY = 'tx_token';

type TokenListener = () => void;
const listeners = new Set<TokenListener>();
let pendingAuthReason: string | null = null;

export function getToken(): string | null {
  try {
    return window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    pendingAuthReason = null;
    notifyListeners();
  } catch {
    // Ignore storage errors
  }
}

export function clearToken(reason?: string): void {
  try {
    window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    if (reason) {
      pendingAuthReason = reason;
    }
    notifyListeners();
  } catch {
    // Ignore storage errors
  }
}

export function consumeAuthReason(): string | null {
  const reason = pendingAuthReason;
  pendingAuthReason = null;
  return reason;
}

export function peekAuthReason(): string | null {
  return pendingAuthReason;
}

export function subscribeTokenChange(listener: TokenListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners(): void {
  for (const listener of listeners) {
    listener();
  }
}
