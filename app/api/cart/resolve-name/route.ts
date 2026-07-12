import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

/**
 * POST /api/cart/resolve-name
 * Resolves a product by name for the user's active storefront (or the default storefront).
 * Returns the product data formatted for the CartContext so that global
 * components (like ResearchCartButton) can add items to the cart without needing
 * an AgentStorefrontGrid mounted.
 */
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const ip = getClientIp(req);
  const limited = await rateLimit({
    key: 'cart_resolve_name',
    limit: 60,
    windowSeconds: 60,
    identifier: ip,
  });
  
  if (!limited.allowed) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  }

  try {
    const body = await req.json();
    const name = body?.name;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name Is Required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let agentId = null;

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, id, referring_agent_id, parent_agent_id')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) {
        if (profile.role === 'researcher' && profile.referring_agent_id) {
          agentId = profile.referring_agent_id;
        } else if (profile.role === 'agent' || profile.role === 'super_agent') {
          // Agents always resolve against their OWN storefront catalog, not the
          // parent's. parent_agent_id is used for the billing chain, not catalog
          // ownership. Using parent_agent_id here would send agents to the wrong
          // product catalog at the wrong prices.
          agentId = profile.id;
        }
      }
    }

    // Resolve the agent profile using active flag
    if (agentId) {
      const { data: ap } = await supabase
        .from('agent_profiles')
        .select('id')
        .eq('id', agentId)
        .eq('is_active', true)
        .maybeSingle();
      if (!ap) agentId = null;
    }

    // Fallback to the house researchstore -- never use .limit(1) which returns
    // a non-deterministic agent and could expose another agent's catalog to guests.
    if (!agentId) {
      const { data: fallbackAgent } = await supabase
        .from('agent_profiles')
        .select('id')
        .eq('slug', 'researchstore')
        .eq('is_active', true)
        .maybeSingle();
      if (fallbackAgent) {
        agentId = fallbackAgent.id;
      }
    }

    if (!agentId) {
      return NextResponse.json({ error: 'No Active Storefront Available' }, { status: 404 });
    }

    // Query agent_products joined with products
    const { data: matchedRows } = await supabase
      .from('agent_products')
      .select(`
        id,
        retail_price,
        is_visible,
        product_id,
        products!inner (
          id, name, is_banned, is_active, admin_bulk_price, admin_bulk_threshold, sku, compound_slug, unit_size, inventory_count, base_cost
        )
      `)
      .eq('agent_id', agentId)
      .eq('is_visible', true)
      .eq('products.is_active', true)
      .eq('products.is_banned', false);

    const rows = matchedRows || [];
    const matches = rows.filter((r: any) => {
      const p = Array.isArray(r.products) ? r.products[0] : r.products;
      if (!p) return false;
      const pName = (p.name || '').toLowerCase();
      const pSlug = (p.compound_slug || '').toLowerCase();
      const q = name.toLowerCase();
      return pName === q || pSlug === q;
    });

    if (matches.length === 0) {
      return NextResponse.json({ error: 'Product Not Found' }, { status: 404 });
    }

    // Pick the smallest unit size by default, or the first match
    const pick = matches.sort((a: any, b: any) => {
      const aP = Array.isArray(a.products) ? a.products[0] : a.products;
      const bP = Array.isArray(b.products) ? b.products[0] : b.products;
      return parseFloat(aP?.unit_size || '0') - parseFloat(bP?.unit_size || '0');
    })[0];

    const product = Array.isArray(pick.products) ? pick.products[0] : pick.products;

    // NOTE: Do NOT block on products.inventory_count here. That column tracks global
    // (China-origin) stock; agents maintain their own local inventory separately.
    // The order route handles out-of-stock checks correctly via agent_inventory.
    // Blocking here would incorrectly reject orderable products for agents with local stock.

    // Is this an agent buying from their own storefront?
    const agentSelfBuy = !!user && user.id === agentId;

    // Agent self-buys use base_cost (wholesale cost price), not retail.
    // This mirrors the server-side pricing enforced in POST /api/orders.
    const retailPerVial = (Number(pick.retail_price) || 0) / 10;
    const costPerVial = agentSelfBuy && product.base_cost != null
      ? (Number(product.base_cost) || 0) / 10
      : retailPerVial;

    const item = {
      id: pick.id,
      productId: product.id,
      name: product.name,
      sku: product.sku || product.id,
      retailPrice: agentSelfBuy ? costPerVial : retailPerVial,
      costPrice: costPerVial,
      bulkCostPrice: product.admin_bulk_price != null ? Number(product.admin_bulk_price) / 10 : null,
      bulkThreshold: product.admin_bulk_threshold != null ? Number(product.admin_bulk_threshold) : null,
      weightOz: 0, // Not strictly needed for UI Add to Cart, resolved at checkout
      agentSelfBuy,
    };

    const isBacWater = (product.name || '').toLowerCase().includes('bac') || (product.compound_slug || '') === 'bacteriostatic-water';
    const quantity = isBacWater ? 10 : 1;

    return NextResponse.json({ item, quantity });

  } catch (err) {
    console.error('Resolve Name Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
