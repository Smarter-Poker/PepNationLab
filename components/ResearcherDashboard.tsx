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
  agentSlug: string | null;
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

const IP = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

type TabKey = 'overview' | 'orders' | 'messages' | 'favorites' | 'account';

const MENU_ITEMS: { id: TabKey; label: string; icon: React.ReactNode }[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: <svg {...IP}><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>,
  },
  {
    id: 'orders',
    label: 'My Orders',
    icon: <svg {...IP}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>,
  },
  {
    id: 'messages',
    label: 'Messages',
    icon: <svg {...IP}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  },
  {
    id: 'favorites',
    label: 'Favorites',
    icon: <svg {...IP}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  },
  {
    id: 'account',
    label: 'Account',
    icon: <svg {...IP}><circle cx="12" cy="8" r="4"/><path d="M6 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg>,
  },
];

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid rgba(192,184,168,0.2)', borderTopColor: 'var(--teal)', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );
}

// ── Brushed-steel overview menu components ───────────────────────────────────────────

function MenuButton({ onClick, icon, title, subtitle }: {
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        width: '100%',
        padding: '14px 16px',
        background: 'linear-gradient(180deg, #1e2233 0%, #181c2a 50%, #141820 100%)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 10,
        cursor: 'pointer',
        textAlign: 'left',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 8px rgba(0,0,0,0.5)',
        transition: 'background 0.15s, transform 0.1s, box-shadow 0.1s',
        WebkitTapHighlightColor: 'transparent',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'linear-gradient(180deg, #252840 0%, #1e2235 50%, #191d30 100%)';
        e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 16px rgba(0,0,0,0.6)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'linear-gradient(180deg, #1e2233 0%, #181c2a 50%, #141820 100%)';
        e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 8px rgba(0,0,0,0.5)';
      }}
      onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.98)'; }}
      onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
      onTouchStart={e => {
        e.currentTarget.style.background = 'linear-gradient(180deg, #252840 0%, #1e2235 50%, #191d30 100%)';
        e.currentTarget.style.transform = 'scale(0.98)';
      }}
      onTouchEnd={e => {
        e.currentTarget.style.background = 'linear-gradient(180deg, #1e2233 0%, #181c2a 50%, #141820 100%)';
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      <div style={{
        flexShrink: 0, width: 60, height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
        borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)',
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '1rem', fontWeight: 800, color: '#d8d0c4',
          letterSpacing: '0.05em', fontFamily: 'var(--font-brand, system-ui)',
          marginBottom: 4, textShadow: '0 1px 3px rgba(0,0,0,0.8)',
        }}>{title}</div>
        <div style={{
          fontSize: '0.68rem', color: 'rgba(192,184,168,0.55)',
          letterSpacing: '0.04em', lineHeight: 1.4, fontWeight: 500,
        }}>{subtitle}</div>
      </div>
      <div style={{ flexShrink: 0, color: 'rgba(192,184,168,0.3)', fontSize: '1.1rem', fontWeight: 300 }}>›</div>
    </button>
  );
}

function StorefrontIcon() {
  return (
    <svg viewBox="0 0 56 56" width="44" height="44" fill="none">
      <defs>
        <linearGradient id="si1" x1="28" y1="0" x2="28" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#e0d8cc"/>
          <stop offset="0.5" stopColor="#a8a098"/>
          <stop offset="1" stopColor="#706860"/>
        </linearGradient>
      </defs>
      <path d="M10 28h36v20a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2V28z" stroke="url(#si1)" strokeWidth="2" fill="rgba(255,255,255,0.04)"/>
      <path d="M10 28l4-10h28l4 10" stroke="url(#si1)" strokeWidth="2" strokeLinejoin="round" fill="rgba(255,255,255,0.04)"/>
      <path d="M28 8v16M22 14l6-6 6 6" stroke="url(#si1)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function OrdersIcon() {
  return (
    <svg viewBox="0 0 56 56" width="44" height="44" fill="none">
      <defs>
        <linearGradient id="oi1" x1="28" y1="0" x2="28" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#e0d8cc"/>
          <stop offset="0.5" stopColor="#a8a098"/>
          <stop offset="1" stopColor="#706860"/>
        </linearGradient>
      </defs>
      <rect x="12" y="10" width="32" height="40" rx="3" stroke="url(#oi1)" strokeWidth="2" fill="rgba(255,255,255,0.04)"/>
      <rect x="21" y="6" width="14" height="8" rx="3" stroke="url(#oi1)" strokeWidth="2" fill="rgba(255,255,255,0.04)"/>
      <line x1="20" y1="24" x2="36" y2="24" stroke="url(#oi1)" strokeWidth="2" strokeLinecap="round"/>
      <line x1="20" y1="31" x2="36" y2="31" stroke="url(#oi1)" strokeWidth="2" strokeLinecap="round"/>
      <line x1="20" y1="38" x2="30" y2="38" stroke="url(#oi1)" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg viewBox="0 0 56 56" width="44" height="44" fill="none">
      <defs>
        <radialGradient id="mi1" cx="28" cy="24" r="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#d8d0c4"/>
          <stop offset="1" stopColor="#706860"/>
        </radialGradient>
      </defs>
      <circle cx="28" cy="24" r="16" stroke="url(#mi1)" strokeWidth="2" fill="rgba(255,255,255,0.04)"/>
      <path d="M24 38 l-3 8 l7-5" stroke="url(#mi1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <path d="M20 22 q2-3 4-1 q2-4 4 0 q2-4 4-1 q2-3 4-1" stroke="url(#mi1)" strokeWidth="2" strokeLinecap="round" fill="none"/>
    </svg>
  );
}

function FavoritesIcon() {
  return (
    <svg viewBox="0 0 56 56" width="44" height="44" fill="none">
      <defs>
        <linearGradient id="fi1" x1="28" y1="10" x2="28" y2="50" gradientUnits="userSpaceOnUse">
          <stop stopColor="#e0d8cc"/>
          <stop offset="0.5" stopColor="#a8a098"/>
          <stop offset="1" stopColor="#686058"/>
        </linearGradient>
      </defs>
      <path d="M28 46 C28 46 8 34 8 20a12 12 0 0 1 20-9 12 12 0 0 1 20 9c0 14-20 26-20 26z"
        fill="url(#fi1)" stroke="rgba(255,255,255,0.12)" strokeWidth="1"/>
      <path d="M20 18 q-2 5 0 10" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 56 56" width="44" height="44" fill="none">
      <defs>
        <linearGradient id="gi1" x1="28" y1="0" x2="28" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#e0d8cc"/>
          <stop offset="0.5" stopColor="#a8a098"/>
          <stop offset="1" stopColor="#706860"/>
        </linearGradient>
      </defs>
      <path d="M28 8v5M28 43v5M8 28h5M43 28h5 M14.5 14.5l3.5 3.5M38 38l3.5 3.5 M41.5 14.5l-3.5 3.5M18 38l-3.5 3.5"
        stroke="url(#gi1)" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="28" cy="28" r="10" stroke="url(#gi1)" strokeWidth="2.5" fill="rgba(255,255,255,0.04)"/>
      <circle cx="28" cy="28" r="4" fill="url(#gi1)"/>
    </svg>
  );
}

// ──────────────────────────────────────────────────────────────────────────────

export default function ResearcherDashboard({ userId, userName, userEmail, agentId, agentName, agentSlug, profile }: ResearcherDashboardProps) {
  const [tab, setTab] = useState<TabKey>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
    setSidebarOpen(false);
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
  const currentTab = MENU_ITEMS.find(m => m.id === tab);

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 60px)', position: 'relative' }}>

      {/* ── Mobile sidebar backdrop ── */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(5,10,15,0.7)',
            backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
            zIndex: 49,
          }}
        />
      )}

      {/* ── Sidebar ── */}
      <aside style={{
        width: 220,
        flexShrink: 0,
        background: 'var(--black-2)',
        borderRight: '1px solid rgba(192,184,168,0.1)',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 60,
        left: 0,
        bottom: 0,
        zIndex: 50,
        overflow: 'hidden',
        transform: sidebarOpen ? 'translateX(0)' : undefined,
        transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
      }}
      className="researcher-sidebar"
      >
        {/* Sidebar header — name + role */}
        <div style={{
          padding: '16px 16px 12px',
          borderBottom: '1px solid rgba(192,184,168,0.08)',
        }}>
          <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Researcher</div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
          {agentName && (
            <div style={{ fontSize: '0.7rem', color: 'var(--teal)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Agent: {agentName}
            </div>
          )}
        </div>

        {/* Nav items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {MENU_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 16px',
                background: tab === item.id ? 'rgba(0,196,188,0.08)' : 'none',
                border: 'none',
                borderLeft: tab === item.id ? '3px solid var(--teal)' : '3px solid transparent',
                color: tab === item.id ? 'var(--teal)' : 'rgba(255,255,255,0.5)',
                fontSize: '0.83rem',
                fontWeight: tab === item.id ? 700 : 500,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s',
              }}
            >
              <span style={{ flexShrink: 0, opacity: tab === item.id ? 1 : 0.6 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>

        {/* Bottom actions */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(192,184,168,0.08)', flexShrink: 0 }}>
          {agentSlug && (
            <a
              href={`/${agentSlug}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 12px', borderRadius: 8,
                background: 'rgba(0,196,188,0.08)',
                border: '1px solid rgba(0,196,188,0.15)',
                color: 'var(--teal)', fontSize: '0.78rem', fontWeight: 600,
                textDecoration: 'none', marginBottom: 8,
                transition: 'background 0.15s',
              }}
            >
              <svg {...IP}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
              Browse Store
            </a>
          )}
          <form action="/api/auth/signout" method="POST">
            <button type="submit" style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 12px', borderRadius: 8,
              background: 'none', border: '1px solid rgba(252,129,129,0.15)',
              color: '#FC8181', fontSize: '0.78rem', fontWeight: 600,
              cursor: 'pointer', transition: 'background 0.15s',
            }}>
              <svg {...IP} stroke="#FC8181"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Sign Out
            </button>
          </form>
        </div>
      </aside>

      {/* ── Main content area ── */}
      <main style={{ flex: 1, marginLeft: 220, minWidth: 0 }} className="researcher-main">

        {/* Mobile top bar */}
        <div style={{
          display: 'none',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          background: 'var(--black-2)',
          borderBottom: '1px solid rgba(192,184,168,0.08)',
          position: 'sticky',
          top: 60,
          zIndex: 10,
        }} className="researcher-mobile-bar">
          <button
            onClick={() => setSidebarOpen(o => !o)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--teal)', padding: 4, display: 'flex' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              {sidebarOpen
                ? <path d="M18 6L6 18M6 6l12 12" />
                : <path d="M3 7h18M3 12h18M3 17h18" />}
            </svg>
          </button>
          <span style={{ fontFamily: 'var(--font-brand)', fontSize: '0.85rem', fontWeight: 800, color: 'var(--nav-title)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {currentTab?.label ?? 'Dashboard'}
          </span>
        </div>

        <div style={{ padding: 'var(--space-6)' }}>

          {/* Page heading */}
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 4 }}>
              {tab === 'overview' ? <>Welcome Back, <span style={{ color: 'var(--teal)' }}>{userName}</span></> : currentTab?.label}
            </h1>
            {tab === 'overview' && (
              <p style={{ color: 'var(--grey-400)', fontSize: '0.82rem', margin: 0 }}>
                Researcher Dashboard — Research Use Only
              </p>
            )}
          </div>

          {/* ── OVERVIEW TAB — Brushed-Steel Menu ── */}
          {tab === 'overview' && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
              padding: '8px 0 32px',
            }}>
              <div style={{
                width: '100%',
                maxWidth: 520,
                borderRadius: 22,
                padding: 10,
                background: 'linear-gradient(145deg, #d4cec4 0%, #b0a89e 25%, #8a847c 50%, #b0a89e 75%, #d4cec4 100%)',
                boxShadow: '0 12px 60px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.5)',
              }}>
                <div style={{
                  borderRadius: 14,
                  background: 'linear-gradient(180deg, #1a1d28 0%, #13151f 50%, #0e1018 100%)',
                  padding: '14px 12px',
                  boxShadow: 'inset 0 3px 12px rgba(0,0,0,0.7)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}>
                  <MenuButton
                    onClick={() => { window.location.href = agentSlug ? `/${agentSlug}` : '/products'; }}
                    icon={<StorefrontIcon />}
                    title="VISIT STOREFRONT"
                    subtitle="SEE ALL AVAILABLE PEPTIDES AND PRODUCTS"
                  />
                  <MenuButton
                    onClick={() => setTab('orders')}
                    icon={<OrdersIcon />}
                    title="VIEW ALL ORDERS"
                    subtitle="CHECK ORDERS, TRACKING NUMBERS AND PREVIOUS ORDERS"
                  />
                  <MenuButton
                    onClick={() => setTab('messages')}
                    icon={<MessageIcon />}
                    title="MESSAGE YOUR AGENT"
                    subtitle="SEND PROOF OF PAYMENT OR ASK YOUR AGENT ANY QUESTIONS"
                  />
                  <MenuButton
                    onClick={() => setTab('favorites')}
                    icon={<FavoritesIcon />}
                    title="FAVORITES"
                    subtitle="ALL ITEMS YOU LIKED OR PREVIOUSLY ORDERED"
                  />
                  <MenuButton
                    onClick={() => setTab('account')}
                    icon={<SettingsIcon />}
                    title="ACCOUNT SETTINGS"
                    subtitle="PROFILE SETTINGS AND ACCOUNT INFORMATION"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── ORDERS TAB ── */}
          {tab === 'orders' && (
            <div>
              {loadingOrders ? <Spinner /> : orders.length === 0 ? (
                <div className="card-metal" style={{ textAlign: 'center', padding: 48 }}>
                  <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center', opacity: 0.3 }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem', fontWeight: 600, marginBottom: 12 }}>No Orders Yet</div>
                  <a href={agentSlug ? `/${agentSlug}` : '/products'} style={{ display: 'inline-block', fontSize: '0.82rem', color: 'var(--teal)', fontWeight: 600 }}>Browse Catalog</a>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {orders.map(o => (
                    <div key={o.id} className="card-metal" style={{ overflow: 'hidden' }}>
                      <button onClick={() => setExpandedOrder(expandedOrder === o.id ? null : o.id)}
                        style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 'var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 8, background: `${STATUS_COLORS[o.status]}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: STATUS_COLORS[o.status] }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Order #{o.id.slice(0, 8)}</div>
                            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)' }}>
                              {new Date(o.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              {' — '}{o.order_items?.length || 0} items — {o.payment_method?.toUpperCase()}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--teal)' }}>${Number(o.total).toFixed(2)}</span>
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: STATUS_COLORS[o.status], background: `${STATUS_COLORS[o.status]}15`, padding: '2px 8px', borderRadius: 4 }}>
                            {STATUS_LABELS[o.status] || o.status}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', transition: 'transform 0.2s', transform: expandedOrder === o.id ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block' }}>▼</span>
                        </div>
                      </button>

                      {expandedOrder === o.id && (
                        <div style={{ padding: '0 var(--space-4) var(--space-4)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                          <div style={{ marginTop: 12 }}>
                            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Items</div>
                            {o.order_items?.map(item => (
                              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                <span style={{ color: 'rgba(255,255,255,0.7)' }}>{item.product_name} <span style={{ color: 'var(--teal)' }}>x{item.quantity}</span></span>
                                <span style={{ color: '#fff', fontWeight: 600 }}>${(item.unit_retail_price * item.quantity).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>

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

                          {o.tracking_number && (
                            <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(0,153,255,0.06)', borderRadius: 8, border: '1px solid rgba(0,153,255,0.15)', display: 'flex', alignItems: 'center', gap: 8 }}>
                              <svg {...IP} stroke="#63B3ED"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                              <div>
                                <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)' }}>Tracking Number</div>
                                <div style={{ fontSize: '0.82rem', color: '#63B3ED', fontWeight: 700, fontFamily: 'monospace' }}>{o.tracking_number}</div>
                              </div>
                            </div>
                          )}

                          <div style={{ marginTop: 12 }}>
                            <a href={agentSlug ? `/${agentSlug}` : '/products'} style={{
                              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px',
                              background: 'rgba(192,184,168,0.08)', border: '1px solid rgba(192,184,168,0.15)',
                              borderRadius: 8, color: 'var(--teal)', fontSize: '0.75rem', fontWeight: 600, textDecoration: 'none',
                            }}>
                              Re-Order
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

          {/* ── MESSAGES TAB ── */}
          {tab === 'messages' && (
            <div>
              {agentId ? (
                <div className="card-metal" style={{ overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.01)' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <svg {...IP}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                      Chat With {agentName || 'Your Agent'}
                    </div>
                  </div>
                  <Messaging selfId={userId} counterpartId={agentId} counterpartName={agentName || 'Agent'} />
                </div>
              ) : (
                <div className="card-metal" style={{ textAlign: 'center', padding: 48 }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, opacity: 0.3 }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>No Agent Assigned</div>
                  <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.78rem', marginTop: 6 }}>Contact support if you need assistance.</div>
                </div>
              )}
            </div>
          )}

          {/* ── FAVORITES TAB ── */}
          {tab === 'favorites' && (
            <div>
              {loadingFavs ? <Spinner /> : favorites.length === 0 ? (
                <div className="card-metal" style={{ textAlign: 'center', padding: 48 }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, opacity: 0.3 }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem', fontWeight: 600, marginBottom: 12 }}>No Favorites Yet</div>
                  <a href={agentSlug ? `/${agentSlug}` : '/products'} style={{ display: 'inline-block', fontSize: '0.82rem', color: 'var(--teal)', fontWeight: 600 }}>Browse Catalog</a>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
                  {favorites.map(f => f.products && (
                    <div key={f.product_id} className="card-metal" style={{ padding: 'var(--space-4)' }}>
                      {f.products.image_url && (
                        <div style={{ height: 120, borderRadius: 8, overflow: 'hidden', marginBottom: 10, background: 'rgba(255,255,255,0.03)' }}>
                          <img src={f.products.image_url} alt={f.products.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      )}
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', marginBottom: 4 }}>{f.products.name}</div>
                      {f.products.category && <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>{f.products.category}</div>}
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--teal)', marginBottom: 8 }}>${Number(f.products.base_price).toFixed(2)}</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <a href={agentSlug ? `/${agentSlug}` : '/products'} style={{ flex: 1, textAlign: 'center', padding: '5px 10px', background: 'rgba(192,184,168,0.08)', border: '1px solid rgba(192,184,168,0.15)', borderRadius: 6, color: 'var(--teal)', fontSize: '0.72rem', fontWeight: 600, textDecoration: 'none' }}>View In Store</a>
                        <button onClick={() => removeFavorite(f.product_id)} style={{ padding: '5px 10px', background: 'rgba(252,129,129,0.08)', border: '1px solid rgba(252,129,129,0.15)', borderRadius: 6, color: '#FC8181', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── ACCOUNT TAB ── */}
          {tab === 'account' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }} className="account-grid">
              <div className="card-metal" style={{ padding: 'var(--space-6)' }}>
                <h3 style={{ fontSize: '0.85rem', color: 'var(--silver)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 'var(--space-5)' }}>Profile Settings</h3>
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
                <h3 style={{ fontSize: '0.85rem', color: 'var(--silver)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 'var(--space-5)' }}>Account Info</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    { label: 'Account Type', value: profile.account_type === 'credit' ? 'Credit' : 'Prepaid' },
                    { label: 'Tier', value: profile.tier ? `Tier ${profile.tier.replace('tier_', '')}` : 'Standard' },
                    { label: profile.account_type === 'credit' ? 'Credit Limit' : 'Prepaid Balance', value: `$${(profile.account_type === 'credit' ? profile.credit_limit : profile.prepaid_balance).toFixed(2)}` },
                    { label: 'Disclaimer', value: profile.disclaimer_v1_accepted ? 'Accepted' : 'Pending' },
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

        </div>
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Desktop: sidebar always visible */
        .researcher-sidebar {
          transform: translateX(0) !important;
        }

        /* Mobile: sidebar hidden by default, shown via state */
        @media (max-width: 768px) {
          .researcher-sidebar {
            transform: translateX(-100%);
          }
          .researcher-main {
            margin-left: 0 !important;
          }
          .researcher-mobile-bar {
            display: flex !important;
          }
          .overview-grid {
            grid-template-columns: 1fr !important;
          }
          .account-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
