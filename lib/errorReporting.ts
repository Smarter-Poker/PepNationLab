/** Local diagnostics for error boundaries and server catch paths. */
import { logError } from './log';

export function captureError(err: unknown, context?: Record<string, unknown>): void {
  try {
    logError('captureError', context, err);
  } catch {
    // Logging must not interrupt rendering, payment handling, or error responses.
    try { console.error('[captureError] Diagnostic could not be serialized'); } catch { /* Console unavailable. */ }
  }
}
