import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

/**
 * Per-agent management for a Super Agent's downline FULL agents.
 *
 *   GET   /api/agent/agents/[id]   -> full detail (profile + storefront + ledger + sales)
 *   PATCH /api/agent/agents/[id]   -> edit full_name, account_type, credit_limit,
 *                                     commission_pct, commission_max_pct, velocity_cap,
 *                                     is_active, storefront display_name
 *
 * Authorization: caller must be a super_agent (or admin) AND the target must be
 * their own downline agent (target.parent_agent_id === caller.id). Admins bypass
 * the ownership check. The "give credit" action lives in ./credit/route.ts.
 */

type CallerCheck =
  | { ok: true; callerId: string; isAdmin: boolean }
  | { ok: false; response: NextResponse };

async function gateManager(): Promise<CallerCheck> {
  // requireSession (not requireAgent): admins must be able to open any agent's
  // account detail from /admin/agents. requireAgent hard-rejects admins, which
  // made the isAdmin ownership bypass below unreachable ("Forbidden. Agent
  // Access Required." on Edit Details). Role gating happens right here instead.
  const gate = await requireSession();
  if (!gate.ok) return { ok: false, response: gate.response };
  const supabase = createAdminClient();
  const { data: caller } = await supabase
    .from('profiles')
    .select('role, is_super_agent')
    .eq('id', gate.user.id)
    .maybeSingle();
  const isAdmin = caller?.role === 'admin';
  const isSuperAgent = caller?.is_super_agent === true;
  const isAgent = caller?.role === 'agent' || caller?.role === 'super_agent';
  if (!caller || (!isSuperAgent && !isAgent && !isAdmin)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Forbidden. Only Agents And Super Agents Can Manage Accounts.' },
        { status: 403 },
      ),
    };
  }
  return { ok: true, callerId: gate.user.id, isAdmin };
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Platform rule: the gamification Max Cap can never exceed 40%.
const MAX_CAP_LIMIT = 40;

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const gate = await gateManager();
    if (!gate.ok) return gate.response;
    const { id } = await ctx.params;
    const supabase = createAdminClient();

    const { data: agent, error } = await supabase
      .from('profiles')
      .select(
        // R33: added is_super_agent so the edit drawer can gate Markup
        // Structure (super_agents store role='agent' with is_super_agent=true;
        // role alone can't distinguish them from regular agents, so the R32
        // gate `role === 'agent'` was incorrectly still showing markup UI
        // to super_agents in the Edit Agent drawer).
        'id, full_name, username, email, phone, role, account_type, credit_limit, max_auto_approve_limit, prepaid_balance, commission_pct, commission_max_pct, velocity_cap, commission_active_since, is_active, is_sub_agent, is_super_agent, parent_agent_id, created_at, last_sign_in_at, first_sign_in_at, sign_in_count, agent_profiles(slug, display_name, is_active)',
      )
      .eq('id', id)
      .maybeSingle();

    if (error || !agent) {
      return NextResponse.json({ error: 'Agent Account Not Found.' }, { status: 404 });
    }
    if (!gate.isAdmin && agent.parent_agent_id !== gate.callerId) {
      return NextResponse.json(
        { error: 'This Agent Is Not In Your Network.' },
        { status: 403 },
      );
    }

    const storefront = Array.isArray(agent.agent_profiles)
      ? agent.agent_profiles[0] ?? null
      : (agent.agent_profiles as any) ?? null;

    // Balance ledger (most recent first).
    const { data: ledgerRows } = await supabase
      .from('balance_transactions')
      .select('id, type, amount, balance_after, description, created_at')
      .eq('agent_id', id)
      .order('created_at', { ascending: false })
      .limit(30);

    // Sales summary via aggregate RPC - accurate across the agent's full order
    // history (the previous 500-row page-sum under-counted high-volume agents).
    const { data: summaryRows } = await supabase.rpc('agent_sales_summary', { p_agent_id: id });
    const summary = Array.isArray(summaryRows) ? summaryRows[0] : summaryRows;

    // Recent orders (latest 12) for the activity list.
    const { data: recentRows } = await supabase
      .from('orders')
      .select('id, status, total, created_at, buyer_name, payment_method')
      .eq('agent_id', id)
      .order('created_at', { ascending: false })
      .limit(12);

    // Sub-Agents of this agent
    const { data: subAgentsRows } = await supabase
      .from('profiles')
      .select('id, full_name, username, email, created_at, is_active, commission_pct')
      .eq('parent_agent_id', id)
      .eq('is_sub_agent', true)
      .order('created_at', { ascending: false });

    // Full downline AGENTS of this agent (role agent/super_agent,
    // is_sub_agent=false). These exist when the account is itself a Super
    // Agent (e.g. a mid-tier Super who reports to another Super). They were
    // never surfaced in this drawer, so a Super Agent's own agents appeared
    // to vanish when their account was opened from an upline's roster.
    const { data: downlineAgentsRows } = await supabase
      .from('profiles')
      .select('id, full_name, username, email, created_at, is_active, is_super_agent, commission_pct')
      .eq('parent_agent_id', id)
      .eq('is_sub_agent', false)
      .in('role', ['agent', 'super_agent'])
      .order('created_at', { ascending: false });

    // Researchers of this agent
    const { data: researchersRows } = await supabase
      .from('profiles')
      .select('id, full_name, username, email, created_at, is_active')
      .eq('referring_agent_id', id)
      .eq('role', 'researcher')
      .order('created_at', { ascending: false });

    // Custom Gamification Ladder
    const { data: planData } = await supabase
      .from('sub_agent_commission_plan')
      .select('steps')
      .eq('sub_agent_id', id)
      .maybeSingle();

    const commissionMaxPct = (agent as { commission_max_pct?: number | null }).commission_max_pct;
    const velocityCap = (agent as { velocity_cap?: number | null }).velocity_cap;

    return NextResponse.json({
      agent: {
        id: agent.id,
        full_name: agent.full_name,
        // R33: expose role + is_super_agent so the UI can gate role-specific
        // sections (Markup Structure shows for regular agents only).
        role: (agent as { role?: string | null }).role ?? null,
        is_super_agent: (agent as { is_super_agent?: boolean }).is_super_agent === true,
        username: agent.username,
        email: agent.email,
        phone: (agent as { phone?: string | null }).phone ?? null,
        account_type: agent.account_type,
        credit_limit: agent.credit_limit != null ? num(agent.credit_limit) : null,
        max_auto_approve_limit: agent.max_auto_approve_limit != null ? num(agent.max_auto_approve_limit) : null,
        prepaid_balance: num(agent.prepaid_balance),
        commission_pct: agent.commission_pct != null ? num(agent.commission_pct) : null,
        commission_max_pct: commissionMaxPct != null ? num(commissionMaxPct) : null,
        velocity_cap: velocityCap != null ? num(velocityCap) : null,
        commission_ladder_config: planData?.steps ?? [],
        commission_active_since: agent.commission_active_since,
        is_active: !!agent.is_active,
        is_sub_agent: (agent as { is_sub_agent?: boolean }).is_sub_agent === true,
        // Exposed so the detail drawer can tell a top-level account (house
        // tier ladder is its real pricing) from a parented downline account
        // (chain-aware commission_pct is its real pricing - see
        // lib/pricing.ts's resolveChainAwareV2Markup).
        parent_agent_id: (agent as { parent_agent_id?: string | null }).parent_agent_id ?? null,
        created_at: agent.created_at,
        last_sign_in_at: (agent as { last_sign_in_at?: string | null }).last_sign_in_at ?? null,
        first_sign_in_at: (agent as { first_sign_in_at?: string | null }).first_sign_in_at ?? null,
        sign_in_count: num((agent as { sign_in_count?: number | null }).sign_in_count),
      },
      storefront: storefront
        ? { slug: storefront.slug, display_name: storefront.display_name, is_active: !!storefront.is_active }
        : null,
      ledger: (ledgerRows ?? []).map((r) => ({
        id: r.id,
        type: r.type,
        amount: num(r.amount),
        balance_after: r.balance_after != null ? num(r.balance_after) : null,
        description: r.description,
        created_at: r.created_at,
      })),
      sales: {
        ordersCount: num(summary?.orders_count),
        nonCancelledCount: num(summary?.noncancelled_count),
        grossTotal: Math.round(num(summary?.gross_total) * 100) / 100,
        last30Total: Math.round(num(summary?.last30_total) * 100) / 100,
        recent: (recentRows ?? []).map((o) => ({
          id: o.id,
          status: o.status,
          total: num(o.total),
          created_at: o.created_at,
          buyer_name: o.buyer_name,
          payment_method: o.payment_method,
        })),
      },
      sub_agents: (subAgentsRows ?? []).map((sa) => ({
        id: sa.id,
        full_name: sa.full_name,
        username: sa.username,
        email: sa.email,
        is_active: sa.is_active,
        commission_pct: sa.commission_pct != null ? num(sa.commission_pct) : null,
        created_at: sa.created_at,
        // provisioned_password intentionally NOT returned: an agent must never
        // be able to read the live plaintext login of anyone in their downline.
      })),
      downline_agents: (downlineAgentsRows ?? []).map((a) => ({
        id: a.id,
        full_name: a.full_name,
        username: a.username,
        email: a.email,
        is_active: a.is_active,
        is_super_agent: (a as { is_super_agent?: boolean }).is_super_agent === true,
        commission_pct: a.commission_pct != null ? num(a.commission_pct) : null,
        created_at: a.created_at,
      })),
      researchers: (researchersRows ?? []).map((r) => ({
        id: r.id,
        full_name: r.full_name,
        username: r.username,
        email: r.email,
        is_active: r.is_active,
        created_at: r.created_at,
        // provisioned_password intentionally NOT returned (see above).
      })),
    });
  } catch (err) {
    console.error('[GET agent-detail] error:', err);
    return NextResponse.json({ error: 'Internal Server Error.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  try {
    const gate = await gateManager();
    if (!gate.ok) return gate.response;
    const { id } = await ctx.params;
    const supabase = createAdminClient();

    const { data: target } = await supabase
      .from('profiles')
      .select('id, parent_agent_id, account_type, credit_limit, is_active, full_name, commission_pct, commission_max_pct')
      .eq('id', id)
      .maybeSingle();

    if (!target) {
      return NextResponse.json({ error: 'Agent Account Not Found.' }, { status: 404 });
    }
    if (!gate.isAdmin && target.parent_agent_id !== gate.callerId) {
      return NextResponse.json({ error: 'This Agent Is Not In Your Network.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const updates: Record<string, any> = {};
    const changes: Record<string, any> = {};

    if (typeof body.full_name === 'string' && body.full_name.trim()) {
      updates.full_name = body.full_name.trim();
      changes.full_name = updates.full_name;
    }
    
    if (typeof body.email === 'string' && body.email.trim()) {
      const normalizedEmail = body.email.trim().toLowerCase();
      // Validate before any write so profiles.email cannot drift from the auth
      // login identity (a divergence silently breaks username login).
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return NextResponse.json({ error: 'Please Enter A Valid Email Address' }, { status: 400 });
      }
      updates.email = normalizedEmail;
      changes.email = updates.email;
    }

    if (body.phone !== undefined) {
      updates.phone = typeof body.phone === 'string' ? body.phone.trim() : null;
      changes.phone = updates.phone;
    }

    let nextAccountType = target.account_type as string | null;
    if (body.account_type === 'credit' || body.account_type === 'prepaid') {
      nextAccountType = body.account_type;
      updates.account_type = body.account_type;
      changes.account_type = body.account_type;
    }

    if (body.credit_limit !== undefined && body.credit_limit !== null && body.credit_limit !== '') {
      const cl = Number(body.credit_limit);
      if (!Number.isFinite(cl) || cl < 0) {
        return NextResponse.json({ error: 'Credit Limit Must Be Zero Or Greater.' }, { status: 400 });
      }
      updates.credit_limit = cl;
      changes.credit_limit = cl;
    }
    // Keep credit_limit coherent with the (possibly new) account type.
    if (nextAccountType === 'prepaid') {
      updates.credit_limit = null;
      updates.max_auto_approve_limit = null;
    }

    if (body.max_auto_approve_limit !== undefined) {
      if (body.max_auto_approve_limit === null || body.max_auto_approve_limit === '') {
        updates.max_auto_approve_limit = null;
        changes.max_auto_approve_limit = null;
      } else {
        const ml = Number(body.max_auto_approve_limit);
        if (!Number.isFinite(ml) || ml < 0) {
          return NextResponse.json({ error: 'Max Auto-Approve Limit Must Be Zero Or Greater.' }, { status: 400 });
        }
        updates.max_auto_approve_limit = ml;
        changes.max_auto_approve_limit = ml;
      }
    }

    if (body.commission_pct !== undefined && body.commission_pct !== null && body.commission_pct !== '') {
      const pct = Number(body.commission_pct);
      // DB CHECK profiles_commission_pct_range caps commission_pct at 40 (the
      // platform's hard 40% rule). Validate here so an out-of-range value gives a
      // clean 400 instead of a constraint-violation 500 on the profile update.
      if (!Number.isFinite(pct) || pct < 0 || pct > MAX_CAP_LIMIT) {
        return NextResponse.json({ error: 'Commission Rate Cannot Exceed 40%.' }, { status: 400 });
      }

      updates.commission_pct = pct;
      updates.commission_rate = pct;
      changes.commission_pct = pct;
    }

    // Commission structure: gamification cap + velocity.
    //   - Fixed Percentage: the client sends commission_max_pct === commission_pct
    //     (cap == base), which forces the effective rate flat in
    //     fn_sub_agent_effective_commission (LEAST(base + bonus, cap)).
    //   - Gamification Scale: cap above the base lets the milestone ladder lift
    //     the rate with volume up to the cap; null cap = uncapped ladder.
    // Platform rule: the cap can never exceed 40%.
    const baseForCap = updates.commission_pct != null
      ? Number(updates.commission_pct)
      : Number(target.commission_pct ?? 0);
    if (body.commission_max_pct === null) {
      updates.commission_max_pct = null;
      changes.commission_max_pct = null;
    } else if (body.commission_max_pct !== undefined && body.commission_max_pct !== '') {
      const cap = Number(body.commission_max_pct);
      if (!Number.isFinite(cap) || cap < 0 || cap > MAX_CAP_LIMIT) {
        return NextResponse.json({ error: 'Max Commission Cap Cannot Exceed 40%.' }, { status: 400 });
      }
      if (cap < baseForCap) {
        return NextResponse.json({ error: 'Max Commission Cap Cannot Be Below The Base Rate.' }, { status: 400 });
      }
      updates.commission_max_pct = cap;
      changes.commission_max_pct = cap;
    }

    // Safeguard: Ensure the newly set commission (base or cap, whichever is higher) doesn't violate the 10% hard floor.
    if (updates.commission_pct !== undefined || updates.commission_max_pct !== undefined) {
      const { verifyCommissionSafeguard } = await import('@/lib/pricing');
      
      // If we are updating commission_max_pct, we check that. If not, we check commission_pct. 
      // If we are updating both, we check the max of both.
      // If we are updating neither, this block won't run.
      // Wait, we need to check the highest of the NEW or EXISTING values if only one is updated.
      // But verifyCommissionSafeguard checks the agent's highest sub-agent commission if desiredCommissionPct is omitted.
      // Wait, here we are editing ONE sub-agent. If we pass desiredCommissionPct, verifyCommissionSafeguard just checks if the agent can afford THAT pct.
      // Yes, because this is an edit to a specific sub-agent.
      const pctToCheck = Math.max(
        updates.commission_max_pct !== undefined ? Number(updates.commission_max_pct || 0) : Number(target.commission_max_pct || 0),
        updates.commission_pct !== undefined ? Number(updates.commission_pct || 0) : Number(target.commission_pct || 0)
      );

      const safeguard = await verifyCommissionSafeguard(supabase, gate.callerId, pctToCheck);
      if (!safeguard.safe) {
        return NextResponse.json({ error: safeguard.error }, { status: 400 });
      }
      if (safeguard.warning) {
        import('@/lib/notify').then(({ notifyMarginWarning }) => {
          notifyMarginWarning(supabase, gate.callerId).catch(err => {
            console.error('[PATCH agent-detail] Failed to fire margin warning:', err);
          });
        });
      }
    }

    if (body.velocity_cap === null) {
      updates.velocity_cap = null;
      changes.velocity_cap = null;
    } else if (body.velocity_cap !== undefined && body.velocity_cap !== '') {
      const vc = Number(body.velocity_cap);
      if (!Number.isFinite(vc) || vc < 0) {
        return NextResponse.json({ error: 'Velocity Cap Must Be Zero Or Greater.' }, { status: 400 });
      }
      updates.velocity_cap = vc;
      changes.velocity_cap = vc;
    }

    if (Array.isArray(body.custom_commission_scale)) {
      // Each ladder step bonus must stay within the platform's 0..40 range.
      for (const step of body.custom_commission_scale) {
        const bonus = Number(step?.bonus_pct);
        const vol = Number(step?.min_volume);
        if (!Number.isFinite(bonus) || bonus < 0 || bonus > MAX_CAP_LIMIT || !Number.isFinite(vol) || vol < 0) {
          return NextResponse.json({ error: 'Gamification Levels Must Be Between 0 And 40% With Non-Negative Volumes.' }, { status: 400 });
        }
      }
      updates.commission_ladder_config = body.custom_commission_scale;
      changes.commission_ladder_config = body.custom_commission_scale;
    } else if (body.custom_commission_scale === null) {
      updates.commission_ladder_config = null;
      changes.commission_ladder_config = null;
    }

    if (typeof body.is_active === 'boolean') {
      updates.is_active = body.is_active;
      changes.is_active = body.is_active;
    }

    // Validate + de-duplicate the storefront slug up front so we fail fast
    // (before any write) on a collision instead of silently swallowing it.
    let slugToSet: string | null = null;
    if (typeof body.slug === 'string' && body.slug.trim()) {
      const parsedSlug = body.slug.trim().toLowerCase().replace(/[^a-z0-9\-]/g, '');
      if (parsedSlug) {
        const { data: clash } = await supabase
          .from('agent_profiles')
          .select('id')
          .eq('slug', parsedSlug)
          .neq('id', id)
          .maybeSingle();
        if (clash) {
          return NextResponse.json({ error: 'That Storefront Slug Is Already Taken.' }, { status: 409 });
        }
        slugToSet = parsedSlug;
      }
    }

    if (Object.keys(updates).length === 0 && body.display_name === undefined && slugToSet === null) {
      return NextResponse.json({ error: 'No Changes Provided.' }, { status: 400 });
    }

    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();

      // Keep the auth login identity in lockstep with profiles.email. Update
      // AUTH FIRST and abort before the profile write on failure, so the two
      // can never diverge (a drift silently breaks username login - resolve
      // would return an email no auth user owns). See app/api/auth/resolve.
      if (updates.email) {
        const { error: authErr } = await supabase.auth.admin.updateUserById(id, { email: updates.email });
        if (authErr) {
          console.error('[PATCH agent] auth update error:', authErr);
          return NextResponse.json({ error: 'Could Not Update Login Email. Please Check The Address And Try Again.' }, { status: 400 });
        }
      }

      const { error: upErr } = await supabase.from('profiles').update(updates).eq('id', id);
      if (upErr) {
        console.error('[PATCH agent] profile update error:', upErr);
        return NextResponse.json({ error: 'Failed To Update Agent.' }, { status: 500 });
      }

      if (Array.isArray(body.custom_commission_scale)) {
        await supabase.from('sub_agent_commission_plan').upsert({
          sub_agent_id: id,
          parent_agent_id: target.parent_agent_id || gate.callerId,
          steps: body.custom_commission_scale,
          updated_at: new Date().toISOString(),
        });
      } else if (body.custom_commission_scale === null) {
        await supabase.from('sub_agent_commission_plan').delete().eq('sub_agent_id', id);
      }
    }

    // Mirror active state + optional display_name and slug to the storefront row.
    const storefrontUpdate: Record<string, any> = {};
    if (typeof body.is_active === 'boolean') storefrontUpdate.is_active = body.is_active;
    if (typeof body.display_name === 'string' && body.display_name.trim()) {
      storefrontUpdate.display_name = body.display_name.trim();
      changes.display_name = storefrontUpdate.display_name;
    }
    if (slugToSet) {
      storefrontUpdate.slug = slugToSet;
      changes.slug = slugToSet;
    }
    if (Object.keys(storefrontUpdate).length > 0) {
      const { error: sfErr } = await supabase.from('agent_profiles').update(storefrontUpdate).eq('id', id);
      if (sfErr) {
        console.error('[PATCH agent] storefront update error:', sfErr);
        return NextResponse.json({ error: 'Failed To Update Storefront.' }, { status: 500 });
      }
    }

    // Audit (best-effort).
    try {
      await supabase.from('admin_audit_log').insert({
        actor_id: gate.callerId,
        action: 'agent_updated',
        entity_type: 'profile',
        entity_id: id,
        changes,
      });
    } catch {
      /* audit failures never block the edit */
    }

    return NextResponse.json({ success: true, changes });
  } catch (err) {
    console.error('[PATCH agent-detail] error:', err);
    return NextResponse.json({ error: 'Internal Server Error.' }, { status: 500 });
  }
}
