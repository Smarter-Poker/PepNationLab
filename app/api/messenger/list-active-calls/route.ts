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

  // conversation type/title ride along so the client can tell a joinable
  // group call from a direct one when resuming after a reload/app-open.
  const { data, error: qErr } = await svc
    .from('messenger_calls')
    .select('*, conversation:messenger_conversations(type, title)')
    .in('conversation_id', ids)
    .in('status', ['ringing', 'active'])
    .order('started_at', { ascending: false })
    .limit(10);
  if (qErr) return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
  const calls = ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const conv = row.conversation as { type?: string | null; title?: string | null } | null;
    const flat: Record<string, unknown> = { ...row };
    delete flat.conversation;
    flat.conversation_type = conv?.type ?? null;
    flat.conversation_title = conv?.title ?? null;
    return flat;
  });
  return NextResponse.json({ calls });
}
