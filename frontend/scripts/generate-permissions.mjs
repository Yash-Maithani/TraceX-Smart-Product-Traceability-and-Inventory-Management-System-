import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');
const defaultMatrixPath = path.resolve(frontendRoot, '../docs/permission-matrix.csv');
const defaultOutputPath = path.resolve(frontendRoot, 'src/auth/permissions.generated.ts');

export const MATRIX_ROLES = [
  'super-admin',
  'admin',
  'manager',
  'factory-manager',
  'quality-inspector',
  'dispatch-coordinator'
];

export function parsePermissionMatrixCsv(csvContent) {
  const lines = csvContent
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));

  if (lines.length < 2) {
    throw new Error('docs/permission-matrix.csv must contain a header row and at least one data row.');
  }

  const entries = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length < 10) {
      continue;
    }
    const phase = Number.parseInt(parts[0].trim(), 10);
    const method = parts[1].trim().toUpperCase();
    const routePath = parts[2].trim();
    const allowedRoles = [];

    for (let r = 0; r < MATRIX_ROLES.length; r++) {
      const cell = (parts[3 + r] ?? '').trim().toLowerCase();
      if (cell === 'allow') {
        allowedRoles.push(MATRIX_ROLES[r]);
      }
    }

    const anonymousCell = (parts[9] ?? 'deny').trim().toLowerCase();
    const anonymousAllowed = anonymousCell === 'allow';

    entries.push({
      key: `${method} ${routePath}`,
      phase,
      method,
      path: routePath,
      allowedRoles,
      anonymousAllowed
    });
  }

  return entries;
}

export function buildPermissionsTypeScript(csvContent) {
  const entries = parsePermissionMatrixCsv(csvContent);

  const lines = [
    '/**',
    ' * AUTO-GENERATED FILE — DO NOT EDIT MANUALLY.',
    ' * Source of truth: docs/permission-matrix.csv',
    ' * Regenerate via: npm run gen:permissions',
    ' * Verify drift via: npm run check:permissions-drift',
    ' */',
    '',
    'export const PERMISSION_MATRIX_ROLES = [',
    "  'super-admin',",
    "  'admin',",
    "  'manager',",
    "  'factory-manager',",
    "  'quality-inspector',",
    "  'dispatch-coordinator'",
    '] as const;',
    '',
    'export type MatrixRole = (typeof PERMISSION_MATRIX_ROLES)[number];',
    "export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';",
    '',
    'export interface PermissionSubject {',
    '  role?: string | null | undefined;',
    '  isSuperAdmin?: boolean | null | undefined;',
    '  superAdmin?: boolean | null | undefined;',
    '}',
    '',
    'export interface PermissionMatrixEntry {',
    '  readonly key: string;',
    '  readonly phase: number;',
    '  readonly method: HttpMethod;',
    '  readonly path: string;',
    '  readonly allowedRoles: readonly MatrixRole[];',
    '  readonly anonymousAllowed: boolean;',
    '}',
    '',
    'export const PERMISSION_MATRIX: readonly PermissionMatrixEntry[] = ['
  ];

  for (const entry of entries) {
    const rolesLiteral = entry.allowedRoles.map((r) => `'${r}'`).join(', ');
    lines.push(
      `  { key: '${entry.key}', phase: ${entry.phase}, method: '${entry.method}', path: '${entry.path}', allowedRoles: [${rolesLiteral}], anonymousAllowed: ${entry.anonymousAllowed} },`
    );
  }

  lines.push(
    '];',
    '',
    'const PERMISSION_BY_KEY: ReadonlyMap<string, PermissionMatrixEntry> = new Map(',
    '  PERMISSION_MATRIX.map((entry) => [entry.key, entry])',
    ');',
    '',
    'export function resolveEffectiveRole(user: PermissionSubject | null | undefined): MatrixRole | null {',
    '  if (!user || !user.role) return null;',
    '  if (user.isSuperAdmin === true || user.superAdmin === true || user.role === \'super-admin\') {',
    "    return 'super-admin';",
    '  }',
    '  const role = user.role as MatrixRole;',
    '  return PERMISSION_MATRIX_ROLES.includes(role) ? role : null;',
    '}',
    '',
    'export function getAllowedRolesForEndpoint(method: HttpMethod, pathPattern: string): readonly MatrixRole[] {',
    '  const entry = PERMISSION_BY_KEY.get(`${method} ${pathPattern}`);',
    '  return entry ? entry.allowedRoles : [];',
    '}',
    '',
    'export function canCallEndpoint(',
    '  user: PermissionSubject | null | undefined,',
    '  method: HttpMethod,',
    '  pathPattern: string',
    '): boolean {',
    '  const entry = PERMISSION_BY_KEY.get(`${method} ${pathPattern}`);',
    '  if (!entry) return false;',
    '  if (entry.anonymousAllowed) return true;',
    '  const effectiveRole = resolveEffectiveRole(user);',
    '  if (!effectiveRole) return false;',
    '  return entry.allowedRoles.includes(effectiveRole);',
    '}',
    '',
    '// Capability helpers for Phase 6 navigation and action buttons',
    'export function canViewDashboard(user: PermissionSubject | null | undefined): boolean {',
    "  return canCallEndpoint(user, 'GET', '/api/v1/dashboard/summary');",
    '}',
    '',
    'export function canViewBatches(user: PermissionSubject | null | undefined): boolean {',
    "  return canCallEndpoint(user, 'GET', '/api/v1/batches');",
    '}',
    '',
    'export function canCreateBatch(user: PermissionSubject | null | undefined): boolean {',
    "  return canCallEndpoint(user, 'POST', '/api/v1/batches');",
    '}',
    '',
    'export function canEditBatchNote(user: PermissionSubject | null | undefined): boolean {',
    "  return canCallEndpoint(user, 'PATCH', '/api/v1/batches/:id/note');",
    '}',
    '',
    'export function canEditRawMaterial(user: PermissionSubject | null | undefined): boolean {',
    "  return canCallEndpoint(user, 'PATCH', '/api/v1/batches/:id/raw-material');",
    '}',
    '',
    'export function canArchiveBatch(user: PermissionSubject | null | undefined): boolean {',
    "  return canCallEndpoint(user, 'DELETE', '/api/v1/batches/:id');",
    '}',
    '',
    'export function canViewArchivedBatches(user: PermissionSubject | null | undefined): boolean {',
    "  return canCallEndpoint(user, 'GET', '/api/v1/batches/archived');",
    '}',
    '',
    'export function canRestoreBatch(user: PermissionSubject | null | undefined): boolean {',
    "  return canCallEndpoint(user, 'PATCH', '/api/v1/batches/:id/restore');",
    '}',
    '',
    'export function canViewFefoQueue(user: PermissionSubject | null | undefined): boolean {',
    "  return canCallEndpoint(user, 'GET', '/api/v1/dispatch/fefo');",
    '}',
    '',
    'export function canDispatchBatch(user: PermissionSubject | null | undefined): boolean {',
    "  return canCallEndpoint(user, 'PATCH', '/api/v1/batches/:id/dispatch');",
    '}',
    '',
    'export function canViewInspections(user: PermissionSubject | null | undefined): boolean {',
    "  return canCallEndpoint(user, 'GET', '/api/v1/inspections');",
    '}',
    '',
    'export function canViewBatchInspections(user: PermissionSubject | null | undefined): boolean {',
    "  return canCallEndpoint(user, 'GET', '/api/v1/inspections/batch/:batchId');",
    '}',
    '',
    'export function canCreateInspection(user: PermissionSubject | null | undefined): boolean {',
    "  return canCallEndpoint(user, 'POST', '/api/v1/inspections');",
    '}',
    '',
    'export function canViewAccessRequests(user: PermissionSubject | null | undefined): boolean {',
    "  return canCallEndpoint(user, 'GET', '/api/v1/auth/requests');",
    '}',
    '',
    'export function canEditProfile(user: PermissionSubject | null | undefined): boolean {',
    "  return canCallEndpoint(user, 'PATCH', '/api/v1/auth/me');",
    '}',
    '',
    'export function canViewBatchQr(user: PermissionSubject | null | undefined): boolean {',
    "  return canCallEndpoint(user, 'GET', '/api/v1/batches/:id/qr');",
    '}',
    '',
    'export function canViewBatchScans(user: PermissionSubject | null | undefined): boolean {',
    "  return canCallEndpoint(user, 'GET', '/api/v1/batches/:id/scans');",
    '}',
    '',
    'export function canUseBulkImport(user: PermissionSubject | null | undefined): boolean {',
    "  return canCallEndpoint(user, 'GET', '/api/v1/import/schema');",
    '}',
    '',
    'export function canRollbackImport(user: PermissionSubject | null | undefined): boolean {',
    "  return canCallEndpoint(user, 'POST', '/api/v1/import/:id/rollback');",
    '}',
    ''
  );

  return lines.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  if (!fs.existsSync(defaultMatrixPath)) {
    console.error(`Permission matrix CSV not found: ${defaultMatrixPath}`);
    process.exit(1);
  }
  const csvContent = fs.readFileSync(defaultMatrixPath, 'utf8');
  const tsOutput = buildPermissionsTypeScript(csvContent);
  fs.mkdirSync(path.dirname(defaultOutputPath), { recursive: true });
  fs.writeFileSync(defaultOutputPath, tsOutput, 'utf8');
  const entries = parsePermissionMatrixCsv(csvContent);
  console.log(
    `Generated src/auth/permissions.generated.ts from docs/permission-matrix.csv (${entries.length} endpoint rules).`
  );
}
