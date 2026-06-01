'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, X, Copy, ExternalLink, Filter } from 'lucide-react';
import { toast } from 'sonner';

// fix-52: ships items #1-5, 9-15 from the global-search deep-dive.
// fix-52b: abort in-flight fetch on unmount, router.push for Enter-key nav.
// fix-52c: empty state is now blank — Tips + Recent Searches removed per
//          user direction. Pure command-palette: type to search, nothing
//          else on the page until results arrive.

type Scope = 'all' | 'users' | 'products' | 'orders' | 'storefronts' | 'coupons' | 'transactions';

const SCOPE_LABELS: Array<{ key: Scope; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'users', label: 'Users' },
  { key: 'storefronts', label: 'Storefronts' },
  { key: 'products', label: 'Products' },
  { key: 'orders', label: 'Orders' },
  { key: 'coupons', label: 'Coupons' },
  { key: 'transactions', label: 'Transactions' },
];

const ORDER_STATUSES = [
  'pending_customer_payment',
  'agent_approval_pending',
  'approved_ship',
  'approved_pickup',
  'in_fulfillment',
  'shipped',
  'delivered',
  'cancelled',
] as const;

const PAYMENT_METHODS = ['zelle', 'cashapp', 'venmo', 'apple_pay'] as const;

interface UserHit { id: string; full_name: string | null; username: string | null; email: string | null; role: string; is_super_agent?: boolean | null }
interface ProductHit { id: string; name: string; slug: string; sku: string | null; base_cost: number | null; is_active: boolean }
interface OrderHit { id: string; buyer_email: string | null; buyer_name: string | null; tracking_number: string | null; status: string; total: number | null; created_at: string; agent_id?: string | null; payment_method?: string | null; match_score?: number | null }
interface StorefrontHit { id: string; slug: string; display_name: string; is_active: boolean | null }
interface CouponHit { id: string; code: string; type: string; value: number | null; agent_id: string; uses_count: number; expires_at: string | null; is_active: boolean | null }
interface TransactionHit { id: string; agent_id: string; amount: number; type: string; description: string | null; created_at: string; order_id: string | null }

interface SearchResult {
  scope: Scope;
  users: UserHit[];
  products: ProductHit[];
  orders: OrderHit[];
  storefronts: StorefrontHit[];
  coupons: CouponHit[];
  transactions: TransactionHit[];
}

interface FlatItem {
  key: string;
  type: Scope;
  href: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  copyEmail?: string;
  copyTracking?: string;
  matchScore?: number | null;
  inactive?: boolean;
  avatarSeed?: string;
}

interface OrderFilters {
  status: string;
  payment: string;
  from: string;
  to: string;
  min: string;
  max: string;
}

const BLANK_FILTERS: OrderFilters = { status: '', payment: '', from: '', to: '', min: '', max: '' };

const INITIAL_GROUP_VISIBLE = 25;

function formatMoney(v: number | null | undefined): string {
  if (v == null) return '—';
  return `$${Number(v).toFixed(2)}`;
}

function roleLabel(u: UserHit): string {
  if (u.role === 'admin') return 'Admin';
  if (u.role === 'agent' && u.is_super_agent === true) return 'Super Agent';
  if (u.role === 'agent') return 'Agent';
  if (u.role === 'researcher') return 'Researcher';
  if (u.role === 'shipping') return 'Shipping';
  return u.role;
}

function prettyStatus(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function highlight(text: string | null | undefined, q: string): React.ReactNode {
  if (!text) return '';
  if (!q) return text;
  const lower = text.toLowerCase();
  const ql = q.toLowerCase();
  const idx = lower.indexOf(ql);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'rgba(0, 196, 188, 0.25)', color: 'inherit', padding: '0 2px', borderRadius: 2, fontWeight: 700 }}>
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

function hasAnyFilter(f: OrderFilters): boolean {
  return !!(f.status || f.payment || f.from || f.to || f.min || f.max);
}

function countActiveFilters(f: OrderFilters): number {
  return (f.status ? 1 : 0) + (f.payment ? 1 : 0) + (f.from ? 1 : 0) + (f.to ? 1 : 0) + (f.min ? 1 : 0) + (f.max ? 1 : 0);
}

function relevanceScore(title: string, subtitle: string, q: string): number {
  if (!q) return 0;
  const t = (title || '').toLowerCase();
  const s = (subtitle || '').toLowerCase();
  const ql = q.toLowerCase();
  let score = 0;
  if (t.includes(ql)) score += 3;
  if (t.startsWith(ql)) score += 2;
  if (t === ql) score += 5;
  if (s.includes(ql)) score += 1;
  return score;
}

function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const hue = Math.abs(h) % 360;
  return `hsl(${hue}, 55%, 38%)`;
}

function initialsFor(name: string | null | undefined, fallback: string): string {
  const src = (name || fallback || '').trim();
  if (!src) return '·';
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function datePresetRange(preset: 'last_7' | 'last_30' | 'this_month' | 'last_month'): { from: string; to: string } {
  const now = new Date();
  if (preset === 'last_7') {
    const from = new Date(now); from.setDate(from.getDate() - 6);
    return { from: isoDay(from), to: isoDay(now) };
  }
  if (preset === 'last_30') {
    const from = new Date(now); from.setDate(from.getDate() - 29);
    return { from: isoDay(from), to: isoDay(now) };
  }
  if (preset === 'this_month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: isoDay(from), to: isoDay(now) };
  }
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const to = new Date(now.getFullYear(), now.getMonth(), 0);
  return { from: isoDay(from), to: isoDay(to) };
}

export default function AdminSearchClient() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<Scope>('all');
  const [filters, setFilters] = useState<OrderFilters>(BLANK_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [focusedIdx, setFocusedIdx] = useState(0);
  const [expanded, setExpanded] = useState<Record<Scope, boolean>>({
    all: false, users: false, storefronts: false, products: false,
    orders: false, coupons: false, transactions: false,
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRefs = useRef<Map<string, HTMLAnchorElement | null>>(new Map());
  const inflightRef = useRef<AbortController | null>(null);
  const loggedEmptyRef = useRef<string>('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const p = new URLSearchParams(window.location.search);
    if (p.get('q')) setQuery(p.get('q') || '');
    const s = p.get('scope');
    if (s && SCOPE_LABELS.some((x) => x.key === s)) setScope(s as Scope);
    setFilters({
      status:  p.get('status')  || '',
      payment: p.get('payment') || '',
      from:    p.get('from')    || '',
      to:      p.get('to')      || '',
      min:     p.get('min')     || '',
      max:     p.get('max')     || '',
    });
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const p = new URLSearchParams();
    if (query.trim()) p.set('q', query.trim());
    if (scope !== 'all') p.set('scope', scope);
    if (filters.status)  p.set('status',  filters.status);
    if (filters.payment) p.set('payment', filters.payment);
    if (filters.from)    p.set('from',    filters.from);
    if (filters.to)      p.set('to',      filters.to);
    if (filters.min)     p.set('min',     filters.min);
    if (filters.max)     p.set('max',     filters.max);
    const qs = p.toString();
    const newUrl = window.location.pathname + (qs ? `?${qs}` : '');
    try { window.history.replaceState({}, '', newUrl); } catch {}
  }, [query, scope, filters]);

  useEffect(() => {
    if (scope === 'orders') setFiltersOpen(true);
  }, [scope]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    const filtersActive = hasAnyFilter(filters);
    if (q.length < 2 && !filtersActive) {
      setResults(null);
      setLoading(false);
      setErr(null);
      setFocusedIdx(0);
      inflightRef.current?.abort();
      inflightRef.current = null;
      return;
    }
    debounceRef.current = setTimeout(async () => {
      inflightRef.current?.abort();
      const ac = new AbortController();
      inflightRef.current = ac;

      setLoading(true);
      setErr(null);
      try {
        const sp = new URLSearchParams();
        if (q) sp.set('q', q);
        if (scope !== 'all') sp.set('scope', scope);
        if (filters.status)  sp.set('status',  filters.status);
        if (filters.payment) sp.set('payment', filters.payment);
        if (filters.from)    sp.set('from',    filters.from);
        if (filters.to)      sp.set('to',      filters.to);
        if (filters.min)     sp.set('min',     filters.min);
        if (filters.max)     sp.set('max',     filters.max);
        const res = await fetch('/api/admin/global-search?' + sp.toString(), {
          method: 'GET',
          cache: 'no-store',
          signal: ac.signal,
        });
        if (ac.signal.aborted) return;
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setErr(j.error || 'Search Failed');
          setResults(null);
          return;
        }
        const json = (await res.json()) as SearchResult;
        if (ac.signal.aborted) return;
        setResults(json);
        setFocusedIdx(0);
        setExpanded({
          all: false, users: false, storefronts: false, products: false,
          orders: false, coupons: false, transactions: false,
        });
      } catch (e: any) {
        if (e && e.name === 'AbortError') return;
        setErr('Network Error');
        setResults(null);
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    }, 220);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      inflightRef.current?.abort();
    };
  }, [query, scope, filters]);

  const grouped = useMemo(() => {
    if (!results) return null;
    const q = query.trim();

    const userItems: FlatItem[] = results.users.map((u) => {
      const title = u.full_name || u.username || u.email || u.id;
      const subtitle = `${roleLabel(u)}${u.username ? ' · @' + u.username : ''}${u.email ? ' · ' + u.email : ''}`;
      return {
        key: 'u:' + u.id,
        type: 'users',
        href: u.role === 'researcher' ? '/admin/researchers' : '/admin/agents',
        title, subtitle,
        ctaLabel: 'Open',
        copyEmail: u.email ?? undefined,
        matchScore: relevanceScore(title, subtitle, q),
        avatarSeed: u.id,
      };
    });

    const storefrontItems: FlatItem[] = results.storefronts.map((s) => {
      const title = s.display_name;
      const subtitle = '/' + s.slug;
      return {
        key: 's:' + s.id,
        type: 'storefronts',
        href: `/${s.slug}`,
        title, subtitle,
        ctaLabel: 'Preview',
        matchScore: relevanceScore(title, subtitle, q),
        inactive: s.is_active === false,
      };
    });

    const productItems: FlatItem[] = results.products.map((p) => {
      const title = p.name;
      const subtitle = `${p.slug}${p.sku ? ' · SKU ' + p.sku : ''}${p.base_cost != null ? ' · Base ' + formatMoney(p.base_cost) : ''}`;
      return {
        key: 'p:' + p.id,
        type: 'products',
        href: `/admin/products/${p.id}`,
        title, subtitle,
        ctaLabel: 'Edit',
        matchScore: relevanceScore(title, subtitle, q),
        inactive: !p.is_active,
      };
    });

    const orderItems: FlatItem[] = results.orders.map((o) => {
      const title = o.buyer_name || o.buyer_email || `Order ${o.id.slice(0, 8)}`;
      const subtitle = `${prettyStatus(o.status)} · ${formatMoney(o.total)}${o.tracking_number ? ' · Tracking ' + o.tracking_number : ''}${o.payment_method ? ' · ' + o.payment_method : ''} · ${new Date(o.created_at).toLocaleDateString()}`;
      return {
        key: 'o:' + o.id,
        type: 'orders',
        href: `/admin/orders?status=${encodeURIComponent(o.status)}`,
        title, subtitle,
        ctaLabel: 'Open',
        copyTracking: o.tracking_number ?? undefined,
        matchScore: o.match_score != null ? o.match_score * 10 : relevanceScore(title, subtitle, q),
      };
    });

    const couponItems: FlatItem[] = results.coupons.map((c) => {
      const title = c.code;
      const subtitle = `${c.type === 'percent' ? `${c.value}% off` : c.type === 'fixed' ? `${formatMoney(c.value)} off` : c.type} · Used ${c.uses_count}×${c.expires_at ? ' · Expires ' + new Date(c.expires_at).toLocaleDateString() : ''}`;
      return {
        key: 'c:' + c.id,
        type: 'coupons',
        href: '/admin/coupons',
        title, subtitle,
        ctaLabel: 'Manage',
        matchScore: relevanceScore(title, subtitle, q),
        inactive: c.is_active === false,
      };
    });

    const transactionItems: FlatItem[] = results.transactions.map((t) => {
      const title = t.description || `Transaction ${t.id.slice(0, 8)}`;
      const subtitle = `${t.type} · ${formatMoney(t.amount)} · ${new Date(t.created_at).toLocaleDateString()}${t.order_id ? ' · Order ' + t.order_id.slice(0, 8) : ''}`;
      return {
        key: 't:' + t.id,
        type: 'transactions',
        href: t.agent_id ? `/admin/transactions?agent=${encodeURIComponent(t.agent_id)}` : '/admin/transactions',
        title, subtitle,
        ctaLabel: 'Open',
        matchScore: relevanceScore(title, subtitle, q),
      };
    });

    const byScoreDesc = (a: FlatItem, b: FlatItem) => (b.matchScore ?? 0) - (a.matchScore ?? 0);
    userItems.sort(byScoreDesc);
    storefrontItems.sort(byScoreDesc);
    productItems.sort(byScoreDesc);
    orderItems.sort(byScoreDesc);
    couponItems.sort(byScoreDesc);
    transactionItems.sort(byScoreDesc);

    return {
      users: userItems,
      storefronts: storefrontItems,
      products: productItems,
      orders: orderItems,
      coupons: couponItems,
      transactions: transactionItems,
    };
  }, [results, query]);

  const flatList: FlatItem[] = useMemo(() => {
    if (!grouped) return [];
    const slice = (arr: FlatItem[], type: Scope) =>
      expanded[type] ? arr : arr.slice(0, INITIAL_GROUP_VISIBLE);
    return [
      ...slice(grouped.users, 'users'),
      ...slice(grouped.storefronts, 'storefronts'),
      ...slice(grouped.products, 'products'),
      ...slice(grouped.orders, 'orders'),
      ...slice(grouped.coupons, 'coupons'),
      ...slice(grouped.transactions, 'transactions'),
    ];
  }, [grouped, expanded]);

  const totalHits = useMemo(() => {
    if (!grouped) return 0;
    return grouped.users.length + grouped.storefronts.length + grouped.products.length +
           grouped.orders.length + grouped.coupons.length + grouped.transactions.length;
  }, [grouped]);

  useEffect(() => {
    if (!results) return;
    const q = query.trim();
    if (q.length < 2) return;
    if (totalHits !== 0) return;
    const sig = `${scope}::${q}::${JSON.stringify(filters)}`;
    if (loggedEmptyRef.current === sig) return;
    loggedEmptyRef.current = sig;
    try {
      fetch('/api/admin/search-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, scope, filters }),
        keepalive: true,
      }).catch(() => {});
    } catch {}
  }, [results, totalHits, query, scope, filters]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (flatList.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIdx((i) => Math.min(i + 1, flatList.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        const item = flatList[focusedIdx];
        if (item) {
          e.preventDefault();
          router.push(item.href);
        }
      } else if (e.key === 'Escape') {
        if (query) {
          e.preventDefault();
          setQuery('');
          inputRef.current?.focus();
        } else {
          inputRef.current?.blur();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flatList, focusedIdx, query, router]);

  useEffect(() => {
    const item = flatList[focusedIdx];
    if (!item) return;
    const el = resultRefs.current.get(item.key);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [focusedIdx, flatList]);

  const counts = useMemo(() => {
    if (!grouped) return null;
    return {
      users: grouped.users.length,
      storefronts: grouped.storefronts.length,
      products: grouped.products.length,
      orders: grouped.orders.length,
      coupons: grouped.coupons.length,
      transactions: grouped.transactions.length,
    };
  }, [grouped]);

  const clearFilters = () => setFilters(BLANK_FILTERS);

  const applyPreset = useCallback((preset: 'last_7' | 'last_30' | 'this_month' | 'last_month') => {
    const range = datePresetRange(preset);
    setFilters((f) => ({ ...f, from: range.from, to: range.to }));
  }, []);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} Copied`);
    } catch {
      toast.error('Copy Failed');
    }
  };

  const q = query.trim();
  const filtersActive = hasAnyFilter(filters);
  const activeFilterCount = countActiveFilters(filters);
  const showNoResults = !!results && totalHits === 0 && !loading && (q.length >= 2 || filtersActive);

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ position: 'sticky', top: 0, background: 'var(--black, #050A0F)', paddingBottom: 12, zIndex: 10, marginBottom: 16 }}>
        <h1 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.6rem)', fontWeight: 700, marginBottom: 12 }}>Global Search</h1>

        <label
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'var(--surface-1, #0F1923)',
            border: '1px solid var(--surface-3, #1D2D3E)',
            borderRadius: 12, padding: '12px 16px', marginBottom: 12,
          }}
        >
          <Search size={18} aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Anything (Fuzzy Match · Min 2 Chars)"
            aria-label="Search"
            style={{
              flex: 1, background: 'transparent', border: 0, outline: 'none',
              color: 'var(--white, #FFFFFF)', fontSize: '1rem',
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); inputRef.current?.focus(); }}
              aria-label="Clear Search"
              style={{ background: 'transparent', border: 0, color: 'var(--grey-400, #A8B4C0)', cursor: 'pointer', padding: 4 }}
            >
              <X size={18} />
            </button>
          )}
        </label>

        <div role="toolbar" aria-label="Search Scope" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch', alignItems: 'center' }}>
          {SCOPE_LABELS.map((s) => {
            const count = s.key === 'all' ? totalHits : (counts ? (counts as Record<string, number>)[s.key] : 0);
            const active = scope === s.key;
            return (
              <button
                key={s.key}
                type="button"
                aria-pressed={active}
                onClick={() => setScope(s.key)}
                style={{
                  flexShrink: 0,
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: '1px solid ' + (active ? 'var(--teal, #00C4BC)' : 'var(--surface-3, #1D2D3E)'),
                  background: active ? 'var(--teal, #00C4BC)' : 'var(--surface-1, #0F1923)',
                  color: active ? '#000' : 'var(--white, #FFFFFF)',
                  fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                {s.label}
                {(results && (q.length >= 2 || filtersActive)) && (
                  <span style={{ marginLeft: 6, opacity: active ? 0.8 : 0.6, fontWeight: 500 }}>{count}</span>
                )}
              </button>
            );
          })}

          <span aria-hidden="true" style={{ flexShrink: 0, width: 1, height: 20, background: 'var(--surface-3, #1D2D3E)', margin: '0 4px' }} />

          <button
            type="button"
            aria-pressed={filtersOpen}
            aria-controls="order-filters-panel"
            onClick={() => setFiltersOpen((v) => !v)}
            style={{
              flexShrink: 0,
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: filtersActive ? 'rgba(0,196,188,0.18)' : 'var(--surface-1, #0F1923)',
              border: '1px solid ' + (filtersActive ? 'var(--teal, #00C4BC)' : 'var(--surface-3, #1D2D3E)'),
              borderRadius: 999, padding: '6px 12px',
              color: filtersActive ? 'var(--teal, #00C4BC)' : 'var(--white, #FFFFFF)',
              fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            <Filter size={14} aria-hidden="true" />
            Order Filters
            {activeFilterCount > 0 && (
              <span
                aria-label={`${activeFilterCount} active`}
                style={{
                  marginLeft: 2, padding: '0 6px', minWidth: 18, height: 18,
                  borderRadius: 999, background: 'var(--teal, #00C4BC)', color: '#000',
                  fontSize: '0.66rem', fontWeight: 800,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {activeFilterCount}
              </span>
            )}
          </button>

          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              style={{ flexShrink: 0, background: 'transparent', border: 0, color: 'var(--grey-400, #A8B4C0)', fontSize: '0.78rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              Clear Filters
            </button>
          )}
        </div>

        {filtersOpen && (
          <div
            id="order-filters-panel"
            role="region"
            aria-label="Order Filters"
            style={{
              background: 'var(--surface-2, #162230)',
              border: '1px solid var(--surface-3, #1D2D3E)',
              borderRadius: 12, padding: 14, marginTop: 10,
            }}
          >
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--grey-400, #A8B4C0)', fontWeight: 700, alignSelf: 'center' }}>Quick Range:</span>
              <PresetBtn label="Last 7 Days"  onClick={() => applyPreset('last_7')}  />
              <PresetBtn label="Last 30 Days" onClick={() => applyPreset('last_30')} />
              <PresetBtn label="This Month"   onClick={() => applyPreset('this_month')} />
              <PresetBtn label="Last Month"   onClick={() => applyPreset('last_month')} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <Field label="Status">
                <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} style={selectStyle}>
                  <option value="">Any</option>
                  {ORDER_STATUSES.map((s) => (
                    <option key={s} value={s}>{prettyStatus(s)}</option>
                  ))}
                </select>
              </Field>
              <Field label="Payment Method">
                <select value={filters.payment} onChange={(e) => setFilters({ ...filters, payment: e.target.value })} style={selectStyle}>
                  <option value="">Any</option>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>{prettyStatus(m)}</option>
                  ))}
                </select>
              </Field>
              <Field label="Date From">
                <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} style={inputStyle} />
              </Field>
              <Field label="Date To">
                <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} style={inputStyle} />
              </Field>
              <Field label="Min Total">
                <input type="number" inputMode="decimal" placeholder="0" value={filters.min} onChange={(e) => setFilters({ ...filters, min: e.target.value })} style={inputStyle} />
              </Field>
              <Field label="Max Total">
                <input type="number" inputMode="decimal" placeholder="0" value={filters.max} onChange={(e) => setFilters({ ...filters, max: e.target.value })} style={inputStyle} />
              </Field>
            </div>
          </div>
        )}
      </div>

      {loading && <div style={{ color: 'var(--grey-400, #A8B4C0)', padding: 16 }}>Searching…</div>}
      {err && (
        <div style={{ color: '#FFFFFF', background: 'rgba(229,62,62,0.12)', border: '1px solid rgba(229,62,62,0.4)', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
          {err}
        </div>
      )}

      <div aria-live="polite" style={{ position: 'absolute', left: -9999, width: 1, height: 1, overflow: 'hidden' }}>
        {results && (q.length >= 2 || filtersActive) ? `${totalHits} result${totalHits === 1 ? '' : 's'} for ${q || 'current filters'}` : ''}
      </div>

      {showNoResults && (
        <div style={{ color: 'var(--grey-400, #A8B4C0)', background: 'var(--surface-2, #162230)', border: '1px solid var(--surface-3, #1D2D3E)', borderRadius: 12, padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--white, #FFFFFF)', marginBottom: 4 }}>
            No Results{q.length >= 2 ? ` For “${q}”` : ''}{filtersActive ? ' With Those Filters' : ''}
          </div>
          <div style={{ fontSize: '0.85rem' }}>
            Try Loosening The Filters Or A Shorter / Different Query. Fuzzy Match Tolerates Some Typos But Not Wholly Different Words.
          </div>
        </div>
      )}

      {grouped && totalHits > 0 && (
        <>
          {grouped.users.length > 0 && (
            <ResultGroup
              title="Users" count={grouped.users.length}
              expanded={expanded.users}
              onToggleExpanded={() => setExpanded((e) => ({ ...e, users: !e.users }))}
            >
              {(expanded.users ? grouped.users : grouped.users.slice(0, INITIAL_GROUP_VISIBLE)).map((item) => {
                const focused = flatList[focusedIdx]?.key === item.key;
                return (
                  <ResultRow
                    key={item.key} refStore={resultRefs} focused={focused} query={q} item={item}
                    onCopyEmail={item.copyEmail ? () => copyToClipboard(item.copyEmail!, 'Email') : undefined}
                  />
                );
              })}
            </ResultGroup>
          )}

          {grouped.storefronts.length > 0 && (
            <ResultGroup
              title="Storefronts" count={grouped.storefronts.length}
              expanded={expanded.storefronts}
              onToggleExpanded={() => setExpanded((e) => ({ ...e, storefronts: !e.storefronts }))}
            >
              {(expanded.storefronts ? grouped.storefronts : grouped.storefronts.slice(0, INITIAL_GROUP_VISIBLE)).map((item) => {
                const focused = flatList[focusedIdx]?.key === item.key;
                return <ResultRow key={item.key} refStore={resultRefs} focused={focused} query={q} item={item} />;
              })}
            </ResultGroup>
          )}

          {grouped.products.length > 0 && (
            <ResultGroup
              title="Products" count={grouped.products.length}
              expanded={expanded.products}
              onToggleExpanded={() => setExpanded((e) => ({ ...e, products: !e.products }))}
            >
              {(expanded.products ? grouped.products : grouped.products.slice(0, INITIAL_GROUP_VISIBLE)).map((item) => {
                const focused = flatList[focusedIdx]?.key === item.key;
                return <ResultRow key={item.key} refStore={resultRefs} focused={focused} query={q} item={item} />;
              })}
            </ResultGroup>
          )}

          {grouped.orders.length > 0 && (
            <ResultGroup
              title="Orders" count={grouped.orders.length}
              expanded={expanded.orders}
              onToggleExpanded={() => setExpanded((e) => ({ ...e, orders: !e.orders }))}
            >
              {(expanded.orders ? grouped.orders : grouped.orders.slice(0, INITIAL_GROUP_VISIBLE)).map((item) => {
                const focused = flatList[focusedIdx]?.key === item.key;
                return (
                  <ResultRow
                    key={item.key} refStore={resultRefs} focused={focused} query={q} item={item}
                    onCopyTracking={item.copyTracking ? () => copyToClipboard(item.copyTracking!, 'Tracking #') : undefined}
                  />
                );
              })}
            </ResultGroup>
          )}

          {grouped.coupons.length > 0 && (
            <ResultGroup
              title="Coupons" count={grouped.coupons.length}
              expanded={expanded.coupons}
              onToggleExpanded={() => setExpanded((e) => ({ ...e, coupons: !e.coupons }))}
            >
              {(expanded.coupons ? grouped.coupons : grouped.coupons.slice(0, INITIAL_GROUP_VISIBLE)).map((item) => {
                const focused = flatList[focusedIdx]?.key === item.key;
                return <ResultRow key={item.key} refStore={resultRefs} focused={focused} query={q} item={item} />;
              })}
            </ResultGroup>
          )}

          {grouped.transactions.length > 0 && (
            <ResultGroup
              title="Transactions" count={grouped.transactions.length}
              expanded={expanded.transactions}
              onToggleExpanded={() => setExpanded((e) => ({ ...e, transactions: !e.transactions }))}
            >
              {(expanded.transactions ? grouped.transactions : grouped.transactions.slice(0, INITIAL_GROUP_VISIBLE)).map((item) => {
                const focused = flatList[focusedIdx]?.key === item.key;
                return <ResultRow key={item.key} refStore={resultRefs} focused={focused} query={q} item={item} />;
              })}
            </ResultGroup>
          )}
        </>
      )}
    </div>
  );
}

function PresetBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '4px 10px',
        background: 'var(--surface-1, #0F1923)',
        border: '1px solid var(--surface-3, #1D2D3E)',
        borderRadius: 999, color: 'var(--white, #FFFFFF)',
        fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--grey-400, #A8B4C0)', fontWeight: 700 }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surface-1, #0F1923)',
  border: '1px solid var(--surface-3, #1D2D3E)',
  borderRadius: 8,
  padding: '6px 10px',
  color: 'var(--white, #FFFFFF)',
  fontSize: '0.88rem',
  outline: 'none',
};

const selectStyle: React.CSSProperties = { ...inputStyle, paddingRight: 24 };

function ResultGroup({
  title, count, expanded, onToggleExpanded, children,
}: {
  title: string;
  count: number;
  expanded: boolean;
  onToggleExpanded: () => void;
  children: React.ReactNode;
}) {
  const showToggle = count > INITIAL_GROUP_VISIBLE;
  return (
    <section style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8, padding: '0 4px' }}>
        <h2 style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--grey-400, #A8B4C0)', margin: 0, fontWeight: 700 }}>{title}</h2>
        <span style={{ fontSize: '0.78rem', color: 'var(--grey-500)' }}>({count})</span>
      </div>
      <div style={{ background: 'var(--surface-2, #162230)', border: '1px solid var(--surface-3, #1D2D3E)', borderRadius: 12, overflow: 'hidden' }}>
        {children}
        {showToggle && (
          <button
            type="button"
            onClick={onToggleExpanded}
            style={{
              width: '100%', padding: '10px 16px',
              background: 'transparent', border: 0, borderTop: '1px solid var(--surface-3, #1D2D3E)',
              color: 'var(--teal, #00C4BC)', cursor: 'pointer',
              fontSize: '0.82rem', fontWeight: 600,
            }}
          >
            {expanded ? `Show Less` : `Show All ${count}`}
          </button>
        )}
      </div>
    </section>
  );
}

function ResultRow({
  item, focused, query, refStore, onCopyEmail, onCopyTracking,
}: {
  item: FlatItem;
  focused: boolean;
  query: string;
  refStore: React.MutableRefObject<Map<string, HTMLAnchorElement | null>>;
  onCopyEmail?: () => void;
  onCopyTracking?: () => void;
}) {
  const showScore = item.type === 'orders' && item.matchScore != null && item.matchScore >= 4;
  return (
    <Link
      ref={(el) => { if (el) refStore.current.set(item.key, el); else refStore.current.delete(item.key); }}
      href={item.href}
      aria-current={focused ? 'true' : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
        borderBottom: '1px solid var(--surface-3, #1D2D3E)',
        textDecoration: 'none', color: 'inherit', cursor: 'pointer',
        background: focused ? 'rgba(0, 196, 188, 0.07)' : 'transparent',
        outline: focused ? '1px solid rgba(0, 196, 188, 0.45)' : 'none',
        outlineOffset: focused ? -1 : 0,
      }}
    >
      {item.type === 'users' && item.avatarSeed && (
        <div
          aria-hidden="true"
          style={{
            flexShrink: 0, width: 32, height: 32, borderRadius: '50%',
            background: avatarColor(item.avatarSeed),
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: '#FFFFFF', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.02em',
          }}
        >
          {initialsFor(item.title, item.avatarSeed)}
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--white, #FFFFFF)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {highlight(item.title, query)}
          </span>
          {item.inactive && (
            <span
              style={{
                fontSize: '0.62rem', padding: '1px 6px', borderRadius: 999,
                background: 'rgba(168,180,192,0.18)', color: 'var(--grey-300, #D0DAE4)',
                fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', flexShrink: 0,
              }}
            >
              Inactive
            </span>
          )}
          {showScore && (
            <span style={{ fontSize: '0.62rem', padding: '1px 6px', borderRadius: 999, background: 'rgba(0,196,188,0.15)', color: 'var(--teal, #00C4BC)', fontWeight: 700, letterSpacing: '0.05em', flexShrink: 0 }}>
              {Math.round((item.matchScore as number) * 10)}% match
            </span>
          )}
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--grey-400, #A8B4C0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {highlight(item.subtitle, query)}
        </div>
      </div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        {onCopyEmail && (
          <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCopyEmail(); }} aria-label="Copy Email" title="Copy Email" style={iconBtn}>
            <Copy size={14} />
          </button>
        )}
        {onCopyTracking && (
          <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCopyTracking(); }} aria-label="Copy Tracking" title="Copy Tracking" style={iconBtn}>
            <Copy size={14} />
          </button>
        )}
        <span style={{ fontSize: '0.82rem', color: 'var(--teal, #00C4BC)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {item.ctaLabel}
          <ExternalLink size={12} />
        </span>
      </div>
    </Link>
  );
}

const iconBtn: React.CSSProperties = {
  background: 'var(--surface-1, #0F1923)',
  border: '1px solid var(--surface-3, #1D2D3E)',
  color: 'var(--grey-300, #D0DAE4)',
  width: 28,
  height: 28,
  borderRadius: 8,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
};
