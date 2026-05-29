import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession, getParticipant } from '@/lib/messenger/server';
import { MuteConversationSchema } from '@/lib/messenger/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { user, error } = await requireSession();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = MuteConversationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Body', details: parsed.error.flatten() }, { status: 400 });
  }

  const svc = await createServiceClient();

  const callerPart = await getParticipant(parsed.data.conversationId, user.id);
  if (!callerPart) return NextResponse.json({ error: 'Not A Participant' }, { status: 403 });

  let update: { is_muted: boolean; mute_until: string | null };
  if (parsed.data.unmute === true) {
    update = { is_muted: false, mute_until: null };
  } else {
    let muteUntil: string | null = null;
    if (parsed.data.muteUntil) {
      const t = Date.parse(parsed.data.muteUntil);
      if (Number.isNaN(t) || t <= Date.now()) {
        return NextResponse.json({ error: 'muteUntil Must Be A Future Datetime' }, { status: 400 });
      }
      muteUntil = new Date(t).toISOString();
    }
    update = { is_muted: true, mute_until: muteUntil };
  }

  const { data: updated, error: updErr } = await svc
    .from('messenger_participants')
    .update(update)
    .eq('conversation_id', parsed.data.conversationId)
    .eq('user_id', user.id)
    .select('id, is_muted, mute_until')
    .maybeSingle();

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  return NextResponse.json({ participant: updated });
}
