import {
  canCallEndpoint,
  getAllowedRolesForEndpoint,
  type HttpMethod,
  type MatrixRole,
  type PermissionSubject
} from '../auth/permissions.generated';

export interface NavRouteItem {
  path: string;
  label: string;
  iconName:
    | 'home'
    | 'shield'
    | 'boxes'
    | 'truck'
    | 'clipboard'
    | 'users'
    | 'settings'
    | 'archive'
    | 'upload';
  endpoint: {
    method: HttpMethod;
    path: string;
  };
  minRoles: readonly MatrixRole[];
  phase: number;
  enabled: boolean;
}

/**
 * Single source of truth for application navigation routes (Phase 6–8).
 * Permissions are derived directly from `src/auth/permissions.generated.ts` (`docs/permission-matrix.csv`).
 */
export const NAV_ROUTES: readonly NavRouteItem[] = [
  {
    path: '/',
    label: 'Dashboard',
    iconName: 'home',
    endpoint: { method: 'GET', path: '/api/v1/dashboard/summary' },
    minRoles: getAllowedRolesForEndpoint('GET', '/api/v1/dashboard/summary'),
    phase: 6,
    enabled: true
  },
  {
    path: '/batches',
    label: 'Batches',
    iconName: 'boxes',
    endpoint: { method: 'GET', path: '/api/v1/batches' },
    minRoles: getAllowedRolesForEndpoint('GET', '/api/v1/batches'),
    phase: 6,
    enabled: true
  },
  {
    path: '/import',
    label: 'Bulk Import',
    iconName: 'upload',
    endpoint: { method: 'GET', path: '/api/v1/import/schema' },
    minRoles: getAllowedRolesForEndpoint('GET', '/api/v1/import/schema'),
    phase: 8,
    enabled: true
  },
  {
    path: '/fefo',
    label: 'FEFO & Dispatch',
    iconName: 'truck',
    endpoint: { method: 'GET', path: '/api/v1/dispatch/fefo' },
    minRoles: getAllowedRolesForEndpoint('GET', '/api/v1/dispatch/fefo'),
    phase: 6,
    enabled: true
  },
  {
    path: '/inspections',
    label: 'Quality Inspections',
    iconName: 'clipboard',
    endpoint: { method: 'GET', path: '/api/v1/inspections' },
    minRoles: getAllowedRolesForEndpoint('GET', '/api/v1/inspections'),
    phase: 6,
    enabled: true
  },
  {
    path: '/batches/archived',
    label: 'Archived Batches',
    iconName: 'archive',
    endpoint: { method: 'GET', path: '/api/v1/batches/archived' },
    minRoles: getAllowedRolesForEndpoint('GET', '/api/v1/batches/archived'),
    phase: 6,
    enabled: true
  },
  {
    path: '/profile',
    label: 'Profile & Security',
    iconName: 'settings',
    endpoint: { method: 'GET', path: '/api/v1/auth/me' },
    minRoles: getAllowedRolesForEndpoint('GET', '/api/v1/auth/me'),
    phase: 6,
    enabled: true
  },
  {
    path: '/team',
    label: 'Team & Access',
    iconName: 'users',
    endpoint: { method: 'GET', path: '/api/v1/auth/users' },
    minRoles: getAllowedRolesForEndpoint('GET', '/api/v1/auth/users'),
    phase: 9,
    enabled: false
  }
];

export function getEnabledNavRoutes(user?: PermissionSubject | null): NavRouteItem[] {
  return NAV_ROUTES.filter((item) => {
    if (!item.enabled) return false;
    if (user === undefined) return true;
    return canCallEndpoint(user, item.endpoint.method, item.endpoint.path);
  });
}
