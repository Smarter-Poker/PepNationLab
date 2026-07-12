/**
 * Minimal structured logger.
 *
 * Emits ONE JSON line per event so Vercel log search (and any future drain)
 * can filter by level/ctx/requestId instead of grepping interleaved prose.
 * Zero dependencies, safe in node, edge, and browser runtimes.
 *
 *   log('info',  'orders.POST.reserved', { orderId, userId });
 *   log('error', 'orders.POST.reserve_inventory', { userId }, reserveErr);
 *
 * Redaction: meta keys that look sensitive (token, password, secret,
 * authorization, cookie, key) are masked automatically so a careless call
 * site cannot leak credentials into logs. Email-looking string values are
 * masked to their first character + domain.
 *
 * Request correlation: pass a requestId in meta when available. proxy.ts
 * forwards `x-request-id` (generating one when absent); route handlers can
 * read it via `req.headers.get('x-request-id')` and thread it through.
 */

export type LogLevel = 'info' | 'warn' | 'error';

const SENSITIVE_KEY = /(token|password|secret|authorization|cookie|api[-_]?key|private)/i;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function maskEmail(email: string): string {
  return email.replace(/^(.).*(@.*)$/, '$1***$2');
}

function redactValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEY.test(key)) return '[redacted]';
  if (typeof value === 'string' && EMAIL_RE.test(value)) return maskEmail(value);
  return value;
}

function serializeError(err: unknown): Record<string, unknown> | undefined {
  if (err == null) return undefined;
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      // Stack goes to server logs only -- log lines are never returned to
      // clients, so this does not leak. Trim to keep lines readable.
      stack: typeof err.stack === 'string' ? err.stack.split('\n').slice(0, 6).join('\n') : undefined,
    };
  }
  if (typeof err === 'object') {
    // Supabase/Postgrest errors: plain objects with message/code/details.
    const e = err as Record<string, unknown>;
    return {
      message: typeof e.message === 'string' ? e.message : JSON.stringify(err).slice(0, 500),
      code: e.code,
      details: typeof e.details === 'string' ? e.details.slice(0, 300) : undefined,
      hint: typeof e.hint === 'string' ? e.hint.slice(0, 300) : undefined,
    };
  }
  return { message: String(err).slice(0, 500) };
}

export function log(
  level: LogLevel,
  ctx: string,
  meta?: Record<string, unknown>,
  err?: unknown,
): void {
  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    ctx,
  };
  if (meta) {
    for (const [k, v] of Object.entries(meta)) {
      if (v === undefined) continue;
      entry[k] = redactValue(k, v);
    }
  }
  const errObj = serializeError(err);
  if (errObj) entry.err = errObj;

  const line = (() => {
    try {
      return JSON.stringify(entry);
    } catch {
      // Circular meta -- fall back to the essentials.
      return JSON.stringify({ ts: entry.ts, level, ctx, err: errObj?.message });
    }
  })();

  // eslint-disable-next-line no-console
  if (level === 'error') console.error(line);
  // eslint-disable-next-line no-console
  else if (level === 'warn') console.warn(line);
  // eslint-disable-next-line no-console
  else console.log(line);
}

export const logInfo = (ctx: string, meta?: Record<string, unknown>) => log('info', ctx, meta);
export const logWarn = (ctx: string, meta?: Record<string, unknown>, err?: unknown) => log('warn', ctx, meta, err);
export const logError = (ctx: string, meta?: Record<string, unknown>, err?: unknown) => log('error', ctx, meta, err);
