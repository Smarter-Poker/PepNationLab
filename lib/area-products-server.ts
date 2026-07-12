
/**
 * Server-only helpers for resolving products on research area pages.
 * Bridges compounds → products → agent pricing for the logged-in user.
 */
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getProductImage } from '@/lib/categoryImage';
import { DEFAULT_STORE_SLUG } from '@/lib/default-store';
import { computeAgentCostForAgent, type AgentTier } from '@/lib/pricing';

export interface AreaProduct {
  productId: string;
  agentProductId: string | null; // agent_products.id - used as cart variant key
  productName: string;
  compoundSlug: string;
  category: string;
  imageUrl: string;
  unitSize: string | null;
  unitMeasure: string | null;
  retailPrice: number; // per-vial price the user pays
  costPrice: number | null; // per-vial cost (agents only)
  weightOz: number;
  sku: string | null;
  isOnSale: boolean;
  salePrice: number | null;
  inventoryCount: number;
  description: string | null;
}

export interface AreaProductContext {
  products: AreaProduct[];
  agentSlug: string | null;
  userRole: string | null;
  isStorefrontOwner: boolean;
  isAuthenticated: boolean;
}

/**
 * Resolve products + pricing for the logged-in user's agent storefront,
 * filtered to only products matching the given compound slugs.
 */
export async function getAreaProducts(
  compoundSlugs: string[]
): Promise<AreaProductContext> {
  if (compoundSlugs.length === 0) {
    return { products: [], agentSlug: null, userRole: null, isStorefrontOwner: false, isAuthenticated: false };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { products: [], agentSlug: null, userRole: null, isStorefrontOwner: false, isAuthenticated: false };
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, referring_agent_id, parent_agent_id, tier')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) {
    return { products: [], agentSlug: null, userRole: null, isStorefrontOwner: false, isAuthenticated: true };
  }

  const role = profile.role as string;

  // Determine the agent whose storefront products we should show
  let agentId: string | null = null;
  let isStorefrontOwner = false;

  if (role === 'admin') {
    // Admin: show products from a default context - if they have their own agent_profile, use it.
    // Otherwise we'll fallback to the first active agent in the system below.
    const { data: adminAgent } = await supabase.from('agent_profiles').select('id').eq('id', profile.id).maybeSingle();
    if (adminAgent) {
        agentId = profile.id;
        isStorefrontOwner = true;
    }
  } else if (role === 'researcher') {
    agentId = (profile as any).referring_agent_id || null;
  } else if (role === 'agent' || role === 'super_agent') {
    agentId = profile.id;
    isStorefrontOwner = true;
  }

  if (!agentId) {
    if (role === 'admin') {
      // Admins always preview the house researchstore - never pick a random agent via .limit(1)
      const { data: fallbackAgent } = await supabase
        .from('agent_profiles')
        .select('id')
        .eq('slug', DEFAULT_STORE_SLUG)
        .eq('is_active', true)
        .maybeSingle();
      if (fallbackAgent) {
        agentId = fallbackAgent.id;
        isStorefrontOwner = true;
      } else {
        return { products: [], agentSlug: null, userRole: role, isStorefrontOwner: false, isAuthenticated: true };
      }
    } else {
      return { products: [], agentSlug: null, userRole: role, isStorefrontOwner: false, isAuthenticated: true };
    }
  }

  // Get agent slug for cart integration
  const { data: agentProfile } = await supabase
    .from('agent_profiles')
    .select('slug')
    .eq('id', agentId)
    .maybeSingle();
  const agentSlug = agentProfile?.slug || null;

  // Get all master products matching these compound slugs
  const svc = createAdminClient();
  const { data: masterProducts } = await svc
    .from('products')
    .select('id, name, compound_slug, category, image_url, unit_size, unit_measure, base_cost, weight_oz, sku, inventory_count, description')
    .in('compound_slug', compoundSlugs)
    .eq('is_active', true)
    .eq('is_banned', false)
    .order('name', { ascending: true });

  if (!masterProducts || masterProducts.length === 0) {
    return { products: [], agentSlug, userRole: role, isStorefrontOwner, isAuthenticated: true };
  }

  // Get agent_products for this agent matching these product IDs
  const productIds = masterProducts.map(p => p.id);
  const { data: agentProducts } = await svc
    .from('agent_products')
    .select('id, product_id, retail_price, is_on_sale, sale_price, custom_image_url, custom_name')
    .eq('agent_id', agentId)
    .eq('is_visible', true)
    .in('product_id', productIds);

  // Map agent_products by product_id for quick lookup
  const apMap = new Map<string, any>();
  for (const ap of agentProducts ?? []) {
    apMap.set(ap.product_id, ap);
  }

  // For storefront owners, compute cost prices
  const costPrices = new Map<string, number>();
  if (isStorefrontOwner) {
    const ownerTier = ((profile as any).tier ?? 'tier_3') as AgentTier;
    await Promise.all(
      productIds.map(async (pid) => {
        try {
          const cost = await computeAgentCostForAgent(svc, pid, agentId!, ownerTier);
          if (cost != null) costPrices.set(pid, cost / 10); // per-vial
        } catch { /* skip */ }
      })
    );
  }

  // Assemble final product list - only include products the agent actually carries
  const result: AreaProduct[] = [];
  for (const mp of masterProducts) {
    const ap = apMap.get(mp.id);
    if (!ap) continue; // Agent doesn't carry this product

    const isOnSale = !!(ap.is_on_sale && ap.sale_price);
    const retailPricePerVial = isOnSale
      ? Number(ap.sale_price) / 10
      : Number(ap.retail_price) / 10;

    result.push({
      productId: mp.id,
      agentProductId: ap.id,
      productName: ap.custom_name || mp.name,
      compoundSlug: mp.compound_slug, // @ts-ignore
      category: mp.category || '',
      imageUrl: getProductImage(
        ap.custom_image_url || mp.image_url || null,
        mp.category || '',
        mp.name,
      ),
      unitSize: mp.unit_size || null,
      unitMeasure: mp.unit_measure || null,
      retailPrice: retailPricePerVial,
      costPrice: costPrices.get(mp.id) ?? null,
      weightOz: Number(mp.weight_oz) || 0.5,
      sku: mp.sku || null,
      isOnSale,
      salePrice: isOnSale ? Number(ap.sale_price) / 10 : null,
      inventoryCount: Number(mp.inventory_count) || 0,
      description: mp.description || null,
    });
  }

  return { products: result, agentSlug, userRole: role, isStorefrontOwner, isAuthenticated: true };
}
