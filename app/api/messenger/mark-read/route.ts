import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession, getParticipant } from '@/lib/messenger/server';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';
import { MarkReadSchema } from '@/lib/messenger/schemas';

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
  const parsed = MarkReadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Body', details: parsed.error.flatten() }, { status: 400 });
  }

  const participant = await getParticipant(parsed.data.conversationId, user.id);
  if (!participant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Audit11: explicit p_caller_id so the SECURITY DEFINER RPC works when
  // called via the service-role client (auth.uid() returns NULL under
  // service-role JWT, and the RPC has a service_role / postgres bypass
  // that trusts p_caller_id). The RPC returns predictable error codes:
  //   42501 unauthorized / not_a_participant
  //   22023 message_not_in_conversation
  const svc = await createServiceClient();
  const { error: rpcErr } = await svc.rpc('fn_messenger_mark_read', {
    p_caller_id: user.id,
    p_conv_id: parsed.data.conversationId,
    p_last_msg_id: parsed.data.lastReadMessageId,
  });
  if (rpcErr) {
    const msg = rpcErr.message ?? '';
    if (msg.includes('message_not_in_conversation')) {
      return NextResponse.json({ error: 'Message Not In Conversation' }, { status: 400 });
    }
    if (msg.includes('not_a_participant')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (msg.includes('unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: msg || 'Mark Read Failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
