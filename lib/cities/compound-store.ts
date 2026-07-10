/**
 * compound-store.ts
 *
 * Server-side resolver that returns the LIVE house-store product card for a
 * given research compound slug, so compound-city landing pages
 * (/peptides/{state}/{city}/{compoundSlug}) show EXACTLY the same product,
 * size, and price as the default store (/researchstore) and the city page's
 * Top 10 grid.
 *
 * The display math is identical to lib/cities/top10-server.ts (per-vial price
 * = retail_price / 10, sale-aware), so a price shown here always matches what
 * the shopper sees after the ?product= deep link. Prices track admin changes
 * on the next ISR revalidation (compound pages export `revalidate`).
 *
 * Products are matched by `products.compound_slug` (identical to the research
 * library slug for every curated compound in lib/cities/city-compounds.ts).
 * On any failure this returns an empty map and callers render without a live
 * price card, never crashing the page.
 */

import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/server';
import { getProductImage } from '@/lib/categoryImage';
import { DEFAULT_STORE_SLUG } from '@/lib/default-store';

export interface CompoundStoreCard {
  /** products.id of the default variant - the store grid opens ?product=<id>. */
  productId: string;
  /** Base product name with trailing parenthetical stripped, e.g. "BPC 157". */
  name: string;
  /** Parenthetical portion of the store name, if any. */
  subtitle: string | null;
  /** e.g. "10mg Vials" - same format as the store card. */
  sizeLabel: string;
  /** Per-vial display price (retail / 10, sale-aware), same math as the store card. */
  price: number;
  /** Pre-sale per-vial price when the default variant is on sale, else null. */
  originalPrice: number | null;
  /** Resolved product image (custom > master > category fallback). */
  image: string;
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
    compound_slug: string | null;
  } | null;
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

async function fetchCompoundStoreCards(): Promise<Record<string, CompoundStoreCard>> {
  try {
    const supabase = createAdminClient();

    const { data: store } = await supabase
      .from('agent_profiles')
      .select('id')
      .eq('slug', DEFAULT_STORE_SLUG)
      .maybeSingle();
    if (!store) return {};

    const { data } = await supabase
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
          compound_slug
        )
      `
      )
      .eq('agent_id', store.id)
      .eq('is_visible', true);

    const rows = (data ?? []) as unknown as StoreProductRow[];
    if (rows.length === 0) return {};

    // Group visible variants by their compound_slug.
    const bySlug = new Map<string, StoreProductRow[]>();
    for (const row of rows) {
      const slug = row.products?.compound_slug;
      if (!slug) continue;
      if (!bySlug.has(slug)) bySlug.set(slug, []);
      bySlug.get(slug)!.push(row);
    }

    const out: Record<string, CompoundStoreCard> = {};
    for (const [slug, variants] of bySlug.entries()) {
      const v = pickDefaultVariant(variants);
      if (!v) continue;

      let rawName = v.products?.name ?? 'Research Compound';
      rawName = rawName.replace(/\s*Research Grade$/i, '');
      if (rawName.toUpperCase() === 'BPC-157') rawName = 'BPC 157';

      const category = v.products?.category || 'Other';
      const image = getProductImage(
        v.custom_image_url ?? v.products?.image_url ?? null,
        category,
        rawName
      );

      const size = v.products?.unit_size || '10';
      const measure = v.products?.unit_measure || 'mg';
      const perVialBase = v.retail_price / 10;
      const onSale = Boolean(v.is_on_sale && v.sale_price);
      const perVialDisplay = onSale ? (v.sale_price as number) / 10 : perVialBase;

      const base = rawName.replace(/\s*\(.*\)\s*$/, '').trim();
      const parenMatch = rawName.match(/\(([^()]*)\)\s*$/);

      out[slug] = {
        productId: v.product_id,
        name: base,
        subtitle: parenMatch ? parenMatch[1] : null,
        sizeLabel: `${size}${measure} Vials`,
        price: perVialDisplay,
        originalPrice: onSale ? perVialBase : null,
        image,
      };
    }

    return out;
  } catch {
    return {};
  }
}

/** Deduped per render pass; compound pages revalidate via ISR so prices track
 *  admin changes. Keyed by compound_slug. */
export const getCompoundStoreCards = cache(fetchCompoundStoreCards);
