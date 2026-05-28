// Sentry client (browser) configuration.
//
// We require()-with-try/catch instead of a top-level `import` so the build
// stays green even when @sentry/nextjs has not yet been installed (e.g. a
// fresh clone before npm install resolves the new dependency). When the
// DSN env var is missing we skip Sentry.init entirely.

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  try {
    // Use a variable identifier so Turbopack/webpack do not treat this as a
    // static dependency at build time. The package is resolved at runtime.
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
