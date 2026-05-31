import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';

export async function GET(req: Request) {
  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;

    const agentId = gate.user.id;
    const supabase = await createServiceClient();

    // Only agents without a parent get Admin statements.
    const { data: profile } = await supabase
      .from('profiles')
      .select('parent_agent_id')
      .eq('id', agentId)
      .single();

    if (profile?.parent_agent_id) {
      return NextResponse.json({ error: 'Sub-agents do not receive Admin statements.' }, { status: 403 });
    }

    const { data: statements, error } = await supabase
      .from('weekly_statements')
      .select('id, week_start, week_end, total_cogs, total_shipping, total_owed, status, statement_orders(count)')
      .eq('agent_id', agentId)
      .order('week_start', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
    }

    return NextResponse.json({ data: statements });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
