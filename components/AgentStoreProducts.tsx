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
  /** The agent's current tier key, e.g. 'tier_1' */
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
  // Round 9: mobile-only search bar (replaces dropdowns) + force category view on mobile
  const [search, setSearch] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 768px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => { fetchProducts(); }, [agentId]);

  async function fetchProducts() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/agent/products');
      const json = await res.json();
      if (res.ok) {
        const sorted = (json.data || []).sort((a: AgentProduct, b: AgentProduct) => {
          const nameA = (a.products?.name || '').toLowerCase().trim();
          const nameB = (b.products?.name || '').toLowerCase().trim();
          if (nameA < nameB) return -1;
          if (nameA > nameB) return 1;
          const sizeA = parseFloat(a.products?.unit_size || '0') || 0;
          const sizeB = parseFloat(b.products?.unit_size || '0') || 0;
          return sizeA - sizeB;
        });
        setProducts(sorted);
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

  async function moveProduct(productId: string, direction: 'up' | 'down') {
    const idx = products.findIndex(p => p.id === productId);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === products.length - 1) return;

    const newProducts = [...products];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    [newProducts[idx], newProducts[swapIdx]] = [newProducts[swapIdx], newProducts[idx]];

    const reordered = newProducts.map((p, i) => ({ ...p, sort_order: i }));
    setProducts(reordered);

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

  function handleEdit(p: AgentProduct) {
    setEditingId(p.id);
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

    const listedPrice = Number((editForm as any).retail_price);
    const currentProduct = products.find(p => p.id === editingId);
    const agentCostPer10 = currentProduct?.agent_cost ?? 0;
    if (listedPrice < agentCostPer10) {
      alert(`Listed price cannot be below your cost ($${(agentCostPer10 / 10).toFixed(2)} / Vial). Please increase your price.`);
      return;
    }

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

  const filtered = products.filter(p => {
    if (filter === 'active') return p.is_visible;
    if (filter === 'hidden') return !p.is_visible;
    return true;
  });

  // Round 9: on mobile, force By Category view + apply search filter
  const effectiveViewMode = isMobile ? 'category' : viewMode;
  const searchTerm = search.trim().toLowerCase();
  const searchFiltered = !searchTerm ? filtered : filtered.filter(p => {
    const name = (p.custom_name || p.products.name).toLowerCase();
    return name.includes(searchTerm);
  });

  const grouped = searchFiltered.reduce<Record<string, AgentProduct[]>>((acc, p) => {
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
      <div className="metal-frame">
        <div className="metal-content" style={{ padding: 'var(--space-6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
            <div>
              <h3 className="metal-text" style={{ fontSize: '1.25rem', margin: 0, fontFamily: 'var(--font-brand)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Product Catalog Manager
              </h3>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem', margin: '4px 0 0' }}>
                Toggle Products On/Off, Reorder Them, Set Custom Prices And Descriptions.
              </p>
            </div>
            <div className="agentprod-header-controls" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="agentprod-view-toggle" style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.5)', borderRadius: '4px', padding: 3, border: '1px solid rgba(255,255,255,0.05)' }}>
                {( [['flat', 'All'], ['category', 'By Category']] as ['flat' | 'category', string][] ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setViewMode(key)}
                    style={{
                      padding: '5px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer',
                      fontSize: '0.75rem', fontWeight: 600, transition: 'all 0.2s',
                      background: viewMode === key ? 'rgba(0,229,255,0.1)' : 'transparent',
                      color: viewMode === key ? '#00E5FF' : 'rgba(255,255,255,0.4)',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="agentprod-filter-chips" style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.5)', borderRadius: '4px', padding: 3, border: '1px solid rgba(255,255,255,0.05)' }}>
              {( [['all', `All (${products.length})`], ['active', `Active (${activeCount})`], ['hidden', `Hidden (${hiddenCount})`]] as [FilterMode, string][] ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  style={{
                    padding: '6px 14px', border: 'none', borderRadius: '4px', cursor: 'pointer',
                    fontSize: '0.78rem', fontWeight: 600, transition: 'all 0.2s',
                    background: filter === key ? 'rgba(0,229,255,0.1)' : 'transparent',
                    color: filter === key ? '#00E5FF' : 'rgba(255,255,255,0.4)',
                  }}
                >
                  {label}
                </button>
              ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Round 9: Mobile-only search bar (hidden on desktop via CSS) */}
      <input
        className="agentprod-mobile-search"
        type="search"
        placeholder="Search Products By Name..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          width: '100%',
          padding: '12px 14px',
          fontSize: '0.95rem',
          background: 'linear-gradient(180deg, #0b0f16 0%, #121822 100%)',
          border: '1px solid rgba(0,0,0,0.8)',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)',
          color: '#fff',
          borderRadius: 8,
        }}
      />

      {/* Bulk Margin */}
      <div className="metal-frame">
        <div className="metal-content" style={{ padding: 'var(--space-5)' }}>
          <h4 style={{ fontSize: '0.9rem', color: '#00E5FF', marginBottom: 'var(--space-3)', fontFamily: 'var(--font-brand)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bulk Margin Adjustment</h4>
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)' }}>Apply +</span>
            <input
              type="number"
              className="form-input"
              style={{ width: 80, padding: '4px 8px', height: 32, background: 'linear-gradient(180deg, #0b0f16 0%, #121822 100%)', border: '1px solid rgba(0,0,0,0.8)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)', color: '#fff' }}
              value={bulkMargin}
              onChange={e => setBulkMargin(e.target.value)}
            />
            <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)' }}>% Margin To All Products</span>
            <button
              className="btn-neon-cyan"
              onClick={handleBulkAdjust}
              disabled={bulkSaving}
              style={{ marginLeft: 'auto', padding: '6px 16px', fontSize: '0.8rem' }}
            >
              {bulkSaving ? 'Applying...' : 'Apply Bulk Margin'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="metal-embossed-panel" style={{ border: '1px solid rgba(229,62,62,0.3)', padding: 'var(--space-3)', fontSize: '0.85rem', color: '#FC8181' }}>
          {error}
        </div>
      )}

      {/* Flat alphabetical list (default) */}
      {effectiveViewMode === 'flat' && (
        <div className="metal-frame">
          <div className="metal-content" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'rgba(255,255,255,0.05)' }}>
            {searchFiltered.map((p, _idx) => {
              const displayName = p.custom_name || p.products.name;
              const isEditing = editingId === p.id;
              const sizeLabel = p.products.unit_size && p.products.unit_measure
                ? `${p.products.unit_size}${p.products.unit_measure}`
                : '';
              return (
                <div
                  key={p.id}
                  className="metal-embossed-panel"
                  style={{
                    padding: 'var(--space-4) var(--space-5)',
                    margin: 0,
                    borderRadius: 0,
                    borderLeft: 'none', borderRight: 'none',
                    opacity: p.is_visible ? 1 : 0.5,
                    transition: 'opacity 0.2s',
                  }}
                >
                  {isEditing ? (
                    <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>Custom Name</label>
                        <input type="text" className="form-input" style={{ background: 'linear-gradient(180deg, #0b0f16 0%, #121822 100%)', border: '1px solid rgba(0,0,0,0.8)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)', color: '#fff' }}
                          placeholder={p.products.name}
                          value={editForm.custom_name || ''}
                          onChange={e => setEditForm({ ...editForm, custom_name: e.target.value })} />
                      </div>

                      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end' }}>
                        <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                          <label className="form-label" style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>
                            Listed Price
                            <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.4)', marginLeft: 6, fontSize: '0.68rem' }}>$ / Vial</span>
                          </label>
                          <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#00E5FF', fontWeight: 700, fontSize: '0.9rem', pointerEvents: 'none' }}>$</span>
                            <input
                              type="number"
                              step="0.01"
                              min={p.agent_cost != null ? (p.agent_cost / 10).toFixed(2) : '0'}
                              className="form-input"
                              style={{ paddingLeft: 26, background: 'linear-gradient(180deg, #0b0f16 0%, #121822 100%)', border: '1px solid rgba(0,0,0,0.8)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)', color: '#fff' }}
                              placeholder={(Number(editForm.retail_price) / 10).toFixed(2)}
                              value={Number((editForm as any).retail_price) >= 0 ? (Number((editForm as any).retail_price) / 10).toFixed(2) : ''}
                              onChange={e => {
                                const perVial = parseFloat(e.target.value) || 0;
                                const per10 = perVial * 10;
                                const newMargin = p.agent_cost && p.agent_cost > 0
                                  ? Math.round((per10 / p.agent_cost - 1) * 100)
                                  : (editForm as any).margin_percent ?? 50;
                                setEditForm({ ...editForm, retail_price: per10, margin_percent: newMargin } as any);
                              }}
                            />
                          </div>
                          {p.agent_cost != null && p.agent_cost >= 0 && (
                            <p style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', marginTop: 3, marginBottom: 0 }}>
                              Min: <strong style={{ color: '#fff' }}>${(p.agent_cost / 10).toFixed(2)} / Vial</strong> (your cost)
                            </p>
                          )}
                        </div>

                        <div className="form-group" style={{ marginBottom: 0, flex: '0 0 130px' }}>
                          <label className="form-label" style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>
                            Markup
                            <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.4)', marginLeft: 5, fontSize: '0.68rem' }}>%</span>
                          </label>
                          <input
                            type="number"
                            step="1"
                            min="0"
                            className="form-input"
                            style={{ background: 'linear-gradient(180deg, #0b0f16 0%, #121822 100%)', border: '1px solid rgba(0,0,0,0.8)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)', color: '#fff' }}
                            placeholder="e.g. 50"
                            value={(editForm as any).margin_percent ?? 50}
                            onChange={e => {
                              const pct = Number(e.target.value);
                              const newPrice = p.agent_cost != null && p.agent_cost > 0
                                ? p.agent_cost * (1 + pct / 100)
                                : (editForm as any).retail_price;
                              setEditForm({ ...editForm, margin_percent: pct, retail_price: newPrice } as any);
                            }}
                          />
                        </div>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>Custom Description</label>
                        <textarea className="form-input" style={{ background: 'linear-gradient(180deg, #0b0f16 0%, #121822 100%)', border: '1px solid rgba(0,0,0,0.8)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)', color: '#fff' }} rows={2} placeholder={p.products.description || 'No Description'} value={editForm.custom_description || ''} onChange={e => setEditForm({ ...editForm, custom_description: e.target.value })} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)' }}>
                          <input
                            type="checkbox"
                            checked={(editForm as any).is_on_sale || false}
                            onChange={e => setEditForm({ ...editForm, is_on_sale: e.target.checked } as any)}
                            style={{ accentColor: '#00E5FF', width: 16, height: 16 }}
                          />
                          Mark On Sale
                        </label>
                        {(editForm as any).is_on_sale && (
                          <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 120 }}>
                            <label className="form-label" style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>Sale Price ($)</label>
                            <input type="number" step="0.01" className="form-input" style={{ background: 'linear-gradient(180deg, #0b0f16 0%, #121822 100%)', border: '1px solid rgba(0,0,0,0.8)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)', color: '#fff' }} placeholder="Sale price" value={(editForm as any).sale_price || ''} onChange={e => setEditForm({ ...editForm, sale_price: Number(e.target.value) || null } as any)} />
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 8 }}>
                        <button type="submit" disabled={saving} className="btn-neon-cyan" style={{ padding: '6px 16px', fontSize: '0.85rem' }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button type="button" onClick={() => setEditingId(null)} className="btn-silver" style={{ padding: '6px 16px', fontSize: '0.85rem' }}>Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <div className="agentprod-card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                      <img
                        src={p.custom_image_url || p.products.image_url || '/images/peptide_clear.png'}
                        alt={displayName}
                        style={{ width: 80, height: 80, borderRadius: 8, objectFit: 'cover', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}
                      />
                      <div className="agentprod-info" style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>{displayName}</span>
                          {sizeLabel && <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>{sizeLabel}</span>}
                          <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>{p.products.category}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          {p.agent_cost != null && p.agent_cost > 0 && (
                            <>
                              <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>Your Cost:</span>
                              <span style={{ fontSize: '0.82rem', color: '#68D391', fontWeight: 700 }}>
                                ${(p.agent_cost / 10).toFixed(2)} / Vial
                              </span>
                              <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)' }}>→</span>
                            </>
                          )}
                          <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>Listed:</span>
                          <span style={{ fontSize: '0.85rem', color: '#00E5FF', fontWeight: 800 }}>
                            ${(Number(p.retail_price) / 10).toFixed(2)} / Vial
                          </span>
                          {p.is_on_sale && p.sale_price && (
                            <span style={{ fontSize: '0.7rem', color: '#FC8181', fontWeight: 700, background: 'rgba(229,62,62,0.10)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(229,62,62,0.2)' }}>
                              On Sale ${(Number(p.sale_price) / 10).toFixed(2)} / Vial
                            </span>
                          )}
                          {p.agent_cost != null && p.agent_cost > 0 && p.retail_price > 0 && (
                            <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'rgba(0,229,255,0.1)', color: (p.retail_price / p.agent_cost - 1) >= 0.15 ? '#00E5FF' : '#00E5FF', border: '1px solid rgba(0,229,255,0.2)' }}>
                              +{Math.round((p.retail_price / p.agent_cost - 1) * 100)}%
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="agentprod-actions" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <button onClick={() => handleEdit(p)} className="btn-silver" style={{ width: 70, height: 32, minWidth: 70, minHeight: 32, padding: 0, fontSize: '0.78rem' }}>Edit</button>
                        <button
                          onClick={() => toggleVisibility(p)}
                          style={{ width: 70, height: 32, minWidth: 70, minHeight: 32, borderRadius: 16, border: '1px solid rgba(0,0,0,0.45)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', background: p.is_visible ? '#00E5FF' : 'rgba(255,255,255,0.12)', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.45)' }}
                          title={p.is_visible ? 'On — Tap To Hide' : 'Off — Tap To Show'}
                          aria-label={p.is_visible ? 'Visibility On' : 'Visibility Off'}
                          aria-checked={p.is_visible}
                          role="switch"
                        >
                          <span style={{ position: 'absolute', top: 5, left: p.is_visible ? 43 : 5, width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.5)' }} />
                          <span style={{ position: 'absolute', top: 9, left: p.is_visible ? 12 : 34, fontSize: '0.62rem', fontWeight: 800, color: p.is_visible ? '#063A47' : 'rgba(255,255,255,0.6)', letterSpacing: '0.04em', pointerEvents: 'none' }}>
                            {p.is_visible ? 'ON' : 'OFF'}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          </div>
        </div>
      )}

      {/* By Category view */}
      {effectiveViewMode === 'category' && sortedCategories.map(category => {
        const catProducts = grouped[category];
        const isExpanded = expandedCategories.has(category);
        const catActiveCount = catProducts.filter(p => p.is_visible).length;

        return (
          <div key={category} className="metal-frame" style={{ padding: 0 }}>
            <div className="metal-content" style={{ padding: 0, overflow: 'hidden' }}>
              <button
                onClick={() => toggleCategory(category)}
                style={{
                  width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '16px 20px', background: 'transparent', border: 'none', cursor: 'pointer',
                  borderBottom: isExpanded ? '1px solid rgba(255,255,255,0.06)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <span style={{ color: '#00E5FF', fontSize: '0.8rem', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>▶</span>
                  <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', fontFamily: 'var(--font-brand)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{category}</span>
                  <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(0,229,255,0.1)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.2)' }}>
                    {catActiveCount}/{catProducts.length} Active
                  </span>
                </div>
              </button>

              {isExpanded && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'rgba(255,255,255,0.05)' }}>
                  {catProducts.map((p) => {
                    const displayName = p.custom_name || p.products.name;
                    const isEditing = editingId === p.id;
                    const sizeLabel = p.products.unit_size && p.products.unit_measure
                      ? `${p.products.unit_size}${p.products.unit_measure}`
                      : '';

                    return (
                      <div
                        key={p.id}
                        className="metal-embossed-panel"
                        style={{
                          padding: 'var(--space-4) var(--space-5)',
                          margin: 0, borderRadius: 0,
                          borderLeft: 'none', borderRight: 'none',
                          opacity: p.is_visible ? 1 : 0.5,
                          transition: 'opacity 0.2s',
                        }}
                      >
                        {isEditing ? (
                          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label" style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>Custom Name</label>
                              <input type="text" className="form-input" style={{ background: 'linear-gradient(180deg, #0b0f16 0%, #121822 100%)', border: '1px solid rgba(0,0,0,0.8)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)', color: '#fff' }}
                                placeholder={p.products.name}
                                value={editForm.custom_name || ''}
                                onChange={e => setEditForm({ ...editForm, custom_name: e.target.value })} />
                            </div>

                            <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end' }}>
                              <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                                <label className="form-label" style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>
                                  Listed Price
                                  <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.4)', marginLeft: 6, fontSize: '0.68rem' }}>$ / Vial</span>
                                </label>
                                <div style={{ position: 'relative' }}>
                                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#00E5FF', fontWeight: 700, fontSize: '0.9rem', pointerEvents: 'none' }}>$</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min={p.agent_cost != null ? (p.agent_cost / 10).toFixed(2) : '0'}
                                    className="form-input"
                                    style={{ paddingLeft: 26, background: 'linear-gradient(180deg, #0b0f16 0%, #121822 100%)', border: '1px solid rgba(0,0,0,0.8)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)', color: '#fff' }}
                                    placeholder={(Number(editForm.retail_price) / 10).toFixed(2)}
                                    value={Number((editForm as any).retail_price) >= 0 ? (Number((editForm as any).retail_price) / 10).toFixed(2) : ''}
                                    onChange={e => {
                                      const perVial = parseFloat(e.target.value) || 0;
                                      const per10 = perVial * 10;
                                      const newMargin = p.agent_cost && p.agent_cost > 0
                                        ? Math.round((per10 / p.agent_cost - 1) * 100)
                                        : (editForm as any).margin_percent ?? 50;
                                      setEditForm({ ...editForm, retail_price: per10, margin_percent: newMargin } as any);
                                    }}
                                  />
                                </div>
                                {p.agent_cost != null && p.agent_cost > 0 && (
                                  <p style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', marginTop: 3, marginBottom: 0 }}>
                                    Min: <strong style={{ color: '#fff' }}>${(p.agent_cost / 10).toFixed(2)} / Vial</strong> (your cost)
                                  </p>
                                )}
                              </div>
                              <div className="form-group" style={{ marginBottom: 0, flex: '0 0 130px' }}>
                                <label className="form-label" style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>
                                  Markup
                                  <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.4)', marginLeft: 5, fontSize: '0.68rem' }}>%</span>
                                </label>
                                <input
                                  type="number"
                                  step="1"
                                  min="0"
                                  className="form-input"
                                  style={{ background: 'linear-gradient(180deg, #0b0f16 0%, #121822 100%)', border: '1px solid rgba(0,0,0,0.8)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)', color: '#fff' }}
                                  placeholder="e.g. 50"
                                  value={(editForm as any).margin_percent ?? 50}
                                  onChange={e => {
                                    const pct = Number(e.target.value);
                                    const newPrice = p.agent_cost != null && p.agent_cost > 0
                                      ? p.agent_cost * (1 + pct / 100)
                                      : (editForm as any).retail_price;
                                    setEditForm({ ...editForm, margin_percent: pct, retail_price: newPrice } as any);
                                  }}
                                />
                              </div>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label" style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>Custom Description</label>
                              <textarea className="form-input" style={{ background: 'linear-gradient(180deg, #0b0f16 0%, #121822 100%)', border: '1px solid rgba(0,0,0,0.8)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)', color: '#fff' }} rows={2} placeholder={p.products.description || 'No Description'} value={editForm.custom_description || ''} onChange={e => setEditForm({ ...editForm, custom_description: e.target.value })} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)' }}>
                                <input type="checkbox" checked={(editForm as any).is_on_sale || false} onChange={e => setEditForm({ ...editForm, is_on_sale: e.target.checked } as any)} style={{ accentColor: '#00E5FF', width: 16, height: 16 }} />
                                Mark On Sale
                              </label>
                              {(editForm as any).is_on_sale && (
                                <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 120 }}>
                                  <label className="form-label" style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>Sale Price ($)</label>
                                  <input type="number" step="0.01" className="form-input" style={{ background: 'linear-gradient(180deg, #0b0f16 0%, #121822 100%)', border: '1px solid rgba(0,0,0,0.8)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)', color: '#fff' }} placeholder="Sale price" value={(editForm as any).sale_price || ''} onChange={e => setEditForm({ ...editForm, sale_price: Number(e.target.value) || null } as any)} />
                                </div>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 8 }}>
                              <button type="submit" disabled={saving} className="btn-neon-cyan" style={{ padding: '6px 16px', fontSize: '0.85rem' }}>{saving ? 'Saving...' : 'Save'}</button>
                              <button type="button" onClick={() => setEditingId(null)} className="btn-silver" style={{ padding: '6px 16px', fontSize: '0.85rem' }}>Cancel</button>
                            </div>
                          </form>
                        ) : (
                          <div className="agentprod-card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                            <img src={p.custom_image_url || p.products.image_url || '/images/peptide_clear.png'} alt={displayName} style={{ width: 80, height: 80, borderRadius: 8, objectFit: 'cover', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }} />
                            <div className="agentprod-info" style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>{displayName}</span>
                                {sizeLabel && <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>{sizeLabel}</span>}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                {p.agent_cost != null && p.agent_cost > 0 && (
                                  <>
                                    <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>Your Cost:</span>
                                    <span style={{ fontSize: '0.82rem', color: '#68D391', fontWeight: 700 }}>${(p.agent_cost / 10).toFixed(2)} / Vial</span>
                                    <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)' }}>→</span>
                                  </>
                                )}
                                <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>Listed:</span>
                                <span style={{ fontSize: '0.85rem', color: '#00E5FF', fontWeight: 800 }}>${(Number(p.retail_price) / 10).toFixed(2)} / Vial</span>
                                {p.is_on_sale && p.sale_price && (
                                  <span style={{ fontSize: '0.7rem', color: '#FC8181', fontWeight: 700, background: 'rgba(229,62,62,0.10)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(229,62,62,0.2)' }}>
                                    On Sale ${(Number(p.sale_price) / 10).toFixed(2)} / Vial
                                  </span>
                                )}
                                {p.agent_cost != null && p.agent_cost > 0 && p.retail_price > 0 && (
                                  <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'rgba(0,229,255,0.1)', color: (p.retail_price / p.agent_cost - 1) >= 0.15 ? '#00E5FF' : '#00E5FF', border: '1px solid rgba(0,229,255,0.2)' }}>
                                    +{(Math.round((p.retail_price / p.agent_cost - 1) * 100))}%
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="agentprod-actions" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                              <button onClick={() => handleEdit(p)} className="btn-silver" style={{ width: 70, height: 32, minWidth: 70, minHeight: 32, padding: 0, fontSize: '0.78rem' }}>Edit</button>
                              <button
                                onClick={() => toggleVisibility(p)}
                                style={{ width: 70, height: 32, minWidth: 70, minHeight: 32, borderRadius: 16, border: '1px solid rgba(0,0,0,0.45)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', background: p.is_visible ? '#00E5FF' : 'rgba(255,255,255,0.12)', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.45)' }}
                                title={p.is_visible ? 'On — Tap To Hide' : 'Off — Tap To Show'}
                                aria-label={p.is_visible ? 'Visibility On' : 'Visibility Off'}
                                aria-checked={p.is_visible}
                                role="switch"
                              >
                                <span style={{ position: 'absolute', top: 5, left: p.is_visible ? 43 : 5, width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.5)' }} />
                                <span style={{ position: 'absolute', top: 9, left: p.is_visible ? 12 : 34, fontSize: '0.62rem', fontWeight: 800, color: p.is_visible ? '#063A47' : 'rgba(255,255,255,0.6)', letterSpacing: '0.04em', pointerEvents: 'none' }}>
                                  {p.is_visible ? 'ON' : 'OFF'}
                                </span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {searchFiltered.length === 0 && (
        <div className="metal-frame">
          <div className="metal-content" style={{ textAlign: 'center', padding: 'var(--space-8) 0' }}>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>No Products Match This Filter.</p>
          </div>
        </div>
      )}
    </div>
  );
}
