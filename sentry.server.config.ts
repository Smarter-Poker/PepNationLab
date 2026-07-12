// Sentry server (Node runtime) configuration.
//
// Static import: @sentry/nextjs is a declared dependency, and the previous
// variable-require() hack was invisible to Vercel's file tracer, so in a
// production function bundle the require could throw MODULE_NOT_FOUND and be
// silently swallowed -- meaning server-side Sentry never initialized and hid
// the failure forever. Init stays gated on the DSN so unconfigured
// environments are a clean no-op.

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
