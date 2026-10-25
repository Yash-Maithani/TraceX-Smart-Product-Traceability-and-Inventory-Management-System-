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
        },
        {
          rank: 3,
          id: 'b-3',
          batchCode: 'TX-2026-10-007',
          productName: 'Apricot Jam',
          sku: 'ABHJAM',
          quantityProduced: 50,
          unit: 'Kg',
          packDate: '2026-05-01',
          expiryDate: '2026-11-20',
          status: 'READY',
          daysUntilExpiry: 45,
          qualityCheck: { status: 'FAILED' }
        },
        {
          rank: 4,
          id: 'b-4',
          batchCode: 'TX-2026-10-008',
          productName: 'Apricot Jam',
          sku: 'ABHJAM',
          quantityProduced: 50,
          unit: 'Kg',
          packDate: '2026-05-01',
          expiryDate: '2026-11-25',
          status: 'READY',
          daysUntilExpiry: 50
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

    // Redesign R5: tab counts, next batch per product, and on-hold rows blocked
    expect(screen.getByTestId('fefo-tab-queue')).toHaveTextContent('4');
    expect(screen.getByTestId('fefo-tab-expired')).toHaveTextContent('1');
    expect(screen.getByTestId('fefo-tab-missing')).toHaveTextContent('1');
    expect(screen.getByTestId('fefo-summary')).toHaveTextContent('4 ready, 1 expired, 1 missing an expiry date');
    expect(screen.getByTestId('fefo-next-TX-2026-10-001')).toBeInTheDocument();
    expect(screen.queryByTestId('fefo-next-TX-2026-10-005')).not.toBeInTheDocument();
    expect(screen.getByTestId('fefo-dispatch-btn-TX-2026-10-007')).toBeDisabled();
    expect(screen.getByTestId('fefo-hold-note-TX-2026-10-007')).toHaveTextContent('Latest inspection failed');
    // The held batch is skipped, so the next batch of that product is marked next
    expect(screen.getByTestId('fefo-next-TX-2026-10-008')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('fefo-tab-expired'));
    expect(await screen.findByTestId('fefo-expired-item-TX-2026-10-011')).toHaveTextContent('Expired 35 days ago');
    fireEvent.click(screen.getByTestId('fefo-tab-missing'));
    expect(await screen.findByTestId('fefo-exception-item-TX-2026-10-012')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('fefo-tab-queue'));

    fireEvent.click(await screen.findByTestId('fefo-dispatch-btn-TX-2026-10-001'));
    expect(screen.getByTestId('dispatch-buyer-input')).toBeInTheDocument();
    expect(screen.getByTestId('dispatch-summary')).toHaveTextContent('4 days left');
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
    vi.spyOn(Endpoints, 'fetchMyInspections').mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
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

  it('asks for the current password only when the email changes, and sends it with the update', async () => {
    const profileSpy = vi.spyOn(Endpoints, 'updateMyProfile').mockResolvedValue({
      success: true,
      data: {
        id: 'u-mgr',
        name: 'Operations Manager',
        username: 'manager',
        email: 'new-manager@tracex.demo',
        role: 'manager'
      }
    });

    renderWithAuth(<ProfilePage />, {
      id: 'u-mgr',
      name: 'Operations Manager',
      username: 'manager',
      email: 'manager@tracex.demo',
      role: 'manager',
      superAdmin: false,
      active: true
    });

    expect(screen.queryByTestId('profile-email-password-input')).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId('profile-email-input'), {
      target: { value: 'new-manager@tracex.demo' }
    });
    fireEvent.change(screen.getByTestId('profile-email-password-input'), {
      target: { value: 'CurrentPass123!' }
    });
    fireEvent.click(screen.getByTestId('profile-save-btn'));

    await waitFor(() => {
      expect(profileSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new-manager@tracex.demo',
          currentPassword: 'CurrentPass123!'
        })
      );
    });
  });
});

describe('Inspection assistant (AI phase)', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('fills the Record inspection form from the notes and shows what the server corrected', async () => {
    vi.spyOn(Endpoints, 'fetchAiStatus').mockResolvedValue({ enabled: true, providers: ['gemini'] });
    vi.spyOn(Endpoints, 'fetchInspections').mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, count: 0 });
    vi.spyOn(Endpoints, 'fetchMyInspections').mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
    vi.spyOn(Endpoints, 'fetchBatches').mockResolvedValue({
      data: [{ id: 'b-1', batchCode: 'TX-2026-10-001', productName: 'Honey', sku: 'H', status: 'READY' }],
      total: 1,
      page: 1,
      limit: 100,
      count: 1
    });
    const draftSpy = vi.spyOn(Endpoints, 'draftInspectionFromNotes').mockResolvedValue({
      checklist: [
        { label: 'Packaging integrity', passed: false, note: 'Cap seal broken on 3 of 20 jars' },
        { label: 'Label accuracy & legibility', passed: true, note: '' },
        { label: 'Expiry date visible & correct', note: '' },
        { label: 'Weight / quantity correct', note: '' },
        { label: 'No visible contamination', passed: true, note: '' },
        { label: 'Colour & texture acceptable', passed: true, note: '' },
        { label: 'Odour within acceptable range', passed: true, note: '' },
        { label: 'Storage conditions met', note: '' }
      ],
      verdict: 'FLAGGED',
      rating: 3,
      findings: 'Three jars had broken seals.',
      recommendation: 'Re-seal or set the jars aside.',
      adjustments: ['Changed Passed to Flagged because at least one check failed.'],
      provider: 'gemini'
    });

    renderWithAuth(<InspectionsPage />, {
      id: 'u-insp',
      name: 'Inspector',
      username: 'inspector',
      email: 'inspector@tracex.demo',
      role: 'quality-inspector',
      superAdmin: false,
      active: true
    });

    fireEvent.click(await screen.findByTestId('open-create-inspection-btn'));
    const notes = await screen.findByTestId('inspection-notes-input');
    fireEvent.change(notes, { target: { value: 'Cap seal broken on 3 of 20 jars, labels fine, smell normal.' } });
    fireEvent.click(screen.getByTestId('inspection-draft-btn'));

    await waitFor(() => expect(draftSpy).toHaveBeenCalledWith('Cap seal broken on 3 of 20 jars, labels fine, smell normal.'));
    expect(await screen.findByTestId('inspection-draft-message')).toHaveTextContent('Check every field before saving');
    expect(screen.getByTestId('inspection-draft-message')).toHaveTextContent('Changed Passed to Flagged');
    expect(screen.getByTestId('inspection-verdict-select')).toHaveValue('FLAGGED');
    expect(screen.getByTestId('inspection-rating-select')).toHaveValue('3');
    expect(screen.getByTestId('checklist-fail-0')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('checklist-na-2')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('inspection-findings-input')).toHaveValue('Three jars had broken seals.');
  });

  it('does not show the notes box when the server has no AI key', async () => {
    vi.spyOn(Endpoints, 'fetchAiStatus').mockResolvedValue({ enabled: false, providers: [] });
    vi.spyOn(Endpoints, 'fetchInspections').mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, count: 0 });
    vi.spyOn(Endpoints, 'fetchMyInspections').mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
    vi.spyOn(Endpoints, 'fetchBatches').mockResolvedValue({ data: [], total: 0, page: 1, limit: 100, count: 0 });
    renderWithAuth(<InspectionsPage />, {
      id: 'u-insp',
      name: 'Inspector',
      username: 'inspector',
      email: 'inspector@tracex.demo',
      role: 'quality-inspector',
      superAdmin: false,
      active: true
    });
    fireEvent.click(await screen.findByTestId('open-create-inspection-btn'));
    await screen.findByTestId('inspection-batch-select');
    expect(screen.queryByTestId('inspection-assistant')).not.toBeInTheDocument();
  });
});
