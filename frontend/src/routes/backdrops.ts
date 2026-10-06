/**
 * Single canonical route-to-backdrop-key map (SPEC §5.2, D-20, Phase 5.1 Part C).
 * Every main page route maps to one of the 14 backdrop keys.
 */

export const BACKDROP_KEYS = [
  'auth',
  'auth-recovery',
  'dashboard',
  'batches',
  'fefo',
  'inspections',
  'dispatch',
  'qr',
  'trace-public',
  'team',
  'import',
  'notifications',
  'settings',
  'default'
] as const;

export type BackdropKey = (typeof BACKDROP_KEYS)[number];

export type BackdropVariant = 'banner' | 'side' | 'full';

export interface RouteBackdropRule {
  pattern: string;
  key: BackdropKey;
  variant: BackdropVariant;
}

/**
 * Authoritative mapping from each backdrop key to the routes that use it.
 * Every key has at least one route mapping.
 */
export const BACKDROP_KEY_ROUTES: Record<BackdropKey, readonly string[]> = {
  'auth': ['/login', '/request-access', '/activate', '/verify-otp'],
  'auth-recovery': ['/forgot-password', '/reset-password'],
  'dashboard': ['/', '/dashboard'],
  'batches': ['/batches', '/batches/new', '/batches/archived', '/batches/:id'],
  'fefo': ['/fefo', '/dispatch/fefo'],
  'inspections': ['/inspections'],
  'dispatch': ['/dispatch'],
  'qr': ['/qr'],
  'trace-public': ['/trace/:token', '/trace/t/:token'],
  'team': ['/team', '/users'],
  'import': ['/import'],
  'notifications': ['/notifications', '/messages'],
  'settings': ['/profile', '/settings'],
  'default': ['/privacy', '/terms', '/_styleguide', '*']
};

export const BACKDROP_KEY_VARIANTS: Record<BackdropKey, BackdropVariant> = {
  'auth': 'side',
  'auth-recovery': 'side',
  'dashboard': 'banner',
  'batches': 'banner',
  'fefo': 'banner',
  'inspections': 'banner',
  'dispatch': 'banner',
  'qr': 'banner',
  'trace-public': 'full',
  'team': 'banner',
  'import': 'banner',
  'notifications': 'banner',
  'settings': 'banner',
  'default': 'banner'
};

function matchRoutePattern(pattern: string, pathname: string): boolean {
  if (pattern === '*') return true;
  if (pattern === pathname) return true;
  if (!pattern.includes(':')) return false;

  const patternSegments = pattern.split('/').filter(Boolean);
  const pathSegments = pathname.split('/').filter(Boolean);
  if (patternSegments.length !== pathSegments.length) return false;

  return patternSegments.every((seg, idx) => seg.startsWith(':') || seg === pathSegments[idx]);
}

export function resolveBackdropKeyForPath(pathname: string): BackdropKey {
  const cleanPath = (pathname.split('?')[0] ?? '/').trim() || '/';

  // 1. Check exact match first (excluding wildcard '*')
  for (const key of BACKDROP_KEYS) {
    const routes = BACKDROP_KEY_ROUTES[key];
    for (const route of routes) {
      if (route !== '*' && route === cleanPath) {
        return key;
      }
    }
  }

  // 2. Check parameterized patterns (e.g. /trace/:token, /trace/t/:token, /batches/:id)
  for (const key of BACKDROP_KEYS) {
    const routes = BACKDROP_KEY_ROUTES[key];
    for (const route of routes) {
      if (route !== '*' && route.includes(':') && matchRoutePattern(route, cleanPath)) {
        return key;
      }
    }
  }

  return 'default';
}

export function getBackdropVariantForKey(key: BackdropKey): BackdropVariant {
  return BACKDROP_KEY_VARIANTS[key] ?? 'banner';
}
