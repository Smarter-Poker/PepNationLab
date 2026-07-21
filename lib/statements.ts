
import { createServiceClient } from '@/lib/supabase/server';
import { chicagoMidnightIso } from '@/lib/time-cst';
import { computeAgentCostsForAgent } from '@/lib/pricing';

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

/**
 * Max downline depth walked when collecting a subtree. Mirrors lib/pricing's
 * chain-depth cap so billing and pricing agree on how deep a chain can go.
 */
const MAX_DOWNLINE_DEPTH = 6;

export interface DescendantCollection {
  /** Every descendant agent id in the subtree (any depth). Root excluded. */
  all: string[];
  /** The subset of `all` that are DIRECT children of the root. */
  directChildren: Set<string>;
}

/**
 * Breadth-first walk of the downline tree under `rootId`, up to
 * `maxDepth` levels, with a seen-set cycle guard. Used by weekly billing so
 * a Super Agent's statement/invoice covers their ENTIRE subtree - nested
 * Super Agents included - not just direct children.
 */
export async function collectDescendantAgentIds(
  supabase: ServiceClient,
  rootId: string,
  maxDepth: number = MAX_DOWNLINE_DEPTH
): Promise<DescendantCollection> {
  const seen = new Set<string>([rootId]);
  const all: string[] = [];
  const directChildren = new Set<string>();
  let frontier: string[] = [rootId];

  for (let depth = 1; depth <= maxDepth && frontier.length > 0; depth++) {
    const { data: children } = await supabase
      .from('profiles')
      .select('id')
      .in('parent_agent_id', frontier);

    const next: string[] = [];
    for (const child of children ?? []) {
      const id = child.id as string;
      if (seen.has(id)) continue; // cycle guard
      seen.add(id);
      all.push(id);
      next.push(id);
      if (depth === 1) directChildren.add(id);
    }
    frontier = next;
  }

  return { all, directChildren };
}

export interface SubtreeBillingResult {
  cogs: number;
  shipping: number;
  orderIds: string[];
}

/**
 * What a parented (nested) Super Agent owes THEIR upline for their whole
 * subtree's orders in a billing week - the hop-by-hop half of the weekly
 * trickle-down. The billed Super's cost basis on every subtree order:
 *
 *   - Seller is a DIRECT child of the billed Super: the order item's
 *     unit_super_agent_cost IS this Super's chain cost (snapshotted at
 *     checkout as the seller's direct parent's cost).
 *   - Seller is deeper in the subtree: the mid-chain cost is not
 *     snapshotted per item, so recompute it live from the chain-aware
 *     pricing engine (per-10-vial-pack, divided by 10 to per-vial - the
 *     same convention checkout uses). Also used as the fallback for a
 *     direct-child row missing unit_super_agent_cost.
 *   - Last-resort fallbacks (pricing recompute unavailable): the stored
 *     unit_super_agent_cost, then unit_cost_price - both at or above the
 *     billed Super's own cost, so the platform chain is never under-billed.
 *
 * Orders are keyed on agent_approved_at (created_at fallback for legacy
 * rows) and exclude not-yet-billable statuses plus wholesale restock
 * self-buys (billed at checkout), matching the invoice cron. Shipping is
 * re-billed at every hop, matching the admin statement, which bills the
 * top-level Super for the whole subtree's shipping.
 */
export async function computeSuperDownlineSubtreeBilling(
  supabase: ServiceClient,
  superId: string,
  window: { rangeStart: string; rangeEndExclusive: string }
): Promise<SubtreeBillingResult> {
  const empty: SubtreeBillingResult = { cogs: 0, shipping: 0, orderIds: [] };

  const { all: descendantIds, directChildren } = await collectDescendantAgentIds(supabase, superId);
  if (descendantIds.length === 0) return empty;

  const { data: subOrders } = await supabase
    .from('orders')
    .select('id, agent_id, shipping_cost, order_items(product_id, quantity, unit_super_agent_cost, unit_cost_price)')
    .in('agent_id', descendantIds)
    .neq('status', 'cancelled')
    .neq('status', 'pending_customer_payment')
    .neq('status', 'agent_approval_pending')
    .neq('is_wholesale_restock', true)
    .or(
      `and(agent_approved_at.gte.${window.rangeStart},agent_approved_at.lt.${window.rangeEndExclusive}),` +
      `and(agent_approved_at.is.null,created_at.gte.${window.rangeStart},created_at.lt.${window.rangeEndExclusive})`
    );

  const orders = subOrders ?? [];
  if (orders.length === 0) return empty;

  type ItemRow = {
    product_id: string | null;
    quantity: number;
    unit_super_agent_cost: number | null;
    unit_cost_price: number | null;
  };

  // Collect the products whose cost must be recomputed at THIS Super's level:
  // every deeper-than-direct-child order line, plus direct-child lines whose
  // unit_super_agent_cost snapshot is missing.
  const recomputeProductIds = new Set<string>();
  for (const order of orders) {
    const isDirect = directChildren.has(order.agent_id as string);
    const items = (order.order_items as unknown) as ItemRow[];
    for (const item of items ?? []) {
      const usc = Number(item.unit_super_agent_cost);
      if (item.product_id && (!isDirect || !(Number.isFinite(usc) && usc > 0))) {
        recomputeProductIds.add(item.product_id);
      }
    }
  }

  let recomputedCosts = new Map<string, number>();
  if (recomputeProductIds.size > 0) {
    try {
      const { data: prods } = await supabase
        .from('products')
        .select('id, base_cost')
        .in('id', Array.from(recomputeProductIds))
        .not('base_cost', 'is', null);
      recomputedCosts = await computeAgentCostsForAgent(
        supabase,
        superId,
        'tier_3',
        (prods ?? []).map((p) => ({ id: String(p.id), base_cost: Number(p.base_cost) }))
      );
    } catch (err) {
      // Fall through to the stored-cost fallbacks below - they never
      // under-bill the chain.
      console.error('[statements] subtree cost recompute failed for super', superId, err);
    }
  }

  let cogs = 0;
  let shipping = 0;
  const orderIds: string[] = [];

  for (const order of orders) {
    orderIds.push(order.id as string);
    shipping += Number(order.shipping_cost) || 0;
    const isDirect = directChildren.has(order.agent_id as string);
    const items = (order.order_items as unknown) as ItemRow[];

    for (const item of items ?? []) {
      const qty = Number(item.quantity) || 0;
      if (qty <= 0) continue;

      const usc = Number(item.unit_super_agent_cost);
      const ucp = Number(item.unit_cost_price);
      let perVial: number | null = null;

      if (isDirect && Number.isFinite(usc) && usc > 0) {
        perVial = usc;
      } else if (item.product_id && recomputedCosts.has(item.product_id)) {
        // Pricing engine returns per-10-vial-pack; items are per-vial.
        perVial = (recomputedCosts.get(item.product_id) as number) / 10;
      }

      if (perVial == null) {
        perVial = Number.isFinite(usc) && usc > 0
          ? usc
          : Number.isFinite(ucp) && ucp > 0
            ? ucp
            : 0;
      }

      cogs += perVial * qty;
    }
  }

  return { cogs, shipping, orderIds };
}

export interface ComputeResult {
  weekEnd: string;
  totalCogs: number;
  totalShipping: number;
  totalOwed: number;
  orderIds: string[];
}

export async function computeStatement(
  supabase: ServiceClient,
  agentId: string,
  weekStart: string
): Promise<{ ok: true; data: ComputeResult } | { ok: false; error: string }> {
  const weekEnd = addDays(weekStart, 6);
  // Billing weeks live in America/Chicago. Mon 00:00 CT -> next Mon 00:00 CT
  // - matches the spec ("Week ends Sunday 23:59:59 CST") and handles DST.
  const rangeStart = chicagoMidnightIso(weekStart);
  const rangeEndExclusive = chicagoMidnightIso(addDays(weekStart, 7));

  const { data: agent, error: agentError } = await supabase
    .from('profiles')
    .select('tier, is_super_agent, parent_agent_id, account_type, is_manufacturer')
    .eq('id', agentId)
    .maybeSingle();

  if (agentError || !agent) {
    return { ok: false, error: 'Agent Profile Not Found.' };
  }

  if ((agent as { is_manufacturer?: boolean | null }).is_manufacturer === true) {
    return { ok: false, error: 'Manufacturer accounts settle through the manufacturer commission ledger, not COGS statements.' };
  }

  if (agent.account_type === 'prepaid') {
    return { ok: false, error: 'Cannot generate weekly statements for prepaid accounts. Their orders are billed at checkout.' };
  }

  if (agent.parent_agent_id) {
    return { ok: false, error: 'Sub-Agents do not generate Admin statements. Their Super Agent is billed.' };
  }

  let billableAgentIds = [agentId];

  if (agent.is_super_agent) {
    // The house bills the top-level Super for their ENTIRE subtree - every
    // level of nesting - not just direct children. A 3rd-level agent's
    // platform COGS reaches the house statement here, while the hop-by-hop
    // agent_invoices (see computeSuperDownlineSubtreeBilling) move the money
    // up the chain toward this top-level account.
    const { all: descendantIds } = await collectDescendantAgentIds(supabase, agentId);
    billableAgentIds = [agentId, ...descendantIds];
  }

  // Bill an order in the week it BECAME billable (agent approval), not the week
  // it was created. Previously the window was keyed on created_at while the
  // status filter dropped not-yet-approved orders: an order created in week N
  // but approved in week N+1 was excluded from week N (still pending at that
  // run) and never re-selected in week N+1 (its created_at is in week N), so it
  // escaped billing entirely - and the cron never revisits a week that already
  // has a statement row. Selecting by agent_approved_at (set once, atomically,
  // at approval time and never moved thereafter) routes each order to exactly
  // one week: the week it was approved, closing the leak with no double-bill.
  // Legacy / no-approval-path orders have a NULL agent_approved_at, so we fall
  // back to created_at for those to preserve their prior behavior.
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id, agent_id, shipping_cost, order_items(quantity, unit_cost_price, unit_super_agent_cost, unit_house_cost)')
    .in('agent_id', billableAgentIds)
    .neq('status', 'cancelled')
    .neq('status', 'pending_customer_payment')
    .neq('status', 'agent_approval_pending')
    .or(
      `and(agent_approved_at.gte.${rangeStart},agent_approved_at.lt.${rangeEndExclusive}),` +
      `and(agent_approved_at.is.null,created_at.gte.${rangeStart},created_at.lt.${rangeEndExclusive})`
    );

  if (ordersError) {
    return { ok: false, error: ordersError.message };
  }

  let totalCogs = 0;
  let totalShipping = 0;
  const orderIds: string[] = [];

  for (const order of orders ?? []) {
    orderIds.push(order.id as string);
    totalShipping += Number(order.shipping_cost) || 0;

    const items = (order.order_items as unknown) as Array<{
      quantity: number;
      unit_cost_price: number | null;
      unit_super_agent_cost: number | null;
      unit_house_cost: number | null;
    }>;

    for (const item of items ?? []) {
      const qty = Number(item.quantity) || 0;

      if (order.agent_id === agentId) {
        totalCogs += (Number(item.unit_cost_price) || 0) * qty;
      } else {
        // Downline order (any depth). The house bills the top-level agent at
        // the HOUSE cost basis: prefer unit_house_cost (top-of-chain ladder
        // cost, snapshotted at checkout since 2026-07-21). Historical rows
        // predate that column and are 2-level sales, where
        // unit_super_agent_cost is exactly the top-level agent's cost -
        // identical numbers to the old formula. Last resort is
        // unit_cost_price (the seller's own cost snapshot) instead of $0 so
        // we never under-bill historical orders.
        const houseCost = Number(item.unit_house_cost);
        const superCost = Number(item.unit_super_agent_cost);
        const agentCost = Number(item.unit_cost_price);
        const effective = Number.isFinite(houseCost) && houseCost > 0
          ? houseCost
          : Number.isFinite(superCost) && superCost > 0
            ? superCost
            : Number.isFinite(agentCost) && agentCost > 0
              ? agentCost
              : 0;
        totalCogs += effective * qty;
      }
    }
  }

  const round = (n: number) => Math.round(n * 100) / 100;
  totalCogs = round(totalCogs);
  totalShipping = round(totalShipping);

  return {
    ok: true,
    data: {
      weekEnd,
      totalCogs,
      totalShipping,
      totalOwed: round(totalCogs + totalShipping),
      orderIds,
    },
  };
}

export interface PersistOptions {
  force?: boolean;
}

export async function persistStatement(
  supabase: ServiceClient,
  agentId: string,
  weekStart: string,
  computed: ComputeResult,
  options: PersistOptions = {}
): Promise<
  | { ok: true; statementId: string; skipped?: false }
  | { ok: true; statementId: string; skipped: true; reason: 'paid' }
  | { ok: false; error: string }
> {
  // Refuse to overwrite a paid statement - even when force=true. A paid
  // statement is settled history; regenerating it would silently roll back
  // the agent's balance and corrupt the ledger.
  const { data: existing } = await supabase
    .from('weekly_statements')
    .select('id, status')
    .eq('agent_id', agentId)
    .eq('week_start', weekStart)
    .maybeSingle();

  if (existing?.status === 'paid') {
    return {
      ok: true,
      statementId: existing.id as string,
      skipped: true,
      reason: 'paid',
    };
  }

  // If we found a non-paid row, always let the upsert proceed so totals
  // are refreshed for the same week (regardless of force flag).

  // A $0 statement has nothing to collect -- close it immediately so it never
  // appears as "outstanding" in the admin panel, wallet, or any balance query.
  const isZeroBalance = computed.totalOwed <= 0;
  const upsertPayload: Record<string, unknown> = {
    agent_id: agentId,
    week_start: weekStart,
    week_end: computed.weekEnd,
    total_cogs: computed.totalCogs,
    total_shipping: computed.totalShipping,
    total_owed: computed.totalOwed,
    status: isZeroBalance ? 'paid' : 'pending_payment',
  };
  if (isZeroBalance) {
    upsertPayload.paid_at = new Date().toISOString();
    upsertPayload.payment_method = null;
    upsertPayload.payment_reference = 'Auto-closed: no balance due';
  }

  const { data: statement, error: upsertError } = await supabase
    .from('weekly_statements')
    //  Database schema mismatch from generated types
    .upsert(upsertPayload, { onConflict: 'agent_id,week_start' })
    .select('id')
    .maybeSingle();

  if (upsertError || !statement) {
    return { ok: false, error: upsertError?.message ?? 'Failed To Save Statement.' };
  }

  const { error: deleteError } = await supabase.from('statement_orders').delete().eq('statement_id', statement.id);
  if (deleteError) {
    console.error('[statements] failed to clear old statement_orders:', deleteError);
    return { ok: false, error: 'Failed To Clear Old Order Links.' };
  }

  if (computed.orderIds.length > 0) {
    const { error: insertError } = await supabase.from('statement_orders').insert(
      computed.orderIds.map((orderId) => ({
        statement_id: statement.id,
        order_id: orderId,
      }))
    );
    if (insertError) {
      console.error('[statements] failed to insert statement_orders:', insertError);
      return { ok: false, error: 'Failed To Link Orders To Statement.' };
    }
  }

  return { ok: true, statementId: statement.id };
}
