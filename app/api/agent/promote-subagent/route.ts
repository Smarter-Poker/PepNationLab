import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { notifyPromotedToAgent, notifyPromotionSuccess } from '@/lib/notify';
import { generateQrDataUrl } from '@/lib/qr';
import { verifyCommissionSafeguard } from '@/lib/pricing';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://pepnationlab.com';

/**
 * Provisions a full storefront + product catalog for a newly minted full Agent.
 * Mirrors POST /api/agent/agents so a super-agent's promoted agent is a complete,
 * visible storefront rather than an invisible profile-only shell. Idempotent:
 * skips storefront/product creation if rows already exist. Best-effort and
 * non-fatal -- the profile is already a full agent regardless of outcome.
 */
async function provisionAgentStorefront(
  admin: ReturnType<typeof createAdminClient>,
  agentId: string,
  username: string | null,
  fullName: string | null,
): Promise<string | null> {
  let slug: string | null = null;
  try {
    const { data: existingStore } = await admin
      .from('agent_profiles')
      .select('id, slug')
      .eq('id', agentId)
      .maybeSingle();

    if (existingStore) {
      slug = (existingStore as { slug?: string | null }).slug ?? null;
    } else {
      const base =
        ((username || fullName || 'agent') as string)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 40) || 'agent';
      slug = base;
      for (let i = 2; i < 100; i++) {
        const { data: clash } = await admin
          .from('agent_profiles')
          .select('id')
          .eq('slug', slug)
          .maybeSingle();
        if (!clash) break;
        slug = `${base}-${i}`;
      }
      let qr: string | null = null;
      try {
        qr = await generateQrDataUrl(`${APP_URL}/${slug}`);
      } catch {
        /* QR is non-essential; storefront works without it */
      }
      await admin.from('agent_profiles').insert({
        id: agentId,
        slug,
        display_name: (fullName || username || 'Agent') as string,
        qr_code_data: qr,
        is_active: true,
      });
    }

    // Provision the agent's product catalog only if none exists yet.
    const { count: prodCount } = await admin
      .from('agent_products')
      .select('id', { count: 'exact', head: true })
      .eq('agent_id', agentId);

    if (!prodCount) {
      const { data: rookieTier } = await admin
        .from('house_tiers')
        .select('markup')
        .eq('level', 3)
        .single();
      const { data: products } = await admin
        .from('products')
        .select('id, base_cost')
        .eq('is_active', true);

      if (rookieTier && products && products.length > 0) {
        const rookieMultiplier = 1 + Number(rookieTier.markup);
        const rows = products.map((p) => ({
          agent_id: agentId,
          product_id: p.id,
          retail_price: Math.round(Number(p.base_cost) * rookieMultiplier * 100) / 100,
          margin_percent: 50,
          is_visible: true,
          sort_order: 0,
        }));
        await admin.from('agent_products').insert(rows);
      }
    }
  } catch (provErr) {
    console.error('[promote-subagent] storefront provisioning failed:', provErr);
  }
  return slug;
}

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
 *    by the parent - virtual cap, parent's own admin credit is the real ceiling.
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
 *
 * Response on success also includes parent_slug + share_link so the UI can
 * render a copyable invite URL the parent gives the sub-agent.
 */
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;

    const admin = createAdminClient();
    const callerId = gate.user.id;

    // P0: maybeSingle() so a missing profile returns null instead of throwing.
    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role, is_super_agent, is_sub_agent, full_name, username, default_sub_commission_pct, default_agent_markup_pct, default_agent_pricing_mode')
      .eq('id', callerId)
      .maybeSingle();

    if (!callerProfile) {
      return NextResponse.json({ error: 'Caller Profile Not Found.' }, { status: 404 });
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
    // When the caller does not specify a rate, fall back to the parent's
    // onboarding default commission (default_sub_commission_pct) so new
    // sub-agents inherit the rate the parent configured during setup.
    let commissionPct: number;
    if (commissionPctRaw === undefined || commissionPctRaw === null || commissionPctRaw === '') {
      commissionPct = Number((callerProfile as { default_sub_commission_pct?: number | null }).default_sub_commission_pct ?? 0);
    } else {
      commissionPct = Number(commissionPctRaw);
    }
    if (!Number.isFinite(commissionPct) || commissionPct < 0 || commissionPct > 40) {
      return NextResponse.json(
        { error: 'commissionPct Must Be Between 0 And 40 Inclusive.' },
        { status: 400 },
      );
    }

    const isPromotingToFullAgent = callerProfile.is_super_agent === true;
    if (!isPromotingToFullAgent) {
      const safeguard = await verifyCommissionSafeguard(admin, callerId, commissionPct);
      if (!safeguard.safe) {
        return NextResponse.json({ error: safeguard.error }, { status: 400 });
      }
      if (safeguard.warning) {
        // Fire notification asynchronously, don't await it
        import('@/lib/notify').then(({ notifyMarginWarning }) => {
          notifyMarginWarning(admin, callerId).catch(err => {
            console.error('[promote-subagent] Failed to fire margin warning:', err);
          });
        });
      }
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

    // P0: maybeSingle() so a missing researcher returns null instead of throwing.
    const { data: researcherProfile } = await admin
      .from('profiles')
      .select('role, referring_agent_id, full_name, username, email, is_sub_agent')
      .eq('id', researcherId)
      .maybeSingle();

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

    // Provisioning attribution: a super_agent and a regular agent both have
    // role='agent', so disambiguate via is_super_agent for the dashboard.
    const createdByRole = callerProfile.is_super_agent === true ? 'super_agent' : 'agent';

    // is_sub_agent flag is derived from isPromotingToFullAgent (declared above):
    // super-agent caller promotes to a full Agent (is_sub_agent: false);
    // a regular agent caller promotes to a Sub-Agent (is_sub_agent: true).
    const now = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      role: 'agent',
      is_sub_agent: !isPromotingToFullAgent,
      // P1: Explicitly clear is_super_agent so a promoted user cannot
      // inherit or retain super-agent privileges from a previous state.
      is_super_agent: false,
      // P1: Bind the promoted user to the calling agent's downline.
      parent_agent_id: callerId,
      created_by_agent_id: callerId,
      created_by_role: createdByRole,
      commission_pct: commissionPct,
      commission_active_since: now,
      account_type: paymentModel,
      // SACA 2026-05-31: clear any prior referring_sub_agent_id tag on the
      // researcher being promoted. A sub-agent cannot itself be tagged to
      // another sub-agent (no nested sub-agents), and an existing tag from
      // when they were a researcher would now be inconsistent.
      referring_sub_agent_id: null,
      // Promotion re-triggers the role-tailored onboarding wizard: the newly
      // promoted account must complete setup for its new role before reaching
      // any dashboard. Also clear the prior step acknowledgments so a once-
      // onboarded account does not skip role-specific steps with stale flags.
      // See app/dashboard/layout.tsx + /onboarding.
      onboarding_completed_at: null,
      onboarding_progress: {},
      updated_at: now,
    };
    // Super agent promoting to a FULL agent: seed the new agent's pricing from
    // the super's onboarding default (overridable per-agent later). 'gamified'
    // -> NULL custom_markup_override so the agent rides the platform volume
    // ladder. 'flat' -> fixed override fraction from default_agent_markup_pct.
    if (isPromotingToFullAgent) {
      const cp = callerProfile as { default_agent_markup_pct?: number | null; default_agent_pricing_mode?: string | null };
      if (cp.default_agent_pricing_mode === 'gamified') {
        updatePayload.custom_markup_override = null;
      } else if (cp.default_agent_markup_pct != null && Number.isFinite(Number(cp.default_agent_markup_pct))) {
        updatePayload.custom_markup_override = Math.round((Number(cp.default_agent_markup_pct) / 100) * 10000) / 10000;
      }
    }
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
        is_sub_agent: !isPromotingToFullAgent,
        is_super_agent: false,
        commission_pct: commissionPct,
        commission_active_since: now,
        parent_agent_id: callerId,
        account_type: paymentModel,
        credit_limit: paymentModel === 'credit' ? creditLimit : 0,
      },
    });

    // Resolve the parent's storefront slug so the response can carry the
    // share link the parent will give to the new sub-agent. If the parent
    // has no agent_profiles row (edge case - should not happen for a real
    // agent), share_link is null and the UI degrades gracefully.
    let parentSlug: string | null = null;
    try {
      const { data: parentAgent } = await admin
        .from('agent_profiles')
        .select('slug')
        .eq('id', callerId)
        .maybeSingle();
      if (parentAgent?.slug && typeof parentAgent.slug === 'string') {
        parentSlug = parentAgent.slug;
      }
    } catch {
      /* best-effort; share_link stays null */
    }
    const shareLink = parentSlug ? `/${parentSlug}?sa=${researcherId}` : null;

    // PLATFORM RULE (2026-06-01): Super-agents may only create RESEARCHER or
    // full AGENT accounts -- never sub-agents. The branch above already sets
    // is_sub_agent=false for super-agent callers, and a DB trigger blocks any
    // sub-agent under a super-agent as a hard backstop. A full agent must have
    // a real storefront + catalog, otherwise it is an invisible profile-only
    // shell (the original TJP/Anna defect). Provision it now.
    let newAgentSlug: string | null = null;
    if (isPromotingToFullAgent) {
      newAgentSlug = await provisionAgentStorefront(
        admin,
        researcherId,
        researcherProfile.username ?? null,
        researcherProfile.full_name ?? null,
      );
    }

    await Promise.all([
      notifyPromotedToAgent(admin, researcherId, '', callerProfile.full_name || 'Your Agent'),
      notifyPromotionSuccess(admin, callerId, researcherProfile.full_name || 'Researcher', ''),
    ]).catch(() => { /* best-effort */ });

    return NextResponse.json({
      success: true,
      sub_agent_id: researcherId,
      commission_pct: commissionPct,
      account_type: paymentModel,
      credit_limit: paymentModel === 'credit' ? creditLimit : 0,
      parent_slug: parentSlug,
      share_link: shareLink,
      created_by_role: createdByRole,
      new_agent_slug: newAgentSlug,
      message: `${researcherProfile.full_name || 'Researcher'} Has Been Promoted To ${isPromotingToFullAgent ? 'Agent' : 'Sub-Agent'} At ${commissionPct}% Commission.`,
    });

  } catch (error) {
    console.error('[promote-subagent] unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error.' }, { status: 500 });
  }
}
