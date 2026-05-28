/**
 * Sentry capture helper.
 *
 * Centralized error reporter used by error boundaries and any server-side
 * catch blocks that want to forward exceptions to Sentry. Safe to call when
 * Sentry is not configured — falls back to console.error and returns.
 *
 * Resolution order for the DSN:
 *   - Server runtime:  SENTRY_DSN
 *   - Browser runtime: NEXT_PUBLIC_SENTRY_DSN (also exposed to server)
 *
 * If no DSN is present in the active environment, we skip the Sentry import
 * entirely so unconfigured local dev never tries to load the SDK.
 *
 * Called by:
 *   - app/error.tsx       (route-level React error boundary)
 *   - app/global-error.tsx (root-level React error boundary)
 *   - any future server-side catch that wants to forward to Sentry
 */

export function captureError(
  err: unknown,
  ctx?: Record<string, unknown>
): void {
  // Always log for local visibility — this is the cheapest, most reliable
  // signal a developer can see.
  // eslint-disable-next-line no-console
  console.error('[captureError]', err, ctx ?? null);

  const dsn =
    process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN || '';
  if (!dsn) return;

  // Only attempt the dynamic import when a DSN is actually configured.
  // Wrapping in try/catch prevents a missing or broken SDK from breaking the
  // host app's error boundary.
  try {
    // Resolve via a variable so the bundler treats this as a runtime lookup,
    // not a static dependency — keeps the build green when @sentry/nextjs is
    // not yet installed in the local node_modules.
    const mod = '@sentry/nextjs';
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
    const Sentry: any = require(mod);
    if (Sentry && typeof Sentry.captureException === 'function') {
      Sentry.captureException(err, ctx ? { extra: ctx } : undefined);
    }
  } catch {
    // Sentry not installed or failed to load — already logged to console.
  }
}
