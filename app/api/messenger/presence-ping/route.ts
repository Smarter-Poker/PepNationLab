import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession } from '@/lib/messenger/server';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Presence heartbeat.
 *
 * MessengerShell pings this every PRESENCE_INTERVAL_MS (30s) with an empty
 * keepalive POST to keep the signed-in user's `last_active_at` fresh so the
 * online/last-seen indicators stay accurate. This is the canonical target for
 * the messenger heartbeat; it mirrors `update-presence`, which other surfaces
 * use. Previously this path did not exist, so every heartbeat 404'd and
 * presence silently went stale.
 */
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { user, error } = await requireSession();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const limited = await messengerRateLimit('default', user.id);
  if (!limited.allowed) return messengerRateLimitResponse(limited);

  const svc = await createServiceClient();
  const { error: updErr } = await svc
    .from('profiles')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', user.id);

  if (updErr) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
