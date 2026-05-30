import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;
const STATUSES = new Set(['pending', 'applied', 'qualifying', 'rewarded', 'expired', 'revoked']);

/**
 * GET /api/admin/referrals?status=qualifying&cursor=<iso>
 *
 * Admin-only list of every referral with a summary breakdown by status. The
 * cursor is the `created_at` of the last row returned; pass it on the next
 * request to walk further back in time.
 */
export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const statusFilter = url.searchParams.get('status');
  const cursor = url.searchParams.get('cursor');
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? PAGE_SIZE), 1), 200);

  const service = await createServiceClient();

  let query = service
    .from('researcher_referrals')
    .select('id, referrer_id, referee_id, referee_email, code, status, referrer_reward_amount, referee_reward_amount, qualifying_order_id, applied_at, rewarded_at, expires_at, notes, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (statusFilter && STATUSES.has(statusFilter)) {
    query = query.eq('status', statusFilter);
  }
  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data: rows, error } = await query;
  if (error) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  // Decorate referrer / referee for display.
  const ids = new Set<string>();
  for (const r of rows ?? []) {
    if (r.referrer_id) ids.add(r.referrer_id);
    if (r.referee_id) ids.add(r.referee_id);
  }
  const profileMap: Record<string, { full_name: string | null; email: string | null }> = {};
  if (ids.size > 0) {
    const { data: profs } = await service
      .from('profiles')
      .select('id, full_name, email')
      .in('id', Array.from(ids));
    for (const p of profs ?? []) {
      profileMap[String(p.id)] = { full_name: p.full_name ?? null, email: p.email ?? null };
    }
  }

  const decorated = (rows ?? []).map((r) => ({
    ...r,
    referrer: profileMap[String(r.referrer_id)] ?? null,
    referee: r.referee_id ? profileMap[String(r.referee_id)] ?? null : null,
  }));

  // Aggregate stats (independent of the page).
  const { data: stats } = await service
    .from('researcher_referrals')
    .select('status, referrer_reward_amount, referee_reward_amount');

  const summary = {
    total: 0,
    qualifying: 0,
    rewarded: 0,
    expired: 0,
    revoked: 0,
    total_rewarded_amount: 0,
  };
  for (const s of stats ?? []) {
    summary.total += 1;
    if (s.status === 'qualifying') summary.qualifying += 1;
    if (s.status === 'rewarded') {
      summary.rewarded += 1;
      summary.total_rewarded_amount +=
        Number(s.referrer_reward_amount ?? 0) + Number(s.referee_reward_amount ?? 0);
    }
    if (s.status === 'expired') summary.expired += 1;
    if (s.status === 'revoked') summary.revoked += 1;
  }

  const nextCursor =
    decorated.length === limit ? decorated[decorated.length - 1].created_at : null;

  return NextResponse.json({ referrals: decorated, summary, next_cursor: nextCursor });
}

/**
 * PATCH /api/admin/referrals
 * Body: { id, status }
 *
 * Admin override — primarily used to revoke fraudulent referrals.
 */
export async function PATCH(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  let body: { id?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid Body' }, { status: 400 });
  }

  const id = String(body?.id ?? '').trim();
  const status = String(body?.status ?? '').trim();
  if (!id || !STATUSES.has(status)) {
    return NextResponse.json({ error: 'Invalid id Or status' }, { status: 400 });
  }

  const service = await createServiceClient();

  const { data: before } = await service
    .from('researcher_referrals')
    .select('id, status')
    .eq('id', id)
    .maybeSingle();
  if (!before) {
    return NextResponse.json({ error: 'Referral Not Found' }, { status: 404 });
  }

  const { error: updateError } = await service
    .from('researcher_referrals')
    .update({ status })
    .eq('id', id);
  if (updateError) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  // Audit trail.
  await service.from('admin_audit_log').insert({
    actor_id: gate.userId,
    action: 'referral_status_override',
    entity_type: 'researcher_referrals',
    entity_id: id,
    changes: { from: before.status, to: status },
  });

  return NextResponse.json({ ok: true });
}
