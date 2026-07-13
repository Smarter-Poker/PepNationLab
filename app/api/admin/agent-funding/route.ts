export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';

/**
 * GET /api/admin/agent-funding?days=90
 *
 * Admin-only rollup of what every agent / super-agent has FUNDED out of their own
 * pocket (referral bonuses, signup promos, agent credits, sub-agent commissions)
 * plus their current credit-line debt and headroom. This is the "tracked &
 * accounted" surface for the no-house-funding rule. Read-only.
 */

interface FundingRow {
  agent_id: string;
  name: string;
  email: string;
  role: string;
  funded_referrals: number;
  funded_promos: number;
  funded_credits: number;
  funded_subagent_commission: number;
  funded_other: number;
  total_funded: number;
  credit_used: number;
  prepaid_balance: number;
  credit_limit: number;
  headroom: number;
  last_funded_at: string | null;
}

function parseSince(url: string): string | null {
  try {
    const raw = (new URL(url).searchParams.get('days') || '90').toLowerCase();
    if (raw === 'all') return null;
    const n = parseInt(raw, 10);
    const days = (!isFinite(n) || n <= 0) ? 90 : Math.min(n, 3650);
    return new Date(Date.now() - days * 86400000).toISOString();
  } catch {
    return new Date(Date.now() - 90 * 86400000).toISOString();
  }
}

export async function GET(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const db = createAdminClient();
  const since = parseSince(req.url);

  const { data, error } = await db.rpc('admin_agent_funding_summary', { p_since: since });
  if (error) {
    return NextResponse.json({ error: 'Failed to load funding summary.' }, { status: 500 });
  }

  const rows = (data || []) as FundingRow[];
  const num = (v: unknown) => Number(v) || 0;

  const totals = rows.reduce(
    (acc, r) => {
      acc.total_funded += num(r.total_funded);
      acc.funded_referrals += num(r.funded_referrals);
      acc.funded_promos += num(r.funded_promos);
      acc.funded_credits += num(r.funded_credits);
      acc.funded_subagent_commission += num(r.funded_subagent_commission);
      acc.credit_used += num(r.credit_used);
      return acc;
    },
    { total_funded: 0, funded_referrals: 0, funded_promos: 0, funded_credits: 0, funded_subagent_commission: 0, credit_used: 0 },
  );

  return NextResponse.json({
    rows,
    totals,
    count: rows.length,
    since,
    generatedAt: new Date().toISOString(),
  });
}
