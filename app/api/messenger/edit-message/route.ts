import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession, getParticipant } from '@/lib/messenger/server';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';
import { EditMessageSchema } from '@/lib/messenger/schemas';
import { sanitizeMessageText } from '@/lib/messenger/sanitize';
import { sendBroadcast } from '@/lib/messenger/broadcast';

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
  const parsed = EditMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Body', details: parsed.error.flatten() }, { status: 400 });
  }

  const cleanText = sanitizeMessageText(parsed.data.text);
  if (cleanText === null || cleanText.length === 0) {
    return NextResponse.json({ error: 'Invalid Text' }, { status: 400 });
  }

  const svc = await createServiceClient();
  const { data: existing } = await svc
    .from('messenger_messages')
    .select('id, conversation_id, sender_id, text, is_deleted, delete_scope')
    .eq('id', parsed.data.messageId)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: 'Message Not Found' }, { status: 404 });
  if (existing.sender_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (existing.is_deleted && existing.delete_scope === 'for_everyone') {
    return NextResponse.json({ error: 'Already Deleted' }, { status: 400 });
  }

  // Audit10: only CURRENT participants may edit. A user who left or was
  // removed from a group can no longer edit historical messages they sent;
  // this complements the audit10 RLS WITH CHECK fix on mm_update_self.
  const part = await getParticipant(existing.conversation_id, user.id);
  if (!part) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (cleanText === existing.text) {
    return NextResponse.json({ message: existing, unchanged: true });
  }

  const { data: updated, error: updErr } = await svc
    .from('messenger_messages')
    .update({
      text: cleanText,
      is_edited: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.messageId)
    .select('*')
    .maybeSingle();
  if (updErr || !updated) {
    return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
  }

  try {
    const { error: histErr } = await svc.from('messenger_edit_history').insert({
      message_id: parsed.data.messageId,
      previous_text: existing.text ?? null,
      edited_by: user.id,
    });
    if (histErr) {
      console.error('[edit-message] failed to record edit history:', histErr);
    }
  } catch (histEx) {
    console.error('[edit-message] failed to record edit history:', histEx);
  }

  await sendBroadcast({
    topic: `chat:${existing.conversation_id}`,
    event: 'update_message',
    payload: { message: updated },
  });

  return NextResponse.json({ message: updated });
}
