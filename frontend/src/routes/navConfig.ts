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
    | 'upload'
    | 'bell'
    | 'message'
    | 'package';
  endpoint: {
    method: HttpMethod;
    path: string;
  };
  minRoles: readonly MatrixRole[];
  phase: number;
  enabled: boolean;
  /** Sidebar group (UI/UX redesign R1, DESIGN.md §4 Sidebar). */
  group: 'operations' | 'team';
  /** Extra words the command palette matches, e.g. the old page names (redesign R7). */
  keywords?: string;
}

/**
 * Single source of truth for application navigation routes (Phase 6–10).
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
    enabled: true,
    group: 'operations'
  },
  {
    path: '/batches',
    label: 'Batches',
    iconName: 'boxes',
    endpoint: { method: 'GET', path: '/api/v1/batches' },
    minRoles: getAllowedRolesForEndpoint('GET', '/api/v1/batches'),
    phase: 6,
    enabled: true,
    group: 'operations'
  },
  {
    path: '/products',
    label: 'Products',
    keywords: 'catalogue sku shelf life allergens ingredients',
    iconName: 'package',
    endpoint: { method: 'GET', path: '/api/v1/products' },
    minRoles: getAllowedRolesForEndpoint('GET', '/api/v1/products'),
    phase: 14,
    enabled: true,
    group: 'operations'
  },
  {
    path: '/import',
    label: 'Import',
    keywords: 'bulk csv upload',
    iconName: 'upload',
    endpoint: { method: 'GET', path: '/api/v1/import/schema' },
    minRoles: getAllowedRolesForEndpoint('GET', '/api/v1/import/schema'),
    phase: 8,
    enabled: true,
    group: 'operations'
  },
  {
    path: '/fefo',
    label: 'Dispatch queue',
    keywords: 'fefo first expired first out dispatch',
    iconName: 'truck',
    endpoint: { method: 'GET', path: '/api/v1/dispatch/fefo' },
    minRoles: getAllowedRolesForEndpoint('GET', '/api/v1/dispatch/fefo'),
    phase: 6,
    enabled: true,
    group: 'operations'
  },
  {
    path: '/inspections',
    label: 'Inspections',
    keywords: 'quality checks verdict',
    iconName: 'clipboard',
    endpoint: { method: 'GET', path: '/api/v1/inspections' },
    minRoles: getAllowedRolesForEndpoint('GET', '/api/v1/inspections'),
    phase: 6,
    enabled: true,
    group: 'operations'
  },
  {
    path: '/batches/archived',
    label: 'Archived batches',
    iconName: 'archive',
    endpoint: { method: 'GET', path: '/api/v1/batches/archived' },
    minRoles: getAllowedRolesForEndpoint('GET', '/api/v1/batches/archived'),
    phase: 6,
    enabled: true,
    group: 'operations'
  },
  {
    path: '/profile',
    label: 'Profile',
    keywords: 'security password sessions',
    iconName: 'shield',
    endpoint: { method: 'GET', path: '/api/v1/auth/me' },
    minRoles: getAllowedRolesForEndpoint('GET', '/api/v1/auth/me'),
    phase: 6,
    enabled: true,
    group: 'team'
  },
  {
    path: '/team',
    label: 'Team',
    keywords: 'access users requests roles',
    iconName: 'users',
    endpoint: { method: 'GET', path: '/api/v1/auth/users' },
    minRoles: getAllowedRolesForEndpoint('GET', '/api/v1/auth/users'),
    phase: 9,
    enabled: true,
    group: 'team'
  },
  {
    path: '/notifications',
    label: 'Notifications',
    iconName: 'bell',
    endpoint: { method: 'GET', path: '/api/v1/notifications' },
    minRoles: getAllowedRolesForEndpoint('GET', '/api/v1/notifications'),
    phase: 10,
    enabled: true,
    group: 'team'
  },
  {
    path: '/messages',
    label: 'Messages',
    iconName: 'message',
    endpoint: { method: 'GET', path: '/api/v1/messages/channels' },
    minRoles: getAllowedRolesForEndpoint('GET', '/api/v1/messages/channels'),
    phase: 10,
    enabled: true,
    group: 'team'
  },
  {
    path: '/settings',
    label: 'Settings',
    iconName: 'settings',
    endpoint: { method: 'PATCH', path: '/api/v1/auth/me/settings' },
    minRoles: getAllowedRolesForEndpoint('PATCH', '/api/v1/auth/me/settings'),
    phase: 9,
    enabled: true,
    group: 'team'
  }
];

export function getEnabledNavRoutes(user?: PermissionSubject | null): NavRouteItem[] {
  return NAV_ROUTES.filter((item) => {
    if (!item.enabled) return false;
    if (user === undefined) return true;
    return canCallEndpoint(user, item.endpoint.method, item.endpoint.path);
  });
}
