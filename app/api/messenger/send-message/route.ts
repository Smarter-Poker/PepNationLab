import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession, getParticipant } from '@/lib/messenger/server';
import { SendMessageSchema } from '@/lib/messenger/schemas';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { user, error } = await requireSession();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = SendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Body', details: parsed.error.flatten() }, { status: 400 });
  }

  const participant = await getParticipant(parsed.data.conversationId, user.id);
  if (!participant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const svc = await createServiceClient();

  if (parsed.data.replyToId) {
    const { data: parent } = await svc
      .from('messenger_messages')
      .select('conversation_id')
      .eq('id', parsed.data.replyToId)
      .maybeSingle();
    if (!parent || parent.conversation_id !== parsed.data.conversationId) {
      return NextResponse.json({ error: 'Invalid Reply Target' }, { status: 400 });
    }
  }
  if (parsed.data.threadParentId) {
    const { data: thread } = await svc
      .from('messenger_messages')
      .select('conversation_id')
      .eq('id', parsed.data.threadParentId)
      .maybeSingle();
    if (!thread || thread.conversation_id !== parsed.data.conversationId) {
      return NextResponse.json({ error: 'Invalid Thread Parent' }, { status: 400 });
    }
  }

  const insertRow = {
    conversation_id: parsed.data.conversationId,
    sender_id: user.id,
    text: parsed.data.text ?? null,
    message_type: parsed.data.messageType,
    media_url: parsed.data.mediaUrl ?? null,
    media_metadata: parsed.data.mediaMetadata ?? {},
    reply_to_id: parsed.data.replyToId ?? null,
    thread_parent_id: parsed.data.threadParentId ?? null,
  };

  const { data: inserted, error: insErr } = await svc
    .from('messenger_messages')
    .insert(insertRow)
    .select('*')
    .maybeSingle();

  if (insErr || !inserted) {
    return NextResponse.json({ error: insErr?.message ?? 'Insert Failed' }, { status: 500 });
  }

  return NextResponse.json({ message: inserted });
}
