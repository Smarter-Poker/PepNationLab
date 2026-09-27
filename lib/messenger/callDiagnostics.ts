/**
 * audit15 fix-24 (B9): console diagnostics helpers for the messenger call subsystem.
 *
 * Centralizes error and event reporting so the surface has a single tagged
 * stream operators can filter on in the browser console and the Vercel
 * function logs (every line is prefixed `[messenger.call]`). All helpers
 * swallow their own failures - telemetry must never break a real call.
 */

export interface CallDiagnosticsContext {
  call_id?: string;
  conversation_id?: string;
  initiator_id?: string;
  call_type?: 'audio' | 'video';
  /** Free-form additional context. */
  [key: string]: unknown;
}

type CallStage =
  | 'start'
  | 'accept'
  | 'decline'
  | 'hangup'
  | 'sweep'
  | 'token_fetch'
  | 'token_refresh'
  | 'broadcast'
  | 'push'
  | 'overlay'
  | 'realtime'
  | 'unknown';

function safe(fn: () => void): void {
  try {
    fn();
  } catch {
    // Logging itself failed - silently drop.
  }
}

export function captureCallError(
  err: unknown,
  stage: CallStage,
  context: CallDiagnosticsContext = {},
): void {
  safe(() => {
    const realErr = err instanceof Error ? err : new Error(typeof err === 'string' ? err : JSON.stringify(err));
    console.error('[messenger.call]', { feature: 'messenger.call', stage, ...context }, realErr);
  });
}

export function captureCallEvent(
  message: string,
  stage: CallStage,
  level: 'info' | 'warning' | 'error' = 'info',
  context: CallDiagnosticsContext = {},
): void {
  safe(() => {
    const payload = { feature: 'messenger.call', stage, level, ...context };
    if (level === 'error') console.error('[messenger.call]', message, payload);
    else if (level === 'warning') console.warn('[messenger.call]', message, payload);
    else console.info('[messenger.call]', message, payload);
  });
}

/**
 * Record a numeric metric as a structured info log line, e.g. counts from
 * cron jobs that don't otherwise raise an exception.
 *
 * Example:
 *   recordCallMetric('mark_missed_calls.stale_active_sweep_count', 3);
 */
export function recordCallMetric(
  name: string,
  value: number,
  context: CallDiagnosticsContext = {},
): void {
  safe(() => {
    console.info('[messenger.call]', `metric ${name}=${value}`, { feature: 'messenger.call', metric: name, value, ...context });
  });
}
