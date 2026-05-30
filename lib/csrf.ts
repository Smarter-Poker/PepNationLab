import { NextResponse, type NextRequest } from 'next/server';

/**
 * Hostnames considered "same party" for CSRF purposes. The platform serves
 * pepnationlab.com but also keeps two legacy aliases pointed at the same
 * Vercel project (pepnationlabs.com plus the www. variants). Any of these
 * is treated as a same-origin caller. The request's own host is always
 * accepted on top of this list -- so previews like
 * pepnationlab-<hash>-smarter-poker.vercel.app keep working without an
 * env tweak.
 */
const ALLOWED_HOSTS = new Set<string>([
  'pepnationlab.com',
  'www.pepnationlab.com',
  'pepnationlabs.com',
  'www.pepnationlabs.com',
  'localhost',
  '127.0.0.1',
]);

function hostOf(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Asserts that the request originated from the same party as the server.
 *
 * Compares HOSTNAMES (not full origins) so a scheme drift between
 * `req.nextUrl` (which Vercel can serve over http:// internally) and the
 * browser's Origin header (always https:// in production) does not throw
 * a false-positive 403. Accepts the platform's known public aliases plus
 * the request's own host. Skipped in development so localhost tooling
 * keeps working.
 *
 * Audit14: tightened-but-resilient -- previously a strict equality on
 * `req.nextUrl.origin` was producing 403s on legitimate browser fetches
 * during page mount in production.
 *
 * @returns null on success, NextResponse with status 403 on failure.
 */
export function assertSameOrigin(req: NextRequest): NextResponse | null {
  if (process.env.NODE_ENV === 'development') {
    return null;
  }

  // Build the set of acceptable hostnames for THIS request:
  //   - the platform allow-list above
  //   - the request's own host (covers Vercel preview deployments and any
  //     future alias added in the dashboard without a code change)
  const accepted = new Set<string>(ALLOWED_HOSTS);
  const requestHost = hostOf(req.nextUrl.origin) ?? req.headers.get('host');
  if (requestHost) accepted.add(requestHost.toLowerCase());
  const forwardedHost = req.headers.get('x-forwarded-host');
  if (forwardedHost) accepted.add(forwardedHost.toLowerCase());

  const originHost = hostOf(req.headers.get('origin'));
  if (originHost) {
    return accepted.has(originHost)
      ? null
      : NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const refererHost = hostOf(req.headers.get('referer'));
  if (refererHost) {
    return accepted.has(refererHost)
      ? null
      : NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Neither Origin nor Referer is present. This happens for some legitimate
  // browser cases (notably navigations under certain Referrer-Policy values).
  // The Supabase auth cookie is SameSite=Lax, so a true cross-site attacker
  // still cannot ride along with credentials -- requireSession would fail.
  // Treat the missing-headers case as allow so we do not lock out real users.
  return null;
}
