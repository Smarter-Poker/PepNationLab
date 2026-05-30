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
  if (qErr) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  return NextResponse.json({ calls: data ?? [] });
}
