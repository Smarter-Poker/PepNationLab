import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession, getParticipant } from '@/lib/messenger/server';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';
import { PinMessageSchema } from '@/lib/messenger/schemas';

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
  const parsed = PinMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Body', details: parsed.error.flatten() }, { status: 400 });
  }

  const callerPart = await getParticipant(parsed.data.conversationId, user.id);
  if (!callerPart) return NextResponse.json({ error: 'Not A Participant' }, { status: 403 });

  const svc = createAdminClient();

  const { data: msg } = await svc
    .from('messenger_messages')
    .select('id, conversation_id')
    .eq('id', parsed.data.messageId)
    .maybeSingle();
  if (!msg || msg.conversation_id !== parsed.data.conversationId) {
    return NextResponse.json({ error: 'Invalid Message' }, { status: 400 });
  }

  if (parsed.data.action === 'pin') {
    const { data: inserted, error: insErr } = await svc
      .from('messenger_pins')
      .insert({
        message_id: parsed.data.messageId,
        conversation_id: parsed.data.conversationId,
        pinned_by: user.id,
      })
      .select('*')
      .maybeSingle();
    if (insErr) {
      const code = (insErr as { code?: string }).code;
      // Already pinned -> idempotent success.
      if (code === '23505') {
        const { data: existing } = await svc
          .from('messenger_pins')
          .select('*')
          .eq('message_id', parsed.data.messageId)
          .maybeSingle();
        return NextResponse.json({ pin: existing, alreadyPinned: true });
      }
      // Audit10: pin cap (max 10 per conversation) is enforced by the
      // fn_mpins_enforce_cap trigger which raises ERRCODE='23514'. Map to a
      // friendly 400 instead of letting the user see an opaque 500.
      if (code === '23514') {
        return NextResponse.json({ error: 'Pin Limit Reached' }, { status: 400 });
      }
      return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
    }
    return NextResponse.json({ pin: inserted });
  }

  // unpin
  const { data: existing } = await svc
    .from('messenger_pins')
    .select('id, pinned_by')
    .eq('message_id', parsed.data.messageId)
    .maybeSingle();
  if (!existing) return NextResponse.json({ ok: true, removed: 0 });

  const canRemove =
    existing.pinned_by === user.id || callerPart.role === 'owner' || callerPart.role === 'admin';
  if (!canRemove) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error: delErr } = await svc
    .from('messenger_pins')
    .delete()
    .eq('id', existing.id);
  if (delErr) return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
  return NextResponse.json({ ok: true, removed: 1 });
}
