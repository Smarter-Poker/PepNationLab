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

  const svc = await createServiceClient();

  const { data: rows, error: qErr } = await svc
    .from('messenger_blocked')
    .select('id, blocked_id, reason, created_at')
    .eq('blocker_id', user.id)
    .order('created_at', { ascending: false });

  if (qErr) {
    return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
  }

  const ids = (rows ?? []).map((r) => r.blocked_id as string);
  if (ids.length === 0) {
    return NextResponse.json({ blocks: [] });
  }

  const { data: profiles } = await svc
    .from('profiles')
    .select('id, full_name, username')
    .in('id', ids);

  const profMap = new Map((profiles ?? []).map((p) => [p.id as string, p]));

  const blocks = (rows ?? []).map((r) => {
    const p = profMap.get(r.blocked_id as string);
    return {
      id: r.id,
      blocked_id: r.blocked_id,
      full_name: p?.full_name ?? null,
      username: p?.username ?? null,
      reason: r.reason,
      created_at: r.created_at,
    };
  });

  return NextResponse.json({ blocks });
}
