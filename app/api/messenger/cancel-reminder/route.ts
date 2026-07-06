import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession } from '@/lib/messenger/server';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';
import { CancelReminderSchema } from '@/lib/messenger/schemas';

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
  const parsed = CancelReminderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid Body', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const svc = await createServiceClient();

  const { data: existing } = await svc
    .from('messenger_reminders')
    .select('id, user_id, status')
    .eq('id', parsed.data.reminderId)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  if (existing.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (existing.status !== 'pending') {
    return NextResponse.json({ error: 'Already Fired Or Cancelled' }, { status: 409 });
  }

  const { error: upErr } = await svc
    .from('messenger_reminders')
    .update({ status: 'cancelled' })
    .eq('id', parsed.data.reminderId);
  if (upErr) return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });

  return NextResponse.json({ ok: true });
}
