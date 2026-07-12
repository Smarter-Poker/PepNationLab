'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity, Package, Clock, UserPlus, TrendingUp, Gift, Ticket,
  AlertTriangle, Users, Wallet, RefreshCw, ChevronRight,
} from 'lucide-react';

type Category =
  | 'order' | 'payment' | 'researcher' | 'commission'
  | 'referral' | 'coupon' | 'inventory' | 'subagent' | 'wallet';

type Emphasis = 'positive' | 'negative' | 'warning' | 'neutral';

interface Item {
  id: string;
  category: Category;
  title: string;
  subtitle?: string;
  amount?: number;
  status?: string;
  timestamp: string;
  href?: string;
  emphasis: Emphasis;
}

const CATS: { key: Category | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'order', label: 'Orders' },
  { key: 'payment', label: 'Payments' },
  { key: 'researcher', label: 'Researchers' },
  { key: 'commission', label: 'Commissions' },
  { key: 'referral', label: 'Referrals & Promos' },
  { key: 'coupon', label: 'Coupons' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'subagent', label: 'Sub-Agents' },
  { key: 'wallet', label: 'Wallet' },
];

const ICON: Record<Category, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  order: Package, payment: Clock, researcher: UserPlus, commission: TrendingUp,
  referral: Gift, coupon: Ticket, inventory: AlertTriangle, subagent: Users, wallet: Wallet,
};

const EMPH: Record<Emphasis, string> = {
  positive: '#2ed573', negative: '#ff6b6b', warning: '#ffb800', neutral: 'var(--silver, #c9ccd1)',
};

function money(n?: number) {
  if (n == null || !isFinite(n)) return '';
  return '$' + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function relTime(iso: string) {
  const t = new Date(iso).getTime();
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date(); const y = new Date(); y.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (same(d, today)) return 'Today';
  if (same(d, y)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

export default function AgentActivityFeed() {
  const router = useRouter();
  const [items, setItems] = useState<Item[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<Category | 'all'>('all');
  const [err, setErr] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true); setErr(false);
    try {
      const res = await fetch('/api/agent/activity', { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setItems(Array.isArray(json.items) ? json.items : []);
      setCounts(json.counts || {});
    } catch {
      setErr(true); setItems([]);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(
    () => (items || []).filter((i) => filter === 'all' || i.category === filter),
    [items, filter],
  );

  const groups = useMemo(() => {
    const g: { label: string; rows: Item[] }[] = [];
    let cur = '';
    for (const it of visible) {
      const lbl = dayLabel(it.timestamp);
      if (lbl !== cur) { g.push({ label: lbl, rows: [] }); cur = lbl; }
      g[g.length - 1].rows.push(it);
    }
    return g;
  }, [visible]);

  return (
    <section style={{ maxWidth: 860, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Activity size={26} strokeWidth={1.5} />
          <h1 className="metal-text" style={{ margin: 0, fontFamily: 'var(--font-brand)', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '1.5rem', color: 'var(--white)' }}>
            Recent Activity
          </h1>
        </div>
        <button type="button" onClick={load} disabled={refreshing} className="btn-silver"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: '0.8rem', opacity: refreshing ? 0.6 : 1 }}>
          <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : undefined }} /> Refresh
        </button>
      </div>
      <p style={{ color: 'var(--grey-400)', fontSize: '0.85rem', margin: '0 0 16px' }}>
        Everything happening across your storefront — orders, payments, researchers, commissions, referrals, coupons and stock, newest first.
      </p>

      {/* Filter chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
        {CATS.map((c) => {
          const n = c.key === 'all' ? (items?.length || 0) : (counts[c.key] || 0);
          if (c.key !== 'all' && n === 0) return null;
          const active = filter === c.key;
          return (
            <button key={c.key} type="button" onClick={() => setFilter(c.key)}
              style={{
                padding: '5px 12px', borderRadius: 999, fontSize: '0.78rem', cursor: 'pointer',
                border: `1px solid ${active ? 'var(--silver, #c9ccd1)' : 'rgba(255,255,255,0.12)'}`,
                background: active ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.03)',
                color: active ? 'var(--white)' : 'var(--grey-400)', fontWeight: active ? 700 : 500,
                display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
              }}>
              {c.label}
              <span style={{ fontSize: '0.7rem', opacity: 0.8, background: 'rgba(0,0,0,0.35)', borderRadius: 999, padding: '1px 7px' }}>{n}</span>
            </button>
          );
        })}
      </div>

      {/* Body */}
      {items === null ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} style={{ height: 64, borderRadius: 12, background: 'linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.07), rgba(255,255,255,0.04))', backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
          ))}
        </div>
      ) : err ? (
        <div className="glass-panel" style={{ padding: 28, textAlign: 'center', borderRadius: 14, color: 'var(--grey-400)' }}>
          Could not load your activity. <button type="button" onClick={load} className="btn-silver" style={{ marginLeft: 8, padding: '4px 12px' }}>Try again</button>
        </div>
      ) : visible.length === 0 ? (
        <div className="glass-panel" style={{ padding: 40, textAlign: 'center', borderRadius: 14 }}>
          <Activity size={54} strokeWidth={1} style={{ color: 'var(--grey-500, #6b7280)', marginBottom: 12 }} />
          <h3 style={{ color: 'var(--white)', margin: '0 0 6px' }}>Nothing here yet</h3>
          <p style={{ color: 'var(--grey-500, #8a8f98)', fontSize: '0.88rem', maxWidth: 380, margin: '0 auto' }}>
            {filter === 'all'
              ? 'As your researchers order, pay, and sign up — and as commissions and referrals settle — it will all show up here in real time.'
              : 'No activity in this category yet. Switch to “All” to see everything.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {groups.map((g) => (
            <div key={g.label}>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--grey-500, #8a8f98)', fontWeight: 700, margin: '0 0 8px 4px' }}>{g.label}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {g.rows.map((it) => {
                  const Ic = ICON[it.category] || Activity;
                  const color = EMPH[it.emphasis];
                  const clickable = !!it.href;
                  return (
                    <div key={it.id} role={clickable ? 'button' : undefined} tabIndex={clickable ? 0 : undefined}
                      onClick={() => { if (it.href) router.push(it.href); }}
                      onKeyDown={(e) => { if (clickable && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); router.push(it.href!); } }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', borderRadius: 12,
                        background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)',
                        cursor: clickable ? 'pointer' : 'default', transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => { if (clickable) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.07)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.035)'; }}>
                      <span style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,0.35)', border: `1px solid ${color}33`, color }}>
                        <Ic size={19} strokeWidth={1.6} />
                      </span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: 'var(--white)', fontWeight: 600, fontSize: '0.9rem' }}>{it.title}</span>
                        </div>
                        {it.subtitle && (
                          <div style={{ color: 'var(--grey-400)', fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.subtitle}</div>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                        {it.amount != null && it.amount > 0 && (
                          <span style={{ fontWeight: 800, fontSize: '0.9rem', color, whiteSpace: 'nowrap' }}>
                            {it.emphasis === 'negative' ? '−' : ''}{money(it.amount)}
                          </span>
                        )}
                        <span style={{ color: 'var(--grey-500, #8a8f98)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{relTime(it.timestamp)}</span>
                      </div>
                      {clickable && <ChevronRight size={16} style={{ color: 'var(--grey-600, #5b6068)', flexShrink: 0 }} />}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      `}</style>
    </section>
  );
}
