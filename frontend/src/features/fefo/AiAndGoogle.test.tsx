import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { AiAuditPanel } from './AiAuditPanel';
import { GoogleSignInButton } from '../../components/GoogleSignInButton';
import { GoogleLinkCard } from '../profile/GoogleLinkCard';
import { ThemeProvider } from '../../hooks/useTheme';
import { ToastProvider } from '../../components/ui';
import * as AuthCtx from '../../auth/AuthContext';
import * as Endpoints from '../../api/endpoints';
import * as Gis from '../../lib/googleIdentity';
import type { UserSummaryDto } from '../../api/types';

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

function mockAuth(user: UserSummaryDto) {
  const refreshSession = vi.fn().mockResolvedValue(undefined);
  vi.spyOn(AuthCtx, 'useAuth').mockReturnValue({
    user,
    token: 't',
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    setAuthenticatedSession: vi.fn(),
    logout: vi.fn(),
    logoutAll: vi.fn(),
    refreshSession
  });
  return refreshSession;
}

describe('AI dispatch audit and Google sign-in UI (Phase 11)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('AiAuditPanel stays hidden when the server has no AI key', async () => {
    const status = vi.spyOn(Endpoints, 'fetchAiStatus').mockResolvedValue({ enabled: false, providers: [] });
    const { container } = render(<AiAuditPanel />, { wrapper });
    await waitFor(() => expect(status).toHaveBeenCalled());
    expect(container.querySelector('[data-testid="ai-audit-panel"]')).toBeNull();
  });

  it('AiAuditPanel runs the audit and shows priorities, risks, provider and the check-before-acting note', async () => {
    vi.spyOn(Endpoints, 'fetchAiStatus').mockResolvedValue({ enabled: true, providers: ['gemini'] });
    const run = vi.spyOn(Endpoints, 'runAiAudit').mockResolvedValue({
      urgentBatches: [{ batchCode: 'TX-1', reason: 'Expires in 2 days' }],
      qualityWarnings: [],
      top3Priorities: [{ rank: 1, batchCode: 'TX-1', productName: 'Honey', action: 'Dispatch today.', reasoning: 'Shortest shelf life.' }],
      supplyChainRisks: [{ risk: 'One village supplies most honey.', severity: 'HIGH', recommendation: 'Add suppliers.' }],
      summary: 'Dispatch TX-1 first.',
      totalAnalyzed: 3,
      provider: 'gemini',
      generatedAt: '2026-10-23T08:00:00Z',
      fromCache: true
    });

    render(<AiAuditPanel />, { wrapper });
    fireEvent.click(await screen.findByTestId('ai-audit-run-btn'));
    await waitFor(() => expect(run).toHaveBeenCalledWith(false));

    expect(await screen.findByTestId('ai-audit-summary')).toHaveTextContent('Dispatch TX-1 first.');
    expect(screen.getByText(/One village supplies most honey/)).toBeInTheDocument();
    expect(screen.getByTestId('ai-audit-meta')).toHaveTextContent('3 batches analysed by Google Gemini');
    expect(screen.getByTestId('ai-audit-meta')).toHaveTextContent('(saved result)');
    expect(screen.getByTestId('ai-audit-meta')).toHaveTextContent('AI suggestions can be wrong');

    fireEvent.click(screen.getByTestId('ai-audit-refresh-btn'));
    await waitFor(() => expect(run).toHaveBeenCalledWith(true));
  });

  it('AiAuditPanel shows the server message when the audit cannot run', async () => {
    vi.spyOn(Endpoints, 'fetchAiStatus').mockResolvedValue({ enabled: true, providers: ['gemini'] });
    vi.spyOn(Endpoints, 'runAiAudit').mockRejectedValue(new Error('AI audit limit reached. Please try again in a few minutes.'));
    render(<AiAuditPanel />, { wrapper });
    fireEvent.click(await screen.findByTestId('ai-audit-run-btn'));
    expect(await screen.findByTestId('ai-audit-error')).toHaveTextContent('AI audit limit reached');
  });

  it('GoogleSignInButton renders nothing without a client id, and Google\'s button when one is set', async () => {
    const { container, unmount } = render(<GoogleSignInButton onCredential={vi.fn()} />, { wrapper });
    expect(container.querySelector('[data-testid="google-sign-in"]')).toBeNull();
    unmount();

    vi.spyOn(Gis, 'isGoogleSignInEnabled').mockReturnValue(true);
    const renderSpy = vi.spyOn(Gis, 'renderGoogleButton').mockImplementation(async (_parent, onCredential) => {
      onCredential('fake-id-token');
    });
    const onCredential = vi.fn();
    render(<GoogleSignInButton onCredential={onCredential} />, { wrapper });
    expect(screen.getByTestId('google-sign-in')).toBeInTheDocument();
    await waitFor(() => expect(onCredential).toHaveBeenCalledWith('fake-id-token'));
    expect(renderSpy).toHaveBeenCalled();
  });

  it('GoogleLinkCard links with a Google credential, and unlinks a linked account even when Google is switched off', async () => {
    vi.spyOn(Gis, 'isGoogleSignInEnabled').mockReturnValue(true);
    vi.spyOn(Gis, 'renderGoogleButton').mockImplementation(async (_parent, onCredential) => onCredential('fresh-token'));
    const refresh = mockAuth({ id: 'u-1', username: 'm', role: 'manager' });
    const linkSpy = vi.spyOn(Endpoints, 'linkGoogleAccount').mockResolvedValue({ id: 'u-1', googleEmail: 'm@gmail.com' });

    const { unmount } = render(<GoogleLinkCard />, { wrapper });
    await waitFor(() => expect(linkSpy).toHaveBeenCalledWith('fresh-token'));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    unmount();

    vi.spyOn(Gis, 'isGoogleSignInEnabled').mockReturnValue(false);
    mockAuth({ id: 'u-1', username: 'm', role: 'manager', googleEmail: 'm@gmail.com' });
    const unlinkSpy = vi.spyOn(Endpoints, 'unlinkGoogleAccount').mockResolvedValue({ id: 'u-1' });
    render(<GoogleLinkCard />, { wrapper });
    expect(screen.getByText(/Linked to m@gmail.com/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('profile-google-unlink-btn'));
    await waitFor(() => expect(unlinkSpy).toHaveBeenCalledTimes(1));
  });
});
