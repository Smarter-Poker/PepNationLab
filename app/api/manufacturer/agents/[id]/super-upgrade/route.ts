export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireManufacturer } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

/**
 * POST /api/manufacturer/agents/[id]/super-upgrade
 * Toggles super-agent status for an agent in the manufacturer's downline.
 * Body: { is_super_agent: boolean }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireManufacturer();
  if (!gate.ok) return gate.response;

  const manufacturerId = gate.user.id;
  const { id: agentId } = await params;

  if (!agentId || typeof agentId !== 'string') {
    return NextResponse.json({ error: 'Missing agent ID' }, { status: 400 });
  }

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { is_super_agent } = body ?? {};
  if (typeof is_super_agent !== 'boolean') {
    return NextResponse.json({ error: 'is_super_agent must be a boolean' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Ensure target is in manufacturer's downline
  const { data: target } = await supabase
    .from('profiles')
    .select('id, role, parent_agent_id, is_super_agent, full_name')
    .eq('id', agentId)
    .maybeSingle();

  if (!target) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  if (target.parent_agent_id !== manufacturerId) {
    return NextResponse.json({ error: 'You can only manage agents in your own network' }, { status: 403 });
  }
  if (target.role !== 'agent' && target.role !== 'super_agent') {
    return NextResponse.json({ error: 'Only agents can be upgraded to super agent' }, { status: 400 });
  }

  const newRole = is_super_agent ? 'super_agent' : 'agent';

  const { error: updateErr } = await supabase
    .from('profiles')
    .update({
      is_super_agent,
      role: newRole,
      onboarding_completed_at: is_super_agent ? null : undefined, // Re-trigger onboarding on upgrade
      updated_at: new Date().toISOString(),
    })
    .eq('id', agentId);

  if (updateErr) {
    console.error('[manufacturer/super-upgrade]', updateErr);
    return NextResponse.json({ error: 'Failed to update agent' }, { status: 500 });
  }

  // Sync auth metadata
  const { data: userData } = await supabase.auth.admin.getUserById(agentId);
  if (userData?.user) {
    const newMeta = { ...userData.user.app_metadata, role: newRole, is_super_agent };
    await supabase.auth.admin.updateUserById(agentId, { app_metadata: newMeta });
  }

  // Audit log
  try {
    await supabase.from('admin_audit_log').insert({
      actor_id: manufacturerId,
      action: 'manufacturer_super_agent_toggle',
      entity_type: 'profiles',
      entity_id: agentId,
      changes: { is_super_agent, role: newRole, target_name: target.full_name },
    });
  } catch { /* non-fatal */ }

  return NextResponse.json({ success: true, is_super_agent, role: newRole });
}
