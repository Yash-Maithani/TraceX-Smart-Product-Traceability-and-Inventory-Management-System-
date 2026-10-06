import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe } from 'vitest-axe';
import { DashboardPage } from './DashboardPage';
import { ThemeProvider } from '../../hooks/useTheme';
import { ToastProvider } from '../../components/ui';
import * as AuthCtx from '../../auth/AuthContext';
import * as Endpoints from '../../api/endpoints';
import { ApiError } from '../../api/client';
import type { DashboardSummaryDto, UserSummaryDto } from '../../api/types';

function renderDashboard(user: UserSummaryDto) {
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
          <MemoryRouter initialEntries={['/']}>
            <DashboardPage />
          </MemoryRouter>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

const SAMPLE_SUMMARY: DashboardSummaryDto = {
  businessDate: '2026-10-06',
  totalActive: 10,
  expired: 1,
  urgent: 2,
  warning: 3,
  ready: 3,
  exception: 1,
  dispatched: 2,
  inspectionVerdicts: {
    PASSED: 5,
    FAILED: 1,
    FLAGGED: 2,
    none: 2
  },
  topExpiring: [
    {
      rank: 1,
      id: 'b-urg-1',
      batchCode: 'TX-2026-10-001',
      productName: 'Organic Forest Honey',
      sku: 'OFH-500',
      quantityProduced: 120,
      unit: 'Kg',
      packDate: '2026-04-01',
      expiryDate: '2026-10-10',
      status: 'URGENT',
      daysUntilExpiry: 4,
      qualityCheck: { status: 'PASSED' }
    }
  ],
  pendingAccessRequests: 3
};

describe('DashboardPage (Phase 6 Part D)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading skeleton while dashboard summary is pending', () => {
    vi.spyOn(Endpoints, 'fetchDashboardSummary').mockReturnValue(new Promise(() => {}));
    renderDashboard({
      id: 'u1',
      name: '[DEMO] Operations Manager',
      username: 'manager',
      email: 'manager@tracex.demo',
      role: 'manager',
      superAdmin: false,
      active: true
    });

    expect(screen.getByLabelText(/Loading dashboard summary/i)).toBeInTheDocument();
  });

  it('renders error state with requestId and retries on click', async () => {
    const spy = vi
      .spyOn(Endpoints, 'fetchDashboardSummary')
      .mockRejectedValueOnce(
        new ApiError({
          status: 503,
          code: 'SERVICE_UNAVAILABLE',
          message: 'Database unavailable',
          requestId: 'req-503-abc'
        })
      )
      .mockResolvedValueOnce(SAMPLE_SUMMARY);

    renderDashboard({
      id: 'u1',
      name: '[DEMO] Operations Manager',
      username: 'manager',
      email: 'manager@tracex.demo',
      role: 'manager',
      superAdmin: false,
      active: true
    });

    await waitFor(() => {
      expect(screen.getByText('Unable to load dashboard summary')).toBeInTheDocument();
    });
    expect(screen.getByText(/req-503-abc/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Try again/i }));

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-summary-ready')).toBeInTheDocument();
    });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('renders empty state when totalActive and dispatched are both 0', async () => {
    vi.spyOn(Endpoints, 'fetchDashboardSummary').mockResolvedValue({
      ...SAMPLE_SUMMARY,
      totalActive: 0,
      expired: 0,
      urgent: 0,
      warning: 0,
      ready: 0,
      exception: 0,
      dispatched: 0,
      topExpiring: []
    });

    renderDashboard({
      id: 'u1',
      name: '[DEMO] Operations Manager',
      username: 'manager',
      email: 'manager@tracex.demo',
      role: 'manager',
      superAdmin: false,
      active: true
    });

    await waitFor(() => {
      expect(screen.getByText('No batches recorded yet')).toBeInTheDocument();
    });
  });

  it('renders server-computed freshness tiers, inspection verdicts, FEFO top 5, and role-scoped pending access requests, and passes vitest-axe', async () => {
    vi.spyOn(Endpoints, 'fetchDashboardSummary').mockResolvedValue(SAMPLE_SUMMARY);

    const { container } = renderDashboard({
      id: 'u1',
      name: '[DEMO] Operations Manager',
      username: 'manager',
      email: 'manager@tracex.demo',
      role: 'manager',
      superAdmin: false,
      active: true
    });

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-summary-ready')).toBeInTheDocument();
    });

    expect(screen.getByTestId('dashboard-count-EXPIRED')).toHaveTextContent('1');
    expect(screen.getByTestId('dashboard-count-URGENT')).toHaveTextContent('2');
    expect(screen.getByTestId('dashboard-count-WARNING')).toHaveTextContent('3');
    expect(screen.getByTestId('dashboard-count-READY')).toHaveTextContent('3');
    expect(screen.getByTestId('dashboard-count-EXCEPTION')).toHaveTextContent('1');
    expect(screen.getByTestId('dashboard-count-DISPATCHED')).toHaveTextContent('2');

    expect(screen.getByTestId('dashboard-metric-URGENT')).toHaveAttribute(
      'href',
      '/batches?status=URGENT'
    );

    expect(screen.getByTestId('verdict-count-PASSED')).toHaveTextContent('5');
    expect(screen.getByTestId('verdict-count-FAILED')).toHaveTextContent('1');
    expect(screen.getByTestId('verdict-count-FLAGGED')).toHaveTextContent('2');
    expect(screen.getByTestId('verdict-count-none')).toHaveTextContent('2');

    expect(screen.getByTestId('top-expiring-item-TX-2026-10-001')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-pending-requests')).toBeInTheDocument();
    expect(screen.getByTestId('pending-requests-count')).toHaveTextContent('3');

    fireEvent.click(screen.getByTestId('verify-session-btn'));

    const axeResults = await axe(container);
    expect(axeResults.violations).toEqual([]);
  });

  it('hides pendingAccessRequests card when pendingAccessRequests is null for lower roles', async () => {
    vi.spyOn(Endpoints, 'fetchDashboardSummary').mockResolvedValue({
      ...SAMPLE_SUMMARY,
      pendingAccessRequests: null
    });

    renderDashboard({
      id: 'u2',
      name: '[DEMO] Quality Inspector',
      username: 'inspector',
      email: 'inspector@tracex.demo',
      role: 'quality-inspector',
      superAdmin: false,
      active: true
    });

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-summary-ready')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('dashboard-pending-requests')).toBeNull();
  });
});
