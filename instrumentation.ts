// Next.js convention: this file is auto-loaded by the framework once per
// process boot (server and edge runtimes). We use it to load the Sentry
// configs lazily — only when the runtime is known — so the server config
// doesn't leak into the edge bundle and vice versa.
//
// If @sentry/nextjs is not installed (or the DSN is unset), the configs are
// no-ops and this file imports them harmlessly.

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}
