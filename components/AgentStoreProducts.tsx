'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface ProductInfo {
  name: string;
  description: string;
  image_url: string | null;
  category: string;
  in_stock: boolean;
  inventory_count: number;
  unit_size: string | null;
  unit_measure: string | null;
  base_cost?: number | null;
}

interface AgentProduct {
  id: string;
  agent_id: string;
  product_id: string;
  custom_name: string | null;
  custom_description: string | null;
  custom_image_url: string | null;
  retail_price: number;
  is_visible: boolean;
  is_on_sale: boolean;
  sale_price: number | null;
  sort_order: number;
  products: ProductInfo;
  /** Your cost price from PNL (base_cost × tier multiplier, per 10 vials) */
  agent_cost: number | null;
  /** The agent’s current tier key, e.g. ‘tier_1’ */
  agent_tier: string | null;
}

type FilterMode = 'all' | 'active' | 'hidden';

export default function AgentStoreProducts({ agentId }: { agentId: string }) {
  const [products, setProducts] = useState<AgentProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [viewMode, setViewMode] = useState<'flat' | 'category'>('flat');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<AgentProduct>>({});
  const [saving, setSaving] = useState(false);
  const [bulkMargin, setBulkMargin] = useState('50');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  useEffect(() => { fetchProducts(); }, [agentId]);

  async function fetchProducts() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/agent/products');
      const json = await res.json();
      if (res.ok) {
        const sorted = (json.data || []).sort((a: AgentProduct, b: AgentProduct) => {
          // Primary: canonical product name A→Z
          const nameA = (a.products?.name || '').toLowerCase().trim();
          const nameB = (b.products?.name || '').toLowerCase().trim();
          if (nameA < nameB) return -1;
          if (nameA > nameB) return 1;
          // Secondary: unit_size numerically smallest→largest (e.g. 10mg before 50mg before 500mg)
          const sizeA = parseFloat(a.products?.unit_size || '0') || 0;
          const sizeB = parseFloat(b.products?.unit_size || '0') || 0;
          return sizeA - sizeB;
        });
        setProducts(sorted);
        // Auto-expand all categories on first load
        const cats = new Set(sorted.map((p: AgentProduct) => p.products?.category || 'Other'));
        setExpandedCategories(cats as Set<string>);
      } else {
        setError(json.error || 'Failed To Load Products');
      }
    } catch (err: any) {
      setError(err.message || 'An Error Occurred');
    } finally {
      setLoading(false);
    }
  }

  // Toggle visibility
  async function toggleVisibility(product: AgentProduct) {
    try {
      const res = await fetch('/api/agent/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: product.id, is_visible: !product.is_visible }),
      });
      if (res.ok) {
        setProducts(prev => prev.map(p => p.id === product.id ? { ...p, is_visible: !p.is_visible } : p));
      }
    } catch {}
  }

  // Move product up/down
  async function moveProduct(productId: string, direction: 'up' | 'down') {
    const idx = products.findIndex(p => p.id === productId);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === products.length - 1) return;

    const newProducts = [...products];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    [newProducts[idx], newProducts[swapIdx]] = [newProducts[swapIdx], newProducts[idx]];

    // Update sort_order values
    const reordered = newProducts.map((p, i) => ({ ...p, sort_order: i }));
    setProducts(reordered);

    // Save to DB
    setReordering(true);
    try {
      await fetch('/api/agent/products/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order: reordered.map(p => ({ id: p.id, sort_order: p.sort_order }))
        }),
      });
    } catch {} finally {
      setReordering(false);
    }
  }

  // Edit
  function handleEdit(p: AgentProduct) {
    setEditingId(p.id);
    // Pre-fill margin_percent from product data (back-computed if available, else default 50)
    const existingMargin = (p as any).margin_percent != null
      ? Number((p as any).margin_percent)
      : p.agent_cost != null && p.agent_cost > 0 && p.retail_price > 0
        ? Math.round((p.retail_price / p.agent_cost - 1) * 100)
        : 50;
    setEditForm({
      id: p.id,
      custom_name: p.custom_name ?? '',
      custom_description: p.custom_description ?? '',
      custom_image_url: p.custom_image_url ?? '',
      retail_price: p.retail_price,
      margin_percent: existingMargin,
      is_visible: p.is_visible,
      is_on_sale: p.is_on_sale,
      sale_price: p.sale_price,
    } as any);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setSaving(true);
    try {
      const res = await fetch('/api/agent/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        const json = await res.json();
        alert(json.error || 'Failed To Save');
      } else {
        await fetchProducts();
        setEditingId(null);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleBulkAdjust() {
    const margin = parseFloat(bulkMargin);
    if (isNaN(margin) || margin < 0) {
      alert('Please Enter A Valid Margin Percentage');
      return;
    }
    setBulkSaving(true);
    try {
      const res = await fetch('/api/agent/products/bulk-margin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marginPercent: margin }),
      });
      if (!res.ok) throw new Error('Failed To Apply');
      await fetchProducts();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBulkSaving(false);
    }
  }

  function toggleCategory(cat: string) {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  }

  // Filter
  const filtered = products.filter(p => {
    if (filter === 'active') return p.is_visible;
    if (filter === 'hidden') return !p.is_visible;
    return true;
  });

  // Group by category
  const grouped = filtered.reduce<Record<string, AgentProduct[]>>((acc, p) => {
    const cat = p.products?.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});
  const sortedCategories = Object.keys(grouped).sort();

  const activeCount = products.filter(p => p.is_visible).length;
  const hiddenCount = products.filter(p => !p.is_visible).length;

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
        <p style={{ color: 'var(--teal)', fontSize: '1rem' }}>Loading Store Products...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div className="card-metal" style={{ padding: 'var(--space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--white)', marginBottom: 4, fontFamily: 'var(--font-brand)', textTransform: 'uppercase' }}>
              Product Catalog Manager
            </h3>
            <p style={{ color: 'var(--grey-400)', fontSize: '0.82rem', margin: 0 }}>
              Toggle Products On/Off, Reorder Them, Set Custom Prices And Descriptions.
            </p>
          </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* View mode toggle */}
            <div style={{ display: 'flex', gap: 4, background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', padding: 3 }}>
              {([['flat', 'All'], ['category', 'By Category']] as ['flat' | 'category', string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setViewMode(key)}
                  style={{
                    padding: '5px 12px', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                    fontSize: '0.75rem', fontWeight: 600, transition: 'all 0.2s',
                    background: viewMode === key ? 'var(--surface-3)' : 'transparent',
                    color: viewMode === key ? 'var(--white)' : 'var(--grey-400)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4, background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', padding: 3 }}>
            {([['all', `All (${products.length})`], ['active', `Active (${activeCount})`], ['hidden', `Hidden (${hiddenCount})`]] as [FilterMode, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                style={{
                  padding: '6px 14px', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  fontSize: '0.78rem', fontWeight: 600, transition: 'all 0.2s',
                  background: filter === key ? 'var(--teal)' : 'transparent',
                  color: filter === key ? 'var(--white)' : 'var(--grey-400)',
                }}
              >
                {label}
              </button>
            ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Margin */}
      <div className="card-metal" style={{ padding: 'var(--space-5)' }}>
        <h4 style={{ fontSize: '0.9rem', color: 'var(--white)', marginBottom: 'var(--space-3)' }}>Bulk Margin Adjustment</h4>
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--grey-400)' }}>Apply +</span>
          <input
            type="number"
            className="form-input"
            style={{ width: 80, padding: '4px 8px', height: 32 }}
            value={bulkMargin}
            onChange={e => setBulkMargin(e.target.value)}
          />
          <span style={{ fontSize: '0.82rem', color: 'var(--grey-400)' }}>% Margin To All Products</span>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleBulkAdjust}
            disabled={bulkSaving}
            style={{ marginLeft: 'auto' }}
          >
            {bulkSaving ? 'Applying...' : 'Apply Bulk Margin'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(229,62,62,0.1)', border: '1px solid rgba(229,62,62,0.3)', borderRadius: 8, padding: 'var(--space-3)', fontSize: '0.85rem', color: 'var(--red)' }}>
          {error}
        </div>
      )}

      {/* ── Flat alphabetical list (default) ── */}
      {viewMode === 'flat' && (
        <div className="card-metal" style={{ padding: 0, overflow: 'hidden' }}>
          {filtered.map((p, _idx) => {
            const displayName = p.custom_name || p.products.name;
            const isEditing = editingId === p.id;
            const sizeLabel = p.products.unit_size && p.products.unit_measure
              ? `${p.products.unit_size}${p.products.unit_measure}`
              : '';
            return (
              <div
                key={p.id}
                style={{
                  padding: 'var(--space-4) var(--space-5)',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  opacity: p.is_visible ? 1 : 0.5,
                  transition: 'opacity 0.2s',
                }}
              >
                {isEditing ? (
                  <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end' }}>
                      <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Custom Name</label>
                        <input type="text" className="form-input" placeholder={p.products.name} value={editForm.custom_name || ''} onChange={e => setEditForm({ ...editForm, custom_name: e.target.value })} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0, flex: '0 0 160px' }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>
                          Your Markup
                          <span style={{ fontWeight: 400, color: 'var(--grey-400)', marginLeft: 6 }}>(%)</span>
                        </label>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          className="form-input"
                          placeholder="e.g. 50"
                          value={(editForm as any).margin_percent ?? 50}
                          onChange={e => setEditForm({ ...editForm, margin_percent: Number(e.target.value) } as any)}
                        />
                        {p.agent_cost != null && (editForm as any).margin_percent != null && (
                          <p style={{ fontSize: '0.68rem', color: 'var(--grey-400)', marginTop: 4, marginBottom: 0 }}>
                            Your Sale Price: <strong style={{ color: 'var(--teal)' }}>
                              ${(p.agent_cost / 10 * (1 + Number((editForm as any).margin_percent) / 100)).toFixed(2)}
                            </strong> / Vial
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Custom Description</label>
                      <textarea className="form-input" rows={2} placeholder={p.products.description || 'No Description'} value={editForm.custom_description || ''} onChange={e => setEditForm({ ...editForm, custom_description: e.target.value })} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.82rem', color: 'var(--grey-300)' }}>
                        <input
                          type="checkbox"
                          checked={(editForm as any).is_on_sale || false}
                          onChange={e => setEditForm({ ...editForm, is_on_sale: e.target.checked } as any)}
                          style={{ accentColor: 'var(--teal)', width: 16, height: 16 }}
                        />
                        Mark On Sale
                      </label>
                      {(editForm as any).is_on_sale && (
                        <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 120 }}>
                          <label className="form-label" style={{ fontSize: '0.75rem' }}>Sale Price ($)</label>
                          <input type="number" step="0.01" className="form-input" placeholder="Sale price" value={(editForm as any).sale_price || ''} onChange={e => setEditForm({ ...editForm, sale_price: Number(e.target.value) || null } as any)} />
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                      <button type="submit" disabled={saving} className="btn btn-primary btn-sm">{saving ? 'Saving...' : 'Save'}</button>
                      <button type="button" onClick={() => setEditingId(null)} className="btn btn-secondary btn-sm">Cancel</button>
                    </div>
                  </form>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                    {/* Reorder Arrows */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <button onClick={() => moveProduct(p.id, 'up')} disabled={reordering} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, fontSize: '0.7rem', color: 'var(--grey-400)', lineHeight: 1 }} title="Move Up">▲</button>
                      <button onClick={() => moveProduct(p.id, 'down')} disabled={reordering} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, fontSize: '0.7rem', color: 'var(--grey-400)', lineHeight: 1 }} title="Move Down">▼</button>
                    </div>
                    {/* Product Image */}
                    <img
                      src={p.custom_image_url || p.products.image_url || '/images/peptide_clear.png'}
                      alt={displayName}
                      style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', background: 'var(--surface-3)' }}
                    />
                    {/* Product Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--white)' }}>{displayName}</span>
                        {sizeLabel && <span style={{ fontSize: '0.7rem', color: 'var(--grey-400)', background: 'var(--surface-3)', padding: '1px 6px', borderRadius: 4 }}>{sizeLabel}</span>}
                        <span style={{ fontSize: '0.65rem', color: 'var(--grey-500)', padding: '1px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.04)' }}>{p.products.category}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {/* Agent cost per vial — what they pay PNL */}
                        {p.agent_cost != null && p.agent_cost > 0 && (
                          <>
                            <span style={{ fontSize: '0.7rem', color: 'var(--grey-500)', fontWeight: 500 }}>Your Cost:</span>
                            <span style={{ fontSize: '0.82rem', color: '#68D391', fontWeight: 700 }}>
                              ${(p.agent_cost / 10).toFixed(2)} / Vial
                            </span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--grey-600)' }}>→</span>
                          </>
                        )}
                        {/* Agent's listed sale price per vial */}
                        <span style={{ fontSize: '0.7rem', color: 'var(--grey-500)', fontWeight: 500 }}>Listed:</span>
                        <span style={{ fontSize: '0.82rem', color: 'var(--teal)', fontWeight: 700 }}>
                          ${(Number(p.retail_price) / 10).toFixed(2)} / Vial
                        </span>
                        {p.is_on_sale && p.sale_price && (
                          <span style={{ fontSize: '0.7rem', color: '#F56565', fontWeight: 700, background: 'rgba(245,101,101,0.10)', padding: '2px 6px', borderRadius: 4 }}>
                            On Sale ${(Number(p.sale_price) / 10).toFixed(2)} / Vial
                          </span>
                        )}
                        {p.agent_cost != null && p.agent_cost > 0 && p.retail_price > 0 && (
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: 'rgba(255,255,255,0.04)', color: (p.retail_price / p.agent_cost - 1) >= 0.15 ? 'var(--teal)' : '#F6AD55' }}>
                            +{Math.round((p.retail_price / p.agent_cost - 1) * 100)}%
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Toggle Switch */}
                    <button
                      onClick={() => toggleVisibility(p)}
                      style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', background: p.is_visible ? 'var(--teal)' : 'var(--surface-3)' }}
                      title={p.is_visible ? 'Click To Hide' : 'Click To Show'}
                    >
                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--white)', position: 'absolute', top: 3, transition: 'left 0.2s', left: p.is_visible ? 23 : 3, boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                    </button>
                    {/* Edit Button */}
                    <button onClick={() => handleEdit(p)} className="btn btn-secondary btn-sm" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>Edit</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── By Category view ── */}
      {viewMode === 'category' && sortedCategories.map(category => {
        const catProducts = grouped[category];
        const isExpanded = expandedCategories.has(category);
        const catActiveCount = catProducts.filter(p => p.is_visible).length;

        return (
          <div key={category} className="card-metal" style={{ padding: 0, overflow: 'hidden' }}>
            <button
              onClick={() => toggleCategory(category)}
              style={{
                width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: 'var(--space-4) var(--space-5)', background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: isExpanded ? '1px solid rgba(255,255,255,0.06)' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <span style={{ color: 'var(--teal)', fontSize: '0.7rem', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>▶</span>
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--white)', fontFamily: 'var(--font-brand)' }}>{category}</span>
                <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 12, background: 'rgba(192,184,168,0.1)', color: 'var(--teal)' }}>
                  {catActiveCount}/{catProducts.length} Active
                </span>
              </div>
            </button>

            {isExpanded && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {catProducts.map((p) => {
                  const displayName = p.custom_name || p.products.name;
                  const isEditing = editingId === p.id;
                  const sizeLabel = p.products.unit_size && p.products.unit_measure
                    ? `${p.products.unit_size}${p.products.unit_measure}`
                    : '';

                  return (
                    <div
                      key={p.id}
                      style={{
                        padding: 'var(--space-4) var(--space-5)',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        opacity: p.is_visible ? 1 : 0.5,
                        transition: 'opacity 0.2s',
                      }}
                    >
                      {isEditing ? (
                        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end' }}>
                            <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                              <label className="form-label" style={{ fontSize: '0.75rem' }}>Custom Name</label>
                              <input type="text" className="form-input" placeholder={p.products.name} value={editForm.custom_name || ''} onChange={e => setEditForm({ ...editForm, custom_name: e.target.value })} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0, flex: '0 0 160px' }}>
                              <label className="form-label" style={{ fontSize: '0.75rem' }}>
                                Your Markup
                                <span style={{ fontWeight: 400, color: 'var(--grey-400)', marginLeft: 6 }}>(%)</span>
                              </label>
                              <input type="number" step="1" min="0" className="form-input" placeholder="e.g. 50"
                                value={(editForm as any).margin_percent ?? 50}
                                onChange={e => setEditForm({ ...editForm, margin_percent: Number(e.target.value) } as any)}
                              />
                              {p.agent_cost != null && (editForm as any).margin_percent != null && (
                                <p style={{ fontSize: '0.68rem', color: 'var(--grey-400)', marginTop: 4, marginBottom: 0 }}>
                                  Your Sale Price: <strong style={{ color: 'var(--teal)' }}>
                                    ${(p.agent_cost / 10 * (1 + Number((editForm as any).margin_percent) / 100)).toFixed(2)}
                                  </strong> / Vial
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: '0.75rem' }}>Custom Description</label>
                            <textarea className="form-input" rows={2} placeholder={p.products.description || 'No Description'} value={editForm.custom_description || ''} onChange={e => setEditForm({ ...editForm, custom_description: e.target.value })} />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.82rem', color: 'var(--grey-300)' }}>
                              <input type="checkbox" checked={(editForm as any).is_on_sale || false} onChange={e => setEditForm({ ...editForm, is_on_sale: e.target.checked } as any)} style={{ accentColor: 'var(--teal)', width: 16, height: 16 }} />
                              Mark On Sale
                            </label>
                            {(editForm as any).is_on_sale && (
                              <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 120 }}>
                                <label className="form-label" style={{ fontSize: '0.75rem' }}>Sale Price ($)</label>
                                <input type="number" step="0.01" className="form-input" placeholder="Sale price" value={(editForm as any).sale_price || ''} onChange={e => setEditForm({ ...editForm, sale_price: Number(e.target.value) || null } as any)} />
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                            <button type="submit" disabled={saving} className="btn btn-primary btn-sm">{saving ? 'Saving...' : 'Save'}</button>
                            <button type="button" onClick={() => setEditingId(null)} className="btn btn-secondary btn-sm">Cancel</button>
                          </div>
                        </form>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <button onClick={() => moveProduct(p.id, 'up')} disabled={reordering} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, fontSize: '0.7rem', color: 'var(--grey-400)', lineHeight: 1 }} title="Move Up">▲</button>
                            <button onClick={() => moveProduct(p.id, 'down')} disabled={reordering} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, fontSize: '0.7rem', color: 'var(--grey-400)', lineHeight: 1 }} title="Move Down">▼</button>
                          </div>
                          <img src={p.custom_image_url || p.products.image_url || '/images/peptide_clear.png'} alt={displayName} style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', background: 'var(--surface-3)' }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--white)' }}>{displayName}</span>
                              {sizeLabel && <span style={{ fontSize: '0.7rem', color: 'var(--grey-400)', background: 'var(--surface-3)', padding: '1px 6px', borderRadius: 4 }}>{sizeLabel}</span>}
                            </div>
                            {/* Agent cost + listed price per vial — no raw base cost or multiplier */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              {p.agent_cost != null && p.agent_cost > 0 && (
                                <>
                                  <span style={{ fontSize: '0.7rem', color: 'var(--grey-500)', fontWeight: 500 }}>Your Cost:</span>
                                  <span style={{ fontSize: '0.82rem', color: '#68D391', fontWeight: 700 }}>${(p.agent_cost / 10).toFixed(2)} / Vial</span>
                                  <span style={{ fontSize: '0.65rem', color: 'var(--grey-600)' }}>→</span>
                                </>
                              )}
                              <span style={{ fontSize: '0.7rem', color: 'var(--grey-500)', fontWeight: 500 }}>Listed:</span>
                              <span style={{ fontSize: '0.82rem', color: 'var(--teal)', fontWeight: 700 }}>${(Number(p.retail_price) / 10).toFixed(2)} / Vial</span>
                              {p.is_on_sale && p.sale_price && (
                                <span style={{ fontSize: '0.7rem', color: '#F56565', fontWeight: 700, background: 'rgba(245,101,101,0.10)', padding: '2px 6px', borderRadius: 4 }}>
                                  On Sale ${(Number(p.sale_price) / 10).toFixed(2)} / Vial
                                </span>
                              )}
                              {p.agent_cost != null && p.agent_cost > 0 && p.retail_price > 0 && (
                                <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: 'rgba(255,255,255,0.04)', color: (p.retail_price / p.agent_cost - 1) >= 0.15 ? 'var(--teal)' : '#F6AD55' }}>
                                  +{Math.round((p.retail_price / p.agent_cost - 1) * 100)}%
                                </span>
                              )}
                            </div>
                          </div>
                          <button onClick={() => toggleVisibility(p)} style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', background: p.is_visible ? 'var(--teal)' : 'var(--surface-3)' }} title={p.is_visible ? 'Click To Hide' : 'Click To Show'}>
                            <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--white)', position: 'absolute', top: 3, transition: 'left 0.2s', left: p.is_visible ? 23 : 3, boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                          </button>
                          <button onClick={() => handleEdit(p)} className="btn btn-secondary btn-sm" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>Edit</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 'var(--space-8) 0' }}>
          <p style={{ color: 'var(--grey-400)' }}>No Products Match This Filter.</p>
        </div>
      )}
    </div>
  );
}
