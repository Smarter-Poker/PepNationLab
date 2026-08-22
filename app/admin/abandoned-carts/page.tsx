export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';

export const metadata = { title: 'Abandoned Carts', robots: { index: false, follow: false } };

export default async function AdminAbandonedCartsPage({ searchParams }: { searchParams: { days?: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) redirect('/dashboard');

  const daysRaw = Number(searchParams.days);
  const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(90, Math.trunc(daysRaw))) : 30;

  const svc = await createServiceClient();
  const { data: carts, error } = await svc.rpc('get_abandoned_carts', { p_agent_id: null, p_days: days });

  const data = carts || [];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '1.5rem 1rem 3rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="animated-gradient-text" style={{ fontSize: '1.6rem', margin: 0 }}>Abandoned Carts</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)', marginTop: 6, marginBottom: 0 }}>
            Recent incomplete checkouts over the last {days} days.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[7, 14, 30, 90].map(w => (
            <a key={w} href={`/admin/abandoned-carts?days=${w}`}
              style={{
                display: 'inline-block', padding: '6px 12px', borderRadius: 999, fontWeight: 700, fontSize: '0.78rem',
                color: days === w ? '#04231F' : '#CBD5E1',
                background: days === w ? 'linear-gradient(180deg,#2fe0c9,#12b3a0)' : 'rgba(255,255,255,0.06)',
                border: days === w ? 'none' : '1px solid rgba(255,255,255,0.15)',
                textDecoration: 'none'
              }}>{w}d</a>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(229,62,62,0.12)', border: '1px solid rgba(229,62,62,0.4)', color: '#FFFFFF', padding: '10px 14px', borderRadius: 8, marginBottom: 16 }}>
          Could not load abandoned carts: {error.message}
        </div>
      )}

      {!error && data.length === 0 && (
        <div style={{ color: 'var(--grey-500)', textAlign: 'center', padding: '3rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid var(--silver-dark)' }}>
          No abandoned carts found in this time period.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
        {data.map((cart: any, i: number) => (
          <div key={i} style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--silver)', marginBottom: 12, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <span style={{ color: 'var(--grey-400)' }}>Last Active:</span><br />
                <span style={{ color: 'var(--white)' }}>{new Date(cart.last_active).toLocaleString()}</span>
                <div style={{ marginTop: 4 }}>
                  <span style={{ color: 'var(--grey-400)' }}>Session:</span> <span style={{ fontFamily: 'monospace' }}>{cart.session_id.substring(0, 8)}...</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ color: 'var(--teal)', fontWeight: 'bold', fontSize: '0.9rem' }}>{cart.user_name || 'Guest'}</span>
                {cart.user_email && (
                  <>
                    <br />
                    <span style={{ color: 'var(--grey-400)' }}>{cart.user_email}</span>
                  </>
                )}
              </div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: 8, flex: 1 }}>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--white)', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {cart.items.map((item: any, j: number) => (
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
        ))}
      </div>
    </div>
  );
}
