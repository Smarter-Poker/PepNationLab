import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession, getParticipant } from '@/lib/messenger/server';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';
import { LeaveConversationSchema } from '@/lib/messenger/schemas';

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
  const parsed = LeaveConversationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Body', details: parsed.error.flatten() }, { status: 400 });
  }

  const svc = await createServiceClient();

  const callerPart = await getParticipant(parsed.data.conversationId, user.id);
  if (!callerPart) return NextResponse.json({ error: 'Not A Participant' }, { status: 403 });

  const { data: conv } = await svc
    .from('messenger_conversations')
    .select('id, type')
    .eq('id', parsed.data.conversationId)
    .maybeSingle();
  if (!conv) return NextResponse.json({ error: 'Conversation Not Found' }, { status: 404 });
  if (conv.type === 'direct') {
    return NextResponse.json(
      { error: 'Cannot Leave Direct Conversation. Archive It Instead.' },
      { status: 400 },
    );
  }

  // If caller is the only owner of a group, require an additional owner be
  // promoted before leaving so the conversation is not stranded without an
  // owner who can manage it.
  if (callerPart.role === 'owner') {
    const { count: ownerCount } = await svc
      .from('messenger_participants')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', parsed.data.conversationId)
      .eq('role', 'owner');
    if ((ownerCount ?? 0) <= 1) {
      return NextResponse.json(
        { error: 'Promote Another Owner Before Leaving' },
        { status: 400 },
      );
    }
  }

  const { error: delErr } = await svc
    .from('messenger_participants')
    .delete()
    .eq('id', callerPart.id);

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
