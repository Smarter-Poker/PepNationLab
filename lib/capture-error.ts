/**
 * Error capture helper.
 *
 * Centralized error reporter used by error boundaries and server-side catch
 * blocks. It writes a structured console.error line, which lands in the
 * browser console on the client and in the Vercel function logs on the
 * server. There is no third-party error transport.
 *
 * Called by:
 *   - app/error.tsx        (route-level React error boundary)
 *   - app/global-error.tsx (root-level React error boundary)
 *   - components/SegmentError.tsx (segment boundaries)
 *   - lib/api-error.ts safeError() (server route choke point)
 *   - server-side catches on money/auth-critical paths
 */

export function captureError(
  err: unknown,
  ctx?: Record<string, unknown>
): void {
  try {
    // eslint-disable-next-line no-console
    console.error('[captureError]', err, ctx ?? null);
  } catch {
    // Reporting must never break the caller.
  }
}
