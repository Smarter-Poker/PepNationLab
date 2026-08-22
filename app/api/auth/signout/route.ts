import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { recordAuthEvent } from '@/lib/auth-events';
import { getClientIp } from '@/lib/rate-limit';
import { REF_LOCK_COOKIE, REF_DISPLAY_COOKIE } from '@/lib/ref-lock';

export async function POST(request: NextRequest) {
  const forbidden = assertSameOrigin(request);
  if (forbidden) return forbidden;

  try {
    const supabase = await createClient();
    // Capture the user id before the session is torn down (best-effort).
    try {
      const { data } = await supabase.auth.getUser();
      await recordAuthEvent({
        event_type: 'logout',
        user_id: data.user?.id ?? null,
        ip: getClientIp(request),
        user_agent: request.headers.get('user-agent'),
      });
    } catch { /* analytics is best-effort */ }
    await supabase.auth.signOut();
  } catch (err) {
    console.error('[auth/signout] POST error:', err);
    // Still redirect even if the server-side sign-out fails;
    // the client cookie will expire and the session becomes unusable.
  }

  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  const response = NextResponse.redirect(url, 303);

  // Drop the referral lock on the way out.
  //
  // The lock is a GUEST confinement device: while it is set, a logged-out
  // visitor is pinned to one storefront and cannot reach /admin, /dashboard or
  // any other agent's pages. It has a 90-day lifetime.
  //
  // Without this, an agent or admin who signs out on a device that once
  // scanned somebody's QR code is instantly re-confined to that storefront and
  // cannot get back to the login-adjacent pages they expect — with no UI
  // anywhere to clear it. Signing out is an explicit "this device is not that
  // guest any more" statement, so the lock goes with the session.
  //
  // Attribution is unaffected: a lock only ever matters up to the moment an
  // account is created, and by definition the person signing out already has
  // one.
  for (const name of [REF_LOCK_COOKIE, REF_DISPLAY_COOKIE] as const) {
    response.cookies.set(name, '', {
      httpOnly: name === REF_LOCK_COOKIE,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
  }

  return response;
}
