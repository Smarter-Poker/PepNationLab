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
//
// PERF TRADEOFF: client-side performance tracing is deliberately DISABLED.
// With `tracesSampleRate` set (and the `onRouterTransitionStart` export
// present), the Sentry browser tracing + router instrumentation bundle ships
// on every public route -- roughly 390KB of transfer and ~300ms of mobile LCP.
// Omitting both lets the tracing integration tree-shake out entirely while
// keeping full client ERROR capture. Server-side tracing is unaffected. If
// field performance tracing is ever needed again, re-add `tracesSampleRate`
// and `export const onRouterTransitionStart = Sentry.captureRouterTransitionStart`
// deliberately, accepting the bundle cost.

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL_ENV || 'development',
    enabled: true,
  });
}
