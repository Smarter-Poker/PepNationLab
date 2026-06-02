import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import type { AgentTier } from '@/lib/pricing';

// GET: Fetch the agent's current inventory levels for all active products
export async function GET(req: NextRequest) {
  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;

    const supabase = await createServiceClient();
    const agentId = gate.user.id;

    // Fetch all active products
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, sku, category, image_url, unit_size, unit_measure, base_cost')
      .eq('is_active', true);

    if (productsError) {
      return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
    }

    // ── Resolve agent tier ─────────────────────────────────────────────────────
    const { data: profile } = await supabase
      .from('profiles')
      .select('tier')
      .eq('id', agentId)
      .single();

    const tier = ((profile?.tier as AgentTier | null) ?? 'tier_3') as AgentTier;

    // ── Fetch global tier multiplier ───────────────────────────────────────────
    const { data: tierRow } = await supabase
      .from('pricing_tiers')
      .select('multiplier')
      .eq('tier_name', tier)
      .maybeSingle();
    const globalMultiplier = tierRow?.multiplier != null ? Number(tierRow.multiplier) : 1.7;

    // ── Fetch per-product tier overrides ─────────────────────────────────────
    const productIds = products.map(p => p.id);
    const overrideMap: Record<string, number> = {};
    if (productIds.length > 0) {
      const { data: overrides } = await supabase
        .from('product_tier_overrides')
        .select('product_id, custom_multiplier')
        .in('product_id', productIds)
        .eq('tier_name', tier);
      overrides?.forEach(o => {
        overrideMap[o.product_id as string] = Number(o.custom_multiplier);
      });
    }

    // Fetch the agent's inventory
    const { data: inventory, error: inventoryError } = await supabase
      .from('agent_inventory')
      .select('product_id, stock_count')
      .eq('agent_id', agentId);

    if (inventoryError) {
      return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
    }

    const inventoryMap = new Map(inventory?.map(i => [i.product_id, i.stock_count]) || []);

    const result = products.map(p => {
      const baseCost = p.base_cost != null ? Number(p.base_cost) : 0;
      const effectiveMultiplier = overrideMap[p.id] ?? globalMultiplier;
      const agentCost = Math.round(baseCost * effectiveMultiplier * 100) / 100;
      
      const { base_cost: _stripped, ...safeProduct } = p;
      void _stripped;
      
      return {
        ...safeProduct,
        stock_count: inventoryMap.get(p.id) || 0,
        agent_cost: baseCost > 0 ? agentCost : null
      };
    });

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

    const supabase = await createServiceClient();
    const agentId = gate.user.id;
    const { productId, stockCount } = await req.json();

    // BUG-16 FIX: validate productId is a valid UUID before hitting the DB.
    // Without this, a malformed ID triggers a raw FK constraint error leaking schema details.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!productId || !UUID_RE.test(String(productId))) {
      return NextResponse.json({ error: 'Invalid Product ID.' }, { status: 400 });
    }

    if (typeof stockCount !== 'number' || Number.isNaN(stockCount) || !Number.isFinite(stockCount)) {
      return NextResponse.json({ error: 'Product ID and stockCount required' }, { status: 400 });
    }

    // Reject negative inventory.
    if (stockCount < 0) {
      return NextResponse.json({ error: 'Stock Count Cannot Be Negative' }, { status: 400 });
    }
    // BUG-21 FIX: add upper bound to prevent Number.MAX_SAFE_INTEGER from being
    // set, which would permanently bypass the inventory gate in orders/approve.
    if (stockCount > 100_000) {
      return NextResponse.json({ error: 'Stock Count Cannot Exceed 100,000' }, { status: 400 });
    }

    // Upsert the inventory count
    const { error } = await supabase
      .from('agent_inventory')
      .upsert({
        agent_id: agentId,
        product_id: productId,
        stock_count: stockCount,
        updated_at: new Date().toISOString()
      }, { onConflict: 'agent_id, product_id' });

    if (error) {
      return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Agent Inventory API POST Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
