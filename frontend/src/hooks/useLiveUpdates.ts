import { useEffect } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { openAuthorizedStream } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../components/ui';
import { openEventStream, type StreamEvent } from '../lib/eventStream';
import { liveStatus } from '../lib/liveStatus';
import { logger } from '../lib/logger';

/** Query keys each live event makes stale (SPEC §8.5 event names). */
const STALE_KEYS: Record<string, readonly (readonly unknown[])[]> = {
  'batch:created': [['batches'], ['fefo'], ['dashboard', 'summary'], ['import', 'history']],
  'batch:updated': [['batches'], ['fefo'], ['dashboard', 'summary']],
  'batch:dispatched': [['batches'], ['fefo'], ['dashboard', 'summary']],
  'import:finished': [['import', 'history'], ['batches'], ['fefo'], ['dashboard', 'summary']],
  'inspection:created': [['inspections'], ['batches'], ['fefo'], ['dashboard', 'summary']],
  'access-request:created': [['team'], ['dashboard', 'summary']],
  'message:new': [['messages']]
};

interface LivePayload {
  title?: string;
  message?: string;
  refType?: string;
  refId?: string | null;
}

export function applyLiveEvent(
  queryClient: QueryClient,
  event: StreamEvent,
  pushToast: (t: { title: string; description?: string; variant?: 'info' }) => void
): void {
  const keys = STALE_KEYS[event.event];
  if (!keys) return; // "ready" and unknown events change nothing

  let payload: LivePayload = {};
  try {
    payload = JSON.parse(event.data) as LivePayload;
  } catch {
    payload = {};
  }

  for (const key of keys) {
    void queryClient.invalidateQueries({ queryKey: [...key] });
  }
  if (payload.refType === 'batch' && payload.refId) {
    void queryClient.invalidateQueries({ queryKey: ['batch', payload.refId] });
  }

  // Events carrying a stored notification refresh the bell and show a short toast
  if (payload.title) {
    void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    pushToast({ title: payload.title, ...(payload.message ? { description: payload.message } : {}), variant: 'info' });
  }
}

/**
 * Keeps one live connection open while signed in (Phase 10, GET /api/v1/notifications/stream).
 * Mounted once in AppShell. The stream reconnects on its own; a 401 or 403 stops it, and the next
 * API call then takes the normal signed-out path.
 */
export function useLiveUpdates(): void {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return undefined;
    liveStatus.connecting();
    const close = openEventStream({
      open: (signal) => openAuthorizedStream('/api/v1/notifications/stream', signal),
      onEvent: (event) => {
        liveStatus.eventReceived();
        applyLiveEvent(queryClient, event, pushToast);
      },
      onStatus: (connected) => liveStatus.connected(connected),
      onAuthFailure: () => {
        liveStatus.stopped();
        logger.warn('Live updates stopped: session is no longer valid');
      }
    });
    return () => {
      close();
      liveStatus.stopped();
    };
  }, [userId, queryClient, pushToast]);
}
