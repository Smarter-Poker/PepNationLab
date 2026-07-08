import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getCompoundsBySlugs } from '@/lib/compounds-server';
import Navbar from '@/components/Navbar';
import StorefrontCompareDrawer from '@/components/storefront/StorefrontCompareDrawer';
import FindAPeptideClient from '@/components/storefront/FindAPeptideClient';
import GuestCTA from '@/components/GuestCTA';
import { DEFAULT_STORE_SLUG } from '@/lib/default-store';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Find A Peptide | AI-Powered Research Peptide Finder | Pep Nation Lab',
  description: 'Find the right research peptide for your study goals. Browse BPC-157, TB-500, Semaglutide, Tirzepatide, and 300+ more compounds by therapeutic area, mechanism, and evidence tier. Research use only.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://pepnationlab.com/find-a-peptide' },
  openGraph: {
    title: 'Find A Peptide | Pep Nation Lab',
    description: 'Discover the right research peptide for your goals. Browse 300+ RUO compounds by therapeutic area, mechanism, and evidence tier.',
    url: 'https://pepnationlab.com/find-a-peptide',
    type: 'website',
    images: [{ url: '/og-card.png', width: 1200, height: 630, alt: 'Find A Research Peptide' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Find A Peptide | Pep Nation Lab',
    description: 'Discover the right research peptide for your goals. 300+ RUO compounds.',
    images: ['/og-card.png'],
  },
};

export default async function FindAPeptidePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isGuest = !user;

  // Resolve profile for authenticated users to find their agent context
  let profile: { role: string; id: string; referring_agent_id: string | null; parent_agent_id: string | null } | null = null;
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('role, id, referring_agent_id, parent_agent_id')
      .eq('id', user.id)
      .maybeSingle();
    profile = data;
  }

  // Resolve agent ID from user context (if signed in)
  let agentId: string | null = null;
  if (profile) {
    if (profile.role === 'researcher' && profile.referring_agent_id) {
      agentId = profile.referring_agent_id;
    } else if ((profile.role === 'agent' || profile.role === 'super_agent')) {
      agentId = profile.parent_agent_id ?? profile.id;
    }
  }

  // Use service client for public product lookups (guests bypass RLS)
  const svc = await createServiceClient();

  let agent = null;

  if (agentId) {
    const { data: ap } = await svc
      .from('agent_profiles')
      .select('id, slug, primary_color')
      .eq('id', agentId)
      .eq('is_active', true)
      .maybeSingle();
    agent = ap;
  }

  // Fallback to the house store - always deterministic, never a random agent.
  // Never use .limit(1) here: that returns whichever agent Postgres picks first
  // (non-deterministic) and could expose another agent's catalog to guests.
  if (!agent) {
    const { data: fallbackAgent } = await svc
      .from('agent_profiles')
      .select('id, slug, primary_color')
      .eq('slug', DEFAULT_STORE_SLUG)
      .eq('is_active', true)
      .maybeSingle();
    agent = fallbackAgent;
  }

  if (!agent) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--black)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-6)' }}>
        <div className="glass-panel" style={{ maxWidth: 480, padding: 'var(--space-8)', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
          <h1 style={{ color: 'var(--white)', fontSize: '1.4rem', marginBottom: 'var(--space-3)' }}>
            Find A Peptide Unavailable
          </h1>
          <p style={{ color: 'var(--silver)', fontSize: '0.92rem' }}>
            No Active Agent Storefront Could Be Resolved At This Time. Please Contact Support.
          </p>
        </div>
      </div>
    );
  }

  const { data: products } = await svc
    .from('agent_products')
    .select(`
      id,
      product_id,
      custom_name,
      custom_description,
      custom_image_url,
      retail_price,
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
        compound_slug
      )
    `)
    .eq('agent_id', agent.id)
    .eq('is_visible', true)
    .order('sort_order');

  const productList = products || [];

  const compoundsBySlug = await getCompoundsBySlugs(
    productList.map((p: any) => p.products?.compound_slug).filter(Boolean) as string[]
  );

  const isStorefrontOwner = !isGuest && profile?.id === agent.id;
  const primaryColor = agent.primary_color ?? '#00C4BC';

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'WebPage',
              '@id': 'https://pepnationlab.com/find-a-peptide#webpage',
              url: 'https://pepnationlab.com/find-a-peptide',
              name: 'Find A Peptide | AI-Powered Research Peptide Finder | Pep Nation Lab',
              description: 'Find the right research peptide for your study goals. Browse 300+ RUO compounds by therapeutic area, mechanism, and evidence tier.',
              isPartOf: { '@id': 'https://pepnationlab.com/#website' },
              publisher: { '@id': 'https://pepnationlab.com/#organization' },
            },
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://pepnationlab.com' },
                { '@type': 'ListItem', position: 2, name: 'Find A Peptide', item: 'https://pepnationlab.com/find-a-peptide' },
              ],
            },
          ],
        }) }}
      />
      <Navbar />
      <div style={{ paddingTop: '60px', minHeight: '100dvh', backgroundColor: '#05070a' }}>
        {/* Crawlable finder content layer - visually hidden (clip-rect).
            The finder itself is client-rendered, so this is the no-JS
            equivalent for search engines and AI crawlers. */}
        <header style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}>
          <h1>Find A Peptide - Match Research Compounds To Your Research Goal</h1>
          <p>
            Discover The Right Research Peptide By Therapeutic Research Area: Weight Loss And
            Metabolism Research (Semaglutide, Tirzepatide, Retatrutide, AOD9604), Healing And
            Recovery (BPC-157, TB-500), Anti-Aging And Longevity (Epithalon, NAD+, GHK-Cu),
            Muscle Growth And Performance (CJC-1295, Ipamorelin, Sermorelin), Skin And Cosmetic
            Research, Immunity And Wellness, And Sexual Health. Answer A Few Questions And The
            Match Engine Recommends Citation-Backed Compounds For In Vitro Laboratory Research.
            Research Use Only - Not For Human Consumption.
          </p>
          <nav aria-label="Finder Resources">
            <a href="/research/areas">Browse By Research Area</a>
            <a href="/research/match">AI Match Engine</a>
            <a href="/research/catalog">Full Compound Catalog</a>
            <a href="/research">Peptide Research Library</a>
          </nav>
        </header>
        <FindAPeptideClient
          products={productList as any}
          agentSlug={agent.slug}
          primaryColor={primaryColor}
          compoundsBySlug={compoundsBySlug}
          isStorefrontOwner={isStorefrontOwner}
          isGuest={isGuest}
        />
      </div>
      <StorefrontCompareDrawer primaryColor={primaryColor} compoundsBySlug={compoundsBySlug} />
      <GuestCTA />
    </>
  );
}
