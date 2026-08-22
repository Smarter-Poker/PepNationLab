import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

// Admin oversight of the downline billing chain: every weekly invoice a
// super-agent bills their downline agent (agent_invoices). Admin sees all;
// optional ?status= / ?super_agent_id= / ?agent_id= filters.
export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const superAgentId = searchParams.get('super_agent_id');
    const agentId = searchParams.get('agent_id');

    let query = supabase
      .from('agent_invoices')
      .select('id, super_agent_id, agent_id, week_start, week_end, total_cogs, total_shipping, total_owed, status, due_date, paid_at, created_at, super_agent:profiles!super_agent_id(full_name, email), downline:profiles!agent_id(full_name, email)')
      .order('week_start', { ascending: false })
      .limit(1000);

    if (status) query = query.eq('status', status);
    if (superAgentId) query = query.eq('super_agent_id', superAgentId);
    if (agentId) query = query.eq('agent_id', agentId);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
    }
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
