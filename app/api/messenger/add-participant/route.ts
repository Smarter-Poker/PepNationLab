import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession, getParticipant, canInvite, isAdminUser, isBlockedEither } from '@/lib/messenger/server';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';
import { AddParticipantSchema } from '@/lib/messenger/schemas';

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
  const parsed = AddParticipantSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Body', details: parsed.error.flatten() }, { status: 400 });
  }

  const svc = await createServiceClient();

  // Caller must be owner or admin of this conversation
  const callerPart = await getParticipant(parsed.data.conversationId, user.id);
  if (!callerPart) return NextResponse.json({ error: 'Not A Participant' }, { status: 403 });
  if (callerPart.role !== 'owner' && callerPart.role !== 'admin') {
    return NextResponse.json({ error: 'Insufficient Role' }, { status: 403 });
  }

  // Direct conversations are 2-party only. Adding a third silently corrupts UX.
  const { data: conv } = await svc
    .from('messenger_conversations')
    .select('id, type')
    .eq('id', parsed.data.conversationId)
    .maybeSingle();
  if (!conv) return NextResponse.json({ error: 'Conversation Not Found' }, { status: 404 });
  if (conv.type === 'direct') {
    return NextResponse.json({ error: 'Cannot Add To Direct Conversation' }, { status: 400 });
  }

  // Hierarchy gate: caller must be allowed to invite the target user. Admin
  // targets are always allowed (a user can always pull an admin into a group).
  const targetIsAdmin = await isAdminUser(parsed.data.userId);
  if (!targetIsAdmin) {
    const allowed = await canInvite(user.id, parsed.data.userId);
    if (!allowed) {
      return NextResponse.json({ error: 'Cannot Invite User' }, { status: 403 });
    }
  }

  // Audit10: one bidirectional block check via RPC instead of two round-trips.
  if (await isBlockedEither(user.id, parsed.data.userId)) {
    return NextResponse.json({ error: 'User Blocked', userId: parsed.data.userId }, { status: 403 });
  }

  // Idempotent: if already present, return 200 with the existing row.
  const existing = await getParticipant(parsed.data.conversationId, parsed.data.userId);
  if (existing) {
    return NextResponse.json({ participant: existing, added: false });
  }

  const { data: inserted, error: insErr } = await svc
    .from('messenger_participants')
    .insert({
      conversation_id: parsed.data.conversationId,
      user_id: parsed.data.userId,
      role: parsed.data.role ?? 'member',
    })
    .select('id, user_id, role, joined_at')
    .maybeSingle();

  if (insErr) {
    if (insErr.code === '23505') {
      const again = await getParticipant(parsed.data.conversationId, parsed.data.userId);
      return NextResponse.json({ participant: again, added: false });
    }
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  return NextResponse.json({ participant: inserted, added: true });
}
