import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { analyzeCartWarnings, type Compound } from '@/lib/compounds';
import { resolveCartIdsToProductIds } from '@/lib/cart-ids';
import { assertSameOrigin } from '@/lib/csrf';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

function coerceCompound(row: Record<string, unknown>): Compound {
  return {
    ...(row as unknown as Compound),
    identity: (row.identity as Compound['identity']) ?? {},
    handling: (row.handling as Compound['handling']) ?? {},
    aliases: (row.aliases as string[]) ?? [],
    studied_for: (row.studied_for as string[]) ?? [],
    research_areas: (row.research_areas as string[]) ?? [],
    sources: (row.sources as string[]) ?? [],
    stack_components: (row.stack_components as string[]) ?? [],
    risk_reasons: (row.risk_reasons as string[]) ?? [],
  };
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const ip = getClientIp(req);
  const rl = await rateLimit({ key: 'research_cart_warnings', limit: 60, windowSeconds: 60, identifier: ip });
  if (!rl.allowed) {
    return NextResponse.json({ warnings: [] }, { status: 429 });
  }

  let slugs: string[] = [];
  let productIds: string[] = [];
  try {
    const body = await req.json();
    if (Array.isArray(body?.slugs)) {
      slugs = body.slugs.filter((s: unknown): s is string => typeof s === 'string');
    }
    if (Array.isArray(body?.productIds)) {
      productIds = body.productIds.filter((s: unknown): s is string => typeof s === 'string');
    }
  } catch {
    slugs = [];
    productIds = [];
  }

  const supabase = await createServiceClient();

  // Callers (e.g. checkout) may pass product IDs instead of compound slugs.
  // Resolve them to canonical compound slugs via products.compound_slug.
  if (slugs.length === 0 && productIds.length > 0) {
    // Cart ids may be agent_product ids (mobile by-name path) or product ids.
    // Resolve to product ids first so safety warnings still render for items
    // added through the mobile path (otherwise the slug lookup matches nothing).
    const { productIds: resolvedProductIds } = await resolveCartIdsToProductIds(supabase, productIds);
    const { data: prods } = await supabase
      .from('products')
      .select('compound_slug')
      .in('id', resolvedProductIds);
    slugs = Array.from(
      new Set(
        (prods ?? [])
          .map((p) => (p as { compound_slug: string | null }).compound_slug)
          .filter((s): s is string => typeof s === 'string' && s.length > 0),
      ),
    );
  }

  if (slugs.length === 0) {
    return NextResponse.json({ warnings: [] });
  }

  const { data, error } = await supabase.from('compounds').select('*').in('slug', slugs);

  if (error || !data) {
    return NextResponse.json({ warnings: [] });
  }

  const compounds = data.map((row) => coerceCompound(row as Record<string, unknown>));
  const warnings = analyzeCartWarnings(compounds);
  return NextResponse.json({ warnings });
}
