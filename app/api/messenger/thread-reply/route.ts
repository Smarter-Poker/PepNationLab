import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession, getParticipant } from '@/lib/messenger/server';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';
import { ThreadReplySchema } from '@/lib/messenger/schemas';
import { sanitizeMessageText } from '@/lib/messenger/sanitize';
import { hasAdminMention, recordAdminMention } from '@/lib/messenger/admin-mentions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { user, error } = await requireSession();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const limited = await messengerRateLimit('send', user.id);
  if (!limited.allowed) return messengerRateLimitResponse(limited);

  const body = await req.json().catch(() => ({}));
  const parsed = ThreadReplySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Body', details: parsed.error.flatten() }, { status: 400 });
  }

  let cleanText: string | null = null;
  if (parsed.data.text !== undefined) {
    cleanText = sanitizeMessageText(parsed.data.text);
    if (cleanText === null) return NextResponse.json({ error: 'Unsafe Text' }, { status: 400 });
    if (cleanText.length === 0 && !parsed.data.mediaUrl) {
      return NextResponse.json({ error: 'Empty Message' }, { status: 400 });
    }
  }

  const svc = await createServiceClient();

  // Audit4 fix: also reject when the parent is soft-deleted. Without this
  // check, a reply could land on a tombstoned thread parent and the UI
  // would render an orphaned reply with no readable parent context.
  const { data: parent } = await svc
    .from('messenger_messages')
    .select('id, conversation_id, is_deleted')
    .eq('id', parsed.data.threadParentId)
    .maybeSingle();
  if (!parent) return NextResponse.json({ error: 'Invalid Thread Parent' }, { status: 400 });
  if ((parent as { is_deleted?: boolean }).is_deleted) {
    return NextResponse.json({ error: 'Thread Parent Deleted' }, { status: 410 });
  }

  const callerPart = await getParticipant(parent.conversation_id, user.id);
  if (!callerPart) return NextResponse.json({ error: 'Not A Participant' }, { status: 403 });

  const { data: inserted, error: insErr } = await svc
    .from('messenger_messages')
    .insert({
      conversation_id: parent.conversation_id,
      sender_id: user.id,
      text: cleanText,
      message_type: parsed.data.messageType,
      media_url: parsed.data.mediaUrl ?? null,
      media_metadata: {},
      thread_parent_id: parsed.data.threadParentId,
    })
    .select('*')
    .maybeSingle();
  if (insErr || !inserted) {
    return NextResponse.json({ error: insErr?.message ?? 'Insert Failed' }, { status: 500 });
  }

  // Audit6 fix: thread replies were silently dropping @admin mentions because
  // detection only lived in /api/messenger/send-message. Mirror the
  // send-message path here so a moderator notice lands in the admin inbox
  // whether the mention arrives in a top-level message or a thread reply.
  if (cleanText && hasAdminMention(cleanText)) {
    await recordAdminMention(svc, {
      messageId: (inserted as { id: string }).id,
      conversationId: parent.conversation_id as string,
      senderId: user.id,
      text: cleanText,
    });
  }

  return NextResponse.json({ message: inserted });
}
