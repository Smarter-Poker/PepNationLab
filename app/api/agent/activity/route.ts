export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAgentOrAdmin } from '@/lib/admin-auth';

/**
 * GET /api/agent/activity?days=90
 *
 * Unified "Recent Activity" feed for an agent / super-agent. Merges recent events
 * across every part of their business into one typed, chronological stream:
 *   - orders (placed / awaiting payment / needs approval / approved / shipped / delivered / cancelled)
 *   - new researcher signups on their storefront
 *   - wallet + payout ledger (commissions earned, commissions/promos/referrals they funded, transfers)
 *   - coupon redemptions on their codes
 *   - low / out-of-stock inventory alerts (current state — never date-filtered)
 *   - sub-agent additions + weekly commission settlements
 *   - refunds issued on the agent's orders
 *   - payout records (agent payouts)
 *   - subscriptions (new, paused, cancelled)
 *   - redeemed agent invitations
 *
 * `days` bounds the event window (default 90; `all` for no window) so the feed
 * never silently hides older activity — the caller can widen the window or export.
 * All queries are scoped to the caller's own id. Read-only.
 */

type Category =
  | 'order' | 'payment' | 'researcher' | 'commission'
  | 'referral' | 'coupon' | 'inventory' | 'subagent' | 'wallet'
  | 'refund' | 'payout' | 'subscription' | 'invitation';

type Emphasis = 'positive' | 'negative' | 'warning' | 'neutral';

interface ActivityItem {
  id: string;
  category: Category;
  title: string;
  subtitle?: string;
  amount?: number;      // dollar amount when relevant
  status?: string;
  timestamp: string;    // ISO
  href?: string;
  emphasis: Emphasis;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const one = (v: any) => (Array.isArray(v) ? v[0] : v);

// Parse the ?days= window. Default 90. `all` => null (no lower bound). Clamped.
function parseWindowDays(url: string): number | null {
  try {
    const raw = (new URL(url).searchParams.get('days') || '90').toLowerCase();
    if (raw === 'all') return null;
    const n = parseInt(raw, 10);
    if (!isFinite(n) || n <= 0) return 90;
    return Math.min(n, 3650);
  } catch {
    return 90;
  }
}

const PER_SOURCE = 400; // generous per-source cap within the window
const TOTAL_CAP = 1000; // merged feed cap (the window keeps this from truncating in practice)

export async function GET(req: Request) {
  const gate = await requireAgentOrAdmin();
  if (!gate.ok) return gate.response;
  const agentId = gate.user.id;
  const db = createAdminClient();

  const days = parseWindowDays(req.url);
  const cutoff = days == null ? null : new Date(Date.now() - days * 86400000).toISOString();

  const items: ActivityItem[] = [];
  const add = (i: ActivityItem) => { if (i.timestamp) items.push(i); };

  // Resolve the full set of agent IDs this user controls (own ID + sub-agent IDs).
  // This mirrors the dashboard page logic so the activity feed is consistent with the KPI tiles.
  const { data: subAgentProfiles } = await db
    .from('profiles')
    .select('id')
    .eq('parent_agent_id', agentId);
  const agentIds = [agentId, ...(subAgentProfiles || []).map((p: { id: string }) => p.id)];

  // 1) Orders on this agent's storefront (including sub-agents)
  try {
    let q = db
      .from('orders')
      .select('id, status, total, discount_amount, discount_source, coupon_code, created_at, is_wholesale_restock, profiles!orders_buyer_id_fkey(full_name, email)')
      .in('agent_id', agentIds)
      .order('created_at', { ascending: false })
      .limit(PER_SOURCE);
    if (cutoff) q = q.gte('created_at', cutoff);
    const { data } = await q;
    for (const o of data || []) {
      const buyer = one((o as { profiles?: unknown }).profiles) as { full_name?: string; email?: string } | null;
      const who = buyer?.full_name || buyer?.email || 'A researcher';
      const st = String(o.status);
      let title = 'Order placed'; let category: Category = 'order'; let emphasis: Emphasis = 'neutral';
      if (st === 'pending_customer_payment') { title = 'Awaiting payment'; category = 'payment'; emphasis = 'warning'; }
      else if (st === 'agent_approval_pending' || st === 'admin_approval_pending') { title = 'Order needs approval'; emphasis = 'warning'; }
      else if (st === 'approved_ship' || st === 'approved_pickup' || st === 'in_fulfillment') { title = 'Order approved'; emphasis = 'positive'; }
      else if (st === 'shipped') { title = 'Order shipped'; emphasis = 'positive'; }
      else if (st === 'delivered') { title = 'Order delivered'; emphasis = 'positive'; }
      else if (st === 'cancelled') { title = 'Order cancelled'; emphasis = 'negative'; }
      const disc = Number(o.discount_amount) || 0;
      const sub = who
        + (o.is_wholesale_restock ? ' · wholesale restock' : '')
        + (disc > 0 ? ` · ${o.discount_source || 'discount'} -$${disc.toFixed(2)}` : '');
      add({ id: `order:${o.id}`, category, title, subtitle: sub, amount: Number(o.total) || 0, status: st, timestamp: o.created_at as string, href: `/orders/${o.id}`, emphasis });
    }
  } catch { /* one source failing must not break the feed */ }

  // 2) New researchers referred to this agent
  try {
    let q = db
      .from('profiles')
      .select('id, full_name, email, created_at')
      .eq('referring_agent_id', agentId)
      .eq('role', 'researcher')
      .order('created_at', { ascending: false })
      .limit(PER_SOURCE);
    if (cutoff) q = q.gte('created_at', cutoff);
    const { data } = await q;
    for (const r of data || [])
      add({ id: `res:${r.id}`, category: 'researcher', title: 'New researcher joined', subtitle: r.full_name || r.email || 'New researcher', timestamp: r.created_at as string, href: '/dashboard/agent?tab=Researchers', emphasis: 'positive' });
  } catch { /* noop */ }

  // 3) Wallet / payout ledger
  try {
    let q = db
      .from('balance_transactions')
      .select('id, type, amount, description, reference_type, created_at')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(PER_SOURCE);
    if (cutoff) q = q.gte('created_at', cutoff);
    const { data } = await q;
    for (const t of data || []) {
      const ty = String(t.type); const rt = String(t.reference_type || '');
      let category: Category = 'wallet'; let title = t.description || 'Wallet update'; let emphasis: Emphasis = 'neutral';
      if (ty === 'commission') { category = 'commission'; title = 'Commission earned'; emphasis = 'positive'; }
      else if (ty === 'payout') {
        emphasis = 'negative';
        if (rt === 'sub_agent_settlements') { category = 'commission'; title = 'Paid sub-agent commission'; }
        else if (rt === 'referral_reward') { category = 'referral'; title = 'Funded referral bonus'; }
        else if (rt === 'signup_promo') { category = 'referral'; title = 'Funded signup promo'; }
        else if (rt === 'agent_credit') { category = 'wallet'; title = 'Funded agent credit'; }
        else { category = 'wallet'; title = 'Payout'; }
      }
      else if (ty === 'credit' || ty === 'bonus') { category = 'wallet'; title = ty === 'bonus' ? 'Bonus credit received' : 'Wallet credit'; emphasis = 'positive'; }
      else if (ty === 'transfer_in') { category = 'wallet'; title = 'Funds received'; emphasis = 'positive'; }
      else if (ty === 'transfer_out' || ty === 'transfer_out_credit') { category = 'wallet'; title = 'Funds sent'; emphasis = 'negative'; }
      else if (ty === 'order_charge') { category = 'wallet'; title = 'Charged to credit line'; emphasis = 'neutral'; }
      else if (ty === 'statement_payment') { category = 'wallet'; title = 'Statement payment'; emphasis = 'neutral'; }
      else if (ty === 'initial_deposit' || ty === 'deposit') { category = 'wallet'; title = 'Deposit'; emphasis = 'positive'; }
      add({ id: `tx:${t.id}`, category, title, subtitle: t.description || undefined, amount: Number(t.amount) || 0, timestamp: t.created_at as string, href: '/dashboard/agent?tab=Sales & Accounting', emphasis });
    }
  } catch { /* noop */ }

  // 4) Coupon redemptions on this agent's codes (including sub-agents)
  try {
    let q = db
      .from('coupon_redemptions')
      .select('id, code, redeemed_at, order_id, coupons!inner(agent_id)')
      .in('coupons.agent_id', agentIds)
      .order('redeemed_at', { ascending: false })
      .limit(PER_SOURCE);
    if (cutoff) q = q.gte('redeemed_at', cutoff);
    const { data } = await q;
    for (const c of data || [])
      add({ id: `coupon:${c.id}`, category: 'coupon', title: 'Coupon redeemed', subtitle: String(c.code || ''), timestamp: c.redeemed_at as string, href: c.order_id ? `/orders/${c.order_id}` : '/dashboard/agent?tab=Coupons', emphasis: 'neutral' });
  } catch { /* noop */ }

  // 5) Low / out-of-stock inventory (current state — intentionally NOT date-filtered, all controlled agents)
  try {
    const { data } = await db
      .from('agent_inventory')
      .select('id, stock_count, low_stock_threshold, updated_at, products(name)')
      .in('agent_id', agentIds)
      .order('updated_at', { ascending: false })
      .limit(120);
    for (const iv of data || []) {
      const stock = Number(iv.stock_count) || 0;
      const thr = iv.low_stock_threshold == null ? 5 : Number(iv.low_stock_threshold);
      if (stock <= thr) {
        const p = one((iv as { products?: unknown }).products) as { name?: string } | null;
        add({ id: `inv:${iv.id}`, category: 'inventory', title: stock <= 0 ? 'Out of stock' : 'Low stock', subtitle: `${p?.name || 'Product'} · ${stock} left`, timestamp: iv.updated_at as string, href: '/dashboard/agent?tab=Inventory', emphasis: 'warning' });
      }
    }
  } catch { /* noop */ }

  // 6) Sub-agents: additions + weekly commission settlements
  try {
    let q = db
      .from('sub_agent_settlements')
      .select('id, total_commission, orders_count, settled_at')
      .eq('parent_agent_id', agentId)
      .order('settled_at', { ascending: false })
      .limit(PER_SOURCE);
    if (cutoff) q = q.gte('settled_at', cutoff);
    const { data } = await q;
    for (const s of data || [])
      add({ id: `settle:${s.id}`, category: 'commission', title: 'Sub-agent commission settled', subtitle: `${Number(s.orders_count) || 0} orders`, amount: Number(s.total_commission) || 0, timestamp: s.settled_at as string, href: '/dashboard/agent?tab=My Sub-Agents', emphasis: 'negative' });
  } catch { /* noop */ }
  try {
    let q = db
      .from('profiles')
      .select('id, full_name, email, created_at')
      .eq('parent_agent_id', agentId)
      .eq('is_sub_agent', true)
      .order('created_at', { ascending: false })
      .limit(PER_SOURCE);
    if (cutoff) q = q.gte('created_at', cutoff);
    const { data } = await q;
    for (const su of data || [])
      add({ id: `sub:${su.id}`, category: 'subagent', title: 'New sub-agent added', subtitle: su.full_name || su.email || 'Sub-agent', timestamp: su.created_at as string, href: '/dashboard/agent?tab=My Sub-Agents', emphasis: 'positive' });
  } catch { /* noop */ }

  // 7) Refunds issued on this agent's orders
  try {
    let q = db
      .from('refunds')
      .select('id, amount, reason, status, refund_type, created_at, order_id, orders!inner(agent_id)')
      .in('orders.agent_id', agentIds)
      .order('created_at', { ascending: false })
      .limit(PER_SOURCE);
    if (cutoff) q = q.gte('created_at', cutoff);
    const { data } = await q;
    for (const r of data || []) {
      const st = String(r.status || '');
      const emphasis: Emphasis = st === 'completed' ? 'negative' : st === 'failed' ? 'neutral' : 'warning';
      const subtitle = [r.reason, r.refund_type?.replace(/_/g, ' ')].filter(Boolean).join(' · ');
      add({ id: `refund:${r.id}`, category: 'refund', title: `Refund ${st}`, subtitle, amount: Number(r.amount) || 0, status: st, timestamp: r.created_at as string, href: r.order_id ? `/orders/${r.order_id}` : undefined, emphasis });
    }
  } catch { /* noop */ }

  // 8) Payout records for this agent
  try {
    let q = db
      .from('payout_records')
      .select('id, amount, payment_method, status, reference_number, notes, created_at')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(PER_SOURCE);
    if (cutoff) q = q.gte('created_at', cutoff);
    const { data } = await q;
    for (const p of data || []) {
      const st = String(p.status || '');
      const emphasis: Emphasis = st === 'completed' ? 'positive' : st === 'failed' ? 'negative' : 'neutral';
      const sub = [p.payment_method, p.reference_number, p.notes].filter(Boolean).join(' · ');
      add({ id: `payout:${p.id}`, category: 'payout', title: `Payout ${st}`, subtitle: sub || undefined, amount: Number(p.amount) || 0, status: st, timestamp: p.created_at as string, href: '/dashboard/agent?tab=Sales & Accounting', emphasis });
    }
  } catch { /* noop */ }

  // 9) Subscription state changes (new, paused, cancelled)
  try {
    let q = db
      .from('subscriptions')
      .select('id, status, cadence_days, payment_method, created_at, paused_at, cancelled_at, updated_at, researcher_id, profiles!subscriptions_researcher_id_fkey(full_name, email)')
      .in('agent_id', agentIds)
      .order('updated_at', { ascending: false })
      .limit(PER_SOURCE);
    if (cutoff) q = q.gte('updated_at', cutoff);
    const { data } = await q;
    for (const s of data || []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const researcher = one((s as any).profiles) as { full_name?: string; email?: string } | null;
      const who = researcher?.full_name || researcher?.email || 'A researcher';
      const st = String(s.status || 'active');
      let title = 'Subscription activated';
      let emphasis: Emphasis = 'positive';
      let ts = s.created_at as string;
      if (st === 'cancelled') { title = 'Subscription cancelled'; emphasis = 'negative'; ts = (s.cancelled_at || s.updated_at) as string; }
      else if (st === 'paused')   { title = 'Subscription paused';    emphasis = 'warning';  ts = (s.paused_at   || s.updated_at) as string; }
      const sub = `${who} · every ${s.cadence_days}d`;
      add({ id: `sub:${s.id}:${st}`, category: 'subscription', title, subtitle: sub, status: st, timestamp: ts, href: '/dashboard/agent?tab=Orders', emphasis });
    }
  } catch { /* noop */ }

  // 10) Redeemed agent invitations (your invited agents accepted)
  try {
    let q = db
      .from('agent_invitations')
      .select('id, email, full_name, intended_role, redeemed_at')
      .eq('invited_by', agentId)
      .not('redeemed_at', 'is', null)
      .order('redeemed_at', { ascending: false })
      .limit(PER_SOURCE);
    if (cutoff) q = q.gte('redeemed_at', cutoff);
    const { data } = await q;
    for (const inv of data || [])
      add({ id: `inv:${inv.id}`, category: 'invitation', title: 'Invitation accepted', subtitle: `${inv.full_name || inv.email || 'Agent'} joined as ${(inv.intended_role || 'agent').replace(/_/g, ' ')}`, timestamp: inv.redeemed_at as string, href: '/dashboard/agent?tab=My Sub-Agents', emphasis: 'positive' });
  } catch { /* noop */ }

  const sorted = items
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, TOTAL_CAP);

  const counts: Record<string, number> = {};
  for (const i of sorted) counts[i.category] = (counts[i.category] || 0) + 1;

  return NextResponse.json({
    items: sorted,
    counts,
    total: sorted.length,
    window: days,            // number of days, or null for "all"
    truncated: sorted.length >= TOTAL_CAP,
    generatedAt: new Date().toISOString(),
  });
}
