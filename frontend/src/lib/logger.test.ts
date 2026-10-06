import { describe, expect, it, vi } from 'vitest';
import { logger, redactSensitiveFields } from './logger';

describe('Logger sensitive field redaction (Phase 7)', () => {
  it('redacts trace tokens in /trace/t/<token> URLs', () => {
    const rawUrl = 'https://tracex.example.com/trace/t/5N3R9w8xaB1c2D3e4F5g6h.7i8j9k0l1m2n3o4p?source=qr';
    const redacted = redactSensitiveFields(rawUrl);
    expect(redacted).toBe('https://tracex.example.com/trace/t/[REDACTED]?source=qr');
  });

  it('redacts trace tokens in message strings while leaving rest of message intact', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logger.warn('User navigated to /trace/t/secretNonce123.secretTag456 on mobile browser');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('/trace/t/[REDACTED] on mobile browser'),
      ''
    );
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('secretNonce123.secretTag456'),
      expect.anything()
    );
    warnSpy.mockRestore();
  });

  it('redacts sensitive keys in payload objects while retaining non-sensitive fields', () => {
    const payload = {
      batchCode: 'TX-2026-10-001',
      token: 'secretNonce.secretTag',
      traceToken: 'secretTokenValue',
      password: 'MyPassword123!',
      otp: '123456',
      source: 'buyer',
      deviceType: 'Mobile',
      metadata: {
        nestedUrl: '/trace/t/nestedNonce.nestedTag#details',
        requestId: 'req-456'
      }
    };

    const redacted = redactSensitiveFields(payload) as Record<string, unknown>;
    expect(redacted.batchCode).toBe('TX-2026-10-001');
    expect(redacted.token).toBe('[REDACTED]');
    expect(redacted.traceToken).toBe('[REDACTED]');
    expect(redacted.password).toBe('[REDACTED]');
    expect(redacted.otp).toBe('[REDACTED]');
    expect(redacted.source).toBe('buyer');
    expect(redacted.deviceType).toBe('Mobile');

    const nested = redacted.metadata as Record<string, unknown>;
    expect(nested.nestedUrl).toBe('/trace/t/[REDACTED]#details');
    expect(nested.requestId).toBe('req-456');
  });

  it('passes non-sensitive data and logs cleanly', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logger.error('Failed to load batch list', { errorCode: 'NOT_FOUND', page: 2 });
    expect(errorSpy).toHaveBeenCalledWith(
      '[TraceX:ERROR] Failed to load batch list',
      { errorCode: 'NOT_FOUND', page: 2 }
    );
    errorSpy.mockRestore();
  });
});
