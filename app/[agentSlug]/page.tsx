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

  // Look up agent by slug
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
      profiles!inner (
        full_name,
        role,
        tier
      )
    `)
    .eq('slug', agentSlug)
    .eq('is_active', true)
    .single();

  if (error || !agent) {
    notFound();
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
      products (
        name,
        description,
        image_url,
        category,
        backorder_days
      )
    `)
    .eq('agent_id', agent.id)
    .eq('is_visible', true)
    .order('sort_order');

  const { data: inventory } = await supabase
    .from('agent_inventory')
    .select('product_id, stock_count')
    .eq('agent_id', agent.id);

  const inventoryMap = new Map(inventory?.map(i => [i.product_id, i.stock_count]) || []);

  const primaryColor = agent.primary_color ?? '#00C4BC';
  const displayName = agent.display_name;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--black)' }}>
      {/* Agent branded navbar */}
      <nav style={{
        height: 64,
        background: 'var(--black-2)',
        borderBottom: `1px solid ${primaryColor}30`,
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
          ) : (
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: `linear-gradient(135deg, ${primaryColor}40, var(--surface-2))`,
              border: `1px solid ${primaryColor}50`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-brand)', fontWeight: 800, fontSize: '0.9rem',
              color: primaryColor
            }}>
              {displayName[0].toUpperCase()}
            </div>
          )}
          <div>
            <div style={{ fontFamily: 'var(--font-brand)', fontSize: '0.9rem', fontWeight: 800, color: primaryColor, letterSpacing: '0.05em' }}>
              {displayName}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--grey-400)' }}>
              Powered By <span style={{ color: 'var(--teal)' }}>Pep Nation Lab</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <Link href={`/login?ref=${agentSlug}`} className="btn btn-secondary btn-sm">Sign In</Link>
          <Link
            href={`/login?ref=${agentSlug}`}
            className="btn btn-sm"
            style={{ background: primaryColor, color: 'var(--black)', fontWeight: 700, border: 'none' }}
          >
            Sign In To Order
          </Link>
        </div>
      </nav>

      {/* Agent Hero */}
      <section style={{
        padding: 'var(--space-16) var(--space-6)',
        textAlign: 'center',
        background: `radial-gradient(ellipse at 50% 0%, ${primaryColor}10 0%, transparent 70%)`
      }}>
        <div className="container" style={{ maxWidth: 640 }}>
          <div className="badge badge-teal" style={{ marginBottom: 'var(--space-4)', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 3h12" />
              <path d="M9 3v6l-5 9a2 2 0 0 0 1.7 3h12.6a2 2 0 0 0 1.7-3l-5-9V3" />
            </svg>
            Research Compounds
          </div>
          <h1 style={{ marginBottom: 'var(--space-4)', color: 'var(--white)' }}>
            {displayName}&apos;s{' '}
            <span style={{ color: primaryColor }}>Research Store</span>
          </h1>
          {agent.tagline && (
            <p style={{ fontSize: '1rem', color: 'var(--silver-light)', marginBottom: 'var(--space-8)', maxWidth: 500, margin: '0 auto var(--space-8)' }}>
              {agent.tagline}
            </p>
          )}
          {agent.bio && (
            <p style={{ fontSize: '0.9rem', color: 'var(--grey-400)', maxWidth: 500, margin: '0 auto var(--space-8)', lineHeight: 1.7 }}>
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
            <strong style={{ color: 'var(--red)' }}>Research Use Only</strong> — Not For Human Consumption
          </div>
        </div>
      </section>

      {/* Products */}
      <section className="section" style={{ paddingTop: 'var(--space-8)' }}>
        <div className="container">
          <h2 style={{ marginBottom: 'var(--space-8)', fontSize: '1.4rem', fontFamily: 'var(--font-brand)', color: 'var(--white)' }}>
            Available Research Compounds
          </h2>
          <AgentStorefrontGrid 
            products={products as any} 
            inventoryMap={Object.fromEntries(inventoryMap)} 
            primaryColor={primaryColor} 
            agentSlug={agentSlug} 
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
    .eq('slug', agentSlug)
    .single();

  if (!agent) return { title: 'Not Found' };

  return {
    title: `${agent.display_name} | Pep Nation Lab`,
    description: agent.tagline ?? `Research compounds from ${agent.display_name} — Research use only.`,
  };
}
