import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession, getParticipant } from '@/lib/messenger/server';
import { RemoveParticipantSchema } from '@/lib/messenger/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { user, error } = await requireSession();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = RemoveParticipantSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Body', details: parsed.error.flatten() }, { status: 400 });
  }

  const svc = await createServiceClient();

  const callerPart = await getParticipant(parsed.data.conversationId, user.id);
  if (!callerPart) return NextResponse.json({ error: 'Not A Participant' }, { status: 403 });

  const targetPart = await getParticipant(parsed.data.conversationId, parsed.data.userId);
  if (!targetPart) return NextResponse.json({ error: 'Target Not A Participant' }, { status: 404 });

  const isSelf = user.id === parsed.data.userId;
  const isOwner = callerPart.role === 'owner';
  const isAdminRole = callerPart.role === 'admin';

  if (!isSelf && !isOwner && !isAdminRole) {
    return NextResponse.json({ error: 'Insufficient Role' }, { status: 403 });
  }

  // Direct conversations: cannot remove the OTHER party. Self-remove on a
  // direct conversation also blocked -- use archive for that.
  const { data: conv } = await svc
    .from('messenger_conversations')
    .select('id, type')
    .eq('id', parsed.data.conversationId)
    .maybeSingle();
  if (!conv) return NextResponse.json({ error: 'Conversation Not Found' }, { status: 404 });
  if (conv.type === 'direct') {
    return NextResponse.json({ error: 'Cannot Remove From Direct Conversation' }, { status: 400 });
  }

  // Cannot remove an owner unless caller is owner. Even an owner cannot
  // strand a conversation -- at least one owner must remain.
  if (targetPart.role === 'owner') {
    if (!isOwner) {
      return NextResponse.json({ error: 'Only An Owner Can Remove An Owner' }, { status: 403 });
    }
    const { count: ownerCount } = await svc
      .from('messenger_participants')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', parsed.data.conversationId)
      .eq('role', 'owner');
    if ((ownerCount ?? 0) <= 1) {
      return NextResponse.json(
        { error: 'Promote Another Owner Before Removing The Last One' },
        { status: 400 },
      );
    }
  }

  const { error: delErr } = await svc
    .from('messenger_participants')
    .delete()
    .eq('id', targetPart.id);

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
