import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getCompoundsBySlugs } from '@/lib/compounds-server';
import Navbar from '@/components/Navbar';
import StorefrontCompareDrawer from '@/components/storefront/StorefrontCompareDrawer';
import FindAPeptideClient from '@/components/storefront/FindAPeptideClient';
import GuestCTA from '@/components/GuestCTA';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Find A Peptide | Pep Nation Lab',
  description: 'Find peptides by your research goal using the match engine.',
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

  // Fallback to default active agent for guests or users without an assigned agent
  if (!agent) {
    const { data: fallbackAgent } = await svc
      .from('agent_profiles')
      .select('id, slug, primary_color')
      .eq('is_active', true)
      .limit(1)
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
      <Navbar />
      <div style={{ paddingTop: '60px', minHeight: '100dvh', backgroundColor: '#05070a' }}>
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
