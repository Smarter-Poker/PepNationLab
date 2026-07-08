export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { preload } from 'react-dom';
import { notFound, redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { DEFAULT_STORE_SLUG } from '@/lib/default-store';
import Link from 'next/link';
import AgentStorefrontGrid from '@/components/AgentStorefrontGrid';
import { getCompoundsBySlugs } from '@/lib/compounds-server';
import { computeAgentCostForAgent, type AgentTier } from '@/lib/pricing';
import CouponLinkCapture from '@/components/CouponLinkCapture';
import StorefrontRenameBanner from '@/components/StorefrontRenameBanner';
import Navbar from '@/components/Navbar';
import StorefrontSkeleton from '@/components/StorefrontSkeleton';
import GuestCTA from '@/components/GuestCTA';
import AgentLinkCapture from '@/components/AgentLinkCapture';

interface Props {
  params: Promise<{ agentSlug: string }>;
}

async function AgentStorefrontDataLoader({
  agentSlug,
  agent,
}: {
  agentSlug: string;
  agent: any;
}) {
  const supabase = await createClient();

  // -- Fetch products and auth user in parallel -----------------------------------------------------------------------
  // Products are scoped to agent.id (from outer query) - safe to start immediately.
  const [productsResult, { data: { user } }] = await Promise.all([
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
          compound_slug
        )
      `)
      .eq('agent_id', agent.id)
      .eq('is_visible', true)
      .order('sort_order'),

    supabase.auth.getUser(),
  ]);
  const products = productsResult.data;

  // Storefronts are public (allowed in middleware). Resolve the REAL viewer
  // profile when signed in so the storefront owner sees self-buy cost pricing
  // and researchers get their wishlist + correct viewer context. Anonymous
  // shoppers browse at retail. Previously this was stubbed to a mock admin
  // profile, which silently disabled owner self-buy pricing and researcher
  // wishlists on every storefront.
  type ViewerProfile = { role: string | null; id: string; tier: string | null; referring_agent_id: string | null; parent_agent_id: string | null };
  let userProfile: ViewerProfile | null = null;
  if (user) {
    const { data: viewerProfile } = await supabase
      .from('profiles')
      .select('role, id, tier, referring_agent_id, parent_agent_id')
      .eq('id', user.id)
      .maybeSingle();
    userProfile = (viewerProfile as ViewerProfile | null) ?? null;
  }
  const isStorefrontOwner = !!user && userProfile?.id === agent.id;

  // -- Run independent queries in parallel - saves ~2 sequential round-trips --
  const productIds = (products ?? [])
    .map(p => p.product_id)
    .filter((v): v is string => !!v);

  const isResearcher = userProfile?.role === 'researcher';

  const [inventoryResult, lotsResult, wishlistResult] = await Promise.all([
    // 1. Inventory counts
    supabase.rpc('agent_inventory_for_storefront', { p_slug: agentSlug }),

    // 2. COA PDFs (only if we have product IDs)
    productIds.length > 0
      ? supabase
          .from('product_lots')
          .select('product_id, coa_storage_key, received_at')
          .in('product_id', productIds)
          .eq('is_active', true)
          .not('coa_storage_key', 'is', null)
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

  // Build COA URL map
  const coaByProductId: Record<string, string> = {};
  for (const row of lotsResult.data ?? []) {
    if (!row.coa_storage_key) continue;
    if (coaByProductId[row.product_id]) continue; // keep newest
    const { data: pub } = supabase.storage
      .from('product-coas')
      .getPublicUrl(row.coa_storage_key);
    if (pub?.publicUrl) coaByProductId[row.product_id] = pub.publicUrl;
  }

  // Wishlist IDs
  const initialWishlistIds: string[] = (wishlistResult.data ?? []).map(
    (r: { product_id: string }) => r.product_id
  );


  let productsWithCost: Array<Record<string, unknown>> =
    (products ?? []) as unknown as Array<Record<string, unknown>>;
  if (isStorefrontOwner && (products?.length ?? 0) > 0) {
    const svc = await createServiceClient();
    const ownerTier = ((userProfile as { tier?: AgentTier } | null)?.tier ?? 'tier_3') as AgentTier;
    productsWithCost = await Promise.all(
      (products ?? []).map(async (p) => {
        let costPrice: number | null = null;
        try {
          costPrice = await computeAgentCostForAgent(svc, p.product_id, agent.id, ownerTier);
        } catch {
          costPrice = null;
        }
        return { ...(p as Record<string, unknown>), cost_price: costPrice };
      })
    );
  }

  const compoundsBySlug = await getCompoundsBySlugs(
    (products ?? []).map((p) => (p.products as { compound_slug?: string | null })?.compound_slug)
  );

  const primaryColor = agent.primary_color ?? '#00C4BC';

  const productJsonLds = productsWithCost.map(p => ({
    '@type': 'Product',
    name: (p as any).custom_name || (p as any).products?.name,
    description: (p as any).custom_description || (p as any).products?.description,
    image: (p as any).custom_image_url || (p as any).products?.image_url,
    offers: {
      '@type': 'Offer',
      price: (p as any).is_on_sale ? (p as any).sale_price : (p as any).retail_price,
      priceCurrency: 'USD',
      availability: (inventoryMap.get((p as any).product_id) ?? 0) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: `https://pepnationlab.com/${agentSlug}`,
    },
  }));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': productJsonLds,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <AgentStorefrontGrid
        products={productsWithCost as any}
        inventoryMap={Object.fromEntries(inventoryMap)}
        primaryColor={primaryColor}
        agentSlug={agentSlug}
        initialWishlistIds={initialWishlistIds}
        agentId={agent.id}
        coaByProductId={coaByProductId}
        volumePricingEnabled={(agent as any).volume_pricing_enabled !== false}
        isStorefrontOwner={isStorefrontOwner}
        viewerTier={(userProfile as any)?.tier ?? 'tier_3'}
        minOrderQty={agent.min_order_qty ?? 1}
        minOverallQty={agent.min_overall_qty ?? 1}
        compoundsBySlug={compoundsBySlug}
      />
    </>
  );
}

export default async function AgentStorefrontPage({ params }: Props) {
  const { agentSlug } = await params;
  const supabase = await createClient();

  const { data: agent, error } = await supabase
    .from('agent_profiles')
    .select(`
      id,
      slug,
      display_name,
      logo_url,
      primary_color,
      secondary_color,
      qr_code_url,
      qr_code_data,
      is_active,
      volume_pricing_enabled,
      min_order_qty,
      min_overall_qty,
      storefront_renamed_at
    `)
    .eq('slug', agentSlug)
    .maybeSingle();

  if (error || !agent) {
    notFound(); // returns HTTP 404; prevents bots indexing dead storefronts as valid pages
  }

  // OWNER RULE (2026-07-07): Guests ALWAYS browse the admin / house storefront
  // (researchstore -- Daniel Bekavac) so they always see admin pricing. Any
  // unauthenticated visitor who lands on a different agent's storefront is
  // redirected to the house store. Signed-in researchers, agents, and store
  // owners continue to see their own storefront and pricing untouched.
  // NOTE: this intentionally consolidates the anonymous storefront experience
  // onto researchstore (crawlers are anonymous, so agent-store URLs 302 here
  // for bots too -- SEO focus is /research and /peptides, not agent stores).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user && agentSlug !== DEFAULT_STORE_SLUG) {
    redirect(`/${DEFAULT_STORE_SLUG}`);
  }

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

  // `user` was already resolved above (for the guest-redirect rule). We reuse it
  // here to determine the top navbar icons and rename banner.
  //
  // Note: AgentStorefrontDataLoader (rendered inside the Suspense boundary below)
  // also fetches userProfile independently with a broader column set
  // (role, id, tier, referring_agent_id, parent_agent_id) needed for pricing and
  // wishlist logic. The two fetches cannot share state because the DataLoader is a
  // separate async Server Component rendered after the Suspense fallback resolves.
  // If this becomes a performance concern, the full profile could be passed as a
  // prop from here into the DataLoader instead of re-querying.
  let userProfile = null;
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('role, id')
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
      <div style={{ height: 60 }} />

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
          this the only indexable storefront has no crawlable prose. */}
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
            <AgentStorefrontDataLoader agentSlug={agentSlug} agent={agent} />
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
  const { agentSlug } = await params;
  const supabase = await createClient();
  const { data: agent } = await supabase
    .from('agent_profiles')
    .select('display_name, tagline')
    .eq('slug', agentSlug)
    .maybeSingle();

  if (!agent) return { title: 'Store Not Found | Pep Nation Lab' };

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
