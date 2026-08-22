import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { assertSameOrigin } from '@/lib/csrf';
import { recordAuthEvent, type AuthEventType } from '@/lib/auth-events';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Client-emittable auth events. Only 'login' (success) and 'login_failed' are
// accepted from the browser; the identifier is hashed server-side. Logout and
// password events are emitted directly from their server routes, not here.
const CLIENT_EMITTABLE = new Set<AuthEventType>(['login', 'login_failed']);

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const ip = getClientIp(req);
  const limited = await rateLimit({ key: 'auth_events', identifier: ip, limit: 30, windowSeconds: 60 });
  if (!limited.allowed) return new Response(null, { status: 204 });

  let body: { event_type?: unknown; identifier?: unknown } = {};
  try {
    const text = await req.text();
    if (text.length > 2048) return new Response(null, { status: 204 });
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const et = String(body.event_type ?? '') as AuthEventType;
  if (!CLIENT_EMITTABLE.has(et)) return NextResponse.json({ error: 'invalid_event' }, { status: 400 });

  // For a successful login, stamp the authenticated user id from the session.
  let userId: string | null = null;
  if (et === 'login') {
    try {
      const supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      userId = data.user?.id ?? null;
    } catch { /* anonymous */ }
  }

  await recordAuthEvent({
    event_type: et,
    user_id: userId,
    identifier: typeof body.identifier === 'string' ? body.identifier.slice(0, 120) : null,
    ip,
    user_agent: req.headers.get('user-agent'),
  });

  return new Response(null, { status: 204 });
}
