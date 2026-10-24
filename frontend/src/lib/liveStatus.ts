import { useSyncExternalStore } from 'react';

/**
 * State of the live-update stream (Phase 10 SSE), shown by LiveIndicator in the top bar.
 * - connecting: first attempt since sign-in
 * - live: stream open
 * - reconnecting: stream dropped, backoff retry pending
 * - offline: stream stopped (signed out or session no longer valid)
 */
export type LiveState = 'connecting' | 'live' | 'reconnecting' | 'offline';

export interface LiveSnapshot {
  state: LiveState;
  /** ISO time of the last event received, or null if none yet. */
  lastEventAt: string | null;
}

let snapshot: LiveSnapshot = { state: 'offline', lastEventAt: null };
const listeners = new Set<() => void>();

function emit(next: LiveSnapshot): void {
  if (next.state === snapshot.state && next.lastEventAt === snapshot.lastEventAt) return;
  snapshot = next;
  listeners.forEach((l) => l());
}

export const liveStatus = {
  connecting(): void {
    emit({ ...snapshot, state: 'connecting' });
  },
  connected(isConnected: boolean): void {
    emit({ ...snapshot, state: isConnected ? 'live' : 'reconnecting' });
  },
  stopped(): void {
    emit({ ...snapshot, state: 'offline' });
  },
  eventReceived(at: Date = new Date()): void {
    emit({ ...snapshot, lastEventAt: at.toISOString() });
  },
  get(): LiveSnapshot {
    return snapshot;
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** Test helper: back to the signed-out state. */
  reset(): void {
    emit({ state: 'offline', lastEventAt: null });
  }
};

export function useLiveStatus(): LiveSnapshot {
  return useSyncExternalStore(liveStatus.subscribe, liveStatus.get, liveStatus.get);
}
