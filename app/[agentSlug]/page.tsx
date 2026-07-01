import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import Link from 'next/link';
import AgentStorefrontGrid from '@/components/AgentStorefrontGrid';
import AgentStorefrontLogin from '@/components/AgentStorefrontLogin';
import { getCompoundsBySlugs } from '@/lib/compounds-server';
import { computeAgentCostForAgent, type AgentTier } from '@/lib/pricing';
import CouponLinkCapture from '@/components/CouponLinkCapture';
import StorefrontRenameBanner from '@/components/StorefrontRenameBanner';
import PageLoader from '@/components/PageLoader';
import Navbar from '@/components/Navbar';
import StorefrontSkeleton from '@/components/StorefrontSkeleton';

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

  // ── Fetch products and auth user in parallel ─────────────────────────────────
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

  // if (!user) {
  //   return (
  //     <AgentStorefrontLogin 
  //       agentSlug={agentSlug} 
  //       displayName={agent.display_name} 
  //       primaryColor={agent.primary_color ?? '#00C4BC'} 
  //       logoUrl={agent.logo_url} 
  //     />
  //   );
  // }

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
      .single();
    userProfile = (viewerProfile as ViewerProfile | null) ?? null;
  }
  const isStorefrontOwner = !!user && userProfile?.id === agent.id;

  // ── Run independent queries in parallel - saves ~2 sequential round-trips ──
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

  return (
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
    .ilike('slug', agentSlug)
    .single();

  if (error || !agent) {
    notFound();
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

  // We need user context JUST to determine the top navbar icons and rename banner,
  // which is fine since getUser() is extremely fast (uses cookies)
  // compared to resolving 50 product DB calls.
  const { data: { user } } = await supabase.auth.getUser();
  let userProfile = null;
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('role, id')
      .eq('id', user.id)
      .single();
    userProfile = data;
  }
  const isStorefrontOwner = userProfile?.id === agent.id;
  const dashLink = userProfile?.role === 'admin'
    ? '/admin'
    : (userProfile?.role === 'agent' || userProfile?.role === 'super_agent')
    ? '/dashboard/agent'
    : '/dashboard';

  const primaryColor = agent.primary_color ?? '#00C4BC';
  const displayName = agent.display_name;
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
      <Navbar agentSlug={agentSlug} />
      <div style={{ height: 60 }} />

      {showRenameBanner ? (
        <StorefrontRenameBanner
          agentId={agent.id}
          currentName={agent.display_name}
          settingsUrl="/dashboard/agent?tab=Storefront+Config"
        />
      ) : null}

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

    </div>
  );
}

export async function generateMetadata({ params }: Props) {
  const { agentSlug } = await params;
  const supabase = await createClient();
  const { data: agent } = await supabase
    .from('agent_profiles')
    .select('display_name')
    .ilike('slug', agentSlug)
    .single();

  if (!agent) return { title: 'Not Found' };

  return {
    title: `${agent.display_name} | Pep Nation Lab`,
    description: `Research compounds from ${agent.display_name} - Research use only.`,
  };
}
