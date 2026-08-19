import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession } from '@/lib/messenger/server';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';
import { livekitRoomIsEmpty, pastOccupancyGrace } from '@/lib/messenger/roomOccupancy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function callsConfigured(): boolean {
  return Boolean(
    process.env.LIVEKIT_URL &&
      process.env.LIVEKIT_API_KEY &&
      process.env.LIVEKIT_API_SECRET,
  );
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { user, error } = await requireSession();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const limited = await messengerRateLimit('read', user.id);
  if (!limited.allowed) return messengerRateLimitResponse(limited);

  if (!callsConfigured()) {
    return NextResponse.json({ error: 'Calls Not Configured' }, { status: 503 });
  }

  const svc = await createServiceClient();
  const { data: parts } = await svc
    .from('messenger_participants')
    .select('conversation_id')
    .eq('user_id', user.id);
  const ids = ((parts ?? []) as Array<{ conversation_id: string }>).map((p) => p.conversation_id);
  if (ids.length === 0) return NextResponse.json({ calls: [] });

  const { data, error: qErr } = await svc
    .from('messenger_calls')
    .select('*')
    .in('conversation_id', ids)
    .in('status', ['ringing', 'active'])
    .order('started_at', { ascending: false })
    .limit(10);
  if (qErr) return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });

  // Conversation type/title ride along so the client can tell a joinable GROUP
  // call from a direct one when resuming after a reload or app open.
  //
  // Deliberately a SECOND QUERY rather than a PostgREST embed
  // (`select('*, conversation:messenger_conversations(type,title)')`): the
  // embed is one schema-cache quirk away from turning this route — which every
  // client hits on app open — into a 500, and a call you cannot rejoin is a
  // worse failure than an extra round trip on a list capped at 10 rows. If the
  // lookup fails, calls still return with null type: the client then falls back
  // to counting participants, so the degraded path is "group call looks direct",
  // never "no calls at all".
  let rows = (data ?? []) as Array<Record<string, unknown>>;

  // SELF-HEAL STRANDED CALLS (owner report 2026-08-19: "random calls all by
  // itself"). An 'active' row whose LiveKit room is actually EMPTY is a call
  // that already ended without anyone writing 'ended' - the guards that stop
  // a reconnecting client from hanging up on everyone also mean the last
  // person out sometimes ends nothing. Every one of those rows made THIS
  // route re-surface a full-screen "call in progress" card on every app
  // focus, for every member, indefinitely. Ask LiveKit for the truth: room
  // empty AND past the accept-to-connect grace -> mark ended and drop it.
  // Occupancy 'null' (API hiccup) fails open: the row is kept, exactly as
  // before. Ringing rows are untouched (the missed-call cron owns those).
  const staleActive = rows.filter(
    (r) =>
      r.status === 'active' &&
      pastOccupancyGrace(
        (r.answered_at as string | null) ?? null,
        (r.started_at as string | null) ?? null,
      ),
  );
  if (staleActive.length > 0) {
    const emptiness = await Promise.all(
      staleActive.map((r) => livekitRoomIsEmpty(String(r.livekit_room ?? ''))),
    );
    const deadIds: string[] = [];
    staleActive.forEach((r, i) => {
      if (emptiness[i] === true) deadIds.push(String(r.id));
    });
    if (deadIds.length > 0) {
      try {
        await svc
          .from('messenger_calls')
          .update({ status: 'ended', ended_at: new Date().toISOString() })
          .in('id', deadIds)
          .in('status', ['active']);
      } catch { /* best-effort: worst case the next focus heals it */ }
      rows = rows.filter((r) => !deadIds.includes(String(r.id)));
    }
  }

  const convMeta = new Map<string, { type: string | null; title: string | null }>();
  if (rows.length > 0) {
    const convIds = Array.from(new Set(rows.map((r) => String(r.conversation_id))));
    const { data: convs } = await svc
      .from('messenger_conversations')
      .select('id, type, title')
      .in('id', convIds);
    for (const c of ((convs ?? []) as Array<{ id: string; type: string | null; title: string | null }>)) {
      convMeta.set(c.id, { type: c.type ?? null, title: c.title ?? null });
    }
  }
  const calls = rows.map((row) => {
    const meta = convMeta.get(String(row.conversation_id));
    return { ...row, conversation_type: meta?.type ?? null, conversation_title: meta?.title ?? null };
  });
  return NextResponse.json({ calls });
}
