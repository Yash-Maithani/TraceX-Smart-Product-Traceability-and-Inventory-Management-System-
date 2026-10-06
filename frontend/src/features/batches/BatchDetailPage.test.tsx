import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BatchDetailPage } from './BatchDetailPage';
import { ThemeProvider } from '../../hooks/useTheme';
import { ToastProvider } from '../../components/ui';
import { axe } from 'vitest-axe';
import * as AuthCtx from '../../auth/AuthContext';
import * as Endpoints from '../../api/endpoints';
import type { BatchDetailDto, BatchQrDto, BatchScansDto, InspectionDto, UserSummaryDto } from '../../api/types';

const SAMPLE_QR: BatchQrDto = {
  qrCodeDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  qrAbsoluteUrl: 'https://tracex.example.com/trace/t/mock-nonce.mock-tag'
};

const SAMPLE_SCANS: BatchScansDto = {
  total: 6,
  lastScannedAt: '2026-10-06T09:30:00Z',
  byDevice: {
    Mobile: 3,
    Tablet: 1,
    Desktop: 2,
    Unknown: 0
  },
  bySource: {
    buyer: 4,
    factory: 1,
    QA: 1
  }
};

const SAMPLE_BATCH_DETAIL: BatchDetailDto = {
  id: 'b-detail-1',
  batchCode: 'TX-2026-10-001',
  productName: 'Organic Forest Honey',
  sku: 'OFH-500',
  quantityProduced: 120,
  unit: 'Kg',
  yieldPercent: 85,
  packDate: '2026-04-01',
  expiryDate: '2026-10-10',
  status: 'URGENT',
  lifecycleState: 'PACKED',
  daysUntilExpiry: 4,
  sourceLotCode: 'LOT-RMH-01',
  farmerName: 'Kaveri Apiary Co-op',
  village: 'Lansdowne',
  traceabilityNote: 'Initial filtration complete',
  qualityCheck: {
    status: 'PASSED',
    rating: 5,
    inspectorName: '[DEMO] Quality Inspector',
    inspectedAt: '2026-04-02T10:00:00Z'
  },
  noteHistory: [
    {
      note: 'Initial filtration complete',
      editedBy: '[DEMO] Factory Manager',
      editedAt: '2026-04-01T11:00:00Z'
    }
  ],
  dispatchHistory: [
    {
      buyerName: 'Bengaluru South Hub',
      dispatchedBy: '[DEMO] Dispatch Coordinator',
      dispatchDate: '2026-10-05',
      dispatchedAt: '2026-10-05T14:20:00Z',
      outOfOrder: true,
      overrideReason: 'Destination urgent order'
    }
  ]
};

const SAMPLE_INSPECTIONS: InspectionDto[] = [
  {
    id: 'insp-1',
    batchId: 'b-detail-1',
    batchCode: 'TX-2026-10-001',
    productName: 'Organic Forest Honey',
    sku: 'OFH-500',
    status: 'PASSED',
    rating: 5,
    isLatest: true,
    findings: 'All parameters within specification',
    recommendation: 'Release for FEFO dispatch',
    createdAt: '2026-04-02T10:00:00Z',
    inspectedBy: {
      userId: 'u-insp',
      name: '[DEMO] Quality Inspector',
      username: 'inspector'
    },
    checklist: [{ label: 'Packaging & Seal Integrity', passed: true }]
  }
];

function renderDetail(user: UserSummaryDto) {
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
          <MemoryRouter initialEntries={['/batches/b-detail-1']}>
            <Routes>
              <Route path="/batches/:id" element={<BatchDetailPage />} />
              <Route
                path="/batches/archived"
                element={<div data-testid="archived-redirect">Archived</div>}
              />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

describe('BatchDetailPage (Phase 6 Part D)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders batch overview, raw material correction, note update, archive dialog, and inspection history for admin', async () => {
    vi.spyOn(Endpoints, 'fetchBatchDetail').mockResolvedValue(SAMPLE_BATCH_DETAIL);
    vi.spyOn(Endpoints, 'fetchBatchInspections').mockResolvedValue(SAMPLE_INSPECTIONS);
    const noteSpy = vi.spyOn(Endpoints, 'updateBatchNote').mockResolvedValue({
      success: true,
      data: SAMPLE_BATCH_DETAIL
    });
    const rawMatSpy = vi.spyOn(Endpoints, 'updateBatchRawMaterial').mockResolvedValue({
      success: true,
      data: SAMPLE_BATCH_DETAIL
    });
    const archiveSpy = vi.spyOn(Endpoints, 'archiveBatch').mockResolvedValue({
      success: true,
      data: { ...SAMPLE_BATCH_DETAIL, deleted: true }
    });

    renderDetail({
      id: 'u-admin',
      name: '[DEMO] Staff Administrator',
      username: 'admin',
      email: 'admin@tracex.demo',
      role: 'admin',
      superAdmin: false,
      active: true
    });

    await waitFor(() => {
      expect(screen.getByTestId('batch-overview-section')).toBeInTheDocument();
    });

    expect(screen.getByTestId('detail-batch-code')).toHaveTextContent('TX-2026-10-001');
    expect(screen.getByTestId('batch-dispatch-history-list')).toBeInTheDocument();
    expect(screen.getByTestId('batch-inspections-list')).toBeInTheDocument();

    // Correct raw material
    fireEvent.click(screen.getByTestId('open-raw-material-btn'));
    fireEvent.change(screen.getByTestId('raw-quantity'), { target: { value: '130' } });
    fireEvent.change(screen.getByTestId('raw-reason'), {
      target: { value: 'Recounted pallet weight' }
    });
    fireEvent.click(screen.getByTestId('save-raw-material-btn'));

    await waitFor(() => {
      expect(rawMatSpy).toHaveBeenCalledWith(
        'b-detail-1',
        expect.objectContaining({
          quantityProduced: 130
        })
      );
    });

    // Save note
    fireEvent.change(screen.getByTestId('batch-note-input'), {
      target: { value: 'Pallet shrink-wrapped for dispatch' }
    });
    fireEvent.click(screen.getByTestId('save-batch-note-btn'));

    await waitFor(() => {
      expect(noteSpy).toHaveBeenCalledWith('b-detail-1', {
        note: 'Pallet shrink-wrapped for dispatch'
      });
    });

    // Archive batch
    fireEvent.click(screen.getByTestId('open-archive-dialog-btn'));
    fireEvent.change(screen.getByLabelText(/Archive Reason/i), {
      target: { value: 'Test archive cleanup' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Archive Batch' }));

    await waitFor(() => {
      expect(archiveSpy).toHaveBeenCalledWith('b-detail-1', {
        reason: 'Test archive cleanup',
        deleteNote: 'Test archive cleanup'
      });
      expect(screen.getByTestId('archived-redirect')).toBeInTheDocument();
    });
  });

  it('hides note, raw material, and archive controls for dispatch-coordinator while showing Dispatch button', async () => {
    vi.spyOn(Endpoints, 'fetchBatchDetail').mockResolvedValue(SAMPLE_BATCH_DETAIL);

    renderDetail({
      id: 'u-coord',
      name: '[DEMO] Dispatch Coordinator',
      username: 'coordinator',
      email: 'coordinator@tracex.demo',
      role: 'dispatch-coordinator',
      superAdmin: false,
      active: true
    });

    await waitFor(() => {
      expect(screen.getByTestId('batch-overview-section')).toBeInTheDocument();
    });

    expect(screen.getByTestId('open-dispatch-dialog-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('open-raw-material-btn')).toBeNull();
    expect(screen.queryByTestId('open-archive-dialog-btn')).toBeNull();
    expect(screen.queryByTestId('save-batch-note-btn')).toBeNull();
    expect(screen.getByTestId('inspections-role-restricted-msg')).toBeInTheDocument();
  });

  it('renders QR code and scans sections with data, supports copy and download, and passes axe', async () => {
    vi.spyOn(Endpoints, 'fetchBatchDetail').mockResolvedValue(SAMPLE_BATCH_DETAIL);
    vi.spyOn(Endpoints, 'fetchBatchInspections').mockResolvedValue(SAMPLE_INSPECTIONS);
    vi.spyOn(Endpoints, 'fetchBatchQr').mockResolvedValue(SAMPLE_QR);
    vi.spyOn(Endpoints, 'fetchBatchScans').mockResolvedValue(SAMPLE_SCANS);

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock }
    });

    const { container } = renderDetail({
      id: 'u-fm',
      name: '[DEMO] Factory Manager',
      username: 'factory_mgr',
      email: 'factory@tracex.demo',
      role: 'factory-manager',
      superAdmin: false,
      active: true
    });

    await waitFor(() => {
      expect(screen.getByTestId('batch-qr-section')).toBeInTheDocument();
      expect(screen.getByTestId('batch-scans-section')).toBeInTheDocument();
    });

    // QR section verification
    const img = screen.getByTestId('batch-qr-image');
    expect(img).toHaveAttribute('alt', 'QR code for batch TX-2026-10-001');
    expect(img).toHaveAttribute('src', SAMPLE_QR.qrCodeDataUrl!);
    expect(screen.getByTestId('qr-absolute-url')).toHaveTextContent(SAMPLE_QR.qrAbsoluteUrl!);

    // Copy action
    fireEvent.click(screen.getByTestId('copy-qr-url-btn'));
    expect(writeTextMock).toHaveBeenCalledWith(SAMPLE_QR.qrAbsoluteUrl);

    // Open link check
    const openLink = screen.getByTestId('open-public-trace-link');
    expect(openLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(openLink).toHaveAttribute('href', SAMPLE_QR.qrAbsoluteUrl);

    // Download action
    const clickSpy = vi.fn();
    let downloadFileName = '';
    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = origCreateElement(tagName);
      if (tagName === 'a') {
        el.click = clickSpy;
        Object.defineProperty(el, 'download', {
          set(val) { downloadFileName = val; },
          get() { return downloadFileName; }
        });
      }
      return el;
    });

    fireEvent.click(screen.getByTestId('download-qr-btn'));
    expect(clickSpy).toHaveBeenCalled();
    expect(downloadFileName).toBe('TX-2026-10-001-qr.png');

    // Scans section verification
    expect(screen.getByTestId('scans-total')).toHaveTextContent('6');
    expect(screen.getByTestId('scans-device-mobile')).toHaveTextContent('3');
    expect(screen.getByTestId('scans-device-tablet')).toHaveTextContent('1');
    expect(screen.getByTestId('scans-device-desktop')).toHaveTextContent('2');
    expect(screen.getByTestId('scans-source-buyer')).toHaveTextContent('4');
    expect(screen.getByTestId('scans-source-factory')).toHaveTextContent('1');
    expect(screen.getByTestId('scans-source-qa')).toHaveTextContent('1');

    // Accessibility check specifically on QR section
    const qrSection = screen.getByTestId('batch-qr-section');
    const qrAxeResults = await axe(qrSection);
    expect(qrAxeResults).toHaveNoViolations();

    // Overall accessibility check
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('renders QR error state and retries on button click', async () => {
    vi.spyOn(Endpoints, 'fetchBatchDetail').mockResolvedValue(SAMPLE_BATCH_DETAIL);
    vi.spyOn(Endpoints, 'fetchBatchInspections').mockResolvedValue(SAMPLE_INSPECTIONS);
    const qrSpy = vi.spyOn(Endpoints, 'fetchBatchQr')
      .mockRejectedValueOnce(new Error('Network offline'))
      .mockResolvedValueOnce(SAMPLE_QR);
    vi.spyOn(Endpoints, 'fetchBatchScans').mockResolvedValue(SAMPLE_SCANS);

    renderDetail({
      id: 'u-fm',
      name: '[DEMO] Factory Manager',
      username: 'factory_mgr',
      email: 'factory@tracex.demo',
      role: 'factory-manager',
      superAdmin: false,
      active: true
    });

    await waitFor(() => {
      expect(screen.getByText('Unable to load QR code')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Try again/i }));

    await waitFor(() => {
      expect(screen.getByTestId('batch-qr-image')).toBeInTheDocument();
    });
    expect(qrSpy).toHaveBeenCalledTimes(2);
  });

  it('renders empty state when batch has 0 scans recorded', async () => {
    vi.spyOn(Endpoints, 'fetchBatchDetail').mockResolvedValue(SAMPLE_BATCH_DETAIL);
    vi.spyOn(Endpoints, 'fetchBatchInspections').mockResolvedValue(SAMPLE_INSPECTIONS);
    vi.spyOn(Endpoints, 'fetchBatchQr').mockResolvedValue(SAMPLE_QR);
    vi.spyOn(Endpoints, 'fetchBatchScans').mockResolvedValue({
      total: 0,
      byDevice: { Mobile: 0, Tablet: 0, Desktop: 0, Unknown: 0 },
      bySource: { buyer: 0, factory: 0, QA: 0 }
    });

    renderDetail({
      id: 'u-admin',
      name: '[DEMO] Admin',
      username: 'admin',
      email: 'admin@tracex.demo',
      role: 'admin',
      superAdmin: false,
      active: true
    });

    await waitFor(() => {
      expect(screen.getByTestId('scans-empty-state')).toBeInTheDocument();
    });

    expect(screen.getByText('No scans recorded yet')).toBeInTheDocument();
  });
});
