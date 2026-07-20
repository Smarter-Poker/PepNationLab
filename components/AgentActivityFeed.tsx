'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  Activity, Clock, UserPlus, TrendingUp, Gift, Ticket,
  AlertTriangle, Users, Wallet, RefreshCw, ChevronRight, Download,
  RotateCcw, DollarSign, Repeat, Mail, ShoppingBag, Search, X,
  Megaphone, FileCheck, ChevronDown, TrendingDown, ShoppingCart, Trophy
} from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────────────────── */
type Category =
  | 'order' | 'payment' | 'researcher' | 'commission'
  | 'referral' | 'coupon' | 'inventory' | 'subagent' | 'wallet'
  | 'refund' | 'payout' | 'subscription' | 'invitation'
  | 'proof' | 'broadcast' | 'cart' | 'milestone';

type Emphasis = 'positive' | 'negative' | 'warning' | 'neutral';

interface ActivityAction {
  label: string;
  href: string;
}

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
  primaryAction?: ActivityAction;
}

interface FeedResponse {
  items: Item[];
  counts: Record<string, number>;
  total: number;
  hasMore: boolean;
  nextCursor: string | null;
  window: number | null;
  summary: { totalIn: number; totalOut: number; orderCount: number; alertCount: number };
  generatedAt: string;
}

/* ── Category metadata ─────────────────────────────────────────────────── */
type CatMeta = {
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>;
  accent: string;
};

const CAT_META: Record<Category, CatMeta> = {
  order:        { label: 'Orders',         icon: ShoppingBag,  accent: '#00C4BC' },
  payment:      { label: 'Payments',        icon: Clock,        accent: '#fb923c' },
  researcher:   { label: 'Researchers',     icon: UserPlus,     accent: '#7ee787' },
  commission:   { label: 'Commissions',     icon: TrendingUp,   accent: '#00C4BC' },
  referral:     { label: 'Referrals',       icon: Gift,         accent: '#38bdf8' },
  coupon:       { label: 'Coupons',         icon: Ticket,       accent: '#fb923c' },
  inventory:    { label: 'Inventory',       icon: AlertTriangle,accent: '#fb923c' },
  subagent:     { label: 'Sub-Agents',      icon: Users,        accent: '#60a5fa' },
  wallet:       { label: 'Wallet',          icon: Wallet,       accent: '#a3a3a3' },
  refund:       { label: 'Refunds',         icon: RotateCcw,    accent: '#ff6b6b' },
  payout:       { label: 'Payouts',         icon: DollarSign,   accent: '#4ade80' },
  subscription: { label: 'Subscriptions',   icon: Repeat,       accent: '#60a5fa' },
  invitation:   { label: 'Invitations',     icon: Mail,         accent: '#38bdf8' },
  proof:        { label: 'Receipts',        icon: FileCheck,    accent: '#00E5FF' },
  broadcast:    { label: 'Broadcasts',      icon: Megaphone,    accent: '#fb923c' },
  cart:         { label: 'Carts',           icon: ShoppingCart, accent: '#fb923c' },
  milestone:    { label: 'Milestones',      icon: Trophy,       accent: '#facc15' },
};

const ALL_CATS = Object.keys(CAT_META) as Category[];

const WINDOWS: { label: string; value: number | 'all' }[] = [
  { label: '7d', value: 7 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
  { label: '1y', value: 365 },
  { label: 'All', value: 'all' },
];

/* ── Formatters ────────────────────────────────────────────────────────── */
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
const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending_customer_payment: { label: 'Awaiting Payment', color: '#fb923c', bg: 'rgba(251,146,60,0.12)' },
  agent_approval_pending:   { label: 'Needs Approval',   color: '#fb923c', bg: 'rgba(251,146,60,0.12)' },
  admin_approval_pending:   { label: 'Needs Approval',   color: '#fb923c', bg: 'rgba(251,146,60,0.12)' },
  approved_ship:            { label: 'Approved',         color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
  approved_pickup:          { label: 'Approved',         color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
  in_fulfillment:           { label: 'Fulfillment',      color: '#00C4BC', bg: 'rgba(0,196,188,0.12)' },
  shipped:                  { label: 'Shipped',          color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  delivered:                { label: 'Delivered',        color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
  cancelled:                { label: 'Cancelled',        color: '#ff6b6b', bg: 'rgba(255,107,107,0.12)' },
  active:                   { label: 'Active',           color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
  paused:                   { label: 'Paused',           color: '#fb923c', bg: 'rgba(251,146,60,0.12)' },
  completed:                { label: 'Completed',        color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
  pending:                  { label: 'Pending',          color: '#a3a3a3', bg: 'rgba(163,163,163,0.12)' },
  failed:                   { label: 'Failed',           color: '#ff6b6b', bg: 'rgba(255,107,107,0.12)' },
};

function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  const s = STATUS_MAP[status];
  if (!s) return null;
  return (
    <span style={{
      fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase',
      padding: '2px 8px', borderRadius: 999, color: s.color, background: s.bg,
      border: `1px solid ${s.color}33`, whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      {s.label}
    </span>
  );
}

/* ── Amount pill ───────────────────────────────────────────────────────── */
function AmountPill({ amount, emphasis }: { amount?: number; emphasis: Emphasis }) {
  if (!amount || !isFinite(amount) || amount <= 0) return null;
  const isOut = emphasis === 'negative';
  return (
    <span style={{
      fontWeight: 900, fontSize: '0.88rem',
      color: isOut ? '#ff6b6b' : '#4ade80',
      whiteSpace: 'nowrap', letterSpacing: '-0.01em',
    }}>
      {isOut ? '−' : '+'}{money(amount)}
    </span>
  );
}

/* ── Trend indicator ────────────────────────────────────────────────────── */
function TrendBadge({ current, previous }: { current: number; previous?: number }) {
  if (previous == null || previous === 0) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return <span style={{ color: '#a3a3a3', fontSize: '0.65rem' }}>—</span>;
  const up = pct > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 2,
      color: up ? '#4ade80' : '#ff6b6b', fontSize: '0.65rem', fontWeight: 800,
    }}>
      <Icon size={10} />
      {up ? '+' : ''}{pct}%
    </span>
  );
}

/* ── Activity heatmap ───────────────────────────────────────────────────── */
function ActivityHeatmap({ items, days }: { items: Item[]; days: number | 'all' }) {
  const numDays = typeof days === 'number' ? Math.min(days, 30) : 30;
  const bars = useMemo(() => {
    const counts: number[] = new Array(numDays).fill(0);
    const now = Date.now();
    for (const it of items) {
      const age = Math.floor((now - new Date(it.timestamp).getTime()) / 86400000);
      if (age >= 0 && age < numDays) counts[numDays - 1 - age]++;
    }
    return counts;
  }, [items, numDays]);

  const max = Math.max(...bars, 1);

  const labelEvery = numDays <= 7 ? 1 : numDays <= 14 ? 2 : numDays <= 30 ? 5 : 7;
  const now = new Date();

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 14, padding: '14px 16px', marginBottom: 20,
    }}>
      <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--grey-500)', fontWeight: 800, marginBottom: 10 }}>
        Activity — Last {numDays} Days
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 48 }}>
        {bars.map((count, i) => {
          const height = count === 0 ? 3 : Math.max(8, Math.round((count / max) * 44));
          const isToday = i === numDays - 1;
          const d = new Date(now); d.setDate(d.getDate() - (numDays - 1 - i));
          const label = (i % labelEvery === 0 || isToday)
            ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, position: 'relative' }} title={`${count} event${count !== 1 ? 's' : ''} — ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}>
              <div style={{
                width: '100%', height,
                background: count === 0
                  ? 'rgba(255,255,255,0.06)'
                  : isToday
                    ? '#00C4BC'
                    : `rgba(0,196,188,${0.2 + 0.8 * (count / max)})`,
                borderRadius: '3px 3px 0 0',
                transition: 'height 0.3s ease',
              }} />
            </div>
          );
        })}
      </div>
      {/* X-axis labels */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 2, marginTop: 4 }}>
        {bars.map((_, i) => {
          const d = new Date(now); d.setDate(d.getDate() - (numDays - 1 - i));
          const label = (i % labelEvery === 0 || i === numDays - 1)
            ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
          return (
            <div key={i} style={{ flex: 1, fontSize: '0.55rem', color: 'var(--grey-500)', textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'clip' }}>
              {label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Summary stats bar ─────────────────────────────────────────────────── */
function SummaryBar({
  summary, prevSummary, days, onStatClick
}: {
  summary: { totalIn: number; totalOut: number; orderCount: number; alertCount: number };
  prevSummary?: { totalIn: number; totalOut: number; orderCount: number; alertCount: number };
  days: number | 'all';
  onStatClick?: (label: string) => void;
}) {
  const label = days === 'all' ? 'All Time' : `${days}d`;
  const stats = [
    { label: 'Revenue In',  value: money(summary.totalIn) || '$0.00',       prev: prevSummary?.totalIn,    prevVal: money(prevSummary?.totalIn),  color: '#4ade80', icon: <TrendingUp  size={14} /> },
    { label: 'Paid Out',    value: money(summary.totalOut) || '$0.00',       prev: prevSummary?.totalOut,   prevVal: money(prevSummary?.totalOut), color: '#ff6b6b', icon: <DollarSign  size={14} /> },
    { label: 'Orders',      value: String(summary.orderCount),               prev: prevSummary?.orderCount, color: '#00C4BC', icon: <ShoppingBag  size={14} /> },
    { label: 'Alerts',      value: String(summary.alertCount),               prev: prevSummary?.alertCount, color: '#fb923c', icon: <AlertTriangle size={14} /> },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 18 }}
      className="pna-stats-grid">
      {stats.map(s => (
        <div key={s.label}
          role={onStatClick ? "button" : undefined}
          tabIndex={onStatClick ? 0 : undefined}
          onClick={() => onStatClick?.(s.label)}
          onKeyDown={(e) => {
            if (onStatClick && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              onStatClick(s.label);
            }
          }}
          style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12, padding: '12px 14px',
          cursor: onStatClick ? 'pointer' : 'default',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: s.color, opacity: 0.8, marginBottom: 4 }}>
            {s.icon}
            <span style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {s.label} · {label}
            </span>
          </div>
          <div style={{ color: s.color, fontWeight: 900, fontSize: '1.05rem', letterSpacing: '-0.01em' }}>
            {s.value}
          </div>
          {prevSummary != null && (
            <div style={{ marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
              <TrendBadge
                current={typeof s.prev === 'number' ? (s.label === 'Revenue In' ? summary.totalIn : s.label === 'Paid Out' ? summary.totalOut : s.label === 'Orders' ? summary.orderCount : summary.alertCount) : 0}
                previous={s.prev}
              />
              {s.prev != null && (
                <span style={{ color: 'var(--grey-500)', fontSize: '0.6rem' }}>
                  vs {s.prevVal || s.prev}
                </span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Needs Attention strip ──────────────────────────────────────────────── */
function NeedsAttention({ items, onItemClick }: { items: Item[]; onItemClick: (href?: string) => void }) {
  const urgent = items.filter(i => i.emphasis === 'warning');
  if (urgent.length === 0) return null;
  return (
    <div style={{
      borderRadius: 14, padding: '14px 16px', marginBottom: 20,
      background: 'linear-gradient(135deg, rgba(251,146,60,0.07), rgba(251,146,60,0.02))',
      border: '1px solid rgba(251,146,60,0.25)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <AlertTriangle size={15} color="#fb923c" />
        <span style={{ color: '#fb923c', fontSize: '0.72rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Needs Attention · {urgent.length} item{urgent.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {urgent.slice(0, 5).map(it => {
          const meta = CAT_META[it.category] || CAT_META.wallet;
          const Icon = meta.icon;
          return (
            <div
              key={it.id}
              role="button"
              tabIndex={0}
              onClick={() => onItemClick(it.href)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onItemClick(it.href); } }}
              className="pna-attn-row"
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                borderRadius: 9, background: 'rgba(251,146,60,0.06)',
                border: '1px solid rgba(251,146,60,0.15)',
                cursor: 'pointer',
              }}
            >
              <Icon size={14} style={{ color: meta.accent, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ color: '#F0F4F8', fontSize: '0.82rem', fontWeight: 700 }}>{it.title}</span>
                {it.subtitle && (
                  <span style={{ color: 'var(--grey-400)', fontSize: '0.75rem', marginLeft: 8 }}>{it.subtitle}</span>
                )}
              </div>
              {it.amount && it.amount > 0 && (
                <span style={{ color: '#fb923c', fontWeight: 900, fontSize: '0.82rem', flexShrink: 0 }}>
                  {money(it.amount)}
                </span>
              )}
              <span style={{ color: 'var(--grey-500)', fontSize: '0.68rem', flexShrink: 0 }}>
                {relTime(it.timestamp)}
              </span>
              <ChevronRight size={13} color="rgba(255,255,255,0.25)" />
            </div>
          );
        })}
        {urgent.length > 5 && (
          <div style={{ textAlign: 'center', color: '#fb923c', fontSize: '0.72rem', fontWeight: 700, padding: '4px 0' }}>
            +{urgent.length - 5} more — filter by category to see all
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────────────────────── */
const PAGE_SIZE = 50;
const SEEN_KEY  = 'pna_activity_seen';

export default function AgentActivityFeed() {
  const router = useRouter();

  // Data state
  const [allItems, setAllItems]     = useState<Item[] | null>(null);
  const [counts, setCounts]         = useState<Record<string, number>>({});
  const [summary, setSummary]       = useState<FeedResponse['summary'] | null>(null);
  const [prevSummary, setPrevSummary] = useState<FeedResponse['summary'] | undefined>(undefined);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore]       = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // UI state
  const [filter, setFilter]         = useState<Category | 'all'>('all');
  const [days, setDays]             = useState<number | 'all'>(30);
  const [searchQ, setSearchQ]       = useState('');
  const [minAmt, setMinAmt]         = useState('');
  const [maxAmt, setMaxAmt]         = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr]               = useState(false);
  const [isLive, setIsLive]         = useState(false);
  const [newLiveItems, setNewLiveItems] = useState<Item[]>([]);
  const [seenIds, setSeenIds]       = useState<Set<string>>(new Set());
  const [showHeatmap, setShowHeatmap] = useState(true);

  // Seen-tracking from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SEEN_KEY);
      if (raw) setSeenIds(new Set(JSON.parse(raw)));
    } catch { /* ignore */ }
  }, []);

  const markSeen = useCallback((ids: string[]) => {
    setSeenIds(prev => {
      const next = new Set([...prev, ...ids]);
      try { localStorage.setItem(SEEN_KEY, JSON.stringify([...next].slice(-500))); } catch { /* ignore */ }
      return next;
    });
  }, []);

  /* ── Load / refresh ───────────────────────────────────────────────────── */
  const load = useCallback(async (reset = true) => {
    if (reset) { setRefreshing(true); setErr(false); setAllItems(null); }
    try {
      const d = days === 'all' ? 'all' : days;
      const res = await fetch(`/api/agent/activity?days=${d}&limit=${PAGE_SIZE}`, { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const json: FeedResponse = await res.json();
      setAllItems(json.items || []);
      setCounts(json.counts || {});
      setSummary(json.summary || null);
      setNextCursor(json.nextCursor || null);
      setHasMore(json.hasMore || false);
      // mark initial items as seen
      markSeen((json.items || []).map(i => i.id));
      setNewLiveItems([]);
    } catch {
      setErr(true); setAllItems([]);
    } finally {
      setRefreshing(false);
    }
  }, [days, markSeen]);

  // Load prev-window summary for trend comparison
  useEffect(() => {
    if (days === 'all') { setPrevSummary(undefined); return; }
    const controller = new AbortController();
    fetch(`/api/agent/activity?days=${days}&prev=1&limit=1`, { signal: controller.signal })
      .then(r => r.ok ? r.json() : null)
      .then((j: FeedResponse | null) => { if (j?.summary) setPrevSummary(j.summary); })
      .catch(() => {});
    return () => controller.abort();
  }, [days]);

  useEffect(() => { load(true); }, [load]);

  /* ── Load more (pagination) ────────────────────────────────────────────── */
  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const d = days === 'all' ? 'all' : days;
      const res = await fetch(`/api/agent/activity?days=${d}&limit=${PAGE_SIZE}&cursor=${encodeURIComponent(nextCursor)}`, { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const json: FeedResponse = await res.json();
      setAllItems(prev => [...(prev || []), ...(json.items || [])]);
      setNextCursor(json.nextCursor || null);
      setHasMore(json.hasMore || false);
      markSeen((json.items || []).map(i => i.id));
    } catch { /* noop */ }
    finally { setLoadingMore(false); }
  }, [nextCursor, loadingMore, days, markSeen]);

  /* ── Supabase Realtime subscription ───────────────────────────────────── */
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let active = true;

    (async () => {
      // Get agent ID from session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id || !active) return;

      channel = supabase
        .channel(`activity-feed-${session.user.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'orders', filter: `agent_id=eq.${session.user.id}` },
          (payload) => {
            const order = payload.new as {
              id?: string; status?: string; total?: number; created_at?: string;
            };
            if (!order?.id) return;
            const st = String(order.status || '');
            const newItem: Item = {
              id: `order:${order.id}`,
              category: st === 'pending_customer_payment' ? 'payment' : 'order',
              title: st === 'pending_customer_payment' ? 'Awaiting payment' : 'New order placed',
              subtitle: 'Live · Just now',
              amount: Number(order.total) || 0,
              status: st,
              timestamp: order.created_at || new Date().toISOString(),
              href: `/orders/${order.id}`,
              emphasis: st === 'pending_customer_payment' ? 'warning' : 'positive',
            };
            setNewLiveItems(prev => [newItem, ...prev].slice(0, 20));
          }
        )
        // Note: payment_proofs realtime intentionally omitted — Realtime
        // cannot filter on joined tables (e.g. orders.agent_id), so a channel
        // on payment_proofs would fire for ALL agents' orders, leaking events
        // cross-agent. Proof notifications surface via the API poll instead.
        .subscribe((status) => {
          if (active) setIsLive(status === 'SUBSCRIBED');
        });
    })();

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
      setIsLive(false);
    };
  }, []);

  /* ── Client-side filtering ─────────────────────────────────────────────── */
  const liveAndLoaded = useMemo<Item[]>(() => {
    const loaded = allItems || [];
    // Merge live items at top, deduplicate by id
    const existing = new Set(loaded.map(i => i.id));
    const uniqueLive = newLiveItems.filter(i => !existing.has(i.id));
    return [...uniqueLive, ...loaded];
  }, [allItems, newLiveItems]);

  const visible = useMemo(() => {
    let rows = liveAndLoaded;
    if (filter !== 'all') rows = rows.filter(i => i.category === filter);
    if (searchQ.trim()) {
      const q = searchQ.toLowerCase();
      rows = rows.filter(i =>
        i.title.toLowerCase().includes(q) ||
        (i.subtitle || '').toLowerCase().includes(q)
      );
    }
    const mn = parseFloat(minAmt);
    const mx = parseFloat(maxAmt);
    if (!isNaN(mn)) rows = rows.filter(i => (i.amount || 0) >= mn);
    if (!isNaN(mx)) rows = rows.filter(i => (i.amount || 0) <= mx);
    return rows;
  }, [liveAndLoaded, filter, searchQ, minAmt, maxAmt]);

  /* ── Group into days ────────────────────────────────────────────────────── */
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

  /* ── Navigate helper ─────────────────────────────────────────────────────  */
  const navigate = useCallback((href?: string) => {
    if (!href) return;
    router.push(href);
  }, [router]);

  /* ── Export CSV ─────────────────────────────────────────────────────────── */
  const exportCsv = useCallback(() => {
    if (!visible.length) return;
    const csv = toCsv(visible);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `activity-${filter}-${days === 'all' ? 'all' : days + 'd'}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [visible, filter, days]);

  /* ── Render ────────────────────────────────────────────────────────────── */
  const hasFilters = filter !== 'all' || searchQ !== '' || minAmt !== '' || maxAmt !== '';

  return (
    <section style={{ maxWidth: 900, margin: '0 auto', width: '100%' }}>
      <style>{`
        @keyframes pna-spin    { to { transform: rotate(360deg); } }
        @keyframes pna-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes pna-fadein  { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pna-pulse   { 0%,100% { opacity:1; } 50% { opacity:.4; } }
        @keyframes pna-slidein { from { opacity:0; transform:translateY(-12px); } to { opacity:1; transform:translateY(0); } }
        .pna-row       { transition: background 0.15s, transform 0.12s; }
        .pna-row:hover { background: rgba(255,255,255,0.065) !important; transform: translateX(3px); }
        .pna-attn-row  { transition: background 0.15s, transform 0.12s; }
        .pna-attn-row:hover { background: rgba(251,146,60,0.1) !important; transform: translateX(2px); }
        .pna-chip      { transition: all 0.15s ease; cursor:pointer; }
        .pna-chip:hover { border-color: rgba(255,255,255,0.3) !important; }
        .pna-win-btn   { transition: all 0.15s ease; cursor:pointer; }
        .pna-win-btn:hover { background: rgba(255,255,255,0.09) !important; }
        .pna-btn       { transition: all 0.18s ease; }
        .pna-btn:hover:not(:disabled) { background: rgba(255,255,255,0.12) !important; transform: translateY(-1px); }
        .pna-btn:active { transform: translateY(0) !important; }
        .pna-unseen::before {
          content:''; position:absolute; top:50%; left:-1px;
          transform:translateY(-50%);
          width:6px; height:6px; border-radius:50%;
          background:#00C4BC;
          animation: pna-pulse 2s infinite;
        }
        @media (max-width: 480px) {
          .pna-stats-grid { grid-template-columns: repeat(2,1fr) !important; }
          .pna-actions    { flex-wrap:wrap; }
          .pna-filter-row { flex-wrap:wrap; }
        }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
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
            {/* Live dot */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, background: isLive ? 'rgba(74,222,128,0.1)' : 'rgba(163,163,163,0.08)', border: `1px solid ${isLive ? 'rgba(74,222,128,0.3)' : 'rgba(163,163,163,0.2)'}` }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: isLive ? '#4ade80' : '#a3a3a3', animation: isLive ? 'pna-pulse 2s infinite' : undefined }} />
              <span style={{ fontSize: '0.62rem', fontWeight: 800, color: isLive ? '#4ade80' : '#a3a3a3', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {isLive ? 'Live' : 'Offline'}
              </span>
            </div>
          </div>
          <p style={{ color: 'var(--grey-400)', fontSize: '0.82rem', margin: '6px 0 0 48px' }}>
            Everything across your storefront — orders, payments, researchers, commissions &amp; more.
          </p>
        </div>

        {/* Actions */}
        <div className="pna-actions" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button type="button" onClick={exportCsv} disabled={!visible.length} className="pna-btn"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)',
              color: visible.length ? '#E2E8F0' : '#4a5568', borderRadius: 10,
              fontSize: '0.78rem', fontWeight: 700,
              cursor: visible.length ? 'pointer' : 'not-allowed', opacity: visible.length ? 1 : 0.45,
            }}>
            <Download size={13} /> Export CSV
          </button>
          <button type="button" onClick={() => load(true)} disabled={refreshing} className="pna-btn"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px',
              background: refreshing ? 'rgba(0,196,188,0.1)' : 'rgba(0,196,188,0.08)',
              border: `1px solid ${refreshing ? 'rgba(0,196,188,0.4)' : 'rgba(0,196,188,0.25)'}`,
              color: '#00C4BC', borderRadius: 10, fontSize: '0.78rem', fontWeight: 700,
              cursor: refreshing ? 'not-allowed' : 'pointer',
            }}>
            <RefreshCw size={13} style={{ animation: refreshing ? 'pna-spin 1s linear infinite' : undefined }} />
            {refreshing ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* ── Live new items banner ── */}
      {newLiveItems.length > 0 && (
        <div style={{
          borderRadius: 12, padding: '10px 16px', marginBottom: 14,
          background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          animation: 'pna-slidein 0.3s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', animation: 'pna-pulse 1.5s infinite' }} />
            <span style={{ color: '#4ade80', fontWeight: 800, fontSize: '0.82rem' }}>
              {newLiveItems.length} new event{newLiveItems.length !== 1 ? 's' : ''} received in real time
            </span>
          </div>
          <button type="button" onClick={() => load(true)} className="pna-btn"
            style={{ background: '#4ade80', color: '#0A1018', border: 'none', borderRadius: 8, padding: '5px 12px', fontSize: '0.74rem', fontWeight: 900, cursor: 'pointer' }}>
            Show All
          </button>
        </div>
      )}

      {/* ── Summary Stats ── */}
      <SummaryBar
        summary={summary}
        prevSummary={prevSummary}
        days={days}
        onStatClick={(label) => {
          if (label === 'Revenue In') setFilter('payment');
          else if (label === 'Paid Out') setFilter('payout');
          else if (label === 'Orders') setFilter('order');
          else if (label === 'Alerts') setFilter('all');
        }}
      />

      {/* ── Heatmap ── */}
      {liveAndLoaded.length > 0 && (
        <div>
          <button type="button" onClick={() => setShowHeatmap(p => !p)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--grey-500)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8, padding: 0 }}>
            <ChevronDown size={12} style={{ transform: showHeatmap ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />
            Activity Chart
          </button>
          {showHeatmap && <ActivityHeatmap items={liveAndLoaded} days={days} />}
        </div>
      )}

      {/* ── Period selector ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--grey-500)', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 800 }}>Period</span>
        {WINDOWS.map(w => {
          const active = days === w.value;
          return (
            <button key={w.label} type="button" onClick={() => setDays(w.value)} className="pna-win-btn"
              style={{
                padding: '5px 13px', borderRadius: 8, fontSize: '0.74rem',
                border: `1px solid ${active ? '#00C4BC' : 'rgba(255,255,255,0.10)'}`,
                background: active ? 'rgba(0,196,188,0.12)' : 'rgba(255,255,255,0.03)',
                color: active ? '#00C4BC' : 'var(--grey-400)', fontWeight: active ? 800 : 500,
              }}>
              {w.label}
            </button>
          );
        })}
      </div>

      {/* ── Search + amount filter ── */}
      <div className="pna-filter-row" style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--grey-500)', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Search activity…"
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box', padding: '7px 30px 7px 30px',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 9, color: '#E2E8F0', fontSize: '0.8rem', outline: 'none',
            }}
          />
          {searchQ && (
            <button type="button" onClick={() => setSearchQ('')}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--grey-500)', padding: 0, display: 'flex' }}>
              <X size={13} />
            </button>
          )}
        </div>
        {/* Min amount */}
        <input
          type="number"
          placeholder="Min $"
          value={minAmt}
          onChange={e => setMinAmt(e.target.value)}
          style={{
            width: 80, padding: '7px 10px',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 9, color: '#E2E8F0', fontSize: '0.8rem', outline: 'none',
          }}
        />
        <span style={{ color: 'var(--grey-500)', alignSelf: 'center', fontSize: '0.75rem' }}>–</span>
        {/* Max amount */}
        <input
          type="number"
          placeholder="Max $"
          value={maxAmt}
          onChange={e => setMaxAmt(e.target.value)}
          style={{
            width: 80, padding: '7px 10px',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 9, color: '#E2E8F0', fontSize: '0.8rem', outline: 'none',
          }}
        />
        {hasFilters && (
          <button type="button" onClick={() => { setFilter('all'); setSearchQ(''); setMinAmt(''); setMaxAmt(''); }}
            className="pna-btn"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px',
              background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.25)',
              color: '#ff6b6b', borderRadius: 9, fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer',
            }}>
            <X size={11} /> Clear Filters
          </button>
        )}
      </div>

      {/* ── Category chips ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
        {/* All */}
        {(() => {
          const active = filter === 'all';
          const n = liveAndLoaded.length;
          return (
            <button key="all" type="button" onClick={() => setFilter('all')} className="pna-chip"
              style={{
                padding: '5px 12px 5px 10px', borderRadius: 999, fontSize: '0.75rem',
                border: `1px solid ${active ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.10)'}`,
                background: active ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.03)',
                color: active ? '#fff' : 'var(--grey-400)', fontWeight: active ? 800 : 500,
                display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
              }}>
              <Activity size={11} strokeWidth={2} />
              All
              <span style={{ fontSize: '0.67rem', fontWeight: 800, background: active ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)', borderRadius: 999, padding: '1px 7px', color: active ? '#fff' : '#a3a3a3' }}>
                {n}
              </span>
            </button>
          );
        })()}
        {/* Per-category */}
        {ALL_CATS.map(cat => {
          const n = counts[cat] || 0;
          if (n === 0) return null;
          const active = filter === cat;
          const meta   = CAT_META[cat];
          const Icon   = meta.icon;
          return (
            <button key={cat} type="button" onClick={() => setFilter(cat)} className="pna-chip"
              style={{
                padding: '5px 12px 5px 10px', borderRadius: 999, fontSize: '0.75rem',
                border: `1px solid ${active ? meta.accent + '80' : 'rgba(255,255,255,0.10)'}`,
                background: active ? `${meta.accent}18` : 'rgba(255,255,255,0.03)',
                color: active ? meta.accent : 'var(--grey-400)', fontWeight: active ? 800 : 500,
                display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
              }}>
              <Icon size={11} strokeWidth={2.2} />
              {meta.label}
              <span style={{ fontSize: '0.67rem', fontWeight: 800, background: active ? `${meta.accent}30` : 'rgba(255,255,255,0.08)', borderRadius: 999, padding: '1px 7px', color: active ? meta.accent : '#a3a3a3' }}>
                {n}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Needs Attention ── */}
      {allItems !== null && !searchQ && !minAmt && !maxAmt && (
        <NeedsAttention items={liveAndLoaded} onItemClick={navigate} />
      )}

      {/* ── Body ── */}
      {allItems === null ? (
        /* Skeleton */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...Array(7)].map((_, i) => (
            <div key={i} style={{
              height: 68, borderRadius: 14,
              background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%)',
              backgroundSize: '200% 100%', animation: `pna-shimmer 1.5s ease-in-out infinite`,
              animationDelay: `${i * 0.08}s`,
            }} />
          ))}
        </div>
      ) : err ? (
        <div style={{ padding: '36px 24px', textAlign: 'center', borderRadius: 16, background: 'rgba(255,107,107,0.05)', border: '1px solid rgba(255,107,107,0.15)' }}>
          <AlertTriangle size={36} color="#ff6b6b" style={{ marginBottom: 12, opacity: 0.8 }} />
          <div style={{ color: '#fff', fontWeight: 700, marginBottom: 6 }}>Could not load activity</div>
          <div style={{ color: 'var(--grey-400)', fontSize: '0.85rem', marginBottom: 16 }}>Check your connection and try again.</div>
          <button type="button" onClick={() => load(true)} style={{ padding: '9px 20px', background: '#00C4BC', color: '#0A1018', border: 'none', borderRadius: 10, fontWeight: 800, cursor: 'pointer', fontSize: '0.85rem' }}>
            Try Again
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div style={{ padding: '52px 24px', textAlign: 'center', borderRadius: 16, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, display: 'grid', placeItems: 'center', margin: '0 auto 16px', background: 'linear-gradient(135deg, rgba(0,196,188,0.12), rgba(0,196,188,0.04))', border: '1px solid rgba(0,196,188,0.2)' }}>
            <Activity size={28} strokeWidth={1.5} color="#00C4BC" style={{ opacity: 0.7 }} />
          </div>
          <h3 style={{ color: '#fff', margin: '0 0 8px', fontWeight: 800 }}>No activity found</h3>
          <p style={{ color: 'var(--grey-400)', fontSize: '0.86rem', maxWidth: 380, margin: '0 auto 20px', lineHeight: 1.55 }}>
            {hasFilters
              ? 'No results match your current filters. Try clearing them or widening the time window.'
              : days !== 'all'
                ? 'Nothing in this period yet. Try a wider window.'
                : 'As your business grows, everything will appear here in real time.'}
          </p>
          {hasFilters && (
            <button type="button" onClick={() => { setFilter('all'); setSearchQ(''); setMinAmt(''); setMaxAmt(''); }}
              style={{ padding: '9px 20px', background: 'rgba(0,196,188,0.1)', border: '1px solid rgba(0,196,188,0.3)', color: '#00C4BC', borderRadius: 10, fontWeight: 800, cursor: 'pointer', fontSize: '0.84rem', marginRight: 8 }}>
              Clear Filters
            </button>
          )}
          {days !== 'all' && (
            <button type="button" onClick={() => setDays('all')}
              style={{ padding: '9px 20px', background: 'rgba(0,196,188,0.1)', border: '1px solid rgba(0,196,188,0.3)', color: '#00C4BC', borderRadius: 10, fontWeight: 800, cursor: 'pointer', fontSize: '0.84rem' }}>
              Show All Time
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {groups.map((g, gi) => (
            <div key={g.label} style={{ animation: `pna-fadein 0.25s ease ${gi * 0.04}s both` }}>
              {/* Day header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ fontSize: '0.67rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--grey-500)', fontWeight: 800, whiteSpace: 'nowrap' }}>
                  {g.label}
                </div>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                <div style={{ fontSize: '0.63rem', color: 'var(--grey-500)', fontWeight: 700, background: 'rgba(255,255,255,0.05)', borderRadius: 999, padding: '2px 8px' }}>
                  {g.rows.length} event{g.rows.length !== 1 ? 's' : ''}
                </div>
              </div>

              {/* Row list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {g.rows.map((it, ri) => {
                  const meta = CAT_META[it.category] || CAT_META.wallet;
                  const Icon = meta.icon;
                  const clickable = !!it.href;
                  const isNew = !seenIds.has(it.id);
                  return (
                    <div
                      key={it.id}
                      role={clickable ? 'button' : undefined}
                      tabIndex={clickable ? 0 : undefined}
                      aria-label={`${it.title}${it.subtitle ? ': ' + it.subtitle : ''}`}
                      onClick={() => { if (it.href) { markSeen([it.id]); navigate(it.href); } }}
                      onKeyDown={e => {
                        if (clickable && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault(); markSeen([it.id]); navigate(it.href);
                        }
                      }}
                      className="pna-row"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 14px 10px 0',
                        borderRadius: 13,
                        background: isNew ? 'rgba(0,196,188,0.04)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${isNew ? 'rgba(0,196,188,0.15)' : 'rgba(255,255,255,0.07)'}`,
                        borderLeft: `3px solid ${meta.accent}`,
                        cursor: clickable ? 'pointer' : 'default',
                        animation: `pna-fadein 0.2s ease ${ri * 0.025}s both`,
                        position: 'relative',
                        overflow: 'visible',
                      }}
                    >
                      {/* Unread dot */}
                      {isNew && <div className="pna-unseen" style={{ position: 'absolute', left: -1, top: '50%' }} />}

                      {/* Category icon */}
                      <div style={{
                        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                        display: 'grid', placeItems: 'center',
                        background: `${meta.accent}14`, border: `1px solid ${meta.accent}28`,
                        color: meta.accent, marginLeft: 10,
                      }}>
                        <Icon size={16} strokeWidth={1.8} />
                      </div>

                      {/* Text */}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ color: isNew ? '#fff' : '#F0F4F8', fontWeight: isNew ? 800 : 700, fontSize: '0.875rem' }}>
                            {it.title}
                          </span>
                          <StatusBadge status={it.status} />
                        </div>
                        {it.subtitle && (
                          <div style={{ color: 'var(--grey-400)', fontSize: '0.75rem', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {it.subtitle}
                          </div>
                        )}
                      </div>

                      {/* Amount + time */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0, paddingRight: 4 }}>
                        <AmountPill amount={it.amount} emphasis={it.emphasis} />
                        <span style={{ color: 'var(--grey-500)', fontSize: '0.68rem', whiteSpace: 'nowrap', fontWeight: 600 }}>
                          {exactTime(it.timestamp)}
                        </span>
                      </div>

                      {it.primaryAction ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (it.primaryAction?.href) window.location.href = it.primaryAction.href;
                          }}
                          className="pna-btn"
                          style={{
                            marginLeft: 4,
                            padding: '6px 12px',
                            background: 'rgba(0,196,188,0.1)',
                            border: '1px solid rgba(0,196,188,0.3)',
                            color: '#00C4BC',
                            borderRadius: 8,
                            fontWeight: 800,
                            fontSize: '0.72rem',
                            cursor: 'pointer',
                            flexShrink: 0,
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {it.primaryAction.label}
                        </button>
                      ) : (
                        clickable && <ChevronRight size={14} style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0, marginRight: 4 }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* ── Load More ── */}
          {hasMore && !searchQ && !minAmt && !maxAmt && filter === 'all' && (
            <div style={{ textAlign: 'center', paddingBottom: 8 }}>
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="pna-btn"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 24px',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
                  color: '#E2E8F0', borderRadius: 10, fontSize: '0.82rem', fontWeight: 700,
                  cursor: loadingMore ? 'not-allowed' : 'pointer', opacity: loadingMore ? 0.7 : 1,
                }}
              >
                {loadingMore
                  ? <><RefreshCw size={13} style={{ animation: 'pna-spin 1s linear infinite' }} /> Loading…</>
                  : <><ChevronDown size={14} /> Load More</>}
              </button>
            </div>
          )}

          {/* Footer */}
          <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--grey-500)', fontSize: '0.73rem', fontWeight: 600, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            Showing {visible.length} event{visible.length !== 1 ? 's' : ''}
            {days !== 'all' ? ` · Last ${days} days` : ' · All time'}
            {filter !== 'all' ? ` · ${CAT_META[filter as Category]?.label || filter}` : ''}
            {searchQ ? ` · "${searchQ}"` : ''}
          </div>
        </div>
      )}
    </section>
  );
}
