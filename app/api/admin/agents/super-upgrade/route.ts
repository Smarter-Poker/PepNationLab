import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { withIdempotency, readIdempotencyKey } from '@/lib/idempotency';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  try {
    const gate = await requireAdmin();
    if (!gate.ok) return gate.response;

    const body = await req.json();
    const { agentId, is_super_agent } = body;

    if (!agentId || typeof is_super_agent !== 'boolean') {
      return NextResponse.json({ error: 'Invalid Request' }, { status: 400 });
    }

    return withIdempotency({
      userId: gate.userId,
      route: '/api/admin/agents/super-upgrade',
      key: readIdempotencyKey(req),
      request: { agentId, is_super_agent },
      handler: async () => {
    const supabase = await createServiceClient();

    // Prevent making a sub-agent a super-agent
    const { data: agentProfile } = await supabase
      .from('profiles')
      .select('parent_agent_id, role')
      .eq('id', agentId)
      .maybeSingle();

    if (!agentProfile) {
      return NextResponse.json({ error: 'Agent Not Found' }, { status: 404 });
    }
    // Agents and super-agents both store role='agent'; never flip the flag on a
    // researcher or admin row.
    if (agentProfile.role !== 'agent') {
      return NextResponse.json({ error: 'Only Agents Can Be Upgraded To Super Agents' }, { status: 400 });
    }
    if (is_super_agent && agentProfile.parent_agent_id) {
      return NextResponse.json({ error: 'Sub-Agents cannot be upgraded to Super Agents' }, { status: 400 });
    }

    const { error } = await supabase
      .from('profiles')
      .update({ is_super_agent })
      .eq('id', agentId);

    if (error) {
      return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, is_super_agent });
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
