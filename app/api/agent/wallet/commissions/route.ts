// R24 hotfix — Wallet commissions. Uses real agent_commissions schema
// (agent_id, commission_amount NUMERIC dollars, status enum: pending/approved/paid/void).
import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const svc = await createServiceClient();
  const { data: rows, error } = await svc
    .from('agent_commissions')
    .select('id, agent_id, order_id, commission_rate, commission_amount, status, created_at')
    .eq('agent_id', user.id)
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) return NextResponse.json({ pending: [], settled: [], totals: { pending: 0, settled: 0 } });

  const pending = (rows ?? []).filter((r: any) => ['pending', 'approved'].includes(r.status));
  const settled = (rows ?? []).filter((r: any) => r.status === 'paid');
  const totalPending = pending.reduce((s: number, r: any) => s + Number(r.commission_amount ?? 0), 0);
  const totalSettled = settled.reduce((s: number, r: any) => s + Number(r.commission_amount ?? 0), 0);

  return NextResponse.json({
    pending, settled,
    totals: { pending: totalPending, settled: totalSettled },
  });
}
