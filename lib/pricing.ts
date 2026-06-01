import type { createServiceClient } from '@/lib/supabase/server';

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

export type AgentTier = 'tier_1' | 'tier_2' | 'tier_3';

const CACHE_TTL_MS = 60_000;

interface CacheEntry<T> { value: T; expires: number; }
const cache = new Map<string, CacheEntry<unknown>>();

function setCache<T>(key: string, value: T): T {
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
  return value;
}
function getCached<T>(key: string): T | undefined {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return undefined;
  if (Date.now() > entry.expires) { cache.delete(key); return undefined; }
  return entry.value;
}

async function getDefaultTierMultiplier(supabase: ServiceClient, tier: AgentTier): Promise<number> {
  const key = `tier:${tier}`;
  const hit = getCached<number>(key);
  if (hit !== undefined) return hit;
  const { data } = await supabase.from('pricing_tiers').select('multiplier').eq('tier_name', tier).maybeSingle();
  // Safety fallback: 1.7 = tier_3 (highest standard multiplier).
  // 7.0 was a placeholder left from initial development and would charge
  // agents 7× wholesale cost if the DB row is missing — catastrophic.
  const multiplier = data?.multiplier != null ? Number(data.multiplier) : 1.7;
  return setCache(key, multiplier);
}

async function getProductOverrideMultiplier(supabase: ServiceClient, productId: string, tier: AgentTier): Promise<number | null> {
  const key = `override:${productId}:${tier}`;
  const hit = getCached<number | null>(key);
  if (hit !== undefined) return hit;
  const { data } = await supabase.from('product_tier_overrides').select('custom_multiplier').eq('product_id', productId).eq('tier_name', tier).maybeSingle();
  const value = data?.custom_multiplier != null ? Number(data.custom_multiplier) : null;
  return setCache(key, value);
}

async function getProductBaseCost(supabase: ServiceClient, productId: string): Promise<number> {
  const key = `base:${productId}`;
  const hit = getCached<number>(key);
  if (hit !== undefined) return hit;
  const { data } = await supabase.from('products').select('base_cost').eq('id', productId).maybeSingle();
  const base = data?.base_cost != null ? Number(data.base_cost) : 0;
  return setCache(key, base);
}

export async function getTierMultiplier(supabase: ServiceClient, productId: string, tier: AgentTier): Promise<number> {
  const override = await getProductOverrideMultiplier(supabase, productId, tier);
  if (override !== null) return override;
  return getDefaultTierMultiplier(supabase, tier);
}

export async function computeAgentCost(supabase: ServiceClient, productId: string, tier: AgentTier): Promise<number> {
  const [base, multiplier] = await Promise.all([
    getProductBaseCost(supabase, productId),
    getTierMultiplier(supabase, productId, tier),
  ]);
  return Math.round(base * multiplier * 100) / 100;
}

export async function computeSubAgentBaselineCost(supabase: ServiceClient, productId: string, superAgentId: string): Promise<number> {
  const key = `superBaseline:${superAgentId}:${productId}`;
  const cached = getCached<number | null>(key);
  if (cached === undefined) {
    const { data } = await supabase.from('super_agent_pricing').select('baseline_cost').eq('super_agent_id', superAgentId).eq('product_id', productId).maybeSingle();
    const value = data?.baseline_cost != null ? Number(data.baseline_cost) : null;
    setCache(key, value);
    if (value !== null) return value;
  } else if (cached !== null) {
    return cached;
  }
  const { data: superProfile } = await supabase.from('profiles').select('tier').eq('id', superAgentId).maybeSingle();
  const superTier = (superProfile?.tier as AgentTier | null) ?? 'tier_3';
  return computeAgentCost(supabase, productId, superTier);
}

/* ── 5-Tier Gamification Ladder (v2) — flag-gated ──────────────────────────
   Active only when NEXT_PUBLIC_TIER_LADDER_V2 === '1'. Until the flag is set,
   computeAgentCostForAgent() falls through to the legacy per-tier multiplier
   path below, so production pricing is byte-for-byte unchanged. */

export function isTierLadderV2(): boolean {
  // Engine ACTIVATED. The 5-tier ladder is live by default. Pre-existing accounts
  // were grandfathered onto a Fixed-Scale-Override at their prior pricing, so the
  // volume ladder is never auto-applied to them — being volume-driven vs a fixed
  // "hard percentage" is a per-account choice (admin House Tier Lock / super-agent
  // plan). Hard kill-switch: set NEXT_PUBLIC_TIER_LADDER_V2='0' to revert to legacy.
  return process.env.NEXT_PUBLIC_TIER_LADDER_V2 !== '0';
}

export interface HouseTier {
  level: number;
  name: string;
  min_volume: number;
  max_volume: number | null;
  markup: number;
}

export async function getHouseTiers(supabase: ServiceClient): Promise<HouseTier[]> {
  const hit = getCached<HouseTier[]>('houseTiers');
  if (hit !== undefined) return hit;
  const { data } = await supabase
    .from('house_tiers')
    .select('level, name, min_volume, max_volume, markup')
    .order('level');
  const tiers: HouseTier[] = (data ?? []).map((t) => ({
    level: Number(t.level),
    name: String(t.name),
    min_volume: Number(t.min_volume),
    max_volume: t.max_volume == null ? null : Number(t.max_volume),
    markup: Number(t.markup),
  }));
  return setCache('houseTiers', tiers);
}

/** Resolve the agent's effective house tier level (admin override else volume bucket). */
export async function resolveHouseTierLevel(supabase: ServiceClient, agentId: string): Promise<number> {
  const { data, error } = await supabase.rpc('fn_resolve_house_tier_level', { p_agent: agentId });
  if (error || data == null) return 1;
  return Number(data);
}

/** v2 wholesale cost for a House-facing agent: cost = base * (1 + markup(level)). */
export async function computeAgentCostV2(supabase: ServiceClient, productId: string, agentId: string): Promise<number> {
  const [base, level, tiers] = await Promise.all([
    getProductBaseCost(supabase, productId),
    resolveHouseTierLevel(supabase, agentId),
    getHouseTiers(supabase),
  ]);
  const tier = tiers.find((t) => t.level === level);
  // Safety: on an unknown level or missing config, fall back to the HIGHEST
  // configured markup (most house-protective), or 0.7 if the table is empty.
  const markup = tier
    ? tier.markup
    : (tiers.length ? Math.max(...tiers.map((t) => t.markup)) : 0.7);
  return Math.round(base * (1 + markup) * 100) / 100;
}

/**
 * Flag-aware entry point for an agent's wholesale cost. When the tier ladder v2
 * flag is enabled, resolves the dynamic 5-tier markup; otherwise falls back to
 * the legacy per-tier multiplier using the passed-in legacy tier.
 */
export async function computeAgentCostForAgent(
  supabase: ServiceClient,
  productId: string,
  agentId: string,
  legacyTier: AgentTier,
): Promise<number> {
  if (isTierLadderV2()) return computeAgentCostV2(supabase, productId, agentId);
  return computeAgentCost(supabase, productId, legacyTier);
}

export function applyBulkPrice(base: number, qty: number, bulkPrice: number | null | undefined, bulkThreshold: number | null | undefined): number {
  if (bulkPrice == null) return base;
  const threshold = bulkThreshold && bulkThreshold > 0 ? bulkThreshold : 100;
  if (qty >= threshold) return Number(bulkPrice);
  return base;
}

export { createServiceClient };
