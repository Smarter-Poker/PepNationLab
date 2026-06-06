import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

/**
 * PATCH /api/agent/sub-agents/[id]/credit-cap
 *
 * SACA Phase 2: Parent adjusts a sub-agent's payment model and virtual
 * credit cap. The credit cap is a virtual ceiling - the real limit is the
 * parent's own admin-assigned credit, debited at order approval. Raising
 * or lowering the cap does not affect existing orders or commissions; it
 * only changes how much new credit the sub-agent can run before being
 * blocked at checkout.
 *
 * Body:
 *   {
 *     paymentModel?: 'credit' | 'prepaid',  (optional)
 *     creditLimit?: number >= 0              (required when on credit)
 *   }
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
      .single();

    if (!callerProfile || callerProfile.is_sub_agent === true) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const paymentModelRaw: unknown = body?.paymentModel;
    const creditLimitRaw: unknown = body?.creditLimit;

    let paymentModel: 'credit' | 'prepaid' | undefined;
    if (paymentModelRaw === 'credit' || paymentModelRaw === 'prepaid') {
      paymentModel = paymentModelRaw;
    } else if (paymentModelRaw !== undefined && paymentModelRaw !== null) {
      return NextResponse.json(
        { error: 'paymentModel Must Be "credit" Or "prepaid".' },
        { status: 400 },
      );
    }

    let creditLimit: number | undefined;
    if (creditLimitRaw !== undefined && creditLimitRaw !== null) {
      creditLimit = Number(creditLimitRaw);
      if (!Number.isFinite(creditLimit) || creditLimit < 0) {
        return NextResponse.json(
          { error: 'creditLimit Must Be A Non-Negative Number.' },
          { status: 400 },
        );
      }
    }

    if (paymentModel === undefined && creditLimit === undefined) {
      return NextResponse.json(
        { error: 'Nothing To Update. Supply paymentModel Or creditLimit.' },
        { status: 400 },
      );
    }

    const { data: subAgent } = await admin
      .from('profiles')
      .select('id, parent_agent_id, account_type, credit_limit, is_sub_agent')
      .eq('id', subAgentId)
      .single();

    if (!subAgent || subAgent.is_sub_agent !== true) {
      return NextResponse.json({ error: 'Sub-Agent Not Found.' }, { status: 404 });
    }
    if (subAgent.parent_agent_id !== callerId) {
      return NextResponse.json(
        { error: 'You Are Not The Parent Of This Sub-Agent.' },
        { status: 403 },
      );
    }

    const finalPaymentModel = paymentModel ?? (subAgent.account_type as 'credit' | 'prepaid');
    let finalCreditLimit: number;
    if (finalPaymentModel === 'credit') {
      if (creditLimit === undefined && paymentModel === 'credit') {
        return NextResponse.json(
          { error: 'creditLimit Is Required When Switching To Credit.' },
          { status: 400 },
        );
      }
      finalCreditLimit = creditLimit ?? Number(subAgent.credit_limit ?? 0);
    } else {
      finalCreditLimit = 0;
    }

    const previousModel = subAgent.account_type;
    const previousLimit = subAgent.credit_limit == null ? null : Number(subAgent.credit_limit);
    if (previousModel === finalPaymentModel && previousLimit === finalCreditLimit) {
      return NextResponse.json({
        success: true,
        unchanged: true,
        account_type: finalPaymentModel,
        credit_limit: finalCreditLimit,
        message: 'No Changes Applied - Values Already Match.',
      });
    }

    const now = new Date().toISOString();
    const { error: updateError } = await admin
      .from('profiles')
      .update({
        account_type: finalPaymentModel,
        credit_limit: finalCreditLimit,
        updated_at: now,
      })
      .eq('id', subAgentId)
      .eq('is_sub_agent', true)
      .eq('parent_agent_id', callerId);

    if (updateError) {
      console.error('[sub-agent credit-cap] update error:', updateError);
      return NextResponse.json(
        { error: 'Credit Cap Update Failed.' },
        { status: 500 },
      );
    }

    await admin.from('admin_audit_log').insert({
      actor_id: callerId,
      action: 'sub_agent_credit_cap_change',
      entity_type: 'profiles',
      entity_id: subAgentId,
      changes: {
        previous_account_type: previousModel,
        new_account_type: finalPaymentModel,
        previous_credit_limit: previousLimit,
        new_credit_limit: finalCreditLimit,
      },
    });

    return NextResponse.json({
      success: true,
      sub_agent_id: subAgentId,
      account_type: finalPaymentModel,
      credit_limit: finalCreditLimit,
      previous_account_type: previousModel,
      previous_credit_limit: previousLimit,
      message: `Sub-Agent Updated To ${finalPaymentModel === 'credit' ? `Credit Line $${finalCreditLimit}` : 'Prepaid'}.`,
    });

  } catch (error) {
    console.error('[sub-agent credit-cap] unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error.' }, { status: 500 });
  }
}
