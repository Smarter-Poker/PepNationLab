import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { recordAuthEvent } from '@/lib/auth-events';
import { getClientIp } from '@/lib/rate-limit';

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
  return NextResponse.redirect(url, 303);
}
