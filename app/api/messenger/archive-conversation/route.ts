import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession, getParticipant } from '@/lib/messenger/server';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';
import { ArchiveConversationSchema } from '@/lib/messenger/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { user, error } = await requireSession();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const limited = await messengerRateLimit('default', user.id);
  if (!limited.allowed) return messengerRateLimitResponse(limited);

  const body = await req.json().catch(() => ({}));
  const parsed = ArchiveConversationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Body', details: parsed.error.flatten() }, { status: 400 });
  }

  const svc = await createServiceClient();

  const callerPart = await getParticipant(parsed.data.conversationId, user.id);
  if (!callerPart) return NextResponse.json({ error: 'Not A Participant' }, { status: 403 });

  // Per-participant archive lives in messenger_participants.settings.archived.
  // The conversation-level is_archived flag is reserved for admin moderation.
  const { data: row } = await svc
    .from('messenger_participants')
    .select('id, settings')
    .eq('conversation_id', parsed.data.conversationId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!row) return NextResponse.json({ error: 'Not A Participant' }, { status: 403 });

  const currentSettings = (row.settings && typeof row.settings === 'object' ? row.settings : {}) as Record<
    string,
    unknown
  >;
  const nextSettings = { ...currentSettings, archived: parsed.data.archived };

  const { error: updErr } = await svc
    .from('messenger_participants')
    .update({ settings: nextSettings })
    .eq('id', row.id);

  if (updErr) return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
  return NextResponse.json({ success: true, archived: parsed.data.archived });
}
