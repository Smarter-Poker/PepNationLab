import { createServiceClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';

export const revalidate = 0; // Don't cache shared links statically

export default async function SharedProtocolPage({
  params
}: {
  params: Promise<{ agentSlug: string; protocolId: string }>
}) {
  const { agentSlug, protocolId } = await params;
  const brandId = agentSlug;

  // 1. Fetch the shared protocol payload
  const supabase = await createServiceClient();
  const { data: protocol, error } = await supabase
    .from('shared_research_protocols')
    .select('payload')
    .eq('id', protocolId)
    .maybeSingle();

  if (error || !protocol || !protocol.payload) {
    return notFound();
  }

  // 2. Fetch agent config
  const { data: config } = await supabase
    .from('agent_profiles')
    .select('id, name:display_name, slug, primary_color')
    .eq('slug', brandId)
    .maybeSingle();

  if (!config) {
    return notFound();
  }

  // Parse the payload
  const payload = protocol.payload as {
    results: any[];
    excluded: any[];
    goalSummary: string;
  };

  // 3. Fetch products to map the protocol
  const productIds = payload.results.map(r => r.product_id).filter(Boolean);
  let agentProducts: any[] = [];
  if (productIds.length > 0) {
    const { data } = await supabase
      .from('agent_products')
      .select('*, products(*)')
      .in('product_id', productIds)
      .eq('agent_id', config.id);
    if (data) agentProducts = data;
  }

  return (
    <main style={{ minHeight: '100dvh', background: '#0A1018', color: '#FFF' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 20px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: 8, color: config.primary_color || '#C0C5CE' }}>
          Shared AI Match Protocol
        </h1>
        <p style={{ color: '#A8B4C0', fontSize: '1.1rem', marginBottom: 40, lineHeight: 1.5 }}>
          Goal: <span style={{ color: '#FFF', fontWeight: 600 }}>{payload.goalSummary}</span>
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {payload.results.map((r: any, i: number) => {
            const product = agentProducts.find(p => p.product_id === r.product_id);
            if (!product) return null; // Not stocked by this agent

            return (
              <div key={i} style={{ padding: 24, background: 'rgba(255,255,255,0.03)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 8px 0' }}>{r.displayName}</h2>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {r.evidenceTier && (
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', padding: '4px 8px', borderRadius: 8, background: 'rgba(192,197,206,0.15)', color: '#C0C5CE' }}>
                          {r.evidenceTier.replace(/_/g, ' ')}
                        </span>
                      )}
                      {r.isStackPartner && (
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', padding: '4px 8px', borderRadius: 8, background: 'rgba(246,173,85,0.15)', color: '#F6AD55' }}>
                          Synergistic Stack
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: config.primary_color || '#C0C5CE' }}>
                    ${(product.retail_price / 100).toFixed(2)}
                  </div>
                </div>

                <div style={{ color: '#A8B4C0', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: 20 }}>
                  <strong style={{ color: '#E2E8F0' }}>Why this match:</strong> {r.rationale}
                </div>

                {r.scoreBreakdown && (
                  <div style={{ marginBottom: 20, fontSize: '0.85rem', color: '#A8B4C0', background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 12 }}>
                    <strong>Score: {r.score}%</strong> (Base: {r.scoreBreakdown.base}, Keywords: {r.scoreBreakdown.keyword}, Evidence Bonus: {r.scoreBreakdown.evidenceBonus}, Class: {r.scoreBreakdown.classBonus})
                  </div>
                )}

                {/* NOTE: We fire a custom event to add to the cart layer if it's mounted, 
                    but since this is a dedicated page, we might just redirect to the storefront with a cart intent parameter.
                    For now, we'll link to the storefront home. */}
                <a 
                  href={`/${brandId}?product=${product.id}`}
                  style={{
                    display: 'inline-flex', padding: '12px 24px', background: config.primary_color || '#C0C5CE',
                    color: '#0A1018', fontWeight: 800, borderRadius: 12, textDecoration: 'none'
                  }}
                >
                  Buy on {config.name}
                </a>
              </div>
            );
          })}
        </div>

        {payload.excluded && payload.excluded.length > 0 && (
          <div style={{ marginTop: 48, padding: 24, background: 'rgba(255,0,0,0.05)', borderRadius: 20, border: '1px solid rgba(255,0,0,0.15)' }}>
            <h3 style={{ color: '#FC8181', fontSize: '1.2rem', fontWeight: 900, marginBottom: 16 }}>Excluded from this protocol</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {payload.excluded.map((e: any, idx: number) => (
                <div key={idx} style={{ display: 'flex', gap: 16 }}>
                  <span style={{ color: '#FFF', fontWeight: 700, minWidth: 150 }}>{e.displayName}</span>
                  <span style={{ color: '#FC8181' }}>{e.reason}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: 48, textAlign: 'center' }}>
          <a 
            href={`/${brandId}`}
            style={{ color: config.primary_color || '#C0C5CE', fontWeight: 700, textDecoration: 'none' }}
          >
            ← Back to Storefront
          </a>
        </div>
      </div>
    </main>
  );
}
