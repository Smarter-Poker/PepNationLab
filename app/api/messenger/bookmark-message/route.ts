import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession, getParticipant } from '@/lib/messenger/server';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';
import { BookmarkMessageSchema } from '@/lib/messenger/schemas';

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
  const parsed = BookmarkMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Body', details: parsed.error.flatten() }, { status: 400 });
  }

  const svc = await createServiceClient();

  const { data: msg } = await svc
    .from('messenger_messages')
    .select('id, conversation_id, text')
    .eq('id', parsed.data.messageId)
    .maybeSingle();
  if (!msg) return NextResponse.json({ error: 'Invalid Message' }, { status: 400 });

  const callerPart = await getParticipant(msg.conversation_id, user.id);
  if (!callerPart) return NextResponse.json({ error: 'Not A Participant' }, { status: 403 });

  if (parsed.data.action === 'add') {
    // Upsert (message_id, user_id) unique. Snapshot text so bookmark survives
    // a later delete of the source message.
    const snapshot = (msg.text ?? '').slice(0, 2000);
    const { data: existing } = await svc
      .from('messenger_bookmarks')
      .select('id')
      .eq('message_id', parsed.data.messageId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ bookmark: existing, alreadyBookmarked: true });
    }
    const { data: inserted, error: insErr } = await svc
      .from('messenger_bookmarks')
      .insert({
        message_id: parsed.data.messageId,
        user_id: user.id,
        message_text: snapshot,
      })
      .select('*')
      .maybeSingle();
    if (insErr) {
      if ((insErr as { code?: string }).code === '23505') {
        return NextResponse.json({ alreadyBookmarked: true });
      }
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
    return NextResponse.json({ bookmark: inserted });
  }

  // remove
  const { error: delErr } = await svc
    .from('messenger_bookmarks')
    .delete()
    .eq('message_id', parsed.data.messageId)
    .eq('user_id', user.id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
