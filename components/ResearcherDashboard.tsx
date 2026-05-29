'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Messaging from '@/components/Messaging';
import { toast } from 'sonner';

interface Order {
  id: string;
  status: string;
  total: number;
  subtotal: number;
  shipping_cost: number;
  discount_amount: number | null;
  coupon_code: string | null;
  fulfillment_method: string | null;
  payment_method: string;
  tracking_number: string | null;
  shipping_address: any;
  created_at: string;
  order_items: { id: string; product_name: string; quantity: number; unit_retail_price: number }[];
}

interface Favorite {
  product_id: string;
  created_at: string;
  products: { id: string; name: string; base_price: number; image_url: string | null; category: string | null; is_active: boolean } | null;
}

interface ResearcherDashboardProps {
  userId: string;
  userName: string;
  userEmail: string;
  agentId: string | null;
  agentName: string | null;
  profile: {
    full_name: string | null;
    role: string;
    tier: string | null;
    prepaid_balance: number;
    credit_limit: number;
    account_type: string | null;
    disclaimer_v1_accepted: boolean;
    phone?: string | null;
  };
}

const STATUS_LABELS: Record<string, string> = {
  pending_customer_payment: 'Pending Payment',
  agent_approval_pending: 'Approval Pending',
  approved_ship: 'Approved',
  approved_pickup: 'Approved — Pickup',
  in_fulfillment: 'In Fulfillment',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};
const STATUS_COLORS: Record<string, string> = {
  pending_customer_payment: '#FC8181',
  agent_approval_pending: '#F6AD55',
  approved_ship: '#63B3ED',
  approved_pickup: '#63B3ED',
  in_fulfillment: '#C0B8A8',
  shipped: '#0099FF',
  delivered: '#68D391',
  cancelled: 'rgba(255,255,255,0.25)',
};

export default function ResearcherDashboard({ userId, userName, userEmail, agentId, agentName, profile }: ResearcherDashboardProps) {
  const [tab, setTab] = useState<'overview' | 'orders' | 'messages' | 'favorites' | 'account'>('overview');
  const [orders, setOrders] = useState<Order[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingFavs, setLoadingFavs] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  // Account settings
  const [fullName, setFullName] = useState(profile.full_name || '');
  const [phone, setPhone] = useState(profile.phone || '');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (tab === 'orders' && orders.length === 0) fetchOrders();
    if (tab === 'favorites' && favorites.length === 0) fetchFavorites();
  }, [tab]);

  async function fetchOrders() {
    setLoadingOrders(true);
    try {
      const res = await fetch('/api/researcher/orders');
      const json = await res.json();
      setOrders(json.orders ?? []);
    } catch { /* ok */ }
    setLoadingOrders(false);
  }

  async function fetchFavorites() {
    setLoadingFavs(true);
    try {
      const res = await fetch('/api/researcher/favorites');
      const json = await res.json();
      setFavorites(json.favorites ?? []);
    } catch { /* ok */ }
    setLoadingFavs(false);
  }

  async function removeFavorite(productId: string) {
    try {
      await fetch('/api/researcher/favorites', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId }) });
      setFavorites(prev => prev.filter(f => f.product_id !== productId));
      toast.success('Removed from favorites');
    } catch { toast.error('Failed'); }
  }

  async function saveProfile() {
    setSaving(true);
    try {
      const supabase = createClient();
      const updates: any = {};
      if (fullName !== profile.full_name) updates.full_name = fullName;
      if (phone !== (profile.phone || '')) updates.phone = phone;

      if (Object.keys(updates).length > 0) {
        await supabase.from('profiles').update(updates).eq('id', userId);
      }
      if (newPassword) {
        await supabase.auth.updateUser({ password: newPassword });
        setNewPassword('');
      }
      toast.success('Profile Updated');
    } catch { toast.error('Failed'); }
    setSaving(false);
  }

  const totalSpent = orders.reduce((s, o) => o.status !== 'cancelled' ? s + Number(o.total) : s, 0);
  const deliveredCount = orders.filter(o => o.status === 'delivered').length;
  const activeOrders = orders.filter(o => !['delivered', 'cancelled'].includes(o.status));

  const tabs = [
    { key: 'overview' as const, label: 'Overview', icon: '📊' },
    { key: 'orders' as const, label: 'Orders', icon: '📦' },
    { key: 'messages' as const, label: 'Messages', icon: '💬' },
    { key: 'favorites' as const, label: 'Favorites', icon: '⭐' },
    { key: 'account' as const, label: 'Account', icon: '⚙️' },
  ];

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 'var(--space-6)', flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: '8px 16px', borderRadius: 10, cursor: 'pointer',
              fontSize: '0.82rem', fontWeight: tab === t.key ? 700 : 500,
              background: tab === t.key ? 'rgba(192,184,168,0.08)' : 'rgba(255,255,255,0.02)',
              color: tab === t.key ? 'var(--teal)' : 'rgba(255,255,255,0.4)',
              border: tab === t.key ? '1px solid rgba(192,184,168,0.15)' : '1px solid rgba(255,255,255,0.04)',
              transition: 'all 0.15s',
            }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {tab === 'overview' && (
        <div>
          {/* Stats cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
            {[
              { label: 'Account Type', value: profile.account_type === 'credit' ? 'Credit' : 'Prepaid', icon: '🏷️', color: 'var(--teal)' },
              { label: profile.account_type === 'credit' ? 'Credit Limit' : 'Balance', value: `$${(profile.account_type === 'credit' ? profile.credit_limit : profile.prepaid_balance).toFixed(2)}`, icon: '💳', color: 'var(--teal)' },
              { label: 'Total Orders', value: orders.length.toString(), icon: '📦', color: '#63B3ED' },
              { label: 'Total Spent', value: `$${totalSpent.toFixed(2)}`, icon: '💰', color: '#F6AD55' },
            ].map((s, i) => (
              <div key={i} className="card-metal" style={{ padding: 'var(--space-4)' }}>
                <div style={{ fontSize: '1.3rem', marginBottom: 6 }}>{s.icon}</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: s.color, fontFamily: 'var(--font-brand)' }}>{s.value}</div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Active orders + quick actions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
            <div className="card-metal" style={{ padding: 'var(--space-5)' }}>
              <h3 style={{ fontSize: '0.9rem', color: '#fff', marginBottom: 'var(--space-4)' }}>Active Orders</h3>
              {activeOrders.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {activeOrders.slice(0, 5).map(o => (
                    <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div>
                        <div style={{ fontSize: '0.78rem', color: '#fff', fontWeight: 600 }}>#{o.id.slice(0, 8)}</div>
                        <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)' }}>${Number(o.total).toFixed(2)} • {new Date(o.created_at).toLocaleDateString()}</div>
                      </div>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, color: STATUS_COLORS[o.status], background: `${STATUS_COLORS[o.status]}15`, padding: '2px 8px', borderRadius: 4 }}>
                        {STATUS_LABELS[o.status] || o.status}
                      </span>
                    </div>
                  ))}
                  {activeOrders.length > 5 && <div style={{ fontSize: '0.72rem', color: 'var(--teal)', textAlign: 'center', cursor: 'pointer' }} onClick={() => setTab('orders')}>View All →</div>}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 20, color: 'rgba(255,255,255,0.2)', fontSize: '0.78rem' }}>No Active Orders</div>
              )}
            </div>

            <div className="card-metal" style={{ padding: 'var(--space-5)' }}>
              <h3 style={{ fontSize: '0.9rem', color: '#fff', marginBottom: 'var(--space-4)' }}>Quick Actions</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: 'Browse Research Catalog', href: '/products', icon: '🔬', color: 'var(--teal)' },
                  { label: 'View All Orders', action: () => setTab('orders'), icon: '📦', color: '#63B3ED' },
                  { label: 'Message Your Agent', action: () => setTab('messages'), icon: '💬', color: '#F6AD55' },
                  { label: 'My Favorites', action: () => setTab('favorites'), icon: '⭐', color: '#C084FC' },
                ].map((a, i) => (
                  <button key={i} onClick={a.action || undefined}
                    {...(a.href ? {} : {})}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                      background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)',
                      cursor: 'pointer', textAlign: 'left', color: '#fff', fontSize: '0.82rem', fontWeight: 600,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                  >
                    <span style={{ fontSize: '1.1rem' }}>{a.icon}</span>
                    <span>{a.label}</span>
                    {a.href && <a href={a.href} style={{ position: 'absolute', inset: 0 }} />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ORDERS TAB */}
      {tab === 'orders' && (
        <div>
          {loadingOrders ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid rgba(192,184,168,0.2)', borderTopColor: 'var(--teal)', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : orders.length === 0 ? (
            <div className="card-metal" style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: '2rem', marginBottom: 12 }}>📦</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem', fontWeight: 600 }}>No Orders Yet</div>
              <a href="/products" style={{ display: 'inline-block', marginTop: 12, fontSize: '0.82rem', color: 'var(--teal)', fontWeight: 600 }}>Browse Catalog →</a>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {orders.map(o => (
                <div key={o.id} className="card-metal" style={{ overflow: 'hidden' }}>
                  <button onClick={() => setExpandedOrder(expandedOrder === o.id ? null : o.id)}
                    style={{
                      width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
                      padding: 'var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff',
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: `${STATUS_COLORS[o.status]}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>
                        {o.status === 'delivered' ? '✅' : o.status === 'shipped' ? '🚚' : o.status === 'cancelled' ? '❌' : '📦'}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Order #{o.id.slice(0, 8)}</div>
                        <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)' }}>
                          {new Date(o.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          {' • '}{o.order_items?.length || 0} items • {o.payment_method?.toUpperCase()}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--teal)' }}>${Number(o.total).toFixed(2)}</span>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, color: STATUS_COLORS[o.status], background: `${STATUS_COLORS[o.status]}15`, padding: '2px 8px', borderRadius: 4 }}>
                        {STATUS_LABELS[o.status] || o.status}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', transition: 'transform 0.2s', transform: expandedOrder === o.id ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                    </div>
                  </button>

                  {expandedOrder === o.id && (
                    <div style={{ padding: '0 var(--space-4) var(--space-4)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                      {/* Items */}
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Items</div>
                        {o.order_items?.map(item => (
                          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                            <span style={{ color: 'rgba(255,255,255,0.7)' }}>{item.product_name} <span style={{ color: 'var(--teal)' }}>×{item.quantity}</span></span>
                            <span style={{ color: '#fff', fontWeight: 600 }}>${(item.unit_retail_price * item.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>

                      {/* Totals */}
                      <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>
                          <span>Subtotal</span><span>${Number(o.subtotal).toFixed(2)}</span>
                        </div>
                        {Number(o.discount_amount) > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#68D391' }}>
                            <span>Discount {o.coupon_code ? `(${o.coupon_code})` : ''}</span><span>-${Number(o.discount_amount).toFixed(2)}</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>
                          <span>Shipping</span><span>${Number(o.shipping_cost).toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Tracking */}
                      {o.tracking_number && (
                        <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(0,153,255,0.06)', borderRadius: 8, border: '1px solid rgba(0,153,255,0.15)', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: '1rem' }}>🚚</span>
                          <div>
                            <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)' }}>Tracking Number</div>
                            <div style={{ fontSize: '0.82rem', color: '#63B3ED', fontWeight: 700, fontFamily: 'monospace' }}>{o.tracking_number}</div>
                          </div>
                        </div>
                      )}

                      {/* Re-order button */}
                      <div style={{ marginTop: 12 }}>
                        <a href="/products" style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px',
                          background: 'rgba(192,184,168,0.08)', border: '1px solid rgba(192,184,168,0.15)',
                          borderRadius: 8, color: 'var(--teal)', fontSize: '0.75rem', fontWeight: 600,
                          textDecoration: 'none',
                        }}>
                          🔄 Re-Order
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MESSAGES TAB */}
      {tab === 'messages' && (
        <div>
          {agentId ? (
            <div className="card-metal" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.01)' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>💬 Chat With {agentName || 'Your Agent'}</div>
              </div>
              <Messaging selfId={userId} counterpartId={agentId} counterpartName={agentName || 'Agent'} />
            </div>
          ) : (
            <div className="card-metal" style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: '2rem', marginBottom: 12 }}>💬</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>No Agent Assigned</div>
              <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.78rem', marginTop: 6 }}>Contact support if you need assistance.</div>
            </div>
          )}
        </div>
      )}

      {/* FAVORITES TAB */}
      {tab === 'favorites' && (
        <div>
          {loadingFavs ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid rgba(192,184,168,0.2)', borderTopColor: 'var(--teal)', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : favorites.length === 0 ? (
            <div className="card-metal" style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: '2rem', marginBottom: 12 }}>⭐</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem', fontWeight: 600 }}>No Favorites Yet</div>
              <a href="/products" style={{ display: 'inline-block', marginTop: 12, fontSize: '0.82rem', color: 'var(--teal)', fontWeight: 600 }}>Browse Catalog →</a>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
              {favorites.map(f => f.products && (
                <div key={f.product_id} className="card-metal" style={{ padding: 'var(--space-4)', position: 'relative' }}>
                  {f.products.image_url && (
                    <div style={{ height: 120, borderRadius: 8, overflow: 'hidden', marginBottom: 10, background: 'rgba(255,255,255,0.03)' }}>
                      <img src={f.products.image_url} alt={f.products.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', marginBottom: 4 }}>{f.products.name}</div>
                  {f.products.category && <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>{f.products.category}</div>}
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--teal)', marginBottom: 8 }}>${Number(f.products.base_price).toFixed(2)}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <a href="/products" style={{
                      flex: 1, textAlign: 'center', padding: '5px 10px', background: 'rgba(192,184,168,0.08)',
                      border: '1px solid rgba(192,184,168,0.15)', borderRadius: 6, color: 'var(--teal)',
                      fontSize: '0.72rem', fontWeight: 600, textDecoration: 'none',
                    }}>View In Store</a>
                    <button onClick={() => removeFavorite(f.product_id)} style={{
                      padding: '5px 10px', background: 'rgba(252,129,129,0.08)', border: '1px solid rgba(252,129,129,0.15)',
                      borderRadius: 6, color: '#FC8181', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
                    }}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ACCOUNT TAB */}
      {tab === 'account' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
          <div className="card-metal" style={{ padding: 'var(--space-6)' }}>
            <h3 style={{ fontSize: '0.92rem', color: '#fff', marginBottom: 'var(--space-5)' }}>Profile Settings</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 4 }}>Full Name</label>
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className="form-input" />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 4 }}>Email</label>
                <input type="email" value={userEmail} disabled className="form-input" style={{ opacity: 0.5 }} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 4 }}>Phone</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="form-input" placeholder="(555) 123-4567" />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 4 }}>New Password</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="form-input" placeholder="Leave blank to keep current" />
              </div>
              <button onClick={saveProfile} disabled={saving} className="btn btn-primary" style={{ justifyContent: 'center' }}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>

          <div className="card-metal" style={{ padding: 'var(--space-6)' }}>
            <h3 style={{ fontSize: '0.92rem', color: '#fff', marginBottom: 'var(--space-5)' }}>Account Info</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Account Type', value: profile.account_type === 'credit' ? 'Credit' : 'Prepaid' },
                { label: 'Tier', value: profile.tier ? `Tier ${profile.tier.replace('tier_', '')}` : 'Standard' },
                { label: profile.account_type === 'credit' ? 'Credit Limit' : 'Prepaid Balance', value: `$${(profile.account_type === 'credit' ? profile.credit_limit : profile.prepaid_balance).toFixed(2)}` },
                { label: 'Disclaimer', value: profile.disclaimer_v1_accepted ? 'Accepted ✅' : 'Pending ⚠️' },
                { label: 'Total Orders', value: `${orders.length}` },
                { label: 'Delivered', value: `${deliveredCount}` },
                { label: 'Total Spent', value: `$${totalSpent.toFixed(2)}` },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>{item.label}</span>
                  <span style={{ color: '#fff', fontWeight: 600 }}>{item.value}</span>
                </div>
              ))}
            </div>

            {agentName && (
              <div style={{ marginTop: 'var(--space-5)', padding: '12px 14px', background: 'rgba(192,184,168,0.04)', borderRadius: 10, border: '1px solid rgba(192,184,168,0.1)' }}>
                <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>Your Agent</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--teal)', fontWeight: 700 }}>{agentName}</div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
