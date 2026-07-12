/**
 * Sentry capture helper.
 *
 * Centralized error reporter used by error boundaries and server-side catch
 * blocks that want to forward exceptions to Sentry. Safe to call when Sentry
 * is not configured -- Sentry.captureException is a no-op before init, and
 * the console.error fallback always fires.
 *
 * IMPORTANT: this uses a STATIC import. The previous variable-require() hack
 * threw unconditionally in the browser (no CommonJS require in client
 * bundles), which meant all three React error boundaries (app/error.tsx,
 * app/global-error.tsx, components/SegmentError.tsx) silently never reported
 * anything to Sentry. @sentry/nextjs is a declared dependency; a static
 * import is correct in every runtime (browser, node, edge).
 *
 * Called by:
 *   - app/error.tsx        (route-level React error boundary)
 *   - app/global-error.tsx (root-level React error boundary)
 *   - components/SegmentError.tsx (segment boundaries)
 *   - lib/api-error.ts safeError() (server route choke point)
 *   - server-side catches on money/auth-critical paths
 */

import * as Sentry from '@sentry/nextjs';

export function captureError(
  err: unknown,
  ctx?: Record<string, unknown>
): void {
  // Always log for local visibility - this is the cheapest, most reliable
  // signal a developer can see.
  // eslint-disable-next-line no-console
  console.error('[captureError]', err, ctx ?? null);

  try {
    // No-op when Sentry.init never ran (no DSN configured).
    Sentry.captureException(err, ctx ? { extra: ctx } : undefined);
  } catch {
    // Never let the reporter break the caller (an error boundary or a
    // money-path catch block) - the console.error above already fired.
  }
}
