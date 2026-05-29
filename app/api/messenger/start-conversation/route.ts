import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession, canInvite } from '@/lib/messenger/server';
import { StartConversationSchema } from '@/lib/messenger/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { user, error } = await requireSession();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = StartConversationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Body', details: parsed.error.flatten() }, { status: 400 });
  }

  const svc = await createServiceClient();
  const ids = Array.from(new Set([user.id, ...parsed.data.participantIds]));

  // Phase 9: enforce hierarchy on every invitee. Direct conversations and
  // groups both go through this gate. Self is always allowed (filtered by
  // the helper). Returns 403 with the offending user ID on first failure.
  for (const targetId of parsed.data.participantIds) {
    if (targetId === user.id) continue;
    const allowed = await canInvite(user.id, targetId);
    if (!allowed) {
      return NextResponse.json({ error: 'Cannot Invite User', userId: targetId }, { status: 403 });
    }
  }

  if (parsed.data.type === 'direct' && ids.length === 2) {
    const { data: existingId } = await svc.rpc('fn_find_direct_conversation', { a: ids[0], b: ids[1] });
    if (existingId) return NextResponse.json({ conversationId: existingId });
  }

  const { data: conv, error: convErr } = await svc
    .from('messenger_conversations')
    .insert({
      type: parsed.data.type,
      title: parsed.data.title ?? null,
      avatar_url: parsed.data.avatarUrl ?? null,
      created_by: user.id,
    })
    .select('id')
    .maybeSingle();

  if (convErr || !conv) {
    return NextResponse.json({ error: convErr?.message ?? 'Insert Failed' }, { status: 500 });
  }

  const rows = ids.map((uid) => ({
    conversation_id: conv.id,
    user_id: uid,
    role: uid === user.id ? 'owner' : 'member',
  }));
  const { error: partErr } = await svc.from('messenger_participants').insert(rows);
  if (partErr) {
    return NextResponse.json({ error: partErr.message }, { status: 500 });
  }

  return NextResponse.json({ conversationId: conv.id });
}
