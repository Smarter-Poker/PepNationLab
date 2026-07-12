// Shared bundle model + storefront resolution.
//
// Bundles live on `agent_profiles.bundles_config` (JSONB array). A bundle is a
// curated set of 2-5 catalog products a store owner (agent / super_agent /
// admin) offers together at an optional discount. This module is the single
// source of truth for the stored shape and for how bundles "cascade" onto a
// given storefront:
//
//   - scope 'self'     -> only the owning store
//   - scope 'downline' -> the owning super-agent's store AND every sub-agent
//                         whose profiles.parent_agent_id points at that super-agent
//   - scope 'global'   -> every storefront (admin / house-store only)
//
// Pricing is NEVER stored on the bundle. The displayed and charged price is
// always the sum of each member product's live per-vial price on THAT store,
// minus `discount_percent`. This keeps a cascaded bundle correct on every
// store regardless of per-store pricing, and keeps the checkout authoritative.

import { DEFAULT_STORE_SLUG } from '@/lib/default-store';

export type BundleScope = 'self' | 'downline' | 'global';

export interface StoredBundle {
  id: string;
  name: string;
  /** Short marketing tagline shown below the bundle name (like a peptide popular name) */
  tagline: string;
  description: string;
  image_url: string | null;
  product_ids: string[];
  discount_percent: number;
  /** Flat custom price override — when set, overrides discount_percent entirely */
  custom_price: number | null;
  is_active: boolean;
  scope: BundleScope;
  created_by: string | null;
  created_at: string;
}

export const MIN_BUNDLE_PRODUCTS = 2;
export const MAX_BUNDLE_PRODUCTS = 5;
export const MAX_BUNDLE_DISCOUNT = 90;

/** Clamp a discount to a whole percentage in [0, MAX_BUNDLE_DISCOUNT]. */
export function clampDiscount(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.min(Math.max(Math.round(v), 0), MAX_BUNDLE_DISCOUNT);
}

/** Coerce one raw JSONB entry into a StoredBundle, or null if unusable. */
export function normalizeBundle(raw: unknown): StoredBundle | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === 'string' ? r.id : null;
  const name = typeof r.name === 'string' ? r.name : null;
  if (!id || !name) return null;
  const product_ids = Array.isArray(r.product_ids)
    ? r.product_ids.filter((x): x is string => typeof x === 'string')
    : [];
  const scope: BundleScope =
    r.scope === 'downline' || r.scope === 'global' ? r.scope : 'self';
  return {
    id,
    name,
    tagline: typeof r.tagline === 'string' ? r.tagline : '',
    description: typeof r.description === 'string' ? r.description : '',
    image_url: typeof r.image_url === 'string' && r.image_url ? r.image_url : null,
    product_ids,
    discount_percent: clampDiscount(r.discount_percent),
    custom_price: typeof r.custom_price === 'number' && r.custom_price > 0 ? Math.round(r.custom_price * 100) / 100 : null,
    is_active: r.is_active !== false,
    scope,
    created_by: typeof r.created_by === 'string' ? r.created_by : null,
    created_at: typeof r.created_at === 'string' ? r.created_at : '',
  };
}

/** Normalize a whole bundles_config array. */
export function normalizeBundleList(raw: unknown): StoredBundle[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(normalizeBundle)
    .filter((b): b is StoredBundle => b !== null);
}

// Loose structural type for the Supabase client so we neither couple to the
// generated Database types (which don't describe bundles_config) nor trigger
// deep-generic instantiation when a fully-typed client is passed in. The query
// builder is a thenable, not a real Promise, so a precise shape here fails to
// match; `any` on `from` keeps the chain assignable from any Supabase client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MinimalClient = { from: (table: string) => any };

async function readBundlesConfig(
  supabase: MinimalClient,
  by: 'id' | 'slug',
  value: string,
): Promise<StoredBundle[]> {
  const { data } = await supabase
    .from('agent_profiles')
    .select('bundles_config')
    .eq(by, value)
    .maybeSingle();
  return normalizeBundleList((data as { bundles_config?: unknown } | null)?.bundles_config);
}

/**
 * The effective, active bundles that should render (and be honored at checkout)
 * for the store owned by `storeAgentId`:
 *   own bundles (any scope) + parent super-agent 'downline' bundles + house
 *   'global' bundles. Deduped by id, inactive dropped. Order is own -> downline
 *   -> global so a store's own bundles win the dedup.
 *
 * Member products are NOT resolved here; callers map product_ids against the
 * store's own catalog (and hide bundles that lose too many members).
 */
export async function getEffectiveBundlesForStore(
  supabase: MinimalClient,
  storeAgentId: string,
): Promise<StoredBundle[]> {
  const [own, ownerProfileRes, houseGlobal] = await Promise.all([
    readBundlesConfig(supabase, 'id', storeAgentId),
    supabase
      .from('profiles')
      .select('parent_agent_id')
      .eq('id', storeAgentId)
      .maybeSingle(),
    readBundlesConfig(supabase, 'slug', DEFAULT_STORE_SLUG),
  ]);

  const parentId = (ownerProfileRes as { data: { parent_agent_id?: string | null } | null })
    ?.data?.parent_agent_id;

  let downline: StoredBundle[] = [];
  if (parentId && parentId !== storeAgentId) {
    const parentBundles = await readBundlesConfig(supabase, 'id', parentId);
    downline = parentBundles.filter((b) => b.scope === 'downline');
  }

  const out: StoredBundle[] = [];
  const seen = new Set<string>();
  const add = (list: StoredBundle[]) => {
    for (const b of list) {
      if (!b.is_active || seen.has(b.id)) continue;
      seen.add(b.id);
      out.push(b);
    }
  };
  add(own);
  add(downline);
  add(houseGlobal.filter((b) => b.scope === 'global'));
  return out;
}
