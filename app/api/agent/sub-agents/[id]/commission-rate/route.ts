import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyCommissionSafeguard } from '@/lib/pricing';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

/**
 * PATCH /api/agent/sub-agents/[id]/commission-rate
 *
 * SACA Phase 2: Parent updates a sub-agent's commission percentage.
 *
 * Forward-only: new rate applies to orders created from this moment on.
 * Existing orders keep the rate that was snapshotted on the orders row
 * at creation time (orders.sub_agent_commission_pct) and on the ledger
 * row (sub_agent_commission_ledger.commission_pct).
 *
 * Body: { commissionPct: number (0..40 inclusive) }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { id: subAgentId } = await params;
  if (!subAgentId || typeof subAgentId !== 'string') {
    return NextResponse.json({ error: 'Sub-Agent Id Is Required.' }, { status: 400 });
  }

  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;

    const admin = createAdminClient();
    const callerId = gate.user.id;

    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role, is_super_agent, is_sub_agent')
      .eq('id', callerId)
      .maybeSingle();

    if (!callerProfile || callerProfile.is_sub_agent === true) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const commissionPct = Number(body?.commissionPct);
    if (!Number.isFinite(commissionPct) || commissionPct < 0 || commissionPct > 40) {
      return NextResponse.json(
        { error: 'commissionPct Must Be Between 0 And 40 Inclusive.' },
        { status: 400 },
      );
    }

    const { data: subAgent } = await admin
      .from('profiles')
      .select('id, parent_agent_id, commission_pct, commission_active_since, is_sub_agent')
      .eq('id', subAgentId)
      .maybeSingle();

    if (!subAgent || subAgent.is_sub_agent !== true) {
      return NextResponse.json({ error: 'Sub-Agent Not Found.' }, { status: 404 });
    }
    if (subAgent.parent_agent_id !== callerId) {
      return NextResponse.json(
        { error: 'You Are Not The Parent Of This Sub-Agent.' },
        { status: 403 },
      );
    }

    const safeguard = await verifyCommissionSafeguard(admin, callerId, commissionPct);
    if (!safeguard.safe) {
      return NextResponse.json({ error: safeguard.error }, { status: 400 });
    }
    if (safeguard.warning) {
      // Fire notification asynchronously, don't await it
      import('@/lib/notify').then(({ notifyMarginWarning }) => {
        notifyMarginWarning(admin, callerId).catch(err => {
          console.error('[commission-rate] Failed to fire margin warning:', err);
        });
      });
    }

    const previousPct = subAgent.commission_pct == null ? null : Number(subAgent.commission_pct);
    if (previousPct !== null && previousPct === commissionPct) {
      return NextResponse.json({
        success: true,
        unchanged: true,
        commission_pct: commissionPct,
        message: 'Commission Rate Is Already Set To That Value.',
      });
    }

    const now = new Date().toISOString();
    const { error: updateError } = await admin
      .from('profiles')
      .update({
        commission_pct: commissionPct,
        commission_active_since: now,
        updated_at: now,
      })
      .eq('id', subAgentId)
      .eq('is_sub_agent', true)
      .eq('parent_agent_id', callerId);

    if (updateError) {
      console.error('[sub-agent commission-rate] update error:', updateError);
      return NextResponse.json(
        { error: 'Commission Rate Update Failed.' },
        { status: 500 },
      );
    }

    await admin.from('admin_audit_log').insert({
      actor_id: callerId,
      action: 'sub_agent_commission_rate_change',
      entity_type: 'profiles',
      entity_id: subAgentId,
      changes: {
        previous_commission_pct: previousPct,
        new_commission_pct: commissionPct,
        previous_active_since: subAgent.commission_active_since,
        new_active_since: now,
      },
    });

    return NextResponse.json({
      success: true,
      sub_agent_id: subAgentId,
      commission_pct: commissionPct,
      commission_active_since: now,
      previous_commission_pct: previousPct,
      message: `Commission Rate Updated To ${commissionPct}%.`,
    });

  } catch (error) {
    console.error('[sub-agent commission-rate] unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error.' }, { status: 500 });
  }
}
