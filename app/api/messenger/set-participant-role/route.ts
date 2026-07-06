import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession, getParticipant } from '@/lib/messenger/server';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';
import { SetParticipantRoleSchema } from '@/lib/messenger/schemas';

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
  const parsed = SetParticipantRoleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Body', details: parsed.error.flatten() }, { status: 400 });
  }

  const svc = createAdminClient();

  const callerPart = await getParticipant(parsed.data.conversationId, user.id);
  if (!callerPart) return NextResponse.json({ error: 'Not A Participant' }, { status: 403 });
  if (callerPart.role !== 'owner') {
    return NextResponse.json({ error: 'Only Owners Can Change Roles' }, { status: 403 });
  }

  const targetPart = await getParticipant(parsed.data.conversationId, parsed.data.userId);
  if (!targetPart) return NextResponse.json({ error: 'Target Not A Participant' }, { status: 404 });

  if (targetPart.role === 'owner' && parsed.data.role !== 'owner') {
    const { count: ownerCount } = await svc
      .from('messenger_participants')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', parsed.data.conversationId)
      .eq('role', 'owner');
    if ((ownerCount ?? 0) <= 1) {
      return NextResponse.json(
        { error: 'Promote Another Owner Before Demoting The Last One' },
        { status: 400 },
      );
    }
  }

  const { data: updated, error: updErr } = await svc
    .from('messenger_participants')
    .update({ role: parsed.data.role })
    .eq('id', targetPart.id)
    .select('id, user_id, role')
    .maybeSingle();

  if (updErr) return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
  return NextResponse.json({ participant: updated });
}
