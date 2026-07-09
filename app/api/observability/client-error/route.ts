// Client-error observability sink. Receives fire-and-forget error reports from
// the browser (global window handlers + key catch blocks) and stores them in
// client_error_events via the service role. Hardened: same-origin only, rate
// limited, every field clamped, best-effort auth attribution, never throws, and
// always returns 204 so it never affects the page it is reporting from.
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

function clamp(v: unknown, n: number): string | null {
  if (typeof v !== 'string' || !v) return null;
  return v.slice(0, n);
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const ip = getClientIp(req);
  const rl = await rateLimit({ key: 'client_error', limit: 30, windowSeconds: 60, identifier: ip });
  if (!rl.allowed) return new NextResponse(null, { status: 204 });

  try {
    const body = await req.json().catch(() => null);
    const message = clamp(body?.message, 2000);
    if (!message) return new NextResponse(null, { status: 204 });

    let userId: string | null = null;
    try {
      const supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      userId = data.user?.id ?? null;
    } catch {
      // anonymous / unauthenticated reports are fine
    }

    const service = await createServiceClient();
    await service.from('client_error_events').insert({
      user_id: userId,
      context: clamp(body?.context, 120),
      kind: clamp(body?.kind, 40),
      message,
      stack: clamp(body?.stack, 8000),
      url: clamp(body?.url, 1000),
      user_agent: clamp(req.headers.get('user-agent'), 500),
      meta: body?.meta && typeof body.meta === 'object' ? body.meta : null,
    });
  } catch {
    // Observability must never surface its own failures to the user.
  }
  return new NextResponse(null, { status: 204 });
}
