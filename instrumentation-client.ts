// Client-side instrumentation (Next.js 16 / Sentry v10 convention).
//
// This file is auto-loaded by Next.js in the browser and replaces the legacy
// `sentry.client.config.ts`, which initialized Sentry through a runtime
// `require('@sentry/nextjs')`. In the browser bundle there is no `require`, so
// that call always threw and was swallowed -- meaning client-side error
// reporting never actually ran. `@sentry/nextjs` is a declared dependency, so a
// static import is correct and safe here.
//
// Initialization is gated on NEXT_PUBLIC_SENTRY_DSN: when unset (e.g. local dev
// or an environment without Sentry configured) this is a no-op.

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL_ENV || 'development',
    enabled: true,
  });
}

// Capture navigation transitions for tracing (no-op if Sentry is not initialized).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
