import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import AgentStorefrontGrid from '@/components/AgentStorefrontGrid';

interface Props {
  params: Promise<{ agentSlug: string }>;
}

export default async function AgentStorefrontPage({ params }: Props) {
  const { agentSlug } = await params;
  const supabase = await createClient();

  // Look up agent by slug — case-insensitive since the DB has a UNIQUE on
  // lower(slug). Do NOT filter on is_active here; we want to render a
  // "Storefront Paused" notice rather than 404 when the agent has put the
  // store into vacation mode.
  const { data: agent, error } = await supabase
    .from('agent_profiles')
    .select(`
      id,
      slug,
      display_name,
      tagline,
      logo_url,
      primary_color,
      secondary_color,
      bio,
      qr_code_url,
      qr_code_data,
      is_active,
      volume_pricing_enabled
    `)
    .ilike('slug', agentSlug)
    .single();

  if (error || !agent) {
    notFound();
  }

  if (agent.is_active === false) {
    const primaryColor = agent.primary_color ?? '#00C4BC';
    return (
      <div style={{ minHeight: '100vh', background: 'var(--black)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-6)' }}>
        <div className="card-metal" style={{ maxWidth: 480, padding: 'var(--space-8)', textAlign: 'center', border: `1px solid ${primaryColor}30` }}>
          <h1 style={{ color: 'var(--white)', fontSize: '1.4rem', marginBottom: 'var(--space-3)' }}>
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

  const { data: products } = await supabase
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
        inventory_count,
        low_stock_threshold
      )
    `)
    .eq('agent_id', agent.id)
    .eq('is_visible', true)
    .order('sort_order');

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // Note: We MUST use dynamic import or just render the client component directly.
    // The component is already marked 'use client'
    const AgentStorefrontLogin = (await import('@/components/AgentStorefrontLogin')).default;
    return (
      <AgentStorefrontLogin 
        agentSlug={agentSlug} 
        displayName={agent.display_name} 
        primaryColor={agent.primary_color ?? '#00C4BC'} 
        logoUrl={agent.logo_url} 
        tagline={agent.tagline} 
      />
    );
  }

  // Check if logged-in user belongs to THIS agent — CRITICAL SECURITY GATE
  const { data: userProfile } = await supabase
    .from('profiles')
    .select('role, referring_agent_id, parent_agent_id, id, tier')
    .eq('id', user.id)
    .single();

  // Determine if user has access to this specific storefront
  const isAdmin = userProfile?.role === 'admin';
  const isStorefrontOwner = userProfile?.id === agent.id;
  const isSubAgent = userProfile?.role === 'agent' && userProfile?.parent_agent_id === agent.id;
  const isDownlineResearcher = userProfile?.role === 'researcher' && userProfile?.referring_agent_id === agent.id;

  const hasAccess = isAdmin || isStorefrontOwner || isSubAgent || isDownlineResearcher;

  if (!hasAccess) {
    // Sign the user out of this session so they can't keep refreshing
    await supabase.auth.signOut();
    const AgentStorefrontLogin = (await import('@/components/AgentStorefrontLogin')).default;
    return (
      <AgentStorefrontLogin 
        agentSlug={agentSlug} 
        displayName={agent.display_name} 
        primaryColor={agent.primary_color ?? '#00C4BC'} 
        logoUrl={agent.logo_url} 
        tagline={agent.tagline}
        errorMessage="This Account Does Not Belong To This Store. Please Sign In With The Credentials Your Agent Gave You, Or Create A New Account."
      />
    );
  }

  const { data: inventory } = await supabase
    .from('agent_inventory')
    .select('product_id, stock_count')
    .eq('agent_id', agent.id);

  const inventoryMap = new Map(inventory?.map(i => [i.product_id, i.stock_count]) || []);

  // Most-recent active lot with an attached COA, per product currently in the
  // storefront. Used to render the "View Certificate Of Analysis" link in the
  // product detail modal.
  const productIds = (products ?? [])
    .map(p => p.product_id)
    .filter((v): v is string => !!v);
  const coaByProductId: Record<string, string> = {};
  if (productIds.length > 0) {
    const { data: lots } = await supabase
      .from('product_lots')
      .select('product_id, coa_storage_key, received_at')
      .in('product_id', productIds)
      .eq('is_active', true)
      .not('coa_storage_key', 'is', null)
      .order('received_at', { ascending: false });
    for (const row of lots ?? []) {
      if (!row.coa_storage_key) continue;
      if (coaByProductId[row.product_id]) continue; // keep most recent only
      const { data: pub } = supabase.storage
        .from('product-coas')
        .getPublicUrl(row.coa_storage_key);
      if (pub?.publicUrl) coaByProductId[row.product_id] = pub.publicUrl;
    }
  }

  let initialWishlistIds: string[] = [];
  if (userProfile?.role === 'researcher') {
    const { data: favRows } = await supabase
      .from('researcher_favorites')
      .select('product_id')
      .eq('user_id', user.id);
    initialWishlistIds = (favRows ?? []).map(r => r.product_id);
  }

  const primaryColor = agent.primary_color ?? '#00C4BC';
  const displayName = agent.display_name;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--black)' }}>
      {/* Agent branded navbar */}
      <nav style={{
        height: 64,
        background: 'var(--black-2)',
        borderBottom: '1px solid rgba(192,184,168,0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 var(--space-6)',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          {agent.logo_url ? (
            <img src={agent.logo_url} alt={displayName} style={{ height: 36, borderRadius: 6 }} />
          ) : null}
          <div>
            <div style={{ fontFamily: 'var(--font-brand)', fontSize: '0.9rem', fontWeight: 800, color: '#C0B8A8', letterSpacing: '0.05em' }}>
              {displayName}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--grey-400)' }}>
              Powered By <span style={{ color: '#C0B8A8' }}>Pep Nation Lab</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <Link href="/dashboard" className="btn btn-secondary btn-sm">My Dashboard</Link>
          <Link
            href="/checkout"
            className="btn btn-sm"
            style={{ background: primaryColor, color: '#fff', fontWeight: 700, border: 'none' }}
          >
            Checkout
          </Link>
        </div>
      </nav>

      <section style={{
        padding: 'var(--space-6) var(--space-6) var(--space-2)',
        textAlign: 'center',
        background: `radial-gradient(ellipse at 50% 0%, ${primaryColor}10 0%, transparent 70%)`
      }}>
        <div className="container" style={{ maxWidth: 640 }}>
          <h1 style={{ marginBottom: 'var(--space-3)', color: 'var(--white)', fontSize: '1.6rem' }}>
            {displayName}&apos;s Research Store
          </h1>
          {agent.tagline && (
            <p style={{ fontSize: '1rem', color: 'var(--silver-light)', marginBottom: 'var(--space-4)', maxWidth: 500, margin: '0 auto var(--space-4)' }}>
              {agent.tagline}
            </p>
          )}
          {agent.bio && (
            <p style={{ fontSize: '0.9rem', color: 'var(--grey-400)', maxWidth: 500, margin: '0 auto var(--space-4)', lineHeight: 1.7 }}>
              {agent.bio}
            </p>
          )}

          {/* Research-only warning */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
            background: 'rgba(229,62,62,0.06)', border: '1px solid rgba(229,62,62,0.2)',
            borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-4)',
            fontSize: '0.78rem', color: 'var(--grey-400)'
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <strong style={{ color: 'var(--red)' }}>Research Use Only</strong> Not For Human Consumption
          </div>
        </div>
      </section>

      {/* Products */}
      <section className="section" style={{ paddingTop: 'var(--space-2)' }}>
        <div className="container">
          <AgentStorefrontGrid
            products={products as any}
            inventoryMap={Object.fromEntries(inventoryMap)}
            primaryColor={primaryColor}
            agentSlug={agentSlug}
            initialWishlistIds={initialWishlistIds}
            agentId={agent.id}
            coaByProductId={coaByProductId}
            volumePricingEnabled={(agent as any).volume_pricing_enabled !== false}
            isStorefrontOwner={isStorefrontOwner}
            viewerTier={(userProfile as any)?.tier ?? 'tier_3'}
          />
        </div>
      </section>

      {/* Footer powered-by */}
      <footer style={{
        padding: 'var(--space-6)',
        textAlign: 'center',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        marginTop: 'var(--space-12)'
      }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--grey-600)' }}>
          Powered By{' '}
          <Link href="/" style={{ color: 'var(--teal)' }}>Pep Nation Lab</Link>
          {' '}— Research Use Only. Not For Human Consumption.
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
    .select('display_name, tagline')
    .ilike('slug', agentSlug)
    .single();

  if (!agent) return { title: 'Not Found' };

  return {
    title: `${agent.display_name} | Pep Nation Lab`,
    description: agent.tagline ?? `Research compounds from ${agent.display_name} — Research use only.`,
  };
}
