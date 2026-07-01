import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { computeAgentCostForAgent } from '@/lib/pricing';
import type { AgentTier } from '@/lib/pricing';

// GET: Fetch the agent's current inventory levels for all active products
export async function GET() {
  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;

    const supabase = createAdminClient();
    const agentId = gate.user.id;

    // Verify Minimum Wholesale Purchase History of $5,000
    const { data: purchaseData, error: purchaseErr } = await supabase
      .from('orders')
      .select('total')
      .eq('buyer_id', agentId)
      .eq('is_wholesale_restock', true)
      .not('status', 'eq', 'cancelled');

    if (purchaseErr) {
      return NextResponse.json({ error: 'Failed To Verify Agent Purchase History.' }, { status: 500 });
    }

    const totalSpend = purchaseData?.reduce((sum, order) => sum + (Number(order.total) || 0), 0) || 0;

    if (totalSpend < 5000) {
      return NextResponse.json({ error: `Access Denied. You Must Have A Minimum Wholesale Purchase History Of $5,000 To Access Local Inventory Features. Your Current Verified Wholesale History Is $${totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.` }, { status: 403 });
    }

    // Fetch all active products
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, sku, category, image_url, unit_size, unit_measure, base_cost')
      .eq('is_active', true);

    if (productsError) {
      return NextResponse.json({ error: 'An Unexpected Error Occurred.' }, { status: 500 });
    }

    // Resolve agent tier
    const { data: profile } = await supabase
      .from('profiles')
      .select('tier')
      .eq('id', agentId)
      .maybeSingle();

    const tier = ((profile?.tier as AgentTier | null) ?? 'tier_3') as AgentTier;

    // Fetch the agent's inventory
    const { data: inventory, error: inventoryError } = await supabase
      .from('agent_inventory')
      .select('product_id, stock_count')
      .eq('agent_id', agentId);

    if (inventoryError) {
      return NextResponse.json({ error: 'An Unexpected Error Occurred.' }, { status: 500 });
    }

    const inventoryMap = new Map(inventory?.map(i => [i.product_id, i.stock_count]) || []);

    const resultPromises = products.map(async p => {
      const baseCost = p.base_cost != null ? Number(p.base_cost) : 0;
      let agentCost = 0;
      if (baseCost > 0) {
        agentCost = await computeAgentCostForAgent(supabase, p.id, agentId, tier);
      }

      const { base_cost: _stripped, ...safeProduct } = p;
      void _stripped;

      return {
        ...safeProduct,
        stock_count: Number(inventoryMap.get(p.id) || 0),
        agent_cost: baseCost > 0 ? Number(agentCost) : null
      };
    });

    const result = await Promise.all(resultPromises);

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Agent Inventory API GET Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST: Update inventory count for a specific product
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;

    const supabase = createAdminClient();
    const agentId = gate.user.id;
    const { productId, stockCount } = await req.json();

    // Verify Minimum Wholesale Purchase History of $5,000
    const { data: purchaseData, error: purchaseErr } = await supabase
      .from('orders')
      .select('total')
      .eq('buyer_id', agentId)
      .eq('is_wholesale_restock', true)
      .not('status', 'eq', 'cancelled');

    if (purchaseErr) {
      return NextResponse.json({ error: 'Failed To Verify Agent Purchase History.' }, { status: 500 });
    }

    const totalSpend = purchaseData?.reduce((sum, order) => sum + (Number(order.total) || 0), 0) || 0;

    if (totalSpend < 5000) {
      return NextResponse.json({ error: 'Access Denied. You Must Have A Minimum Wholesale Purchase History Of $5,000 To Manage Local Inventory.' }, { status: 403 });
    }

    // BUG-16 FIX: validate productId is a valid UUID before hitting the DB.
    // Without this, a malformed ID triggers a raw FK constraint error leaking schema details.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!productId || !UUID_RE.test(String(productId))) {
      return NextResponse.json({ error: 'Invalid Product ID.' }, { status: 400 });
    }

    if (typeof stockCount !== 'number' || Number.isNaN(stockCount) || !Number.isFinite(stockCount)) {
      return NextResponse.json({ error: 'Product ID And Stock Count Required.' }, { status: 400 });
    }

    // Reject negative inventory.
    if (stockCount < 0) {
      return NextResponse.json({ error: 'Stock Count Cannot Be Negative.' }, { status: 400 });
    }
    // BUG-21 FIX: add upper bound to prevent Number.MAX_SAFE_INTEGER from being
    // set, which would permanently bypass the inventory gate in orders/approve.
    if (stockCount > 100_000) {
      return NextResponse.json({ error: 'Stock Count Cannot Exceed 100,000.' }, { status: 400 });
    }

    if (stockCount > 0) {
      // Cross-reference wholesale orders to verify they have actually purchased this product in bulk
      const { data: pastWholesaleOrder, error: orderErr } = await supabase
        .from('order_items')
        .select('id, orders!inner(id, buyer_id, is_wholesale_restock, status)')
        .eq('product_id', productId)
        .eq('orders.buyer_id', agentId)
        .eq('orders.is_wholesale_restock', true)
        .not('orders.status', 'eq', 'cancelled')
        .limit(1);

      if (orderErr) {
        console.error('Inventory wholesale check error:', orderErr);
        return NextResponse.json({ error: 'Failed To Verify Wholesale Purchase History.' }, { status: 500 });
      }

      if (!pastWholesaleOrder || pastWholesaleOrder.length === 0) {
        return NextResponse.json({
          error: 'Action Denied. You Must Have A Verified Wholesale Bulk Order For This Product Before Listing It As A Local In-Stock Item.'
        }, { status: 403 });
      }
    }

    // Atomic upsert of inventory count
    const { error } = await supabase
      .from('agent_inventory')
      .upsert({
        agent_id: agentId,
        product_id: productId,
        stock_count: stockCount,
        updated_at: new Date().toISOString()
      }, { onConflict: 'agent_id, product_id' });

    if (error) {
      return NextResponse.json({ error: 'An Unexpected Error Occurred.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Agent Inventory API POST Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
