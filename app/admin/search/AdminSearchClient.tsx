'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, X, Clock, Copy, ExternalLink, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

// fix-48: rebuilt /admin/search as a command-palette-style page.
//
//   - Keyboard nav (↑/↓/Enter/Esc), URL state, recent searches,
//     scope chips, match highlighting, per-result quick actions.
//   - Includes coupons + transactions as new entity types.
//   - Empty state shows recent searches + searchable-entities tips.

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

interface UserHit { id: string; full_name: string | null; username: string | null; email: string | null; role: string; is_super_agent?: boolean | null }
interface ProductHit { id: string; name: string; slug: string; sku: string | null; base_cost: number | null; is_active: boolean }
interface OrderHit { id: string; buyer_email: string | null; buyer_name: string | null; tracking_number: string | null; status: string; total: number | null; created_at: string; agent_id?: string | null }
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
}

const RECENT_KEY = 'pnl-admin-search-recent';
const MAX_RECENT = 8;

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
      <mark
        style={{
          background: 'rgba(0, 196, 188, 0.25)',
          color: 'inherit',
          padding: '0 2px',
          borderRadius: 2,
          fontWeight: 700,
        }}
      >
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

export default function AdminSearchClient() {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<Scope>('all');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [focusedIdx, setFocusedIdx] = useState(0);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRefs = useRef<Map<string, HTMLAnchorElement | null>>(new Map());

  // ─ Initial URL state read ─
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const p = new URLSearchParams(window.location.search);
    const qParam = p.get('q') || '';
    const sParam = p.get('scope');
    if (qParam) setQuery(qParam);
    if (sParam && SCOPE_LABELS.some((s) => s.key === sParam)) {
      setScope(sParam as Scope);
    }
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (raw) setRecent(JSON.parse(raw));
    } catch {}
    inputRef.current?.focus();
  }, []);

  // ─ Sync URL state ← local state ─
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const p = new URLSearchParams();
    if (query.trim()) p.set('q', query.trim());
    if (scope !== 'all') p.set('scope', scope);
    const qs = p.toString();
    const newUrl = window.location.pathname + (qs ? `?${qs}` : '');
    try { window.history.replaceState({}, '', newUrl); } catch {}
  }, [query, scope]);

  // ─ Run search (debounced) ─
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      setLoading(false);
      setErr(null);
      setFocusedIdx(0);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setErr(null);
      try {
        const sp = new URLSearchParams({ q });
        if (scope !== 'all') sp.set('scope', scope);
        const res = await fetch('/api/admin/global-search?' + sp.toString(), { method: 'GET', cache: 'no-store' });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setErr(j.error || 'Search Failed');
          setResults(null);
          return;
        }
        const json = (await res.json()) as SearchResult;
        setResults(json);
        setFocusedIdx(0);
      } catch {
        setErr('Network Error');
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, scope]);

  // ─ Flat result list for keyboard nav ─
  const flatList: FlatItem[] = useMemo(() => {
    if (!results) return [];
    const out: FlatItem[] = [];
    for (const u of results.users) {
      out.push({
        key: 'u:' + u.id,
        type: 'users',
        href: u.role === 'researcher' ? '/admin/researchers' : '/admin/agents',
        title: u.full_name || u.username || u.email || u.id,
        subtitle: `${roleLabel(u)}${u.username ? ' · @' + u.username : ''}${u.email ? ' · ' + u.email : ''}`,
        ctaLabel: 'Open',
        copyEmail: u.email ?? undefined,
      });
    }
    for (const s of results.storefronts) {
      out.push({
        key: 's:' + s.id,
        type: 'storefronts',
        href: `/${s.slug}`,
        title: s.display_name,
        subtitle: '/' + s.slug + (s.is_active === false ? ' · Inactive' : ''),
        ctaLabel: 'Preview',
      });
    }
    for (const p of results.products) {
      out.push({
        key: 'p:' + p.id,
        type: 'products',
        href: `/admin/products/${p.id}`,
        title: p.name,
        subtitle: `${p.slug}${p.sku ? ' · SKU ' + p.sku : ''}${p.base_cost != null ? ' · Base ' + formatMoney(p.base_cost) : ''}${!p.is_active ? ' · Inactive' : ''}`,
        ctaLabel: 'Edit',
      });
    }
    for (const o of results.orders) {
      out.push({
        key: 'o:' + o.id,
        type: 'orders',
        href: '/admin/orders',
        title: o.buyer_name || o.buyer_email || `Order ${o.id.slice(0, 8)}`,
        subtitle: `Status ${o.status} · ${formatMoney(o.total)}${o.tracking_number ? ' · Tracking ' + o.tracking_number : ''} · ${new Date(o.created_at).toLocaleDateString()}`,
        ctaLabel: 'Open',
        copyTracking: o.tracking_number ?? undefined,
      });
    }
    for (const c of results.coupons) {
      out.push({
        key: 'c:' + c.id,
        type: 'coupons',
        href: '/admin/coupons',
        title: c.code,
        subtitle: `${c.type === 'percent' ? `${c.value}% off` : c.type === 'fixed' ? `${formatMoney(c.value)} off` : c.type} · Used ${c.uses_count}×${c.expires_at ? ' · Expires ' + new Date(c.expires_at).toLocaleDateString() : ''}${c.is_active === false ? ' · Inactive' : ''}`,
        ctaLabel: 'Manage',
      });
    }
    for (const t of results.transactions) {
      out.push({
        key: 't:' + t.id,
        type: 'transactions',
        href: '/admin/transactions',
        title: t.description || `Transaction ${t.id.slice(0, 8)}`,
        subtitle: `${t.type} · ${formatMoney(t.amount)} · ${new Date(t.created_at).toLocaleDateString()}${t.order_id ? ' · Order ' + t.order_id.slice(0, 8) : ''}`,
        ctaLabel: 'Open',
      });
    }
    return out;
  }, [results]);

  const totalHits = flatList.length;

  // ─ Persist recent search when a query yields hits ─
  useEffect(() => {
    if (!results || query.trim().length < 2 || totalHits === 0) return;
    const q = query.trim();
    setRecent((prev) => {
      const next = [q, ...prev.filter((r) => r !== q)].slice(0, MAX_RECENT);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [results, query, totalHits]);

  // ─ Keyboard navigation ─
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
          window.location.href = item.href;
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
  }, [flatList, focusedIdx, query]);

  // ─ Auto-scroll focused row into view ─
  useEffect(() => {
    const item = flatList[focusedIdx];
    if (!item) return;
    const el = resultRefs.current.get(item.key);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [focusedIdx, flatList]);

  const counts = useMemo(() => {
    if (!results) return null;
    return {
      users: results.users.length,
      storefronts: results.storefronts.length,
      products: results.products.length,
      orders: results.orders.length,
      coupons: results.coupons.length,
      transactions: results.transactions.length,
    };
  }, [results]);

  const clearRecent = () => {
    setRecent([]);
    try { localStorage.removeItem(RECENT_KEY); } catch {}
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} Copied`);
    } catch {
      toast.error('Copy Failed');
    }
  };

  const q = query.trim();
  const showEmptyState = q.length < 2 && !loading;
  const showNoResults = !!results && totalHits === 0 && !loading && q.length >= 2;

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      {/* sticky header */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          background: 'var(--black, #050A0F)',
          paddingBottom: 12,
          zIndex: 10,
          marginBottom: 16,
        }}
      >
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: 12 }}>Global Search</h1>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'var(--surface-1, #0F1923)',
            border: '1px solid var(--surface-3, #1D2D3E)',
            borderRadius: 12,
            padding: '12px 16px',
            marginBottom: 12,
          }}
        >
          <Search size={18} aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Users, Products, Orders, Storefronts, Coupons, Transactions (Min 2 Characters)"
            aria-label="Search"
            style={{
              flex: 1,
              background: 'transparent',
              border: 0,
              outline: 'none',
              color: 'var(--white, #FFFFFF)',
              fontSize: '1rem',
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

        {/* Scope chips */}
        <div
          role="tablist"
          aria-label="Search Scope"
          style={{
            display: 'flex',
            gap: 6,
            overflowX: 'auto',
            paddingBottom: 4,
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {SCOPE_LABELS.map((s) => {
            const count = s.key === 'all'
              ? totalHits
              : (counts ? (counts as Record<string, number>)[s.key] : 0);
            const active = scope === s.key;
            return (
              <button
                key={s.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setScope(s.key)}
                style={{
                  flexShrink: 0,
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: '1px solid ' + (active ? 'var(--teal, #00C4BC)' : 'var(--surface-3, #1D2D3E)'),
                  background: active ? 'var(--teal, #00C4BC)' : 'var(--surface-1, #0F1923)',
                  color: active ? '#000' : 'var(--white, #FFFFFF)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {s.label}
                {results && q.length >= 2 && (
                  <span style={{ marginLeft: 6, opacity: active ? 0.8 : 0.6, fontWeight: 500 }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {loading && <div style={{ color: 'var(--grey-400, #A8B4C0)', padding: 16 }}>Searching…</div>}
      {err && (
        <div
          style={{
            color: '#FFFFFF',
            background: 'rgba(229,62,62,0.12)',
            border: '1px solid rgba(229,62,62,0.4)',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 16,
          }}
        >
          {err}
        </div>
      )}

      {/* live region for screen readers */}
      <div
        aria-live="polite"
        style={{ position: 'absolute', left: -9999, width: 1, height: 1, overflow: 'hidden' }}
      >
        {results && q.length >= 2 ? `${totalHits} result${totalHits === 1 ? '' : 's'} for ${q}` : ''}
      </div>

      {showEmptyState && (
        <EmptyState
          recent={recent}
          onPickRecent={(r) => setQuery(r)}
          onClearRecent={clearRecent}
        />
      )}

      {showNoResults && (
        <div
          style={{
            color: 'var(--grey-400, #A8B4C0)',
            background: 'var(--surface-2, #162230)',
            border: '1px solid var(--surface-3, #1D2D3E)',
            borderRadius: 12,
            padding: 24,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--white, #FFFFFF)', marginBottom: 4 }}>
            No Results For “{q}”
          </div>
          <div style={{ fontSize: '0.85rem' }}>
            Try A Different Spelling, A Partial Email, A SKU, Or A Tracking Number.
          </div>
        </div>
      )}

      {results && totalHits > 0 && (
        <>
          {results.users.length > 0 && (
            <ResultGroup title="Users" count={results.users.length}>
              {results.users.map((u) => {
                const key = 'u:' + u.id;
                const focused = flatList[focusedIdx]?.key === key;
                return (
                  <ResultRow
                    key={key}
                    refStore={resultRefs}
                    item={{
                      key,
                      type: 'users',
                      href: u.role === 'researcher' ? '/admin/researchers' : '/admin/agents',
                      title: u.full_name || u.username || u.email || u.id,
                      subtitle: `${roleLabel(u)}${u.username ? ' · @' + u.username : ''}${u.email ? ' · ' + u.email : ''}`,
                      ctaLabel: 'Open',
                      copyEmail: u.email ?? undefined,
                    }}
                    focused={focused}
                    query={q}
                    onCopyEmail={u.email ? () => copyToClipboard(u.email!, 'Email') : undefined}
                  />
                );
              })}
            </ResultGroup>
          )}

          {results.storefronts.length > 0 && (
            <ResultGroup title="Storefronts" count={results.storefronts.length}>
              {results.storefronts.map((s) => {
                const key = 's:' + s.id;
                const focused = flatList[focusedIdx]?.key === key;
                return (
                  <ResultRow
                    key={key}
                    refStore={resultRefs}
                    item={{
                      key,
                      type: 'storefronts',
                      href: `/${s.slug}`,
                      title: s.display_name,
                      subtitle: '/' + s.slug + (s.is_active === false ? ' · Inactive' : ''),
                      ctaLabel: 'Preview',
                    }}
                    focused={focused}
                    query={q}
                  />
                );
              })}
            </ResultGroup>
          )}

          {results.products.length > 0 && (
            <ResultGroup title="Products" count={results.products.length}>
              {results.products.map((p) => {
                const key = 'p:' + p.id;
                const focused = flatList[focusedIdx]?.key === key;
                return (
                  <ResultRow
                    key={key}
                    refStore={resultRefs}
                    item={{
                      key,
                      type: 'products',
                      href: `/admin/products/${p.id}`,
                      title: p.name,
                      subtitle: `${p.slug}${p.sku ? ' · SKU ' + p.sku : ''}${p.base_cost != null ? ' · Base ' + formatMoney(p.base_cost) : ''}${!p.is_active ? ' · Inactive' : ''}`,
                      ctaLabel: 'Edit',
                    }}
                    focused={focused}
                    query={q}
                  />
                );
              })}
            </ResultGroup>
          )}

          {results.orders.length > 0 && (
            <ResultGroup title="Orders" count={results.orders.length}>
              {results.orders.map((o) => {
                const key = 'o:' + o.id;
                const focused = flatList[focusedIdx]?.key === key;
                return (
                  <ResultRow
                    key={key}
                    refStore={resultRefs}
                    item={{
                      key,
                      type: 'orders',
                      href: '/admin/orders',
                      title: o.buyer_name || o.buyer_email || `Order ${o.id.slice(0, 8)}`,
                      subtitle: `Status ${o.status} · ${formatMoney(o.total)}${o.tracking_number ? ' · Tracking ' + o.tracking_number : ''} · ${new Date(o.created_at).toLocaleDateString()}`,
                      ctaLabel: 'Open',
                      copyTracking: o.tracking_number ?? undefined,
                    }}
                    focused={focused}
                    query={q}
                    onCopyTracking={o.tracking_number ? () => copyToClipboard(o.tracking_number!, 'Tracking #') : undefined}
                  />
                );
              })}
            </ResultGroup>
          )}

          {results.coupons.length > 0 && (
            <ResultGroup title="Coupons" count={results.coupons.length}>
              {results.coupons.map((c) => {
                const key = 'c:' + c.id;
                const focused = flatList[focusedIdx]?.key === key;
                return (
                  <ResultRow
                    key={key}
                    refStore={resultRefs}
                    item={{
                      key,
                      type: 'coupons',
                      href: '/admin/coupons',
                      title: c.code,
                      subtitle: `${c.type === 'percent' ? `${c.value}% off` : c.type === 'fixed' ? `${formatMoney(c.value)} off` : c.type} · Used ${c.uses_count}×${c.expires_at ? ' · Expires ' + new Date(c.expires_at).toLocaleDateString() : ''}${c.is_active === false ? ' · Inactive' : ''}`,
                      ctaLabel: 'Manage',
                    }}
                    focused={focused}
                    query={q}
                  />
                );
              })}
            </ResultGroup>
          )}

          {results.transactions.length > 0 && (
            <ResultGroup title="Transactions" count={results.transactions.length}>
              {results.transactions.map((t) => {
                const key = 't:' + t.id;
                const focused = flatList[focusedIdx]?.key === key;
                return (
                  <ResultRow
                    key={key}
                    refStore={resultRefs}
                    item={{
                      key,
                      type: 'transactions',
                      href: '/admin/transactions',
                      title: t.description || `Transaction ${t.id.slice(0, 8)}`,
                      subtitle: `${t.type} · ${formatMoney(t.amount)} · ${new Date(t.created_at).toLocaleDateString()}${t.order_id ? ' · Order ' + t.order_id.slice(0, 8) : ''}`,
                      ctaLabel: 'Open',
                    }}
                    focused={focused}
                    query={q}
                  />
                );
              })}
            </ResultGroup>
          )}
        </>
      )}
    </div>
  );
}

// ─── Sub-components ───

function ResultGroup({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 20 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
          marginBottom: 8,
          padding: '0 4px',
        }}
      >
        <h2 style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--grey-400, #A8B4C0)', margin: 0, fontWeight: 700 }}>
          {title}
        </h2>
        <span style={{ fontSize: '0.78rem', color: 'var(--grey-500)' }}>({count})</span>
      </div>
      <div
        style={{
          background: 'var(--surface-2, #162230)',
          border: '1px solid var(--surface-3, #1D2D3E)',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </section>
  );
}

function ResultRow({
  item,
  focused,
  query,
  refStore,
  onCopyEmail,
  onCopyTracking,
}: {
  item: FlatItem;
  focused: boolean;
  query: string;
  refStore: React.MutableRefObject<Map<string, HTMLAnchorElement | null>>;
  onCopyEmail?: () => void;
  onCopyTracking?: () => void;
}) {
  return (
    <Link
      ref={(el) => {
        if (el) refStore.current.set(item.key, el);
        else refStore.current.delete(item.key);
      }}
      href={item.href}
      aria-current={focused ? 'true' : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        borderBottom: '1px solid var(--surface-3, #1D2D3E)',
        textDecoration: 'none',
        color: 'inherit',
        cursor: 'pointer',
        background: focused ? 'rgba(0, 196, 188, 0.07)' : 'transparent',
        outline: focused ? '1px solid rgba(0, 196, 188, 0.45)' : 'none',
        outlineOffset: focused ? -1 : 0,
      }}
    >
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div
          style={{
            fontSize: '0.95rem',
            fontWeight: 600,
            color: 'var(--white, #FFFFFF)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {highlight(item.title, query)}
        </div>
        <div
          style={{
            fontSize: '0.78rem',
            color: 'var(--grey-400, #A8B4C0)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.subtitle}
        </div>
      </div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        {onCopyEmail && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCopyEmail(); }}
            aria-label="Copy Email"
            title="Copy Email"
            style={iconBtn}
          >
            <Copy size={14} />
          </button>
        )}
        {onCopyTracking && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCopyTracking(); }}
            aria-label="Copy Tracking"
            title="Copy Tracking"
            style={iconBtn}
          >
            <Copy size={14} />
          </button>
        )}
        <span
          style={{
            fontSize: '0.82rem',
            color: 'var(--teal, #00C4BC)',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {item.ctaLabel}
          <ExternalLink size={12} />
        </span>
      </div>
    </Link>
  );
}

function EmptyState({
  recent,
  onPickRecent,
  onClearRecent,
}: {
  recent: string[];
  onPickRecent: (r: string) => void;
  onClearRecent: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {recent.length > 0 && (
        <section
          style={{
            background: 'var(--surface-2, #162230)',
            border: '1px solid var(--surface-3, #1D2D3E)',
            borderRadius: 12,
            padding: 16,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
            <div
              style={{
                fontSize: '0.78rem',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: 'var(--grey-400, #A8B4C0)',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Clock size={12} /> Recent Searches
            </div>
            <button
              type="button"
              onClick={onClearRecent}
              style={{
                background: 'transparent',
                border: 0,
                color: 'var(--grey-400, #A8B4C0)',
                cursor: 'pointer',
                fontSize: '0.75rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Trash2 size={12} /> Clear
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {recent.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onPickRecent(r)}
                style={{
                  padding: '4px 10px',
                  background: 'var(--surface-1, #0F1923)',
                  border: '1px solid var(--surface-3, #1D2D3E)',
                  borderRadius: 999,
                  color: 'var(--white, #FFFFFF)',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                }}
              >
                {r}
              </button>
            ))}
          </div>
        </section>
      )}

      <section
        style={{
          background: 'var(--surface-2, #162230)',
          border: '1px solid var(--surface-3, #1D2D3E)',
          borderRadius: 12,
          padding: 16,
        }}
      >
        <div
          style={{
            fontSize: '0.78rem',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'var(--grey-400, #A8B4C0)',
            fontWeight: 700,
            marginBottom: 10,
          }}
        >
          What You Can Search
        </div>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8, color: 'var(--grey-300, #D0DAE4)', fontSize: '0.92rem' }}>
          <li><strong>Users</strong> by full name, username, or email · includes admins, agents, sub-agents, super-agents, researchers, and shipping.</li>
          <li><strong>Storefronts</strong> by slug or display name.</li>
          <li><strong>Products</strong> by name, slug, or SKU.</li>
          <li><strong>Orders</strong> by buyer name, email, tracking number, or order id prefix.</li>
          <li><strong>Coupons</strong> by code.</li>
          <li><strong>Transactions</strong> by description or balance-ledger id.</li>
        </ul>
        <div style={{ marginTop: 12, fontSize: '0.78rem', color: 'var(--grey-400, #A8B4C0)' }}>
          Tips: scope chips narrow the search. Arrow keys move through results, Enter opens the focused row, Esc clears the query.
        </div>
      </section>
    </div>
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
