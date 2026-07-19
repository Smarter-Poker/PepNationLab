export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAgentOrAdmin } from '@/lib/admin-auth';

/**
 * GET /api/agent/activity?days=30&prev=1&cursor=<ISO>&limit=50
 *
 * Unified "Recent Activity" feed. Sources:
 *   1.  Orders (with items) — storefront + sub-agents
 *   2.  New researcher signups
 *   3.  Wallet / balance_transactions
 *   4.  Coupon redemptions
 *   5.  Inventory alerts (no date-filter)
 *   6.  Sub-agent additions + weekly settlement
 *   7.  Refunds
 *   8.  Payout records
 *   9.  Subscription state changes
 *   10. Redeemed agent invitations
 *   11. Payment proofs uploaded (needs-attention)
 *   12. Broadcasts sent
 *
 * Query params:
 *   days   – window in days (default 30, 'all' = no lower bound, max 3650)
 *   prev   – if "1", compute counts for the PREVIOUS equivalent window (for trend %)
 *   cursor – ISO timestamp; return only items older than this (pagination)
 *   limit  – items per page (default 50, max 200)
 */

type Category =
  | 'order' | 'payment' | 'researcher' | 'commission'
  | 'referral' | 'coupon' | 'inventory' | 'subagent' | 'wallet'
  | 'refund' | 'payout' | 'subscription' | 'invitation'
  | 'proof' | 'broadcast';

type Emphasis = 'positive' | 'negative' | 'warning' | 'neutral';

interface ActivityItem {
  id: string;
  category: Category;
  title: string;
  subtitle?: string;
  amount?: number;
  status?: string;
  timestamp: string;
  href?: string;
  emphasis: Emphasis;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const one = (v: any) => (Array.isArray(v) ? v[0] : v);

function parseWindowDays(url: string): number | null {
  try {
    const raw = (new URL(url).searchParams.get('days') || '30').toLowerCase();
    if (raw === 'all') return null;
    const n = parseInt(raw, 10);
    if (!isFinite(n) || n <= 0) return 30;
    return Math.min(n, 3650);
  } catch {
    return 30;
  }
}

const PER_SOURCE = 400;
const TOTAL_CAP  = 2000;

async function fetchItems(
  db: ReturnType<typeof createAdminClient>,
  agentId: string,
  agentIds: string[],
  cutoff: string | null,
): Promise<ActivityItem[]> {
  const items: ActivityItem[] = [];
  const add = (i: ActivityItem) => { if (i.timestamp) items.push(i); };

  // ── 1) Orders (with item names) ─────────────────────────────────────────
  try {
    let q = db
      .from('orders')
      .select(`
        id, status, total, discount_amount, discount_source, coupon_code,
        created_at, is_wholesale_restock,
        profiles!orders_buyer_id_fkey(full_name, email),
        order_items(product_name, quantity)
      `)
      .in('agent_id', agentIds)
      .order('created_at', { ascending: false })
      .limit(PER_SOURCE);
    if (cutoff) q = q.gte('created_at', cutoff);
    const { data } = await q;
    for (const o of data || []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const buyer = one((o as any).profiles) as { full_name?: string; email?: string } | null;
      const who = buyer?.full_name || buyer?.email || 'A researcher';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ois = ((o as any).order_items || []) as { product_name?: string; quantity?: number }[];
      const itemsStr = ois.slice(0, 3)
        .map(i => `${i.product_name || 'Item'}${(i.quantity || 1) > 1 ? ` ×${i.quantity}` : ''}`)
        .join(', ') + (ois.length > 3 ? ` +${ois.length - 3} more` : '');
      const st = String(o.status);
      let title = 'Order placed'; let category: Category = 'order'; let emphasis: Emphasis = 'neutral';
      if (st === 'pending_customer_payment')                               { title = 'Awaiting payment';       category = 'payment';  emphasis = 'warning';  }
      else if (st === 'agent_approval_pending' || st === 'admin_approval_pending') { title = 'Order needs approval'; emphasis = 'warning';  }
      else if (st === 'approved_ship' || st === 'approved_pickup' || st === 'in_fulfillment') { title = 'Order approved'; emphasis = 'positive'; }
      else if (st === 'shipped')   { title = 'Order shipped';    emphasis = 'positive'; }
      else if (st === 'delivered') { title = 'Order delivered';  emphasis = 'positive'; }
      else if (st === 'cancelled') { title = 'Order cancelled';  emphasis = 'negative'; }
      const disc = Number(o.discount_amount) || 0;
      const sub = [
        who,
        itemsStr || null,
        o.is_wholesale_restock ? 'wholesale restock' : null,
        disc > 0 ? `${o.discount_source || 'discount'} −$${disc.toFixed(2)}` : null,
      ].filter(Boolean).join(' · ');
      add({ id: `order:${o.id}`, category, title, subtitle: sub, amount: Number(o.total) || 0, status: st, timestamp: o.created_at as string, href: `/orders/${o.id}`, emphasis });
    }
  } catch { /* noop */ }

  // ── 2) New researchers ──────────────────────────────────────────────────
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
      add({ id: `res:${r.id}`, category: 'researcher', title: 'New researcher joined', subtitle: r.full_name || r.email || 'New researcher', timestamp: r.created_at as string, href: `/dashboard/agent?tab=Researchers&researcher=${r.id}`, emphasis: 'positive' });
  } catch { /* noop */ }

  // ── 3) Wallet / balance_transactions ────────────────────────────────────
  try {
    let q = db
      .from('balance_transactions')
      .select('id, type, amount, description, reference_type, reference_id, created_at')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(PER_SOURCE);
    if (cutoff) q = q.gte('created_at', cutoff);
    const { data } = await q;
    for (const t of data || []) {
      const ty = String(t.type); const rt = String(t.reference_type || '');
      let category: Category = 'wallet'; let title = t.description || 'Wallet update'; let emphasis: Emphasis = 'neutral';
      // Build a deep link when there's a reference_id
      let href = '/wallet';
      if (ty === 'commission')     { category = 'commission'; title = 'Commission earned';         emphasis = 'positive'; href = t.reference_id ? `/orders/${t.reference_id}` : '/wallet'; }
      else if (ty === 'payout') {
        emphasis = 'negative';
        if (rt === 'sub_agent_settlements') { category = 'commission'; title = 'Paid sub-agent commission'; }
        else if (rt === 'referral_reward')  { category = 'referral';   title = 'Funded referral bonus'; }
        else if (rt === 'signup_promo')     { category = 'referral';   title = 'Funded signup promo'; }
        else { category = 'wallet'; title = 'Payout'; }
      }
      else if (ty === 'credit' || ty === 'bonus') { category = 'wallet'; title = ty === 'bonus' ? 'Bonus credit received' : 'Wallet credit'; emphasis = 'positive'; }
      else if (ty === 'transfer_in')  { category = 'wallet'; title = 'Funds received'; emphasis = 'positive'; }
      else if (ty === 'transfer_out' || ty === 'transfer_out_credit') { category = 'wallet'; title = 'Funds sent'; emphasis = 'negative'; }
      else if (ty === 'order_charge')     { category = 'wallet'; title = 'Charged to credit line'; }
      else if (ty === 'statement_payment'){ category = 'wallet'; title = 'Statement payment'; }
      else if (ty === 'initial_deposit' || ty === 'deposit') { category = 'wallet'; title = 'Deposit'; emphasis = 'positive'; }
      add({ id: `tx:${t.id}`, category, title, subtitle: t.description || undefined, amount: Number(t.amount) || 0, timestamp: t.created_at as string, href, emphasis });
    }
  } catch { /* noop */ }

  // ── 4) Coupon redemptions ────────────────────────────────────────────────
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
      add({ id: `coupon:${c.id}`, category: 'coupon', title: 'Coupon redeemed', subtitle: String(c.code || ''), timestamp: c.redeemed_at as string, href: c.order_id ? `/orders/${c.order_id}` : `/dashboard/agent?tab=Coupons`, emphasis: 'neutral' });
  } catch { /* noop */ }

  // ── 5) Inventory alerts ──────────────────────────────────────────────────
  try {
    const { data } = await db
      .from('agent_inventory')
      .select('id, stock_count, low_stock_threshold, updated_at, products(name)')
      .in('agent_id', agentIds)
      .order('updated_at', { ascending: false })
      .limit(120);
    for (const iv of data || []) {
      const stock = Number(iv.stock_count) || 0;
      const thr   = iv.low_stock_threshold == null ? 5 : Number(iv.low_stock_threshold);
      if (stock <= thr) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = one((iv as any).products) as { name?: string } | null;
        add({ id: `inv:${iv.id}`, category: 'inventory', title: stock <= 0 ? 'Out of stock' : 'Low stock', subtitle: `${p?.name || 'Product'} · ${stock} left`, timestamp: iv.updated_at as string, href: '/dashboard/agent?tab=Inventory', emphasis: 'warning' });
      }
    }
  } catch { /* noop */ }

  // ── 6) Sub-agents ───────────────────────────────────────────────────────
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

  // ── 7) Refunds ───────────────────────────────────────────────────────────
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subtitle = [r.reason, (r as any).refund_type?.replace(/_/g, ' ')].filter(Boolean).join(' · ');
      add({ id: `refund:${r.id}`, category: 'refund', title: `Refund ${st}`, subtitle, amount: Number(r.amount) || 0, status: st, timestamp: r.created_at as string, href: r.order_id ? `/orders/${r.order_id}` : undefined, emphasis });
    }
  } catch { /* noop */ }

  // ── 8) Payout records ────────────────────────────────────────────────────
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sub = [(p as any).payment_method, p.reference_number, p.notes].filter(Boolean).join(' · ');
      add({ id: `payout:${p.id}`, category: 'payout', title: `Payout ${st}`, subtitle: sub || undefined, amount: Number(p.amount) || 0, status: st, timestamp: p.created_at as string, href: '/wallet', emphasis });
    }
  } catch { /* noop */ }

  // ── 9) Subscriptions ─────────────────────────────────────────────────────
  try {
    let q = db
      .from('subscriptions')
      .select('id, status, cadence_days, created_at, paused_at, cancelled_at, updated_at, researcher_id, profiles!subscriptions_researcher_id_fkey(full_name, email)')
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
      let title = 'Subscription activated'; let emphasis: Emphasis = 'positive'; let ts = s.created_at as string;
      if (st === 'cancelled') { title = 'Subscription cancelled'; emphasis = 'negative'; ts = (s.cancelled_at || s.updated_at) as string; }
      else if (st === 'paused') { title = 'Subscription paused'; emphasis = 'warning'; ts = (s.paused_at || s.updated_at) as string; }
      add({ id: `subscrip:${s.id}:${st}`, category: 'subscription', title, subtitle: `${who} · every ${s.cadence_days}d`, status: st, timestamp: ts, href: '/dashboard/agent?tab=Orders', emphasis });
    }
  } catch { /* noop */ }

  // ── 10) Redeemed invitations ─────────────────────────────────────────────
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

  // ── 11) Payment proofs uploaded (researcher submitted payment) ─────────
  try {
    // Get the order IDs for this agent's storefront
    const { data: agentOrderIds } = await db
      .from('orders')
      .select('id')
      .in('agent_id', agentIds);
    const orderIds = (agentOrderIds || []).map((o: { id: string }) => o.id);
    if (orderIds.length > 0) {
      let q = db
        .from('payment_proofs')
        .select('id, order_id, uploaded_at, uploader_id, profiles!payment_proofs_uploader_id_fkey(full_name, email)')
        .in('order_id', orderIds.slice(0, 500))
        .order('uploaded_at', { ascending: false })
        .limit(PER_SOURCE);
      if (cutoff) q = q.gte('uploaded_at', cutoff);
      const { data } = await q;
      for (const pp of data || []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const uploader = one((pp as any).profiles) as { full_name?: string; email?: string } | null;
        const who = uploader?.full_name || uploader?.email || 'A researcher';
        add({ id: `proof:${pp.id}`, category: 'proof', title: 'Payment proof submitted', subtitle: `${who} uploaded a payment receipt`, timestamp: pp.uploaded_at as string, href: pp.order_id ? `/orders/${pp.order_id}` : '/wallet', emphasis: 'warning' });
      }
    }
  } catch { /* noop */ }

  // ── 12) Broadcasts sent ──────────────────────────────────────────────────
  try {
    let q = db
      .from('agent_broadcasts')
      .select('id, title, body, recipient_count, sent_count, created_at')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(PER_SOURCE);
    if (cutoff) q = q.gte('created_at', cutoff);
    const { data } = await q;
    for (const b of data || []) {
      const reach = Number(b.sent_count || b.recipient_count || 0);
      add({ id: `bcast:${b.id}`, category: 'broadcast', title: 'Broadcast sent', subtitle: `${b.title}${reach > 0 ? ` · ${reach} researchers reached` : ''}`, timestamp: b.created_at as string, href: '/dashboard/agent/broadcasts', emphasis: 'neutral' });
    }
  } catch { /* noop */ }

  return items;
}

export async function GET(req: Request) {
  const gate = await requireAgentOrAdmin();
  if (!gate.ok) return gate.response;
  const agentId = gate.user.id;
  const db = createAdminClient();

  const url = new URL(req.url);
  const days = parseWindowDays(req.url);
  const isPrev = url.searchParams.get('prev') === '1';
  const cursor = url.searchParams.get('cursor') || null;
  const limit  = Math.min(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 200);

  // Compute time window
  let cutoff: string | null = null;
  let prevCutoff: string | null = null;
  if (days != null) {
    const windowMs = days * 86400000;
    if (isPrev) {
      // Previous window: [now - 2×window, now - window]
      cutoff     = new Date(Date.now() - 2 * windowMs).toISOString();
      prevCutoff = new Date(Date.now() - windowMs).toISOString(); // upper bound
    } else {
      cutoff = new Date(Date.now() - windowMs).toISOString();
    }
  }

  // Resolve sub-agent IDs
  const { data: subAgentProfiles } = await db
    .from('profiles')
    .select('id')
    .eq('parent_agent_id', agentId);
  const agentIds = [agentId, ...(subAgentProfiles || []).map((p: { id: string }) => p.id)];

  // Fetch all items
  const rawItems = await fetchItems(db, agentId, agentIds, cutoff);

  // Sort descending by timestamp
  let sorted = rawItems
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // If prev mode, apply upper bound too
  if (isPrev && prevCutoff) {
    sorted = sorted.filter(i => i.timestamp < prevCutoff!);
  }

  // Cursor-based pagination: return items older than cursor
  if (cursor) {
    sorted = sorted.filter(i => i.timestamp < cursor);
  }

  // Apply cap then paginate
  const allSorted = sorted.slice(0, TOTAL_CAP);
  const paginated = allSorted.slice(0, limit);
  const nextCursor = paginated.length === limit ? paginated[paginated.length - 1]?.timestamp ?? null : null;

  const counts: Record<string, number> = {};
  for (const i of allSorted) counts[i.category] = (counts[i.category] || 0) + 1;

  // Total revenue and payout for the window (for trend calculation)
  const totalIn  = allSorted.filter(i => i.emphasis === 'positive' && i.amount).reduce((s, i) => s + (i.amount || 0), 0);
  const totalOut = allSorted.filter(i => i.emphasis === 'negative' && i.amount).reduce((s, i) => s + (i.amount || 0), 0);
  const orderCount = allSorted.filter(i => i.category === 'order').length;
  const alertCount = allSorted.filter(i => i.emphasis === 'warning').length;

  return NextResponse.json({
    items: paginated,
    counts,
    total: allSorted.length,
    hasMore: nextCursor != null,
    nextCursor,
    window: days,
    truncated: allSorted.length >= TOTAL_CAP,
    generatedAt: new Date().toISOString(),
    summary: { totalIn, totalOut, orderCount, alertCount },
  });
}
