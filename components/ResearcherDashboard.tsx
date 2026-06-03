'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import Messaging from '@/components/Messaging';
import { useCart } from '@/components/CartContext';
import { toast } from 'sonner';
import WalletCard from '@/components/WalletCard';
import LabToolsCalculators from '@/components/LabToolsCalculators';
import OrderTimeline from '@/components/OrderTimeline';
import { paymentMethodLabel } from '@/lib/payment-method-labels';

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
  order_items: { id: string; product_id?: string; product_name: string; quantity: number; unit_retail_price: number }[];
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
  admin_approval_pending: 'Pending Approval',
  approved_ship: 'Approved',
  approved_pickup: 'Approved — Pickup',
  in_fulfillment: 'In Fulfillment',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};
const STATUS_COLORS: Record<string, string> = {
  pending_customer_payment: '#FC8181',
  agent_approval_pending: '#00E5FF',
  admin_approval_pending: '#00E5FF',
  approved_ship: '#63B3ED',
  approved_pickup: '#63B3ED',
  in_fulfillment: '#C0B8A8',
  shipped: '#0099FF',
  delivered: '#68D391',
  cancelled: 'rgba(255,255,255,0.25)',
};

const IP = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

type TabKey = 'overview' | 'orders' | 'wallet' | 'tools' | 'messages' | 'favorites' | 'account';

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
    id: 'wallet',
    label: 'Lab Wallet',
    icon: <svg {...IP}><rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 10h20"/><path d="M16 14h.01"/></svg>,
  },
  {
    id: 'tools',
    label: 'Lab Tools',
    icon: <svg {...IP}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
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

// ── Brushed-steel overview menu components ─────────────────────────────

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
      className="hover-menu-btn"
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

// ─────────────────────────────────────────────────────────────────────────

export default function ResearcherDashboard({ userId, userName, userEmail, agentId, agentName, agentSlug, profile }: ResearcherDashboardProps) {
  const [tab, setTab] = useState<TabKey>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [pastOrders, setPastOrders] = useState<Favorite[]>([]);
  const [favoritesTab, setFavoritesTab] = useState<'favorites' | 'pastOrders'>('favorites');
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingFavs, setLoadingFavs] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const { addToCart } = useCart();

  // Account settings
  // R32: split first/last to mirror every other create-account form. The DB
  // still stores a single full_name column, so on save we join the two fields
  // back into one string. On first render, parse the existing full_name into
  // first word + remainder so legacy single-name records stay editable.
  const _initialName = (profile.full_name || '').trim();
  const _initialFirst = _initialName.split(/\s+/)[0] || '';
  const _initialLast = _initialName.split(/\s+/).slice(1).join(' ') || '';
  const [firstName, setFirstName] = useState(_initialFirst);
  const [lastName, setLastName] = useState(_initialLast);
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
      setPastOrders(json.pastOrders ?? []);
    } catch { /* ok */ }
    setLoadingFavs(false);
  }

  const handleReorder = (e: React.MouseEvent, items: any[]) => {
    e.preventDefault();
    e.stopPropagation();
    let added = 0;
    items.forEach(item => {
      if (!item.product_id) return;
      addToCart({
        id: item.product_id,
        name: item.product_name,
        sku: '',
        retailPrice: Number(item.unit_retail_price),
        costPrice: Number(item.unit_retail_price),
        weightOz: 0
      }, item.quantity);
      added++;
    });
    if (added === 0) {
      toast.error('Could not reorder: Product IDs missing.');
    }
  };

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
      const joined = `${firstName.trim()} ${lastName.trim()}`.trim();
      if (joined !== (profile.full_name || '').trim()) updates.full_name = joined;
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
    <div style={{ display: 'flex', minHeight: 'calc(100dvh - 60px)', position: 'relative' }}>

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
              onClick={() => {
                if (item.id === 'messages') {
                  window.location.href = '/messenger';
                } else {
                  setTab(item.id);
                }
              }}
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

          <div style={{ height: 1, background: 'rgba(192,184,168,0.08)', margin: '8px 0' }} />

          <a
            href="/account/help"
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 12px', borderRadius: 8,
              background: 'none',
              border: '1px solid transparent',
              color: 'var(--silver)', fontSize: '0.78rem', fontWeight: 600,
              textDecoration: 'none', marginBottom: 8,
              transition: 'background 0.15s',
            }}
          >
            <svg {...IP}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="4.93" y1="4.93" x2="9.17" y2="9.17"/><line x1="14.83" y1="14.83" x2="19.07" y2="19.07"/><line x1="14.83" y1="9.17" x2="19.07" y2="4.93"/><line x1="4.93" y1="19.07" x2="9.17" y2="14.83"/></svg>
            Help & Support
          </a>

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
      <main style={{ flex: 1, minWidth: 0, width: "100%" }} className="researcher-main">



        {tab === 'overview' ? (
          <>
          {/* ── OVERVIEW TAB — Full-Screen Image, no padding, no heading ── */}
          {tab === 'overview' && (
            <div style={{
              width: '100%',
              minHeight: 'calc(100dvh - 60px)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
              background: '#000',
            }}>
              {/* Portrait panel — width-driven, aspect-ratio fills screen */}
              <div style={{
                position: 'relative',
                flexShrink: 0,
                width: '100%',
                maxWidth: 600,
                aspectRatio: '576 / 1024',
                overflow: 'hidden',
                backgroundImage: "url('/researcher-menu.jpg')",
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'top left',
                backgroundSize: '100% 100%',
              }}>
                {/* Invisible click zones — percentages map 1:1 to image pixels */}
                {[
                  { key: 'storefront', top: '5.5%',  height: '17%',   action: () => { window.location.href = agentSlug ? `/${agentSlug}` : '/products'; } },
                  { key: 'orders',     top: '23.5%', height: '19.5%', action: () => setTab('orders') },
                  { key: 'messages',   top: '44%',   height: '19%',   action: () => { window.location.href = '/messenger'; } },
                  { key: 'favorites',  top: '64%',   height: '15.5%', action: () => setTab('favorites') },
                  { key: 'account',    top: '80.5%', height: '14.5%', action: () => setTab('account') },
                ].map(z => (
                  <div
                    key={z.key}
                    onClick={z.action}
                    style={{
                      position: 'absolute',
                      top: z.top, height: z.height,
                      left: '3%', width: '94%',
                      cursor: 'pointer',
                      zIndex: 2,
                      WebkitTapHighlightColor: 'transparent',
                      borderRadius: 8,
                    }}
                    className="hover-bg-glass"
                  />
                ))}
              </div>
            </div>
          )}
          </>
        ) : (
          <div style={{ padding: 'var(--space-6)' }}>
            {/* Page heading for non-overview tabs */}
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 4 }}>
                {currentTab?.label}
              </h1>
            </div>

          {/* ── ORDERS TAB ── */}
          {tab === 'orders' && (
            <div>
              {loadingOrders ? <Spinner /> : orders.length === 0 ? (
            <div className="glass-panel" style={{ 
              textAlign: 'center', 
              padding: '60px 20px', 
              color: 'var(--grey-400)',
              borderRadius: '21px',
              marginTop: '16px'
            }}>
              <div style={{ 
                marginBottom: 20, 
                display: 'flex', 
                justifyContent: 'center', 
                filter: 'drop-shadow(0 0 20px rgba(0, 196, 188, 0.4))'
              }}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="url(#teal-glow-grad)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                  <defs>
                    <linearGradient id="teal-glow-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#00E5FF" />
                      <stop offset="100%" stopColor="#00C4BC" />
                    </linearGradient>
                  </defs>
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                  <line x1="12" y1="22.08" x2="12" y2="12"/>
                </svg>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '1.2rem', fontWeight: 800, marginBottom: 8, letterSpacing: '0.05em' }}>No Orders Yet</div>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem', maxWidth: 400, margin: '0 auto 20px', lineHeight: 1.5 }}>
                You haven't placed any orders. Start browsing the catalog to find the products you need.
              </p>
              <a href={agentSlug ? `/${agentSlug}` : '/dashboard'} style={{ display: 'inline-block', padding: '10px 24px', borderRadius: '8px', background: 'rgba(0,196,188,0.1)', border: '1px solid rgba(0,196,188,0.3)', fontSize: '0.9rem', color: '#00E5FF', fontWeight: 700, textDecoration: 'none' }}>Browse Catalog</a>
            </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {orders.map(o => (
                    <div
                      key={o.id}
                      style={{
                        borderRadius: '18px',
                        overflow: 'hidden',
                        marginBottom: '8px'
                      }}
                      className="glass-panel hover-lift"
                    >
                      <div>
                      <button onClick={() => setExpandedOrder(expandedOrder === o.id ? null : o.id)}
                        style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <div style={{ width: 48, height: 48, borderRadius: 12, background: `${STATUS_COLORS[o.status] || '#888'}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: STATUS_COLORS[o.status] || '#888' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                          </div>
                          <div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-brand)' }}>Order #{o.id.slice(0, 8).toUpperCase()}</div>
                            <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)', marginTop: 4, fontWeight: 500 }}>
                              {new Date(o.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              <span style={{ margin: '0 6px', color: 'rgba(255,255,255,0.2)' }}>|</span>
                              {o.order_items?.length || 0} items
                              <span style={{ margin: '0 6px', color: 'rgba(255,255,255,0.2)' }}>|</span>
                              {paymentMethodLabel(o.payment_method)}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                            <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--teal)' }}>${Number(o.total).toFixed(2)}</span>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: STATUS_COLORS[o.status] || '#888', background: `${STATUS_COLORS[o.status] || '#888'}15`, padding: '4px 10px', borderRadius: 6 }}>
                              {STATUS_LABELS[o.status] || o.status}
                            </span>
                          </div>
                          <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.3)', transition: 'transform 0.2s', transform: expandedOrder === o.id ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block', marginLeft: 8 }}>▼</span>
                        </div>
                      </button>

                      <AnimatePresence>
                        {expandedOrder === o.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                            style={{ overflow: 'hidden' }}
                          >
                            <div style={{ padding: '0 var(--space-6) var(--space-6)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                              {/* Visual order tracking timeline */}
                              <div style={{ marginTop: 20, marginBottom: 4 }}>
                                <OrderTimeline status={o.status} hasTracking={!!o.tracking_number} />
                              </div>
                              <div style={{ marginTop: 20 }}>
                            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Order Items</div>
                            {o.order_items?.map(item => (
                              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                <span style={{ color: 'rgba(255,255,255,0.85)' }}>{item.product_name} <span style={{ color: 'var(--teal)', marginLeft: 8, fontWeight: 600 }}>x{item.quantity}</span></span>
                                <span style={{ color: '#fff', fontWeight: 700 }}>${(item.unit_retail_price * item.quantity).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>

                          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 300, marginLeft: 'auto' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'rgba(255,255,255,0.5)' }}>
                              <span>Subtotal</span><span>${Number(o.subtotal).toFixed(2)}</span>
                            </div>
                            {Number(o.discount_amount) > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#68D391', fontWeight: 600 }}>
                                <span>Discount {o.coupon_code ? `(${o.coupon_code})` : ''}</span><span>-${Number(o.discount_amount).toFixed(2)}</span>
                              </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'rgba(255,255,255,0.5)' }}>
                              <span>Shipping</span><span>${Number(o.shipping_cost).toFixed(2)}</span>
                            </div>
                          </div>

                          {o.tracking_number && (
                            <div style={{ marginTop: 24, padding: '16px 20px', background: 'rgba(0,153,255,0.06)', borderRadius: 12, border: '1px solid rgba(0,153,255,0.2)', display: 'flex', alignItems: 'center', gap: 16 }}>
                              <div style={{ background: 'rgba(0,153,255,0.1)', padding: 8, borderRadius: 8 }}>
                                <svg {...IP} stroke="#63B3ED" width={24} height={24}><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                              </div>
                              <div>
                                <div style={{ fontSize: '0.75rem', color: '#63B3ED', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tracking Number</div>
                                <div style={{ fontSize: '1.1rem', color: '#fff', fontWeight: 700, fontFamily: 'monospace', marginTop: 4 }}>{o.tracking_number}</div>
                              </div>
                            </div>
                          )}

                          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '0 24px 24px' }}>
                            {o.status === 'pending_customer_payment' && (
                              <a href={`/orders/${o.id}`} className="pulse-cyan btn-neon-cyan" style={{
                                display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 24px',
                                borderRadius: '10px', fontSize: '0.9rem', fontWeight: 800, textDecoration: 'none',
                                transition: 'transform 0.2s ease',
                              }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                Upload Proof / Change Payment
                              </a>
                            )}
                            <button onClick={(e) => handleReorder(e, o.order_items)} className="pulse-silver" style={{
                              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 24px',
                              background: 'linear-gradient(180deg, #c8c2b8 0%, #a09890 100%)',
                              color: '#1a1f2e',
                              border: 'none',
                              cursor: 'pointer',
                              borderRadius: '10px', fontSize: '0.9rem', fontWeight: 800, textDecoration: 'none',
                              transition: 'transform 0.2s ease',
                            }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                              Re-Order Items
                            </button>
                          </div>
                        </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── LAB WALLET TAB ── */}
          {tab === 'wallet' && (
            <div>
              <WalletCard />
            </div>
          )}

          {/* ── LAB TOOLS TAB ── */}
          {tab === 'tools' && (
            <div>
              <LabToolsCalculators />
            </div>
          )}

          {/* ── MESSAGES TAB ── */}
          {tab === 'messages' && (
            <div>
              {agentId ? (
                <div className="glass-panel" style={{ overflow: 'hidden', borderRadius: '16px' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.01)' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <svg {...IP}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                      Chat With {agentName || 'Your Agent'}
                    </div>
                  </div>
                  <Messaging selfId={userId} counterpartId={agentId} counterpartName={agentName || 'Agent'} />
                </div>
              ) : (
                <div className="glass-panel" style={{ textAlign: 'center', padding: 48, borderRadius: '16px' }}>
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
              <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-5)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <button
                  onClick={() => setFavoritesTab('favorites')}
                  style={{
                    padding: 'var(--space-3) var(--space-4)',
                    background: 'none',
                    border: 'none',
                    borderBottom: favoritesTab === 'favorites' ? '2px solid var(--teal)' : '2px solid transparent',
                    color: favoritesTab === 'favorites' ? 'var(--white)' : 'var(--grey-400)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  My Favorites
                </button>
                <button
                  onClick={() => setFavoritesTab('pastOrders')}
                  style={{
                    padding: 'var(--space-3) var(--space-4)',
                    background: 'none',
                    border: 'none',
                    borderBottom: favoritesTab === 'pastOrders' ? '2px solid var(--teal)' : '2px solid transparent',
                    color: favoritesTab === 'pastOrders' ? 'var(--white)' : 'var(--grey-400)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Buy It Again
                </button>
              </div>

              {loadingFavs ? <Spinner /> : (favoritesTab === 'favorites' ? favorites : pastOrders).length === 0 ? (
                <div className="card-metal" style={{ textAlign: 'center', padding: 48 }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, opacity: 0.3 }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      {favoritesTab === 'favorites' ? (
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                      ) : (
                        <path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"></path>
                      )}
                    </svg>
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem', fontWeight: 600, marginBottom: 12 }}>
                    {favoritesTab === 'favorites' ? 'No Favorites Yet' : 'No Past Orders Found'}
                  </div>
                  <a href={agentSlug ? `/${agentSlug}` : '/dashboard'} style={{ display: 'inline-block', fontSize: '0.82rem', color: 'var(--teal)', fontWeight: 600 }}>Browse Catalog</a>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
                  {(favoritesTab === 'favorites' ? favorites : pastOrders).map(f => f.products && (
                    <div key={f.product_id} className="card-metal" style={{ padding: 'var(--space-4)' }}>
                      <div style={{ position: 'relative', height: 120, borderRadius: 8, overflow: 'hidden', marginBottom: 10, background: 'rgba(255,255,255,0.03)' }}>
                        {f.products.image_url ? (
                          <img src={f.products.image_url} alt={f.products.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)' }}>No Image</div>
                        )}
                        {favoritesTab === 'pastOrders' && f.created_at && (
                          <div style={{
                            position: 'absolute',
                            top: 6,
                            left: 6,
                            background: 'rgba(0,0,0,0.8)',
                            backdropFilter: 'blur(4px)',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '0.6rem',
                            color: 'var(--silver)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            fontWeight: 'bold',
                            border: '1px solid rgba(255,255,255,0.1)'
                          }}>
                            Last Purchased: {new Date(f.created_at).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', marginBottom: 4 }}>{f.products.name}</div>
                      {f.products.category && <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>{f.products.category}</div>}
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--teal)', marginBottom: 8 }}>${Number(f.products.base_price).toFixed(2)}</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <a href={agentSlug ? `/${agentSlug}` : '/dashboard'} style={{ flex: 1, textAlign: 'center', padding: '5px 10px', background: 'rgba(192,184,168,0.08)', border: '1px solid rgba(192,184,168,0.15)', borderRadius: 6, color: 'var(--teal)', fontSize: '0.72rem', fontWeight: 600, textDecoration: 'none' }}>View In Store</a>
                        {favoritesTab === 'favorites' && (
                          <button onClick={() => removeFavorite(f.product_id)} style={{ padding: '5px 10px', background: 'rgba(252,129,129,0.08)', border: '1px solid rgba(252,129,129,0.15)', borderRadius: 6, color: '#FC8181', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>Remove</button>
                        )}
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
              <div className="card-metal hover-lift" style={{ padding: 'var(--space-6)' }}>
                <h3 style={{ fontSize: '0.85rem', color: 'var(--silver)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 'var(--space-5)' }}>Profile Settings</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  {/* R32: First + Last name top-aligned, matches every other
                       create-account / edit-account form on the platform. */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', alignItems: 'start' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 4 }}>First Name</label>
                      <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className="form-input" />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 4 }}>Last Name</label>
                      <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className="form-input" />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 4 }}>Email</label>
                    <input type="email" value={userEmail} disabled className="form-input" style={{ opacity: 0.5 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 4 }}>Phone</label>
                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="form-input" />
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
        )}
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Sidebar: always hidden until hamburger opens it */
        .researcher-sidebar {
          transform: translateX(-100%);
        }
        @media (max-width: 768px) {
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
