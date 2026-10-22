/**
 * Fetch-based Server-Sent Events reader (D-4, SPEC §8.5). The browser `EventSource` cannot send an
 * Authorization header, so the stream is read with `fetch` and parsed here.
 */

export interface StreamEvent {
  event: string;
  data: string;
}

/** Splits buffered SSE text into complete events; returns them and the unfinished remainder. */
export function parseSseChunk(buffer: string): { events: StreamEvent[]; rest: string } {
  const normalized = buffer.replace(/\r\n/g, '\n');
  const blocks = normalized.split('\n\n');
  const rest = blocks.pop() ?? '';
  const events: StreamEvent[] = [];
  for (const block of blocks) {
    let event = 'message';
    const data: string[] = [];
    for (const line of block.split('\n')) {
      if (line.startsWith(':')) continue; // comment, e.g. keep-alive
      const colon = line.indexOf(':');
      const field = colon === -1 ? line : line.slice(0, colon);
      const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '');
      if (field === 'event') event = value;
      else if (field === 'data') data.push(value);
    }
    if (data.length > 0) {
      events.push({ event, data: data.join('\n') });
    }
  }
  return { events, rest };
}

export interface EventStreamOptions {
  /** Opens the HTTP response; null means there is no session, so nothing is opened. */
  open: (signal: AbortSignal) => Promise<Response | null>;
  onEvent: (event: StreamEvent) => void;
  onStatus?: (connected: boolean) => void;
  /** Called on 401/403 so the caller can stop instead of retrying with a dead token. */
  onAuthFailure?: () => void;
}

const MIN_RETRY_MS = 1_000;
const MAX_RETRY_MS = 30_000;

/**
 * Opens the stream and keeps it open, reconnecting with exponential backoff (1 s up to 30 s).
 * Returns a function that closes it for good.
 */
export function openEventStream(options: EventStreamOptions): () => void {
  let stopped = false;
  let controller: AbortController | null = null;
  let retryMs = MIN_RETRY_MS;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const scheduleRetry = () => {
    if (stopped) return;
    retryTimer = setTimeout(() => void connect(), retryMs);
    retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
  };

  const connect = async () => {
    if (stopped) return;
    controller = new AbortController();
    try {
      const res = await options.open(controller.signal);
      if (!res) return;
      if (res.status === 401 || res.status === 403) {
        options.onAuthFailure?.();
        return;
      }
      if (!res.ok || !res.body) {
        throw new Error(`Stream failed with HTTP ${res.status}`);
      }
      options.onStatus?.(true);
      retryMs = MIN_RETRY_MS;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parsed = parseSseChunk(buffer);
        buffer = parsed.rest;
        for (const event of parsed.events) {
          options.onEvent(event);
        }
      }
      options.onStatus?.(false);
      scheduleRetry();
    } catch {
      options.onStatus?.(false);
      if (!stopped) scheduleRetry();
    }
  };

  void connect();

  return () => {
    stopped = true;
    if (retryTimer) clearTimeout(retryTimer);
    controller?.abort();
  };
}
