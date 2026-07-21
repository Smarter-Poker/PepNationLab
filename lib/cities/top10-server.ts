/**
 * top10-server.ts
 *
 * Server-side resolver for the storefront's "Top 10 Best Peptides" card so
 * that CITY LANDING PAGES show EXACTLY the same products, names, sizes, and
 * prices as the default store (/researchstore).
 *
 * This mirrors the client-side ranking in components/AgentStorefrontGrid.tsx
 * (getProductRankScore with activeCardIndex === 1 and no search query):
 *   1. In-stock bonus (+50000) using agent inventory RPC + master counts
 *   2. Stack premium bonus (+20000)
 *   3. Popularity ranking from POPULAR_ORDER (+1000 - rank)
 *   4. Compound evidence tier + PubMed citation bonuses
 * Then dedupe by base name (parenthetical stripped) and slice to 10.
 *
 * Prices come straight from agent_products.retail_price / sale_price, so any
 * admin price change flows to the city pages on the next ISR revalidation
 * (city pages export `revalidate`). If anything fails, callers fall back to
 * the static FEATURED_PEPTIDES list so city pages never render empty.
 *
 * KEEP IN SYNC: POPULAR_ORDER below must match the list of the same name in
 * components/AgentStorefrontGrid.tsx.
 */

import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/server';
import { getProductImage } from '@/lib/categoryImage';
import { DEFAULT_STORE_SLUG } from '@/lib/default-store';
import { getCompoundsBySlugs } from '@/lib/compounds-server';

export interface StoreTop10Item {
  /** Base product name with trailing parenthetical stripped, e.g. "The Wolverine Stack" */
  name: string;
  /** Parenthetical portion of the store name, e.g. "BPC 10mg + TB 10mg" */
  subtitle: string | null;
  /** e.g. "10mg Vials" - same format as the store card */
  sizeLabel: string;
  /** Per-vial display price, same math as the store card (retail / 10, sale-aware) */
  price: number;
  /** Pre-sale per-vial price when the default variant is on sale, else null */
  originalPrice: number | null;
  /** Resolved product image (custom > master > category fallback) */
  image: string;
  /** products.id of the default variant - the store grid opens ?product=<id> */
  productId: string;
}

interface StoreProductRow {
  id: string;
  product_id: string;
  custom_image_url: string | null;
  retail_price: number;
  is_on_sale: boolean | null;
  sale_price: number | null;
  products: {
    name: string;
    image_url: string | null;
    category: string | null;
    unit_size: string | null;
    unit_measure: string | null;
    inventory_count: number | null;
    compound_slug: string | null;
  } | null;
}

const POPULAR_ORDER: string[] = [
  'Tirzepatide',
  'Retatrutide',
  'KLOW STACK (TB10+BPC10+GHK50+KPV10)',
  'Glow Stack (TB10 + BPC10 + GHK50)',
  'BPC 157',
  'Limitless Stack (Semax + Selank)',
  'Semaglutide',
  'The Wolverine Stack (BPC 10mg + TB 10mg)',
  'The Wolverine Stack (BPC 5mg + TB 5mg)',
  'TB500 (Thymosin B4 Acetate)',
  'Sermorelin Acetate',
  'Shred Stack (Tirzepatide + AOD9604)',
  'CJC-1295 Without DAC',
  'CJC-1295 With DAC',
  'GHK-CU',
  'AOD9604',
  'BAC Water',
  'Bacteriostatic Water',
  'The Appetite Crusher Stack (Cagrilintide 5mg + Semaglutide 5mg)',
  'GH Synergy Stack (CJC 5mg + IPA 5mg)',
  'The Furnace Stack (L-Carnitine Blend)',
  'The Lipolysis Stack (Lemon Bottle)',
  'Ipamorelin',
  'NAD+',
  'KPV',
  'Semax',
  'Selank',
];

// Explicit Top 10 removals (owner-curated 2026-07-20). Base names (trailing
// parenthetical stripped, UPPERCASE) that must NEVER appear in the Top 10 card,
// even though stacks otherwise get a large ranking premium. Removing these frees
// slots so Tirzepatide + Retatrutide (already ranked next) surface in the Top 10.
const TOP10_EXCLUDE = new Set<string>([
  'THE FURNACE STACK',
  'THE LIPOLYSIS STACK',
]);


const isBacWaterItem = (name: string | null | undefined, slug: string | null | undefined) =>
  slug === 'bac-water' || /bac\.?\s*water/i.test(name || '');

interface Group {
  name: string;
  category: string;
  imageUrl: string;
  variants: StoreProductRow[];
  popularity: number;
  compoundSlug: string | null;
}

function pickDefaultVariant(variants: StoreProductRow[]): StoreProductRow {
  const ten = variants.find((v) => parseFloat(v.products?.unit_size || '0') === 10);
  if (ten) return ten;
  const above = variants
    .filter((v) => parseFloat(v.products?.unit_size || '0') >= 10)
    .sort(
      (a, b) =>
        parseFloat(a.products?.unit_size || '0') - parseFloat(b.products?.unit_size || '0')
    );
  if (above.length > 0) return above[0];
  return variants[variants.length - 1] ?? variants[0];
}

async function fetchStoreTop10(): Promise<StoreTop10Item[]> {
  try {
    const supabase = createAdminClient();

    const { data: store } = await supabase
      .from('agent_profiles')
      .select('id')
      .eq('slug', DEFAULT_STORE_SLUG)
      .maybeSingle();
    if (!store) return [];

    const [productsResult, inventoryResult] = await Promise.all([
      supabase
        .from('agent_products')
        .select(
          `
          id,
          product_id,
          custom_image_url,
          retail_price,
          is_on_sale,
          sale_price,
          products (
            name,
            image_url,
            category,
            unit_size,
            unit_measure,
            inventory_count,
            compound_slug
          )
        `
        )
        .eq('agent_id', store.id)
        .eq('is_visible', true),
      supabase.rpc('agent_inventory_for_storefront', { p_slug: DEFAULT_STORE_SLUG }),
    ]);

    const rows = (productsResult.data ?? []) as unknown as StoreProductRow[];
    if (rows.length === 0) return [];

    const inventoryMap: Record<string, number> = {};
    for (const r of (inventoryResult.data ?? []) as Array<{ product_id: string; stock_count: number }>) {
      inventoryMap[r.product_id] = r.stock_count;
    }

    // ── Group variants by normalized name (same as the store grid) ──────────
    const map = new Map<string, Group>();
    for (const item of rows) {
      let rawName = item.products?.name ?? 'Research Compound';
      rawName = rawName.replace(/\s*Research Grade$/i, '');
      if (rawName.toUpperCase() === 'BPC-157') rawName = 'BPC 157';
      const key = rawName.toUpperCase();

      if (!map.has(key)) {
        map.set(key, {
          name: rawName,
          category: item.products?.category || 'Other',
          imageUrl: getProductImage(
            item.custom_image_url ?? item.products?.image_url ?? null,
            item.products?.category || 'Other',
            rawName
          ),
          variants: [],
          popularity: POPULAR_ORDER.indexOf(rawName),
          compoundSlug: item.products?.compound_slug ?? null,
        });
      }
      map.get(key)!.variants.push(item);
    }
    const groups = Array.from(map.values());
    for (const g of groups) {
      if (g.popularity === -1) g.popularity = 999;
      g.variants.sort(
        (a, b) =>
          parseFloat(a.products?.unit_size || '0') - parseFloat(b.products?.unit_size || '0')
      );
    }

    // ── Compound evidence data for the ranking bonuses ─────────────────────
    const compoundsBySlug = await getCompoundsBySlugs(groups.map((g) => g.compoundSlug));

    // ── Rank exactly like the store's Top 10 card (index 1, no search) ───────
    const score = (g: Group): number => {
      let s = 0;
      const inStock = g.variants.some((v) => {
        const agentCount = Math.max(0, Number(inventoryMap[v.product_id] ?? 0));
        const masterCount = Math.max(0, Number(v.products?.inventory_count ?? 0));
        return agentCount > 0 || masterCount > 0;
      });
      if (inStock) s += 50000;

      const lower = g.name.toLowerCase();
      const isStack =
        g.category === 'Peptide Stacks' ||
        lower.includes('stack') ||
        lower.includes('bundle') ||
        lower.includes('klow');
      if (isStack) s += 20000;

      if (g.popularity !== 999) {
        s += (1000 - g.popularity) * 1000000;
      } else {
        s += 1000 - g.popularity;
      }

      const compound = g.compoundSlug ? compoundsBySlug[g.compoundSlug] : null;
      if (compound) {
        if (compound.evidence_tier === 'approved_drug') s += 2000;
        else if (compound.evidence_tier === 'investigational') s += 1000;
        else if (compound.evidence_tier === 'preclinical') s += 200;
        if (compound.pubmed_citation_count) {
          s += Math.min(500, Math.log10(compound.pubmed_citation_count + 1) * 100);
        }
      }
      return s;
    };

    const ranked = groups.sort((a, b) => score(b) - score(a));

    // Dedupe by base name (parenthetical stripped), same as the store grid
    const seen = new Map<string, Group>();
    for (const g of ranked) {
      const base = g.name.replace(/\s*\(.*\)\s*$/, '').trim().toUpperCase();
      if (TOP10_EXCLUDE.has(base)) continue;
      if (!seen.has(base)) seen.set(base, g);
    }
    const top = Array.from(seen.values()).slice(0, 10);

    // ── Shape for the city page card (identical display math to the store) ─
    return top.map((g) => {
      const v = pickDefaultVariant(g.variants);
      const size = v.products?.unit_size || '10';
      const measure = v.products?.unit_measure || 'mg';
      const perVialBase = v.retail_price / 10;
      const onSale = Boolean(v.is_on_sale && v.sale_price);
      const perVialDisplay = onSale ? (v.sale_price as number) / 10 : perVialBase;
      const isBW = isBacWaterItem(g.name, v.products?.compound_slug);

      const base = g.name.replace(/\s*\(.*\)\s*$/, '').trim();
      const parenMatch = g.name.match(/\(([^()]*)\)\s*$/);

      return {
        name: base,
        subtitle: parenMatch ? parenMatch[1] : null,
        sizeLabel: isBW ? `10x ${size}${measure} Vials` : `${size}${measure} Vials`,
        price: isBW ? perVialDisplay * 10 : perVialDisplay,
        originalPrice: onSale ? (isBW ? perVialBase * 10 : perVialBase) : null,
        image: g.imageUrl,
        productId: v.product_id,
      };
    });
  } catch {
    // Never break a city page over a catalog fetch - callers fall back to
    // the static FEATURED_PEPTIDES list.
    return [];
  }
}

/** Deduped per render pass; city pages revalidate via ISR so prices track admin changes. */
export const getStoreTop10 = cache(fetchStoreTop10);
