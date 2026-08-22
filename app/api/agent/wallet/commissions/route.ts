// Wallet commissions - reads the real sub_agent_commission_ledger.
// Schema: sub_agent_id, order_id, commission_pct, gross_product_subtotal,
// commission_amount (NUMERIC dollars), status text CHECK in (pending|settled|voided),
// accrued_at, settled_at, voided_at.
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgentOrAdmin } from '@/lib/admin-auth';
import { safeError } from '@/lib/api-error';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const gate = await requireAgentOrAdmin();
  if (!gate.ok) return gate.response;

  const svc = await createServiceClient();
  const { data: rows, error } = await svc
    .from('sub_agent_commission_ledger')
    .select('id, order_id, commission_pct, gross_product_subtotal, commission_amount, status, accrued_at, settled_at')
    .eq('sub_agent_id', gate.user.id)
    .order('accrued_at', { ascending: false })
    .limit(500);

  // A database error is not "you have earned nothing". Returning zeros with a
  // 200 made an outage indistinguishable from an empty ledger, and the client
  // rendered "Pending $0.00 / Settled $0.00" to an agent who had just earned
  // commission.
  if (error) {
    return safeError('wallet.commissions', error, 500, 'Could Not Load Commissions. Please Try Again.');
  }

  // Normalize a `date` field (settled rows show settled_at, otherwise accrued_at)
  // so the client renders one consistent column regardless of bucket.
  const norm = (r: any) => ({
    id: r.id,
    order_id: r.order_id,
    commission_pct: r.commission_pct,
    gross_product_subtotal: r.gross_product_subtotal,
    commission_amount: r.commission_amount,
    status: r.status,
    date: r.status === 'settled' ? (r.settled_at ?? r.accrued_at) : r.accrued_at,
  });

  const all = (rows ?? []).map(norm);
  const pending = all.filter((r: any) => r.status === 'pending');
  const settled = all.filter((r: any) => r.status === 'settled');
  const totalPending = pending.reduce((s: number, r: any) => s + Number(r.commission_amount ?? 0), 0);
  const totalSettled = settled.reduce((s: number, r: any) => s + Number(r.commission_amount ?? 0), 0);

  return NextResponse.json({
    pending, settled,
    totals: { pending: totalPending, settled: totalSettled },
  });
}
