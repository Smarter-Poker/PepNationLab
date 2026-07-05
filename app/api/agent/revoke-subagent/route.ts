import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { notifyRoleRevoked } from '@/lib/notify';

/**
 * POST /api/agent/revoke-subagent
 *
 * SACA: A parent agent or super-agent demotes one of their sub-agents
 * back to 'researcher'. Clears the full set of SACA fields together so
 * the CHECK constraints stay satisfied. Sub-agents themselves cannot
 * revoke (no-nested rule).
 *
 * Body: { subAgentId: UUID }
 */
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

  const callerId = gate.user.id;
  const body = await req.json().catch(() => ({}));
  const { subAgentId } = body as { subAgentId?: string };

  if (!subAgentId || typeof subAgentId !== 'string') {
    return NextResponse.json({ error: 'Missing Sub-Agent Id.' }, { status: 400 });
  }
  if (subAgentId === callerId) {
    return NextResponse.json({ error: 'You Cannot Revoke Yourself.' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Caller must not be a sub-agent themselves (no nested revocation)
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('id, is_super_agent, is_sub_agent, role, full_name')
    .eq('id', callerId)
    .maybeSingle();

  if (!callerProfile) {
    return NextResponse.json({ error: 'Caller Profile Not Found.' }, { status: 404 });
  }
  if (callerProfile.is_sub_agent === true) {
    return NextResponse.json(
      { error: 'Sub-Agents Cannot Revoke Other Sub-Agents.' },
      { status: 403 },
    );
  }
  if (!(callerProfile.role === 'agent' || callerProfile.role === 'super_agent' || callerProfile.is_super_agent === true)) {
    return NextResponse.json(
      { error: 'Only Agents And Super-Agents Can Revoke Sub-Agents.' },
      { status: 403 },
    );
  }

  // Target must be a sub-agent in caller's downline
  const { data: target } = await supabase
    .from('profiles')
    .select('id, role, parent_agent_id, is_sub_agent, commission_pct, full_name')
    .eq('id', subAgentId)
    .maybeSingle();

  if (!target) {
    return NextResponse.json({ error: 'Sub-Agent Not Found.' }, { status: 404 });
  }
  if (target.parent_agent_id !== callerId) {
    return NextResponse.json(
      { error: 'You Can Only Revoke Sub-Agents In Your Downline.' },
      { status: 403 },
    );
  }
  if (target.is_sub_agent !== true) {
    return NextResponse.json(
      { error: 'Target Profile Is Not An Active Sub-Agent.' },
      { status: 409 },
    );
  }

  // SACA 2026-05-31: clear referring_sub_agent_id on any researchers that
  // were tagged to this sub-agent BEFORE flipping is_sub_agent=false. If we
  // skipped this step, those researcher rows would carry a dangling tag
  // pointing to a profile where is_sub_agent=false, violating the
  // trg_enforce_referring_sub_agent_is_sub_agent trigger on any future
  // researcher UPDATE and breaking SACA accrual on future orders.
  // Past orders keep orders.referring_sub_agent_id snapshotted at order time
  // and the existing ledger rows stay intact - already-settled commission
  // is permanent.
  const { data: clearedTags, error: clearTagsErr } = await supabase
    .from('profiles')
    .update({ referring_sub_agent_id: null, updated_at: new Date().toISOString() })
    .eq('referring_sub_agent_id', subAgentId)
    .select('id');
  if (clearTagsErr) {
    console.error('[revoke-subagent] clear referring_sub_agent_id error:', clearTagsErr);
    return NextResponse.json(
      { error: 'Revoke Blocked: Could Not Detach Tagged Researchers.' },
      { status: 500 },
    );
  }
  const detachedCount = (clearedTags ?? []).length;

  // Demote - clear ALL the SACA fields together in one UPDATE so the
  // CHECK constraints stay satisfied:
  //   profiles_sub_agent_must_have_parent     (NOT is_sub_agent OR parent IS NOT NULL)
  //   profiles_sub_agent_must_have_commission (NOT is_sub_agent OR commission_pct IS NOT NULL ...)
  // referring_agent_id is intentionally retained for sales attribution
  // back to the demoted user's original referring agent. tier is cleared
  // because the demoted user no longer has agent-side pricing. Any settled
  // commission stays on prepaid_balance - sub-agents earned it before demotion.
  // referring_sub_agent_id on the demoted profile itself is also cleared
  // (a researcher should not be tagged to a no-longer-sub-agent).
  const now = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from('profiles')
    .update({
      role: 'researcher',
      is_sub_agent: false,
      referring_sub_agent_id: null,
      parent_agent_id: null,
      commission_pct: null,
      commission_active_since: null,
      created_by_agent_id: null,
      tier: null,
      updated_at: now,
    })
    .eq('id', subAgentId)
    .eq('parent_agent_id', callerId)
    .eq('is_sub_agent', true);

  if (updateErr) {
    console.error('[revoke-subagent] update error:', updateErr);
    return NextResponse.json({ error: 'Revoke Failed. Please Try Again.' }, { status: 500 });
  }

  await supabase.from('admin_audit_log').insert({
    actor_id: callerId,
    action: 'sub_agent_revoke',
    entity_type: 'profiles',
    entity_id: subAgentId,
    changes: {
      previous_role: target.role,
      new_role: 'researcher',
      previous_is_sub_agent: target.is_sub_agent,
      previous_commission_pct: target.commission_pct == null ? null : Number(target.commission_pct),
      revoked_by: callerId,
      target_name: target.full_name ?? null,
      detached_researcher_count: detachedCount,
    },
  });

  await notifyRoleRevoked(supabase, subAgentId, callerProfile.full_name || 'Your Agent')
    .catch(() => { /* best-effort */ });

  return NextResponse.json({ success: true, detached_researcher_count: detachedCount });
}
