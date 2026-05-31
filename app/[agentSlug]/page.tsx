import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import AgentStorefrontGrid from '@/components/AgentStorefrontGrid';
import AgentStorefrontLogin from '@/components/AgentStorefrontLogin';

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
      logo_url,
      primary_color,
      secondary_color,
      qr_code_url,
      qr_code_data,
      is_active,
      volume_pricing_enabled,
      min_order_qty,
      min_overall_qty
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
        <div className="card-metal hover-lift stagger-fade-in" style={{ maxWidth: 480, padding: 'var(--space-8)', textAlign: 'center', border: `1px solid ${primaryColor}30`, animationDelay: '0.1s' }}>
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
        weight_oz,
        inventory_count,
        low_stock_threshold,
        base_cost
      )
    `)
    .eq('agent_id', agent.id)
    .eq('is_visible', true)
    .order('sort_order');


  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <AgentStorefrontLogin 
        agentSlug={agentSlug} 
        displayName={agent.display_name} 
        primaryColor={agent.primary_color ?? '#00C4BC'} 
        logoUrl={agent.logo_url} 
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
    // If the researcher is logged in but belongs to a DIFFERENT agent,
    // redirect them to THEIR actual storefront instead of showing a login form.
    if (userProfile?.role === 'researcher' && userProfile?.referring_agent_id) {
      const { data: correctAgent } = await supabase
        .from('agent_profiles')
        .select('slug')
        .eq('id', userProfile.referring_agent_id)
        .maybeSingle();

      if (correctAgent?.slug) {
        const { redirect } = await import('next/navigation');
        redirect(`/${correctAgent.slug}`);
      }
    }

    // Not a researcher or no referring agent — show the storefront login form.
    return (
      <AgentStorefrontLogin 
        agentSlug={agentSlug} 
        displayName={agent.display_name} 
        primaryColor={agent.primary_color ?? '#00C4BC'} 
        logoUrl={agent.logo_url} 
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

  // If the viewer is the storefront owner (agent self-buy), fetch their tier
  // multiplier so we can compute cost_price per product for the correct display.
  let viewerTierMultiplier = 1.0;
  if (isStorefrontOwner && userProfile?.tier) {
    const { data: tierRow } = await supabase
      .from('pricing_tiers')
      .select('multiplier')
      .eq('tier_name', userProfile.tier)
      .maybeSingle();
    viewerTierMultiplier = tierRow?.multiplier != null ? Number(tierRow.multiplier) : 1.0;
  }

  // Augment each product with cost_price (= base_cost × viewer tier multiplier)
  // so AgentStorefrontGrid can show the agent their direct tier price on self-buy.
  const productsWithCost = (products ?? []).map(p => {
    const baseCost = (p.products as any)?.base_cost;
    const costPrice = baseCost != null && viewerTierMultiplier > 0
      ? Number(baseCost) * viewerTierMultiplier
      : null;
    return { ...p, cost_price: costPrice };
  });

  const primaryColor = agent.primary_color ?? '#00C4BC';
  const displayName = agent.display_name;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--black)' }}>
      <style dangerouslySetInnerHTML={{__html: `
        .sf-nav { height: 60px; background: var(--black-2); border-bottom: 1px solid rgba(192,184,168,0.2); display: flex; align-items: center; justify-content: space-between; padding: 0 12px; position: sticky; top: 0; z-index: 50; gap: 8px; }
        .sf-nav-brand { display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1; }
        .sf-nav-brand-text { min-width: 0; }
        .sf-nav-brand-name { font-family: var(--font-brand); font-size: 0.85rem; font-weight: 800; color: #C0B8A8; letter-spacing: 0.04em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sf-nav-brand-sub { font-size: 0.62rem; color: var(--grey-400); white-space: nowrap; }
        .sf-nav-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        
        .sf-btn-dash {
          background: linear-gradient(180deg, rgba(40,45,50,0.8) 0%, rgba(15,20,25,0.9) 100%);
          border-radius: 8px; color: var(--white); text-decoration: none;
          border: 1px solid #C0B8A8;
          box-shadow: inset 0 1px 1px rgba(255,255,255,0.2), 0 2px 8px rgba(0,0,0,0.5);
          transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
          display: flex; align-items: center; justify-content: center; width: 88px; height: 34px; font-size: 0.75rem; font-weight: 700; white-space: nowrap;
        }
        .sf-btn-dash:hover {
          transform: translateY(-1px);
          border-color: #DCD4C4;
          box-shadow: inset 0 1px 1px rgba(255,255,255,0.3), 0 4px 12px rgba(0,0,0,0.6);
        }
        .sf-nav-back { display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: transparent; border: none; transition: transform 0.15s, filter 0.15s; }
        .sf-nav-back:hover { transform: scale(1.05); filter: drop-shadow(0 2px 6px rgba(0,0,0,0.5)); }
        
        .sf-btn-cart { 
          display: flex; align-items: center; justify-content: center; width: 88px; height: 34px; font-size: 0.75rem; font-weight: 800; color: #fff; border-radius: 8px; text-decoration: none; white-space: nowrap;
          border: 1px solid #C0B8A8;
          box-shadow: inset 0 2px 4px rgba(255,255,255,0.25), 0 4px 12px rgba(0,0,0,0.5);
          transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
        }
        .sf-btn-cart:hover {
          transform: translateY(-1px);
          border-color: #DCD4C4;
          box-shadow: inset 0 2px 6px rgba(255,255,255,0.35), 0 6px 16px rgba(0,0,0,0.6);
        }

        .sf-hero { padding: 12px 12px 4px; text-align: center; }
        .sf-hero h1 { font-size: 1.3rem; color: var(--white); margin-bottom: 6px; }
        .sf-hero p { font-size: 0.85rem; }
        @media (min-width: 600px) {
          .sf-nav { height: 68px; padding: 0 24px; gap: 12px; }
          .sf-nav-brand-name { font-size: 1rem; }
          .sf-btn-dash, .sf-btn-cart { width: 104px; height: 38px; font-size: 0.85rem; padding: 0; }
          .sf-hero { padding: 24px 24px 8px; }
          .sf-hero h1 { font-size: 1.6rem; }
        }
      `}} />

      {/* Agent branded navbar */}
      <nav className="sf-nav glass-header" style={{ background: 'rgba(10, 16, 24, 0.85)' }}>
        {/* Back button */}
        <Link href="/dashboard" className="sf-nav-back" aria-label="Back to Dashboard">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/back-arrow.png" width={42} height={42} alt="Back" style={{ objectFit: 'contain' }} />
        </Link>

        <div className="sf-nav-brand">
          {agent.logo_url ? (
            <img src={agent.logo_url} alt={displayName} style={{ height: 28, borderRadius: 5, flexShrink: 0 }} />
          ) : null}
          <div className="sf-nav-brand-text">
            <div className="sf-nav-brand-name">{displayName}</div>
          </div>
        </div>

        <div className="sf-nav-actions">
          <Link href="/dashboard" className="sf-btn-dash">Dashboard</Link>
          <Link
            href={`/checkout?agent=${encodeURIComponent(agentSlug)}`}
            className="sf-btn-cart"
            style={{ background: primaryColor }}
          >
            Checkout
          </Link>
        </div>
      </nav>

      <section
        className="sf-hero"
        style={{ background: `radial-gradient(ellipse at 50% 0%, ${primaryColor}10 0%, transparent 70%)` }}
      >
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <h1 className="animated-gradient-text" style={{ marginBottom: 6, color: 'var(--white)' }}>
            {displayName}&apos;s Research Store
          </h1>
        </div>
      </section>

      {/* Products */}
      <section style={{ paddingTop: 8, paddingBottom: 24 }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 8px' }}>
          <Suspense fallback={null}>
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
            />
          </Suspense>
        </div>
      </section>

      {/* Footer powered-by */}
      <footer style={{
        padding: 'var(--space-6)',
        textAlign: 'center',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        marginTop: 'var(--space-6)'
      }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--grey-600)' }}>
          Powered By{' '}
          <Link href="/" style={{ color: 'var(--teal)' }}>Pep Nation Lab</Link>
          {' '}— Research Grade Peptides &amp; Authorized Laboratory Diluents.
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
    description: `Research compounds from ${agent.display_name} — Research use only.`,
  };
}
