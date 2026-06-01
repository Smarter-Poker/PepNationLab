'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, X } from 'lucide-react';

interface UserHit {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  role: string;
  is_super_agent?: boolean | null;
}

interface ProductHit {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  base_cost: number | null;
  is_active: boolean;
}

interface OrderHit {
  id: string;
  buyer_email: string | null;
  buyer_name: string | null;
  tracking_number: string | null;
  status: string;
  total: number | null;
  created_at: string;
}

interface StorefrontHit {
  id: string;
  slug: string;
  display_name: string;
  is_active: boolean | null;
}

interface SearchResult {
  users: UserHit[];
  products: ProductHit[];
  orders: OrderHit[];
  storefronts: StorefrontHit[];
}

function formatMoney(v: number | null): string {
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

export default function AdminSearchClient() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch('/api/admin/global-search?q=' + encodeURIComponent(q), {
          method: 'GET',
          cache: 'no-store',
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setErr(j.error || 'Search Failed');
          setResults(null);
          return;
        }
        const json = (await res.json()) as SearchResult;
        setResults(json);
      } catch {
        setErr('Network Error');
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const totalHits = useMemo(() => {
    if (!results) return 0;
    return results.users.length + results.products.length + results.orders.length + results.storefronts.length;
  }, [results]);

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: 16 }}>Global Search</h1>

      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'var(--surface-1, #0F1923)',
          border: '1px solid var(--surface-3, #1D2D3E)',
          borderRadius: 12,
          padding: '12px 16px',
          marginBottom: 24,
        }}
      >
        <Search size={18} aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Users, Products, Orders, Storefronts (Min 2 Characters)"
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
            onClick={() => setQuery('')}
            aria-label="Clear Search"
            style={{ background: 'transparent', border: 0, color: 'var(--grey-400, #A8B4C0)', cursor: 'pointer', padding: 4 }}
          >
            <X size={18} />
          </button>
        )}
      </label>

      {loading && <div style={{ color: 'var(--grey-400, #A8B4C0)' }}>Searching…</div>}
      {err && <div style={{ color: 'var(--red, #E53E3E)' }}>{err}</div>}

      {results && !loading && (
        <div style={{ marginBottom: 16, fontSize: '0.85rem', color: 'var(--grey-400, #A8B4C0)' }}>
          {totalHits === 0 ? 'No Results' : `${totalHits} Result${totalHits === 1 ? '' : 's'}`}
        </div>
      )}

      {results && results.users.length > 0 && (
        <ResultGroup title="Users" count={results.users.length}>
          {results.users.map((u) => (
            <Link
              key={u.id}
              href={u.role === 'researcher' ? '/admin/researchers' : '/admin/agents'}
              style={resultRow}
            >
              <div style={resultMain}>
                <div style={resultTitle}>{u.full_name || u.username || u.email || u.id}</div>
                <div style={resultMeta}>
                  {roleLabel(u)}
                  {u.username && ` · @${u.username}`}
                  {u.email && ` · ${u.email}`}
                </div>
              </div>
              <div style={resultCta}>Open →</div>
            </Link>
          ))}
        </ResultGroup>
      )}

      {results && results.storefronts.length > 0 && (
        <ResultGroup title="Storefronts" count={results.storefronts.length}>
          {results.storefronts.map((s) => (
            <Link key={s.id} href={`/${s.slug}`} style={resultRow}>
              <div style={resultMain}>
                <div style={resultTitle}>{s.display_name}</div>
                <div style={resultMeta}>
                  /{s.slug}
                  {s.is_active === false && ' · Inactive'}
                </div>
              </div>
              <div style={resultCta}>Preview →</div>
            </Link>
          ))}
        </ResultGroup>
      )}

      {results && results.products.length > 0 && (
        <ResultGroup title="Products" count={results.products.length}>
          {results.products.map((p) => (
            <Link key={p.id} href={`/admin/products/${p.id}`} style={resultRow}>
              <div style={resultMain}>
                <div style={resultTitle}>{p.name}</div>
                <div style={resultMeta}>
                  {p.slug}
                  {p.sku && ` · SKU ${p.sku}`}
                  {p.base_cost != null && ` · Base ${formatMoney(p.base_cost)}`}
                  {!p.is_active && ' · Inactive'}
                </div>
              </div>
              <div style={resultCta}>Edit →</div>
            </Link>
          ))}
        </ResultGroup>
      )}

      {results && results.orders.length > 0 && (
        <ResultGroup title="Orders" count={results.orders.length}>
          {results.orders.map((o) => (
            <Link key={o.id} href="/admin/orders" style={resultRow}>
              <div style={resultMain}>
                <div style={resultTitle}>
                  {o.buyer_name || o.buyer_email || `Order ${o.id.slice(0, 8)}`}
                </div>
                <div style={resultMeta}>
                  Status {o.status} · {formatMoney(o.total)}
                  {o.tracking_number && ` · Tracking ${o.tracking_number}`}
                  {' · '}
                  {new Date(o.created_at).toLocaleDateString()}
                </div>
              </div>
              <div style={resultCta}>Open →</div>
            </Link>
          ))}
        </ResultGroup>
      )}
    </div>
  );
}

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
    <section style={{ marginBottom: 24 }}>
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

const resultRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 16px',
  borderBottom: '1px solid var(--surface-3, #1D2D3E)',
  textDecoration: 'none',
  color: 'inherit',
  cursor: 'pointer',
};

const resultMain: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};

const resultTitle: React.CSSProperties = {
  fontSize: '0.95rem',
  fontWeight: 600,
  color: 'var(--white, #FFFFFF)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const resultMeta: React.CSSProperties = {
  fontSize: '0.78rem',
  color: 'var(--grey-400, #A8B4C0)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const resultCta: React.CSSProperties = {
  fontSize: '0.82rem',
  color: 'var(--teal, #00C4BC)',
  fontWeight: 600,
  flexShrink: 0,
};
