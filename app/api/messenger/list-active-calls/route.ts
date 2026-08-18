import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession } from '@/lib/messenger/server';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';

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
  const rows = (data ?? []) as Array<Record<string, unknown>>;
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
