import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';

export async function POST(req: NextRequest) {
  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;

    const supabase = await createServiceClient();
    const superAgentId = gate.user.id;

    // Verify caller is actually a Super Agent
    const { data: superAgentProfile } = await supabase
      .from('profiles')
      .select('is_super_agent')
      .eq('id', superAgentId)
      .single();

    if (!superAgentProfile?.is_super_agent) {
      return NextResponse.json({ error: 'Only Super Agents can promote Sub-Agents' }, { status: 403 });
    }

    const body = await req.json();
    const { researcherId } = body;

    if (!researcherId) {
      return NextResponse.json({ error: 'Researcher ID is required' }, { status: 400 });
    }

    // Verify the researcher belongs to this Super Agent
    const { data: researcherProfile } = await supabase
      .from('profiles')
      .select('role, referring_agent_id')
      .eq('id', researcherId)
      .single();

    if (!researcherProfile || researcherProfile.referring_agent_id !== superAgentId) {
      return NextResponse.json({ error: 'Researcher not found or does not belong to you' }, { status: 404 });
    }

    if (researcherProfile.role === 'agent' || researcherProfile.role === 'super_agent' || researcherProfile.role === 'admin') {
      return NextResponse.json({ error: 'User is already an Agent, Super Agent, or Admin' }, { status: 400 });
    }

    // Promote to Sub-Agent. We intentionally do NOT clear referring_agent_id
    // — the original referral linkage is preserved for attribution, and any
    // researchers whose referring_agent_id already points at this user keep
    // their relationship intact. parent_agent_id is the only field that
    // distinguishes a sub-agent from a top-level agent.
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        role: 'agent',
        parent_agent_id: superAgentId,
      })
      .eq('id', researcherId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
