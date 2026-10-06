import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe } from 'vitest-axe';
import { ImportPage } from './ImportPage';
import { ThemeProvider } from '../../hooks/useTheme';
import { ToastProvider } from '../../components/ui';
import { RequireRole } from '../../auth/RequireRole';
import { getEnabledNavRoutes } from '../../routes/navConfig';
import * as AuthCtx from '../../auth/AuthContext';
import * as Endpoints from '../../api/endpoints';
import type { UserSummaryDto } from '../../api/types';

const MANAGER_USER: UserSummaryDto = {
  id: 'u-mgr',
  name: '[DEMO] Operations Manager',
  username: 'manager',
  email: 'manager@tracex.demo',
  role: 'manager',
  superAdmin: false,
  active: true
};

const FACTORY_MGR_USER: UserSummaryDto = {
  id: 'u-fm',
  name: '[DEMO] Factory Manager',
  username: 'factorymgr',
  email: 'factorymgr@tracex.demo',
  role: 'factory-manager',
  superAdmin: false,
  active: true
};

const INSPECTOR_USER: UserSummaryDto = {
  id: 'u-insp',
  name: '[DEMO] Quality Inspector',
  username: 'inspector',
  email: 'inspector@tracex.demo',
  role: 'quality-inspector',
  superAdmin: false,
  active: true
};

const COORDINATOR_USER: UserSummaryDto = {
  id: 'u-coord',
  name: '[DEMO] Dispatch Coordinator',
  username: 'coordinator',
  email: 'coordinator@tracex.demo',
  role: 'dispatch-coordinator',
  superAdmin: false,
  active: true
};

function renderImportPage(user: UserSummaryDto = MANAGER_USER, withRequireRole = false) {
  vi.spyOn(AuthCtx, 'useAuth').mockReturnValue({
    user,
    token: 'mock-token',
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    setAuthenticatedSession: vi.fn(),
    logout: vi.fn(),
    logoutAll: vi.fn(),
    refreshSession: vi.fn().mockResolvedValue(undefined)
  });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={['/import']}>
            {withRequireRole ? (
              <RequireRole endpoint={{ method: 'GET', path: '/api/v1/import/schema' }}>
                <ImportPage />
              </RequireRole>
            ) : (
              <ImportPage />
            )}
          </MemoryRouter>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

describe('ImportPage (Phase 8 Part C & D)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(Endpoints, 'fetchImportSchema').mockResolvedValue({
      maxChunkRows: 500,
      dedupeRule: 'Source Lot Code + Product SKU + Pack Date',
      columns: [
        {
          key: 'productSku',
          label: 'Product SKU',
          required: true,
          type: 'string',
          example: 'JAM-BERRY-500G',
          hint: 'SKU'
        },
        {
          key: 'sourceLotCode',
          label: 'Source Lot Code',
          required: true,
          type: 'string',
          example: 'LOT-001',
          hint: 'Lot ID'
        },
        {
          key: 'farmerName',
          label: 'Farmer Name',
          required: true,
          type: 'string',
          example: 'Ramesh',
          hint: 'Supplier'
        },
        {
          key: 'village',
          label: 'Village',
          required: true,
          type: 'string',
          example: 'Sopore',
          hint: 'Village'
        },
        {
          key: 'quantityProduced',
          label: 'Quantity Produced',
          required: true,
          type: 'number',
          example: '120',
          hint: 'Quantity'
        },
        {
          key: 'unit',
          label: 'Unit',
          required: true,
          type: 'enum',
          example: 'Kg',
          hint: 'Unit',
          enumValues: ['Kg', 'Units', 'Liters']
        },
        {
          key: 'yieldPercent',
          label: 'Yield %',
          required: true,
          type: 'number',
          example: '85',
          hint: 'Yield'
        },
        {
          key: 'packDate',
          label: 'Pack Date',
          required: true,
          type: 'date',
          example: '2026-04-01',
          hint: 'Pack date'
        }
      ]
    });
    vi.spyOn(Endpoints, 'fetchImportHistory').mockResolvedValue([]);
  });

  it('rejects .xlsx files client-side with an explicit D-5 error banner', async () => {
    renderImportPage();

    const input = await screen.findByTestId('import-file-input');
    const xlsxFile = new File(['dummy'], 'batches.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    Object.defineProperty(xlsxFile, 'text', {
      value: () => Promise.resolve('a,b\n1,2')
    });

    fireEvent.change(input, { target: { files: [xlsxFile] } });

    const alert = await screen.findByTestId('import-error-banner');
    expect(alert).toHaveTextContent(/Excel files \(\.xls, \.xlsx\) are not supported/i);
  });

  it('walks through upload -> header mapping -> validate -> preview (no farmerName) -> commit -> result, and passes vitest-axe', async () => {
    vi.spyOn(Endpoints, 'mapImportHeaders').mockResolvedValue({
      mapping: {
        sourceLotCode: 'lot_code',
        productSku: 'sku',
        farmerName: 'farmer_name',
        village: 'village',
        quantityProduced: 'qty',
        unit: 'unit',
        yieldPercent: 'yield_pct',
        packDate: 'pack_date'
      },
      unmappedRequired: []
    });

    const validateSpy = vi.spyOn(Endpoints, 'validateImportRows').mockResolvedValue({
      summary: { total: 2, insert: 1, skip: 0, error: 1 },
      preview: [
        {
          rowNumber: 2,
          verdict: 'insert',
          insertKey: 'JAM-BERRY-500G|LOT-101|2026-04-01',
          sourceLotCode: 'LOT-101',
          product: {
            sku: 'JAM-BERRY-500G',
            productName: 'Mixed Berry Jam'
          },
          packDate: '2026-04-01',
          quantityProduced: 150,
          unit: 'Kg',
          yieldPercent: 85,
          village: 'Sopore',
          errors: []
        },
        {
          rowNumber: 3,
          verdict: 'error',
          sourceLotCode: 'LOT-102',
          product: {
            sku: 'JAM-BERRY-500G',
            productName: 'Mixed Berry Jam'
          },
          packDate: '2026-04-01',
          unit: 'Kg',
          yieldPercent: 85,
          village: 'Sopore',
          errors: [{ field: 'quantityProduced', message: 'Quantity must be at least 1' }]
        }
      ]
    });

    vi.spyOn(Endpoints, 'commitImportRows').mockResolvedValue({
      jobId: 'job-123',
      status: 'done',
      chunkInserted: 1,
      chunkSkipped: 0,
      chunkErrored: 1,
      totals: {
        processedRows: 2,
        totalRows: 2,
        inserted: 1,
        skipped: 0,
        errored: 1
      },
      batches: [],
      errors: [
        {
          rowNumber: 3,
          sourceLotCode: 'LOT-102',
          field: 'quantityProduced',
          message: 'Quantity must be at least 1'
        }
      ],
      rowErrorsTruncated: false
    });

    vi.spyOn(Endpoints, 'fetchImportJobDetail').mockResolvedValue({
      id: 'job-123',
      fileName: 'harvest.csv',
      status: 'done',
      totalRows: 2,
      processedRows: 2,
      inserted: 1,
      skipped: 0,
      errored: 1,
      createdBy: 'manager',
      createdAt: '2026-10-06T08:00:00Z',
      updatedAt: '2026-10-06T08:00:02Z',
      finishedAt: '2026-10-06T08:00:02Z',
      insertedBatchIds: ['b-1'],
      rowErrors: [
        {
          rowNumber: 3,
          sourceLotCode: 'LOT-102',
          field: 'quantityProduced',
          message: 'Quantity must be at least 1'
        }
      ]
    });

    const { container } = renderImportPage();

    const csvContent = [
      'lot_code,sku,farmer_name,village,qty,unit,yield_pct,pack_date',
      'LOT-101,JAM-BERRY-500G,SecretFarmerPII,Sopore,150,Kg,85,2026-04-01',
      'LOT-102,JAM-BERRY-500G,SecretFarmerPII,Sopore,-5,Kg,85,2026-04-01'
    ].join('\n');

    const csvFile = new File([csvContent], 'harvest.csv', { type: 'text/csv' });
    Object.defineProperty(csvFile, 'text', {
      value: () => Promise.resolve(csvContent)
    });

    const input = await screen.findByTestId('import-file-input');
    fireEvent.change(input, { target: { files: [csvFile] } });

    // Step 2: Map columns
    await screen.findByTestId('import-map-section');

    // Unmapping a required field shows warning and disables Validate button
    const skuSelect = screen.getByTestId('map-select-productSku');
    fireEvent.change(skuSelect, { target: { value: '' } });
    expect(screen.getByTestId('unmapped-required-warning')).toBeInTheDocument();
    expect(screen.getByTestId('import-validate-btn')).toBeDisabled();

    // Re-map productSku
    fireEvent.change(skuSelect, { target: { value: 'sku' } });
    expect(screen.queryByTestId('unmapped-required-warning')).toBeNull();
    expect(screen.getByTestId('import-validate-btn')).not.toBeDisabled();

    // Click Validate
    fireEvent.click(screen.getByTestId('import-validate-btn'));

    // Step 3: Preview
    await screen.findByTestId('import-preview-section');
    expect(validateSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('summary-insert-count')).toHaveTextContent('1');
    expect(screen.getByTestId('summary-error-count')).toHaveTextContent('1');

    // D-9: SecretFarmerPII is never rendered in preview
    expect(screen.getByTestId('import-preview-table').textContent).not.toContain(
      'SecretFarmerPII'
    );

    const axeResults = await axe(container);
    expect(axeResults.violations).toEqual([]);

    // Step 4 & 5: Commit -> Result
    fireEvent.click(screen.getByTestId('import-commit-btn'));

    await screen.findByTestId('import-result-section');
    expect(screen.getByTestId('result-job-id')).toHaveTextContent('job-123');
    expect(screen.getByTestId('result-inserted-count')).toHaveTextContent('1');
    expect(screen.getByTestId('result-errored-count')).toHaveTextContent('1');
  });

  it('accumulates priorKeys across 200-row validation chunks and stops immediately on mid-chunk commit failure', async () => {
    vi.spyOn(Endpoints, 'mapImportHeaders').mockResolvedValue({
      mapping: {
        sourceLotCode: 'lot_code',
        productSku: 'sku',
        farmerName: 'farmer_name',
        village: 'village',
        quantityProduced: 'qty',
        unit: 'unit',
        yieldPercent: 'yield_pct',
        packDate: 'pack_date'
      },
      unmappedRequired: []
    });

    const validateSpy = vi
      .spyOn(Endpoints, 'validateImportRows')
      .mockResolvedValueOnce({
        summary: { total: 200, insert: 200, skip: 0, error: 0 },
        preview: [
          {
            rowNumber: 2,
            verdict: 'insert',
            insertKey: 'JAM-BERRY-500G|LOT-CHUNK1|2026-04-01',
            sourceLotCode: 'LOT-CHUNK1',
            product: {
              sku: 'JAM-BERRY-500G',
              productName: 'Jam'
            },
            packDate: '2026-04-01',
            quantityProduced: 100,
            unit: 'Kg',
            yieldPercent: 85,
            village: 'Sopore',
            errors: []
          }
        ]
      })
      .mockResolvedValueOnce({
        summary: { total: 50, insert: 49, skip: 1, error: 0 },
        preview: []
      });

    const commitSpy = vi
      .spyOn(Endpoints, 'commitImportRows')
      .mockResolvedValueOnce({
        jobId: 'job-mid-fail-99',
        status: 'running',
        chunkInserted: 200,
        chunkSkipped: 0,
        chunkErrored: 0,
        totals: {
          processedRows: 200,
          totalRows: 250,
          inserted: 200,
          skipped: 0,
          errored: 0
        },
        batches: [],
        errors: [],
        rowErrorsTruncated: false
      })
      .mockRejectedValueOnce(new Error('Network connection lost during chunk 2'));

    renderImportPage();

    const csvLines = ['lot_code,sku,farmer_name,village,qty,unit,yield_pct,pack_date'];
    for (let i = 1; i <= 250; i += 1) {
      csvLines.push(`LOT-${i},JAM-BERRY-500G,Ramesh,Sopore,100,Kg,85,2026-04-01`);
    }
    const csvContent = csvLines.join('\n');
    const csvFile = new File([csvContent], 'big.csv', { type: 'text/csv' });
    Object.defineProperty(csvFile, 'text', {
      value: () => Promise.resolve(csvContent)
    });

    const input = await screen.findByTestId('import-file-input');
    fireEvent.change(input, { target: { files: [csvFile] } });

    await screen.findByTestId('import-map-section');
    fireEvent.click(screen.getByTestId('import-validate-btn'));

    await screen.findByTestId('import-preview-section');
    expect(validateSpy).toHaveBeenCalledTimes(2);
    // Chunk 2 received the insertKey from chunk 1 in priorKeys
    expect(validateSpy.mock.calls[1]![0].priorKeys).toEqual([
      'JAM-BERRY-500G|LOT-CHUNK1|2026-04-01'
    ]);

    // Start commit (2 chunks)
    fireEvent.click(screen.getByTestId('import-commit-btn'));

    const failureAlert = await screen.findByTestId('import-commit-failure');
    expect(commitSpy).toHaveBeenCalledTimes(2);
    expect(failureAlert).toHaveTextContent(/Chunk 2 of 2 failed/i);
    expect(failureAlert).toHaveTextContent(/Network connection lost during chunk 2/i);
    expect(screen.getByTestId('failed-chunk-job-id')).toHaveTextContent('job-mid-fail-99');
    expect(failureAlert).toHaveTextContent(/15-minute stale window/i);
  });

  it('displays recent import jobs, opens job detail dialog, and executes rollback via ConfirmDialog', async () => {
    vi.spyOn(Endpoints, 'fetchImportHistory').mockResolvedValue([
      {
        id: 'job-hist-1',
        fileName: 'october_batches.csv',
        status: 'done',
        totalRows: 5,
        processedRows: 5,
        inserted: 4,
        skipped: 0,
        errored: 1,
        createdBy: 'manager',
        createdAt: '2026-10-06T09:00:00Z',
        updatedAt: '2026-10-06T09:00:05Z',
        finishedAt: '2026-10-06T09:00:05Z'
      }
    ]);

    vi.spyOn(Endpoints, 'fetchImportJobDetail').mockResolvedValue({
      id: 'job-hist-1',
      fileName: 'october_batches.csv',
      status: 'done',
      totalRows: 5,
      processedRows: 5,
      inserted: 4,
      skipped: 0,
      errored: 1,
      createdBy: 'manager',
      createdAt: '2026-10-06T09:00:00Z',
      updatedAt: '2026-10-06T09:00:05Z',
      finishedAt: '2026-10-06T09:00:05Z',
      insertedBatchIds: ['b1', 'b2', 'b3', 'b4'],
      rowErrors: [
        {
          rowNumber: 6,
          sourceLotCode: 'LOT-ERR-6',
          field: 'packDate',
          message: 'Pack date must be DD/MM/YYYY or YYYY-MM-DD'
        }
      ]
    });

    const rollbackSpy = vi.spyOn(Endpoints, 'rollbackImportJob').mockResolvedValue({
      jobId: 'job-hist-1',
      status: 'rolled_back',
      archived: 4,
      alreadyArchived: 0,
      rolledBackAt: '2026-10-06T09:05:00Z',
      rolledBackBy: 'manager'
    });

    renderImportPage(MANAGER_USER);

    const row = await screen.findByTestId('import-job-row-job-hist-1');
    expect(row).toHaveTextContent('october_batches.csv');

    // View details
    fireEvent.click(screen.getByTestId('view-job-detail-job-hist-1'));
    const detailDialog = await screen.findByTestId('import-job-detail-dialog');
    expect(detailDialog).toHaveTextContent('LOT-ERR-6');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    // Rollback
    fireEvent.click(screen.getByTestId('rollback-job-btn-job-hist-1'));
    const confirmBtn = await screen.findByRole('button', { name: 'Confirm Rollback' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(rollbackSpy).toHaveBeenCalledWith('job-hist-1');
    });
  });

  it('enforces role permissions for nav visibility, page access, and rollback button visibility', async () => {
    // 1. Nav visibility
    expect(getEnabledNavRoutes(MANAGER_USER).some((r) => r.path === '/import')).toBe(true);
    expect(getEnabledNavRoutes(FACTORY_MGR_USER).some((r) => r.path === '/import')).toBe(true);
    expect(getEnabledNavRoutes(INSPECTOR_USER).some((r) => r.path === '/import')).toBe(false);
    expect(getEnabledNavRoutes(COORDINATOR_USER).some((r) => r.path === '/import')).toBe(false);

    // 2. Factory manager can view /import and sees Rollback button per permission-matrix.csv
    vi.spyOn(Endpoints, 'fetchImportHistory').mockResolvedValue([
      {
        id: 'job-fm-1',
        fileName: 'fm.csv',
        status: 'done',
        totalRows: 2,
        processedRows: 2,
        inserted: 2,
        skipped: 0,
        errored: 0,
        createdBy: 'factorymgr',
        createdAt: '2026-10-06T09:00:00Z',
        updatedAt: '2026-10-06T09:00:05Z',
        finishedAt: '2026-10-06T09:00:05Z'
      },
      {
        id: 'job-fm-2',
        fileName: 'fm_rolled_back.csv',
        status: 'rolled_back',
        totalRows: 2,
        processedRows: 2,
        inserted: 2,
        skipped: 0,
        errored: 0,
        createdBy: 'factorymgr',
        createdAt: '2026-10-06T08:00:00Z',
        updatedAt: '2026-10-06T08:00:05Z',
        finishedAt: '2026-10-06T08:00:05Z',
        rolledBackAt: '2026-10-06T08:10:00Z',
        rolledBackBy: 'factorymgr'
      }
    ]);

    const { unmount } = renderImportPage(FACTORY_MGR_USER, true);
    await screen.findByTestId('import-job-row-job-fm-1');
    expect(screen.getByTestId('rollback-job-btn-job-fm-1')).not.toBeDisabled();
    expect(screen.getByTestId('rollback-job-btn-job-fm-2')).toBeDisabled();
    unmount();

    // 3. Quality inspector and Dispatch coordinator visiting /import are blocked by RequireRole (403 ForbiddenState)
    const { unmount: unmountInsp } = renderImportPage(INSPECTOR_USER, true);
    expect(await screen.findByTestId('forbidden-state')).toBeInTheDocument();
    unmountInsp();

    renderImportPage(COORDINATOR_USER, true);
    expect(await screen.findByTestId('forbidden-state')).toBeInTheDocument();
  });
});
