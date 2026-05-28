'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import BulkImportModal from './BulkImportModal';

/* ── types ── */
export interface RawProduct {
  id: string;
  name: string;
  category: string;
  base_cost: number;
  is_active: boolean;
  created_at: string;
  sku: string | null;
}

interface GroupedProduct {
  /** First id in the group (used for Edit link) */
  id: string;
  name: string;
  category: string;
  /** Lowest base_cost across variants */
  baseCost: number;
  isActive: boolean;
  /** How many SKU rows share this product name */
  variantCount: number;
  /** All variant ids (for future use) */
  variantIds: string[];
}

type SortKey =
  | 'name-asc'
  | 'name-desc'
  | 'category'
  | 'price-asc'
  | 'price-desc';

/* ── helpers ── */
interface GroupedProductInternal extends GroupedProduct {
  /** Representative product id used to look up per-product tier overrides. */
  representativeId: string;
}

function groupByName(products: RawProduct[]): GroupedProductInternal[] {
  const map = new Map<string, GroupedProductInternal>();

  for (const p of products) {
    const key = p.name.trim().toLowerCase();
    const existing = map.get(key);
    if (existing) {
      existing.variantCount += 1;
      existing.variantIds.push(p.id);
      // keep the lowest base cost as the representative price
      if (Number(p.base_cost) < existing.baseCost) {
        existing.baseCost = Number(p.base_cost);
        existing.representativeId = p.id;
      }
      // if any variant is active, treat the group as active
      if (p.is_active) existing.isActive = true;
    } else {
      map.set(key, {
        id: p.id,
        name: p.name,
        category: p.category,
        baseCost: Number(p.base_cost),
        isActive: p.is_active,
        variantCount: 1,
        variantIds: [p.id],
        representativeId: p.id,
      });
    }
  }

  return Array.from(map.values());
}

function fuzzyMatch(text: string, query: string): boolean {
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  // simple substring / partial match
  if (t.includes(q)) return true;
  // character-order fuzzy: every char of query appears in order in text
  let ti = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const found = t.indexOf(q[qi], ti);
    if (found === -1) return false;
    ti = found + 1;
  }
  return true;
}

/* ── component ── */
export default function ProductCatalogClient({
  products,
  multipliers,
  overrides = {},
}: {
  products: RawProduct[];
  multipliers: Record<string, number>;
  /** Optional per-product tier overrides keyed by `${product_id}:${tier_name}`. */
  overrides?: Record<string, number>;
}) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('name-asc');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showBulkModal, setShowBulkModal] = useState(false);

  const grouped = useMemo(() => groupByName(products), [products]);

  // unique categories
  const categories = useMemo(() => {
    const set = new Set(grouped.map(p => p.category));
    return Array.from(set).sort();
  }, [grouped]);

  // filtered + sorted
  const displayed = useMemo(() => {
    let list = grouped;

    // category filter
    if (categoryFilter !== 'all') {
      list = list.filter(p => p.category === categoryFilter);
    }

    // search
    if (search.trim()) {
      list = list.filter(p => fuzzyMatch(p.name, search.trim()));
    }

    // sort
    list = [...list];
    switch (sort) {
      case 'name-asc':
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name-desc':
        list.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'category':
        list.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
        break;
      case 'price-asc':
        list.sort((a, b) => a.baseCost - b.baseCost);
        break;
      case 'price-desc':
        list.sort((a, b) => b.baseCost - a.baseCost);
        break;
    }

    return list;
  }, [grouped, categoryFilter, search, sort]);

  const tierPrice = (productId: string, cost: number, tier: string) => {
    const overrideKey = `${productId}:${tier}`;
    const multiplier = overrides[overrideKey] ?? multipliers[tier] ?? 1;
    return `$${(cost * multiplier).toFixed(2)}`;
  };

  /* ── styles ── */
  const controlBarStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 'var(--space-3)',
    marginBottom: 'var(--space-6)',
    alignItems: 'center',
  };

  const inputStyle: React.CSSProperties = {
    flex: '1 1 260px',
    minWidth: 200,
  };

  const selectStyle: React.CSSProperties = {
    flex: '0 0 auto',
    minWidth: 160,
    cursor: 'pointer',
  };

  const thStyle: React.CSSProperties = {
    padding: 'var(--space-4)',
    textAlign: 'left',
    fontSize: '0.75rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    background: '#ffffff',
    color: '#0a0a0a',
  };

  return (
    <>
      {/* ── Control Bar ── */}
      <div style={controlBarStyle}>
        {/* Search */}
        <input
          id="product-search"
          type="text"
          className="form-input"
          placeholder="Search products…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={inputStyle}
        />

        {/* Sort */}
        <select
          id="product-sort"
          className="form-input"
          value={sort}
          onChange={e => setSort(e.target.value as SortKey)}
          style={selectStyle}
        >
          <option value="name-asc">A → Z</option>
          <option value="name-desc">Z → A</option>
          <option value="category">Category</option>
          <option value="price-asc">Price: Low → High</option>
          <option value="price-desc">Price: High → Low</option>
        </select>

        {/* Category filter */}
        <select
          id="product-category-filter"
          className="form-input"
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          style={selectStyle}
        >
          <option value="all">All Categories</option>
          {categories.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {/* Bulk Import */}
        <button
          type="button"
          onClick={() => setShowBulkModal(true)}
          className="btn btn-secondary btn-sm"
          style={{ flex: '0 0 auto' }}
        >
          Bulk Import CSV
        </button>
      </div>

      {/* ── Results count ── */}
      <p style={{ fontSize: '0.82rem', color: 'var(--grey-400)', marginBottom: 'var(--space-4)' }}>
        Showing {displayed.length} of {grouped.length} unique products
        {search && ` matching "${search}"`}
      </p>

      {/* ── Table ── */}
      <div className="card-metal" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
              {['Product Name', 'Variants', 'Category', 'Base Cost', 'Tier 1', 'Tier 2', 'Tier 3', 'Status', 'Actions'].map(h => (
                <th key={h} style={thStyle}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayed.length > 0 ? displayed.map((p, i) => (
              <tr key={p.id} style={{
                borderBottom: i < displayed.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                transition: 'background 0.15s',
              }}>
                {/* Name */}
                <td style={{ padding: 'var(--space-4)' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--white)' }}>
                    {p.name}
                  </div>
                </td>

                {/* Variants */}
                <td style={{ padding: 'var(--space-4)' }}>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: p.variantCount > 1 ? 'var(--teal)' : 'var(--grey-400)',
                    background: p.variantCount > 1 ? 'rgba(0,196,188,0.1)' : 'transparent',
                    border: p.variantCount > 1 ? '1px solid rgba(0,196,188,0.25)' : '1px solid rgba(255,255,255,0.06)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-sm)',
                    whiteSpace: 'nowrap',
                  }}>
                    {p.variantCount === 1 ? '1 size' : `${p.variantCount} sizes`}
                  </span>
                </td>

                {/* Category */}
                <td style={{ padding: 'var(--space-4)' }}>
                  <span className="badge badge-silver" style={{ fontSize: '0.65rem' }}>
                    {p.category}
                  </span>
                </td>

                {/* Base Cost */}
                <td style={{ padding: 'var(--space-4)', fontSize: '0.88rem', fontFamily: 'var(--font-brand)', color: 'var(--grey-400)' }}>
                  ${p.baseCost.toFixed(2)}
                </td>

                {/* Tier prices — per-product overrides take precedence */}
                <td style={{ padding: 'var(--space-4)', fontSize: '0.88rem', fontFamily: 'var(--font-brand)', color: 'var(--teal)' }}>
                  {tierPrice(p.representativeId, p.baseCost, 'tier_1')}
                </td>
                <td style={{ padding: 'var(--space-4)', fontSize: '0.88rem', fontFamily: 'var(--font-brand)', color: 'var(--silver)' }}>
                  {tierPrice(p.representativeId, p.baseCost, 'tier_2')}
                </td>
                <td style={{ padding: 'var(--space-4)', fontSize: '0.88rem', fontFamily: 'var(--font-brand)', color: 'var(--grey-400)' }}>
                  {tierPrice(p.representativeId, p.baseCost, 'tier_3')}
                </td>

                {/* Status */}
                <td style={{ padding: 'var(--space-4)' }}>
                  <span className={`badge ${p.isActive ? 'badge-teal' : 'badge-red'}`} style={{ fontSize: '0.65rem' }}>
                    {p.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>

                {/* Actions */}
                <td style={{ padding: 'var(--space-4)' }}>
                  <Link href={`/admin/products/${p.id}`} style={{ fontSize: '0.8rem', color: 'var(--teal)' }}>
                    Edit
                  </Link>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={9} style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
                  <p style={{ color: 'var(--grey-400)', marginBottom: 'var(--space-4)' }}>
                    {search ? 'No products match your search' : 'No Products Added Yet'}
                  </p>
                  {!search && (
                    <Link href="/admin/products/new" className="btn btn-primary btn-sm">
                      Add Your First Product
                    </Link>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showBulkModal && (
        <BulkImportModal onClose={() => setShowBulkModal(false)} />
      )}
    </>
  );
}
