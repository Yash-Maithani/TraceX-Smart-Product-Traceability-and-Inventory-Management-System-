import { clearToken, getToken } from '../auth/tokenStore';
import { logger } from '../lib/logger';
import { STRINGS } from '../strings/en';
import type { ApiErrorPayload, ApiSuccessEnvelope, FieldErrorItem } from './types';

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly fieldErrors: FieldErrorItem[];
  public readonly requestId: string | undefined;

  constructor(params: {
    status: number;
    code: string;
    message: string;
    fieldErrors?: FieldErrorItem[] | undefined;
    requestId?: string | undefined;
  }) {
    super(params.message);
    this.name = 'ApiError';
    this.status = params.status;
    this.code = params.code;
    this.fieldErrors = params.fieldErrors ?? [];
    this.requestId = params.requestId;
  }
}

export { ApiError as ApiClientError };

export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (!raw || raw.trim() === '') {
    return '';
  }
  return raw.trim().replace(/\/+$/, '');
}

type UnauthorizedHandler = (code: string, message: string) => void;
let onUnauthorizedCallback: UnauthorizedHandler | null = null;

export function registerUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  onUnauthorizedCallback = handler;
}

type NetworkStatusListener = (reachable: boolean) => void;
const networkListeners = new Set<NetworkStatusListener>();
let backendReachable = true;

export function getBackendReachable(): boolean {
  return backendReachable;
}

export function setBackendReachable(reachable: boolean): void {
  if (backendReachable !== reachable) {
    backendReachable = reachable;
    for (const listener of networkListeners) {
      listener(reachable);
    }
  }
}

export function subscribeNetworkStatus(listener: NetworkStatusListener): () => void {
  networkListeners.add(listener);
  return () => {
    networkListeners.delete(listener);
  };
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  skipAuth?: boolean;
  skipUnauthorizedRedirect?: boolean;
}

const SESSION_INVALIDATING_CODES = new Set([
  'AUTH_NO_TOKEN',
  'AUTH_INVALID_TOKEN',
  'AUTH_SESSION_REVOKED',
  'AUTH_ACCOUNT_DELETED',
  'AUTH_ACCOUNT_INACTIVE'
]);

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<ApiSuccessEnvelope<T>> {
  const baseUrl = getApiBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${baseUrl}${normalizedPath}`;

  const headers = new Headers(options.headers);
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  if (options.body !== undefined && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (!options.skipAuth) {
    const token = getToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      body:
        options.body === undefined
          ? null
          : options.body instanceof FormData
            ? options.body
            : JSON.stringify(options.body)
    });
    setBackendReachable(true);
  } catch (err) {
    setBackendReachable(false);
    logger.warn('Network error during API request', { path: normalizedPath, error: String(err) });
    throw new ApiError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'Unable to reach the TraceX server. Check your network connection and try again.'
    });
  }

  let parsedBody: unknown = null;
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      parsedBody = await response.json();
    } catch {
      parsedBody = null;
    }
  }

  if (!response.ok) {
    const errPayload = (parsedBody ?? {}) as Partial<ApiErrorPayload>;
    const code =
      errPayload.code ??
      (response.status === 429
        ? 'RATE_LIMITED'
        : response.status === 403
          ? 'RBAC_INSUFFICIENT'
          : response.status === 401
            ? 'AUTH_INVALID_TOKEN'
            : 'INTERNAL_ERROR');

    let message = errPayload.error ?? `Request failed with status ${response.status}`;
    if (code === 'RATE_LIMITED' && !errPayload.error) {
      message = STRINGS.auth.rateLimitedBanner;
    } else if (code === 'AUTH_ACCOUNT_INACTIVE' && !errPayload.error) {
      message = STRINGS.auth.deactivatedBanner;
    }

    const fieldErrors = Array.isArray(errPayload.fieldErrors) ? errPayload.fieldErrors : [];
    const requestId = errPayload.requestId ?? response.headers.get('X-Request-Id') ?? undefined;

    if (
      !options.skipUnauthorizedRedirect &&
      (response.status === 401 || (response.status === 403 && code === 'AUTH_ACCOUNT_INACTIVE')) &&
      SESSION_INVALIDATING_CODES.has(code)
    ) {
      clearToken(code === 'AUTH_ACCOUNT_INACTIVE' ? 'deactivated' : 'expired');
      if (onUnauthorizedCallback) {
        onUnauthorizedCallback(code, message);
      }
    }

    throw new ApiError({
      status: response.status,
      code,
      message,
      fieldErrors,
      requestId
    });
  }

  const envelope = parsedBody as ApiSuccessEnvelope<T>;
  return envelope;
}
