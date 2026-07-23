'use client';

import { useEffect, useState } from 'react';

type DrilldownMetric = 'pageviews' | 'visitors' | 'product_views' | 'searches' | 'add_to_cart' | 'checkout_start' | 'orders' | 'signups' | 'abandoned_carts';

interface DrilldownDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  metric: DrilldownMetric | null;
  days: number;
  agentId?: string;
  drilldownEndpoint?: string;
}

export default function SiteTrafficDrilldownDrawer({ isOpen, onClose, metric, days, agentId, drilldownEndpoint = '/api/admin/traffic/drilldown' }: DrilldownDrawerProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && metric) {
      setLoading(true);
      setError(null);
      let url = `${drilldownEndpoint}?metric=${metric}&days=${days}`;
      if (agentId) url += `&agent_id=${agentId}`;

      fetch(url)
        .then(res => {
          if (!res.ok) throw new Error('Failed to load detailed data.');
          return res.json();
        })
        .then(json => setData(json))
        .catch(e => setError(e.message))
        .finally(() => setLoading(false));
    }
  }, [isOpen, metric, days, agentId]);

  if (!isOpen) return null;

  const metricTitles: Record<DrilldownMetric, string> = {
    pageviews: 'Recent Pageviews',
    visitors: 'Recent Unique Visitors',
    product_views: 'Recent Product Views',
    searches: 'Recent Searches',
    add_to_cart: 'Recent Add to Cart Events',
    checkout_start: 'Recent Checkout Starts',
    orders: 'Recent Orders',
    signups: 'Recent Sign-ups',
    abandoned_carts: 'Abandoned Carts',
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      zIndex: 99999, display: 'flex', justifyContent: 'flex-end',
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)'
    }} onClick={onClose}>
      <div 
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '600px', height: '100%', background: '#0a101d',
          borderLeft: '1px solid var(--silver-dark)', padding: 'var(--space-4)',
          overflowY: 'auto', display: 'flex', flexDirection: 'column'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ margin: 0, color: 'var(--white)', fontSize: '1.2rem' }}>
            {metric ? metricTitles[metric] : 'Details'}
          </h2>
          <button 
            onClick={onClose}
            style={{ 
              background: 'transparent', border: 'none', color: 'var(--silver)', 
              fontSize: '1.5rem', cursor: 'pointer' 
            }}
          >
            &times;
          </button>
        </div>

        {loading && <div style={{ color: 'var(--grey-400)' }}>Loading data...</div>}
        {error && <div style={{ color: 'var(--red)', padding: '1rem', border: '1px solid var(--red)', borderRadius: 8 }}>{error}</div>}
        
        {!loading && !error && data.length === 0 && (
          <div style={{ color: 'var(--grey-500)' }}>No recent data found for this metric.</div>
        )}

        {!loading && !error && data.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {metric === 'abandoned_carts' && data.map((cart: any, i: number) => (
              <div key={i} style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--silver)', marginBottom: 8 }}>
                  Last Active: {new Date(cart.last_active).toLocaleString()}
                  <br />
                  Session: <span style={{ fontFamily: 'monospace' }}>{cart.session_id.substring(0, 8)}...</span>
                </div>
                <ul style={{ margin: 0, paddingLeft: '1rem', color: 'var(--white)', fontSize: '0.9rem' }}>
                  {cart.items.map((item: any, j: number) => (
                    <li key={j}>{item.quantity}x {item.name}</li>
                  ))}
                </ul>
              </div>
            ))}

            {metric === 'orders' && data.map((order: any, i: number) => (
              <div key={i} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: 8, display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ color: 'var(--white)', fontWeight: 'bold' }}>{order.id.split('-')[0]}</div>
                  <div style={{ color: 'var(--silver)', fontSize: '0.8rem' }}>{new Date(order.created_at).toLocaleString()}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: 'var(--teal)', fontWeight: 'bold' }}>${(order.total || 0).toFixed(2)}</div>
                  <div style={{ color: 'var(--grey-400)', fontSize: '0.8rem', textTransform: 'uppercase' }}>{order.status}</div>
                </div>
              </div>
            ))}

            {metric === 'searches' && data.map((s: any, i: number) => (
              <div key={i} style={{ padding: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--white)' }}>"{s.search_term}"</span>
                <span style={{ color: 'var(--silver)', fontSize: '0.8rem' }}>{new Date(s.created_at).toLocaleString()}</span>
              </div>
            ))}

            {['pageviews', 'visitors', 'product_views', 'add_to_cart', 'checkout_start', 'signups'].includes(metric || '') && data.map((ev: any, i: number) => (
              <div key={i} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: 8, marginBottom: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--white)', fontSize: '0.85rem' }}>
                  <span>{ev.path || 'Unknown Path'}</span>
                  <span style={{ color: 'var(--silver)', fontSize: '0.75rem' }}>{new Date(ev.created_at).toLocaleString()}</span>
                </div>
                {ev.visitor_id && <div style={{ fontSize: '0.7rem', color: 'var(--grey-500)', marginTop: 4, fontFamily: 'monospace' }}>Visitor: {ev.visitor_id}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
