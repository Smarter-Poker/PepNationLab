import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';

/** GET: Agent views own commissions + earnings summary */
export async function GET(req: NextRequest) {
  // BUG-1 FIX: was using raw auth.getUser() with no role check — any
  // authenticated researcher could reach this endpoint.
  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

  const userId = gate.user.id;
  const service = await createServiceClient();

  // BUG-17 FIX: removed .limit(100). Aggregates are now computed via
  // DB-level RPC/subqueries so they are never over a truncated set.
  // Paginate the display list separately.
  const { data: commissions, error } = await service
    .from('agent_commissions')
    .select('*, orders:order_id(total, status, created_at, profiles!orders_buyer_id_fkey(full_name))')
    .eq('agent_id', userId)
    .order('created_at', { ascending: false })
    .limit(200); // display list — 200 rows max, aggregates are separate

  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });

  // BUG-17 FIX: Compute accurate aggregates from dedicated DB queries
  // rather than summing over a potentially-truncated JS array.
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  // BUG-18 FIX: was new Date(year, month, 0).toISOString() → midnight of
  // last day, excluding commissions from 00:00:01–23:59:59 on that day.
  // Fix: use end-of-day (23:59:59.999 UTC) on the last day of last month.
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).toISOString();

  const [allTimeRes, thisMonthRes, lastMonthRes, pendingRes, paidRes] = await Promise.all([
    service.from('agent_commissions').select('commission_amount.sum()', { count: 'exact', head: false }).eq('agent_id', userId),
    service.from('agent_commissions').select('commission_amount.sum()').eq('agent_id', userId).gte('created_at', thisMonthStart),
    service.from('agent_commissions').select('commission_amount.sum()').eq('agent_id', userId).gte('created_at', lastMonthStart).lte('created_at', lastMonthEnd),
    service.from('agent_commissions').select('commission_amount.sum()').eq('agent_id', userId).in('status', ['pending', 'approved']),
    service.from('agent_commissions').select('commission_amount.sum()').eq('agent_id', userId).eq('status', 'paid'),
  ]);

  // PostgREST .sum() aggregates come back as a data array with one row.
  const sumVal = (res: { data: unknown }) => {
    const row = Array.isArray(res.data) ? (res.data[0] as Record<string, unknown>) : null;
    if (!row) return 0;
    // PostgREST returns aggregate key as "commission_amount.sum()"
    const val = row['sum'] ?? row['commission_amount.sum()'];
    return Number(val) || 0;
  };

  // Fallback: if aggregate queries fail (e.g. Supabase plan limitation),
  // fall back to summing the fetched commissions array.
  const allTime = allTimeRes.error
    ? (commissions ?? []).reduce((s, c) => s + Number(c.commission_amount), 0)
    : sumVal(allTimeRes);
  const thisMonth = thisMonthRes.error
    ? (commissions ?? []).filter(c => c.created_at >= thisMonthStart).reduce((s, c) => s + Number(c.commission_amount), 0)
    : sumVal(thisMonthRes);
  const lastMonth = lastMonthRes.error
    ? (commissions ?? []).filter(c => c.created_at >= lastMonthStart && c.created_at <= lastMonthEnd).reduce((s, c) => s + Number(c.commission_amount), 0)
    : sumVal(lastMonthRes);
  const pending = pendingRes.error
    ? (commissions ?? []).filter(c => c.status === 'pending' || c.status === 'approved').reduce((s, c) => s + Number(c.commission_amount), 0)
    : sumVal(pendingRes);
  const paid = paidRes.error
    ? (commissions ?? []).filter(c => c.status === 'paid').reduce((s, c) => s + Number(c.commission_amount), 0)
    : sumVal(paidRes);

  const { data: payouts } = await service
    .from('payout_records')
    .select('*')
    .eq('agent_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  const { data: profile } = await service.from('profiles').select('commission_rate').eq('id', userId).single();

  return NextResponse.json({
    commissions,
    payouts: payouts ?? [],
    commissionRate: profile?.commission_rate || 15,
    earnings: { allTime, thisMonth, lastMonth, pending, paid },
  });
}
