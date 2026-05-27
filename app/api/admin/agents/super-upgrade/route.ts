import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function POST(req: NextRequest) {
  try {
    const gate = await requireAdmin();
    if (!gate.ok) return gate.response;

    const body = await req.json();
    const { agentId, is_super_agent } = body;

    if (!agentId || typeof is_super_agent !== 'boolean') {
      return NextResponse.json({ error: 'Invalid Request' }, { status: 400 });
    }

    const supabase = await createServiceClient();

    // Prevent making a sub-agent a super-agent
    const { data: agentProfile } = await supabase
      .from('profiles')
      .select('parent_agent_id')
      .eq('id', agentId)
      .single();

    if (is_super_agent && agentProfile?.parent_agent_id) {
      return NextResponse.json({ error: 'Sub-Agents cannot be upgraded to Super Agents' }, { status: 400 });
    }

    const { error } = await supabase
      .from('profiles')
      .update({ is_super_agent })
      .eq('id', agentId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, is_super_agent });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
