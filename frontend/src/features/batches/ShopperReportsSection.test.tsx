import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ShopperReportsSection } from './ShopperReportsSection';
import { ThemeProvider } from '../../hooks/useTheme';
import { ToastProvider } from '../../components/ui';
import * as AuthCtx from '../../auth/AuthContext';
import * as Endpoints from '../../api/endpoints';
import type { ProductReportDto, UserSummaryDto } from '../../api/types';

const INSPECTOR: UserSummaryDto = { id: 'u-qi', username: 'qi', name: 'Quality Inspector', role: 'quality-inspector', superAdmin: false, active: true };
const FACTORY: UserSummaryDto = { id: 'u-fm', username: 'fm', name: 'Factory', role: 'factory-manager', superAdmin: false, active: true };

const REPORTS: ProductReportDto[] = [
  {
    id: 'r1',
    batchId: 'b1',
    batchCode: 'TX-1',
    category: 'FOREIGN_OBJECT',
    message: 'Found a small stone in the jar.',
    contact: 'shopper@example.com',
    status: 'OPEN',
    createdAt: '2026-10-20T10:00:00Z'
  },
  {
    id: 'r2',
    batchId: 'b1',
    batchCode: 'TX-1',
    category: 'PACKAGING',
    message: 'Lid was loose.',
    status: 'RESOLVED',
    createdAt: '2026-10-18T10:00:00Z',
    resolvedAt: '2026-10-19T10:00:00Z',
    resolvedByName: 'Asha',
    resolutionNote: 'Replaced for the shopper'
  }
];

function mockAuth(user: UserSummaryDto) {
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
}

function renderSection() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrap = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>{children}</ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
  return render(<ShopperReportsSection batchId="b1" />, { wrapper: wrap });
}

describe('ShopperReportsSection', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(Endpoints, 'fetchBatchReports').mockResolvedValue(REPORTS);
  });

  it('lists reports with category, contact and resolution, and counts the open ones', async () => {
    mockAuth(INSPECTOR);
    renderSection();
    expect(await screen.findByText('Found a small stone in the jar.')).toBeInTheDocument();
    expect(screen.getByText('Something in the product')).toBeInTheDocument();
    expect(screen.getByText(/shopper@example.com/)).toBeInTheDocument();
    expect(screen.getByText(/Resolved by Asha/)).toBeInTheDocument();
    expect(screen.getByTestId('batch-reports-open-count')).toHaveTextContent('1 open');
  });

  it('lets an inspector resolve an open report with a note', async () => {
    mockAuth(INSPECTOR);
    const resolveSpy = vi.spyOn(Endpoints, 'resolveProductReport').mockResolvedValue({ ...REPORTS[0], status: 'RESOLVED' });
    renderSection();

    fireEvent.click(await screen.findByTestId('batch-report-resolve'));
    fireEvent.change(screen.getByTestId('batch-report-note'), { target: { value: 'Retained sample was clean' } });
    fireEvent.click(screen.getByTestId('batch-report-resolve-confirm'));

    await waitFor(() => expect(resolveSpy).toHaveBeenCalledWith('r1', 'Retained sample was clean'));
  });

  it('shows no resolve button to a role that cannot resolve', async () => {
    mockAuth(FACTORY);
    renderSection();
    expect(await screen.findByText('Found a small stone in the jar.')).toBeInTheDocument();
    expect(screen.queryByTestId('batch-report-resolve')).not.toBeInTheDocument();
  });
});
