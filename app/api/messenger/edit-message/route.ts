import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession } from '@/lib/messenger/server';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';
import { EditMessageSchema } from '@/lib/messenger/schemas';
import { sanitizeMessageText } from '@/lib/messenger/sanitize';

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
    .select('id, sender_id, text, is_deleted, delete_scope')
    .eq('id', parsed.data.messageId)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: 'Message Not Found' }, { status: 404 });
  if (existing.sender_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (existing.is_deleted && existing.delete_scope === 'for_everyone') {
    return NextResponse.json({ error: 'Already Deleted' }, { status: 400 });
  }

  // Audit9: short-circuit no-op edits so we don't fabricate history rows or
  // flip is_edited spuriously when the sanitized text is identical.
  if (cleanText === existing.text) {
    return NextResponse.json({ message: existing, unchanged: true });
  }

  // Audit9: write history AFTER the update succeeds. Previous order produced
  // orphan history rows if the update later failed.
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
    return NextResponse.json({ error: updErr?.message ?? 'Update Failed' }, { status: 500 });
  }

  // Best-effort: log the audit trail. A history-insert failure does not
  // un-do the user-visible edit.
  await svc.from('messenger_edit_history').insert({
    message_id: parsed.data.messageId,
    previous_text: existing.text ?? null,
    edited_by: user.id,
  });

  return NextResponse.json({ message: updated });
}
