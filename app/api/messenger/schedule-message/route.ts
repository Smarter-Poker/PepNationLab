import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseUrl } from '@/lib/supabase/url';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession, getParticipant } from '@/lib/messenger/server';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';
import {
  ScheduleMessageCreateSchema,
  ScheduleMessageCancelSchema,
} from '@/lib/messenger/schemas';
import { sanitizeMessageText } from '@/lib/messenger/sanitize';

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
  const action = (body as { action?: string }).action;

  const svc = await createServiceClient();

  if (action === 'cancel') {
    const parsed = ScheduleMessageCancelSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid Body', details: parsed.error.flatten() }, { status: 400 });
    }
    const { data: existing } = await svc
      .from('messenger_scheduled')
      .select('id, sender_id, status')
      .eq('id', parsed.data.id)
      .maybeSingle();
    if (!existing) return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    if (existing.sender_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (existing.status !== 'pending') {
      return NextResponse.json({ error: 'Already Sent Or Cancelled' }, { status: 409 });
    }
    const { error: upErr } = await svc
      .from('messenger_scheduled')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', parsed.data.id);
    if (upErr) return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const parsed = ScheduleMessageCreateSchema.safeParse(body);
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

  // Security: Restrict mediaUrl to trusted domains (Supabase storage and Tenor CDN).
  if (parsed.data.mediaUrl) {
    try {
      const mediaUrlObj = new URL(parsed.data.mediaUrl);
      const hostname = mediaUrlObj.hostname.toLowerCase();
      const supabaseHost = new URL(getSupabaseUrl()).hostname.toLowerCase();
      const allowedHosts = [supabaseHost, 'c.tenor.com', 'media.tenor.com'];
      if (!allowedHosts.some((h) => hostname === h || hostname.endsWith(`.${h}`))) {
        return NextResponse.json({ error: 'Media URL Domain Not Allowed' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: 'Invalid Media URL' }, { status: 400 });
    }
  }

  const t = Date.parse(parsed.data.scheduledAt);
  if (Number.isNaN(t)) return NextResponse.json({ error: 'Invalid scheduledAt' }, { status: 400 });
  const minMs = Date.now() + 30_000;
  const maxMs = Date.now() + 60 * 60 * 24 * 90 * 1000;
  if (t < minMs) {
    return NextResponse.json({ error: 'scheduledAt Must Be At Least Thirty Seconds In The Future' }, { status: 400 });
  }
  if (t > maxMs) {
    return NextResponse.json({ error: 'scheduledAt Cannot Exceed Ninety Days' }, { status: 400 });
  }

  const callerPart = await getParticipant(parsed.data.conversationId, user.id);
  if (!callerPart) return NextResponse.json({ error: 'Not A Participant' }, { status: 403 });

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

  const { data: inserted, error: insErr } = await svc
    .from('messenger_scheduled')
    .insert({
      conversation_id: parsed.data.conversationId,
      sender_id: user.id,
      text: cleanText,
      message_type: parsed.data.messageType,
      media_url: parsed.data.mediaUrl ?? null,
      media_metadata: parsed.data.mediaMetadata ?? {},
      reply_to_id: parsed.data.replyToId ?? null,
      scheduled_at: new Date(t).toISOString(),
      status: 'pending',
    })
    .select('*')
    .maybeSingle();
  if (insErr) return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
  return NextResponse.json({ scheduled: inserted });
}
