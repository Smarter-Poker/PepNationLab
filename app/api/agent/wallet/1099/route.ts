// R24 hotfix - 1099-NEC summary. Reads sub_agent_commission_ledger (the canonical
// commission-earnings ledger, same source as /api/agent/wallet/commissions):
// commission_amount NUMERIC dollars, status text in (pending|settled|voided),
// keyed by sub_agent_id, settled_at timestamptz. Sums SETTLED rows by settled_at.
// (Previously queried a nonexistent `agent_commissions` table, so the swallowed
// error made every 1099 report $0.)
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

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
    .eq('sub_agent_id', gate.user.id)
    .eq('status', 'settled')
    .gte('settled_at', start)
    .lt('settled_at', end);

  const total = (rows ?? []).reduce((s: number, r: any) => s + Number(r.commission_amount ?? 0), 0);
  const totalCents = Math.round(total * 100);

  const { data: profile } = await svc
    .from('profiles')
    .select('id, full_name, email, username')
    .eq('id', gate.user.id)
    .maybeSingle();

  const payerName = process.env.PAYER_LEGAL_NAME;
  const payerEin = process.env.PAYER_EIN;
  if (!payerName || !payerEin) {
    console.error('[1099] PAYER_LEGAL_NAME or PAYER_EIN env vars are not set. Cannot generate 1099 data.');
    return NextResponse.json({ error: '1099 Payer Information Not Configured. Please Contact Support.' }, { status: 503 });
  }

  return NextResponse.json({
    year,
    payer: {
      name: payerName,
      tin: payerEin,
    },
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
