import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const service = await createServiceClient();

  const [{ data: balanceRow }, { data: ledger }] = await Promise.all([
    service.from('store_credit_balances').select('balance').eq('user_id', user.id).maybeSingle(),
    service
      .from('store_credits')
      .select('id, amount, balance_before, balance_after, type, source_order_id, expires_at, description, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  return NextResponse.json({
    balance: Number(balanceRow?.balance ?? 0),
    ledger: ledger ?? [],
  });
}
