import { NextResponse, type NextRequest } from 'next/server';

/**
 * Asserts that the request originated from the same origin as the server.
 *
 * Checks the Origin header first, falls back to Referer. The check is
 * skipped ONLY in development (NODE_ENV === 'development') so localhost
 * tooling and curl-based smoke tests continue to work. In every other
 * environment (production, preview, staging, test) mismatches and missing
 * headers are rejected with 403 — this is a lightweight CSRF defence for
 * state-changing API routes that rely on cookie-based auth.
 *
 * Audit9: previously skipped for any non-production env. Default-secure now.
 *
 * @returns null on success, NextResponse with status 403 on failure.
 */
export function assertSameOrigin(req: NextRequest): NextResponse | null {
  if (process.env.NODE_ENV === 'development') {
    return null;
  }

  const expectedOrigin = req.nextUrl.origin;
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');

  if (origin) {
    if (origin === expectedOrigin) return null;
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (refererOrigin === expectedOrigin) return null;
    } catch {
      // Malformed Referer — fall through to the forbidden response below.
    }
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  return NextResponse.json({ error: 'forbidden' }, { status: 403 });
}
