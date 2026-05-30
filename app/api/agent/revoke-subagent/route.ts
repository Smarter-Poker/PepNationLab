import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { notifyRoleRevoked } from '@/lib/notify';

// POST: Super-agent demotes one of their sub-agents back to 'researcher'.
// Keeps referring_agent_id intact so downline sales attribution is preserved.
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

  const callerId = gate.user.id;
  const body = await req.json().catch(() => ({}));
  const { subAgentId } = body as { subAgentId?: string };

  if (!subAgentId || typeof subAgentId !== 'string') {
    return NextResponse.json({ error: 'Missing Sub Agent Id' }, { status: 400 });
  }

  if (subAgentId === callerId) {
    return NextResponse.json({ error: 'You Cannot Revoke Yourself' }, { status: 400 });
  }

  const supabase = await createServiceClient();

  // Confirm the caller is a super_agent
  const { data: callerProfile, error: callerErr } = await supabase
    .from('profiles')
    .select('id, is_super_agent, role')
    .eq('id', callerId)
    .maybeSingle();

  if (callerErr || !callerProfile) {
    return NextResponse.json({ error: 'Caller Profile Not Found' }, { status: 404 });
  }
  if (!callerProfile.is_super_agent) {
    return NextResponse.json(
      { error: 'Only Super Agents Can Revoke Sub Agent Privileges' },
      { status: 403 }
    );
  }

  // Confirm the target is currently a sub_agent owned by the caller
  const { data: target, error: targetErr } = await supabase
    .from('profiles')
    .select('id, role, parent_agent_id, full_name')
    .eq('id', subAgentId)
    .maybeSingle();

  if (targetErr || !target) {
    return NextResponse.json({ error: 'Sub Agent Not Found' }, { status: 404 });
  }
  if (target.parent_agent_id !== callerId) {
    return NextResponse.json(
      { error: 'You Can Only Revoke Sub Agents In Your Downline' },
      { status: 403 }
    );
  }
  if (target.role !== 'agent') {
    return NextResponse.json(
      { error: 'Target Profile Is Not An Active Sub Agent' },
      { status: 409 }
    );
  }

  // Demote: role -> researcher, clear parent_agent_id and tier.
  // referring_agent_id is intentionally retained for downline sales attribution.
  const { error: updateErr } = await supabase
    .from('profiles')
    .update({
      role: 'researcher',
      parent_agent_id: null,
      tier: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', subAgentId)
    .eq('parent_agent_id', callerId);

  if (updateErr) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  // Audit log
  await supabase.from('admin_audit_log').insert({
    actor_id: callerId,
    action: 'subagent_revoke',
    entity_type: 'profile',
    entity_id: subAgentId,
    changes: {
      from: 'agent',
      to: 'researcher',
      revoked_by: callerId,
      target_name: target.full_name ?? null,
    },
  });

  // Fetch super-agent name for the notification
  const { data: callerFullProfile } = await supabase.from('profiles').select('full_name').eq('id', callerId).maybeSingle();
  const superAgentName = callerFullProfile?.full_name || 'Your Super Agent';

  // Fire-and-forget: notify the demoted user
  void notifyRoleRevoked(supabase, subAgentId, superAgentName).catch(() => { /* best-effort */ });

  return NextResponse.json({ success: true });
}
