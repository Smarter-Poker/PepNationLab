import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

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

  // Get agent's visible products
  const { data: products } = await supabase
    .from('agent_products')
    .select(`
      id,
      custom_name,
      custom_description,
      custom_image_url,
      retail_price,
      products (
        name,
        description,
        category,
        inventory_count,
        in_stock,
        backorder_days,
        low_stock_threshold
      )
    `)
    .eq('agent_id', agent.id)
    .eq('is_visible', true)
    .order('sort_order');

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
            href={`/register?ref=${agentSlug}`}
            className="btn btn-sm"
            style={{ background: primaryColor, color: 'var(--black)', fontWeight: 700, border: 'none' }}
          >
            Create Account
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
          <div className="badge badge-teal" style={{ marginBottom: 'var(--space-4)', fontSize: '0.7rem' }}>
            🔬 Research Compounds
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
          {products && products.length > 0 ? (
            <>
              <h2 style={{ marginBottom: 'var(--space-8)', fontSize: '1.3rem' }}>
                Available Research Compounds
              </h2>
              <div className="grid-3">
                {products.map((item) => {
                  const productRow = (item.products as unknown) as {
                    name: string;
                    description: string;
                    inventory_count: number;
                    in_stock: boolean;
                    backorder_days: number;
                    low_stock_threshold: number;
                  } | null;
                  const name = item.custom_name ?? productRow?.name ?? 'Research Compound';
                  const desc = item.custom_description ?? productRow?.description ?? '';
                  const inStock = productRow?.in_stock ?? true;
                  const inventoryCount = productRow?.inventory_count ?? 0;
                  const backorderDays = productRow?.backorder_days ?? 14;
                  const lowThreshold = productRow?.low_stock_threshold ?? 5;
                  const isLowStock = inStock && inventoryCount <= lowThreshold && inventoryCount > 0;
                  return (
                    <div key={item.id} className="product-card">
                      {/* Product image placeholder */}
                      <div style={{
                        height: 140,
                        background: `radial-gradient(circle at 30% 40%, ${primaryColor}15 0%, var(--surface-2) 70%)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        <svg width="48" height="48" viewBox="0 0 60 60" fill="none" opacity={0.3}>
                          <circle cx="30" cy="30" r="8" fill="none" stroke={primaryColor} strokeWidth="1.5"/>
                          <circle cx="15" cy="15" r="5" fill="none" stroke={primaryColor} strokeWidth="1.5"/>
                          <circle cx="45" cy="15" r="5" fill="none" stroke="var(--silver)" strokeWidth="1.5"/>
                          <circle cx="15" cy="45" r="5" fill="none" stroke="var(--silver)" strokeWidth="1.5"/>
                          <circle cx="45" cy="45" r="5" fill="none" stroke={primaryColor} strokeWidth="1.5"/>
                          <line x1="22" y1="22" x2="30" y2="30" stroke={primaryColor} strokeWidth="1"/>
                          <line x1="38" y1="22" x2="30" y2="30" stroke="var(--silver)" strokeWidth="1"/>
                          <line x1="22" y1="38" x2="30" y2="30" stroke="var(--silver)" strokeWidth="1"/>
                          <line x1="38" y1="38" x2="30" y2="30" stroke={primaryColor} strokeWidth="1"/>
                        </svg>
                      </div>
                      <div className="product-card-body">
                        <h4 style={{ marginBottom: 'var(--space-2)', fontFamily: 'var(--font-brand)' }}>{name}</h4>

                        {/* Shipping Status Badge */}
                        <div style={{ marginBottom: 'var(--space-3)', display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                          <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            fontSize: '0.72rem', fontWeight: 700,
                            padding: '3px 10px',
                            borderRadius: 'var(--radius-full)',
                            background: inStock ? 'rgba(0,196,188,0.1)' : 'rgba(246,173,85,0.1)',
                            border: `1px solid ${inStock ? 'rgba(0,196,188,0.3)' : 'rgba(246,173,85,0.3)'}`,
                            color: inStock ? 'var(--teal)' : '#F6AD55',
                          }}>
                            <span style={{
                              width: 6, height: 6, borderRadius: '50%',
                              background: inStock ? 'var(--teal)' : '#F6AD55',
                              display: 'inline-block',
                              boxShadow: `0 0 4px ${inStock ? 'var(--teal)' : '#F6AD55'}`,
                            }} />
                            {inStock ? 'Ships Now' : `Ships In ${backorderDays} Days`}
                          </div>
                          {isLowStock && (
                            <div style={{
                              fontSize: '0.7rem', fontWeight: 700,
                              padding: '3px 10px',
                              borderRadius: 'var(--radius-full)',
                              background: 'rgba(229,62,62,0.08)',
                              border: '1px solid rgba(229,62,62,0.25)',
                              color: 'var(--red)',
                            }}>
                              Low Stock
                            </div>
                          )}
                        </div>

                        {desc && <p style={{ fontSize: '0.82rem', color: 'var(--grey-400)', marginBottom: 'var(--space-4)', lineHeight: 1.5 }}>{desc}</p>}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '1.1rem', fontWeight: 700, color: primaryColor, fontFamily: 'var(--font-brand)' }}>
                            ${item.retail_price.toFixed(2)}
                          </span>
                          <Link
                            href={`/register?ref=${agentSlug}`}
                            style={{ fontSize: '0.8rem', color: 'var(--teal)', fontWeight: 600 }}
                          >
                            Sign In To Order →
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 'var(--space-12) 0' }}>
              <p style={{ color: 'var(--grey-400)', marginBottom: 'var(--space-6)' }}>
                Products Are Coming Soon. Create An Account To Be Notified.
              </p>
              <Link href={`/register?ref=${agentSlug}`} className="btn btn-primary">
                Create Account
              </Link>
            </div>
          )}
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
