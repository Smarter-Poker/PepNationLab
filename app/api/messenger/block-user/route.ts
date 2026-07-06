import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession } from '@/lib/messenger/server';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';
import { BlockUserSchema } from '@/lib/messenger/schemas';

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
  const parsed = BlockUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Body', details: parsed.error.flatten() }, { status: 400 });
  }

  const { targetUserId, action, reason } = parsed.data;
  if (targetUserId === user.id) {
    return NextResponse.json({ error: 'Cannot Block Self' }, { status: 400 });
  }

  const svc = await createServiceClient();

  if (action === 'block') {
    const { error: insErr } = await svc
      .from('messenger_blocked')
      .insert({ blocker_id: user.id, blocked_id: targetUserId, reason: reason ?? null });
    if (insErr && insErr.code !== '23505') {
      return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // unblock
  const { error: delErr } = await svc
    .from('messenger_blocked')
    .delete()
    .eq('blocker_id', user.id)
    .eq('blocked_id', targetUserId);
  if (delErr) {
    return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
