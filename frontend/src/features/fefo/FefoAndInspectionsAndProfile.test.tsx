import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FefoPage } from './FefoPage';
import { InspectionsPage } from '../inspections/InspectionsPage';
import { ProfilePage } from '../profile/ProfilePage';
import { ThemeProvider } from '../../hooks/useTheme';
import { ToastProvider } from '../../components/ui';
import * as AuthCtx from '../../auth/AuthContext';
import * as Endpoints from '../../api/endpoints';
import { ApiError } from '../../api/client';
import type { UserSummaryDto } from '../../api/types';

function renderWithAuth(ui: React.ReactNode, user: UserSummaryDto) {
  const refreshSession = vi.fn().mockResolvedValue(undefined);
  const setAuthenticatedSession = vi.fn();
  vi.spyOn(AuthCtx, 'useAuth').mockReturnValue({
    user,
    token: 'mock-token',
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    setAuthenticatedSession,
    logout: vi.fn(),
    logoutAll: vi.fn(),
    refreshSession
  });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  return {
    refreshSession,
    setAuthenticatedSession,
    ...render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ToastProvider>
            <MemoryRouter>{ui}</MemoryRouter>
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    )
  };
}

describe('FefoPage, InspectionsPage, and ProfilePage (Phase 6 Part D)', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders FefoPage ranked queue, expired list, exceptions list, and opens DispatchDialog', async () => {
    vi.spyOn(Endpoints, 'fetchProducts').mockResolvedValue([
      { id: 'p-1', sku: 'OFH-500', productName: 'Organic Forest Honey', category: 'Honey' }
    ]);
    vi.spyOn(Endpoints, 'fetchFefoQueue').mockResolvedValue({
      queue: [
        {
          rank: 1,
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
          qualityCheck: { status: 'PASSED' }
        },
        {
          rank: 2,
          id: 'b-2',
          batchCode: 'TX-2026-10-005',
          productName: 'Organic Forest Honey',
          sku: 'OFH-500',
          quantityProduced: 80,
          unit: 'Kg',
          packDate: '2026-05-01',
          expiryDate: '2026-11-15',
          status: 'READY',
          daysUntilExpiry: 40,
          qualityCheck: { status: 'PASSED' }
        }
      ],
      expired: [
        {
          id: 'b-exp',
          batchCode: 'TX-2026-10-011',
          productName: 'Expired Jam',
          sku: 'EJ-100',
          expiryDate: '2026-09-01',
          status: 'EXPIRED',
          daysUntilExpiry: -35
        }
      ],
      exceptions: [
        {
          id: 'b-exc',
          batchCode: 'TX-2026-10-012',
          productName: 'Corrupted Lot',
          sku: 'CL-100',
          status: 'EXCEPTION',
          exceptionReason: 'Unparseable expiryDate'
        }
      ]
    });

    renderWithAuth(<FefoPage />, {
      id: 'u-coord',
      name: '[DEMO] Dispatch Coordinator',
      username: 'coordinator',
      email: 'coordinator@tracex.demo',
      role: 'dispatch-coordinator',
      superAdmin: false,
      active: true
    });

    await waitFor(() => {
      expect(screen.getByTestId('fefo-rank-TX-2026-10-001')).toHaveTextContent('#1');
    });

    expect(screen.getByTestId('fefo-expired-item-TX-2026-10-011')).toBeInTheDocument();
    expect(screen.getByTestId('fefo-exception-item-TX-2026-10-012')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('fefo-dispatch-btn-TX-2026-10-001'));
    expect(screen.getByTestId('dispatch-buyer-input')).toBeInTheDocument();
  });

  it('renders InspectionsPage tabs, filters, read-only detail dialog, and Record Inspection dialog with 422 checklist error', async () => {
    vi.spyOn(Endpoints, 'fetchInspections').mockResolvedValue({
      data: [
        {
          id: 'insp-1',
          batchId: 'b-1',
          batchCode: 'TX-2026-10-001',
          productName: 'Organic Forest Honey',
          sku: 'OFH-500',
          status: 'PASSED',
          rating: 5,
          findings: 'Verified clean seals',
          recommendation: 'Release for dispatch',
          createdAt: '2026-10-05T09:00:00Z',
          inspectedBy: { userId: 'u-insp', name: '[DEMO] Quality Inspector', username: 'inspector' },
          checklist: [{ label: 'Packaging & Seal Integrity', passed: true, note: 'Intact' }]
        }
      ],
      total: 1,
      page: 1,
      limit: 20,
      count: 1
    });
    vi.spyOn(Endpoints, 'fetchMyInspections').mockResolvedValue([]);
    vi.spyOn(Endpoints, 'fetchBatches').mockResolvedValue({
      data: [
        {
          id: 'b-1',
          batchCode: 'TX-2026-10-001',
          productName: 'Organic Forest Honey',
          sku: 'OFH-500',
          quantityProduced: 100,
          unit: 'Kg',
          packDate: '2026-04-01',
          expiryDate: '2026-10-10',
          status: 'URGENT'
        }
      ],
      total: 1,
      page: 1,
      limit: 100,
      count: 1
    });
    const createSpy = vi
      .spyOn(Endpoints, 'createInspection')
      .mockRejectedValueOnce(
        new ApiError({
          status: 422,
          code: 'VALIDATION_ERROR',
          message: 'Cannot mark inspection as PASSED when one or more checklist items failed',
          fieldErrors: [
            {
              field: 'checklist',
              message: 'Cannot mark inspection as PASSED when one or more checklist items failed'
            }
          ]
        })
      )
      .mockResolvedValueOnce({
        success: true,
        data: {
          id: 'insp-2',
          batchId: 'b-1',
          batchCode: 'TX-2026-10-001',
          status: 'FAILED',
          rating: 2
        }
      });

    renderWithAuth(<InspectionsPage />, {
      id: 'u-insp',
      name: '[DEMO] Quality Inspector',
      username: 'inspector',
      email: 'inspector@tracex.demo',
      role: 'quality-inspector',
      superAdmin: false,
      active: true
    });

    await waitFor(() => {
      expect(screen.getByTestId('view-inspection-btn-TX-2026-10-001')).toBeInTheDocument();
    });

    // Open read-only inspection record
    fireEvent.click(screen.getByTestId('view-inspection-btn-TX-2026-10-001'));
    expect(screen.getByTestId('inspection-readonly-detail')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    // Open Record Inspection dialog
    fireEvent.click(screen.getByTestId('open-create-inspection-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('inspection-batch-select')).toHaveValue('b-1');
    });

    // Mark item 0 as Fail while verdict is PASSED -> server returns 422
    fireEvent.click(screen.getByTestId('checklist-fail-0'));
    fireEvent.change(screen.getByTestId('checklist-note-0'), {
      target: { value: 'Broken cap seal' }
    });
    fireEvent.click(screen.getByTestId('submit-inspection-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('create-inspection-error')).toHaveTextContent(
        /Cannot mark inspection as PASSED/i
      );
    });

    // Switch verdict to FAILED and submit
    fireEvent.change(screen.getByTestId('inspection-verdict-select'), {
      target: { value: 'FAILED' }
    });
    fireEvent.change(screen.getByTestId('inspection-findings-input'), {
      target: { value: 'Broken cap seal on sample #3' }
    });
    fireEvent.click(screen.getByTestId('submit-inspection-btn'));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledTimes(2);
    });
  });

  it('updates profile details and rotates sessionStorage JWT on password change in ProfilePage', async () => {
    const profileSpy = vi.spyOn(Endpoints, 'updateMyProfile').mockResolvedValue({
      success: true,
      data: {
        id: 'u-mgr',
        name: 'Meera Krishnan',
        username: 'manager',
        email: 'meera@tracex.demo',
        role: 'manager',
        phone: '+91 9876543210'
      }
    });
    const pwSpy = vi.spyOn(Endpoints, 'changeMyPassword').mockResolvedValue({
      success: true,
      data: {
        token: 'rotated-jwt-token-after-pw-change',
        user: {
          id: 'u-mgr',
          name: 'Meera Krishnan',
          username: 'manager',
          email: 'meera@tracex.demo',
          role: 'manager'
        }
      }
    });

    const { refreshSession, setAuthenticatedSession } = renderWithAuth(<ProfilePage />, {
      id: 'u-mgr',
      name: '[DEMO] Operations Manager',
      username: 'manager',
      email: 'manager@tracex.demo',
      role: 'manager',
      superAdmin: false,
      active: true
    });

    // Update profile
    fireEvent.change(screen.getByTestId('profile-name-input'), {
      target: { value: 'Meera Krishnan' }
    });
    fireEvent.change(screen.getByTestId('profile-phone-input'), {
      target: { value: '+91 9876543210' }
    });
    fireEvent.click(screen.getByTestId('profile-save-btn'));

    await waitFor(() => {
      expect(profileSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Meera Krishnan',
          phone: '+91 9876543210'
        })
      );
      expect(refreshSession).toHaveBeenCalled();
    });

    // Change password
    fireEvent.change(screen.getByTestId('profile-current-password'), {
      target: { value: 'OldPass123456!' }
    });
    fireEvent.change(screen.getByTestId('profile-new-password'), {
      target: { value: 'NewStrongPass123!' }
    });
    fireEvent.click(screen.getByTestId('profile-change-password-btn'));

    await waitFor(() => {
      expect(pwSpy).toHaveBeenCalledWith({
        currentPassword: 'OldPass123456!',
        newPassword: 'NewStrongPass123!'
      });
      expect(setAuthenticatedSession).toHaveBeenCalledWith(
        'rotated-jwt-token-after-pw-change',
        expect.objectContaining({ username: 'manager' })
      );
    });
  });
});
