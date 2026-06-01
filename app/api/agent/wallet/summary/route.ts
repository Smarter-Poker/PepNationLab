// Round 24 Wallet — summary endpoint
// Powers WalletStatusStrip and the /wallet hero card.
import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const svc = createServiceClient();
  const { data: profile } = await svc
    .from('profiles')
    .select('id, role, account_type, prepaid_balance, credit_limit, preferred_payout_handle')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'profile_not_found' }, { status: 404 });

  // Owed this week — sum of open / pending statements
  const { data: openStmts } = await svc
    .from('weekly_statements')
    .select('id, total_owed, status, week_start, week_end, due_date')
    .eq('agent_id', user.id)
    .in('status', ['open', 'pending_payment'])
    .order('week_start', { ascending: false });

  const owedThisWeek = (openStmts ?? []).reduce(
    (sum: number, s: any) => sum + Number(s.total_owed || 0),
    0
  );
  const hasOpenStatement = (openStmts ?? []).length > 0;

  // Next statement date — Sunday 23:59 UTC of current week
  const now = new Date();
  const dow = now.getUTCDay();
  const daysUntilSunday = (7 - dow) % 7;
  const nextStatementDate = new Date(now);
  nextStatementDate.setUTCDate(now.getUTCDate() + daysUntilSunday);
  nextStatementDate.setUTCHours(23, 59, 0, 0);

  // Forecast WIP this week
  let forecastNext = 0;
  const { data: forecast } = await svc.rpc('forecast_next_statement', { p_agent_id: user.id });
  if (typeof forecast === 'number') forecastNext = forecast;

  const isPrepaid = profile.account_type === 'prepaid';
  const primaryLabel = isPrepaid ? 'Prepaid Balance' : 'Credit Available';
  const primary = isPrepaid
    ? Number(profile.prepaid_balance || 0)
    : Math.max(0, Number(profile.credit_limit || 0) - owedThisWeek);

  return NextResponse.json({
    primaryLabel,
    primary,
    owedThisWeek,
    hasOpenStatement,
    nextStatementDate: nextStatementDate.toISOString(),
    forecastNext,
    creditLimit: Number(profile.credit_limit || 0),
    prepaidBalance: Number(profile.prepaid_balance || 0),
    accountType: profile.account_type,
    preferredHandle: profile.preferred_payout_handle ?? null,
    openStatements: openStmts ?? [],
  });
}
