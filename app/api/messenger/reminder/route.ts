import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession, getParticipant } from '@/lib/messenger/server';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';
import { SetReminderSchema } from '@/lib/messenger/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function previewFromMessage(m: {
  text: string | null;
  message_type: string | null;
  media_url: string | null;
}): string {
  if (m.text && m.text.trim().length > 0) {
    const t = m.text.trim();
    return t.length > 200 ? `${t.slice(0, 200)}...` : t;
  }
  switch (m.message_type) {
    case 'image':
      return '[Image]';
    case 'gif':
      return '[Gif]';
    case 'voice':
      return '[Voice Note]';
    case 'file':
      return '[File]';
    default:
      return m.media_url ? '[Media]' : '';
  }
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { user, error } = await requireSession();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const limited = await messengerRateLimit('default', user.id);
  if (!limited.allowed) return messengerRateLimitResponse(limited);

  const body = await req.json().catch(() => ({}));
  const parsed = SetReminderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid Body', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const t = Date.parse(parsed.data.remindAt);
  if (Number.isNaN(t)) {
    return NextResponse.json({ error: 'Invalid remindAt' }, { status: 400 });
  }
  const minMs = Date.now() + 30_000; // 30 seconds minimum
  const maxMs = Date.now() + 60 * 60 * 24 * 365 * 1000; // 1 year maximum
  if (t < minMs) {
    return NextResponse.json(
      { error: 'remindAt Must Be At Least Thirty Seconds In The Future' },
      { status: 400 },
    );
  }
  if (t > maxMs) {
    return NextResponse.json({ error: 'remindAt Cannot Exceed One Year' }, { status: 400 });
  }

  const svc = await createServiceClient();

  let messagePreview: string | null = null;
  let resolvedConversationId: string | null = parsed.data.conversationId ?? null;

  if (parsed.data.messageId) {
    const { data: msg } = await svc
      .from('messenger_messages')
      .select('id, conversation_id, text, message_type, media_url, is_deleted')
      .eq('id', parsed.data.messageId)
      .maybeSingle();
    if (!msg) return NextResponse.json({ error: 'Message Not Found' }, { status: 404 });
    if (msg.is_deleted) return NextResponse.json({ error: 'Message Deleted' }, { status: 410 });
    const part = await getParticipant(msg.conversation_id as string, user.id);
    if (!part) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    resolvedConversationId = msg.conversation_id as string;
    messagePreview = previewFromMessage({
      text: (msg.text as string | null) ?? null,
      message_type: (msg.message_type as string | null) ?? null,
      media_url: (msg.media_url as string | null) ?? null,
    });
  } else if (resolvedConversationId) {
    // Reminder bound to a conversation but no specific message - still must be a participant.
    const part = await getParticipant(resolvedConversationId, user.id);
    if (!part) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const note =
    typeof parsed.data.note === 'string' && parsed.data.note.trim().length > 0
      ? parsed.data.note.trim().slice(0, 500)
      : null;

  const { data: inserted, error: insErr } = await svc
    .from('messenger_reminders')
    .insert({
      user_id: user.id,
      message_id: parsed.data.messageId ?? null,
      conversation_id: resolvedConversationId,
      remind_at: new Date(t).toISOString(),
      note,
      message_preview: messagePreview,
      status: 'pending',
    })
    .select('*')
    .maybeSingle();

  if (insErr || !inserted) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  return NextResponse.json({ reminder: inserted });
}
