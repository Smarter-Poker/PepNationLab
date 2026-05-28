// Sentry edge runtime (middleware, edge API routes) configuration.
//
// We require()-with-try/catch instead of a top-level `import` so the build
// stays green even when @sentry/nextjs is not installed locally. Without a
// DSN the entire block is skipped.

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  try {
    const mod = '@sentry/nextjs';
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
    const Sentry: any = require(mod);
    if (Sentry?.init) {
      Sentry.init({
        dsn,
        tracesSampleRate: 0.1,
        environment: process.env.VERCEL_ENV || 'development',
        enabled: true,
      });
    }
  } catch {
    // Sentry SDK not installed yet — no-op.
  }
}

export {};
