'use client';

import { useCallback, useEffect, useState } from 'react';
import SiteTrafficDrilldownDrawer from './SiteTrafficDrilldownDrawer';

interface Totals {
  pageviews: number; visitors: number; product_views: number; searches: number;
  add_to_cart: number; checkout_start: number; orders: number; signups: number; gmv_cents: number;
  abandoned_carts?: number;
}
interface TrafficData {
  days: number;
  scope: 'global' | 'agent';
  totals: Totals;
  trend: Array<{ day: string; pageviews: number; visitors: number }>;
  top_searches: Array<{ term: string; n: number }>;
  top_products: Array<{ product_id: string; name: string; n: number }>;
  top_storefronts: Array<{ agent_id: string; name: string; pageviews: number }>;
}

const WINDOWS = [7, 14, 30, 90];

function nf(n: number) { return (Number(n) || 0).toLocaleString('en-US'); }
function money(cents: number) { return `$${((Number(cents) || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

export default function TrafficDashboard({ endpoint, heading, subheading }: { endpoint: string; heading: string; subheading?: string }) {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<TrafficData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Drilldown state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<any>(null);

  const load = useCallback(async (d: number) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${endpoint}?days=${d}`, { cache: 'no-store' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || 'Could Not Load Traffic');
      setData(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could Not Load Traffic');
    } finally { setLoading(false); }
  }, [endpoint]);

  useEffect(() => { load(days); }, [load, days]);

  const t = data?.totals;
  const convRate = t && t.visitors > 0 ? ((t.orders / t.visitors) * 100) : 0;
  const maxPv = Math.max(1, ...(data?.trend ?? []).map(d => d.pageviews));

  const tiles: Array<{ id: string; label: string; value: string; accent?: boolean; clickable?: boolean }> = t ? [
    { id: 'visitors', label: 'Unique Visitors', value: nf(t.visitors), accent: true, clickable: true },
    { id: 'pageviews', label: 'Pageviews', value: nf(t.pageviews), clickable: true },
    { id: 'signups', label: 'New Sign-Ups', value: nf(t.signups), accent: true, clickable: true },
    { id: 'product_views', label: 'Product Views', value: nf(t.product_views), clickable: true },
    { id: 'searches', label: 'Searches', value: nf(t.searches), clickable: true },
    { id: 'add_to_cart', label: 'Add To Cart', value: nf(t.add_to_cart), clickable: true },
    { id: 'checkout_start', label: 'Checkouts Started', value: nf(t.checkout_start), clickable: true },
    { id: 'orders', label: 'Orders', value: nf(t.orders), clickable: true },
    { id: 'abandoned_carts', label: 'Abandoned Carts', value: nf(t.abandoned_carts || 0), accent: true, clickable: true },
    { id: 'gmv', label: 'GMV', value: money(t.gmv_cents), clickable: false },
    { id: 'conversion', label: 'Visitor → Order', value: `${convRate.toFixed(1)}%`, clickable: false },
  ] : [];

  const funnel = t ? [
    { label: 'Visitors', value: t.visitors },
    { label: 'Product Views', value: t.product_views },
    { label: 'Add To Cart', value: t.add_to_cart },
    { label: 'Checkout', value: t.checkout_start },
    { label: 'Orders', value: t.orders },
  ] : [];
  const funnelMax = Math.max(1, ...funnel.map(f => f.value));

  const card: React.CSSProperties = { background: 'rgba(255,255,255,0.02)', border: '1px solid var(--silver-dark)', borderRadius: 12, padding: 'var(--space-4)' };

  const handleTileClick = (tile: any) => {
    if (!tile.clickable) return;
    if (tile.id === 'abandoned_carts') {
      if (endpoint.includes('admin')) {
        window.location.href = '/admin/abandoned-carts';
        return;
      }
      // If it's an agent, they can keep using the drawer (fallback)
    }
    setSelectedMetric(tile.id);
    setDrawerOpen(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <h1 className="animated-gradient-text" style={{ color: 'var(--white)', fontSize: '1.5rem', marginBottom: 4 }}>{heading}</h1>
          {subheading && <p style={{ color: 'var(--silver)', fontSize: '0.9rem', margin: 0 }}>{subheading}</p>}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {WINDOWS.map(w => (
            <button key={w} type="button" onClick={() => setDays(w)}
              style={{
                cursor: 'pointer', padding: '6px 12px', borderRadius: 999, fontWeight: 700, fontSize: '0.78rem',
                color: days === w ? '#04231F' : '#CBD5E1',
                background: days === w ? 'linear-gradient(180deg,#2fe0c9,#12b3a0)' : 'rgba(255,255,255,0.06)',
                border: days === w ? 'none' : '1px solid rgba(255,255,255,0.15)',
              }}>{w}d</button>
          ))}
        </div>
      </div>

      {error && <div style={{ ...card, color: 'var(--red)', borderColor: 'rgba(229,62,62,0.4)' }}>{error}</div>}
      {loading && !data && <div style={{ ...card, color: 'var(--grey-400)' }}>Loading traffic…</div>}

      {data && (
        <>
          {/* Stat tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-3)' }}>
            {tiles.map(s => (
              <div 
                key={s.label} 
                onClick={() => handleTileClick(s)}
                style={{ 
                  ...card, 
                  textAlign: 'center', 
                  cursor: s.clickable ? 'pointer' : 'default',
                  transition: 'transform 0.15s ease, background 0.15s ease',
                }}
                onMouseEnter={e => {
                  if (s.clickable) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                  }
                }}
                onMouseLeave={e => {
                  if (s.clickable) {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                  }
                }}
              >
                <div style={{ color: s.accent ? 'var(--teal)' : 'var(--white)', fontWeight: 800, fontSize: '1.5rem' }}>{s.value}</div>
                <div style={{ color: 'var(--grey-400)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>
                  {s.label} {s.clickable && '↗'}
                </div>
              </div>
            ))}
          </div>

          {/* Trend + Funnel */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
            <div style={card}>
              <h3 style={{ color: 'var(--white)', fontSize: '0.95rem', margin: '0 0 var(--space-3)' }}>Pageviews Per Day</h3>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120 }}>
                {data.trend.length === 0 && <span style={{ color: 'var(--grey-500)', fontSize: '0.8rem' }}>No data in this window.</span>}
                {data.trend.map(d => (
                  <div key={d.day} title={`${d.day}: ${d.pageviews} views, ${d.visitors} visitors`}
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 3 }}>
                    <div style={{ width: '100%', height: `${(d.pageviews / maxPv) * 100}%`, minHeight: 2,
                      background: 'linear-gradient(180deg,#2fe0c9,#12b3a0)', borderRadius: '3px 3px 0 0' }} />
                    <span style={{ fontSize: '0.6rem', color: 'var(--grey-500)' }}>{d.day.slice(5)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={card}>
              <h3 style={{ color: 'var(--white)', fontSize: '0.95rem', margin: '0 0 var(--space-3)' }}>Conversion Funnel</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {funnel.map(f => (
                  <div key={f.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--silver)', marginBottom: 3 }}>
                      <span>{f.label}</span><span style={{ fontWeight: 700, color: 'var(--white)' }}>{nf(f.value)}</span>
                    </div>
                    <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${(f.value / funnelMax) * 100}%`, height: '100%', background: 'linear-gradient(90deg,#12b3a0,#2fe0c9)' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top lists */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
            {data.scope === 'global' && (
              <div style={card}>
                <h3 style={{ color: 'var(--white)', fontSize: '0.95rem', margin: '0 0 var(--space-3)' }}>Top Storefronts</h3>
                {data.top_storefronts.length === 0 ? <p style={{ color: 'var(--grey-500)', fontSize: '0.8rem', margin: 0 }}>No traffic yet.</p> :
                  data.top_storefronts.map(s => (
                    <div key={s.agent_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '0.85rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ color: 'var(--silver-light)' }}>{s.name}</span>
                      <span style={{ color: 'var(--teal)', fontWeight: 700 }}>{nf(s.pageviews)}</span>
                    </div>
                  ))}
              </div>
            )}
            <div style={card}>
              <h3 style={{ color: 'var(--white)', fontSize: '0.95rem', margin: '0 0 var(--space-3)' }}>Top Searches</h3>
              {data.top_searches.length === 0 ? <p style={{ color: 'var(--grey-500)', fontSize: '0.8rem', margin: 0 }}>No searches yet.</p> :
                data.top_searches.map(s => (
                  <div key={s.term} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '0.85rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ color: 'var(--silver-light)' }}>{s.term}</span>
                    <span style={{ color: 'var(--teal)', fontWeight: 700 }}>{nf(s.n)}</span>
                  </div>
                ))}
            </div>
            <div style={card}>
              <h3 style={{ color: 'var(--white)', fontSize: '0.95rem', margin: '0 0 var(--space-3)' }}>Top Viewed Products</h3>
              {data.top_products.length === 0 ? <p style={{ color: 'var(--grey-500)', fontSize: '0.8rem', margin: 0 }}>No product views yet.</p> :
                data.top_products.map(p => (
                  <div key={p.product_id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '5px 0', fontSize: '0.85rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ color: 'var(--silver-light)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                    <span style={{ color: 'var(--teal)', fontWeight: 700, flexShrink: 0 }}>{nf(p.n)}</span>
                  </div>
                ))}
            </div>
          </div>
          <p style={{ color: 'var(--grey-500)', fontSize: '0.72rem', margin: 0 }}>
            Since the account-required lockdown, visitors are researchers who have signed in. Data updates in real time from storefront events.
          </p>

          <SiteTrafficDrilldownDrawer 
            isOpen={drawerOpen} 
            onClose={() => setDrawerOpen(false)} 
            metric={selectedMetric}
            days={days}
            drilldownEndpoint={`${endpoint}/drilldown`}
            agentId={data.scope === 'agent' ? endpoint.includes('agent') ? undefined : undefined : undefined} 
          />
        </>
      )}
    </div>
  );
}
