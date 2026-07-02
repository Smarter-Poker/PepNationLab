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
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
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
          agentId = profile.parent_agent_id || profile.id;
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

    // Fallback to first active agent profile if no agent context could be resolved
    if (!agentId) {
      const { data: fallbackAgent } = await supabase
        .from('agent_profiles')
        .select('id')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      if (fallbackAgent) {
        agentId = fallbackAgent.id;
      }
    }

    if (!agentId) {
      return NextResponse.json({ error: 'No active storefront available' }, { status: 404 });
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
          id, name, is_banned, is_active, admin_bulk_price, admin_bulk_threshold, sku, compound_slug, unit_size, inventory_count
        )
      `)
      .eq('agent_id', agentId)
      .eq('is_visible', true)
      .eq('products.is_active', true)
      .eq('products.is_banned', false);

    const rows = matchedRows || [];
    const matches = rows.filter((r: Record<string, unknown>) => {
      const p = Array.isArray(r.products) ? r.products[0] : r.products;
      if (!p) return false;
      const pName = (p.name || '').toLowerCase();
      const pSlug = (p.compound_slug || '').toLowerCase();
      const q = name.toLowerCase();
      return pName === q || pSlug === q;
    });

    if (matches.length === 0) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Pick the smallest unit size by default, or the first match
    const pick = matches.sort((a: any, b: any) => {
      const aP = Array.isArray(a.products) ? a.products[0] : a.products;
      const bP = Array.isArray(b.products) ? b.products[0] : b.products;
      return parseFloat(aP?.unit_size || '0') - parseFloat(bP?.unit_size || '0');
    })[0];

    const product = Array.isArray(pick.products) ? pick.products[0] : pick.products;

    if (product.inventory_count <= 0) {
      return NextResponse.json({ error: 'Product is currently out of stock' }, { status: 400 });
    }

    const item = {
      id: pick.id,
      productId: product.id,
      name: product.name,
      sku: product.sku || product.id,
      retailPrice: (Number(pick.retail_price) || 0) / 10,
      costPrice: (Number(pick.retail_price) || 0) / 10,
      bulkCostPrice: product.admin_bulk_price != null ? Number(product.admin_bulk_price) / 10 : null,
      bulkThreshold: product.admin_bulk_threshold != null ? Number(product.admin_bulk_threshold) : null,
      weightOz: 0, // Not strictly needed for UI Add to Cart, resolved at checkout
      agentSelfBuy: user && user.id === agentId // Approximate
    };

    const isBacWater = (product.name || '').toLowerCase().includes('bac') || (product.compound_slug || '') === 'bacteriostatic-water';
    const quantity = isBacWater ? 10 : 1;

    return NextResponse.json({ item, quantity });

  } catch (err) {
    console.error('Resolve Name Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
