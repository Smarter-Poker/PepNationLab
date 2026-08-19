// Round 24 Wallet - summary endpoint
// Powers WalletStatusStrip and the /wallet hero card.
import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { resolveEffectiveUserId } from '@/lib/impersonation';
import { computeForecast } from '@/lib/statements';
import { chicagoMidnightIso, currentWeekStartCst } from '@/lib/time-cst';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData?.user;
  if (authError || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const svc = await createServiceClient();

  // Honor an active admin "View As" session so this summary reflects the agent
  // being viewed, not the admin's own balance.
  const { effectiveUserId } = await resolveEffectiveUserId(user.id);
  const { data: profile } = await svc
    .from('profiles')
    .select('id, role, account_type, prepaid_balance, credit_limit, credit_used, preferred_payout_handle')
    .eq('id', effectiveUserId)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: 'profile_not_found' }, { status: 404 });

  // Researchers are allowed too: /wallet is linked for every role from the
  // navbar badge, and blocking researchers here made the whole wallet page
  // throw "Could Not Load Your Wallet" for them despite /api/wallet working.
  // A researcher simply gets a prepaid-shaped summary with no statements.
  const ALLOWED_ROLES = ['agent', 'super_agent', 'admin', 'researcher'];
  if (!ALLOWED_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Owed this week - open / pending statements PLUS open super-agent invoices
  // billed to this agent. Nested agents are billed via agent_invoices, not
  // weekly_statements; omitting them showed "$0 Owed This Week" to agents
  // whose Open Invoices list right below was non-empty.
  const [{ data: openStmts }, { data: openInvoices }] = await Promise.all([
    svc
      .from('weekly_statements')
      .select('id, total_owed, status, week_start, week_end, due_date')
      .eq('agent_id', effectiveUserId)
      .in('status', ['open', 'pending_payment'])
      .order('week_start', { ascending: false }),
    svc
      .from('agent_invoices')
      .select('id, total_owed, status')
      .eq('agent_id', effectiveUserId)
      .eq('status', 'open'),
  ]);

  const owedThisWeek =
    (openStmts ?? []).reduce((sum: number, s: any) => sum + Number(s.total_owed || 0), 0)
    + (openInvoices ?? []).reduce((sum: number, i: any) => sum + Number(i.total_owed || 0), 0);
  const hasOpenStatement =
    (openStmts ?? []).some((s: any) => Number(s.total_owed || 0) > 0)
    || (openInvoices ?? []).some((i: any) => Number(i.total_owed || 0) > 0);

  // The billing week closes at Chicago midnight, not UTC midnight. Deriving
  // this date in UTC put the boundary 5-6 hours late, so an order placed
  // Sunday evening CT was shown as belonging to next week while the biller
  // counted it in the week that just closed.
  const now = new Date();
  const weekStart = currentWeekStartCst(now);
  // End of the open week = next Monday 00:00 CT, i.e. the instant the cron
  // will bill it. Present it as the last second of Sunday for the UI.
  const nextStatementDate = new Date(
    new Date(chicagoMidnightIso(addDaysStr(weekStart, 7))).getTime() - 1000
  );

  // Forecast for the week in progress. This runs the SAME code the Monday
  // biller runs (computeStatement for top-level agents, computeDownlineInvoice
  // for parented ones) rather than a second hand-written query. The old
  // forecast_next_statement RPC summed RETAIL subtotals over a UTC week and
  // was wrong in eight separate ways at once - see lib/statements.ts.
  let forecastNext = 0;
  try {
    forecastNext = await computeForecast(svc, effectiveUserId, weekStart);
  } catch (err) {
    console.error('[wallet/summary] forecast failed:', err instanceof Error ? err.message : String(err));
  }

  // Admins (and anyone without a positive credit line) are prepaid - their
  // wallet is funded by prepaid_balance, not by a credit line. account_type
  // is sometimes NULL for admin accounts (the seed didn't set it), so we
  // can't blindly check `=== 'prepaid'`. Treat the explicit 'prepaid' enum,
  // the admin role, and any account with no credit line as prepaid.
  const creditUsed = Number(profile.credit_used || 0);
  const creditLimit = Number(profile.credit_limit || 0);
  const isPrepaid =
    profile.account_type === 'prepaid'
    || profile.role === 'admin'
    || creditLimit <= 0;
  const primaryLabel = isPrepaid ? 'Prepaid Balance' : 'Credit Available';
  // Credit available now reflects the live running credit_used (charged on order
  // approval, paid down by admin payments) rather than only billed statements.
  const primary = isPrepaid
    ? Number(profile.prepaid_balance || 0)
    : Math.max(0, creditLimit - creditUsed);

  return NextResponse.json({
    primaryLabel,
    primary,
    owedThisWeek,
    hasOpenStatement,
    nextStatementDate: nextStatementDate.toISOString(),
    forecastNext,
    // Only expose a live credit line to accounts explicitly set as account_type='credit'.
    // All profiles have a credit_limit DB column (default $100k) as an internal ceiling —
    // returning it to prepaid agents causes phantom credit-line UI to render.
    creditLimit: isPrepaid ? null : creditLimit,
    creditUsed,
    prepaidBalance: Number(profile.prepaid_balance || 0),
    accountType: profile.account_type,
    preferredHandle: profile.preferred_payout_handle ?? null,
    openStatements: openStmts ?? [],
  });
}
