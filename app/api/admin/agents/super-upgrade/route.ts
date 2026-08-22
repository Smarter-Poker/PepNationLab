import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { withIdempotency, readIdempotencyKey } from '@/lib/idempotency';
import { writeAuditLog } from '@/lib/admin-audit';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  try {
    const gate = await requireSession();
    if (!gate.ok) return gate.response;

    const supabase = createAdminClient();

    // Admins can promote/demote anyone. Super-agents can only manage their own downline.
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role, is_super_agent')
      .eq('id', gate.user.id)
      .maybeSingle();

    const isAdmin = callerProfile?.role === 'admin';
    const isSuperAgent = callerProfile?.is_super_agent === true || callerProfile?.role === 'super_agent';
    if (!isAdmin && !isSuperAgent) {
      return NextResponse.json({ error: 'Forbidden. Only Admins And Super Agents Can Change Agent Roles.' }, { status: 403 });
    }

    const body = await req.json();
    const { agentId, is_super_agent } = body;

    if (!agentId || typeof is_super_agent !== 'boolean') {
      return NextResponse.json({ error: 'Invalid Request' }, { status: 400 });
    }

    return withIdempotency({
      userId: gate.user.id,
      route: '/api/admin/agents/super-upgrade',
      key: readIdempotencyKey(req),
      request: { agentId, is_super_agent },
      handler: async () => {

    // Fetch the target agent
    const { data: agentProfile } = await supabase
      .from('profiles')
      .select('parent_agent_id, role, is_sub_agent')
      .eq('id', agentId)
      .maybeSingle();

    if (!agentProfile) {
      return NextResponse.json({ error: 'Agent Not Found' }, { status: 404 });
    }

    // Super-agents can only manage agents in their own downline
    if (!isAdmin && agentProfile.parent_agent_id !== gate.user.id) {
      return NextResponse.json({ error: 'You Can Only Manage Agents In Your Own Downline.' }, { status: 403 });
    }
    // Agents and super-agents both store role='agent'; never flip the flag on a
    // researcher or admin row. Also accept legacy role='super_agent'.
    if (agentProfile.role !== 'agent' && agentProfile.role !== 'super_agent') {
      return NextResponse.json({ error: 'Only Agents Can Be Upgraded To Super Agents.' }, { status: 400 });
    }
    if (is_super_agent && agentProfile.parent_agent_id) {
      return NextResponse.json({ error: 'Sub-Agents Cannot Be Upgraded To Super Agents' }, { status: 400 });
    }

    // Upgrading to Super Agent re-triggers onboarding so the new super agent
    // completes the super-agent setup (incl. agent markup) before using the
    // dashboard. A downgrade does not force re-onboarding.
    //
    // CRITICAL: role MUST be kept in sync with is_super_agent. Several
    // permission gates check role === 'super_agent' exclusively (not the flag).
    // The previous bug was that this route only set the flag and left role='agent',
    // causing super agents to be treated as regular agents in role-gated paths.
    const upgradeUpdate: Record<string, unknown> = {
      is_super_agent,
      role: is_super_agent ? 'super_agent' : 'agent',
    };
    if (is_super_agent === true) {
      upgradeUpdate.onboarding_completed_at = null;
      // Clear stale step acknowledgments so the agent does not skip the new
      // super-agent-specific steps (agent markup tutorial) with flags left
      // over from their prior agent onboarding.
      upgradeUpdate.onboarding_progress = {};
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update(upgradeUpdate)
      .eq('id', agentId);

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    // CRITICAL: Sync the role to auth.users app_metadata so the JWT reflects the upgrade.
    // Without this, the user is treated as a super-agent in DB queries but a regular agent in RLS and API gates.
    const { data: userData } = await supabase.auth.admin.getUserById(agentId);
    if (userData?.user) {
      const newRole = is_super_agent ? 'super_agent' : 'agent';
      const newMeta = { ...userData.user.app_metadata, role: newRole };
      await supabase.auth.admin.updateUserById(agentId, { app_metadata: newMeta });
    }

    await writeAuditLog(supabase, {
      actorId: gate.user.id,
      action: 'agent_super_status_changed',
      entityType: 'profile',
      entityId: agentId,
      changes: { is_super_agent },
    });

    return NextResponse.json({ success: true, is_super_agent });
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
