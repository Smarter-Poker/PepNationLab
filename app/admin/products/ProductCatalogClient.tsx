'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showBulkPriceModal, setShowBulkPriceModal] = useState(false);
  const [bulkScope, setBulkScope] = useState<'master_base_cost' | 'master_bulk_price'>('master_base_cost');
  const [bulkAdjustment, setBulkAdjustment] = useState<'set' | 'percent_delta' | 'flat_delta'>('percent_delta');
  const [bulkValue, setBulkValue] = useState('');
  const [bulkEffectiveAt, setBulkEffectiveAt] = useState('');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

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

  const toggleAllVisible = () => {
    const next = new Set(selected);
    const allSelected = displayed.every((p) => p.variantIds.every((v) => next.has(v)));
    displayed.forEach((p) => {
      p.variantIds.forEach((vid) => {
        if (allSelected) next.delete(vid);
        else next.add(vid);
      });
    });
    setSelected(next);
  };

  const toggleRow = (variantIds: string[]) => {
    const next = new Set(selected);
    const allOn = variantIds.every((v) => next.has(v));
    variantIds.forEach((v) => {
      if (allOn) next.delete(v);
      else next.add(v);
    });
    setSelected(next);
  };

  const handleBulkSubmit = async () => {
    if (selected.size === 0) {
      toast.error('No Products Selected');
      return;
    }
    const valueNum = Number(bulkValue);
    if (!Number.isFinite(valueNum)) {
      toast.error('Invalid Value');
      return;
    }
    setBulkSubmitting(true);
    try {
      const res = await fetch('/api/admin/products/bulk-price', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          product_ids: Array.from(selected),
          scope: bulkScope,
          adjustment_type: bulkAdjustment,
          new_value: valueNum,
          effective_at: bulkEffectiveAt ? new Date(bulkEffectiveAt).toISOString() : null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json?.error ?? 'Failed To Apply Bulk Adjustment');
        setBulkSubmitting(false);
        return;
      }
      const applied = json.applied_count ?? 0;
      const scheduled = json.scheduled_count ?? 0;
      if (applied > 0) {
        toast.success(`Applied ${applied} Price Change(s)`);
      } else {
        toast.success(`Scheduled ${scheduled} Price Change(s)`);
      }
      setShowBulkPriceModal(false);
      setSelected(new Set());
      setBulkValue('');
      setBulkEffectiveAt('');
      if (applied > 0) {
        window.location.reload();
      }
    } catch {
      toast.error('Network Error');
    } finally {
      setBulkSubmitting(false);
    }
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
      {/* Control Bar */}
      <div style={controlBarStyle}>
        <input
          id="product-search"
          type="text"
          className="form-input"
          placeholder="Search products…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={inputStyle}
        />

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

        <button
          type="button"
          onClick={() => setShowBulkModal(true)}
          className="btn btn-secondary btn-sm"
          style={{ flex: '0 0 auto' }}
        >
          Bulk Import CSV
        </button>
      </div>

      {/* Results count */}
      <p style={{ fontSize: '0.82rem', color: 'var(--grey-400)', marginBottom: 'var(--space-4)' }}>
        Showing {displayed.length} of {grouped.length} unique products
        {search && ` matching "${search}"`}
      </p>

      {/* Bulk Action Bar */}
      {selected.size > 0 && (
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 20,
            background: 'rgba(0,196,188,0.12)',
            border: '1px solid rgba(0,196,188,0.4)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3) var(--space-4)',
            marginBottom: 'var(--space-4)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 'var(--space-3)',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ color: 'var(--teal)', fontWeight: 600, fontSize: '0.85rem' }}>
            {selected.size} Variant(s) Selected
          </span>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setShowBulkPriceModal(true)}
            >
              Bulk Adjust Price
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setSelected(new Set())}
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card-metal" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
              <th style={thStyle}>
                <input
                  type="checkbox"
                  aria-label="Select All Visible Products"
                  checked={
                    displayed.length > 0 &&
                    displayed.every((p) => p.variantIds.every((v) => selected.has(v)))
                  }
                  onChange={toggleAllVisible}
                />
              </th>
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
                <td style={{ padding: 'var(--space-4)' }}>
                  <input
                    type="checkbox"
                    aria-label={`Select ${p.name}`}
                    checked={p.variantIds.every((v) => selected.has(v))}
                    onChange={() => toggleRow(p.variantIds)}
                  />
                </td>
                <td style={{ padding: 'var(--space-4)' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--white)' }}>
                    {p.name}
                  </div>
                </td>

                <td style={{ padding: 'var(--space-4)' }}>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: p.variantCount > 1 ? 'var(--teal)' : 'var(--grey-400)',
                    background: p.variantCount > 1 ? 'rgba(192,184,168,0.1)' : 'transparent',
                    border: p.variantCount > 1 ? '1px solid rgba(192,184,168,0.25)' : '1px solid rgba(255,255,255,0.06)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-sm)',
                    whiteSpace: 'nowrap',
                  }}>
                    {p.variantCount === 1 ? '1 size' : `${p.variantCount} sizes`}
                  </span>
                </td>

                <td style={{ padding: 'var(--space-4)' }}>
                  <span className="badge badge-silver" style={{ fontSize: '0.65rem' }}>
                    {p.category}
                  </span>
                </td>

                <td style={{ padding: 'var(--space-4)', fontSize: '0.88rem', fontFamily: 'var(--font-brand)', color: 'var(--grey-400)' }}>
                  ${p.baseCost.toFixed(2)}
                </td>

                <td style={{ padding: 'var(--space-4)', fontSize: '0.88rem', fontFamily: 'var(--font-brand)', color: 'var(--teal)' }}>
                  {tierPrice(p.representativeId, p.baseCost, 'tier_1')}
                </td>
                <td style={{ padding: 'var(--space-4)', fontSize: '0.88rem', fontFamily: 'var(--font-brand)', color: 'var(--silver)' }}>
                  {tierPrice(p.representativeId, p.baseCost, 'tier_2')}
                </td>
                <td style={{ padding: 'var(--space-4)', fontSize: '0.88rem', fontFamily: 'var(--font-brand)', color: 'var(--grey-400)' }}>
                  {tierPrice(p.representativeId, p.baseCost, 'tier_3')}
                </td>

                <td style={{ padding: 'var(--space-4)' }}>
                  <span className={`badge ${p.isActive ? 'badge-teal' : 'badge-red'}`} style={{ fontSize: '0.65rem' }}>
                    {p.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>

                <td style={{ padding: 'var(--space-4)' }}>
                  <Link href={`/admin/products/${p.id}`} style={{ fontSize: '0.8rem', color: 'var(--teal)' }}>
                    Edit
                  </Link>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={10} style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
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

      {showBulkPriceModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 'var(--space-4)',
          }}
        >
          <div
            className="card-metal"
            style={{ width: '100%', maxWidth: 520, padding: 'var(--space-6)' }}
          >
            <h2 style={{ fontSize: '1.2rem', marginTop: 0, marginBottom: 'var(--space-4)' }}>
              Bulk Adjust Price
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)', marginBottom: 'var(--space-4)' }}>
              Applying To {selected.size} Variant(s).
            </p>

            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label className="form-label">Scope</label>
              <select
                className="form-input"
                value={bulkScope}
                onChange={(e) => setBulkScope(e.target.value as 'master_base_cost' | 'master_bulk_price')}
              >
                <option value="master_base_cost">Master Base Cost</option>
                <option value="master_bulk_price">Master Bulk Price</option>
              </select>
            </div>

            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label className="form-label">Adjustment Type</label>
              <select
                className="form-input"
                value={bulkAdjustment}
                onChange={(e) => setBulkAdjustment(e.target.value as 'set' | 'percent_delta' | 'flat_delta')}
              >
                <option value="set">Set To</option>
                <option value="percent_delta">Percent Delta</option>
                <option value="flat_delta">Flat Delta</option>
              </select>
            </div>

            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label className="form-label">
                {bulkAdjustment === 'percent_delta' ? 'Value (%)' : 'Value ($)'}
              </label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                value={bulkValue}
                onChange={(e) => setBulkValue(e.target.value)}
                placeholder={bulkAdjustment === 'percent_delta' ? 'e.g. 10 or -5' : 'e.g. 12.50'}
              />
            </div>

            <div style={{ marginBottom: 'var(--space-5)' }}>
              <label className="form-label">Effective At (Optional — Empty = Now)</label>
              <input
                type="datetime-local"
                className="form-input"
                value={bulkEffectiveAt}
                onChange={(e) => setBulkEffectiveAt(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowBulkPriceModal(false)}
                disabled={bulkSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleBulkSubmit}
                disabled={bulkSubmitting || !bulkValue}
              >
                {bulkSubmitting ? 'Submitting' : 'Apply Bulk Adjustment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
