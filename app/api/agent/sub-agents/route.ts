import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';

/**
 * GET /api/agent/sub-agents
 *
 * SACA Phase 2: Returns the caller's sub-agents under the new commission model.
 * Any agent or super-agent may call this — sub-agents themselves are rejected
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

    const supabase = await createServiceClient();
    const callerId = gate.user.id;

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role, is_super_agent, is_sub_agent')
      .eq('id', callerId)
      .single();

    if (!callerProfile || callerProfile.is_sub_agent === true) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    // List sub-agents under this caller. Uses is_sub_agent flag, not role,
    // because role='agent' is shared with non-sub-agents under super-agents.
    const { data: subAgents, error } = await supabase
      .from('profiles')
      .select(`
        id, full_name, username, email, phone,
        is_sub_agent, commission_pct, commission_active_since,
        account_type, credit_limit, prepaid_balance,
        created_at, is_active, last_sign_in_at, first_sign_in_at
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

    const enriched = subAgents.map((sa) => ({
      ...sa,
      pending_commission: pendingBySub[sa.id as string] ?? 0,
    }));

    return NextResponse.json({ data: enriched });
  } catch (error) {
    console.error('[GET sub-agents] unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error.' }, { status: 500 });
  }
}
