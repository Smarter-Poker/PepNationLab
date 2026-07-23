export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';

export const metadata = { title: 'Abandoned Carts | Agent Dashboard' };

export default async function AgentAbandonedCartsPage({
  searchParams,
}: {
  searchParams: { days?: string };
}) {
  const gate = await requireAgent();
  if (!gate.ok) redirect('/dashboard');
  const user = gate.user;

  const days = parseInt(searchParams.days || '30', 10);
  const svc = await createServiceClient();

  const { data: carts, error } = await svc.rpc('get_abandoned_carts', { p_agent_id: user.id, p_days: days });

  return (
    <div style={{ minHeight: '100dvh', background: '#050A0F', color: '#FFF' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px' }}>
        
        <header style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ margin: '0 0 8px', fontSize: '1.8rem', fontWeight: 900 }}>My Abandoned Carts</h1>
            <p style={{ margin: 0, color: 'var(--silver)', fontSize: '0.9rem' }}>
              Recent Incomplete Checkouts On Your Storefront Over The Last {days} Days.
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: 8, background: 'rgba(255,255,255,0.05)', padding: 4, borderRadius: 24, border: '1px solid rgba(255,255,255,0.1)' }}>
            {[7, 14, 30, 90].map(d => (
              <a
                key={d}
                href={`?days=${d}`}
                style={{
                  padding: '6px 14px',
                  borderRadius: 20,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textDecoration: 'none',
                  color: d === days ? '#050A0F' : '#FFF',
                  background: d === days ? 'var(--teal)' : 'transparent',
                }}
              >
                {d}d
              </a>
            ))}
          </div>
        </header>

        {error ? (
          <div style={{ color: 'var(--red-400)', padding: 24, background: 'rgba(248,113,113,0.1)', borderRadius: 12, border: '1px solid rgba(248,113,113,0.2)' }}>
            Error loading abandoned carts. Please try again.
          </div>
        ) : !carts || carts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 24px', background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px dashed rgba(255,255,255,0.1)' }}>
            <h3 style={{ margin: '0 0 8px', color: 'var(--silver)' }}>No Abandoned Carts</h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)' }}>
              We couldn't find any incomplete checkouts on your storefront for the selected period.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
            {carts.map((cart: any, i: number) => {
              const lastActive = new Date(cart.last_active);
              const items = cart.items || [];
              
              return (
                <div key={i} style={{ 
                  background: 'rgba(255,255,255,0.03)', 
                  border: '1px solid rgba(255,255,255,0.08)', 
                  borderRadius: 12,
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--silver)', marginBottom: 4 }}>Last Active:</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                        {lastActive.toLocaleDateString()} {lastActive.toLocaleTimeString()}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginTop: 8, fontFamily: 'monospace' }}>
                        Session: {cart.session_id.split('-')[0]}...
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ color: 'var(--teal)', fontWeight: 'bold', fontSize: '0.9rem' }}>{cart.user_name || 'Guest'}</span>
                      {cart.user_email && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--silver)', marginTop: 4 }}>
                          <a href={`mailto:${cart.user_email}`} style={{ color: 'inherit', textDecoration: 'none' }}>{cart.user_email}</a>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ 
                    background: 'rgba(0,0,0,0.2)', 
                    borderRadius: 8, 
                    padding: 16,
                    flex: 1
                  }}>
                    <ul style={{ margin: 0, paddingLeft: 20, fontSize: '0.85rem', color: '#EEE', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {items.map((item: any, j: number) => (
                        <li key={j}>
                          <strong>{item.quantity}x</strong> {item.name}
                          {item.added_at && (
                            <div style={{ color: 'var(--grey-500)', fontSize: '0.75rem', marginTop: 2 }}>
                              Added: {new Date(item.added_at).toLocaleString()}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
