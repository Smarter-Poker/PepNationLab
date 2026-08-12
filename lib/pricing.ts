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
  // agents 7× wholesale cost if the DB row is missing - catastrophic.
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
  if (!data || data.base_cost == null) {
    throw new Error(`Critical Pricing Error: Product ${productId} is missing a base_cost.`);
  }
  const base = Number(data.base_cost);
  return setCache(key, base);
}

export async function getTierMultiplier(supabase: ServiceClient, productId: string, tier: AgentTier): Promise<number> {
  const override = await getProductOverrideMultiplier(supabase, productId, tier);
  if (override !== null) return override;
  return getDefaultTierMultiplier(supabase, tier);
}

/** Shared legacy (v1) rounding: cost = base * multiplier, clamped to safe values. */
function applyLegacyMultiplier(base: number, multiplier: number): number {
  const safeBase = Number.isFinite(base) && base > 0 ? base : 0;
  const safeMult = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1.7;
  return Math.round(safeBase * safeMult * 100) / 100;
}

export async function computeAgentCost(supabase: ServiceClient, productId: string, tier: AgentTier): Promise<number> {
  const [base, multiplier] = await Promise.all([
    getProductBaseCost(supabase, productId),
    getTierMultiplier(supabase, productId, tier),
  ]);
  return applyLegacyMultiplier(base, multiplier);
}

export async function computeSubAgentBaselineCost(supabase: ServiceClient, productId: string, superAgentId: string): Promise<number> {
  const key = `superBaseline:${superAgentId}:${productId}`;
  const cached = getCached<number | null>(key);
  if (cached === undefined) {
    const { data, error } = await supabase.from('super_agent_pricing').select('baseline_cost').eq('super_agent_id', superAgentId).eq('product_id', productId).maybeSingle();
    if (error) {
      // Don't cache on DB error - transient failures should be retried.
      console.warn('[pricing] super_agent_pricing query failed, falling back to computed cost:', error.message);
    } else {
      const value = data?.baseline_cost != null ? Number(data.baseline_cost) : null;
      setCache(key, value);
      if (value !== null) return value;
    }
  } else if (cached !== null) {
    return cached;
  }
  const { data: superProfile } = await supabase.from('profiles').select('tier').eq('id', superAgentId).maybeSingle();
  const superTier = (superProfile?.tier as AgentTier | null) ?? 'tier_3';
  return computeAgentCostForAgent(supabase, productId, superAgentId, superTier);
}

/* ── 5-Tier Gamification Ladder (v2) - flag-gated ──────────────────────────
   Active only when NEXT_PUBLIC_TIER_LADDER_V2 === '1'. Until the flag is set,
   computeAgentCostForAgent() falls through to the legacy per-tier multiplier
   path below, so production pricing is byte-for-byte unchanged. */

export function isTierLadderV2(): boolean {
  // Engine ACTIVATED. The 5-tier ladder is live by default. Pre-existing accounts
  // were grandfathered onto a Fixed-Scale-Override at their prior pricing, so the
  // volume ladder is never auto-applied to them - being volume-driven vs a fixed
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

/** Cached per-agent flat markup override (profiles.custom_markup_override). */
async function getAgentMarkupOverride(supabase: ServiceClient, agentId: string): Promise<number | null> {
  const key = `markupOverride:${agentId}`;
  const hit = getCached<number | null>(key);
  if (hit !== undefined) return hit;
  const { data } = await supabase.from('profiles').select('custom_markup_override').eq('id', agentId).maybeSingle();
  const value = data?.custom_markup_override != null ? Number(data.custom_markup_override) : null;
  return setCache(key, value);
}

/** Cached wrapper around resolveHouseTierLevel, keyed per agent. */
async function getHouseTierLevelCached(supabase: ServiceClient, agentId: string): Promise<number> {
  const key = `houseLevel:${agentId}`;
  const hit = getCached<number>(key);
  if (hit !== undefined) return hit;
  return setCache(key, await resolveHouseTierLevel(supabase, agentId));
}

/** Shared v2 rounding: cost = base * (1 + markup), clamped to safe values. */
function applyHouseMarkup(base: number, markup: number): number {
  const safeMarkup = Number.isFinite(markup) && markup >= 0 ? markup : 0.7; // Hard fail-safe
  const safeBase = Number.isFinite(base) && base > 0 ? base : 0;
  return Math.round(safeBase * (1 + safeMarkup) * 100) / 100;
}

/**
 * Resolve the TOP-OF-CHAIN agent's markup (flat custom_markup_override else
 * house tier ladder) once. All per-agent inputs are TTL-cached, so repeat
 * calls within the cache window are free.
 *
 * NOTE: this only ever reads custom_markup_override / house-tier-level for
 * the id it's given. For a PARENTED agent (profiles.parent_agent_id set),
 * callers must go through resolveChainAwareV2Markup() below instead - the
 * chain is the source of truth for a parented account, and that account's
 * OWN custom_markup_override is intentionally never read (see comment on
 * resolveChainAwareV2Markup).
 */
async function resolveV2Markup(supabase: ServiceClient, agentId: string): Promise<number> {
  const [customOverride, level, tiers] = await Promise.all([
    getAgentMarkupOverride(supabase, agentId),
    getHouseTierLevelCached(supabase, agentId),
    getHouseTiers(supabase),
  ]);
  if (customOverride !== null) return customOverride;
  const tier = tiers.find((t) => t.level === level);
  // Safety: on an unknown level or missing config, fall back to the HIGHEST
  // configured markup (most house-protective), or 0.7 if the table is empty.
  return tier
    ? tier.markup
    : (tiers.length ? Math.max(...tiers.map((t) => t.markup)) : 0.7);
}

/* ── Chain-Aware Pricing (2026-07-21) ───────────────────────────────────────
   Root cause of "assigns a custom markup % on a downline agent, but the
   account's cost/pricing surfaces auto-default to Tier 3 pricing": the
   platform has two cost models. resolveV2Markup() above (house tier ladder /
   custom_markup_override) powers the price editor, margin checks, and every
   agent-facing cost display - a fresh downline agent has no ladder history,
   so it lands on the tier_3-equivalent default. Separately,
   fn_agent_effective_markup (DB) - which reads profiles.commission_pct, the
   markup a Super Agent actually assigns when creating the downline - is the
   TRUE cost model checkout's super-agent branch charges. The two never
   agreed, and neither one compounded a nested Super's cost through THEIR OWN
   upline.
   The fix: for any non-sub-agent profile that HAS a parent_agent_id, the
   chain is the single source of truth. custom_markup_override / the house
   tier ladder apply ONLY at the top of the chain (parent_agent_id IS NULL).
   A parented profile's own custom_markup_override is never read - the chain
   wins by design. */

const MAX_CHAIN_DEPTH = 6;

interface ChainNode {
  id: string;
  parent_agent_id: string | null;
  is_sub_agent: boolean;
  commission_pct: number | null;
}

/** Cached per-profile chain-walk inputs (parent_agent_id / is_sub_agent / commission_pct). */
async function getChainNode(supabase: ServiceClient, agentId: string): Promise<ChainNode | null> {
  const key = `chainNode:${agentId}`;
  const hit = getCached<ChainNode | null>(key);
  if (hit !== undefined) return hit;
  const { data } = await supabase
    .from('profiles')
    .select('id, parent_agent_id, is_sub_agent, commission_pct')
    .eq('id', agentId)
    .maybeSingle();
  const node: ChainNode | null = data
    ? {
        id: String(data.id),
        parent_agent_id: data.parent_agent_id ?? null,
        is_sub_agent: data.is_sub_agent === true,
        commission_pct: data.commission_pct != null ? Number(data.commission_pct) : null,
      }
    : null;
  return setCache(key, node);
}

/**
 * Walk a profile's parent_agent_id chain upward to find the top-of-chain
 * ancestor (parent_agent_id IS NULL) and the ordered list of per-hop markups
 * (top -> bottom) between that ancestor and the given agent. Each hop's
 * markup is COALESCE(commission_pct, 50) - identical to the default
 * fn_agent_effective_markup uses for an unassigned downline, so the chain
 * resolved here always agrees with what checkout's super-agent branch
 * actually charges.
 *
 * A sub-agent redirects to its parent's chain entirely before walking begins
 * ("today's parent-context behavior"): commission_pct on a sub-agent profile
 * is a recruiter payout cut (0-40%, paid out in real dollars), not a cost
 * markup, and must never be read as one.
 *
 * Guard: max depth 6 + cycle detection. A malformed parent_agent_id chain
 * must never break checkout or a price display - on breach this logs a
 * warning and falls back to today's ladder behavior (agentId treated as its
 * own top-of-chain).
 */
async function resolveChain(
  supabase: ServiceClient,
  agentId: string,
): Promise<{ topId: string; hopMarkups: number[] }> {
  const startNode = await getChainNode(supabase, agentId);
  let currentId = startNode?.is_sub_agent && startNode.parent_agent_id ? startNode.parent_agent_id : agentId;

  const seen = new Set<string>();
  const hopsBottomUp: number[] = [];

  while (true) {
    if (seen.has(currentId) || seen.size >= MAX_CHAIN_DEPTH) {
      console.warn(
        `[pricing] parent_agent_id chain for agent ${agentId} exceeded depth ${MAX_CHAIN_DEPTH} or contains a cycle (stopped at ${currentId}). Falling back to top-of-chain ladder pricing for ${agentId}.`,
      );
      return { topId: agentId, hopMarkups: [] };
    }
    seen.add(currentId);

    const node = await getChainNode(supabase, currentId);
    if (!node || !node.parent_agent_id) {
      // Top of chain (or an unresolvable profile - treat as top so callers
      // still get a defined ladder cost instead of throwing).
      return { topId: currentId, hopMarkups: hopsBottomUp.reverse() };
    }
    // currentId is parented: its own cost is its parent's cost x this hop's
    // markup. Record the hop, then keep walking toward the top ancestor.
    hopsBottomUp.push(node.commission_pct != null ? node.commission_pct : 50);
    currentId = node.parent_agent_id;
  }
}

/**
 * Detailed variant powering resolveChainAwareV2Markup() below: also returns
 * the top-of-chain ancestor's own markup and the pure hop-compounding
 * factor, so a caller that needs the TOP ancestor's ladder cost (not the
 * full chain-compounded cost - see computeAgentTopOfChainCostsForAgent
 * further down) can derive it without re-walking the chain. For a
 * top-of-chain agent (no parent), topMarkup === markup and chainFactor === 1.
 */
async function resolveChainAwareV2MarkupDetailed(
  supabase: ServiceClient,
  agentId: string,
): Promise<{ markup: number; topMarkup: number; chainFactor: number }> {
  try {
    const { topId, hopMarkups } = await resolveChain(supabase, agentId);
    const topMarkup = await resolveV2Markup(supabase, topId);
    if (hopMarkups.length === 0) return { markup: topMarkup, topMarkup, chainFactor: 1 };
    const chainFactor = hopMarkups.reduce((acc, m) => acc * (1 + m / 100), 1);
    return { markup: (1 + topMarkup) * chainFactor - 1, topMarkup, chainFactor };
  } catch (err) {
    console.warn(`[pricing] chain resolution failed for agent ${agentId}, falling back to direct ladder markup:`, err);
    const markup = await resolveV2Markup(supabase, agentId);
    return { markup, topMarkup: markup, chainFactor: 1 };
  }
}

/**
 * Chain-aware replacement for resolveV2Markup(): for a top-of-chain agent
 * (no parent_agent_id) this returns exactly resolveV2Markup(agentId) - byte
 * identical, zero behavior change. For a parented agent, it returns the
 * single combined markup fraction such that
 *   applyHouseMarkup(base, resolveChainAwareV2Markup(...))
 * equals topLevelCost(base, topAncestor) compounded by every commission_pct
 * hop from the top ancestor down to this agent - i.e. exactly what
 * checkout's chain model (fn_agent_effective_markup) charges, generalized to
 * arbitrarily nested Super Agents.
 */
async function resolveChainAwareV2Markup(supabase: ServiceClient, agentId: string): Promise<number> {
  return (await resolveChainAwareV2MarkupDetailed(supabase, agentId)).markup;
}

/** v2 wholesale cost for a House-facing agent: cost = base * (1 + markup(level)), chain-aware. */
export async function computeAgentCostV2(supabase: ServiceClient, productId: string, agentId: string): Promise<number> {
  const [base, markup] = await Promise.all([
    getProductBaseCost(supabase, productId),
    resolveChainAwareV2Markup(supabase, agentId),
  ]);
  return applyHouseMarkup(base, markup);
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

/* ── Batch pricing API ──────────────────────────────────────────────────────
   Per-product calls to computeAgentCostForAgent re-resolve the same per-agent
   constants on every call (custom_markup_override select + house tier RPC on
   the live v2 path), turning an N-product catalog into 2-3 x N queries. The
   helpers below resolve that agent context ONCE (TTL-cached per agent) and
   then price any number of products in memory with the exact same formula
   and rounding as the per-product path. */

export type AgentPricingContext =
  | { ladderV2: true; markup: number; topMarkup: number; chainFactor: number }
  | { ladderV2: false; tier: AgentTier; defaultMultiplier: number };

/** Resolve the per-agent pricing constants once (flag-aware, TTL-cached). */
export async function resolveAgentPricingContext(
  supabase: ServiceClient,
  agentId: string,
  legacyTier: AgentTier,
): Promise<AgentPricingContext> {
  if (isTierLadderV2()) {
    const { markup, topMarkup, chainFactor } = await resolveChainAwareV2MarkupDetailed(supabase, agentId);
    return { ladderV2: true, markup, topMarkup, chainFactor };
  }
  return {
    ladderV2: false,
    tier: legacyTier,
    defaultMultiplier: await getDefaultTierMultiplier(supabase, legacyTier),
  };
}

/** Batched legacy per-product override lookup, sharing the per-product TTL cache. */
async function getProductOverrideMultipliers(
  supabase: ServiceClient,
  productIds: string[],
  tier: AgentTier,
): Promise<Map<string, number | null>> {
  const result = new Map<string, number | null>();
  const missing: string[] = [];
  for (const id of productIds) {
    const hit = getCached<number | null>(`override:${id}:${tier}`);
    if (hit !== undefined) result.set(id, hit);
    else missing.push(id);
  }
  if (missing.length > 0) {
    const { data } = await supabase
      .from('product_tier_overrides')
      .select('product_id, custom_multiplier')
      .in('product_id', missing)
      .eq('tier_name', tier);
    const fetched = new Map<string, number | null>(
      (data ?? []).map((r) => [String(r.product_id), r.custom_multiplier != null ? Number(r.custom_multiplier) : null]),
    );
    for (const id of missing) {
      result.set(id, setCache(`override:${id}:${tier}`, fetched.get(id) ?? null));
    }
  }
  return result;
}

/** Price a single product against an already-resolved agent context. */
async function computeCostWithContext(
  supabase: ServiceClient,
  context: AgentPricingContext,
  productId: string,
): Promise<number> {
  const base = await getProductBaseCost(supabase, productId);
  if (context.ladderV2) return applyHouseMarkup(base, context.markup);
  const override = await getProductOverrideMultiplier(supabase, productId, context.tier);
  return applyLegacyMultiplier(base, override !== null ? override : context.defaultMultiplier);
}

/**
 * Batch version of computeAgentCostForAgent: resolves the agent context once
 * and prices every product in memory, producing identical numbers to the
 * per-product path on both the v2-live and legacy (v1) paths.
 *
 * Callers supply each product's base_cost (the same products.base_cost column
 * the per-product path reads). Products with a NULL base_cost must be
 * excluded by the caller - the per-product path throws for them, so their
 * cost is undefined and lookups on the returned map miss.
 */
export async function computeAgentCostsForAgent(
  supabase: ServiceClient,
  agentId: string,
  legacyTier: AgentTier,
  products: ReadonlyArray<{ id: string; base_cost: number }>,
): Promise<Map<string, number>> {
  const costs = new Map<string, number>();
  if (products.length === 0) return costs;
  const context = await resolveAgentPricingContext(supabase, agentId, legacyTier);
  if (context.ladderV2) {
    for (const p of products) {
      costs.set(p.id, applyHouseMarkup(Number(p.base_cost), context.markup));
    }
    return costs;
  }
  const overrides = await getProductOverrideMultipliers(
    supabase,
    products.map((p) => p.id),
    context.tier,
  );
  for (const p of products) {
    const override = overrides.get(p.id) ?? null;
    costs.set(p.id, applyLegacyMultiplier(Number(p.base_cost), override !== null ? override : context.defaultMultiplier));
  }
  return costs;
}

/**
 * Batch top-of-chain cost lookup (2026-07-21): for a parented agent, returns
 * the TOP ancestor's own ladder cost per product (base * (1 + topMarkup)) -
 * i.e. the house's true cost basis, ignoring every downstream hop's markup.
 * For a top-of-chain agent (no parent) this is numerically identical to
 * computeAgentCostsForAgent()'s output for the same agent/products, since
 * topMarkup === markup when chainFactor === 1.
 *
 * Legacy (v1, non-ladder) pricing has no chain concept - an agent's cost is
 * never influenced by a parent there, so "top of chain" degenerates to the
 * agent's own tier cost (identical to computeAgentCostsForAgent's legacy
 * branch).
 */
export async function computeAgentTopOfChainCostsForAgent(
  supabase: ServiceClient,
  agentId: string,
  legacyTier: AgentTier,
  products: ReadonlyArray<{ id: string; base_cost: number }>,
): Promise<Map<string, number>> {
  const costs = new Map<string, number>();
  if (products.length === 0) return costs;
  const context = await resolveAgentPricingContext(supabase, agentId, legacyTier);
  if (context.ladderV2) {
    for (const p of products) {
      costs.set(p.id, applyHouseMarkup(Number(p.base_cost), context.topMarkup));
    }
    return costs;
  }
  const overrides = await getProductOverrideMultipliers(
    supabase,
    products.map((p) => p.id),
    context.tier,
  );
  for (const p of products) {
    const override = overrides.get(p.id) ?? null;
    costs.set(p.id, applyLegacyMultiplier(Number(p.base_cost), override !== null ? override : context.defaultMultiplier));
  }
  return costs;
}

export function applyBulkPrice(base: number, qty: number, bulkPrice: number | null | undefined, bulkThreshold: number | null | undefined): number {
  if (bulkPrice == null) return base;
  const threshold = bulkThreshold && bulkThreshold > 0 ? bulkThreshold : 100;
  if (qty >= threshold) return Number(bulkPrice);
  return base;
}

/**
 * Ensures that an Agent's Sub-Agent commission rate never causes the Agent to
 * lose money on a sale, or allows the Sub-Agent to out-earn the Agent.
 * @param desiredCommissionPct - If provided, checks if this new % is safe. If omitted, checks the Agent's highest existing Sub-Agent commission.
 */
export async function verifyCommissionSafeguard(
  supabase: ServiceClient,
  agentId: string,
  desiredCommissionPct?: number
): Promise<{ safe: true; warning: boolean } | { safe: false; error: string }> {
  // Find highest sub-agent commission if not explicitly provided
  let checkPct = desiredCommissionPct;
  if (checkPct === undefined) {
    const { data: subAgents } = await supabase
      .from('profiles')
      .select('commission_pct, commission_max_pct, is_sub_agent')
      .eq('parent_agent_id', agentId)
      .eq('is_sub_agent', true);
    
    let maxExisting = 0;
    if (subAgents) {
      for (const sa of subAgents) {
        // Find highest possible rate between base and capped bonus
        const val = Math.max(Number(sa.commission_pct || 0), Number(sa.commission_max_pct || 0));
        if (val > maxExisting) maxExisting = val;
      }
    }
    checkPct = maxExisting;
  }

  if (!checkPct || checkPct <= 0) return { safe: true, warning: false };

  // Pull all active agent products
  const { data: products } = await supabase
    .from('agent_products')
    .select('product_id, retail_price')
    .eq('agent_id', agentId)
    .eq('is_visible', true);

  if (!products || products.length === 0) return { safe: true, warning: false };

  // Need legacy tier for the pricing context (legacy v1 fallback path)
  const { data: agentProfile } = await supabase
    .from('profiles')
    .select('tier')
    .eq('id', agentId)
    .maybeSingle();
  const legacyTier = (agentProfile?.tier as AgentTier | null) ?? 'tier_3';

  // Resolve the per-agent pricing constants ONCE and prefetch every product
  // cost in parallel. Previously this loop re-resolved the agent context per
  // product (2-3 sequential queries x N products). Errors are captured per
  // product and re-thrown at that product's position in the ordered loop
  // below, preserving the original sequential semantics (an earlier unsafe
  // product still short-circuits before a later product's error surfaces).
  const context = await resolveAgentPricingContext(supabase, agentId, legacyTier);
  const costResults: Array<{ cost: number } | { err: unknown } | null> = await Promise.all(
    products.map(async (p) => {
      const retail = Number(p.retail_price);
      if (!Number.isFinite(retail) || retail <= 0) return null;
      try {
        return { cost: await computeCostWithContext(supabase, context, p.product_id) };
      } catch (err) {
        return { err };
      }
    })
  );

  let hasWarning = false;

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const retail = Number(p.retail_price);
    if (!Number.isFinite(retail) || retail <= 0) continue;

    const resolved = costResults[i];
    if (resolved == null) continue;
    if ('err' in resolved) throw resolved.err;
    const cost = resolved.cost;

    // Agent Net Profit Pct = (Retail - Cost) / Retail * 100 - Commission Pct
    const grossMarginPct = ((retail - cost) / retail) * 100;
    const netMarginPct = grossMarginPct - checkPct;

    // Hard Rule: Agent MUST make at least 10% Net Profit Margin
    if (netMarginPct < 10) {
      const minRequiredGross = checkPct + 10;
      return { 
        safe: false, 
        error: `Cannot proceed: A commission rate of ${checkPct}% requires you to maintain at least a ${minRequiredGross}% Gross Margin across all active products to ensure a minimum 10% Net Profit. Please raise your retail prices before setting this commission.`
      };
    }

    // Soft Rule: Sub-Agent should not out-earn the Agent
    if (checkPct > netMarginPct) {
      hasWarning = true;
    }
  }

  return { safe: true, warning: hasWarning };
}

export { createServiceClient };
