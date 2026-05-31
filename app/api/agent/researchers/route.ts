import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/researchers
 *
 * Returns the caller's downline researchers — accounts where:
 *   role = 'researcher'
 *   referring_agent_id = caller
 *   is_active = true
 *
 * Used by the SACA Phase 2.5 promote-sub-agent UI to populate the
 * candidate researcher picker. Sub-agents are rejected (no-nesting rule).
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

    const { data: researchers, error } = await supabase
      .from('profiles')
      .select('id, full_name, username, email, created_at')
      .eq('role', 'researcher')
      .eq('referring_agent_id', callerId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      console.error('[agent/researchers] fetch error:', error.message);
      return NextResponse.json({ error: 'Failed To Load Researchers.' }, { status: 500 });
    }

    return NextResponse.json({ data: researchers ?? [] });
  } catch (err) {
    console.error('[agent/researchers] unexpected:', err);
    return NextResponse.json({ error: 'Internal Server Error.' }, { status: 500 });
  }
}
