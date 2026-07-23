import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { isAgentAncestorOf } from '@/lib/agent-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { notifyPromotedToAgent, notifyPromotionSuccess } from '@/lib/notify';
import { generateQrDataUrl } from '@/lib/qr';
import { verifyCommissionSafeguard } from '@/lib/pricing';
import { seedStorefrontFromHousePrices } from '@/lib/seed-storefront';

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
        // utm params make QR scans attributable as offline traffic.
        qr = await generateQrDataUrl(`${APP_URL}/${slug}?utm_source=qr&utm_medium=offline`);
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
      // Seed the promoted agent's catalog from the HOUSE (admin) store's retail
      // prices (default "set price"); falls back to rookie pricing per product.
      await seedStorefrontFromHousePrices(admin, agentId);
    }
  } catch (provErr) {
    console.error('[promote-subagent] storefront provisioning failed:', provErr);
  }
  return slug;
}

/**
 * POST /api/agent/promote-subagent
 *
 * Promotes a researcher in the caller's downline into an Agent or Super Agent.
 *
 * Body:
 *   {
 *     researcherId: UUID,
 *     markupPct: number (10..200 inclusive) — markup on base cost, NOT commission on gross sales,
 *     isSuperAgent: boolean — true = Super Agent, false = regular Agent,
 *     paymentModel: 'credit' | 'prepaid',
 *     creditLimit?: number (required when paymentModel='credit', >= 0)
 *   }
 *
 * Response on success also includes parent_slug + share_link so the UI can
 * render a copyable invite URL the parent gives the new agent.
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
    // Accept both new markupPct and legacy commissionPct for backwards compat
    const markupPctRaw: unknown = body?.markupPct ?? body?.commissionPct;
    const isSuperAgentRequest: boolean = body?.isSuperAgent === true;
    const paymentModel: unknown = body?.paymentModel;
    const creditLimitRaw: unknown = body?.creditLimit;

    if (typeof researcherId !== 'string' || researcherId.length === 0) {
      return NextResponse.json({ error: 'researcherId Is Required.' }, { status: 400 });
    }

    // markupPct: the margin the new agent earns above YOUR base cost (10-200%).
    // Falls back to caller's default_agent_markup_pct if not specified.
    let markupPct: number;
    if (markupPctRaw === undefined || markupPctRaw === null || markupPctRaw === '') {
      const cp = callerProfile as { default_agent_markup_pct?: number | null; default_sub_commission_pct?: number | null };
      markupPct = Number(cp.default_agent_markup_pct ?? cp.default_sub_commission_pct ?? 50);
    } else {
      markupPct = Number(markupPctRaw);
    }
    if (!Number.isFinite(markupPct) || markupPct < 10 || markupPct > 200) {
      return NextResponse.json(
        { error: 'markupPct Must Be Between 10 And 200 Inclusive.' },
        { status: 400 },
      );
    }

    // Only super-agents can promote to Super Agent; regular agents can only create Agents.
    const callerIsSuperAgent = callerProfile.is_super_agent === true || callerProfile.role === 'super_agent';
    // isPromotingToFullAgent: true for both Agent and Super Agent (both get storefronts)
    const isPromotingToFullAgent = true;
    // Determine if the new account should have super_agent privileges
    const newIsSuperAgent = isSuperAgentRequest && callerIsSuperAgent;

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
    // Ownership check: direct match OR super-agent ancestry (single-hop).
    // A super-agent's sub-agent's researcher has referring_agent_id pointing
    // to the sub-agent, not the super-agent, so we must check ancestry.
    if (researcherProfile.referring_agent_id !== callerId) {
      const isAncestor = researcherProfile.referring_agent_id
        ? await isAgentAncestorOf(admin as any, callerId, researcherProfile.referring_agent_id)
        : false;
      if (!isAncestor) {
        return NextResponse.json(
          { error: 'Researcher Does Not Belong To Your Downline.' },
          { status: 403 },
        );
      }
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
      is_sub_agent: false,  // All promotions from this form are full agents
      is_super_agent: newIsSuperAgent,
      parent_agent_id: callerId,
      created_by_agent_id: callerId,
      created_by_role: createdByRole,
      // markupPct stored as a decimal fraction in custom_markup_override
      // e.g. 50% markup = 0.50 override on top of base cost
      custom_markup_override: Math.round((markupPct / 100) * 10000) / 10000,
      // commission_pct kept for backwards compat with existing queries
      commission_pct: 0,
      commission_active_since: now,
      account_type: paymentModel,
      referring_sub_agent_id: null,
      // Re-trigger onboarding wizard for the new role
      onboarding_completed_at: null,
      onboarding_progress: {},
      updated_at: now,
    };
    if (paymentModel === 'credit') {
      updatePayload.credit_limit = creditLimit;
      updatePayload.auto_approve_orders = true;
      updatePayload.max_auto_approve_limit = creditLimit;
    } else {
      updatePayload.credit_limit = null;
      updatePayload.auto_approve_orders = false;
      updatePayload.max_auto_approve_limit = null;
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

    // CRITICAL: Sync the role to auth.users app_metadata so the JWT reflects the new agent role.
    const { data: userData } = await admin.auth.admin.getUserById(researcherId);
    if (userData?.user) {
      const newMeta = { ...userData.user.app_metadata, role: 'agent' };
      await admin.auth.admin.updateUserById(researcherId, { app_metadata: newMeta });
    }

    await admin.from('admin_audit_log').insert({
      actor_id: callerId,
      action: 'sub_agent_promote',
      entity_type: 'profiles',
      entity_id: researcherId,
      changes: {
        previous_role: researcherProfile.role,
        new_role: 'agent',
        is_sub_agent: false,
        is_super_agent: newIsSuperAgent,
        markup_pct: markupPct,
        custom_markup_override: Math.round((markupPct / 100) * 10000) / 10000,
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
      markup_pct: markupPct,
      account_type: paymentModel,
      credit_limit: paymentModel === 'credit' ? creditLimit : 0,
      parent_slug: parentSlug,
      share_link: shareLink,
      created_by_role: createdByRole,
      new_agent_slug: newAgentSlug,
      message: `${researcherProfile.full_name || 'Researcher'} Has Been Promoted To ${newIsSuperAgent ? 'Super Agent' : 'Agent'} At ${markupPct}% Markup On Base Cost.`,
    });

  } catch (error) {
    console.error('[promote-subagent] unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error.' }, { status: 500 });
  }
}
