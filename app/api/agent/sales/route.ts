import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAgentOrAdmin } from '@/lib/admin-auth';
import { pickOne } from '@/lib/relations';
import { computeAgentCostsForAgent } from '@/lib/pricing';

/** Mirrors lib/pricing's and lib/statements' chain-depth cap. */
const MAX_DOWNLINE_DEPTH = 6;

export async function GET(req: NextRequest) {
  try {
    const gate = await requireAgentOrAdmin();
    if (!gate.ok) return gate.response;

    const supabase = createAdminClient();
    const agentId = gate.user.id;

    // 1. Fetch all researchers under this agent
    const { data: researchers, error: researchersError } = await supabase
      .from('profiles')
      .select('id, full_name, email, cart_state, cart_updated_at')
      .eq('referring_agent_id', agentId)
      .eq('role', 'researcher')
      .limit(1000);

    if (researchersError) {
      return NextResponse.json({ error: 'An Unexpected Error Occurred.' }, { status: 500 });
    }

    // Filter to only researchers with active carts
    const liveCarts = researchers
      .filter(r => r.cart_state && Array.isArray(r.cart_state) && r.cart_state.length > 0)
      .map(r => ({
        id: r.id,
        name: r.full_name || r.email,
        email: r.email,
        cart: r.cart_state,
        updated_at: r.cart_updated_at
      }))
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    // 1.5. Fetch the ENTIRE downline subtree (every level of nesting, not just
    // direct children) so a Super Agent's Sales And Accounting view rolls up
    // grandchild sales too. Breadth-first walk with a depth cap and cycle
    // guard, recording each member's parent so per-sale profit can be
    // attributed at any depth (matching the recursive weekly billing).
    const downlineNames = new Map<string, string | null>();
    const parentOf = new Map<string, string>();
    {
      const seen = new Set<string>([agentId]);
      let frontier: string[] = [agentId];
      for (let depth = 1; depth <= MAX_DOWNLINE_DEPTH && frontier.length > 0; depth++) {
        const { data: children, error: childErr } = await supabase
          .from('profiles')
          .select('id, full_name, parent_agent_id')
          .in('parent_agent_id', frontier);
        if (childErr) {
          return NextResponse.json({ error: 'An Unexpected Error Occurred.' }, { status: 500 });
        }
        const next: string[] = [];
        for (const c of children ?? []) {
          const id = c.id as string;
          if (seen.has(id)) continue; // cycle guard
          seen.add(id);
          downlineNames.set(id, (c as { full_name?: string | null }).full_name ?? null);
          parentOf.set(id, (c as { parent_agent_id?: string | null }).parent_agent_id as string);
          next.push(id);
        }
        frontier = next;
      }
    }
    const agentIds = [agentId, ...Array.from(downlineNames.keys())];

    // Whether the VIEWER is top-of-chain decides whether unit_house_cost is
    // their own cost basis on deep downline sales (it is the TOP ancestor's
    // cost). A nested Super viewing their subtree needs a live recompute
    // instead.
    const { data: viewerProfile } = await supabase
      .from('profiles')
      .select('parent_agent_id')
      .eq('id', agentId)
      .maybeSingle();
    const viewerIsTop = !viewerProfile?.parent_agent_id;

    /**
     * For a downline seller, resolve how many hops below the viewer they sit
     * and which subtree member is the viewer's DIRECT child on that path.
     * Returns null if the path cannot be resolved (should not happen for ids
     * discovered by the walk above).
     */
    const resolvePath = (sellerId: string): { depth: number; childOnPath: string } | null => {
      let node = sellerId;
      for (let depth = 1; depth <= MAX_DOWNLINE_DEPTH; depth++) {
        const parent = parentOf.get(node);
        if (!parent) return null;
        if (parent === agentId) return { depth, childOnPath: node };
        node = parent;
      }
      return null;
    };

    // 2. Fetch all orders for this agent and its entire downline subtree.
    // Explicit column lists instead of '*, order_items(*)': this fetch is
    // capped at 2500 orders, and the wildcard pulled every order and line-item
    // column into the route. The order columns below are exactly the ones the
    // mapping further down reads; the order_items columns cover the route's
    // profit math (unit_retail_price, unit_cost_price, unit_super_agent_cost,
    // unit_house_cost, quantity) plus the raw items passthrough consumed by
    // components/AgentSales.tsx (product_name, quantity, unit_retail_price,
    // unit_cost_price).
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(
        'id, buyer_id, agent_id, status, fulfillment_method, payment_method, shipping_address, ' +
        'shipping_cost, subtotal, total, discount_amount, coupon_code, created_at, ' +
        'tracking_number, label_url, ' +
        'order_items(id, order_id, product_id, product_name, quantity, unit_retail_price, unit_cost_price, unit_super_agent_cost, unit_house_cost), ' +
        'profiles!orders_buyer_id_fkey(full_name, email)'
      )
      .in('agent_id', agentIds)
      // Exclude wholesale restock orders from the sales view.
      // Restocks were appearing as zero-profit 'sales' in the agent dashboard.
      .eq('is_wholesale_restock', false)
      // Exclude cancelled orders so voided sales don't distort profit/discount totals
      // (matches coupon-performance, redemptions, and sub-agent-rollup readers).
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(2500);

    if (ordersError) {
      return NextResponse.json({ error: 'An Unexpected Error Occurred.' }, { status: 500 });
    }

    type ItemRow = {
      product_id: string | null;
      quantity: number;
      unit_retail_price: number | null;
      unit_cost_price: number | null;
      unit_super_agent_cost: number | null;
      unit_house_cost: number | null;
    };

    // ------------------------------------------------------------------
    // Pass 1: collect the (agent, product) pairs whose chain cost must be
    // recomputed live because it is not snapshotted on the order item:
    //   - the viewer's direct child on the path, for sales 3+ hops down
    //     (items only snapshot the seller's cost, the seller's direct
    //     parent's cost, and the top-of-chain house cost)
    //   - the viewer's own cost on 2+ hop sales when the viewer is a
    //     NESTED super (unit_house_cost is the top's cost, not theirs)
    //   - fallbacks for missing snapshots
    // ------------------------------------------------------------------
    const recomputeNeeds = new Map<string, Set<string>>();
    const addNeed = (aid: string, pid: string | null) => {
      if (!pid) return;
      const set = recomputeNeeds.get(aid) ?? new Set<string>();
      set.add(pid);
      recomputeNeeds.set(aid, set);
    };

    for (const o of orders ?? []) {
      if (o.agent_id === agentId) continue;
      const path = resolvePath(o.agent_id as string);
      if (!path || path.depth <= 1) continue;
      const items = ((o as { order_items?: unknown }).order_items as unknown as ItemRow[]) ?? [];
      for (const item of items) {
        const usc = Number(item.unit_super_agent_cost);
        const uhc = Number(item.unit_house_cost);
        if (path.depth >= 3 || !(Number.isFinite(usc) && usc > 0)) {
          addNeed(path.childOnPath, item.product_id);
        }
        if (!viewerIsTop || !(Number.isFinite(uhc) && uhc > 0)) {
          addNeed(agentId, item.product_id);
        }
      }
    }

    // Batch-resolve the needed chain costs (per-10-vial-pack; /10 to per-vial,
    // checkout's convention). Best-effort: a failed recompute just leaves the
    // conservative stored-value fallbacks below in charge.
    const recomputedCost = new Map<string, number>(); // `${agentId}:${productId}` -> per-vial
    if (recomputeNeeds.size > 0) {
      const allPids = new Set<string>();
      for (const pids of recomputeNeeds.values()) for (const pid of pids) allPids.add(pid);
      const { data: prods } = await supabase
        .from('products')
        .select('id, base_cost')
        .in('id', Array.from(allPids))
        .not('base_cost', 'is', null);
      const prodList = (prods ?? []).map((p) => ({ id: String(p.id), base_cost: Number(p.base_cost) }));
      for (const [aid, pids] of recomputeNeeds) {
        try {
          const costs = await computeAgentCostsForAgent(
            supabase,
            aid,
            'tier_3',
            prodList.filter((p) => pids.has(p.id))
          );
          for (const [pid, packCost] of costs) {
            recomputedCost.set(`${aid}:${pid}`, packCost / 10);
          }
        } catch (err) {
          console.error('[agent-sales] chain-cost recompute failed for', aid, err);
        }
      }
    }

    // Calculate profit for each order.
    // - Own sales (agent_id === agentId): the agent's true margin is
    //     profit = retail (customer paid, net of coupon) - cost (what agent
    //              pays the platform) - shipping (also billed to the agent)
    //   Shipping is included because the platform bills the agent for it on
    //   the weekly statement, even though the customer paid retail shipping.
    // - Downline sales (agent_id anywhere in the subtree): this agent earns
    //   the spread between the chain cost of THEIR DIRECT CHILD on the
    //   seller's path (their revenue) and their OWN chain cost:
    //     depth 1: unit_cost_price (seller's cost) - unit_super_agent_cost
    //              (seller's parent IS the viewer) - the original formula.
    //     depth 2: unit_super_agent_cost (the mid super's cost, i.e. the
    //              viewer's direct child) - unit_house_cost (the viewer's own
    //              cost when they are top-of-chain).
    //     deeper / nested viewer / missing snapshots: live recompute from the
    //     chain-aware pricing engine.
    //   Shipping is a pass-through re-billed hop by hop, and discounts are
    //   borne by the seller's own margin, so neither factors in here.
    // Exclude ONLY the VIEWING agent's own self-buys (their own wholesale
    // restock -- zero margin, not a sale). A DOWNLINE agent's self-buy is KEPT:
    // it is a wholesale purchase billed up this agent's chain, so this agent's
    // fixed markup on it is real downline profit. Researcher sales
    // (buyer != agent) always count.
    const sales = (orders ?? [])
      .filter((o: any) => !(o.buyer_id === o.agent_id && o.agent_id === agentId))
      .map((o: any) => {
      const isDownlineOrder = o.agent_id !== agentId;

      let profit: number;

      if (isDownlineOrder) {
        const path = resolvePath(o.agent_id);
        let spread = 0;
        for (const item of (o.order_items || []) as ItemRow[]) {
          const qty = Number(item.quantity) || 0;
          if (qty <= 0) continue;
          const ucp = Number(item.unit_cost_price);
          const usc = Number(item.unit_super_agent_cost);
          const uhc = Number(item.unit_house_cost);
          const depth = path?.depth ?? 1;

          if (depth <= 1) {
            // Direct child sale - the original stored-spread formula.
            const cost = Number.isFinite(ucp) ? ucp : 0;
            const viewerCost = Number.isFinite(usc) && item.unit_super_agent_cost != null ? usc : cost;
            spread += (cost - viewerCost) * qty;
            continue;
          }

          // Deeper sale: revenue = chain cost of the viewer's direct child on
          // the path; cost = the viewer's own chain cost.
          const childKey = path ? `${path.childOnPath}:${item.product_id}` : '';
          const revenue = depth === 2 && Number.isFinite(usc) && usc > 0
            ? usc
            : recomputedCost.get(childKey);

          const viewerCost = viewerIsTop && Number.isFinite(uhc) && uhc > 0
            ? uhc
            : recomputedCost.get(`${agentId}:${item.product_id}`);

          if (revenue != null && viewerCost != null) {
            spread += (revenue - viewerCost) * qty;
          }
          // else: cost basis unresolvable (e.g. product missing base_cost) -
          // contribute $0 rather than a fabricated number.
        }
        profit = spread;
      } else {
        let totalRetail = 0;
        let totalCost = 0;

        for (const item of o.order_items || []) {
          totalRetail += Number(item.unit_retail_price) * Number(item.quantity);
          totalCost += Number(item.unit_cost_price) * Number(item.quantity);
        }

        const discount = Number(o.discount_amount) || 0;
        const shippingCost = Number(o.shipping_cost) || 0;
        totalRetail -= discount;

        profit = totalRetail - totalCost - shippingCost;
      }

      // o.profiles from Supabase FK join may be an array.
      // Direct .full_name access on an array returns undefined.
      // Use pickOne() to correctly unwrap the single-row relation.
      const buyer = pickOne<{ full_name?: string; email?: string }>((o as any).profiles);
      return {
        id: o.id,
        buyer_id: o.buyer_id,
        status: o.status,
        fulfillment_method: o.fulfillment_method,
        payment_method: o.payment_method,
        shipping_address: o.shipping_address,
        shipping_cost: Number(o.shipping_cost || 0),
        subtotal: Number(o.subtotal || 0),
        total: Number(o.total || 0),
        discount_amount: Number(o.discount_amount || 0),
        coupon_code: o.coupon_code,
        created_at: o.created_at,
        buyer_name: buyer?.full_name || buyer?.email || null,
        buyer_email: buyer?.email || null,
        tracking_number: o.tracking_number,
        label_url: o.label_url,
        agent_id: o.agent_id,
        is_sub_agent_order: isDownlineOrder,
        is_downline_order: isDownlineOrder,
        downline_agent_id: isDownlineOrder ? o.agent_id : null,
        downline_agent_name: isDownlineOrder ? (downlineNames.get(o.agent_id) ?? null) : null,
        profit: Number(profit.toFixed(2)),
        items: o.order_items
      };
    });

    return NextResponse.json({ data: { liveCarts, sales } });
  } catch (error) {
    console.error('Agent Sales API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
