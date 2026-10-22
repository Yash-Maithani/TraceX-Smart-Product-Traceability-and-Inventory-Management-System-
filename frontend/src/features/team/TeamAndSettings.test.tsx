import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { TeamPage } from './TeamPage';
import { SettingsPage } from '../settings/SettingsPage';
import { ThemeProvider, useTheme } from '../../hooks/useTheme';
import { usePreferencesSync } from '../../hooks/usePreferencesSync';
import { ToastProvider } from '../../components/ui';
import * as AuthCtx from '../../auth/AuthContext';
import * as Endpoints from '../../api/endpoints';
import type { AccessRequestSummaryDto, UserSummaryDto } from '../../api/types';

const SUPER: UserSummaryDto = {
  id: 'u-super',
  username: 'superadmin',
  name: 'Super Admin',
  email: 'super@tracex.demo',
  role: 'factory-manager',
  superAdmin: true,
  active: true
};
const ADMIN: UserSummaryDto = { id: 'u-admin', username: 'admin', name: 'Staff Admin', email: 'admin@tracex.demo', role: 'admin', superAdmin: false, active: true };
const MANAGER: UserSummaryDto = { id: 'u-mgr', username: 'manager', name: 'Ops Manager', email: 'mgr@tracex.demo', role: 'manager', superAdmin: false, active: true };
const INSPECTOR: UserSummaryDto = { id: 'u-qi', username: 'inspector', name: 'QI', email: 'qi@tracex.demo', role: 'quality-inspector', superAdmin: false, active: false };

const REQUESTS: AccessRequestSummaryDto[] = [
  { id: 'r-1', name: 'Priya Pending', email: 'priya@example.com', role: 'manager', status: 'pending', inviteUsed: false },
  { id: 'r-2', name: 'Arun Approved', email: 'arun@example.com', role: 'factory-manager', status: 'approved', inviteUsed: false }
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

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <MemoryRouter>{children}</MemoryRouter>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function mockTeamData() {
  vi.spyOn(Endpoints, 'fetchTeamUsers').mockResolvedValue([SUPER, ADMIN, MANAGER, INSPECTOR]);
  vi.spyOn(Endpoints, 'fetchAccessRequests').mockResolvedValue(REQUESTS);
  vi.spyOn(Endpoints, 'fetchDeletedUsers').mockResolvedValue([
    { id: 'u-gone', username: 'gone', name: 'Gone User', role: 'dispatch-coordinator', deleted: true }
  ]);
}

describe('TeamPage and SettingsPage (Phase 9)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('super-admin with a non-admin role sees every action, the recycle bin, and can restore a user', async () => {
    mockAuth(SUPER);
    mockTeamData();
    const restoreSpy = vi.spyOn(Endpoints, 'restoreTeamUser').mockResolvedValue({ success: true, data: { id: 'u-gone' } });

    render(<TeamPage />, { wrapper });

    expect(await screen.findByTestId('team-toggle-btn-admin')).toBeInTheDocument();
    expect(screen.getByTestId('team-toggle-btn-manager')).toBeInTheDocument();
    // Never on yourself
    expect(screen.queryByTestId('team-toggle-btn-superadmin')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('team-tab-recycle'));
    fireEvent.click(await screen.findByTestId('recycle-restore-btn-gone'));
    await waitFor(() => expect(restoreSpy).toHaveBeenCalledWith('u-gone'));
  });

  it('admin cannot act on another admin and does not see the recycle bin or the admin role option', async () => {
    mockAuth(ADMIN);
    mockTeamData();

    render(<TeamPage />, { wrapper });

    expect(await screen.findByTestId('team-toggle-btn-manager')).toBeInTheDocument();
    expect(screen.queryByTestId('team-toggle-btn-superadmin')).not.toBeInTheDocument();
    expect(screen.queryByTestId('team-recycle')).not.toBeInTheDocument();
    expect(screen.queryByTestId('team-tab-recycle')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('team-role-btn-manager'));
    const select = await screen.findByTestId('team-role-select');
    const values = within(select).getAllByRole('option').map((o) => (o as HTMLOptionElement).value);
    expect(values).not.toContain('admin');
  });

  it('manager sees the lists read-only', async () => {
    mockAuth(MANAGER);
    mockTeamData();

    render(<TeamPage />, { wrapper });

    expect(await screen.findByText('Staff Admin')).toBeInTheDocument();
    expect(screen.queryByTestId('team-toggle-btn-admin')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('team-tab-requests'));
    expect(await screen.findByText('Priya Pending')).toBeInTheDocument();
    expect(screen.queryByTestId('request-approve-btn-priya@example.com')).not.toBeInTheDocument();
    expect(screen.getAllByText('View only').length).toBeGreaterThan(0);
  });

  it('admin approves a pending request, resends an approved invite, and rejects with a note', async () => {
    mockAuth(ADMIN);
    mockTeamData();
    const approveSpy = vi.spyOn(Endpoints, 'approveAccessRequest').mockResolvedValue({ success: true, data: { id: 'r-1' } });
    const resendSpy = vi.spyOn(Endpoints, 'resendAccessInvite').mockResolvedValue({ success: true, data: { id: 'r-2' } });
    const rejectSpy = vi.spyOn(Endpoints, 'rejectAccessRequest').mockResolvedValue({ success: true, data: { id: 'r-1' } });

    render(<TeamPage />, { wrapper });
    fireEvent.click(await screen.findByTestId('team-tab-requests'));

    // Approved requests offer Resend instead of Approve
    expect(await screen.findByTestId('request-resend-btn-arun@example.com')).toBeInTheDocument();
    expect(screen.queryByTestId('request-approve-btn-arun@example.com')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('request-approve-btn-priya@example.com'));
    await waitFor(() => expect(approveSpy).toHaveBeenCalledWith('r-1'));

    fireEvent.click(screen.getByTestId('request-resend-btn-arun@example.com'));
    await waitFor(() => expect(resendSpy).toHaveBeenCalledWith('r-2'));

    fireEvent.click(screen.getByTestId('request-reject-btn-priya@example.com'));
    fireEvent.change(await screen.findByTestId('request-reject-note'), { target: { value: 'Not on the staff list' } });
    fireEvent.click(screen.getByTestId('request-reject-confirm-btn'));
    await waitFor(() => expect(rejectSpy).toHaveBeenCalledWith('r-1', { note: 'Not on the staff list' }));
  });

  it('admin deletes a user with a reason through the confirmation dialog', async () => {
    mockAuth(ADMIN);
    mockTeamData();
    const deleteSpy = vi.spyOn(Endpoints, 'deleteTeamUser').mockResolvedValue(undefined);

    render(<TeamPage />, { wrapper });
    fireEvent.click(await screen.findByTestId('team-delete-btn-inspector'));
    fireEvent.change(await screen.findByTestId('team-delete-note'), { target: { value: 'Left the company' } });
    fireEvent.click(screen.getByTestId('team-delete-confirm-btn'));

    await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith('u-qi', { deleteNote: 'Left the company' }));
  });

  it('SettingsPage lists recent sign-ins and changes the theme', async () => {
    mockAuth(MANAGER);
    vi.spyOn(Endpoints, 'fetchMyLoginHistory').mockResolvedValue([
      { id: 'e-1', browser: 'Chrome', os: 'Windows', device: 'Desktop', method: 'password', createdAt: '2026-10-21T09:00:00Z' }
    ]);

    render(<SettingsPage />, { wrapper });

    expect(await screen.findByText('Chrome')).toBeInTheDocument();
    expect(screen.getByText('Windows')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('settings-mode-select'), { target: { value: 'dark' } });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('usePreferencesSync applies saved account settings at sign-in, then saves later changes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockAuth({ ...MANAGER, preferences: { mode: 'dark', palette: 'obsidian', accent: 'rose', showPageImages: false } });
    const saveSpy = vi.spyOn(Endpoints, 'updateMySettings').mockResolvedValue({ success: true, data: MANAGER });

    const { result } = renderHook(
      () => {
        usePreferencesSync();
        return useTheme();
      },
      { wrapper }
    );

    await waitFor(() => expect(result.current.prefs.palette).toBe('obsidian'));
    expect(result.current.prefs.mode).toBe('dark');
    expect(result.current.prefs.showPageImages).toBe(false);

    // Applying the saved settings must not echo them straight back
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(saveSpy).not.toHaveBeenCalled();

    act(() => result.current.setPalette('emerald'));
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    await waitFor(() =>
      expect(saveSpy).toHaveBeenCalledWith({ mode: 'dark', palette: 'emerald', accent: 'rose', showPageImages: false })
    );
  });

  it('usePreferencesSync saves local settings to an account that has none yet', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockAuth({ ...MANAGER });
    const saveSpy = vi.spyOn(Endpoints, 'updateMySettings').mockResolvedValue({ success: true, data: MANAGER });

    renderHook(() => usePreferencesSync(), { wrapper });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1));
    expect(saveSpy.mock.calls[0]?.[0]).toMatchObject({ palette: 'editorial', accent: 'auto', showPageImages: true });
  });
});
