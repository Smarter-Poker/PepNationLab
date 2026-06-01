// Round 24 Wallet — commissions tab
import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const svc = createServiceClient();
  // Try sub_agent_commissions first; fall back to agent_commissions.
  const sources = ['sub_agent_commissions', 'agent_commissions'];
  let rows: any[] = [];
  let source: string | null = null;

  for (const tbl of sources) {
    const { data, error } = await svc
      .from(tbl)
      .select('*')
      .or(`sub_agent_id.eq.${user.id},super_agent_id.eq.${user.id},agent_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(500);
    if (!error && data && data.length >= 0) {
      rows = data;
      source = tbl;
      break;
    }
  }

  const pending = rows.filter(r => (r.status ?? 'pending') !== 'settled' && (r.status ?? 'pending') !== 'paid');
  const settled = rows.filter(r => (r.status ?? '') === 'settled' || (r.status ?? '') === 'paid');
  const totalPendingCents = pending.reduce((s: number, r: any) => s + Number(r.amount_cents ?? r.amount ?? 0), 0);
  const totalSettledCents = settled.reduce((s: number, r: any) => s + Number(r.amount_cents ?? r.amount ?? 0), 0);

  return NextResponse.json({
    source,
    pending,
    settled,
    totals: { pendingCents: totalPendingCents, settledCents: totalSettledCents },
  });
}
