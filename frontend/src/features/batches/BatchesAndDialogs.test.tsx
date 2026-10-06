import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BatchesPage } from './BatchesPage';
import { ArchivedBatchesPage } from './ArchivedBatchesPage';
import { CreateBatchDialog } from './CreateBatchDialog';
import { DispatchDialog } from './DispatchDialog';
import { ThemeProvider } from '../../hooks/useTheme';
import { ToastProvider } from '../../components/ui';
import * as AuthCtx from '../../auth/AuthContext';
import * as Endpoints from '../../api/endpoints';
import { ApiError } from '../../api/client';
import type { BatchDetailDto, BatchSummaryDto, UserSummaryDto } from '../../api/types';

const SAMPLE_BATCHES: BatchSummaryDto[] = [
  {
    id: 'b-1',
    batchCode: 'TX-2026-10-001',
    productName: 'Organic Forest Honey',
    sku: 'OFH-500',
    quantityProduced: 100,
    unit: 'Kg',
    packDate: '2026-04-01',
    expiryDate: '2026-10-10',
    status: 'URGENT',
    daysUntilExpiry: 4,
    sourceLotCode: 'LOT-001',
    village: 'Lansdowne',
    qualityCheck: { status: 'PASSED' }
  },
  {
    id: 'b-2',
    batchCode: 'TX-2026-10-002',
    productName: 'Spiced Ginger Syrup',
    sku: 'SGS-250',
    quantityProduced: 50,
    unit: 'Litres',
    packDate: '2026-01-01',
    expiryDate: '2026-09-01',
    status: 'EXPIRED',
    daysUntilExpiry: -35,
    sourceLotCode: 'LOT-002',
    village: 'Pauri',
    qualityCheck: { status: 'FAILED' }
  }
];

function renderWithProviders(
  ui: React.ReactNode,
  user: UserSummaryDto,
  initialEntries = ['/batches']
) {
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
          <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

describe('BatchesPage, ArchivedBatchesPage, CreateBatchDialog, and DispatchDialog (Phase 6 Part D)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders BatchesPage filters and role-gated buttons for admin', async () => {
    vi.spyOn(Endpoints, 'fetchProducts').mockResolvedValue([
      { id: 'p-1', sku: 'OFH-500', productName: 'Organic Forest Honey', category: 'Honey' }
    ]);
    const fetchSpy = vi.spyOn(Endpoints, 'fetchBatches').mockResolvedValue({
      data: SAMPLE_BATCHES,
      total: 25,
      page: 1,
      limit: 20,
      count: 2
    });

    renderWithProviders(<BatchesPage />, {
      id: 'u-admin',
      name: '[DEMO] Staff Administrator',
      username: 'admin',
      email: 'admin@tracex.demo',
      role: 'admin',
      superAdmin: false,
      active: true
    });

    await waitFor(() => {
      expect(screen.getByTestId('batch-link-TX-2026-10-001')).toBeInTheDocument();
    });

    // Admin sees Create Batch and Archived Batches link
    expect(screen.getByTestId('open-create-batch-btn')).toBeInTheDocument();
    expect(screen.getByTestId('view-archived-batches-btn')).toBeInTheDocument();

    // Status filter updates query
    fireEvent.change(screen.getByTestId('batches-filter-status'), {
      target: { value: 'URGENT' }
    });
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(expect.objectContaining({ status: 'URGENT' }));
    });

    // Search and Sort filter
    fireEvent.change(screen.getByTestId('batches-filter-search'), {
      target: { value: 'Honey' }
    });
    fireEvent.change(screen.getByTestId('batches-filter-sort'), {
      target: { value: 'batchCode:asc' }
    });
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'Honey', sort: 'batchCode:asc' })
      );
    });

    // Reset filters
    fireEvent.click(screen.getByTestId('batches-reset-filters-btn'));
  });

  it('hides create and archived controls on BatchesPage for quality-inspector', async () => {
    vi.spyOn(Endpoints, 'fetchProducts').mockResolvedValue([]);
    vi.spyOn(Endpoints, 'fetchBatches').mockResolvedValue({
      data: SAMPLE_BATCHES,
      total: 2,
      page: 1,
      limit: 20,
      count: 2
    });

    renderWithProviders(<BatchesPage />, {
      id: 'u-insp',
      name: '[DEMO] Quality Inspector',
      username: 'inspector',
      email: 'inspector@tracex.demo',
      role: 'quality-inspector',
      superAdmin: false,
      active: true
    });

    await waitFor(() => {
      expect(screen.getByTestId('batch-link-TX-2026-10-001')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('open-create-batch-btn')).toBeNull();
    expect(screen.queryByTestId('view-archived-batches-btn')).toBeNull();
  });

  it('submits CreateBatchDialog, disables submit while pending, and shows toast only after server confirmation', async () => {
    vi.spyOn(Endpoints, 'fetchProducts').mockResolvedValue([
      { id: 'p-1', sku: 'OFH-500', productName: 'Organic Forest Honey', category: 'Honey' }
    ]);

    let resolveCreate!: (value: { success: true; data: BatchDetailDto }) => void;
    const createPromise = new Promise<{ success: true; data: BatchDetailDto }>((resolve) => {
      resolveCreate = resolve;
    });
    vi.spyOn(Endpoints, 'createBatch').mockReturnValue(createPromise);

    const onCreated = vi.fn();
    renderWithProviders(
      <CreateBatchDialog open onClose={vi.fn()} onCreated={onCreated} />,
      {
        id: 'u-fm',
        name: '[DEMO] Factory Manager',
        username: 'factory_mgr',
        email: 'factory_mgr@tracex.demo',
        role: 'factory-manager',
        superAdmin: false,
        active: true
      }
    );

    await waitFor(() => {
      expect(screen.getByTestId('create-batch-product-select')).toHaveValue('p-1');
    });

    fireEvent.change(screen.getByTestId('create-batch-lot-code'), {
      target: { value: 'LOT-2026-777' }
    });
    fireEvent.change(screen.getByTestId('create-batch-farmer-name'), {
      target: { value: 'Ramesh Negi' }
    });
    fireEvent.change(screen.getByTestId('create-batch-village'), {
      target: { value: 'Lansdowne' }
    });
    fireEvent.change(screen.getByTestId('create-batch-note'), {
      target: { value: 'Morning harvest' }
    });

    fireEvent.click(screen.getByTestId('create-batch-submit-btn'));

    // While pending, button is disabled and no created banner or toast is shown yet
    expect(screen.getByTestId('create-batch-submit-btn')).toBeDisabled();
    expect(screen.queryByTestId('created-batch-banner')).toBeNull();

    resolveCreate({
      success: true,
      data: {
        id: 'b-new',
        batchCode: 'TX-2026-10-099',
        productName: 'Organic Forest Honey',
        sku: 'OFH-500',
        quantityProduced: 150,
        unit: 'Kg',
        packDate: '2026-10-06',
        expiryDate: '2027-04-06',
        status: 'READY'
      }
    });

    await waitFor(() => {
      expect(screen.getByTestId('created-batch-banner')).toBeInTheDocument();
      expect(screen.getByTestId('created-batch-code')).toHaveTextContent('TX-2026-10-099');
    });
    expect(onCreated).toHaveBeenCalledWith(
      expect.objectContaining({ batchCode: 'TX-2026-10-099' })
    );
  });

  it('handles DispatchDialog out-of-order FEFO override, FLAGGED advisory, and server errors', async () => {
    const dispatchSpy = vi
      .spyOn(Endpoints, 'dispatchBatch')
      .mockRejectedValueOnce(
        new ApiError({
          status: 409,
          code: 'DISPATCH_OUT_OF_ORDER',
          message:
            'Batch TX-2026-10-001 must be dispatched before TX-2026-10-005 (expires earlier). Provide overrideReason to proceed.',
          requestId: 'req-fefo-409'
        })
      )
      .mockResolvedValueOnce({
        success: true,
        data: {
          ...SAMPLE_BATCHES[0]!,
          id: 'b-5',
          batchCode: 'TX-2026-10-005',
          lifecycleState: 'DISPATCHED',
          buyerName: 'Mumbai Distribution Center',
          warning: 'Dispatched with FLAGGED quality inspection'
        }
      });

    const onSuccess = vi.fn();
    renderWithProviders(
      <DispatchDialog
        open
        onClose={vi.fn()}
        onSuccess={onSuccess}
        batch={{
          ...SAMPLE_BATCHES[0]!,
          id: 'b-5',
          batchCode: 'TX-2026-10-005',
          qualityCheck: { status: 'FLAGGED' }
        }}
      />,
      {
        id: 'u-coord',
        name: '[DEMO] Dispatch Coordinator',
        username: 'coordinator',
        email: 'coordinator@tracex.demo',
        role: 'dispatch-coordinator',
        superAdmin: false,
        active: true
      }
    );

    // FLAGGED advisory banner is shown
    expect(screen.getByTestId('dispatch-flagged-advisory')).toBeInTheDocument();

    // Attempt dispatch without overrideReason -> server returns 409 DISPATCH_OUT_OF_ORDER
    fireEvent.change(screen.getByTestId('dispatch-buyer-input'), {
      target: { value: 'Mumbai Distribution Center' }
    });
    fireEvent.click(screen.getByTestId('dispatch-submit-btn'));

    // Error banner shows earlier batch code TX-2026-10-001 and reveals overrideReason textarea
    await waitFor(() => {
      expect(screen.getByTestId('dispatch-error-banner')).toHaveTextContent('TX-2026-10-001');
      expect(screen.getByTestId('dispatch-earlier-batch-code')).toHaveTextContent('TX-2026-10-001');
    });
    expect(screen.getByTestId('dispatch-override-reason-input')).toBeInTheDocument();

    // Provide overrideReason and resubmit
    fireEvent.change(screen.getByTestId('dispatch-override-reason-input'), {
      target: { value: 'Customer requested later lot for long-haul export' }
    });
    fireEvent.click(screen.getByTestId('dispatch-submit-btn'));

    await waitFor(() => {
      expect(dispatchSpy).toHaveBeenLastCalledWith('b-5', {
        buyerName: 'Mumbai Distribution Center',
        overrideReason: 'Customer requested later lot for long-haul export'
      });
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('renders ArchivedBatchesPage and restores an archived batch for admin', async () => {
    vi.spyOn(Endpoints, 'fetchArchivedBatches').mockResolvedValue([
      {
        ...SAMPLE_BATCHES[0]!,
        id: 'b-arch-1',
        batchCode: 'TX-2026-09-099',
        deleted: true,
        deleteNote: 'Damaged pallet',
        deletedBy: 'admin',
        deletedAt: '2026-10-05T10:00:00Z'
      }
    ]);
    const restoreSpy = vi.spyOn(Endpoints, 'restoreBatch').mockResolvedValue({
      success: true,
      data: {
        ...SAMPLE_BATCHES[0]!,
        id: 'b-arch-1',
        batchCode: 'TX-2026-09-099',
        deleted: false
      }
    });

    renderWithProviders(
      <ArchivedBatchesPage />,
      {
        id: 'u-admin',
        name: '[DEMO] Staff Administrator',
        username: 'admin',
        email: 'admin@tracex.demo',
        role: 'admin',
        superAdmin: false,
        active: true
      },
      ['/batches/archived']
    );

    await waitFor(() => {
      expect(screen.getByTestId('archived-code-TX-2026-09-099')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('restore-batch-btn-TX-2026-09-099'));

    await waitFor(() => {
      expect(restoreSpy).toHaveBeenCalledWith('b-arch-1');
    });
  });
});
