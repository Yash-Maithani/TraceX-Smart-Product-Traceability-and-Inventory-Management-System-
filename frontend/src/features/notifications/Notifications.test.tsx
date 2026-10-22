import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { NotificationsPage, notificationLink } from './NotificationsPage';
import { NotificationBell } from '../../layouts/NotificationBell';
import { ToastProvider } from '../../components/ui';
import { ThemeProvider } from '../../hooks/useTheme';
import { applyLiveEvent } from '../../hooks/useLiveUpdates';
import { openEventStream, parseSseChunk } from '../../lib/eventStream';
import * as Endpoints from '../../api/endpoints';

function makeWrapper(queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ToastProvider>
            <MemoryRouter>{children}</MemoryRouter>
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    );
  };
}

const LIST = {
  unreadCount: 1,
  items: [
    { id: 'n-1', type: 'batch_created', title: 'New batch TX-2026-10-001', message: 'Ready for inspection.', refType: 'batch', refId: 'b-1', read: false, createdAt: '2026-10-22T08:00:00Z' },
    { id: 'n-2', type: 'import_finished', title: 'Import finished', message: '3 batches added.', refType: 'import', refId: 'j-1', read: true, createdAt: '2026-10-21T08:00:00Z' }
  ]
};

describe('Notifications and live updates (Phase 10)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('parseSseChunk reads named events, joins multi-line data, skips keep-alive comments, and keeps a partial event', () => {
    const { events, rest } = parseSseChunk(
      'event:ready\ndata:{"ok":true}\n\n:keep-alive\n\nevent: batch:created\ndata: {"a":1,\ndata: "b":2}\n\nevent:batch:upd'
    );
    expect(events).toEqual([
      { event: 'ready', data: '{"ok":true}' },
      { event: 'batch:created', data: '{"a":1,\n"b":2}' }
    ]);
    expect(rest).toBe('event:batch:upd');
  });

  it('openEventStream delivers events from the response body and stops on 401 without retrying', async () => {
    const chunks = [new TextEncoder().encode('event:batch:created\ndata:{"title":"x"}\n\n')];
    const fakeResponse = {
      ok: true,
      status: 200,
      body: {
        getReader: () => ({
          read: async () => (chunks.length > 0 ? { done: false, value: chunks.shift() } : { done: true, value: undefined })
        })
      }
    } as unknown as Response;
    const onEvent = vi.fn();
    const open = vi.fn().mockResolvedValueOnce(fakeResponse).mockResolvedValue(null);
    const close = openEventStream({ open, onEvent });
    await waitFor(() => expect(onEvent).toHaveBeenCalledWith({ event: 'batch:created', data: '{"title":"x"}' }));
    close();

    const onAuthFailure = vi.fn();
    const open401 = vi.fn().mockResolvedValue({ ok: false, status: 401, body: null } as unknown as Response);
    const close401 = openEventStream({ open: open401, onEvent, onAuthFailure });
    await waitFor(() => expect(onAuthFailure).toHaveBeenCalledTimes(1));
    close401();
    expect(open401).toHaveBeenCalledTimes(1);
  });

  it('applyLiveEvent refreshes the matching lists and shows a toast only for stored notifications', () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    const pushToast = vi.fn();

    applyLiveEvent(queryClient, { event: 'batch:updated', data: '{"refType":"batch","refId":"b-7"}' }, pushToast);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['fefo'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['batch', 'b-7'] });
    expect(pushToast).not.toHaveBeenCalled();

    applyLiveEvent(
      queryClient,
      { event: 'inspection:created', data: '{"title":"Inspection FAILED: TX-1","message":"On quality hold.","refType":"batch","refId":"b-1"}' },
      pushToast
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['inspections'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['notifications'] });
    expect(pushToast).toHaveBeenCalledWith({ title: 'Inspection FAILED: TX-1', description: 'On quality hold.', variant: 'info' });

    pushToast.mockClear();
    applyLiveEvent(queryClient, { event: 'ready', data: '{"ok":true}' }, pushToast);
    expect(pushToast).not.toHaveBeenCalled();
  });

  it('NotificationsPage marks one notification and then all as read', async () => {
    vi.spyOn(Endpoints, 'fetchNotifications').mockResolvedValue(LIST);
    const readOne = vi.spyOn(Endpoints, 'markNotificationRead').mockResolvedValue({ ...LIST.items[0]!, read: true });
    const readAll = vi.spyOn(Endpoints, 'markAllNotificationsRead').mockResolvedValue({ marked: 1 });

    render(<NotificationsPage />, { wrapper: makeWrapper() });

    expect(await screen.findByText('New batch TX-2026-10-001')).toBeInTheDocument();
    expect(screen.getByTestId('notification-n-1')).toHaveAttribute('data-read', 'false');
    expect(screen.getByTestId('notification-n-2')).toHaveAttribute('data-read', 'true');

    fireEvent.click(screen.getByTestId('notification-read-btn-n-1'));
    await waitFor(() => expect(readOne).toHaveBeenCalledWith('n-1'));

    fireEvent.click(screen.getByTestId('notifications-read-all-btn'));
    await waitFor(() => expect(readAll).toHaveBeenCalledTimes(1));
  });

  it('NotificationBell shows the unread count and links to the notifications page', async () => {
    vi.spyOn(Endpoints, 'fetchNotifications').mockResolvedValue({ ...LIST, unreadCount: 4 });
    render(<NotificationBell />, { wrapper: makeWrapper() });

    expect(await screen.findByTestId('notification-bell-count')).toHaveTextContent('4');
    const bell = screen.getByTestId('notification-bell');
    expect(bell).toHaveAttribute('href', '/notifications');
    expect(bell).toHaveAttribute('aria-label', 'Notifications, 4 unread');
  });

  it('notificationLink sends batch notifications to the batch, imports to Bulk Import, requests to Team', () => {
    expect(notificationLink({ refType: 'batch', refId: 'b-1' })).toBe('/batches/b-1');
    expect(notificationLink({ refType: 'import', refId: 'j-1' })).toBe('/import');
    expect(notificationLink({ refType: 'access_request', refId: 'r-1' })).toBe('/team');
    expect(notificationLink({ refType: 'other' })).toBeNull();
  });
});
