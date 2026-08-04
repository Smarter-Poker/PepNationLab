export const dynamic = 'force-dynamic';

import { Suspense, cache } from 'react';
import { preload } from 'react-dom';
import { notFound, permanentRedirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { DEFAULT_STORE_SLUG } from '@/lib/default-store';
import Link from 'next/link';
import AgentStorefrontGrid from '@/components/AgentStorefrontGrid';
import { getCompoundsBySlugs } from '@/lib/compounds-server';
import { computeAgentCostsForAgent, type AgentTier } from '@/lib/pricing';
import { getEffectiveBundlesForStore } from '@/lib/bundles';
import { isSavageNetworkAgent, SAVAGE_BRANDS_SLUG } from '@/lib/brand-network';
import CouponLinkCapture from '@/components/CouponLinkCapture';
import StorefrontRenameBanner from '@/components/StorefrontRenameBanner';
import Navbar from '@/components/Navbar';
import StorefrontSkeleton from '@/components/StorefrontSkeleton';
import GuestCTA from '@/components/GuestCTA';
import AgentLinkCapture from '@/components/AgentLinkCapture';

interface Props {
  params: Promise<{ agentSlug: string }>;
  // There is deliberately no searchParams here. This page used to declare
  // `searchParams?: Promise<{ sa?: string }>` and never read it, which made it
  // look as though the server participated in sub-agent attribution when it
  // does not. The ?sa= param is already read client-side by AgentLinkCapture
  // straight off window.location.search, and the credit that actually counts
  // is the `sa` field inside the HMAC-signed pnl_ref_lock cookie minted by
  // resolveRefCode in proxy.ts. Reading ?sa= here as well would create a
  // second, unsigned, client-supplied channel for the same fact, and the two
  // could disagree -- so the declaration is removed rather than wired up.
}

// Request-scoped memo: both the page body and generateMetadata resolve the
// storefront row by slug during the same request. React cache() deduplicates
// the second call, so the agent_profiles row is fetched once per request.
// The select is the union of the columns both consumers need (the page body's
// full column set plus tagline for generateMetadata).
const getAgentProfileBySlug = cache(async (agentSlug: string) => {
  const supabase = await createClient();
  // Storefront slugs are canonically lowercase (STORE_SLUG_RE in
  // lib/store-slug.ts only admits [a-z0-9...]), but the URL segment is
  // whatever the visitor typed or whatever a partner printed on a flyer.
  // PostgREST's .eq() is case-sensitive, so /SavageBrands used to match no
  // row and notFound() -- a hard 404 on a live agent's storefront. proxy.ts
  // has a canonicalising redirect, but it is gated behind
  // `!refCookiesToSet && (!refLock || refLock.k === 'url')` inside its
  // `if (!user)` branch, so it never runs for a signed-in visitor: exactly
  // the returning customer whose order would have been credited to that
  // agent. Normalising here makes the lookup correct no matter which path
  // reached it.
  const { data, error } = await supabase
    .from('agent_profiles')
    .select(`
      id,
      slug,
      display_name,
      tagline,
      logo_url,
      primary_color,
      secondary_color,
      qr_code_url,
      qr_code_data,
      is_active,
      volume_pricing_enabled,
      is_manufacturer_store,
      min_order_qty,
      min_overall_qty,
      storefront_renamed_at,
      featured_products,
      custom_branding
    `)
    .eq('slug', agentSlug.trim().toLowerCase())
    .maybeSingle();
  return { data, error };
});

async function AgentStorefrontDataLoader({
  agentSlug,
  agent,
  user,
  userProfile,
}: {
  agentSlug: string;
  agent: any;
  user: any;
  userProfile: any;
}) {
  const supabase = await createClient();

  // -- Fetch products in parallel -----------------------------------------------------------------------
  // Products are scoped to agent.id (from outer query) - safe to start immediately.
  const [productsResult] = await Promise.all([
    supabase
      .from('agent_products')
      .select(`
        id,
        product_id,
        custom_name,
        custom_description,
        custom_image_url,
        retail_price,
        is_on_sale,
        sale_price,
        products (
          name,
          description,
          image_url,
          category,
          backorder_days,
          unit_size,
          unit_measure,
          weight_oz,
          inventory_count,
          low_stock_threshold,
          base_cost,
          market_avg_price,
          compound_slug
        )
      `)
      .eq('agent_id', agent.id)
      .eq('is_visible', true)
      .order('sort_order')
      .limit(250),
  ]);
  // Distinguish "load failed" from "genuinely empty catalog". A transient DB error
  // returns { data: null, error } -- if we silently treated null as [], a fully
  // stocked store would render the "Coming Soon" empty state (and could be indexed
  // that way). Throw so the storefront error boundary catches it and shows a retry.
  if (productsResult.error) {
    throw new Error(`Storefront catalog load failed: ${productsResult.error.message}`);
  }
  const products = productsResult.data;

  const isStorefrontOwner = !!user && userProfile?.id === agent.id;
  const isManufacturerStore = (agent as { is_manufacturer_store?: boolean | null }).is_manufacturer_store === true;

  // -- Run independent queries in parallel - saves ~2 sequential round-trips --
  const productIds = (products ?? [])
    .map(p => p.product_id)
    .filter((v): v is string => !!v);

  const isResearcher = userProfile?.role === 'researcher';

  const [inventoryResult, lotsResult, wishlistResult] = await Promise.all([
    // 1. Inventory counts
    supabase.rpc('agent_inventory_for_storefront', { p_slug: agentSlug }),

    // 2. COA lot numbers — link to /coa?lot= page (no storage file required)
    productIds.length > 0
      ? supabase
          .from('product_lots')
          .select('product_id, lot_number, coa_storage_key, received_at')
          .in('product_id', productIds)
          .eq('is_active', true)
          .not('coa_verified_at', 'is', null)
          .is('coa_retracted_at', null)
          .is('superseded_by', null)
          .order('received_at', { ascending: false })
      : Promise.resolve({ data: null }),

    // 3. Wishlist (researchers only)
    isResearcher
      ? supabase
          .from('researcher_favorites')
          .select('product_id')
          .eq('user_id', user?.id ?? '')
      : Promise.resolve({ data: null }),
  ]);

  // Build inventory map
  const inventoryMap = new Map(
    (inventoryResult.data as Array<{ product_id: string; stock_count: number }> | null)
      ?.map(i => [i.product_id, i.stock_count]) ?? []
  );

  // Build COA URL map — prefer storage PDF if available, fall back to /coa?lot= page
  const coaByProductId: Record<string, string> = {};
  for (const row of lotsResult.data ?? []) {
    if (coaByProductId[row.product_id]) continue; // keep newest (query ordered desc)
    if (row.coa_storage_key) {
      const { data: pub } = supabase.storage
        .from('product-coas')
        .getPublicUrl(row.coa_storage_key);
      if (pub?.publicUrl) { coaByProductId[row.product_id] = pub.publicUrl; continue; }
    }
    // No storage file yet — link to the COA detail page by lot number
    if (row.lot_number) {
      coaByProductId[row.product_id] = `/coa?lot=${encodeURIComponent(row.lot_number)}`;
    }
  }

  // Wishlist IDs
  const initialWishlistIds: string[] = (wishlistResult.data ?? []).map(
    (r: { product_id: string }) => r.product_id
  );


  let productsWithCost: Array<Record<string, unknown>> =
    (products ?? []) as unknown as Array<Record<string, unknown>>;
  // Manufacturer owners have no tier-derived cost -- their private cost lives
  // on agent_products.manufacturer_cost and renders on their own dashboard.
  if (isStorefrontOwner && !isManufacturerStore && (products?.length ?? 0) > 0) {
    const svc = await createServiceClient();
    const ownerTier = ((userProfile as { tier?: AgentTier } | null)?.tier ?? 'tier_3') as AgentTier;
    // Resolve the owner's pricing context once and price the whole catalog in
    // memory - previously this issued 2-3 queries per product. Products with
    // a NULL base_cost are excluded from the batch so their cost_price stays
    // null, matching the old per-product throw-and-null behavior.
    let costMap = new Map<string, number>();
    try {
      const pricedProducts = (products ?? [])
        .filter((p) => !!p.product_id && (p.products as { base_cost?: number | null } | null)?.base_cost != null)
        .map((p) => ({
          id: p.product_id as string,
          base_cost: Number((p.products as { base_cost?: number | null }).base_cost),
        }));
      costMap = await computeAgentCostsForAgent(svc, agent.id, ownerTier, pricedProducts);
    } catch {
      costMap = new Map<string, number>();
    }
    productsWithCost = (products ?? []).map((p) => ({
      ...(p as Record<string, unknown>),
      cost_price: costMap.get(p.product_id as string) ?? null,
    }));
  }

  const compoundsBySlug = await getCompoundsBySlugs(
    (products ?? []).map((p) => (p.products as { compound_slug?: string | null })?.compound_slug)
  );

  const primaryColor = agent.primary_color ?? '#00C4BC';

  // Store bundles: the store's own bundles plus any cascaded from a parent
  // super-agent (scope 'downline') or the house store (scope 'global'). Resolved
  // with the service client so cascade works for anonymous visitors regardless
  // of RLS on profiles.parent_agent_id. Member products are resolved against this
  // store's catalog inside the grid, which hides any bundle that loses too many.
  let storeBundles: Array<{ id: string; name: string; tagline: string; description: string; image_url: string | null; product_ids: string[]; discount_percent: number; custom_price: number | null }> = [];
  try {
    const svcBundles = await createServiceClient();
    const effective = await getEffectiveBundlesForStore(svcBundles, agent.id);
    storeBundles = effective.map((b) => ({
      id: b.id,
      name: b.name,
      tagline: b.tagline || '',
      description: b.description,
      image_url: b.image_url,
      vial_image_url: b.vial_image_url,
      product_ids: b.product_ids,
      discount_percent: b.discount_percent,
      custom_price: b.custom_price ?? null,
    }));
  } catch {
    storeBundles = [];
  }

  // ── Savage Brands network detection (server-side) ─────────────────────────
  // A downline store (e.g. /eddierazz) — or a downline OF a downline — must
  // render Savage card art and never fall back to Pep Nation imagery. The
  // client-side heuristic in the grid sniffs custom_image_url paths, which
  // fails when a downline's catalog rows were seeded without savage image
  // paths — so walk the parent_agent_id chain here via the service client
  // (RLS hides profiles.parent_agent_id from anonymous visitors) and pass an
  // authoritative flag down.
  let brandNetworkIsSavage = agentSlug === SAVAGE_BRANDS_SLUG;
  if (!brandNetworkIsSavage) {
    try {
      const svcBrand = await createServiceClient();
      brandNetworkIsSavage = await isSavageNetworkAgent(svcBrand, agent.id);
    } catch {
      // Non-fatal: the grid's client-side heuristics still apply.
    }
  }

  // Build schema.org/Product nodes defensively. `name` is REQUIRED by Google's
  // Product structured-data spec; when it resolved to undefined, JSON.stringify
  // dropped the key entirely and Search Console flagged "Missing field name".
  // We now skip any product without a real name and only emit an Offer when the
  // price is a valid positive number, so we never publish an invalid node.
  // NOTE: review/aggregateRating are intentionally omitted - there is no genuine
  // review data, and inventing ratings violates Google's structured-data policy.
  const productJsonLds = productsWithCost
    .map((p) => {
      const pp = p as any;
      const name = String(pp.custom_name || pp.products?.name || '').trim();
      if (!name) return null;
      const node: Record<string, unknown> = {
        '@type': 'Product',
        name,
        brand: { '@type': 'Brand', name: 'Pep Nation Lab' },
      };
      const description = String(pp.custom_description || pp.products?.description || '').trim();
      node.description = (description ? description + ' ' : '') + 'For In Vitro Laboratory Research Use Only. Not For Human Or Animal Consumption.';
      const rawImage = pp.custom_image_url || pp.products?.image_url;
      if (rawImage) {
        node.image = String(rawImage).startsWith('http')
          ? rawImage
          : `https://pepnationlab.com${rawImage}`;
      }
      const price = Number(pp.is_on_sale ? pp.sale_price : pp.retail_price);
      if (!Number.isFinite(price) || !(price > 0)) return null;
      node.offers = {
        '@type': 'Offer',
        price: price.toFixed(2),
        priceCurrency: 'USD',
        availability:
          (inventoryMap.get(pp.product_id) ?? 0) > 0
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
        url: `https://pepnationlab.com/${agentSlug}`,
        priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        itemCondition: 'https://schema.org/NewCondition',
        seller: { '@id': 'https://pepnationlab.com/#organization' },
      };
      return node;
    })
    .filter((n): n is Record<string, unknown> => n !== null);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': productJsonLds,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <AgentStorefrontGrid
        products={productsWithCost as any}
        inventoryMap={Object.fromEntries(inventoryMap)}
        primaryColor={primaryColor}
        agentSlug={agentSlug}
        initialWishlistIds={initialWishlistIds}
        agentId={agent.id}
        bundles={storeBundles}
        coaByProductId={coaByProductId}
        volumePricingEnabled={isManufacturerStore ? false : (agent as any).volume_pricing_enabled !== false}
        manufacturerStore={isManufacturerStore}
        isStorefrontOwner={isStorefrontOwner}
        viewerTier={(userProfile as any)?.tier ?? 'tier_3'}
        minOrderQty={agent.min_order_qty ?? 1}
        minOverallQty={agent.min_overall_qty ?? 1}
        compoundsBySlug={compoundsBySlug}
        featuredProductIds={agent.featured_products || []}
        customBranding={(agent as any).custom_branding ?? null}
        brandNetworkIsSavage={brandNetworkIsSavage}
      />
    </>
  );
}

export default async function AgentStorefrontPage({ params }: Props) {
  const { agentSlug: rawAgentSlug } = await params;
  const agentSlug = rawAgentSlug.trim().toLowerCase();

  // Send a mixed-case entry to the canonical lowercase path once, so the
  // odd-cased URL does not stay in circulation collecting links, shares and
  // duplicate-content penalties, and so everything below this line (the
  // inventory RPC's p_slug, the AgentLinkCapture attribution write, the
  // og:url) sees one spelling of the storefront rather than the visitor's.
  // encodeURIComponent is not decoration: the segment is attacker-controlled,
  // and passing it raw would let a crafted path turn this into an open
  // redirect off-site.
  if (rawAgentSlug !== agentSlug) {
    permanentRedirect(`/${encodeURIComponent(agentSlug)}`);
  }

  const supabase = await createClient();

  const { data: agent, error } = await getAgentProfileBySlug(agentSlug);

  if (error || !agent) {
    notFound(); // returns HTTP 404; prevents bots indexing dead storefronts as valid pages
  }

  // GUEST STOREFRONT RULE (2026-07-30): scanning an agent's QR code, or opening
  // pepnationlab.com/<slug> directly, renders THIS STORE. No sign-up wall, no
  // bounce to the landing screen, no account required to browse products or see
  // pricing.
  //
  // This block used to redirect any guest whose ref-lock slug did not already
  // match this store to /?agent=<slug>. That landing screen leads with LOG IN /
  // CREATE ACCOUNT, so in practice every first-time scanner was told to make an
  // account before they could look at anything -- which is precisely what a
  // referral QR code exists to avoid.
  //
  // Removing it does NOT open guest browsing up. Confinement is enforced one
  // layer earlier, in proxy.ts: a guest holding a hard (QR) lock who requests a
  // different store is 307'd back to their locked store at the edge, before this
  // component is ever invoked, and an unlocked guest hitting /<slug> has a soft
  // lock minted for this store on the same request. This guard only ever
  // duplicated that decision -- and disagreed with it.
  //
  // Attribution is unaffected: <AgentLinkCapture> below records the slug for
  // signup credit, and the signed pnl_ref_lock cookie (lib/ref-lock.ts) remains
  // authoritative over anything the client submits at registration.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (agent.is_active === false) {
    const primaryColor = agent.primary_color ?? '#00C4BC';
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--black)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-6)' }}>
        <div className="glass-panel hover-lift stagger-fade-in" style={{ maxWidth: 480, padding: 'var(--space-8)', textAlign: 'center', border: `1px solid ${primaryColor}30`, animationDelay: '0.1s' }}>
          <h1 className="animated-gradient-text" style={{ color: 'var(--white)', fontSize: '1.4rem', marginBottom: 'var(--space-3)' }}>
            Storefront Paused
          </h1>
          <p style={{ color: 'var(--silver)', fontSize: '0.92rem', marginBottom: 'var(--space-4)' }}>
            {agent.display_name} Is Temporarily Not Accepting New Orders.
          </p>
          <p style={{ color: 'var(--grey-400)', fontSize: '0.82rem' }}>
            Please Check Back Soon Or Contact Your Agent For Assistance.
          </p>
        </div>
      </div>
    );
  }

  // We fetch userProfile here with the broader column set needed for DataLoader pricing and wishlist logic.
  let userProfile = null;
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('role, id, tier, referring_agent_id, parent_agent_id')
      .eq('id', user.id)
      .maybeSingle();
    userProfile = data;
  }
  const isStorefrontOwner = userProfile?.id === agent.id;

  // LCP fix: the storefront hero (AgentStorefrontGrid, Phase 3 Dynamic Image
  // Hero) paints /images/store_discovery_hero_v3.png via a CSS
  // background-image, which the browser preload scanner cannot see - the
  // request only starts after CSSOM + JS hydration (measured LCP 9.0s).
  // Hoisting a high-priority preload from this server component puts a
  // <link rel="preload" as="image"> in the initial HTML head so the download
  // starts with the document. If the hero file is renamed in
  // AgentStorefrontGrid.tsx, update this path in lockstep.
  preload('/images/store_discovery_hero_v3.png', { as: 'image', fetchPriority: 'high' });

  const primaryColor = agent.primary_color ?? '#00C4BC';
  const showRenameBanner =
    isStorefrontOwner && (agent as { storefront_renamed_at?: string | null }).storefront_renamed_at == null;

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#000000',
      ['--black' as any]: '#000000',
      ['--black-2' as any]: '#000000'
    }}>
      <CouponLinkCapture />
      {/* Capture agent slug for guest signup attribution */}
      {!user && <AgentLinkCapture agentSlug={agentSlug} />}
      <Navbar agentSlug={agentSlug} />
      <div style={{ height: 'var(--nav-offset, 60px)' }} />

      {showRenameBanner ? (
        <StorefrontRenameBanner
          agentId={agent.id}
          currentName={agent.display_name}
          settingsUrl="/dashboard/agent?tab=Storefront+Config"
        />
      ) : null}

      {/* Crawlable storefront content layer - visually hidden (clip-rect),
          present in the initial HTML for search engines and AI crawlers.
          The product grid streams client-side inside Suspense, so without
          this the only indexable storefront has no crawlable prose.
          Restored 2026-07-11: a stale-snapshot bot commit (7a0a700c) deleted
          this block while applying an unrelated structured-data fix. */}
      <header style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}>
        <h1>{agent.display_name} - Buy Research Peptides Online At Wholesale Pricing</h1>
        <p>
          Browse 100+ Research-Grade Peptides And Compounds Including BPC-157, TB-500, Semaglutide,
          Tirzepatide, Retatrutide, Cagrilintide, CJC-1295, Ipamorelin, Sermorelin, GHK-Cu, PT-141,
          NAD+, And Research Peptide Stacks. Every Vial Is Batch-Tested With Certificate Of Analysis
          Documentation And Ships Same-Day Nationwide To Verified Researchers At True Wholesale
          Pricing. All Products Are Strictly For In Vitro Laboratory Research Use Only - Not For
          Human Consumption.
        </p>
        <nav aria-label="Research Resources">
          <a href="/research">Peptide Research Library</a>
          <a href="/find-a-peptide">Find A Peptide By Research Goal</a>
          <a href="/peptides">Research Peptides By City</a>
          <a href="/peptide-101">Peptide 101 Research Education</a>
          <a href="/become-agent">Become A Peptide Distribution Agent</a>
        </nav>
      </header>


      {/* Products */}
      <section style={{ paddingTop: 8, paddingBottom: 24, position: 'relative', minHeight: '60vh' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 8px' }}>
          <Suspense fallback={<StorefrontSkeleton />}>
            <AgentStorefrontDataLoader agentSlug={agentSlug} agent={agent} user={user} userProfile={userProfile} />
          </Suspense>
        </div>
      </section>

      {/* Footer powered-by */}
      <footer style={{
        padding: 'var(--space-6)',
        textAlign: 'center',
        marginTop: 'var(--space-6)'
      }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--grey-600)' }}>
          Powered By{' '}
          <Link href="/" style={{ color: 'var(--teal)' }}>Pep Nation Lab</Link>
          {' '}- Research Grade Peptides &amp; Authorized Laboratory Diluents.
        </p>
      </footer>

      {/* Guest conversion banner - only visible to unauthenticated visitors */}
      {!user && <GuestCTA />}

    </div>
  );
}

export async function generateMetadata({ params }: Props) {
  const { agentSlug: rawAgentSlug } = await params;
  // Lowercased for the same reason as the page body: `alternates.canonical`
  // must point at one URL rather than echoing whatever casing was requested,
  // and `robots.index` compares against DEFAULT_STORE_SLUG -- an untouched
  // /Pepnationlab would otherwise compare unequal and quietly noindex the
  // house store.
  const agentSlug = rawAgentSlug.trim().toLowerCase();
  // Shares the request-scoped cached lookup with the page body, so the
  // agent_profiles row is only fetched once per request.
  const { data: agent } = await getAgentProfileBySlug(agentSlug);

  if (!agent) return { title: 'Store Not Found | Pep Nation Lab', robots: { index: false, follow: false } };

  const title = `${agent.display_name} | Pep Nation Lab`;
  const description = agent.tagline
    ? `${agent.tagline} - Research-grade peptides for qualified researchers. Research use only.`
    : `Research compounds from ${agent.display_name}. Premium RUO peptides for qualified researchers. Research use only.`;

  return {
    title,
    description,
    robots: { index: agentSlug === DEFAULT_STORE_SLUG, follow: agentSlug === DEFAULT_STORE_SLUG },
    alternates: { canonical: `https://pepnationlab.com/${agentSlug}` },
    openGraph: {
      title,
      description,
      url: `https://pepnationlab.com/${agentSlug}`,
      type: 'website',
      images: [{ url: '/og-card.png', width: 1200, height: 630, alt: `${agent.display_name} - Pep Nation Lab` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/og-card.png'],
    },
  };
}
