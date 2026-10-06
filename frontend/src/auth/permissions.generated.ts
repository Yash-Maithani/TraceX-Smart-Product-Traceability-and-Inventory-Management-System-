/**
 * AUTO-GENERATED FILE — DO NOT EDIT MANUALLY.
 * Source of truth: docs/permission-matrix.csv
 * Regenerate via: npm run gen:permissions
 * Verify drift via: npm run check:permissions-drift
 */

export const PERMISSION_MATRIX_ROLES = [
  'super-admin',
  'admin',
  'manager',
  'factory-manager',
  'quality-inspector',
  'dispatch-coordinator'
] as const;

export type MatrixRole = (typeof PERMISSION_MATRIX_ROLES)[number];
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface PermissionSubject {
  role?: string | null | undefined;
  isSuperAdmin?: boolean | null | undefined;
  superAdmin?: boolean | null | undefined;
}

export interface PermissionMatrixEntry {
  readonly key: string;
  readonly phase: number;
  readonly method: HttpMethod;
  readonly path: string;
  readonly allowedRoles: readonly MatrixRole[];
  readonly anonymousAllowed: boolean;
}

export const PERMISSION_MATRIX: readonly PermissionMatrixEntry[] = [
  { key: 'POST /api/v1/auth/login', phase: 1, method: 'POST', path: '/api/v1/auth/login', allowedRoles: ['super-admin', 'admin', 'manager', 'factory-manager', 'quality-inspector', 'dispatch-coordinator'], anonymousAllowed: true },
  { key: 'POST /api/v1/auth/request-access', phase: 2, method: 'POST', path: '/api/v1/auth/request-access', allowedRoles: ['super-admin', 'admin', 'manager', 'factory-manager', 'quality-inspector', 'dispatch-coordinator'], anonymousAllowed: true },
  { key: 'POST /api/v1/auth/activate', phase: 2, method: 'POST', path: '/api/v1/auth/activate', allowedRoles: ['super-admin', 'admin', 'manager', 'factory-manager', 'quality-inspector', 'dispatch-coordinator'], anonymousAllowed: true },
  { key: 'POST /api/v1/auth/verify-otp', phase: 2, method: 'POST', path: '/api/v1/auth/verify-otp', allowedRoles: ['super-admin', 'admin', 'manager', 'factory-manager', 'quality-inspector', 'dispatch-coordinator'], anonymousAllowed: true },
  { key: 'POST /api/v1/auth/verify-otp/resend', phase: 2, method: 'POST', path: '/api/v1/auth/verify-otp/resend', allowedRoles: ['super-admin', 'admin', 'manager', 'factory-manager', 'quality-inspector', 'dispatch-coordinator'], anonymousAllowed: true },
  { key: 'POST /api/v1/auth/forgot-password', phase: 2, method: 'POST', path: '/api/v1/auth/forgot-password', allowedRoles: ['super-admin', 'admin', 'manager', 'factory-manager', 'quality-inspector', 'dispatch-coordinator'], anonymousAllowed: true },
  { key: 'POST /api/v1/auth/verify-reset-otp', phase: 2, method: 'POST', path: '/api/v1/auth/verify-reset-otp', allowedRoles: ['super-admin', 'admin', 'manager', 'factory-manager', 'quality-inspector', 'dispatch-coordinator'], anonymousAllowed: true },
  { key: 'POST /api/v1/auth/reset-password', phase: 2, method: 'POST', path: '/api/v1/auth/reset-password', allowedRoles: ['super-admin', 'admin', 'manager', 'factory-manager', 'quality-inspector', 'dispatch-coordinator'], anonymousAllowed: true },
  { key: 'GET /actuator/health', phase: 1, method: 'GET', path: '/actuator/health', allowedRoles: ['super-admin', 'admin', 'manager', 'factory-manager', 'quality-inspector', 'dispatch-coordinator'], anonymousAllowed: true },
  { key: 'GET /api/v1/auth/me', phase: 1, method: 'GET', path: '/api/v1/auth/me', allowedRoles: ['super-admin', 'admin', 'manager', 'factory-manager', 'quality-inspector', 'dispatch-coordinator'], anonymousAllowed: false },
  { key: 'PATCH /api/v1/auth/me', phase: 2, method: 'PATCH', path: '/api/v1/auth/me', allowedRoles: ['super-admin', 'admin', 'manager', 'factory-manager', 'quality-inspector', 'dispatch-coordinator'], anonymousAllowed: false },
  { key: 'PATCH /api/v1/auth/me/settings', phase: 9, method: 'PATCH', path: '/api/v1/auth/me/settings', allowedRoles: ['super-admin', 'admin', 'manager', 'factory-manager', 'quality-inspector', 'dispatch-coordinator'], anonymousAllowed: false },
  { key: 'POST /api/v1/auth/me/change-password', phase: 2, method: 'POST', path: '/api/v1/auth/me/change-password', allowedRoles: ['super-admin', 'admin', 'manager', 'factory-manager', 'quality-inspector', 'dispatch-coordinator'], anonymousAllowed: false },
  { key: 'POST /api/v1/auth/me/logout-all', phase: 1, method: 'POST', path: '/api/v1/auth/me/logout-all', allowedRoles: ['super-admin', 'admin', 'manager', 'factory-manager', 'quality-inspector', 'dispatch-coordinator'], anonymousAllowed: false },
  { key: 'GET /api/v1/auth/me/login-history', phase: 9, method: 'GET', path: '/api/v1/auth/me/login-history', allowedRoles: ['super-admin', 'admin', 'manager', 'factory-manager', 'quality-inspector', 'dispatch-coordinator'], anonymousAllowed: false },
  { key: 'POST /api/v1/auth/me/google-link', phase: 11, method: 'POST', path: '/api/v1/auth/me/google-link', allowedRoles: ['super-admin', 'admin', 'manager', 'factory-manager', 'quality-inspector', 'dispatch-coordinator'], anonymousAllowed: false },
  { key: 'DELETE /api/v1/auth/me/google-link', phase: 11, method: 'DELETE', path: '/api/v1/auth/me/google-link', allowedRoles: ['super-admin', 'admin', 'manager', 'factory-manager', 'quality-inspector', 'dispatch-coordinator'], anonymousAllowed: false },
  { key: 'GET /api/v1/auth/requests', phase: 2, method: 'GET', path: '/api/v1/auth/requests', allowedRoles: ['super-admin', 'admin', 'manager'], anonymousAllowed: false },
  { key: 'POST /api/v1/auth/requests/:id/approve', phase: 2, method: 'POST', path: '/api/v1/auth/requests/:id/approve', allowedRoles: ['super-admin', 'admin'], anonymousAllowed: false },
  { key: 'POST /api/v1/auth/requests/:id/reject', phase: 2, method: 'POST', path: '/api/v1/auth/requests/:id/reject', allowedRoles: ['super-admin', 'admin'], anonymousAllowed: false },
  { key: 'POST /api/v1/auth/requests/:id/resend', phase: 2, method: 'POST', path: '/api/v1/auth/requests/:id/resend', allowedRoles: ['super-admin', 'admin'], anonymousAllowed: false },
  { key: 'DELETE /api/v1/auth/requests/:id', phase: 2, method: 'DELETE', path: '/api/v1/auth/requests/:id', allowedRoles: ['super-admin', 'admin'], anonymousAllowed: false },
  { key: 'GET /api/v1/auth/directory', phase: 2, method: 'GET', path: '/api/v1/auth/directory', allowedRoles: ['super-admin', 'admin', 'manager'], anonymousAllowed: false },
  { key: 'GET /api/v1/auth/users', phase: 2, method: 'GET', path: '/api/v1/auth/users', allowedRoles: ['super-admin', 'admin', 'manager'], anonymousAllowed: false },
  { key: 'GET /api/v1/auth/users/deleted', phase: 2, method: 'GET', path: '/api/v1/auth/users/deleted', allowedRoles: ['super-admin'], anonymousAllowed: false },
  { key: 'PATCH /api/v1/auth/users/:id/toggle', phase: 2, method: 'PATCH', path: '/api/v1/auth/users/:id/toggle', allowedRoles: ['super-admin', 'admin'], anonymousAllowed: false },
  { key: 'PATCH /api/v1/auth/users/:id/role', phase: 2, method: 'PATCH', path: '/api/v1/auth/users/:id/role', allowedRoles: ['super-admin', 'admin'], anonymousAllowed: false },
  { key: 'DELETE /api/v1/auth/users/:id', phase: 2, method: 'DELETE', path: '/api/v1/auth/users/:id', allowedRoles: ['super-admin', 'admin'], anonymousAllowed: false },
  { key: 'PATCH /api/v1/auth/users/:id/restore', phase: 2, method: 'PATCH', path: '/api/v1/auth/users/:id/restore', allowedRoles: ['super-admin'], anonymousAllowed: false },
  { key: 'GET /api/v1/batches', phase: 3, method: 'GET', path: '/api/v1/batches', allowedRoles: ['super-admin', 'admin', 'manager', 'factory-manager', 'quality-inspector', 'dispatch-coordinator'], anonymousAllowed: false },
  { key: 'POST /api/v1/batches', phase: 3, method: 'POST', path: '/api/v1/batches', allowedRoles: ['super-admin', 'admin', 'manager', 'factory-manager'], anonymousAllowed: false },
  { key: 'GET /api/v1/batches/archived', phase: 3, method: 'GET', path: '/api/v1/batches/archived', allowedRoles: ['super-admin', 'admin'], anonymousAllowed: false },
  { key: 'GET /api/v1/batches/:id', phase: 3, method: 'GET', path: '/api/v1/batches/:id', allowedRoles: ['super-admin', 'admin', 'manager', 'factory-manager', 'quality-inspector', 'dispatch-coordinator'], anonymousAllowed: false },
  { key: 'PATCH /api/v1/batches/:id/dispatch', phase: 4, method: 'PATCH', path: '/api/v1/batches/:id/dispatch', allowedRoles: ['super-admin', 'admin', 'dispatch-coordinator'], anonymousAllowed: false },
  { key: 'PATCH /api/v1/batches/:id/note', phase: 3, method: 'PATCH', path: '/api/v1/batches/:id/note', allowedRoles: ['super-admin', 'admin', 'manager', 'factory-manager'], anonymousAllowed: false },
  { key: 'PATCH /api/v1/batches/:id/raw-material', phase: 3, method: 'PATCH', path: '/api/v1/batches/:id/raw-material', allowedRoles: ['super-admin', 'admin', 'manager', 'factory-manager'], anonymousAllowed: false },
  { key: 'DELETE /api/v1/batches/:id', phase: 3, method: 'DELETE', path: '/api/v1/batches/:id', allowedRoles: ['super-admin', 'admin'], anonymousAllowed: false },
  { key: 'PATCH /api/v1/batches/:id/restore', phase: 3, method: 'PATCH', path: '/api/v1/batches/:id/restore', allowedRoles: ['super-admin', 'admin'], anonymousAllowed: false },
  { key: 'GET /api/v1/batches/:id/qr', phase: 7, method: 'GET', path: '/api/v1/batches/:id/qr', allowedRoles: ['super-admin', 'admin', 'manager', 'factory-manager', 'quality-inspector', 'dispatch-coordinator'], anonymousAllowed: false },
  { key: 'GET /api/v1/batches/:id/scans', phase: 7, method: 'GET', path: '/api/v1/batches/:id/scans', allowedRoles: ['super-admin', 'admin', 'manager', 'factory-manager', 'quality-inspector', 'dispatch-coordinator'], anonymousAllowed: false },
  { key: 'GET /api/v1/dispatch/fefo', phase: 4, method: 'GET', path: '/api/v1/dispatch/fefo', allowedRoles: ['super-admin', 'admin', 'manager', 'factory-manager', 'quality-inspector', 'dispatch-coordinator'], anonymousAllowed: false },
  { key: 'GET /api/v1/qr/trace/t/:token', phase: 7, method: 'GET', path: '/api/v1/qr/trace/t/:token', allowedRoles: ['super-admin', 'admin', 'manager', 'factory-manager', 'quality-inspector', 'dispatch-coordinator'], anonymousAllowed: true },
  { key: 'POST /api/v1/qr/scan', phase: 7, method: 'POST', path: '/api/v1/qr/scan', allowedRoles: ['super-admin', 'admin', 'manager', 'factory-manager', 'quality-inspector', 'dispatch-coordinator'], anonymousAllowed: true },
  { key: 'GET /api/v1/inspections', phase: 4, method: 'GET', path: '/api/v1/inspections', allowedRoles: ['super-admin', 'admin', 'manager', 'factory-manager', 'quality-inspector'], anonymousAllowed: false },
  { key: 'POST /api/v1/inspections', phase: 4, method: 'POST', path: '/api/v1/inspections', allowedRoles: ['super-admin', 'admin', 'quality-inspector'], anonymousAllowed: false },
  { key: 'GET /api/v1/inspections/my', phase: 4, method: 'GET', path: '/api/v1/inspections/my', allowedRoles: ['super-admin', 'admin', 'manager', 'factory-manager', 'quality-inspector'], anonymousAllowed: false },
  { key: 'GET /api/v1/inspections/batch/:batchId', phase: 4, method: 'GET', path: '/api/v1/inspections/batch/:batchId', allowedRoles: ['super-admin', 'admin', 'manager', 'factory-manager', 'quality-inspector'], anonymousAllowed: false },
  { key: 'GET /api/v1/inspections/:id', phase: 4, method: 'GET', path: '/api/v1/inspections/:id', allowedRoles: ['super-admin', 'admin', 'manager', 'factory-manager', 'quality-inspector'], anonymousAllowed: false },
  { key: 'GET /api/v1/import/schema', phase: 8, method: 'GET', path: '/api/v1/import/schema', allowedRoles: ['super-admin', 'admin', 'manager', 'factory-manager'], anonymousAllowed: false },
  { key: 'POST /api/v1/import/map-headers', phase: 8, method: 'POST', path: '/api/v1/import/map-headers', allowedRoles: ['super-admin', 'admin', 'manager', 'factory-manager'], anonymousAllowed: false },
  { key: 'POST /api/v1/import/validate', phase: 8, method: 'POST', path: '/api/v1/import/validate', allowedRoles: ['super-admin', 'admin', 'manager', 'factory-manager'], anonymousAllowed: false },
  { key: 'POST /api/v1/import/commit', phase: 8, method: 'POST', path: '/api/v1/import/commit', allowedRoles: ['super-admin', 'admin', 'manager', 'factory-manager'], anonymousAllowed: false },
  { key: 'GET /api/v1/import', phase: 8, method: 'GET', path: '/api/v1/import', allowedRoles: ['super-admin', 'admin', 'manager', 'factory-manager'], anonymousAllowed: false },
  { key: 'GET /api/v1/import/:id', phase: 8, method: 'GET', path: '/api/v1/import/:id', allowedRoles: ['super-admin', 'admin', 'manager', 'factory-manager'], anonymousAllowed: false },
  { key: 'POST /api/v1/import/:id/rollback', phase: 8, method: 'POST', path: '/api/v1/import/:id/rollback', allowedRoles: ['super-admin', 'admin', 'manager', 'factory-manager'], anonymousAllowed: false },
  { key: 'GET /api/v1/notifications', phase: 10, method: 'GET', path: '/api/v1/notifications', allowedRoles: ['super-admin', 'admin', 'manager', 'factory-manager', 'quality-inspector', 'dispatch-coordinator'], anonymousAllowed: false },
  { key: 'GET /api/v1/notifications/stream', phase: 10, method: 'GET', path: '/api/v1/notifications/stream', allowedRoles: ['super-admin', 'admin', 'manager', 'factory-manager', 'quality-inspector', 'dispatch-coordinator'], anonymousAllowed: false },
  { key: 'PATCH /api/v1/notifications/:id/read', phase: 10, method: 'PATCH', path: '/api/v1/notifications/:id/read', allowedRoles: ['super-admin', 'admin', 'manager', 'factory-manager', 'quality-inspector', 'dispatch-coordinator'], anonymousAllowed: false },
  { key: 'PATCH /api/v1/notifications/read-all', phase: 10, method: 'PATCH', path: '/api/v1/notifications/read-all', allowedRoles: ['super-admin', 'admin', 'manager', 'factory-manager', 'quality-inspector', 'dispatch-coordinator'], anonymousAllowed: false },
  { key: 'POST /api/v1/ai/dispatch-audit', phase: 11, method: 'POST', path: '/api/v1/ai/dispatch-audit', allowedRoles: ['super-admin', 'admin', 'manager', 'factory-manager', 'quality-inspector', 'dispatch-coordinator'], anonymousAllowed: false },
  { key: 'GET /api/v1/products', phase: 3, method: 'GET', path: '/api/v1/products', allowedRoles: ['super-admin', 'admin', 'manager', 'factory-manager', 'quality-inspector', 'dispatch-coordinator'], anonymousAllowed: false },
  { key: 'GET /api/v1/dashboard/summary', phase: 6, method: 'GET', path: '/api/v1/dashboard/summary', allowedRoles: ['super-admin', 'admin', 'manager', 'factory-manager', 'quality-inspector', 'dispatch-coordinator'], anonymousAllowed: false },
];

const PERMISSION_BY_KEY: ReadonlyMap<string, PermissionMatrixEntry> = new Map(
  PERMISSION_MATRIX.map((entry) => [entry.key, entry])
);

export function resolveEffectiveRole(user: PermissionSubject | null | undefined): MatrixRole | null {
  if (!user || !user.role) return null;
  if (user.isSuperAdmin === true || user.superAdmin === true || user.role === 'super-admin') {
    return 'super-admin';
  }
  const role = user.role as MatrixRole;
  return PERMISSION_MATRIX_ROLES.includes(role) ? role : null;
}

export function getAllowedRolesForEndpoint(method: HttpMethod, pathPattern: string): readonly MatrixRole[] {
  const entry = PERMISSION_BY_KEY.get(`${method} ${pathPattern}`);
  return entry ? entry.allowedRoles : [];
}

export function canCallEndpoint(
  user: PermissionSubject | null | undefined,
  method: HttpMethod,
  pathPattern: string
): boolean {
  const entry = PERMISSION_BY_KEY.get(`${method} ${pathPattern}`);
  if (!entry) return false;
  if (entry.anonymousAllowed) return true;
  const effectiveRole = resolveEffectiveRole(user);
  if (!effectiveRole) return false;
  return entry.allowedRoles.includes(effectiveRole);
}

// Capability helpers for Phase 6 navigation and action buttons
export function canViewDashboard(user: PermissionSubject | null | undefined): boolean {
  return canCallEndpoint(user, 'GET', '/api/v1/dashboard/summary');
}

export function canViewBatches(user: PermissionSubject | null | undefined): boolean {
  return canCallEndpoint(user, 'GET', '/api/v1/batches');
}

export function canCreateBatch(user: PermissionSubject | null | undefined): boolean {
  return canCallEndpoint(user, 'POST', '/api/v1/batches');
}

export function canEditBatchNote(user: PermissionSubject | null | undefined): boolean {
  return canCallEndpoint(user, 'PATCH', '/api/v1/batches/:id/note');
}

export function canEditRawMaterial(user: PermissionSubject | null | undefined): boolean {
  return canCallEndpoint(user, 'PATCH', '/api/v1/batches/:id/raw-material');
}

export function canArchiveBatch(user: PermissionSubject | null | undefined): boolean {
  return canCallEndpoint(user, 'DELETE', '/api/v1/batches/:id');
}

export function canViewArchivedBatches(user: PermissionSubject | null | undefined): boolean {
  return canCallEndpoint(user, 'GET', '/api/v1/batches/archived');
}

export function canRestoreBatch(user: PermissionSubject | null | undefined): boolean {
  return canCallEndpoint(user, 'PATCH', '/api/v1/batches/:id/restore');
}

export function canViewFefoQueue(user: PermissionSubject | null | undefined): boolean {
  return canCallEndpoint(user, 'GET', '/api/v1/dispatch/fefo');
}

export function canDispatchBatch(user: PermissionSubject | null | undefined): boolean {
  return canCallEndpoint(user, 'PATCH', '/api/v1/batches/:id/dispatch');
}

export function canViewInspections(user: PermissionSubject | null | undefined): boolean {
  return canCallEndpoint(user, 'GET', '/api/v1/inspections');
}

export function canViewBatchInspections(user: PermissionSubject | null | undefined): boolean {
  return canCallEndpoint(user, 'GET', '/api/v1/inspections/batch/:batchId');
}

export function canCreateInspection(user: PermissionSubject | null | undefined): boolean {
  return canCallEndpoint(user, 'POST', '/api/v1/inspections');
}

export function canViewAccessRequests(user: PermissionSubject | null | undefined): boolean {
  return canCallEndpoint(user, 'GET', '/api/v1/auth/requests');
}

export function canEditProfile(user: PermissionSubject | null | undefined): boolean {
  return canCallEndpoint(user, 'PATCH', '/api/v1/auth/me');
}

export function canViewBatchQr(user: PermissionSubject | null | undefined): boolean {
  return canCallEndpoint(user, 'GET', '/api/v1/batches/:id/qr');
}

export function canViewBatchScans(user: PermissionSubject | null | undefined): boolean {
  return canCallEndpoint(user, 'GET', '/api/v1/batches/:id/scans');
}

export function canUseBulkImport(user: PermissionSubject | null | undefined): boolean {
  return canCallEndpoint(user, 'GET', '/api/v1/import/schema');
}

export function canRollbackImport(user: PermissionSubject | null | undefined): boolean {
  return canCallEndpoint(user, 'POST', '/api/v1/import/:id/rollback');
}
