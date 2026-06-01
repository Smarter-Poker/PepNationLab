// R24 phase 6 — 1099-NEC summary download.
// Sums settled commissions for the agent across a calendar year.
// Returns a JSON envelope; downstream UI can render a printable summary.
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
  const start = `${year}-01-01T00:00:00Z`;
  const end = `${year + 1}-01-01T00:00:00Z`;

  const svc = createServiceClient();

  // Sum settled commissions
  const tables = ['sub_agent_commissions', 'agent_commissions'];
  let totalCents = 0;
  let count = 0;
  let source: string | null = null;
  for (const tbl of tables) {
    const { data, error } = await svc
      .from(tbl)
      .select('amount_cents, amount, status, created_at')
      .or(`sub_agent_id.eq.${user.id},super_agent_id.eq.${user.id},agent_id.eq.${user.id}`)
      .in('status', ['settled', 'paid'])
      .gte('created_at', start)
      .lt('created_at', end);
    if (!error && data) {
      data.forEach(r => {
        totalCents += Number(r.amount_cents ?? Number(r.amount ?? 0) * 100);
        count++;
      });
      source = tbl;
      break;
    }
  }

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
    transactions_count: count,
    source,
    note: '1099-NEC eligibility depends on whether total compensation meets the IRS threshold ($600+ for tax year 2025-2026). This summary is informational only — consult a tax professional before filing.',
  });
}
