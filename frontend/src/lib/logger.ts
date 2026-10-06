/**
 * Structured client logger (SPEC §7 Logging Rules, Phase 5 Part A).
 * - Never logs tokens, passwords, OTP codes, or resetTokens.
 * - Suppresses debug/info output in production builds.
 */

const SENSITIVE_KEYS = new Set([
  'token',
  'tx_token',
  'tracetoken',
  'password',
  'newpassword',
  'currentpassword',
  'otp',
  'otpcode',
  'resettoken',
  'invitetoken',
  'authorization'
]);

export function redactSensitiveFields(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    let str = value;
    if (str.startsWith('Bearer ') || str.split('.').length === 3) {
      return '[REDACTED]';
    }
    if (str.includes('/trace/t/')) {
      str = str.replace(/\/trace\/t\/[^/?#\s]+/g, '/trace/t/[REDACTED]');
    }
    return str;
  }
  if (Array.isArray(value)) {
    return value.map(redactSensitiveFields);
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(k.toLowerCase())) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = redactSensitiveFields(v);
      }
    }
    return out;
  }
  return value;
}

function redactMessage(msg: string): string {
  if (msg.includes('/trace/t/')) {
    return msg.replace(/\/trace\/t\/[^/?#\s]+/g, '/trace/t/[REDACTED]');
  }
  return msg;
}

const isProd = import.meta.env.PROD;

export const logger = {
  debug(message: string, meta?: Record<string, unknown>): void {
    if (!isProd) {
      console.debug(`[TraceX:DEBUG] ${redactMessage(message)}`, meta ? redactSensitiveFields(meta) : '');
    }
  },
  info(message: string, meta?: Record<string, unknown>): void {
    if (!isProd) {
      console.log(`[TraceX:INFO] ${redactMessage(message)}`, meta ? redactSensitiveFields(meta) : '');
    }
  },
  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(`[TraceX:WARN] ${redactMessage(message)}`, meta ? redactSensitiveFields(meta) : '');
  },
  error(message: string, meta?: Record<string, unknown>): void {
    console.error(`[TraceX:ERROR] ${redactMessage(message)}`, meta ? redactSensitiveFields(meta) : '');
  }
};
