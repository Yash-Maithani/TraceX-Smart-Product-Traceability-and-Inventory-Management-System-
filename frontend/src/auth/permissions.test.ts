import { describe, expect, it } from 'vitest';
import {
  canArchiveBatch,
  canCallEndpoint,
  canCreateBatch,
  canCreateInspection,
  canDispatchBatch,
  canEditBatchNote,
  canEditProfile,
  canEditRawMaterial,
  canRestoreBatch,
  canRollbackImport,
  canUseBulkImport,
  canViewAccessRequests,
  canViewArchivedBatches,
  canViewBatches,
  canViewBatchInspections,
  canViewDashboard,
  canViewFefoQueue,
  canViewInspections,
  getAllowedRolesForEndpoint,
  PERMISSION_MATRIX,
  resolveEffectiveRole
} from './permissions.generated';

describe('Generated UI Permissions from docs/permission-matrix.csv (Part C)', () => {
  it('loads all permission matrix rows and resolves allowed roles', () => {
    expect(PERMISSION_MATRIX.length).toBeGreaterThanOrEqual(62);
    expect(getAllowedRolesForEndpoint('GET', '/api/v1/batches/archived')).toEqual([
      'super-admin',
      'admin'
    ]);
    expect(getAllowedRolesForEndpoint('POST', '/api/v1/batches')).toEqual([
      'super-admin',
      'admin',
      'manager',
      'factory-manager'
    ]);
    expect(getAllowedRolesForEndpoint('GET', '/api/v1/non-existent')).toEqual([]);
  });

  it('evaluates role-based endpoint access and capability helpers accurately', () => {
    const superAdmin = { role: 'admin' as const, isSuperAdmin: true };
    const admin = { role: 'admin' as const, isSuperAdmin: false };
    const manager = { role: 'manager' as const, isSuperAdmin: false };
    const factoryMgr = { role: 'factory-manager' as const, isSuperAdmin: false };
    const inspector = { role: 'quality-inspector' as const, isSuperAdmin: false };
    const coordinator = { role: 'dispatch-coordinator' as const, isSuperAdmin: false };

    expect(resolveEffectiveRole(null)).toBeNull();
    expect(resolveEffectiveRole(superAdmin)).toBe('super-admin');
    expect(resolveEffectiveRole(admin)).toBe('admin');

    expect(canCallEndpoint(null, 'GET', '/api/v1/batches')).toBe(false);
    expect(canCallEndpoint(null, 'POST', '/api/v1/auth/login')).toBe(true);
    expect(canCallEndpoint({ role: undefined }, 'GET', '/api/v1/batches')).toBe(false);
    expect(canCallEndpoint(superAdmin, 'PATCH', '/api/v1/auth/users/:id/restore')).toBe(true);
    expect(canCallEndpoint(admin, 'PATCH', '/api/v1/auth/users/:id/restore')).toBe(false);
    expect(canCallEndpoint(admin, 'GET', '/api/v1/unknown-endpoint')).toBe(false);

    // Dashboard & Batches view
    expect(canViewDashboard(coordinator)).toBe(true);
    expect(canViewBatches(inspector)).toBe(true);

    // Create Batch / Notes / Raw Materials
    expect(canCreateBatch(factoryMgr)).toBe(true);
    expect(canCreateBatch(inspector)).toBe(false);
    expect(canCreateBatch(coordinator)).toBe(false);
    expect(canEditBatchNote(factoryMgr)).toBe(true);
    expect(canEditBatchNote(coordinator)).toBe(false);
    expect(canEditRawMaterial(manager)).toBe(true);
    expect(canEditRawMaterial(inspector)).toBe(false);

    // Archive & Restore (Admin / Super-Admin only)
    expect(canArchiveBatch(admin)).toBe(true);
    expect(canArchiveBatch(superAdmin)).toBe(true);
    expect(canArchiveBatch(manager)).toBe(false);
    expect(canArchiveBatch(factoryMgr)).toBe(false);
    expect(canViewArchivedBatches(admin)).toBe(true);
    expect(canViewArchivedBatches(inspector)).toBe(false);
    expect(canRestoreBatch(admin)).toBe(true);
    expect(canRestoreBatch(coordinator)).toBe(false);

    // FEFO & Dispatch
    expect(canViewFefoQueue(coordinator)).toBe(true);
    expect(canDispatchBatch(coordinator)).toBe(true);
    expect(canDispatchBatch(manager)).toBe(false);
    expect(canDispatchBatch(factoryMgr)).toBe(false);
    expect(canDispatchBatch(inspector)).toBe(false);

    // Inspections
    expect(canViewInspections(inspector)).toBe(true);
    expect(canViewInspections(factoryMgr)).toBe(true);
    expect(canViewInspections(coordinator)).toBe(false);
    expect(canViewBatchInspections(inspector)).toBe(true);
    expect(canViewBatchInspections(coordinator)).toBe(false);
    expect(canCreateInspection(inspector)).toBe(true);
    expect(canCreateInspection(manager)).toBe(false);
    expect(canCreateInspection(factoryMgr)).toBe(false);
    expect(canCreateInspection(coordinator)).toBe(false);

    // Access requests & Profile
    expect(canViewAccessRequests(manager)).toBe(true);
    expect(canViewAccessRequests(factoryMgr)).toBe(false);
    expect(canEditProfile(coordinator)).toBe(true);

    // Phase 8 Bulk CSV Import & Rollback
    expect(canUseBulkImport(superAdmin)).toBe(true);
    expect(canUseBulkImport(admin)).toBe(true);
    expect(canUseBulkImport(manager)).toBe(true);
    expect(canUseBulkImport(factoryMgr)).toBe(true);
    expect(canUseBulkImport(inspector)).toBe(false);
    expect(canUseBulkImport(coordinator)).toBe(false);

    expect(canRollbackImport(superAdmin)).toBe(true);
    expect(canRollbackImport(admin)).toBe(true);
    expect(canRollbackImport(manager)).toBe(true);
    expect(canRollbackImport(factoryMgr)).toBe(true);
    expect(canRollbackImport(inspector)).toBe(false);
    expect(canRollbackImport(coordinator)).toBe(false);
  });
});

