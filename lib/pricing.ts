import type { createServiceClient } from '@/lib/supabase/server';

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

export type AgentTier = 'tier_1' | 'tier_2' | 'tier_3';

/**
 * Per-process cache. Keys:
 *  - `tier:${tier}` -> default multiplier from pricing_tiers
 *  - `override:${productId}:${tier}` -> custom multiplier (may be null if not set)
 *  - `base:${productId}` -> products.base_cost
 *  - `superBaseline:${superAgentId}:${productId}` -> super_agent_pricing.baseline_cost (or null)
 */
const cache = new Map<string, unknown>();

function setCache<T>(key: string, value: T): T {
  cache.set(key, value);
  return value;
}

function getCached<T>(key: string): T | undefined {
  return cache.has(key) ? (cache.get(key) as T) : undefined;
}

async function getDefaultTierMultiplier(
  supabase: ServiceClient,
  tier: AgentTier
): Promise<number> {
  const key = `tier:${tier}`;
  const hit = getCached<number>(key);
  if (hit !== undefined) return hit;

  const { data } = await supabase
    .from('pricing_tiers')
    .select('multiplier')
    .eq('tier_name', tier)
    .maybeSingle();

  const multiplier = data?.multiplier != null ? Number(data.multiplier) : 7.0;
  return setCache(key, multiplier);
}

async function getProductOverrideMultiplier(
  supabase: ServiceClient,
  productId: string,
  tier: AgentTier
): Promise<number | null> {
  const key = `override:${productId}:${tier}`;
  const hit = getCached<number | null>(key);
  if (hit !== undefined) return hit;

  const { data } = await supabase
    .from('product_tier_overrides')
    .select('custom_multiplier')
    .eq('product_id', productId)
    .eq('tier_name', tier)
    .maybeSingle();

  const value = data?.custom_multiplier != null ? Number(data.custom_multiplier) : null;
  return setCache(key, value);
}

async function getProductBaseCost(
  supabase: ServiceClient,
  productId: string
): Promise<number> {
  const key = `base:${productId}`;
  const hit = getCached<number>(key);
  if (hit !== undefined) return hit;

  const { data } = await supabase
    .from('products')
    .select('base_cost')
    .eq('id', productId)
    .maybeSingle();

  const base = data?.base_cost != null ? Number(data.base_cost) : 0;
  return setCache(key, base);
}

/**
 * Returns the multiplier that applies to (product, tier) — falls back to the
 * default pricing_tiers.multiplier when no per-product override exists.
 */
export async function getTierMultiplier(
  supabase: ServiceClient,
  productId: string,
  tier: AgentTier
): Promise<number> {
  const override = await getProductOverrideMultiplier(supabase, productId, tier);
  if (override !== null) return override;
  return getDefaultTierMultiplier(supabase, tier);
}

/**
 * The wholesale cost an agent at the given tier pays the admin per unit.
 * Equals base_cost * effective_multiplier.
 */
export async function computeAgentCost(
  supabase: ServiceClient,
  productId: string,
  tier: AgentTier
): Promise<number> {
  const [base, multiplier] = await Promise.all([
    getProductBaseCost(supabase, productId),
    getTierMultiplier(supabase, productId, tier),
  ]);
  return Math.round(base * multiplier * 100) / 100;
}

/**
 * The per-unit cost that a sub-agent owes their super-agent. Reads the
 * explicit baseline from super_agent_pricing if one is configured; otherwise
 * falls back to computeAgentCost(productId, superAgent.tier).
 */
export async function computeSubAgentBaselineCost(
  supabase: ServiceClient,
  productId: string,
  superAgentId: string
): Promise<number> {
  const key = `superBaseline:${superAgentId}:${productId}`;
  const cached = getCached<number | null>(key);

  if (cached === undefined) {
    const { data } = await supabase
      .from('super_agent_pricing')
      .select('baseline_cost')
      .eq('super_agent_id', superAgentId)
      .eq('product_id', productId)
      .maybeSingle();
    const value = data?.baseline_cost != null ? Number(data.baseline_cost) : null;
    setCache(key, value);
    if (value !== null) return value;
  } else if (cached !== null) {
    return cached;
  }

  // Fallback: use the super-agent's tier multiplier.
  const { data: superProfile } = await supabase
    .from('profiles')
    .select('tier')
    .eq('id', superAgentId)
    .maybeSingle();

  const superTier = (superProfile?.tier as AgentTier | null) ?? 'tier_3';
  return computeAgentCost(supabase, productId, superTier);
}

/**
 * If the admin has configured a bulk price for the product and the requested
 * quantity meets the threshold, return the bulk price; otherwise return the
 * standard per-unit price. The default threshold when none is set is 100.
 */
export function applyBulkPrice(
  base: number,
  qty: number,
  bulkPrice: number | null | undefined,
  bulkThreshold: number | null | undefined
): number {
  if (bulkPrice == null) return base;
  const threshold = bulkThreshold && bulkThreshold > 0 ? bulkThreshold : 100;
  if (qty >= threshold) return Number(bulkPrice);
  return base;
}

export { createServiceClient };
