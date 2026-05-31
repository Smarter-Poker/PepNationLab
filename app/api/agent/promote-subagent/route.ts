import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { notifyPromotedToAgent, notifyPromotionSuccess } from '@/lib/notify';

/**
 * POST /api/agent/promote-subagent
 *
 * SACA Phase 2: Promotes a researcher in the caller's downline into a sub-agent.
 *
 * New model (2026-05-30):
 *  - Sub-agents do NOT get their own storefront. They sell on the parent's
 *    storefront at the parent's prices. No agent_profiles row is created.
 *  - Sub-agent has a commission_pct (0-40), set at promote time, changeable
 *    later via PATCH /api/agent/sub-agents/[id]/commission-rate.
 *  - Sub-agent has a payment model (credit or prepaid) and credit_limit set
 *    by the parent — virtual cap, parent's own admin credit is the real ceiling.
 *  - Sub-agent's referring_agent_id is preserved (storefront access tag).
 *  - parent_agent_id is set to the caller so the sub-agent appears in the
 *    caller's downline.
 *  - Sub-agents cannot have sub-agents (DB trigger enforces, route checks too).
 *
 * Body:
 *   {
 *     researcherId: UUID,
 *     commissionPct: number (0..40 inclusive),
 *     paymentModel: 'credit' | 'prepaid',
 *     creditLimit?: number (required when paymentModel='credit', >= 0)
 *   }
 */
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;

    const admin = createAdminClient();
    const callerId = gate.user.id;

    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role, is_super_agent, is_sub_agent, full_name, username')
      .eq('id', callerId)
      .single();

    if (!callerProfile) {
      return NextResponse.json({ error: 'Caller Profile Not Found' }, { status: 404 });
    }
    if (callerProfile.is_sub_agent === true) {
      return NextResponse.json(
        { error: 'Sub-Agents Cannot Promote Or Create Sub-Agents.' },
        { status: 403 },
      );
    }
    if (!(callerProfile.role === 'agent' || callerProfile.role === 'super_agent' || callerProfile.is_super_agent === true)) {
      return NextResponse.json(
        { error: 'Only Agents And Super-Agents Can Promote Sub-Agents.' },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const researcherId: unknown = body?.researcherId;
    const commissionPctRaw: unknown = body?.commissionPct;
    const paymentModel: unknown = body?.paymentModel;
    const creditLimitRaw: unknown = body?.creditLimit;

    if (typeof researcherId !== 'string' || researcherId.length === 0) {
      return NextResponse.json({ error: 'researcherId Is Required.' }, { status: 400 });
    }
    const commissionPct = Number(commissionPctRaw);
    if (!Number.isFinite(commissionPct) || commissionPct < 0 || commissionPct > 40) {
      return NextResponse.json(
        { error: 'commissionPct Must Be Between 0 And 40 Inclusive.' },
        { status: 400 },
      );
    }
    if (paymentModel !== 'credit' && paymentModel !== 'prepaid') {
      return NextResponse.json(
        { error: 'paymentModel Must Be Either "credit" Or "prepaid".' },
        { status: 400 },
      );
    }
    let creditLimit: number | null = null;
    if (paymentModel === 'credit') {
      creditLimit = Number(creditLimitRaw);
      if (!Number.isFinite(creditLimit) || creditLimit < 0) {
        return NextResponse.json(
          { error: 'creditLimit Must Be A Non-Negative Number When paymentModel Is "credit".' },
          { status: 400 },
        );
      }
    }

    const { data: researcherProfile } = await admin
      .from('profiles')
      .select('role, referring_agent_id, full_name, username, email, is_sub_agent')
      .eq('id', researcherId)
      .single();

    if (!researcherProfile) {
      return NextResponse.json({ error: 'Researcher Not Found.' }, { status: 404 });
    }
    if (researcherProfile.referring_agent_id !== callerId) {
      return NextResponse.json(
        { error: 'Researcher Does Not Belong To Your Downline.' },
        { status: 403 },
      );
    }
    if (researcherProfile.role !== 'researcher') {
      return NextResponse.json(
        { error: 'Only Researcher Accounts Can Be Promoted To Sub-Agent.' },
        { status: 400 },
      );
    }
    if (researcherProfile.is_sub_agent === true) {
      return NextResponse.json(
        { error: 'User Is Already A Sub-Agent.' },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      role: 'agent',
      is_sub_agent: true,
      parent_agent_id: callerId,
      created_by_agent_id: callerId,
      commission_pct: commissionPct,
      commission_active_since: now,
      account_type: paymentModel,
      updated_at: now,
    };
    if (paymentModel === 'credit') {
      updatePayload.credit_limit = creditLimit;
    } else {
      updatePayload.credit_limit = 0;
    }

    const { error: updateError } = await admin
      .from('profiles')
      .update(updatePayload)
      .eq('id', researcherId);

    if (updateError) {
      console.error('[promote-subagent] profiles update error:', updateError);
      const isCheck = /check_violation|constraint/i.test(String(updateError.message));
      return NextResponse.json(
        {
          error: isCheck
            ? 'Promotion Rejected By Database Constraint.'
            : 'Promotion Failed. Please Try Again.',
        },
        { status: isCheck ? 400 : 500 },
      );
    }

    await admin.from('admin_audit_log').insert({
      actor_id: callerId,
      action: 'sub_agent_promote',
      entity_type: 'profiles',
      entity_id: researcherId,
      changes: {
        previous_role: researcherProfile.role,
        new_role: 'agent',
        is_sub_agent: true,
        commission_pct: commissionPct,
        commission_active_since: now,
        parent_agent_id: callerId,
        account_type: paymentModel,
        credit_limit: paymentModel === 'credit' ? creditLimit : 0,
      },
    });

    void Promise.all([
      notifyPromotedToAgent(admin, researcherId, '', callerProfile.full_name || 'Your Agent'),
      notifyPromotionSuccess(admin, callerId, researcherProfile.full_name || 'Researcher', ''),
    ]).catch(() => { /* best-effort */ });

    return NextResponse.json({
      success: true,
      sub_agent_id: researcherId,
      commission_pct: commissionPct,
      account_type: paymentModel,
      credit_limit: paymentModel === 'credit' ? creditLimit : 0,
      message: `${researcherProfile.full_name || 'Researcher'} Has Been Promoted To Sub-Agent At ${commissionPct}% Commission.`,
    });

  } catch (error) {
    console.error('[promote-subagent] unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error.' }, { status: 500 });
  }
}
