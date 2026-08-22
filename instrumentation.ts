// Next.js convention: this file is auto-loaded by the framework once per
// process boot (server and edge runtimes). We use it to load the Sentry
// configs lazily -- only when the runtime is known -- so the server config
// doesn't leak into the edge bundle and vice versa.
//
// onRequestError is the @sentry/nextjs v10 hook that delivers SERVER-side
// errors (API route handlers, server components, server actions) to Sentry.
// Without it, only React error-boundary (browser) errors were ever reported.
// captureRequestError no-ops when Sentry.init never ran (no DSN), so this is
// safe in unconfigured environments.

import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
