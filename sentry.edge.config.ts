// Sentry edge runtime (middleware/proxy.ts, edge API routes) configuration.
//
// Static import: the Vercel edge runtime has no CommonJS require(), so the
// previous variable-require() hack threw unconditionally and was swallowed --
// edge errors (including every proxy.ts auth failure) were never captured.
// Init stays gated on the DSN so unconfigured environments are a clean no-op.

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment: process.env.VERCEL_ENV || 'development',
    enabled: true,
  });
}

export {};
