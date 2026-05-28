import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

/** GET: Agent views own commissions + earnings summary */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = await createServiceClient();

  // Get commissions
  const { data: commissions, error } = await service
    .from('agent_commissions')
    .select('*, orders:order_id(total, status, created_at, profiles!orders_buyer_id_fkey(full_name))')
    .eq('agent_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Calculate earnings
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString();

  const allTime = (commissions ?? []).reduce((s, c) => s + Number(c.commission_amount), 0);
  const thisMonth = (commissions ?? []).filter(c => c.created_at >= thisMonthStart).reduce((s, c) => s + Number(c.commission_amount), 0);
  const lastMonth = (commissions ?? []).filter(c => c.created_at >= lastMonthStart && c.created_at <= lastMonthEnd).reduce((s, c) => s + Number(c.commission_amount), 0);
  const pending = (commissions ?? []).filter(c => c.status === 'pending' || c.status === 'approved').reduce((s, c) => s + Number(c.commission_amount), 0);
  const paid = (commissions ?? []).filter(c => c.status === 'paid').reduce((s, c) => s + Number(c.commission_amount), 0);

  // Get payouts
  const { data: payouts } = await service
    .from('payout_records')
    .select('*')
    .eq('agent_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20);

  // Get commission rate
  const { data: profile } = await service.from('profiles').select('commission_rate').eq('id', user.id).single();

  return NextResponse.json({
    commissions,
    payouts: payouts ?? [],
    commissionRate: profile?.commission_rate || 15,
    earnings: { allTime, thisMonth, lastMonth, pending, paid },
  });
}
