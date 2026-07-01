import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';

/**
 * GET /api/agent/sub-agents
 *
 * SACA Phase 2: Returns the caller's sub-agents under the new commission model.
 * Any agent or super-agent may call this - sub-agents themselves are rejected
 * (the no-nesting rule applies here too).
 *
 * Response: { data: SubAgentRow[] }
 *   SubAgentRow = {
 *     id, full_name, username, email,
 *     is_sub_agent, commission_pct, commission_active_since,
 *     account_type, credit_limit, prepaid_balance,
 *     created_at, is_active,
 *     last_sign_in_at, first_sign_in_at,
 *     pending_commission: number  (sum of pending ledger rows)
 *   }
 */
export async function GET(_req: NextRequest) {
  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;

    const supabase = createAdminClient();
    const callerId = gate.user.id;

    // P0: use maybeSingle() so a missing profile returns null instead of
    // throwing a "multiple/no rows" error.
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role, is_super_agent, is_sub_agent')
      .eq('id', callerId)
      .maybeSingle();

    if (!callerProfile || callerProfile.is_sub_agent === true) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    // List sub-agents under this caller. Uses is_sub_agent flag, not role,
    // because role='agent' is shared with non-sub-agents under super-agents.
    // P1: parent_agent_id = callerId scopes results to this agent's downline
    // only -- no agent can see another agent's sub-agents.
    const { data: subAgents, error } = await supabase
      .from('profiles')
      .select(`
        id, full_name, username, email, phone,
        is_sub_agent, commission_pct, commission_active_since,
        account_type, credit_limit, prepaid_balance,
        created_at, is_active, last_sign_in_at, first_sign_in_at,
        agent_profiles ( slug, display_name, previous_display_name, previous_display_name_dismissed )
      `)
      .eq('parent_agent_id', callerId)
      .eq('is_sub_agent', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[GET sub-agents] fetch error:', error);
      return NextResponse.json({ error: 'Failed To Load Sub-Agents.' }, { status: 500 });
    }

    if (!subAgents || subAgents.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Pull pending commission totals per sub-agent in one batched query
    const subAgentIds = subAgents.map((sa) => sa.id as string);
    const { data: ledgerRows } = await supabase
      .from('sub_agent_commission_ledger')
      .select('sub_agent_id, commission_amount')
      .in('sub_agent_id', subAgentIds)
      .eq('status', 'pending');

    const pendingBySub: Record<string, number> = {};
    for (const row of (ledgerRows ?? [])) {
      const sid = row.sub_agent_id as string;
      pendingBySub[sid] = (pendingBySub[sid] ?? 0) + Number(row.commission_amount ?? 0);
    }

    // P2: Fetch 30-day wholesale volume for each sub-agent (Downline Leaderboard)
    let volumeRows: any = null;
    try {
      const res = await supabase.rpc('fn_agent_own_wholesale_30d_batch', { agent_ids: subAgentIds });
      volumeRows = res.data;
    } catch (e) {
      // Fallback if RPC doesn't exist yet
    }

    // Temporary fallback loop if RPC doesn't exist (can be slow, but we'll create the RPC shortly)
    const volumeBySub: Record<string, number> = {};
    if (volumeRows && Array.isArray(volumeRows)) {
      for (const row of volumeRows) {
        volumeBySub[row.agent_id] = row.volume;
      }
    } else {
      for (const sid of subAgentIds) {
        const { data: vol } = await supabase.rpc('fn_agent_own_wholesale_30d', { p_agent: sid });
        volumeBySub[sid] = Number(vol || 0);
      }
    }

    const enriched = subAgents.map((sa) => ({
      ...sa,
      pending_commission: pendingBySub[sa.id as string] ?? 0,
      volume_30d: volumeBySub[sa.id as string] ?? 0,
    }));

    return NextResponse.json({ data: enriched });
  } catch (error) {
    console.error('[GET sub-agents] unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error.' }, { status: 500 });
  }
}
