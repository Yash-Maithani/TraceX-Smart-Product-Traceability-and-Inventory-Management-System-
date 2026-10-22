import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MessagesPage } from './MessagesPage';
import { MessageThread } from './MessageThread';
import { RecordComments } from './RecordComments';
import { ThemeProvider } from '../../hooks/useTheme';
import { ToastProvider } from '../../components/ui';
import * as AuthCtx from '../../auth/AuthContext';
import * as Endpoints from '../../api/endpoints';
import type { MessageDto, UserSummaryDto } from '../../api/types';

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

const MINE: MessageDto = { id: 'm-1', body: 'Lot 7 is drying', authorName: 'Me', authorRole: 'factory-manager', mine: true, deleted: false, createdAt: '2026-10-22T08:00:00Z' };
const THEIRS: MessageDto = { id: 'm-2', body: 'Thanks', authorName: 'Them', authorRole: 'factory-manager', mine: false, deleted: false, createdAt: '2026-10-22T08:05:00Z', editCount: 1 };
const GONE: MessageDto = { id: 'm-3', authorName: 'Them', authorRole: 'factory-manager', mine: false, deleted: true, createdAt: '2026-10-22T08:10:00Z' };

describe('Messages and record comments (Phase 10.1)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('MessageThread shows Edit only on your own messages, Delete for yours or for moderators, and keeps deleted slots', async () => {
    const onEdit = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const onPost = vi.fn().mockResolvedValue(undefined);
    const props = {
      messages: [MINE, THEIRS, GONE],
      composerLabel: 'Say something',
      emptyTitle: 'Empty',
      emptyDescription: 'Nothing',
      isPosting: false,
      onPost,
      onEdit,
      onDelete,
      testIdPrefix: 't'
    };

    const { rerender } = render(<MessageThread {...props} canModerate={false} />, { wrapper });
    expect(screen.getAllByTestId('t-edit-btn')).toHaveLength(1);
    expect(screen.getAllByTestId('t-delete-btn')).toHaveLength(1);
    expect(screen.getByText('Message deleted')).toBeInTheDocument();
    expect(screen.getByText(/\(edited\)/)).toBeInTheDocument();

    rerender(<MessageThread {...props} canModerate />);
    expect(screen.getAllByTestId('t-delete-btn')).toHaveLength(2);

    fireEvent.click(screen.getByTestId('t-edit-btn'));
    fireEvent.change(screen.getByTestId('t-edit-input'), { target: { value: 'Lot 7 is dry' } });
    fireEvent.click(screen.getByTestId('t-edit-save'));
    await waitFor(() => expect(onEdit).toHaveBeenCalledWith('m-1', 'Lot 7 is dry'));

    expect(screen.getByTestId('t-send-btn')).toBeDisabled();
    fireEvent.change(screen.getByTestId('t-input'), { target: { value: '  Shift handover done  ' } });
    fireEvent.click(screen.getByTestId('t-send-btn'));
    await waitFor(() => expect(onPost).toHaveBeenCalledWith('Shift handover done'));
  });

  it('MessagesPage opens your only channel directly, without channel tabs', async () => {
    mockAuth({ id: 'u-1', username: 'fm', name: 'FM', role: 'factory-manager', superAdmin: false });
    vi.spyOn(Endpoints, 'fetchMessageChannels').mockResolvedValue({
      channels: ['factory-manager'],
      superAdmin: false,
      retentionDays: 90,
      memberCounts: { 'factory-manager': 3 },
      activity: {}
    });
    vi.spyOn(Endpoints, 'fetchChannelMessages').mockResolvedValue([MINE]);
    const postSpy = vi.spyOn(Endpoints, 'postChannelMessage').mockResolvedValue(MINE);

    render(<MessagesPage />, { wrapper });

    expect(await screen.findByText('Lot 7 is drying')).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.getByText('3 active members can read this channel.')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('channel-input'), { target: { value: 'Night shift starts at 10' } });
    fireEvent.click(screen.getByTestId('channel-send-btn'));
    await waitFor(() => expect(postSpy).toHaveBeenCalledWith('factory-manager', 'Night shift starts at 10'));
  });

  it('MessagesPage gives a super-admin a tab per channel', async () => {
    mockAuth({ id: 'u-s', username: 'sa', name: 'SA', role: 'admin', superAdmin: true });
    vi.spyOn(Endpoints, 'fetchMessageChannels').mockResolvedValue({
      channels: ['admin', 'manager', 'factory-manager', 'quality-inspector', 'dispatch-coordinator'],
      superAdmin: true,
      retentionDays: 90,
      memberCounts: {},
      activity: { manager: { total: 4, lastAt: '2026-10-22T08:00:00Z', lastAuthor: 'M', lastBody: 'hi' } }
    });
    const feedSpy = vi.spyOn(Endpoints, 'fetchChannelMessages').mockResolvedValue([]);

    render(<MessagesPage />, { wrapper });

    expect(await screen.findByTestId('channel-tab-dispatch-coordinator')).toBeInTheDocument();
    expect(screen.getByTestId('channel-tab-manager')).toHaveTextContent('(4)');
    fireEvent.click(screen.getByTestId('channel-tab-quality-inspector'));
    await waitFor(() => expect(feedSpy).toHaveBeenCalledWith('quality-inspector'));
  });

  it('RecordComments loads and posts comments for the given record', async () => {
    mockAuth({ id: 'u-1', username: 'qi', name: 'QI', role: 'quality-inspector', superAdmin: false });
    const loadSpy = vi.spyOn(Endpoints, 'fetchRecordComments').mockResolvedValue([]);
    const postSpy = vi.spyOn(Endpoints, 'postRecordComment').mockResolvedValue(MINE);

    render(<RecordComments refType="inspection" refId="i-9" />, { wrapper });

    expect(await screen.findByText('No comments yet')).toBeInTheDocument();
    expect(loadSpy).toHaveBeenCalledWith('inspection', 'i-9');
    fireEvent.change(screen.getByTestId('inspection-comments-input'), { target: { value: 'Rated 4: label smudged' } });
    fireEvent.click(screen.getByTestId('inspection-comments-send-btn'));
    await waitFor(() => expect(postSpy).toHaveBeenCalledWith('inspection', 'i-9', 'Rated 4: label smudged'));
  });
});
