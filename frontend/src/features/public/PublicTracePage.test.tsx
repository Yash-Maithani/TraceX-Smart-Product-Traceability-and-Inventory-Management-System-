import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe } from 'vitest-axe';
import { PublicTracePage } from './PublicTracePage';
import { LegacyTracePage } from './LegacyTracePage';
import { ThemeProvider } from '../../hooks/useTheme';
import { ToastProvider } from '../../components/ui';
import * as Endpoints from '../../api/endpoints';
import { ApiError } from '../../api/client';
import type { PublicTraceDto } from '../../api/types';

const SAMPLE_PUBLIC_TRACE: PublicTraceDto = {
  batchCode: 'TX-2026-10-001',
  productName: 'Organic Forest Honey',
  sku: 'OFH-500',
  village: 'Lansdowne',
  packDate: '2026-04-01',
  expiryDate: '2026-10-10',
  status: 'URGENT',
  qualityCheck: {
    status: 'PASSED',
    rating: 5,
    inspectedAt: '2026-04-02T10:00:00Z'
  },
  traceabilityNote: 'Certified natural wildflower nectar.'
};

const SAMPLE_TRACE_NO_QUALITY: PublicTraceDto = {
  batchCode: 'TX-2026-10-002',
  productName: 'Kashmiri Garlic Cloves',
  sku: 'KMGC-200',
  village: 'Pampore',
  packDate: '2026-09-01',
  expiryDate: '2026-12-01',
  status: 'READY'
};

function renderTracePage(route: string, strictMode = false) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  const content = (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={[route]}>
            <Routes>
              <Route path="/trace/t/:token" element={<PublicTracePage />} />
              <Route path="/trace/:code" element={<LegacyTracePage />} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );

  return render(strictMode ? <React.StrictMode>{content}</React.StrictMode> : content);
}

describe('PublicTracePage & LegacyTracePage (Phase 7 Part C & D)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
  });

  it('renders loading skeleton while query is pending', () => {
    vi.spyOn(Endpoints, 'fetchPublicTrace').mockImplementation(() => new Promise(() => {}));
    renderTracePage('/trace/t/token-loading.tag');
    expect(screen.getByLabelText(/Loading batch traceability details/i)).toBeInTheDocument();
  });

  it('renders complete public trace data with quality check, fires scan event once without auth, and passes axe', async () => {
    const traceSpy = vi
      .spyOn(Endpoints, 'fetchPublicTrace')
      .mockResolvedValue(SAMPLE_PUBLIC_TRACE);
    const scanSpy = vi
      .spyOn(Endpoints, 'recordPublicScan')
      .mockResolvedValue(undefined);

    const { container } = renderTracePage('/trace/t/valid-nonce.valid-tag');

    await waitFor(() => {
      expect(screen.getByTestId('trace-batch-code')).toHaveTextContent('TX-2026-10-001');
    });

    expect(traceSpy).toHaveBeenCalledWith('valid-nonce.valid-tag');
    expect(scanSpy).toHaveBeenCalledWith({
      token: 'valid-nonce.valid-tag',
      source: 'buyer'
    });
    // sessionStorage must not have been accessed
    expect(window.sessionStorage.getItem('tx_token')).toBeNull();

    // Field assertions
    expect(screen.getByTestId('trace-product-name')).toHaveTextContent('Organic Forest Honey');
    expect(screen.getByTestId('trace-sku')).toHaveTextContent('OFH-500');
    expect(screen.getByTestId('trace-village')).toHaveTextContent('Lansdowne');
    expect(screen.getByTestId('trace-pack-date')).toHaveTextContent('Apr 1, 2026');
    expect(screen.getByTestId('trace-expiry-date')).toHaveTextContent('Oct 10, 2026');
    expect(screen.getByTestId('trace-quality-section')).toBeInTheDocument();
    expect(screen.getByTestId('trace-quality-rating')).toHaveTextContent('Rating: 5/5');
    expect(screen.getByTestId('trace-note')).toHaveTextContent('Certified natural wildflower nectar.');

    // Forbidden PII & internal field checks: MUST NOT be in DOM
    expect(screen.queryByText(/farmer/i)).toBeNull();
    expect(screen.queryByText(/inspector/i)).toBeNull();
    expect(screen.queryByText(/valid-nonce\.valid-tag/)).toBeNull();
    expect(screen.queryByText(/_id|mongo/i)).toBeNull();

    // Accessibility check
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('renders success for READY, DISPATCHED, and EXCEPTION (expiry shown as dash, no crash)', async () => {
    // 1. DISPATCHED batch
    const dispatchedBatch: PublicTraceDto = {
      ...SAMPLE_PUBLIC_TRACE,
      batchCode: 'TX-DISPATCHED-001',
      status: 'DISPATCHED'
    };
    vi.spyOn(Endpoints, 'fetchPublicTrace').mockResolvedValueOnce(dispatchedBatch);
    vi.spyOn(Endpoints, 'recordPublicScan').mockResolvedValue(undefined);

    const { unmount: u1 } = renderTracePage('/trace/t/token-dispatched.tag');
    await waitFor(() => {
      expect(screen.getByTestId('trace-batch-code')).toHaveTextContent('TX-DISPATCHED-001');
    });
    expect(screen.getByTestId('trace-status-badge')).toHaveTextContent(/Dispatched/i);
    u1();

    // 2. EXCEPTION batch (corrupted/missing date -> expiryDate is null)
    const exceptionBatch: PublicTraceDto = {
      ...SAMPLE_PUBLIC_TRACE,
      batchCode: 'TX-EXCEPTION-001',
      status: 'EXCEPTION',
      expiryDate: null as unknown as string
    };
    vi.spyOn(Endpoints, 'fetchPublicTrace').mockResolvedValueOnce(exceptionBatch);

    const { unmount: u2 } = renderTracePage('/trace/t/token-exception.tag');
    await waitFor(() => {
      expect(screen.getByTestId('trace-batch-code')).toHaveTextContent('TX-EXCEPTION-001');
    });
    expect(screen.getByTestId('trace-status-badge')).toHaveTextContent(/Exception/i);
    // Expiry date rendered as a dash
    expect(screen.getByTestId('trace-expiry-date')).toHaveTextContent('—');
    u2();
  });

  it('renders trace data without quality check or note when they are null', async () => {
    vi.spyOn(Endpoints, 'fetchPublicTrace').mockResolvedValue(SAMPLE_TRACE_NO_QUALITY);
    vi.spyOn(Endpoints, 'recordPublicScan').mockResolvedValue(undefined);

    renderTracePage('/trace/t/sample-token.tag');

    await waitFor(() => {
      expect(screen.getByTestId('trace-batch-code')).toHaveTextContent('TX-2026-10-002');
    });

    expect(screen.queryByTestId('trace-quality-section')).toBeNull();
    expect(screen.queryByTestId('trace-note-section')).toBeNull();
  });

  it('renders 404 empty state for forged, unknown, or archived token with exact error text', async () => {
    vi.spyOn(Endpoints, 'fetchPublicTrace').mockRejectedValue(
      new ApiError({
        status: 404,
        code: 'NOT_FOUND',
        message: 'Batch not found or unavailable'
      })
    );
    const scanSpy = vi.spyOn(Endpoints, 'recordPublicScan');

    renderTracePage('/trace/t/forged-nonce.invalid-tag');

    await waitFor(() => {
      expect(screen.getByTestId('trace-404-state')).toBeInTheDocument();
    });

    expect(
      screen.getByText('This QR link is not valid or the batch is no longer available.')
    ).toBeInTheDocument();
    expect(scanSpy).not.toHaveBeenCalled();
    expect(screen.queryByTestId('trace-batch-code')).toBeNull();
  });

  it('renders network error state on API failure with a working retry button', async () => {
    const traceSpy = vi
      .spyOn(Endpoints, 'fetchPublicTrace')
      .mockRejectedValueOnce(
        new ApiError({
          status: 500,
          code: 'INTERNAL_ERROR',
          message: 'Server unreachable'
        })
      )
      .mockResolvedValueOnce(SAMPLE_PUBLIC_TRACE);
    vi.spyOn(Endpoints, 'recordPublicScan').mockResolvedValue(undefined);

    renderTracePage('/trace/t/valid-token.tag');

    await waitFor(() => {
      expect(screen.getByTestId('trace-error-state')).toBeInTheDocument();
    });

    // Working retry button refetches trace data
    const retryBtn = screen.getByRole('button', { name: /Try again/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByTestId('trace-batch-code')).toHaveTextContent('TX-2026-10-001');
    });
    expect(traceSpy).toHaveBeenCalledTimes(2);
  });

  it('calls recordPublicScan exactly once even under React.StrictMode', async () => {
    vi.spyOn(Endpoints, 'fetchPublicTrace').mockResolvedValue(SAMPLE_PUBLIC_TRACE);
    const scanSpy = vi.spyOn(Endpoints, 'recordPublicScan').mockResolvedValue(undefined);

    renderTracePage('/trace/t/strict-mode.tag', true);

    await waitFor(() => {
      expect(screen.getByTestId('trace-batch-code')).toHaveTextContent('TX-2026-10-001');
    });

    expect(scanSpy).toHaveBeenCalledTimes(1);
  });

  it('leaves page unchanged and shows no toast when background scan POST fails', async () => {
    vi.spyOn(Endpoints, 'fetchPublicTrace').mockResolvedValue(SAMPLE_PUBLIC_TRACE);
    vi.spyOn(Endpoints, 'recordPublicScan').mockRejectedValue(new Error('Scan recorder down'));

    renderTracePage('/trace/t/scan-fail.tag');

    await waitFor(() => {
      expect(screen.getByTestId('trace-batch-code')).toHaveTextContent('TX-2026-10-001');
    });

    // Page renders normally
    expect(screen.getByTestId('trace-product-name')).toHaveTextContent('Organic Forest Honey');
    // Zero toast banners shown
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('manages robots noindex, nofollow meta tag on mount and cleanup', async () => {
    vi.spyOn(Endpoints, 'fetchPublicTrace').mockResolvedValue(SAMPLE_PUBLIC_TRACE);
    vi.spyOn(Endpoints, 'recordPublicScan').mockResolvedValue(undefined);

    const { unmount } = renderTracePage('/trace/t/token-123.tag');

    const meta = document.querySelector('meta[name="robots"]');
    expect(meta).not.toBeNull();
    expect(meta?.getAttribute('content')).toBe('noindex, nofollow');

    unmount();
    // After unmount, the created tag is cleaned up
    const metaAfter = document.querySelector('meta[name="robots"]');
    expect(metaAfter).toBeNull();
  });

  it('renders LegacyTracePage for /trace/:code without making any API calls', async () => {
    const traceSpy = vi.spyOn(Endpoints, 'fetchPublicTrace');
    const scanSpy = vi.spyOn(Endpoints, 'recordPublicScan');

    renderTracePage('/trace/TX-2026-10-001');

    expect(screen.getByTestId('legacy-trace-deprecation')).toBeInTheDocument();
    expect(
      screen.getByText(/Direct batch code lookup URLs have been deprecated/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/TX-2026-10-001/)).toBeInTheDocument();

    // Proves zero API calls made
    expect(traceSpy).not.toHaveBeenCalled();
    expect(scanSpy).not.toHaveBeenCalled();
  });
});
