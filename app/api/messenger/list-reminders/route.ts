import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession } from '@/lib/messenger/server';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { user, error } = await requireSession();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const limited = await messengerRateLimit('read', user.id);
  if (!limited.allowed) return messengerRateLimitResponse(limited);

  const body = await req.json().catch(() => ({}));
  const includeFired = Boolean((body as { includeFired?: boolean }).includeFired);

  const svc = await createServiceClient();

  // Pending reminders, ordered by upcoming time.
  const { data: pending, error: pErr } = await svc
    .from('messenger_reminders')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .order('remind_at', { ascending: true })
    .limit(100);
  if (pErr) return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });

  let fired: unknown[] = [];
  if (includeFired) {
    const { data: firedRows, error: fErr } = await svc
      .from('messenger_reminders')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'fired')
      .order('fired_at', { ascending: false })
      .limit(50);
    if (fErr) return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
    fired = firedRows ?? [];
  }

  return NextResponse.json({
    reminders: pending ?? [],
    fired,
  });
}
