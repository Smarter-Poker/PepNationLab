import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

/**
 * Per-agent management for a Super Agent's downline FULL agents.
 *
 *   GET   /api/agent/agents/[id]   -> full detail (profile + storefront + ledger + sales)
 *   PATCH /api/agent/agents/[id]   -> edit full_name, account_type, credit_limit,
 *                                     commission_pct, is_active, storefront display_name
 *
 * Authorization: caller must be a super_agent (or admin) AND the target must be
 * their own downline agent (target.parent_agent_id === caller.id). Admins bypass
 * the ownership check. The "give credit" action lives in ./credit/route.ts.
 */

type CallerCheck =
  | { ok: true; callerId: string; isAdmin: boolean }
  | { ok: false; response: NextResponse };

async function gateSuperAgent(): Promise<CallerCheck> {
  const gate = await requireAgent();
  if (!gate.ok) return { ok: false, response: gate.response };
  const supabase = await createServiceClient();
  const { data: caller } = await supabase
    .from('profiles')
    .select('role, is_super_agent')
    .eq('id', gate.user.id)
    .single();
  const isAdmin = caller?.role === 'admin';
  if (!caller || (!caller.is_super_agent && !isAdmin)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Forbidden. Only Super Agents Can Manage Agent Accounts.' },
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

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const gate = await gateSuperAgent();
    if (!gate.ok) return gate.response;
    const { id } = await ctx.params;
    const supabase = await createServiceClient();

    const { data: agent, error } = await supabase
      .from('profiles')
      .select(
        'id, full_name, username, email, role, account_type, credit_limit, prepaid_balance, commission_pct, commission_active_since, is_active, is_sub_agent, parent_agent_id, created_at, agent_profiles(slug, display_name, is_active)',
      )
      .eq('id', id)
      .single();

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

    // Sales history: this agent's storefront orders.
    const { data: orderRows } = await supabase
      .from('orders')
      .select('id, status, total, created_at, buyer_name, buyer_email, payment_method')
      .eq('agent_id', id)
      .order('created_at', { ascending: false })
      .limit(500);

    const orders = orderRows ?? [];
    const nonCancelled = orders.filter((o) => o.status !== 'cancelled');
    const grossTotal = nonCancelled.reduce((acc, o) => acc + num(o.total), 0);
    const since30 = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const last30Total = nonCancelled
      .filter((o) => new Date(o.created_at as string).getTime() >= since30)
      .reduce((acc, o) => acc + num(o.total), 0);

    return NextResponse.json({
      agent: {
        id: agent.id,
        full_name: agent.full_name,
        username: agent.username,
        email: agent.email,
        account_type: agent.account_type,
        credit_limit: agent.credit_limit != null ? num(agent.credit_limit) : null,
        prepaid_balance: num(agent.prepaid_balance),
        commission_pct: agent.commission_pct != null ? num(agent.commission_pct) : null,
        commission_active_since: agent.commission_active_since,
        is_active: !!agent.is_active,
        created_at: agent.created_at,
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
        ordersCount: orders.length,
        nonCancelledCount: nonCancelled.length,
        grossTotal: Math.round(grossTotal * 100) / 100,
        last30Total: Math.round(last30Total * 100) / 100,
        recent: orders.slice(0, 12).map((o) => ({
          id: o.id,
          status: o.status,
          total: num(o.total),
          created_at: o.created_at,
          buyer_name: o.buyer_name,
          payment_method: o.payment_method,
        })),
      },
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
    const gate = await gateSuperAgent();
    if (!gate.ok) return gate.response;
    const { id } = await ctx.params;
    const supabase = await createServiceClient();

    const { data: target } = await supabase
      .from('profiles')
      .select('id, parent_agent_id, account_type, credit_limit, is_active, full_name, commission_pct')
      .eq('id', id)
      .single();

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
    }

    if (body.commission_pct !== undefined && body.commission_pct !== null && body.commission_pct !== '') {
      const pct = Number(body.commission_pct);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
        return NextResponse.json({ error: 'Commission Rate Must Be Between 0 And 100.' }, { status: 400 });
      }
      updates.commission_pct = pct;
      changes.commission_pct = pct;
    }

    if (typeof body.is_active === 'boolean') {
      updates.is_active = body.is_active;
      changes.is_active = body.is_active;
    }

    if (Object.keys(updates).length === 0 && body.display_name === undefined) {
      return NextResponse.json({ error: 'No Changes Provided.' }, { status: 400 });
    }

    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();
      const { error: upErr } = await supabase.from('profiles').update(updates).eq('id', id);
      if (upErr) {
        console.error('[PATCH agent] profile update error:', upErr);
        return NextResponse.json({ error: 'Failed To Update Agent.' }, { status: 500 });
      }
    }

    // Mirror active state + optional display_name to the storefront row.
    const storefrontUpdate: Record<string, any> = {};
    if (typeof body.is_active === 'boolean') storefrontUpdate.is_active = body.is_active;
    if (typeof body.display_name === 'string' && body.display_name.trim()) {
      storefrontUpdate.display_name = body.display_name.trim();
      changes.display_name = storefrontUpdate.display_name;
    }
    if (Object.keys(storefrontUpdate).length > 0) {
      await supabase.from('agent_profiles').update(storefrontUpdate).eq('id', id);
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
