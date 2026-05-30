import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession, getParticipant } from '@/lib/messenger/server';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';
import { SendMessageSchema } from '@/lib/messenger/schemas';
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
  const parsed = SendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Body', details: parsed.error.flatten() }, { status: 400 });
  }

  let cleanText: string | null = null;
  if (parsed.data.text !== undefined) {
    cleanText = sanitizeMessageText(parsed.data.text);
    if (cleanText === null) {
      return NextResponse.json({ error: 'Unsafe Text' }, { status: 400 });
    }
    if (cleanText.length === 0 && !parsed.data.mediaUrl) {
      return NextResponse.json({ error: 'Empty Message' }, { status: 400 });
    }
  }

  // Phase 10: expiry timer. Optional ISO datetime; must be in the future and
  // within a sane window (5 minutes to 30 days) so callers can't set a 100-year
  // expiry or a past one that immediately evicts the row.
  let expiresAt: string | null = null;
  if (parsed.data.expiresAt) {
    const t = Date.parse(parsed.data.expiresAt);
    if (Number.isNaN(t)) {
      return NextResponse.json({ error: 'Invalid expiresAt' }, { status: 400 });
    }
    const minMs = Date.now() + 60_000; // 1 minute minimum
    const maxMs = Date.now() + 60 * 60 * 24 * 30 * 1000; // 30 day maximum
    if (t < minMs) {
      return NextResponse.json({ error: 'expiresAt Must Be At Least One Minute In The Future' }, { status: 400 });
    }
    if (t > maxMs) {
      return NextResponse.json({ error: 'expiresAt Cannot Exceed Thirty Days' }, { status: 400 });
    }
    expiresAt = new Date(t).toISOString();
  }

  const participant = await getParticipant(parsed.data.conversationId, user.id);
  if (!participant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const svc = await createServiceClient();

  if (parsed.data.replyToId) {
    const { data: parent } = await svc
      .from('messenger_messages')
      .select('conversation_id, is_deleted')
      .eq('id', parsed.data.replyToId)
      .maybeSingle();
    if (!parent || parent.conversation_id !== parsed.data.conversationId) {
      return NextResponse.json({ error: 'Invalid Reply Target' }, { status: 400 });
    }
    if (parent.is_deleted) {
      return NextResponse.json({ error: 'Reply Target Deleted' }, { status: 410 });
    }
  }
  if (parsed.data.threadParentId) {
    const { data: thread } = await svc
      .from('messenger_messages')
      .select('conversation_id, is_deleted')
      .eq('id', parsed.data.threadParentId)
      .maybeSingle();
    if (!thread || thread.conversation_id !== parsed.data.conversationId) {
      return NextResponse.json({ error: 'Invalid Thread Parent' }, { status: 400 });
    }
    if (thread.is_deleted) {
      return NextResponse.json({ error: 'Thread Parent Deleted' }, { status: 410 });
    }
  }

  const insertRow: Record<string, unknown> = {
    conversation_id: parsed.data.conversationId,
    sender_id: user.id,
    text: cleanText,
    message_type: parsed.data.messageType,
    media_url: parsed.data.mediaUrl ?? null,
    media_metadata: parsed.data.mediaMetadata ?? {},
    reply_to_id: parsed.data.replyToId ?? null,
    thread_parent_id: parsed.data.threadParentId ?? null,
  };
  if (expiresAt) insertRow.expires_at = expiresAt;

  const { data: inserted, error: insErr } = await svc
    .from('messenger_messages')
    .insert(insertRow)
    .select('*')
    .maybeSingle();

  if (insErr || !inserted) {
    return NextResponse.json({ error: insErr?.message ?? 'Insert Failed' }, { status: 500 });
  }

  // Phase 13 / Audit6: @admin detection is shared with thread-reply and the
  // scheduled-message cron via lib/messenger/admin-mentions. Use the sanitized
  // text so clients can't bypass HTML sanitization by mention-only.
  if (cleanText && hasAdminMention(cleanText)) {
    await recordAdminMention(svc, {
      messageId: (inserted as { id: string }).id,
      conversationId: parsed.data.conversationId,
      senderId: user.id,
      text: cleanText,
    });
  }

  return NextResponse.json({ message: inserted });
}
