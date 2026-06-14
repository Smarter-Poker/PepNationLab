// R24 hotfix - 1099-NEC summary. Reads sub_agent_commission_ledger (the canonical
// commission-earnings ledger, same source as /api/agent/wallet/commissions):
// commission_amount NUMERIC dollars, status text in (pending|settled|voided),
// keyed by sub_agent_id, settled_at timestamptz. Sums SETTLED rows by settled_at.
// (Previously queried a nonexistent `agent_commissions` table, so the swallowed
// error made every 1099 report $0.)
import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const year = parseInt(url.searchParams.get('year') ?? String(new Date().getFullYear() - 1), 10);
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: 'bad_year' }, { status: 400 });
  }
  const start = `${year}-01-01T00:00:00Z`;
  const end = `${year + 1}-01-01T00:00:00Z`;

  const svc = await createServiceClient();
  const { data: rows } = await svc
    .from('sub_agent_commission_ledger')
    .select('commission_amount, status, settled_at')
    .eq('sub_agent_id', user.id)
    .eq('status', 'settled')
    .gte('settled_at', start)
    .lt('settled_at', end);

  const total = (rows ?? []).reduce((s: number, r: any) => s + Number(r.commission_amount ?? 0), 0);
  const totalCents = Math.round(total * 100);

  const { data: profile } = await svc
    .from('profiles')
    .select('id, full_name, email, username')
    .eq('id', user.id)
    .single();

  return NextResponse.json({
    year,
    payer: { name: 'Pep Nation Lab', tin: 'XX-XXXXXXX' },
    recipient: {
      name: profile?.full_name ?? profile?.username ?? '',
      email: profile?.email ?? '',
      id: profile?.id ?? '',
    },
    box1_nonemployee_compensation_cents: totalCents,
    transactions_count: (rows ?? []).length,
    note: '1099-NEC eligibility depends on whether total compensation meets the IRS threshold ($600+ for tax year 2025-2026). This summary is informational only - consult a tax professional before filing.',
  });
}
