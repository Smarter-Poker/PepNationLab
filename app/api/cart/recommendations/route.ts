import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { assertSameOrigin } from '@/lib/csrf';
import { resolveCartIdsToProductIds } from '@/lib/cart-ids';

/**
 * POST /api/cart/recommendations
 *
 * Smart cart recommendation engine. Accepts all product IDs currently in cart
 * and returns the best complementary products using a multi-signal approach:
 *
 *   Signal 1 - Compound Stack Compatibility (compounds.best_stacked_with + stack_components)
 *              The compound science library explicitly tags which compounds
 *              stack well together. This is the highest-quality signal.
 *
 *   Signal 2 - Real Co-Purchase Order History (get_copurchase_recommendations RPC)
 *              Products that real researchers actually bought together.
 *              Scores higher the more co-purchase pairs we observe.
 *
 *   Signal 3 - Same Category Companions
 *              Products in the same research area (tissue repair, cognition, etc.)
 *
 *   Signal 4 - BAC Water (always guaranteed to surface if not already in cart)
 *              Every peptide order needs bacteriostatic water for reconstitution.
 *
 * Returns recommendations sorted by score, with a human-readable `reason` field
 * so the UI can explain WHY each item is recommended.
 *
 * Public route - no auth required. Rate limited 60/min/IP.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BAC_WATER_RE = /bacteriostatic\s*water|bac\.?\s*water/i;
const SUPPLY_RE = /syring|acetic\s*acid|alcohol\s*swab/i;

interface ProductBase {
  id: string;
  name: string;
  slug: string | null;
  compound_slug: string | null;
  category: string | null;
  image_url: string | null;
  is_active: boolean | null;
  is_banned: boolean | null;
  unit_size: string | null;
  unit_measure: string | null;
}

interface ScoredRec {
  id: string;
  name: string;
  slug: string | null;
  category: string | null;
  image_url: string | null;
  retail_price?: number;
  unit_size: string | null;
  unit_measure: string | null;
  score: number;
  reason: string;
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const ip = getClientIp(req);
  const rl = await rateLimit({ key: 'cart_recommendations', limit: 60, windowSeconds: 60, identifier: ip });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  }

  let body: { productIds?: unknown; agentSlug?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const productIds = Array.isArray(body?.productIds)
    ? (body.productIds as unknown[])
        .filter((v): v is string => typeof v === 'string' && UUID_RE.test(v))
        .slice(0, 50)
    : [];

  const agentSlug = typeof body?.agentSlug === 'string' ? body.agentSlug.trim().toLowerCase() : null;

  if (productIds.length === 0) {
    return NextResponse.json({ recommendations: [] });
  }

  const supabase = await createServiceClient();

  // Cart ids may be agent_product ids (mobile by-name path) or product ids.
  // Resolve to product ids so compound-stack and co-purchase signals work
  // regardless of which id convention the cart used.
  const { productIds: cartProductIds } = await resolveCartIdsToProductIds(supabase, productIds);

  // ── 0. Resolve agent_id if provided ─────────────────────────────────────────
  let agentId: string | null = null;
  if (agentSlug) {
    const { data: ap } = await supabase
      .from('agent_profiles').select('id').eq('slug', agentSlug).maybeSingle();
    agentId = ap?.id ?? null;
  }

  // ── 1. Fetch cart products + their compound slugs ────────────────────────────
  const { data: cartProducts } = await supabase
    .from('products')
    .select('id, name, slug, compound_slug, category, is_active, is_banned')
    .in('id', cartProductIds);

  const cartProductMap = new Map<string, { name: string; slug: string | null; compound_slug: string | null; category: string | null }>();
  for (const p of cartProducts ?? []) {
    cartProductMap.set(p.id, p);
  }

  const cartIds = new Set(cartProductIds);
  const cartNames = new Set((cartProducts ?? []).map(p => p.name.toLowerCase()));

  // Gather compound slugs from cart for stack lookup
  const cartCompoundSlugs = (cartProducts ?? [])
    .map(p => p.compound_slug)
    .filter((s): s is string => !!s);

  const cartCategories = new Set(
    (cartProducts ?? []).map(p => p.category).filter(Boolean) as string[]
  );

  // ── 2. Fetch compound data for cart items (stack compatibility) ──────────────
  const stackCompatibleSlugs = new Set<string>(); // compound slugs that stack well
  const stackReasons = new Map<string, string>(); // slug → human reason

  if (cartCompoundSlugs.length > 0) {
    const { data: compounds } = await supabase
      .from('compounds')
      .select('slug, display_name, best_stacked_with, stack_components, studied_for, research_areas')
      .in('slug', cartCompoundSlugs);

    for (const compound of compounds ?? []) {
      const name = compound.display_name;

      // best_stacked_with: explicit editorial endorsements
      for (const targetSlug of (compound.best_stacked_with ?? []) as string[]) {
        const clean = targetSlug.toLowerCase().replace(/\s+/g, '-');
        stackCompatibleSlugs.add(clean);
        if (!stackReasons.has(clean)) {
          stackReasons.set(clean, `Stacks well with ${name}`);
        }
      }

      // stack_components: bidirectional stack members
      for (const targetSlug of (compound.stack_components ?? []) as string[]) {
        const clean = targetSlug.toLowerCase().replace(/\s+/g, '-');
        stackCompatibleSlugs.add(clean);
        if (!stackReasons.has(clean)) {
          stackReasons.set(clean, `Part of a known research stack with ${name}`);
        }
      }
    }
  }

  // ── 3. Co-purchase matrix (real order history) ────────────────────────────────
  const copurchaseScores = new Map<string, number>(); // product_id → score

  for (const pid of cartProductIds) {
    try {
      const { data: pairs } = await supabase.rpc('get_copurchase_recommendations', {
        p_product_id: pid,
        p_limit: 20,
      });
      if (Array.isArray(pairs)) {
        pairs.forEach((row: { related_product_id: string }, idx: number) => {
          if (row?.related_product_id && row.related_product_id !== pid && !cartIds.has(row.related_product_id)) {
            // Score by inverse rank: position 0 = 20 pts, position 1 = 19 pts, etc.
            const pts = Math.max(1, 20 - idx);
            copurchaseScores.set(
              row.related_product_id,
              (copurchaseScores.get(row.related_product_id) ?? 0) + pts
            );
          }
        });
      }
    } catch { /* ignore RPC failures */ }
  }

  // ── 4. BAC Water - always surface if not in cart ──────────────────────────────
  let bacWaterId: string | null = null;
  try {
    const { data: bacRow } = await supabase
      .from('products')
      .select('id')
      .or('name.ilike.%bacteriostatic water%,name.ilike.%bac%water%')
      .eq('is_active', true)
      .eq('is_banned', false)
      .maybeSingle();
    if (bacRow?.id && !cartIds.has(bacRow.id)) {
      bacWaterId = bacRow.id;
    }
  } catch { /* ignore */ }

  // ── 5. Find products matching stack-compatible compound slugs ─────────────────
  const stackProductIds = new Set<string>();
  const productStackReason = new Map<string, string>();

  if (stackCompatibleSlugs.size > 0) {
    const slugArray = Array.from(stackCompatibleSlugs);
    const { data: stackProducts } = await supabase
      .from('products')
      .select('id, compound_slug')
      .in('compound_slug', slugArray)
      .eq('is_active', true)
      .eq('is_banned', false)
      .limit(60);

    for (const p of stackProducts ?? []) {
      if (!cartIds.has(p.id) && p.compound_slug) {
        stackProductIds.add(p.id);
        const reason = stackReasons.get(p.compound_slug) ?? 'Known stack companion';
        productStackReason.set(p.id, reason);
      }
    }
  }

  // ── 6. Collect ALL candidate product IDs ──────────────────────────────────────
  const allCandidateIds = new Set<string>();

  if (bacWaterId) allCandidateIds.add(bacWaterId);
  for (const id of stackProductIds) allCandidateIds.add(id);
  for (const id of copurchaseScores.keys()) allCandidateIds.add(id);

  // Fill with same-category if still thin
  if (allCandidateIds.size < 8 && cartCategories.size > 0) {
    try {
      const { data: sameCat } = await supabase
        .from('products')
        .select('id')
        .in('category', Array.from(cartCategories))
        .eq('is_active', true)
        .eq('is_banned', false)
        .limit(20);
      for (const p of sameCat ?? []) {
        if (!cartIds.has(p.id)) allCandidateIds.add(p.id);
      }
    } catch { /* ignore */ }
  }

  // Fill from popular if still thin
  if (allCandidateIds.size < 6) {
    try {
      const { data: pop } = await supabase
        .from('product_popular_60d')
        .select('product_id')
        .order('units', { ascending: false })
        .limit(15);
      for (const p of (pop ?? []) as Array<{ product_id: string }>) {
        if (p.product_id && !cartIds.has(p.product_id)) allCandidateIds.add(p.product_id);
      }
    } catch { /* ignore */ }
  }

  if (allCandidateIds.size === 0) {
    return NextResponse.json({ recommendations: [] });
  }

  // ── 7. Fetch full product details for candidates ──────────────────────────────
  const { data: candidateProducts } = await supabase
    .from('products')
    .select('id, name, slug, compound_slug, category, image_url, is_active, is_banned, unit_size, unit_measure')
    .in('id', Array.from(allCandidateIds));

  // Filter valid products
  const validProducts = (candidateProducts ?? []).filter((p: ProductBase) => {
    if (!p.id) return false;
    if (p.is_active === false || p.is_banned === true) return false;
    if (cartIds.has(p.id)) return false;
    if (cartNames.has(p.name.toLowerCase())) return false;
    if (SUPPLY_RE.test(p.name)) return false; // filter non-essential supplies
    return true;
  });

  // De-duplicate by name (keep first variant found)
  const seenNames = new Set<string>();
  const deduped: ProductBase[] = [];
  for (const p of validProducts) {
    const key = p.name.toLowerCase().replace(/\s*\d+\s*(mg|mcg|ml|iu)\s*$/i, '').trim();
    if (!seenNames.has(key)) {
      seenNames.add(key);
      deduped.push(p);
    }
  }

  // ── 8. Resolve agent pricing if available ────────────────────────────────────
  const agentPriceMap = new Map<string, number>();
  if (agentId && deduped.length > 0) {
    const { data: aps } = await supabase
      .from('agent_products')
      .select('product_id, retail_price, is_visible, is_on_sale, sale_price')
      .eq('agent_id', agentId)
      .in('product_id', deduped.map(p => p.id));
    for (const ap of (aps ?? []) as Array<{ product_id: string; retail_price: number | null; is_visible: boolean | null; is_on_sale: boolean | null; sale_price: number | null }>) {
      if (!ap?.product_id || ap.is_visible === false) continue;
      const raw = ap.is_on_sale && ap.sale_price != null ? Number(ap.sale_price) : Number(ap.retail_price);
      const perVial = Number.isFinite(raw) && raw > 0 ? raw / 10 : 0;
      if (perVial > 0) agentPriceMap.set(ap.product_id, perVial);
    }
  }

  // ── 9. Score every candidate ──────────────────────────────────────────────────
  const scored: ScoredRec[] = deduped.map(p => {
    let score = 0;
    let reason = 'Popular with researchers';

    // BAC Water: always top slot, give it a huge boost
    if (BAC_WATER_RE.test(p.name)) {
      score += 1000;
      reason = 'Essential for reconstitution';
    }

    // Stack compatibility signal (compound science data)
    if (stackProductIds.has(p.id)) {
      score += 500;
      reason = productStackReason.get(p.id) ?? reason;
    }

    // Co-purchase order history signal
    const copurchasePts = copurchaseScores.get(p.id) ?? 0;
    if (copurchasePts > 0) {
      score += copurchasePts * 10; // scale up
      if (score < 500) reason = 'Frequently bought together';
    }

    // Same category bonus
    if (cartCategories.has(p.category ?? '')) {
      score += 50;
    }

    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      category: p.category,
      image_url: p.image_url,
      unit_size: p.unit_size,
      unit_measure: p.unit_measure,
      score,
      reason,
      ...(agentPriceMap.has(p.id) ? { retail_price: agentPriceMap.get(p.id)! } : {}),
    };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Return top 8
  const recommendations = scored.slice(0, 8);

  return NextResponse.json({ recommendations });
}
