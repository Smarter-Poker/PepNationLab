// R24 hotfix — 1099-NEC summary. Reads agent_commissions (NUMERIC dollars,
// status enum: pending/approved/paid/void). Sums settled (status='paid').
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
    .from('agent_commissions')
    .select('commission_amount, status, created_at')
    .eq('agent_id', user.id)
    .eq('status', 'paid')
    .gte('created_at', start)
    .lt('created_at', end);

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
    note: '1099-NEC eligibility depends on whether total compensation meets the IRS threshold ($600+ for tax year 2025-2026). This summary is informational only — consult a tax professional before filing.',
  });
}
