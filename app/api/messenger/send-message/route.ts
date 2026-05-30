import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession, getParticipant } from '@/lib/messenger/server';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';
import { SendMessageSchema } from '@/lib/messenger/schemas';
import { sanitizeMessageText } from '@/lib/messenger/sanitize';
import { hasAdminMention, recordAdminMention } from '@/lib/messenger/admin-mentions';
import { enqueuePush } from '@/lib/push-enqueue';

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

  // Audit9: participant check moved BEFORE content validation so non-members
  // can't probe text/expiresAt validation surface.
  const participant = await getParticipant(parsed.data.conversationId, user.id);
  if (!participant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

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

  let expiresAt: string | null = null;
  if (parsed.data.expiresAt) {
    const t = Date.parse(parsed.data.expiresAt);
    if (Number.isNaN(t)) {
      return NextResponse.json({ error: 'Invalid expiresAt' }, { status: 400 });
    }
    const minMs = Date.now() + 60_000;
    const maxMs = Date.now() + 60 * 60 * 24 * 30 * 1000;
    if (t < minMs) {
      return NextResponse.json({ error: 'expiresAt Must Be At Least One Minute In The Future' }, { status: 400 });
    }
    if (t > maxMs) {
      return NextResponse.json({ error: 'expiresAt Cannot Exceed Thirty Days' }, { status: 400 });
    }
    expiresAt = new Date(t).toISOString();
  }

  const svc = await createServiceClient();

  // Audit9: idempotent replay — same client_message_id from the same
  // (conversation_id, sender_id) returns the existing row instead of creating
  // a duplicate. The DB unique index enforces this even on race.
  if (parsed.data.clientMessageId) {
    const { data: existing } = await svc
      .from('messenger_messages')
      .select('*')
      .eq('conversation_id', parsed.data.conversationId)
      .eq('sender_id', user.id)
      .eq('client_message_id', parsed.data.clientMessageId)
      .maybeSingle();
    if (existing) return NextResponse.json({ message: existing, idempotent: true });
  }

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
  if (parsed.data.clientMessageId) insertRow.client_message_id = parsed.data.clientMessageId;

  const { data: inserted, error: insErr } = await svc
    .from('messenger_messages')
    .insert(insertRow)
    .select('*')
    .maybeSingle();

  if (insErr) {
    const code = (insErr as { code?: string }).code;
    // Audit9: idempotency race — return the existing row on unique violation.
    if (code === '23505' && parsed.data.clientMessageId) {
      const { data: existing } = await svc
        .from('messenger_messages')
        .select('*')
        .eq('conversation_id', parsed.data.conversationId)
        .eq('sender_id', user.id)
        .eq('client_message_id', parsed.data.clientMessageId)
        .maybeSingle();
      if (existing) return NextResponse.json({ message: existing, idempotent: true });
    }
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }
  if (!inserted) {
    return NextResponse.json({ error: 'Insert Failed' }, { status: 500 });
  }

  if (cleanText && hasAdminMention(cleanText)) {
    await recordAdminMention(svc, {
      messageId: (inserted as { id: string }).id,
      conversationId: parsed.data.conversationId,
      senderId: user.id,
      text: cleanText,
    });
  }

  // Fire-and-forget: push notification to all OTHER conversation participants.
  // Never blocks the response — notification side-effects must not slow sends.
  void (async () => {
    try {
      // Get sender display name
      const { data: senderProfile } = await svc
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();
      const senderName = senderProfile?.full_name || 'Someone';

      // Get all OTHER participants in this conversation
      const { data: participants } = await svc
        .from('messenger_participants')
        .select('user_id')
        .eq('conversation_id', parsed.data.conversationId)
        .neq('user_id', user.id);

      if (!participants || participants.length === 0) return;

      // Build notification body — truncate long messages
      const isMedia = !cleanText && parsed.data.mediaUrl;
      const rawBody = cleanText ?? (isMedia ? '📎 Media' : 'New Message');
      const body = rawBody.length > 120 ? `${rawBody.slice(0, 117)}…` : rawBody;
      const title = senderName;
      const url = `/messenger?conv=${parsed.data.conversationId}`;
      const tag = `msg-${parsed.data.conversationId}`;

      // Enqueue for each recipient — enqueuePush handles opt-out checks
      await Promise.all(
        participants.map((p: { user_id: string }) =>
          enqueuePush(svc, {
            userId: p.user_id,
            title,
            body,
            url,
            event: 'message',
            tag,
          })
        )
      );
    } catch {
      // Never propagate — push is best-effort
    }
  })();

  return NextResponse.json({ message: inserted });
}
