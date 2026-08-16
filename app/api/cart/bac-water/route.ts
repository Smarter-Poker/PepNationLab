import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { assertSameOrigin } from '@/lib/csrf';
import { resolveCartIdsToProductIds } from '@/lib/cart-ids';

/**
 * POST /api/cart/bac-water
 *
 * Given a list of product IDs currently in the cart, calculates exactly how
 * many vials of Bacteriostatic Water are needed for reconstitution.
 *
 * Reconstitution logic:
 *   Each lyophilized peptide vial's BAC water need is derived from its labeled
 *   strength (~5 mg/mL convention, 1-5 mL/vial) rather than a flat per-vial
 *   amount, then summed across the cart (see reconstitutionMlPerVial /
 *   lineReconstitutionMl below).
 *   Products whose compound_slug maps to evidence_tier = 'supply', or whose
 *   form is pre-mixed/implant, are excluded (they don't need reconstitution).
 *   Cosmetic-tier lyophilized peptides (GHK-Cu, AHK-Cu, SNAP-8) DO need BAC
 *   water and are counted. BAC water products themselves are excluded.
 *   Acetic-acid peptides (IGF class) need acetic acid, not BAC water, and are
 *   excluded from this calculation.
 *   Vials needed = ceil(totalMlNeeded / actualBacVialSizeMl).
 *
 * Returns:
 *   {
 *     vialsNeeded: number,               // how many 10 mL BAC water vials to order
 *     totalMlNeeded: number,             // raw mL calculated
 *     peptideCount: number,              // number of peptide line items (not qty)
 *     totalPeptideVials: number,         // total individual vials across all items
 *     bacWaterProduct: { ... } | null,   // BAC water product to add to cart
 *     alreadyInCart: boolean,            // true if BAC water is already in cart
 *     alreadyInCartQty: number,          // how many are already in cart
 *   }
 *
 * Public route - no auth required. Rate limited 60/min/IP.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BAC_WATER_RE = /bacteriostatic\s*water|bac\.?\s*water/i;
const SUPPLY_CATEGORY_RE = /supply|supplies|equipment|lab\s*supply/i;
const ACETIC_ACID_RE = /acetic\s*acid/i;

// Default volume per BAC water vial (mL) when the product size can't be parsed.
const DEFAULT_BAC_VIAL_ML = 10;

// Smart reconstitution volume (mL) for ONE physical research vial, derived from
// its labeled strength. There is no single universally "correct" volume (it
// depends on the researcher's target concentration), so we apply the widely
// used ~5 mg/mL convention for lyophilized peptides: minimum 1 mL, capped at
// 5 mL per vial, rounded up to the nearest 0.5 mL. IU products (HCG/HMG)
// reconstitute in ~1-3 mL; pre-mixed liquids (measured in ml) need none.
function reconstitutionMlPerVial(size: number, measure: string | null): number {
  const m = (measure || 'mg').toLowerCase();
  if (m.includes('ml')) return 0;
  if (m.includes('iu')) return Math.min(3, Math.max(1, Math.ceil(size / 5000)));
  if (!Number.isFinite(size) || size <= 0) return 2;
  return Math.min(5, Math.max(1, Math.ceil((size / 5) * 2) / 2));
}

// BAC water (mL) to reconstitute one whole cart LINE, accounting for multi-vial
// stacks whose name contains '+' (e.g. "BPC 10mg + TB 10mg" ships as separate
// vials, so the labeled total mg is split across the component vials).
function lineReconstitutionMl(
  name: string,
  unitSize: string | null,
  unitMeasure: string | null,
  qty: number,
): number {
  const totalMg = parseFloat(String(unitSize ?? ''));
  const componentCount = name && name.includes('+') ? name.split('+').length : 1;
  const perVialSize =
    Number.isFinite(totalMg) && totalMg > 0 ? totalMg / componentCount : totalMg;
  const perVialMl = reconstitutionMlPerVial(perVialSize, unitMeasure);
  return perVialMl * componentCount * qty;
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const ip = getClientIp(req);
  const rl = await rateLimit({ key: 'cart_bac_water', limit: 60, windowSeconds: 60, identifier: ip });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  }

  let body: { productIds?: unknown; quantities?: unknown; agentSlug?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const productIds = Array.isArray(body?.productIds)
      ? (body.productIds as unknown[])
          .filter((v): v is string => typeof v === 'string' && UUID_RE.test(v))
          .slice(0, 50)
      : [];

    // quantities map: productId -> quantity in cart
    const quantities: Record<string, number> = {};
    if (body?.quantities && typeof body.quantities === 'object' && !Array.isArray(body.quantities)) {
      for (const [k, v] of Object.entries(body.quantities as Record<string, unknown>)) {
        if (UUID_RE.test(k) && typeof v === 'number' && v > 0) {
          quantities[k] = Math.floor(v);
        }
      }
    }

    const agentSlug = typeof body?.agentSlug === 'string' ? body.agentSlug.trim().toLowerCase() : null;

    if (productIds.length === 0) {
      return NextResponse.json({
        vialsNeeded: 0,
        totalMlNeeded: 0,
        peptideCount: 0,
        totalPeptideVials: 0,
        bacWaterProduct: null,
        alreadyInCart: false,
        alreadyInCartQty: 0,
      });
    }

    const supabase = await createServiceClient();

    // Cart ids may be agent_product ids (mobile by-name path) or product ids.
    // Resolve to product ids and remap the quantities map (keyed by the original
    // cart id) so peptide-vial counting works regardless of which id the cart used.
    const { productIds: resolvedProductIds, inputToProduct } =
      await resolveCartIdsToProductIds(supabase, productIds);
    const productQuantities: Record<string, number> = {};
    for (const [inId, q] of Object.entries(quantities)) {
      const pid = inputToProduct.get(inId) ?? inId;
      productQuantities[pid] = (productQuantities[pid] ?? 0) + q;
    }

    // -- Fetch products ---------------------------------------------------------
    const { data: products } = await supabase
      .from('products')
      .select('id, name, category, compound_slug, is_active, is_banned, unit_size, unit_measure')
      .in('id', resolvedProductIds);

    // -- Resolve compound evidence tiers for compound-linked products -----------
    const compoundSlugsToCheck = (products ?? [])
      .map(p => p.compound_slug)
      .filter((s): s is string => !!s);

    const supplyCompoundSlugs = new Set<string>();
    if (compoundSlugsToCheck.length > 0) {
      const { data: compounds } = await supabase
        .from('compounds')
        .select('slug, evidence_tier, handling')
        .in('slug', compoundSlugsToCheck);

      for (const c of compounds ?? []) {
        // Only 'supply' compounds (BAC water, acetic acid, lab supplies) are
        // categorically non-reconstitutable. 'cosmetic' tier is NOT excluded
        // here: GHK-Cu / AHK-Cu / SNAP-8 are lyophilized mg powders whose
        // diluent is bacteriostatic/sterile water, so they genuinely need BAC
        // water. Pre-mixed cosmetic liquids (Lemon Bottle) are still excluded
        // below via their form, and any 'ml' product contributes 0 mL anyway.
        if (c.evidence_tier === 'supply') {
          supplyCompoundSlugs.add(c.slug);
        }
        // Pre-mixed aqueous products (Lemon Bottle, Lipo-C, ...) ship as ready
        // liquids, and implants need no diluent. Both must not inflate the
        // suggestion. NOTE: do NOT match bare 'solution' -- forms like PT-141's
        // "solution (autoinjector) or lyophilized" still need BAC water for the
        // lyophilized form.
        const form = String((c.handling as { form?: unknown } | null)?.form ?? '');
        if (/pre-?mixed|\bimplant\b/i.test(form)) {
          supplyCompoundSlugs.add(c.slug);
        }
      }
    }

    // -- Identify BAC water vs peptides ----------------------------------------
    let alreadyInCart = false;
    let alreadyInCartQty = 0;

    let peptideCount = 0;
    let totalPeptideVials = 0;
    let totalMlRaw = 0;

    for (const p of products ?? []) {
      if (!p.id) continue;
      // Banned products are excluded. DEACTIVATED ones are NOT: a product that
      // is in a live cart is being sold, and skipping it here silently zeroed
      // the whole estimate and made both checkout panels disappear.
      if (p.is_banned === true) continue;

      const isBacWater = BAC_WATER_RE.test(p.name);
      const isAceticAcid = ACETIC_ACID_RE.test(p.name);
      const isSupplyCategory = p.category ? SUPPLY_CATEGORY_RE.test(p.category) : false;
      const isSupplyCompound = p.compound_slug ? supplyCompoundSlugs.has(p.compound_slug) : false;

      if (isBacWater) {
        alreadyInCart = true;
        alreadyInCartQty = productQuantities[p.id] ?? 1;
        continue;
      }

      // Skip non-peptide products
      if (isAceticAcid || isSupplyCategory || isSupplyCompound) continue;

      // Count as a peptide vial and add its strength-based reconstitution volume.
      const qty = productQuantities[p.id] ?? 1;
      peptideCount += 1;
      totalPeptideVials += qty;
      totalMlRaw += lineReconstitutionMl(p.name, p.unit_size, p.unit_measure, qty);
    }

    // SILENT-VANISH FLOOR.
    // Both checkout panels render only when vialsNeeded > 0, so any cart whose
    // items all resolve to 0 mL made the entire BAC water recommendation
    // disappear with no explanation -- indistinguishable from the feature being
    // broken, and the exact symptom reported repeatedly. A cart holding real
    // research vials always gets a recommendation: when the strength-based sum
    // comes to nothing (mislabelled unit_measure, a stale duplicate SKU, a
    // missing strength), fall back to the same conservative ~2 mL per vial the
    // client uses before this endpoint answers. Carts that legitimately contain
    // only diluents or supplies never reach here -- those are filtered above and
    // leave totalPeptideVials at 0.
    if (totalMlRaw <= 0 && totalPeptideVials > 0) {
      totalMlRaw = totalPeptideVials * 2;
    }

    // Aggregate mL needed for the WHOLE order, rounded up to a clean 0.5 mL.
    const totalMlNeeded = Math.ceil(totalMlRaw * 2) / 2;
    // Provisional vial count against the default 10 mL vial; refined below once
    // the actual BAC water product (and its real size) is resolved.
    let vialsNeeded = totalMlNeeded > 0 ? Math.ceil(totalMlNeeded / DEFAULT_BAC_VIAL_ML) : 0;

    // -- Fetch the BAC water product to add ------------------------------------
    let bacWaterProduct: {
      id: string;
      name: string;
      slug: string | null;
      category: string | null;
      image_url: string | null;
      retail_price?: number;
      unit_size: string | null;
      unit_measure: string | null;
    } | null = null;

    // Resolve agent for pricing
    let agentId: string | null = null;
    if (agentSlug) {
      const { data: ap } = await supabase
        .from('agent_profiles').select('id').eq('slug', agentSlug).maybeSingle();
      agentId = ap?.id ?? null;
    }

    try {
      // Find the canonical BAC water product (prefer the one already in cart if identified)
      const bacQuery = supabase
        .from('products')
        .select('id, name, slug, category, image_url, unit_size, unit_measure')
        .or('name.ilike.%bacteriostatic water%,name.ilike.%bac%water%')
        .eq('is_active', true)
        .eq('is_banned', false);

      // Prefer 10 mL variant
      const { data: bacProducts } = await bacQuery.limit(10);

      if (bacProducts && bacProducts.length > 0) {
        // Prefer 10 mL variant - check by unit_size number or name keyword
        const preferredBac = bacProducts.find(p =>
          p.unit_size === '10' ||
          p.unit_size === '10ml' ||
          p.name.toLowerCase().includes('10 ml') ||
          p.name.toLowerCase().includes('10ml')
        ) ?? bacProducts[0];

        // Refine the vial count using the resolved BAC water product's real
        // size, so the recommendation matches the exact product being added.
        const preferredBacSizeMl =
          parseFloat(String(preferredBac.unit_size ?? '')) || DEFAULT_BAC_VIAL_ML;
        vialsNeeded = totalMlNeeded > 0 ? Math.ceil(totalMlNeeded / preferredBacSizeMl) : 0;

        bacWaterProduct = {
          id: preferredBac.id,
          name: preferredBac.name,
          slug: preferredBac.slug,
          category: preferredBac.category,
          image_url: preferredBac.image_url,
          unit_size: preferredBac.unit_size,
          unit_measure: preferredBac.unit_measure,
        };

        // Get agent pricing for BAC water
        if (agentId) {
          const { data: apRow } = await supabase
            .from('agent_products')
            .select('retail_price, is_visible, is_on_sale, sale_price')
            .eq('agent_id', agentId)
            .eq('product_id', preferredBac.id)
            .maybeSingle();
          if (apRow && apRow.is_visible !== false) {
            const raw = apRow.is_on_sale && apRow.sale_price != null
              ? Number(apRow.sale_price)
              : Number(apRow.retail_price);
            const perVial = Number.isFinite(raw) && raw > 0 ? raw / 10 : 0;
            if (perVial > 0) bacWaterProduct.retail_price = perVial;
          }
        } else {
          // Guest/public price: use researchstore's catalog price - never the cheapest
          // across all agents, which could be another agent's private pricing.
          const { data: houseAgent } = await supabase
            .from('agent_profiles')
            .select('id')
            .eq('slug', 'researchstore')
            .eq('is_active', true)
            .maybeSingle();
          if (houseAgent?.id) {
            const { data: pubRow } = await supabase
              .from('agent_products')
              .select('retail_price')
              .eq('agent_id', houseAgent.id)
              .eq('product_id', preferredBac.id)
              .maybeSingle();
            if (pubRow?.retail_price) {
              bacWaterProduct.retail_price = Number(pubRow.retail_price) / 10;
            }
          }
        }
      }
    } catch (bacErr) {
      console.error('[cart/bac-water] BAC water lookup failed (best-effort):', bacErr);
    }

    return NextResponse.json({
      vialsNeeded,
      totalMlNeeded,
      peptideCount,
      totalPeptideVials,
      bacWaterProduct,
      alreadyInCart,
      alreadyInCartQty,
    });
  } catch (err) {
    console.error('[cart/bac-water] POST error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
