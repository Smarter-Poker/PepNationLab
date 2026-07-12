import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getEffectiveUser } from '@/lib/impersonation';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sub-agent/overview
 *
 * SACA Phase 5: aggregated dashboard payload for a sub-agent.
 * Returns 403 if the caller is not a sub-agent.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await getEffectiveUser(supabase);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from('profiles')
    .select('id, full_name, username, email, is_sub_agent, commission_pct, commission_active_since, account_type, credit_limit, prepaid_balance, parent_agent_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || profile.is_sub_agent !== true) {
    return NextResponse.json({ error: 'Forbidden - Sub-Agents Only.' }, { status: 403 });
  }

  // Parent profile (read-only display)
  let parent: {
    id: string;
    full_name: string | null;
    username: string | null;
    email: string | null;
    storefront_slug: string | null;
  } | null = null;
  let share_link: string | null = null;
  if (profile.parent_agent_id) {
    const { data: p } = await admin
      .from('profiles')
      .select('id, full_name, username, email')
      .eq('id', profile.parent_agent_id)
      .maybeSingle();
    if (p) {
      const { data: ap } = await admin
        .from('agent_profiles')
        .select('slug')
        .eq('id', profile.parent_agent_id)
        .maybeSingle();
      const slug = (ap as { slug?: string | null } | null)?.slug ?? null;
      parent = {
        id: p.id as string,
        full_name: (p.full_name as string | null) ?? null,
        username: (p.username as string | null) ?? null,
        email: (p.email as string | null) ?? null,
        storefront_slug: slug,
      };
      // SACA share link: researcher signs up under parent's storefront with
      // ?sa=<sub-agent-id> URL param so create-researcher / storefront-register
      // can stamp referring_sub_agent_id at signup. Only valid if parent owns
      // an agent_profiles row.
      if (slug) {
        share_link = `/${slug}?sa=${profile.id}`;
      }
    }
  }

  // Aggregate commission totals from the ledger
  const { data: ledgerRows } = await admin
    .from('sub_agent_commission_ledger')
    .select('commission_amount, status')
    .eq('sub_agent_id', user.id);

  let pending_commission = 0;
  let lifetime_commission = 0;
  for (const row of (ledgerRows ?? [])) {
    const amt = Number(row.commission_amount ?? 0);
    if (row.status === 'pending') pending_commission += amt;
    else if (row.status === 'settled') lifetime_commission += amt;
  }

  // Recent settlements (last 8 weeks)
  const { data: settlements } = await admin
    .from('sub_agent_settlements')
    .select('id, week_start, week_end, total_commission, orders_count, settled_at')
    .eq('sub_agent_id', user.id)
    .order('week_start', { ascending: false })
    .limit(8);

  // Recent orders the sub-agent is attributed to (last 10)
  const { data: orders } = await admin
    .from('orders')
    .select('id, total, status, created_at, sub_agent_commission_amount, sub_agent_commission_pct, buyer_id')
    .eq('referring_sub_agent_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10);

  // Researcher count tagged to this sub-agent
  const { count: researchers_count } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('referring_sub_agent_id', user.id);

  return NextResponse.json({
    profile: {
      id: profile.id,
      full_name: profile.full_name,
      username: profile.username,
      email: profile.email,
      commission_pct: profile.commission_pct,
      commission_active_since: profile.commission_active_since,
      account_type: profile.account_type,
      credit_limit: profile.credit_limit,
      prepaid_balance: profile.prepaid_balance,
      parent,
    },
    share_link,
    pending_commission: Math.round(pending_commission * 100) / 100,
    lifetime_commission: Math.round(lifetime_commission * 100) / 100,
    recent_settlements: settlements ?? [],
    recent_orders: orders ?? [],
    referred_researchers_count: researchers_count ?? 0,
  });
}
