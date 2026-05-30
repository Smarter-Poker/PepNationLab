import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession, getParticipant } from '@/lib/messenger/server';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';
import { ListPinsSchema } from '@/lib/messenger/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PinRow {
  id: string;
  message_id: string;
  pinned_by: string;
  created_at: string;
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { user, error } = await requireSession();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const limited = await messengerRateLimit('read', user.id);
  if (!limited.allowed) return messengerRateLimitResponse(limited);

  const body = await req.json().catch(() => ({}));
  const parsed = ListPinsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Body', details: parsed.error.flatten() }, { status: 400 });
  }

  const callerPart = await getParticipant(parsed.data.conversationId, user.id);
  if (!callerPart) return NextResponse.json({ error: 'Not A Participant' }, { status: 403 });

  const svc = await createServiceClient();

  const { data: pinRows, error: pErr } = await svc
    .from('messenger_pins')
    .select('id, message_id, pinned_by, created_at')
    .eq('conversation_id', parsed.data.conversationId)
    .order('created_at', { ascending: false });
  if (pErr) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });

  const pinList = (pinRows ?? []) as PinRow[];
  if (pinList.length === 0) return NextResponse.json({ pins: [] });

  const messageIds = pinList.map((p) => p.message_id);
  const { data: msgs, error: mErr } = await svc
    .from('messenger_messages')
    .select('id, text, message_type, sender_id, created_at, media_url, is_deleted')
    .in('id', messageIds);
  if (mErr) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });

  const byId = new Map<string, NonNullable<typeof msgs>[number]>();
  (msgs ?? []).forEach((m) => byId.set(m.id, m));

  const pins = pinList.map((p) => ({
    id: p.id,
    message_id: p.message_id,
    pinned_by: p.pinned_by,
    created_at: p.created_at,
    message: byId.get(p.message_id) ?? null,
  }));

  return NextResponse.json({ pins });
}
