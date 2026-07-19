'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity, Package, Clock, UserPlus, TrendingUp, Gift, Ticket,
  AlertTriangle, Users, Wallet, RefreshCw, ChevronRight, Download,
  RotateCcw, BadgeCheck, Repeat, Mail, ShoppingBag, DollarSign,
} from 'lucide-react';

type Category =
  | 'order' | 'payment' | 'researcher' | 'commission'
  | 'referral' | 'coupon' | 'inventory' | 'subagent' | 'wallet'
  | 'refund' | 'payout' | 'subscription' | 'invitation';

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

/* ── Category metadata ─────────────────────────────────────────────────── */
type CatMeta = {
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  accent: string; // border / icon tint
};

const CAT_META: Record<Category, CatMeta> = {
  order:        { label: 'Orders',         icon: ShoppingBag,   accent: '#00C4BC' },
  payment:      { label: 'Payments',        icon: Clock,         accent: '#ffb800' },
  researcher:   { label: 'Researchers',     icon: UserPlus,      accent: '#7ee787' },
  commission:   { label: 'Commissions',     icon: TrendingUp,    accent: '#00C4BC' },
  referral:     { label: 'Referrals',       icon: Gift,          accent: '#c084fc' },
  coupon:       { label: 'Coupons',         icon: Ticket,        accent: '#fb923c' },
  inventory:    { label: 'Inventory',       icon: AlertTriangle, accent: '#ffb800' },
  subagent:     { label: 'Sub-Agents',      icon: Users,         accent: '#60a5fa' },
  wallet:       { label: 'Wallet',          icon: Wallet,        accent: '#a3a3a3' },
  refund:       { label: 'Refunds',         icon: RotateCcw,     accent: '#ff6b6b' },
  payout:       { label: 'Payouts',         icon: DollarSign,    accent: '#4ade80' },
  subscription: { label: 'Subscriptions',   icon: Repeat,        accent: '#818cf8' },
  invitation:   { label: 'Invitations',     icon: Mail,          accent: '#38bdf8' },
};

const ALL_CATS = Object.keys(CAT_META) as Category[];

const WINDOWS: { label: string; value: number | 'all' }[] = [
  { label: '7d', value: 7 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
  { label: '1y', value: 365 },
  { label: 'All', value: 'all' },
];

const EMPH: Record<Emphasis, string> = {
  positive: '#4ade80',
  negative: '#ff6b6b',
  warning:  '#ffb800',
  neutral:  '#a3a3a3',
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

function exactTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (same(d, today)) return 'Today';
  if (same(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function toCsv(rows: Item[]): string {
  const head = ['Timestamp', 'Category', 'Title', 'Detail', 'Amount', 'Direction', 'Status'];
  const esc = (val: unknown) => {
    const v = val == null ? '' : String(val);
    return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  };
  const lines = [head.join(',')];
  for (const r of rows) {
    const signed = r.amount != null && r.amount > 0
      ? (r.emphasis === 'negative' ? -r.amount : r.amount).toFixed(2) : '';
    lines.push([
      r.timestamp, r.category, r.title, r.subtitle || '',
      signed, r.emphasis === 'negative' ? 'out' : (r.amount ? 'in' : ''), r.status || '',
    ].map(esc).join(','));
  }
  return lines.join('\n');
}

/* ── Status badge ──────────────────────────────────────────────────────── */
function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  const MAP: Record<string, { label: string; color: string; bg: string }> = {
    pending_customer_payment: { label: 'Awaiting Payment', color: '#ffb800', bg: 'rgba(255,184,0,0.12)' },
    agent_approval_pending:   { label: 'Needs Approval',   color: '#fb923c', bg: 'rgba(251,146,60,0.12)' },
    admin_approval_pending:   { label: 'Needs Approval',   color: '#fb923c', bg: 'rgba(251,146,60,0.12)' },
    approved_ship:            { label: 'Approved',         color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
    approved_pickup:          { label: 'Approved',         color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
    in_fulfillment:           { label: 'Fulfillment',      color: '#00C4BC', bg: 'rgba(0,196,188,0.12)' },
    shipped:                  { label: 'Shipped',          color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
    delivered:                { label: 'Delivered',        color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
    cancelled:                { label: 'Cancelled',        color: '#ff6b6b', bg: 'rgba(255,107,107,0.12)' },
    active:                   { label: 'Active',           color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
    paused:                   { label: 'Paused',           color: '#ffb800', bg: 'rgba(255,184,0,0.12)' },
    cancelled_sub:            { label: 'Cancelled',        color: '#ff6b6b', bg: 'rgba(255,107,107,0.12)' },
  };
  const s = MAP[status];
  if (!s) return null;
  return (
    <span style={{
      fontSize: '0.64rem', fontWeight: 800, letterSpacing: '0.04em',
      textTransform: 'uppercase', padding: '2px 8px', borderRadius: 999,
      color: s.color, background: s.bg, border: `1px solid ${s.color}33`,
      whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      {s.label}
    </span>
  );
}

/* ── Amount pill ───────────────────────────────────────────────────────── */
function AmountPill({ amount, emphasis }: { amount?: number; emphasis: Emphasis }) {
  if (!amount || !isFinite(amount) || amount <= 0) return null;
  const isOut = emphasis === 'negative';
  const color = isOut ? '#ff6b6b' : '#4ade80';
  return (
    <span style={{
      fontWeight: 900, fontSize: '0.88rem', color,
      whiteSpace: 'nowrap', letterSpacing: '-0.01em',
    }}>
      {isOut ? '−' : '+'}{money(amount)}
    </span>
  );
}

/* ── Summary stats bar ─────────────────────────────────────────────────── */
function SummaryBar({ items, days }: { items: Item[]; days: number | 'all' }) {
  const stats = useMemo(() => {
    const totalIn  = items.filter(i => i.emphasis === 'positive' && i.amount).reduce((s, i) => s + (i.amount || 0), 0);
    const totalOut = items.filter(i => i.emphasis === 'negative' && i.amount).reduce((s, i) => s + (i.amount || 0), 0);
    const orders   = items.filter(i => i.category === 'order').length;
    const alerts   = items.filter(i => i.emphasis === 'warning').length;
    return { totalIn, totalOut, orders, alerts };
  }, [items]);

  const label = days === 'all' ? 'All Time' : `Last ${days}d`;

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20,
    }}>
      {[
        { label: 'Revenue In',   value: money(stats.totalIn) || '$0.00', color: '#4ade80', icon: <TrendingUp size={14} /> },
        { label: 'Paid Out',     value: money(stats.totalOut) || '$0.00', color: '#ff6b6b', icon: <DollarSign size={14} /> },
        { label: 'Orders',       value: String(stats.orders),             color: '#00C4BC', icon: <ShoppingBag size={14} /> },
        { label: 'Alerts',       value: String(stats.alerts),             color: '#ffb800', icon: <AlertTriangle size={14} /> },
      ].map(s => (
        <div key={s.label} style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12, padding: '12px 14px',
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: s.color, opacity: 0.8 }}>
            {s.icon}
            <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {s.label} · {label}
            </span>
          </div>
          <div style={{ color: s.color, fontWeight: 900, fontSize: '1.05rem', letterSpacing: '-0.01em' }}>
            {s.value}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Main component ────────────────────────────────────────────────────── */
export default function AgentActivityFeed() {
  const router = useRouter();
  const [items, setItems] = useState<Item[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<Category | 'all'>('all');
  const [days, setDays] = useState<number | 'all'>(30);
  const [err, setErr] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true); setErr(false);
    try {
      const res = await fetch(`/api/agent/activity?days=${days}`, { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setItems(Array.isArray(json.items) ? json.items : []);
      setCounts(json.counts || {});
    } catch {
      setErr(true); setItems([]);
    } finally {
      setRefreshing(false);
    }
  }, [days]);

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

  const exportCsv = useCallback(() => {
    if (!visible.length) return;
    const csv = toCsv(visible);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-${filter}-${days === 'all' ? 'all' : days + 'd'}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [visible, filter, days]);

  /* ── Render ── */
  return (
    <section style={{ maxWidth: 900, margin: '0 auto', width: '100%' }}>
      <style>{`
        @keyframes pna-spin    { to { transform: rotate(360deg); } }
        @keyframes pna-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes pna-fadein  { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .pna-row { transition: background 0.15s, transform 0.1s; }
        .pna-row:hover { background: rgba(255,255,255,0.065) !important; transform: translateX(2px); }
        .pna-chip { transition: all 0.15s ease; }
        .pna-chip:hover { border-color: rgba(255,255,255,0.35) !important; }
        .pna-win-btn { transition: all 0.15s ease; }
        .pna-win-btn:hover { background: rgba(255,255,255,0.09) !important; }
        .pna-action-btn { transition: all 0.18s ease; }
        .pna-action-btn:hover:not(:disabled) { background: rgba(255,255,255,0.12) !important; transform: translateY(-1px); }
        .pna-action-btn:active { transform: translateY(0) !important; }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, display: 'grid', placeItems: 'center',
              background: 'linear-gradient(135deg, rgba(0,196,188,0.2), rgba(0,196,188,0.05))',
              border: '1px solid rgba(0,196,188,0.3)',
            }}>
              <Activity size={20} strokeWidth={1.8} color="#00C4BC" />
            </div>
            <h1 className="metal-text" style={{
              margin: 0, fontFamily: 'var(--font-brand)', textTransform: 'uppercase',
              letterSpacing: '0.06em', fontSize: '1.45rem', color: 'var(--white)',
            }}>
              Recent Activity
            </h1>
          </div>
          <p style={{ color: 'var(--grey-400)', fontSize: '0.82rem', margin: '6px 0 0 48px' }}>
            Everything happening across your storefront — orders, payments, researchers, commissions, and more.
          </p>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button
            type="button"
            onClick={exportCsv}
            disabled={!visible.length}
            className="pna-action-btn"
            title="Export current view to CSV"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '8px 14px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: visible.length ? '#E2E8F0' : '#4a5568',
              borderRadius: 10, fontSize: '0.78rem', fontWeight: 700,
              cursor: visible.length ? 'pointer' : 'not-allowed',
              opacity: visible.length ? 1 : 0.45,
            }}
          >
            <Download size={13} />
            Export CSV
          </button>
          <button
            type="button"
            onClick={load}
            disabled={refreshing}
            className="pna-action-btn"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '8px 14px',
              background: refreshing ? 'rgba(0,196,188,0.1)' : 'rgba(0,196,188,0.08)',
              border: `1px solid ${refreshing ? 'rgba(0,196,188,0.4)' : 'rgba(0,196,188,0.25)'}`,
              color: '#00C4BC',
              borderRadius: 10, fontSize: '0.78rem', fontWeight: 700,
              cursor: refreshing ? 'not-allowed' : 'pointer',
            }}
          >
            <RefreshCw
              size={13}
              style={{ animation: refreshing ? 'pna-spin 1s linear infinite' : undefined }}
            />
            {refreshing ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* ── Summary stats ── */}
      {items && items.length > 0 && <SummaryBar items={items} days={days} />}

      {/* ── Time-window selector ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--grey-500, #6b7280)', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 800 }}>
          Period
        </span>
        {WINDOWS.map((w) => {
          const active = days === w.value;
          return (
            <button
              key={w.label}
              type="button"
              onClick={() => setDays(w.value)}
              className="pna-win-btn"
              style={{
                padding: '5px 13px', borderRadius: 8, fontSize: '0.74rem', cursor: 'pointer',
                border: `1px solid ${active ? '#00C4BC' : 'rgba(255,255,255,0.10)'}`,
                background: active ? 'rgba(0,196,188,0.12)' : 'rgba(255,255,255,0.03)',
                color: active ? '#00C4BC' : 'var(--grey-400)',
                fontWeight: active ? 800 : 500,
              }}
            >
              {w.label}
            </button>
          );
        })}
      </div>

      {/* ── Category filter chips ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 22 }}>
        {/* "All" chip */}
        {(() => {
          const active = filter === 'all';
          const n = items?.length || 0;
          return (
            <button
              key="all"
              type="button"
              onClick={() => setFilter('all')}
              className="pna-chip"
              style={{
                padding: '5px 12px 5px 10px', borderRadius: 999, fontSize: '0.76rem', cursor: 'pointer',
                border: `1px solid ${active ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.10)'}`,
                background: active ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.03)',
                color: active ? '#fff' : 'var(--grey-400)', fontWeight: active ? 800 : 500,
                display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
              }}
            >
              <Activity size={11} strokeWidth={2} />
              All
              <span style={{
                fontSize: '0.68rem', fontWeight: 800,
                background: active ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)',
                borderRadius: 999, padding: '1px 7px', color: active ? '#fff' : '#a3a3a3',
              }}>
                {n}
              </span>
            </button>
          );
        })()}

        {/* Per-category chips */}
        {ALL_CATS.map((cat) => {
          const n = counts[cat] || 0;
          if (n === 0) return null;
          const active = filter === cat;
          const meta = CAT_META[cat];
          const Icon = meta.icon;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setFilter(cat)}
              className="pna-chip"
              style={{
                padding: '5px 12px 5px 10px', borderRadius: 999, fontSize: '0.76rem', cursor: 'pointer',
                border: `1px solid ${active ? meta.accent + '80' : 'rgba(255,255,255,0.10)'}`,
                background: active ? `${meta.accent}18` : 'rgba(255,255,255,0.03)',
                color: active ? meta.accent : 'var(--grey-400)', fontWeight: active ? 800 : 500,
                display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
              }}
            >
              <Icon size={11} strokeWidth={2.2} />
              {meta.label}
              <span style={{
                fontSize: '0.68rem', fontWeight: 800,
                background: active ? `${meta.accent}30` : 'rgba(255,255,255,0.08)',
                borderRadius: 999, padding: '1px 7px',
                color: active ? meta.accent : '#a3a3a3',
              }}>
                {n}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Body ── */}
      {items === null ? (
        /* Skeleton */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{
              height: 70, borderRadius: 14,
              background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%)',
              backgroundSize: '200% 100%',
              animation: `pna-shimmer 1.5s ease-in-out infinite`,
              animationDelay: `${i * 0.07}s`,
            }} />
          ))}
        </div>
      ) : err ? (
        <div style={{
          padding: '36px 24px', textAlign: 'center', borderRadius: 16,
          background: 'rgba(255,107,107,0.05)', border: '1px solid rgba(255,107,107,0.15)',
        }}>
          <AlertTriangle size={36} color="#ff6b6b" style={{ marginBottom: 12, opacity: 0.8 }} />
          <div style={{ color: '#fff', fontWeight: 700, marginBottom: 6 }}>Could not load activity</div>
          <div style={{ color: 'var(--grey-400)', fontSize: '0.85rem', marginBottom: 16 }}>
            Check your connection and try again.
          </div>
          <button
            type="button"
            onClick={load}
            style={{
              padding: '9px 20px', background: '#00C4BC', color: '#0A1018',
              border: 'none', borderRadius: 10, fontWeight: 800, cursor: 'pointer', fontSize: '0.85rem',
            }}
          >
            Try Again
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div style={{
          padding: '52px 24px', textAlign: 'center', borderRadius: 16,
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16, display: 'grid', placeItems: 'center', margin: '0 auto 16px',
            background: 'linear-gradient(135deg, rgba(0,196,188,0.12), rgba(0,196,188,0.04))',
            border: '1px solid rgba(0,196,188,0.2)',
          }}>
            <Activity size={28} strokeWidth={1.5} color="#00C4BC" style={{ opacity: 0.7 }} />
          </div>
          <h3 style={{ color: '#fff', margin: '0 0 8px', fontWeight: 800 }}>No activity yet</h3>
          <p style={{ color: 'var(--grey-400)', fontSize: '0.86rem', maxWidth: 380, margin: '0 auto 20px', lineHeight: 1.55 }}>
            {filter !== 'all'
              ? `No ${CAT_META[filter as Category]?.label || filter} events in this period. Try "All" or a wider time window.`
              : 'As your researchers order, commissions settle, and your business grows — it will all appear here in real time.'}
          </p>
          {days !== 'all' && (
            <button
              type="button"
              onClick={() => setDays('all')}
              style={{
                padding: '9px 20px', background: 'rgba(0,196,188,0.1)',
                border: '1px solid rgba(0,196,188,0.3)', color: '#00C4BC',
                borderRadius: 10, fontWeight: 800, cursor: 'pointer', fontSize: '0.84rem',
              }}
            >
              Show All Time
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {groups.map((g, gi) => (
            <div key={g.label} style={{ animation: `pna-fadein 0.25s ease ${gi * 0.04}s both` }}>
              {/* Day header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
              }}>
                <div style={{
                  fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.1em',
                  color: 'var(--grey-500, #6b7280)', fontWeight: 800,
                  whiteSpace: 'nowrap',
                }}>
                  {g.label}
                </div>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                <div style={{
                  fontSize: '0.64rem', color: 'var(--grey-500)', fontWeight: 700,
                  background: 'rgba(255,255,255,0.05)', borderRadius: 999, padding: '2px 8px',
                }}>
                  {g.rows.length} event{g.rows.length !== 1 ? 's' : ''}
                </div>
              </div>

              {/* Rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {g.rows.map((it, ri) => {
                  const meta = CAT_META[it.category] || CAT_META.wallet;
                  const Icon = meta.icon;
                  const clickable = !!it.href;
                  return (
                    <div
                      key={it.id}
                      role={clickable ? 'button' : undefined}
                      tabIndex={clickable ? 0 : undefined}
                      onClick={() => { if (it.href) router.push(it.href); }}
                      onKeyDown={(e) => {
                        if (clickable && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault(); router.push(it.href!);
                        }
                      }}
                      className="pna-row"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '11px 14px 11px 0',
                        borderRadius: 13,
                        background: 'rgba(255,255,255,0.035)',
                        border: '1px solid rgba(255,255,255,0.07)',
                        borderLeft: `3px solid ${meta.accent}`,
                        cursor: clickable ? 'pointer' : 'default',
                        animation: `pna-fadein 0.2s ease ${ri * 0.03}s both`,
                      }}
                    >
                      {/* Category icon */}
                      <div style={{
                        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                        display: 'grid', placeItems: 'center',
                        background: `${meta.accent}14`,
                        border: `1px solid ${meta.accent}30`,
                        color: meta.accent,
                        marginLeft: 10,
                      }}>
                        <Icon size={17} strokeWidth={1.8} />
                      </div>

                      {/* Text */}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                          <span style={{ color: '#F0F4F8', fontWeight: 700, fontSize: '0.875rem' }}>
                            {it.title}
                          </span>
                          <StatusBadge status={it.status} />
                        </div>
                        {it.subtitle && (
                          <div style={{
                            color: 'var(--grey-400)', fontSize: '0.76rem', marginTop: 1,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {it.subtitle}
                          </div>
                        )}
                      </div>

                      {/* Amount + time */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0, paddingRight: 4 }}>
                        <AmountPill amount={it.amount} emphasis={it.emphasis} />
                        <span style={{
                          color: 'var(--grey-500, #6b7280)', fontSize: '0.7rem', whiteSpace: 'nowrap', fontWeight: 600,
                        }}>
                          {exactTime(it.timestamp)}
                        </span>
                      </div>

                      {clickable && (
                        <ChevronRight size={15} style={{ color: 'rgba(255,255,255,0.25)', flexShrink: 0, marginRight: 4 }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Footer total */}
          <div style={{
            textAlign: 'center', padding: '14px 0',
            color: 'var(--grey-500)', fontSize: '0.75rem', fontWeight: 600,
            borderTop: '1px solid rgba(255,255,255,0.05)',
          }}>
            Showing {visible.length} event{visible.length !== 1 ? 's' : ''}
            {days !== 'all' ? ` · Last ${days} days` : ' · All time'}
            {filter !== 'all' ? ` · ${CAT_META[filter as Category]?.label || filter}` : ''}
          </div>
        </div>
      )}
    </section>
  );
}
