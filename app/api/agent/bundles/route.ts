
import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgentOrAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { randomUUID } from 'crypto';
import {
  type StoredBundle,
  type BundleScope,
  MIN_BUNDLE_PRODUCTS,
  MAX_BUNDLE_PRODUCTS,
  clampDiscount,
  normalizeBundleList,
} from '@/lib/bundles';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface CallerContext {
  id: string;
  isSubAgent: boolean;
  canDownline: boolean;
  canGlobal: boolean;
}

/**
 * Resolve what the calling store owner is allowed to do with bundle scopes.
 * Regular agents may only create store-local ('self') bundles. Super agents may
 * additionally cascade to their sub-agents ('downline'). Admin (house store) may
 * push a bundle to every storefront ('global'). Sub-agents cannot create at all.
 */
async function resolveCaller(
  svc: Awaited<ReturnType<typeof createServiceClient>>,
  userId: string,
  isAdmin: boolean,
): Promise<CallerContext> {
  const { data } = await svc
    .from('profiles')
    .select('role, is_super_agent, is_sub_agent')
    .eq('id', userId)
    .maybeSingle();
  const row = (data ?? {}) as { role?: string | null; is_super_agent?: boolean | null; is_sub_agent?: boolean | null };
  const isSuper = row.is_super_agent === true || row.role === 'super_agent';
  const admin = isAdmin || row.role === 'admin';
  return {
    id: userId,
    isSubAgent: row.is_sub_agent === true,
    canDownline: isSuper || admin,
    canGlobal: admin,
  };
}

/** Validate a requested scope against the caller's privileges. */
function normalizeScope(requested: unknown, caller: CallerContext): { scope: BundleScope } | { error: string } {
  const s = requested === 'downline' || requested === 'global' ? requested : 'self';
  if (s === 'downline' && !caller.canDownline) {
    return { error: 'Only Super Agents Or Admin Can Share A Bundle With Sub-Agents.' };
  }
  if (s === 'global' && !caller.canGlobal) {
    return { error: 'Only Admin Can Publish A Bundle To Every Storefront.' };
  }
  return { scope: s };
}

/** Shared validation for the create/update payloads. Returns cleaned fields or an error string. */
function validateBundleInput(body: Record<string, unknown>):
  | { name: string; tagline: string; description: string; image_url: string | null; product_ids: string[]; discount_percent: number; custom_price: number | null }
  | { error: string } {
  const { name, tagline, description, image_url, product_ids, discount_percent, custom_price } = body;
  if (typeof name !== 'string' || !name.trim()) {
    return { error: 'Bundle Name Is Required' };
  }
  if (name.trim().length > 100) {
    return { error: 'Bundle Name Too Long (Max 100 Characters)' };
  }
  if (tagline !== undefined && tagline !== null && (typeof tagline !== 'string' || tagline.length > 120)) {
    return { error: 'Tagline Too Long (Max 120 Characters)' };
  }
  if (!Array.isArray(product_ids) || product_ids.length < MIN_BUNDLE_PRODUCTS) {
    return { error: `A Bundle Needs At Least ${MIN_BUNDLE_PRODUCTS} Products` };
  }
  if (product_ids.length > MAX_BUNDLE_PRODUCTS) {
    return { error: `A Bundle Can Contain Up To ${MAX_BUNDLE_PRODUCTS} Products` };
  }
  if (product_ids.some((id: unknown) => typeof id !== 'string' || !UUID_RE.test(id))) {
    return { error: 'Product Selection Is Invalid' };
  }
  // De-dupe while preserving order.
  const seen = new Set<string>();
  const cleanIds = (product_ids as string[]).filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  if (cleanIds.length < MIN_BUNDLE_PRODUCTS) {
    return { error: `A Bundle Needs At Least ${MIN_BUNDLE_PRODUCTS} Distinct Products` };
  }
  if (description !== undefined && description !== null && (typeof description !== 'string' || description.length > 500)) {
    return { error: 'Bundle Description Too Long (Max 500 Characters)' };
  }
  if (image_url !== undefined && image_url !== null) {
    if (typeof image_url !== 'string' || image_url.length > 1000) {
      return { error: 'Bundle Image Reference Is Invalid' };
    }
    if (image_url && !/^https?:\/\//i.test(image_url) && !image_url.startsWith('/')) {
      return { error: 'Bundle Image Must Be An Uploaded Image URL' };
    }
  }
  // custom_price: optional positive number, max $99,999
  let cleanCustomPrice: number | null = null;
  if (custom_price !== undefined && custom_price !== null && custom_price !== '') {
    const cp = Number(custom_price);
    if (!Number.isFinite(cp) || cp < 0) {
      return { error: 'Custom Price Must Be A Positive Number' };
    }
    if (cp > 99999) {
      return { error: 'Custom Price Cannot Exceed $99,999' };
    }
    cleanCustomPrice = cp > 0 ? Math.round(cp * 100) / 100 : null;
  }
  return {
    name: name.trim(),
    tagline: typeof tagline === 'string' ? tagline.trim().slice(0, 120) : '',
    description: typeof description === 'string' ? description.trim() : '',
    image_url: typeof image_url === 'string' && image_url ? image_url : null,
    product_ids: cleanIds,
    discount_percent: clampDiscount(discount_percent),
    custom_price: cleanCustomPrice,
  };
}

async function loadOwn(svc: Awaited<ReturnType<typeof createServiceClient>>, userId: string): Promise<{ bundles: StoredBundle[]; slug: string | null }> {
  const { data: profile } = await svc
    .from('agent_profiles')
    .select('bundles_config, slug')
    .eq('id', userId)
    .maybeSingle();
  const row = (profile ?? {}) as { bundles_config?: unknown; slug?: string | null };
  return { bundles: normalizeBundleList(row.bundles_config), slug: row.slug ?? null };
}

async function persist(
  svc: Awaited<ReturnType<typeof createServiceClient>>,
  userId: string,
  bundles: StoredBundle[],
  slug: string | null,
): Promise<boolean> {
  const { error } = await svc
    .from('agent_profiles')
    // bundles_config is untyped in the generated Database types.
    .update({ bundles_config: bundles as unknown, updated_at: new Date().toISOString() } as never)
    .eq('id', userId);
  if (error) return false;
  try {
    revalidateTag('storefront-catalog', { expire: 0 });
    if (slug) revalidateTag('catalog:' + slug, { expire: 0 });
  } catch { /* best-effort cache refresh */ }
  return true;
}

export async function GET() {
  try {
    const gate = await requireAgentOrAdmin();
    if (!gate.ok) return gate.response;
    const svc = await createServiceClient();
    const [own, caller] = await Promise.all([
      loadOwn(svc, gate.user.id),
      resolveCaller(svc, gate.user.id, gate.isAdmin),
    ]);

    // Collect all unique product IDs across all bundles so we can return
    // per-bundle pricing context (base cost to the agent, retail price to buyer).
    const allProductIds = [...new Set(own.bundles.flatMap((b) => b.product_ids))];
    let priceMap: Map<string, { base_cost: number; retail_price: number }> = new Map();
    if (allProductIds.length > 0) {
      const { data: apRows } = await svc
        .from('agent_products')
        .select('product_id, retail_price, products ( base_cost )')
        .eq('agent_id', gate.user.id)
        .eq('is_visible', true)
        .in('product_id', allProductIds);
      if (apRows) {
        for (const row of apRows as Array<Record<string, any>>) {
          const pid = row.product_id as string;
          const baseCost = Number(row.products?.base_cost ?? 0);
          const retail = Number(row.retail_price ?? 0);
          if (pid) priceMap.set(pid, { base_cost: baseCost, retail_price: retail });
        }
      }
    }

    // Annotate each bundle with computed pricing totals.
    const bundlesWithPricing = own.bundles.map((b) => {
      let base_cost_total = 0;
      let retail_value_total = 0;
      for (const pid of b.product_ids) {
        const p = priceMap.get(pid);
        if (p) {
          base_cost_total += p.base_cost;
          retail_value_total += p.retail_price;
        }
      }
      return {
        ...b,
        base_cost_total: Math.round(base_cost_total * 100) / 100,
        retail_value_total: Math.round(retail_value_total * 100) / 100,
      };
    });

    return NextResponse.json({
      data: bundlesWithPricing,
      permissions: { canDownline: caller.canDownline, canGlobal: caller.canGlobal },
    });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const gate = await requireAgentOrAdmin();
  if (!gate.ok) return gate.response;

  const svc = await createServiceClient();
  const caller = await resolveCaller(svc, gate.user.id, gate.isAdmin);
  if (caller.isSubAgent) {
    return NextResponse.json(
      { error: 'Sub-Agents Cannot Create Bundles. Bundles Belong To The Storefront-Owning Agent.' },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const fields = validateBundleInput(body);
  if ('error' in fields) return NextResponse.json({ error: fields.error }, { status: 400 });
  const scoped = normalizeScope(body.scope, caller);
  if ('error' in scoped) return NextResponse.json({ error: scoped.error }, { status: 403 });

  const { bundles, slug } = await loadOwn(svc, gate.user.id);
  if (bundles.length >= 50) {
    return NextResponse.json({ error: 'Bundle Limit Reached (50 Per Store)' }, { status: 400 });
  }
  const newBundle: StoredBundle = {
    id: randomUUID(),
    name: fields.name,
    tagline: fields.tagline,
    description: fields.description,
    image_url: fields.image_url,
    product_ids: fields.product_ids,
    discount_percent: fields.discount_percent,
    custom_price: fields.custom_price,
    is_active: true,
    scope: scoped.scope,
    created_by: gate.user.id,
    created_at: new Date().toISOString(),
  };
  const ok = await persist(svc, gate.user.id, [...bundles, newBundle], slug);
  if (!ok) return NextResponse.json({ error: 'An Unexpected Error Occurred.' }, { status: 500 });
  return NextResponse.json({ success: true, bundle: newBundle });
}

export async function PATCH(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const gate = await requireAgentOrAdmin();
  if (!gate.ok) return gate.response;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { id, action } = body as { id?: unknown; action?: unknown };
  if (typeof id !== 'string' || !id) return NextResponse.json({ error: 'Bundle ID Required' }, { status: 400 });
  const VALID_ACTIONS = ['toggle', 'update'] as const;
  if (typeof action !== 'string' || !(VALID_ACTIONS as readonly string[]).includes(action)) {
    return NextResponse.json({ error: `Invalid Action. Must Be One Of: ${VALID_ACTIONS.join(', ')}` }, { status: 400 });
  }

  const svc = await createServiceClient();
  const caller = await resolveCaller(svc, gate.user.id, gate.isAdmin);
  const { bundles, slug } = await loadOwn(svc, gate.user.id);
  const idx = bundles.findIndex((b) => b.id === id);
  if (idx === -1) return NextResponse.json({ error: 'Bundle Not Found' }, { status: 404 });

  let updated: StoredBundle[];
  if (action === 'toggle') {
    updated = bundles.map((b) => (b.id === id ? { ...b, is_active: !b.is_active } : b));
  } else {
    const fields = validateBundleInput(body);
    if ('error' in fields) return NextResponse.json({ error: fields.error }, { status: 400 });
    const scoped = normalizeScope(body.scope ?? bundles[idx].scope, caller);
    if ('error' in scoped) return NextResponse.json({ error: scoped.error }, { status: 403 });
    updated = bundles.map((b) =>
      b.id === id
        ? {
            ...b,
            name: fields.name,
            tagline: fields.tagline,
            description: fields.description,
            image_url: fields.image_url,
            product_ids: fields.product_ids,
            discount_percent: fields.discount_percent,
            custom_price: fields.custom_price,
            scope: scoped.scope,
          }
        : b,
    );
  }
  const ok = await persist(svc, gate.user.id, updated, slug);
  if (!ok) return NextResponse.json({ error: 'An Unexpected Error Occurred.' }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const gate = await requireAgentOrAdmin();
  if (!gate.ok) return gate.response;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { id } = body as { id?: unknown };
  if (typeof id !== 'string' || !id) return NextResponse.json({ error: 'Bundle ID Required' }, { status: 400 });
  const svc = await createServiceClient();
  const { bundles, slug } = await loadOwn(svc, gate.user.id);
  const updated = bundles.filter((b) => b.id !== id);
  const ok = await persist(svc, gate.user.id, updated, slug);
  if (!ok) return NextResponse.json({ error: 'An Unexpected Error Occurred.' }, { status: 500 });
  return NextResponse.json({ success: true });
}
