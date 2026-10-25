import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { DispatchBriefPanel } from './DispatchBriefPanel';
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

describe('Dispatch brief (AI phase) and Google sign-in UI (Phase 11)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const ADVICE = {
    nextToShip: [{ batchCode: 'TX-1', productName: 'Honey', sku: 'H', daysUntilExpiry: 2, status: 'URGENT', verdict: 'PASSED' }],
    urgent: [{ batchCode: 'TX-1', productName: 'Honey', reason: 'Expires in 2 days.' }],
    onHold: [{ batchCode: 'TX-2', productName: 'Jam', reason: 'Latest inspection failed. Record a new inspection to release it.' }],
    expired: [],
    qualityWarnings: [],
    totalAnalyzed: 3,
    generatedAt: '2026-10-23T08:00:00Z',
    aiNote: 'not-requested'
  };
  const FACTS = {
    nextToShip: ADVICE.nextToShip,
    urgent: ADVICE.urgent,
    onHold: ADVICE.onHold,
    expired: ADVICE.expired,
    qualityWarnings: ADVICE.qualityWarnings,
    totalAnalyzed: ADVICE.totalAnalyzed,
    generatedAt: ADVICE.generatedAt
  };

  it('DispatchBriefPanel shows the rule facts without asking the AI, and hides the AI block when no key is set', async () => {
    vi.spyOn(Endpoints, 'fetchAiStatus').mockResolvedValue({ enabled: false, providers: [] });
    const facts = vi.spyOn(Endpoints, 'fetchDispatchAdvice').mockResolvedValue({ ...ADVICE, aiNote: 'off' });
    render(<DispatchBriefPanel />, { wrapper });
    expect(await screen.findByTestId('dispatch-brief-next')).toHaveTextContent('TX-1');
    expect(screen.getByTestId('dispatch-brief-hold')).toHaveTextContent('TX-2');
    expect(facts).toHaveBeenCalledWith({ withAi: false });
    expect(screen.queryByTestId('dispatch-brief-ai')).toBeNull();
  });

  it('DispatchBriefPanel writes the AI summary on request and shows risks, provider and the advice-only note', async () => {
    vi.spyOn(Endpoints, 'fetchAiStatus').mockResolvedValue({ enabled: true, providers: ['gemini'] });
    const advice = vi.spyOn(Endpoints, 'fetchDispatchAdvice').mockImplementation(async (opts) =>
      opts?.withAi
        ? {
            ...FACTS,
            ai: {
              summary: 'Ship TX-1 today; TX-2 is on hold.',
              risks: [{ risk: 'Most honey comes from one village.', severity: 'HIGH', recommendation: 'Add a second supplier.' }],
              provider: 'gemini',
              generatedAt: '2026-10-23T08:00:00Z',
              fromCache: false
            }
          }
        : ADVICE
    );
    render(<DispatchBriefPanel />, { wrapper });
    fireEvent.click(await screen.findByTestId('dispatch-brief-ai-btn'));
    await waitFor(() => expect(advice).toHaveBeenCalledWith({ withAi: true, refresh: false }));
    expect(await screen.findByTestId('dispatch-brief-ai-summary')).toHaveTextContent('Ship TX-1 today');
    expect(screen.getByText(/Most honey comes from one village/)).toBeInTheDocument();
    expect(screen.getByTestId('dispatch-brief-ai')).toHaveTextContent('By Google Gemini');
    expect(screen.getByTestId('dispatch-brief-ai')).toHaveTextContent('Advice only');
  });

  it('DispatchBriefPanel keeps the facts and explains when the AI service did not answer', async () => {
    vi.spyOn(Endpoints, 'fetchAiStatus').mockResolvedValue({ enabled: true, providers: ['gemini'] });
    vi.spyOn(Endpoints, 'fetchDispatchAdvice').mockImplementation(async (opts) =>
      opts?.withAi ? { ...ADVICE, aiNote: 'unavailable' } : ADVICE
    );
    render(<DispatchBriefPanel />, { wrapper });
    fireEvent.click(await screen.findByTestId('dispatch-brief-ai-btn'));
    expect(await screen.findByTestId('dispatch-brief-ai-note')).toHaveTextContent('did not answer');
    expect(screen.getByTestId('dispatch-brief-next')).toHaveTextContent('TX-1');
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
