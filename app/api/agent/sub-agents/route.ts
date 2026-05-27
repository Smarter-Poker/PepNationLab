import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;

    const supabase = await createServiceClient();
    const superAgentId = gate.user.id;

    // Verify caller is a Super Agent
    const { data: superAgentProfile } = await supabase
      .from('profiles')
      .select('is_super_agent')
      .eq('id', superAgentId)
      .single();

    if (!superAgentProfile?.is_super_agent) {
      return NextResponse.json({ error: 'Only Super Agents can view Sub-Agents' }, { status: 403 });
    }

    // Fetch Sub-Agents (Agents where parent_agent_id = superAgentId)
    const { data: subAgents, error } = await supabase
      .from('profiles')
      .select('*, agent_profiles(slug, is_active)')
      .eq('role', 'agent')
      .eq('parent_agent_id', superAgentId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: subAgents });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
