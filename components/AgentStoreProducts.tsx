'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AgentProductPatchSchema } from '@/lib/schemas/product';
import { toast } from 'sonner';
import { Loader2, Plus, GripVertical, Edit2 } from 'lucide-react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { getPopularName } from '@/lib/peptide-popular-names';

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
  min_retail_price?: number | null;
  max_margin_percent?: number | null;
  /** Average online research-vendor selling price, USD per single vial (market benchmark) */
  market_avg_price?: number | null;
  market_low_price?: number | null;
  market_high_price?: number | null;
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
  /** Your cost price from PNL (base_cost x tier multiplier, per 10 vials) */
  agent_cost: number | null;
  /** The agent's current tier key, e.g. 'tier_1' */
  agent_tier: string | null;
}

type FilterMode = 'all' | 'active' | 'hidden';

/**
 * Concrete edit-form state (previously `Partial<AgentProduct>` erased with
 * `as any` at every read/write, which let NaN money values slip past the
 * MAP/cost-floor guards -- all NaN comparisons are false).
 */
interface EditFormState {
  id?: string;
  custom_name?: string;
  custom_description?: string;
  custom_image_url?: string;
  retail_price?: number;
  margin_percent?: number;
  is_visible?: boolean;
  is_on_sale?: boolean;
  sale_price?: number | null;
}

/**
 * Market Intel strip: benchmarks THIS agent's tier-dynamic cost and listed
 * price against the researched average online selling price (per vial, July
 * 2026 snapshot across 2-4 research-peptide vendors). agent_cost already
 * reflects the agent's current tier multiplier or custom % markup, so the
 * comparison recomputes automatically whenever admin changes their pricing.
 * Market values are stored per single vial; Bac Water cards display per
 * 10-pack, so the benchmark is scaled to match the card's unit.
 */
function MarketIntel({ p, priceOverride }: { p: AgentProduct; priceOverride?: number }) {
  const rawAvg = p.products?.market_avg_price != null ? Number(p.products.market_avg_price) : null;
  if (rawAvg == null || rawAvg <= 0) return null;

  const isBacWater = /bac\.?\s*water/i.test(p.products?.name || '');
  const packFactor = isBacWater ? 10 : 1;
  const unitLabel = isBacWater ? '10x Vials' : 'Vial';
  const mktAvg = rawAvg * packFactor;
  const mktLow = p.products?.market_low_price != null ? Number(p.products.market_low_price) * packFactor : null;
  const mktHigh = p.products?.market_high_price != null ? Number(p.products.market_high_price) * packFactor : null;

  const listedPer10 = priceOverride != null ? Number(priceOverride) : Number(p.retail_price);
  const yourPrice = listedPer10 > 0 ? listedPer10 / (isBacWater ? 1 : 10) : null;
  const yourCost = p.agent_cost != null && p.agent_cost > 0 ? p.agent_cost / (isBacWater ? 1 : 10) : null;

  const vsPct = yourPrice != null && mktAvg > 0 ? Math.round((yourPrice / mktAvg - 1) * 100) : null;
  // Live profit at the CURRENT listed price (priceOverride carries the
  // in-progress edit), so this number updates dynamically as the price is
  // typed rather than showing a static profit-at-market-average figure.
  const currentProfit = yourCost != null && yourPrice != null ? yourPrice - yourCost : null;

  const below = vsPct != null && vsPct < -2;
  const above = vsPct != null && vsPct > 2;
  const badgeColor = above ? '#FC8181' : below ? '#68D391' : '#F6E05E';
  const badgeBg = above ? 'rgba(229,62,62,0.10)' : below ? 'rgba(104,211,145,0.10)' : 'rgba(246,224,94,0.10)';
  const badgeText = vsPct == null ? null : above ? `${vsPct}% Above Market` : below ? `${Math.abs(vsPct)}% Below Market` : 'At Market Price';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 6, padding: '5px 8px', background: 'rgba(246,224,94,0.04)', border: '1px solid rgba(246,224,94,0.12)', borderRadius: 6 }}>
      <span style={{ fontSize: '0.62rem', color: '#F6E05E', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Market Intel</span>
      <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.85)', fontWeight: 700 }}>
        Avg ${mktAvg.toFixed(2)} / {unitLabel}
      </span>
      {mktLow != null && mktHigh != null && (
        <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.45)' }}>
          Range ${mktLow.toFixed(0)}&ndash;${mktHigh.toFixed(0)}
        </span>
      )}
      {badgeText && (
        <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '1px 6px', borderRadius: 4, color: badgeColor, background: badgeBg, border: `1px solid ${badgeColor}33` }}>
          Your Price {badgeText}
        </span>
      )}
      {currentProfit != null && (
        <span style={{ fontSize: '0.68rem', color: currentProfit >= 0 ? 'var(--teal)' : '#FC8181', fontWeight: 700 }}>
          Current Profit: ${currentProfit.toFixed(2)} / {unitLabel}
        </span>
      )}
    </div>
  );
}

export default function AgentStoreProducts({ agentId, costLabel = 'Your Cost', unlimitedMargin = false }: { agentId: string; costLabel?: string; unlimitedMargin?: boolean }) {
  const [products, setProducts] = useState<AgentProduct[]>([]);
  const [bundles, setBundles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [viewMode, setViewMode] = useState<'flat' | 'category'>('flat');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>({});
  // Raw Text While Editing The Price So Typing Is Never Reformatted Mid-Keystroke.
  const [priceText, setPriceText] = useState('');
  const [saving, setSaving] = useState(false);
  const [bulkMargin, setBulkMargin] = useState('50');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
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
      fetch('/api/agent/bundles/effective').then(r => r.json()).then(d => {
        if (d.data) setBundles(d.data);
      }).catch(e => console.error("Error fetching bundles", e));
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
    if (!product.is_visible) {
      handleEdit(product);
    }
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
    const rowMargin = (p as AgentProduct & { margin_percent?: number | null }).margin_percent;
    const existingMargin = rowMargin != null
      ? Number(rowMargin)
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
    });
    const isBacInit = /bac\.?\s*water/i.test(p.products?.name || '');
    setPriceText(p.retail_price > 0 ? (p.retail_price / (isBacInit ? 1 : 10)).toFixed(2) : '');
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;

    // Schema-lock the payload BEFORE the money guards: NaN/Infinity in any
    // price or margin field is rejected here, so the floor comparisons below
    // always see real numbers. Guards are written fail-closed (`!(x >= y)`)
    // so an unexpected NaN can never sneak past a `<` check.
    const parsedForm = AgentProductPatchSchema.safeParse({ ...editForm, id: editingId });
    if (!parsedForm.success) {
      toast.error('Please Enter A Valid Price And Margin Before Saving.');
      return;
    }
    const listedPrice = parsedForm.data.retail_price ?? Number.NaN;
    const currentProduct = products.find(p => p.id === editingId);
    const agentCostPer10 = currentProduct?.agent_cost ?? 0;
    const minRetailPrice = currentProduct?.products?.min_retail_price ?? agentCostPer10;
    const maxMarginPercent = currentProduct?.products?.max_margin_percent ?? 300;

    if (!(listedPrice >= minRetailPrice)) {
      toast.error(`Listed Price Cannot Be Below The Minimum Advertised Price ($${(minRetailPrice / (/bac\.?\s*water/i.test(currentProduct?.products?.name || "") ? 1 : 10)).toFixed(2)} / Vial).`);
      return;
    }
    if (!(listedPrice >= agentCostPer10)) {
      toast.error(`Listed Price Cannot Be Below ${costLabel} ($${(agentCostPer10 / (/bac\.?\s*water/i.test(currentProduct?.products?.name || "") ? 1 : 10)).toFixed(2)} / Vial).`);
      return;
    }

    const marginVal = parsedForm.data.margin_percent;
    if (!unlimitedMargin && marginVal !== undefined && !(marginVal <= maxMarginPercent)) {
      toast.error(`Requested Margin Exceeds The Platform Maximum Of ${maxMarginPercent}%.`);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/agent/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsedForm.data),
      });
      if (!res.ok) {
        const json = await res.json();
        toast.error(json.error || 'Failed To Save');
      } else {
        await fetchProducts();
        setEditingId(null);
      }
    } catch (err: any) {
      toast.error(err.message || 'An Error Occurred');
    } finally {
      setSaving(false);
    }
  }

  async function handleBulkAdjust(marginOverride?: number) {
    const margin = marginOverride !== undefined ? marginOverride : parseFloat(bulkMargin);
    if (isNaN(margin) || margin < 0) {
      toast.error('Please Enter A Valid Margin Percentage');
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
      toast.error(err.message || 'An Error Occurred');
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

  const effectiveViewMode = isMobile ? 'category' : viewMode;
  const searchTerm = search.trim().toLowerCase();
  const searchFiltered = !searchTerm ? filtered : filtered.filter(p => {
    const name = (p.custom_name || p.products?.name || '').toLowerCase();
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
      <div className="glass-panel">
        <div className="" style={{ padding: 'var(--space-6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
            <div>
              <h3 className="metal-text" style={{ fontSize: '1.25rem', margin: 0, fontFamily: 'var(--font-brand)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Product Catalog Manager
              </h3>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem', margin: '4px 0 0' }}>
                Toggle Products On/Off, Reorder Them, Set Custom Prices And Descriptions.
              </p>
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

      {/* Search Bar */}
      <input
        type="search"
        placeholder="Search Products By Name..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          width: '100%',
          padding: '12px 14px',
          fontSize: '0.95rem',
          background: 'var(--bg-metal-dark)',
          border: '1px solid rgba(0,0,0,0.8)',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)',
          color: '#fff',
          borderRadius: 8,
          marginBottom: 'var(--space-4)'
        }}
      />

      {/* Pricing & Discounts Configuration */}
      <PricingConfig agentId={agentId} />

      {/* Master Reset / Bulk Margin */}
      <div className="glass-panel">
        <div className="" style={{ padding: 'var(--space-5)' }}>
          <h4 style={{ fontSize: '0.9rem', color: '#00E5FF', marginBottom: 'var(--space-2)', fontFamily: 'var(--font-brand)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Master Reset (Bulk Margin)</h4>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem', marginBottom: 'var(--space-4)', lineHeight: 1.4 }}>
            Apply a universal bulk margin percentage to all products. This will override existing custom margins and automatically mark up your direct cost, increasing the final displayed retail prices inside your store by this exact percentage.
            <br/><br/>
            <strong style={{ color: '#00E5FF' }}>Note:</strong> Any products that hit a Minimum Advertised Price (MAP) or Margin Ceiling will be automatically skipped to protect brand integrity.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)' }}>Apply +</span>
            <input
              type="number"
              className="form-input"
              style={{ width: 80, padding: '4px 8px', height: 32, background: 'var(--bg-metal-dark)', border: '1px solid rgba(0,0,0,0.8)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)', color: '#fff' }}
              value={bulkMargin}
              onChange={e => setBulkMargin(e.target.value)}
            />
            <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)' }}>% Margin To All Products</span>
            
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
              <button
                className="btn-silver"
                onClick={() => { setBulkMargin('50'); handleBulkAdjust(50); }}
                disabled={bulkSaving}
                style={{ padding: '6px 16px', fontSize: '0.8rem', height: 32 }}
              >
                Reset To Standard Pricing (50%)
              </button>
              <button
                className="btn-neon-cyan"
                onClick={() => handleBulkAdjust()}
                disabled={bulkSaving}
                style={{ padding: '6px 16px', fontSize: '0.8rem', height: 32 }}
              >
                {bulkSaving ? 'Applying...' : 'Apply Master Reset'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="glass-panel" style={{ border: '1px solid rgba(229,62,62,0.3)', padding: 'var(--space-3)', fontSize: '0.85rem', color: '#FC8181' }}>
          {error}
        </div>
      )}

      
      {/* Bundles Section */}
      {bundles.length > 0 && (
        <div className="glass-panel">
          <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <h4 style={{ fontSize: '1rem', color: '#00E5FF', margin: 0, fontFamily: 'var(--font-brand)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bundles</h4>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem', margin: '4px 0 0' }}>
              These are your active bundle offers. Bundles are managed in the Bundle Manager.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'rgba(255,255,255,0.05)' }}>
            {bundles.map(b => {
              const bCost = b.base_cost_total || 0;
              const bListRaw = b.custom_price != null ? b.custom_price : ((b.retail_value_total || 0) * (1 - (b.discount_percent || 0) / 100));
              const bList = Math.round(bListRaw * 100) / 100;
              const profit = bList - bCost;
              const margin = bList > 0 ? (profit / bCost) * 100 : 0;
              return (
                <div key={b.id} className="glass-panel" style={{ padding: 'var(--space-4) var(--space-5)', margin: 0, borderRadius: 0, borderLeft: 'none', borderRight: 'none' }}>
                  <div className="agentprod-card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                    <div style={{ width: 80, height: 80, borderRadius: 8, background: 'rgba(0,196,188,0.1)', border: '1px solid rgba(0,196,188,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#00E5FF', fontWeight: 800, fontSize: '0.8rem', textAlign: 'center', padding: 4 }}>
                      BUNDLE
                    </div>
                    <div className="agentprod-info" style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>{b.name}</span>
                        <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>Bundle</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
                        {b.product_ids.length} Products Included
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Cost:</span>
                          <span style={{ fontSize: '0.82rem', color: '#68D391', fontWeight: 700 }}>${bCost.toFixed(2)}</span>
                        </div>
                        <div style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.2)' }}>&rarr;</div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Listed Price:</span>
                          <span style={{ fontSize: '0.9rem', color: '#00E5FF', fontWeight: 700 }}>
                            ${bList.toFixed(2)}
                            {b.custom_price != null && <span style={{ fontSize: '0.65rem', marginLeft: 4, background: 'rgba(255,255,255,0.1)', padding: '2px 4px', borderRadius: 2 }}>Fixed</span>}
                          </span>
                        </div>
                        {bCost > 0 && bList > 0 && (
                          <div style={{ marginLeft: 8, padding: '2px 6px', background: 'rgba(0,196,188,0.1)', borderRadius: 4, border: '1px solid rgba(0,196,188,0.3)' }}>
                            <span style={{ fontSize: '0.7rem', color: '#00E5FF', fontWeight: 700 }}>+{Math.round(margin)}% Margin</span>
                          </div>
                        )}
                        <div style={{ marginLeft: 8, padding: '2px 6px', background: profit >= 0 ? 'rgba(104,211,145,0.1)' : 'rgba(229,62,62,0.1)', borderRadius: 4, border: profit >= 0 ? '1px solid rgba(104,211,145,0.3)' : '1px solid rgba(229,62,62,0.3)' }}>
                          <span style={{ fontSize: '0.7rem', color: profit >= 0 ? '#68D391' : '#FC8181', fontWeight: 700 }}>${profit.toFixed(2)} Profit</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Catalog View Controls */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-4)' }}>
        <div className="agentprod-view-toggle" style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.5)', borderRadius: '4px', padding: 4, border: '1px solid rgba(255,255,255,0.05)' }}>
          {( [['flat', 'All Products Alphabetical'], ['category', 'Sorted By Category']] as ['flat' | 'category', string][] ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setViewMode(key)}
              style={{ background: viewMode === key ? 'rgba(0,196,188,0.2)' : 'transparent', color: viewMode === key ? '#00E5FF' : '#fff', border: '1px solid', borderColor: viewMode === key ? 'rgba(0,196,188,0.4)' : 'transparent', padding: '6px 16px', fontSize: '0.85rem', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s', fontWeight: viewMode === key ? 600 : 400 }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {effectiveViewMode === 'flat' && (
        <div className="glass-panel">
          <div className="" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'rgba(255,255,255,0.05)' }}>
            {searchFiltered.map((p, _idx) => {
              const displayName = p.custom_name || p.products?.name || '';
              const isEditing = editingId === p.id;
              const sizeLabel = p.products?.unit_size && p.products?.unit_measure
                ? `${p.products.unit_size}${p.products.unit_measure}`
                : '';
              return (
                <div
                  key={p.id}
                  className="glass-panel"
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
                    <div className="agentprod-card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                      <Image
                        src={p.custom_image_url || p.products.image_url || '/images/peptide_clear.png'}
                        alt={displayName}
                        width={80}
                        height={80}
                        style={{ width: 80, height: 80, borderRadius: 8, objectFit: 'cover', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          if (!target.src.includes('/images/peptide_clear.png')) {
                            target.srcset = '';
                            target.src = '/images/peptide_clear.png';
                          }
                        }}
                        unoptimized
                      />
                      <div className="agentprod-info" style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>{displayName}</span>
                          {sizeLabel && <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>{sizeLabel}</span>}
                          <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>{p.products.category}</span>
                        </div>
                        {getPopularName(p.products.name) && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--teal)', fontStyle: 'italic', fontWeight: 500, marginBottom: 4 }}>
                            {getPopularName(p.products.name)}
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>{costLabel}:</span>
                            {p.agent_cost != null && p.agent_cost > 0 ? (
                              <span style={{ fontSize: '0.82rem', color: '#68D391', fontWeight: 700 }}>${(p.agent_cost / (/bac\.?\s*water/i.test(p.products?.name || "") ? 1 : 10)).toFixed(2)} / {/bac\.?\s*water/i.test(p.products?.name || "") ? "10x 10ml Vials" : "Vial"}</span>
                            ) : (
                              <span style={{ fontSize: '0.82rem', color: '#68D391', fontWeight: 700 }}>TBD</span>
                            )}
                          </div>
                          <div style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.2)' }}>&rarr;</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ position: 'relative' }}>
                              <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#00E5FF', fontWeight: 700, fontSize: '0.85rem', pointerEvents: 'none' }}>$</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                autoFocus
                                className="form-input"
                                style={{ width: 80, padding: '4px 4px 4px 18px', height: 28, fontSize: '0.85rem', background: 'var(--bg-metal-dark)', border: '1px solid #00E5FF', boxShadow: '0 0 5px rgba(0,229,255,0.3)', color: '#fff' }}
                                value={priceText}
                                onChange={e => {
                                  // Free Typing: Digits Plus One Decimal Point, Two Decimals Max.
                                  let clean = e.target.value.replace(/[^0-9.]/g, '');
                                  const dot = clean.indexOf('.');
                                  if (dot !== -1) {
                                    clean = clean.slice(0, dot + 1) + clean.slice(dot + 1).replace(/\./g, '');
                                    clean = clean.slice(0, dot + 3);
                                  }
                                  setPriceText(clean);
                                  const perVial = parseFloat(clean) || 0;
                                  const stored = perVial * (/bac\.?\s*water/i.test(p.products?.name || "") ? 1 : 10);
                                  const newMargin = p.agent_cost && p.agent_cost > 0 ? Math.round((stored / p.agent_cost - 1) * 100) : editForm.margin_percent ?? 50;
                                  setEditForm({ ...editForm, retail_price: stored, margin_percent: newMargin });
                                }}
                                onKeyDown={e => { if (e.key === 'Enter') handleSave(e as any); }}
                              />
                            </div>
                            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>/ {/bac\.?\s*water/i.test(p.products?.name || "") ? "10x 10ml Vials" : "Vial"}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(0,229,255,0.1)', padding: '2px 6px', borderRadius: 4, border: '1px solid rgba(0,229,255,0.3)' }}>
                              <span style={{ fontSize: '0.65rem', color: '#00E5FF', fontWeight: 700 }}>+</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                className="form-input"
                                style={{ width: 40, padding: 0, height: 20, fontSize: '0.75rem', background: 'transparent', border: 'none', color: '#00E5FF', fontWeight: 700, textAlign: 'center' }}
                                value={editForm.margin_percent ?? 50}
                                onChange={e => {
                                  const pct = Number(e.target.value.replace(/[^0-9-]/g, '')) || 0;
                                  const newPrice = p.agent_cost != null && p.agent_cost > 0 ? p.agent_cost * (1 + pct / 100) : editForm.retail_price;
                                  setEditForm({ ...editForm, margin_percent: pct, retail_price: newPrice });
                                  setPriceText(Number(newPrice) > 0 ? (Number(newPrice) / (/bac\.?\s*water/i.test(p.products?.name || "") ? 1 : 10)).toFixed(2) : '');
                                }}
                                onKeyDown={e => { if (e.key === 'Enter') handleSave(e as any); }}
                              />
                              <span style={{ fontSize: '0.65rem', color: '#00E5FF', fontWeight: 700 }}>%</span>
                            </div>
                            <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)' }}>
                              {unlimitedMargin ? 'No Margin Cap' : `Max: ${p.products?.max_margin_percent ?? 300}%`}
                            </span>
                          </div>
                        </div>
                        <MarketIntel p={p} priceOverride={Number(editForm.retail_price)} />
                      </div>
                      <div className="agentprod-actions" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <button onClick={handleSave} disabled={saving} className="btn-neon-cyan" style={{ padding: '4px 12px', fontSize: '0.75rem', height: 32 }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button onClick={() => setEditingId(null)} className="btn-silver" style={{ padding: '4px 12px', fontSize: '0.75rem', height: 32 }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="agentprod-card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                      <Image
                        src={p.custom_image_url || p.products.image_url || '/images/peptide_clear.png'}
                        alt={displayName}
                        width={80}
                        height={80}
                        unoptimized
                        style={{ width: 80, height: 80, borderRadius: 8, objectFit: 'cover', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}
                        onError={(e) => { (e.target as any).src = '/images/peptide_clear.png'; }}
                      />
                      <div className="agentprod-info" style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>{displayName}</span>
                          {sizeLabel && <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>{sizeLabel}</span>}
                          <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>{p.products.category}</span>
                        </div>
                        {getPopularName(p.products.name) && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--teal)', fontStyle: 'italic', fontWeight: 500, marginBottom: 4 }}>
                            {getPopularName(p.products.name)}
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>{costLabel}:</span>
                            {p.agent_cost != null && p.agent_cost > 0 ? (
                              <span style={{ fontSize: '0.82rem', color: '#68D391', fontWeight: 700 }}>${(p.agent_cost / (/bac\.?\s*water/i.test(p.products?.name || "") ? 1 : 10)).toFixed(2)} / {/bac\.?\s*water/i.test(p.products?.name || "") ? "10x 10ml Vials" : "Vial"}</span>
                            ) : (
                              <span style={{ fontSize: '0.82rem', color: '#68D391', fontWeight: 700 }}>TBD</span>
                            )}
                          </div>
                          <div style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.2)' }}>&rarr;</div>
                          <div style={{ display: 'flex', flexDirection: 'column', cursor: 'pointer', padding: '6px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)', transition: 'all 0.2s' }} onClick={() => handleEdit(p)} title="Click to edit price" onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = 'rgba(0,229,255,0.3)'; }} onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; }}>
                            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                              Listed Price <Edit2 size={10} color="#00E5FF" />
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: '1.05rem', color: '#00E5FF', fontWeight: 800 }}>${(Number(p.retail_price) / (/bac\.?\s*water/i.test(p.products?.name || "") ? 1 : 10)).toFixed(2)} <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'rgba(255,255,255,0.4)' }}>/ {/bac\.?\s*water/i.test(p.products?.name || "") ? "10x 10ml Vials" : "Vial"}</span></span>
                              {p.agent_cost != null && p.agent_cost > 0 && p.retail_price > 0 && (
                                <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', background: 'rgba(0,229,255,0.1)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.2)' }}>
                                  {p.retail_price >= p.agent_cost ? '+' : ''}{Math.round((p.retail_price / p.agent_cost - 1) * 100)}%
                                </span>
                              )}
                            </div>
                          </div>
                          {p.is_on_sale && p.sale_price && (
                            <span style={{ fontSize: '0.7rem', color: '#FC8181', fontWeight: 700, background: 'rgba(229,62,62,0.10)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(229,62,62,0.2)' }}>
                              On Sale ${(Number(p.sale_price) / (/bac\.?\s*water/i.test(p.products?.name || "") ? 1 : 10)).toFixed(2)} / {/bac\.?\s*water/i.test(p.products?.name || "") ? "10x 10ml Vials" : "Vial"}
                            </span>
                          )}
                        </div>
                        <MarketIntel p={p} />
                      </div>
                      <div className="agentprod-actions" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <button
                          onClick={() => toggleVisibility(p)}
                          style={{ width: 70, height: 32, minWidth: 70, minHeight: 32, borderRadius: 16, border: '1px solid rgba(0,0,0,0.45)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', background: p.is_visible ? '#00E5FF' : 'rgba(255,255,255,0.12)', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.45)' }}
                          title={p.is_visible ? 'On - Tap To Hide' : 'Off - Tap To Show'}
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
          <div key={category} className="glass-panel" style={{ padding: 0 }}>
            <div className="" style={{ padding: 0, overflow: 'hidden' }}>
              <button
                onClick={() => toggleCategory(category)}
                style={{
                  width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '16px 20px', background: 'transparent', border: 'none', cursor: 'pointer',
                  borderBottom: isExpanded ? '1px solid rgba(255,255,255,0.06)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <span style={{ color: '#00E5FF', fontSize: '0.8rem', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>&#9658;</span>
                  <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', fontFamily: 'var(--font-brand)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{category}</span>
                  <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(0,229,255,0.1)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.2)' }}>
                    {catActiveCount}/{catProducts.length} Active
                  </span>
                </div>
              </button>

              {isExpanded && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'rgba(255,255,255,0.05)' }}>
                  {catProducts.map((p) => {
                    const displayName = p.custom_name || p.products?.name || '';
                    const isEditing = editingId === p.id;
                    const sizeLabel = p.products?.unit_size && p.products?.unit_measure
                      ? `${p.products.unit_size}${p.products.unit_measure}`
                      : '';

                    return (
                <div
                  key={p.id}
                  className="glass-panel"
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
                    <div className="agentprod-card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                      <Image
                        src={p.custom_image_url || p.products.image_url || '/images/peptide_clear.png'}
                        alt={displayName}
                        width={80}
                        height={80}
                        unoptimized
                        style={{ width: 80, height: 80, borderRadius: 8, objectFit: 'cover', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}
                        onError={(e) => { (e.target as any).src = '/images/peptide_clear.png'; }}
                      />
                      <div className="agentprod-info" style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>{displayName}</span>
                          {sizeLabel && <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>{sizeLabel}</span>}
                          <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>{p.products.category}</span>
                        </div>
                        {getPopularName(p.products.name) && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--teal)', fontStyle: 'italic', fontWeight: 500, marginBottom: 4 }}>
                            {getPopularName(p.products.name)}
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>{costLabel}:</span>
                            {p.agent_cost != null && p.agent_cost > 0 ? (
                              <span style={{ fontSize: '0.82rem', color: '#68D391', fontWeight: 700 }}>${(p.agent_cost / (/bac\.?\s*water/i.test(p.products?.name || "") ? 1 : 10)).toFixed(2)} / {/bac\.?\s*water/i.test(p.products?.name || "") ? "10x 10ml Vials" : "Vial"}</span>
                            ) : (
                              <span style={{ fontSize: '0.82rem', color: '#68D391', fontWeight: 700 }}>TBD</span>
                            )}
                          </div>
                          <div style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.2)' }}>&rarr;</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ position: 'relative' }}>
                              <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#00E5FF', fontWeight: 700, fontSize: '0.85rem', pointerEvents: 'none' }}>$</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                autoFocus
                                className="form-input"
                                style={{ width: 80, padding: '4px 4px 4px 18px', height: 28, fontSize: '0.85rem', background: 'var(--bg-metal-dark)', border: '1px solid #00E5FF', boxShadow: '0 0 5px rgba(0,229,255,0.3)', color: '#fff' }}
                                value={priceText}
                                onChange={e => {
                                  // Free Typing: Digits Plus One Decimal Point, Two Decimals Max.
                                  let clean = e.target.value.replace(/[^0-9.]/g, '');
                                  const dot = clean.indexOf('.');
                                  if (dot !== -1) {
                                    clean = clean.slice(0, dot + 1) + clean.slice(dot + 1).replace(/\./g, '');
                                    clean = clean.slice(0, dot + 3);
                                  }
                                  setPriceText(clean);
                                  const perVial = parseFloat(clean) || 0;
                                  const stored = perVial * (/bac\.?\s*water/i.test(p.products?.name || "") ? 1 : 10);
                                  const newMargin = p.agent_cost && p.agent_cost > 0 ? Math.round((stored / p.agent_cost - 1) * 100) : editForm.margin_percent ?? 50;
                                  setEditForm({ ...editForm, retail_price: stored, margin_percent: newMargin });
                                }}
                                onKeyDown={e => { if (e.key === 'Enter') handleSave(e as any); }}
                              />
                            </div>
                            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>/ {/bac\.?\s*water/i.test(p.products?.name || "") ? "10x 10ml Vials" : "Vial"}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(0,229,255,0.1)', padding: '2px 6px', borderRadius: 4, border: '1px solid rgba(0,229,255,0.3)' }}>
                              <span style={{ fontSize: '0.65rem', color: '#00E5FF', fontWeight: 700 }}>+</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                className="form-input"
                                style={{ width: 40, padding: 0, height: 20, fontSize: '0.75rem', background: 'transparent', border: 'none', color: '#00E5FF', fontWeight: 700, textAlign: 'center' }}
                                value={editForm.margin_percent ?? 50}
                                onChange={e => {
                                  const pct = Number(e.target.value.replace(/[^0-9-]/g, '')) || 0;
                                  const newPrice = p.agent_cost != null && p.agent_cost > 0 ? p.agent_cost * (1 + pct / 100) : editForm.retail_price;
                                  setEditForm({ ...editForm, margin_percent: pct, retail_price: newPrice });
                                  setPriceText(Number(newPrice) > 0 ? (Number(newPrice) / (/bac\.?\s*water/i.test(p.products?.name || "") ? 1 : 10)).toFixed(2) : '');
                                }}
                                onKeyDown={e => { if (e.key === 'Enter') handleSave(e as any); }}
                              />
                              <span style={{ fontSize: '0.65rem', color: '#00E5FF', fontWeight: 700 }}>%</span>
                            </div>
                            <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)' }}>
                              {unlimitedMargin ? 'No Margin Cap' : `Max: ${p.products?.max_margin_percent ?? 300}%`}
                            </span>
                          </div>
                        </div>
                        <MarketIntel p={p} priceOverride={Number(editForm.retail_price)} />
                      </div>
                      <div className="agentprod-actions" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <button onClick={handleSave} disabled={saving} className="btn-neon-cyan" style={{ padding: '4px 12px', fontSize: '0.75rem', height: 32 }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button onClick={() => setEditingId(null)} className="btn-silver" style={{ padding: '4px 12px', fontSize: '0.75rem', height: 32 }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="agentprod-card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                      <Image
                        src={p.custom_image_url || p.products.image_url || '/images/peptide_clear.png'}
                        alt={displayName}
                        width={80}
                        height={80}
                        unoptimized
                        style={{ width: 80, height: 80, borderRadius: 8, objectFit: 'cover', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}
                        onError={(e) => { (e.target as any).src = '/images/peptide_clear.png'; }}
                      />
                      <div className="agentprod-info" style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>{displayName}</span>
                          {sizeLabel && <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>{sizeLabel}</span>}
                          <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>{p.products.category}</span>
                        </div>
                        {getPopularName(p.products.name) && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--teal)', fontStyle: 'italic', fontWeight: 500, marginBottom: 4 }}>
                            {getPopularName(p.products.name)}
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>{costLabel}:</span>
                            {p.agent_cost != null && p.agent_cost > 0 ? (
                              <span style={{ fontSize: '0.82rem', color: '#68D391', fontWeight: 700 }}>${(p.agent_cost / (/bac\.?\s*water/i.test(p.products?.name || "") ? 1 : 10)).toFixed(2)} / {/bac\.?\s*water/i.test(p.products?.name || "") ? "10x 10ml Vials" : "Vial"}</span>
                            ) : (
                              <span style={{ fontSize: '0.82rem', color: '#68D391', fontWeight: 700 }}>TBD</span>
                            )}
                          </div>
                          <div style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.2)' }}>&rarr;</div>
                          <div style={{ display: 'flex', flexDirection: 'column', cursor: 'pointer', padding: '6px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)', transition: 'all 0.2s' }} onClick={() => handleEdit(p)} title="Click to edit price" onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = 'rgba(0,229,255,0.3)'; }} onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; }}>
                            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                              Listed Price <Edit2 size={10} color="#00E5FF" />
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: '1.05rem', color: '#00E5FF', fontWeight: 800 }}>${(Number(p.retail_price) / (/bac\.?\s*water/i.test(p.products?.name || "") ? 1 : 10)).toFixed(2)} <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'rgba(255,255,255,0.4)' }}>/ {/bac\.?\s*water/i.test(p.products?.name || "") ? "10x 10ml Vials" : "Vial"}</span></span>
                              {p.agent_cost != null && p.agent_cost > 0 && p.retail_price > 0 && (
                                <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', background: 'rgba(0,229,255,0.1)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.2)' }}>
                                  {p.retail_price >= p.agent_cost ? '+' : ''}{Math.round((p.retail_price / p.agent_cost - 1) * 100)}%
                                </span>
                              )}
                            </div>
                          </div>
                          {p.is_on_sale && p.sale_price && (
                            <span style={{ fontSize: '0.7rem', color: '#FC8181', fontWeight: 700, background: 'rgba(229,62,62,0.10)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(229,62,62,0.2)' }}>
                              On Sale ${(Number(p.sale_price) / (/bac\.?\s*water/i.test(p.products?.name || "") ? 1 : 10)).toFixed(2)} / {/bac\.?\s*water/i.test(p.products?.name || "") ? "10x 10ml Vials" : "Vial"}
                            </span>
                          )}
                        </div>
                        <MarketIntel p={p} />
                      </div>
                      <div className="agentprod-actions" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <button
                          onClick={() => toggleVisibility(p)}
                          style={{ width: 70, height: 32, minWidth: 70, minHeight: 32, borderRadius: 16, border: '1px solid rgba(0,0,0,0.45)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', background: p.is_visible ? '#00E5FF' : 'rgba(255,255,255,0.12)', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.45)' }}
                          title={p.is_visible ? 'On - Tap To Hide' : 'Off - Tap To Show'}
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
        <div className="glass-panel">
          <div className="" style={{ textAlign: 'center', padding: 'var(--space-8) 0' }}>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>No Products Match This Filter.</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* Pricing Config Sub-Component */
function PricingConfig({ agentId }: { agentId: string }) {
  const supabase = createClient();
  const [loaded, setLoaded] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // Dynamic Pricing (Small-Order Surcharges) Was Removed Platform-Wide And
  // Replaced By Fixed Per-Peptide Quantity Discounts:
  // 3-4 Vials 10% Off, 5-6 Vials 15% Off, 7+ Vials 20% Off.
  const [minOrderQty, setMinOrderQty] = React.useState(1);
  const [minOverallQty, setMinOverallQty] = React.useState(3);

  const [enableBulk, setEnableBulk] = React.useState(true);
  const [bulkTiers, setBulkTiers] = React.useState([
    { min_qty: 100, discount_percent: 5 },
    { min_qty: 300, discount_percent: 10 },
    { min_qty: 500, discount_percent: 15 },
  ]);

  React.useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('agent_profiles')
        .select('min_order_qty, min_overall_qty, enable_bulk_discounts, bulk_discount_tiers')
        .eq('id', agentId)
        .maybeSingle();
      if (data) {
        if (data.min_order_qty != null) setMinOrderQty(data.min_order_qty);
        if (data.min_overall_qty != null) setMinOverallQty(data.min_overall_qty);
        if (data.enable_bulk_discounts != null) setEnableBulk(data.enable_bulk_discounts);
        if (data.bulk_discount_tiers) setBulkTiers(data.bulk_discount_tiers as any);
      }
      setLoaded(true);
    })();
  }, [agentId]);

  const [showBulkExplain, setShowBulkExplain] = React.useState(false);
  const [showConfig, setShowConfig] = React.useState(false);

  async function handleSave() {
    setSaving(true);
    const { error } = await supabase
      .from('agent_profiles')
      .update({
        min_order_qty: minOrderQty,
        min_overall_qty: minOverallQty,
        enable_bulk_discounts: enableBulk,
        bulk_discount_tiers: bulkTiers,
      })
      .eq('id', agentId);
    setSaving(false);
    if (error) toast.error('Failed To Save Pricing Config');
    else toast.success('Pricing Configuration Saved');
  }

  if (!loaded) return <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--grey-400)' }}>Loading Pricing Config...</div>;

  const toggleStyle = (on: boolean): React.CSSProperties => ({
    width: 44, height: 24, borderRadius: 12, background: on ? 'var(--teal)' : 'var(--surface-3)',
    border: '1px solid rgba(255,255,255,0.1)', position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
  });
  const toggleDot = (on: boolean): React.CSSProperties => ({
    position: 'absolute', top: 2, left: on ? 22 : 2, width: 18, height: 18, borderRadius: '50%',
    background: 'var(--black)', transition: 'left 0.2s',
  });

  return (
    <div className="glass-panel" style={{ marginBottom: 'var(--space-4)', padding: 0, overflow: 'hidden' }}>
      <div 
        onClick={() => setShowConfig(!showConfig)} 
        style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'transparent', cursor: 'pointer' }}
      >
        <h3 className="metal-text" style={{ fontSize: '1.1rem', margin: 0, fontFamily: 'var(--font-brand)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: '#00E5FF', fontSize: '0.8rem', transform: showConfig ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>&#9658;</span>
          Bulk Discounts & Dynamic Pricing
        </h3>
        <span style={{ fontSize: '0.75rem', color: 'var(--grey-400)' }}>{showConfig ? 'Click To Collapse' : 'Click To Expand And Configure'}</span>
      </div>

      {showConfig && (
        <div style={{ padding: 'var(--space-5) var(--space-8) var(--space-8)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem', marginBottom: 'var(--space-2)' }}>
            Configure Quantity-Based Pricing For Your Storefront.
          </p>
          
          <div style={{ background: 'rgba(0,196,188,0.08)', border: '1px solid rgba(0,196,188,0.2)', padding: '12px 16px', borderRadius: 8, marginBottom: 'var(--space-6)', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            <div>
              <h5 style={{ color: 'var(--teal)', fontSize: '0.9rem', margin: '0 0 4px 0' }}>Agent Direct Pricing Note</h5>
              <p style={{ color: 'var(--silver)', fontSize: '0.85rem', margin: 0, lineHeight: 1.5 }}>
                When You Are Logged In And Ordering Products For Yourself, You Will Automatically Receive Your Direct Wholesale Base Cost At Checkout, Regardless Of These Storefront Pricing Configurations.
              </p>
            </div>
          </div>

          {/* Order Minimums + Quantity Discounts (Replaces Dynamic Pricing) */}
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <h4 style={{ color: '#fff', fontSize: '1.05rem', marginBottom: 4 }}>Order Minimums</h4>
            <p style={{ fontSize: '0.82rem', color: 'var(--grey-400)', margin: '0 0 var(--space-4)' }}>Minimum Quantities Required To Check Out From Your Store</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap', marginBottom: 'var(--space-5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--grey-400)' }}>Per-Peptide Minimum Qty:</span>
                <input type="number" min={1} className="form-input" style={{ width: 70, padding: '4px 8px', height: 32 }}
                  value={minOrderQty} onChange={e => setMinOrderQty(Number(e.target.value) || 1)} />
              </div>
              <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.1)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--grey-400)' }}>Overall Order Minimum Qty:</span>
                <input type="number" min={1} className="form-input" style={{ width: 70, padding: '4px 8px', height: 32 }}
                  value={minOverallQty} onChange={e => setMinOverallQty(Number(e.target.value) || 1)} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <div>
                <h4 style={{ color: '#fff', fontSize: '1.05rem', margin: 0 }}>Quantity Discounts</h4>
                <p style={{ fontSize: '0.82rem', color: 'var(--grey-400)', margin: '4px 0 0' }}>Standard Per-Peptide Volume Discounts. Applied Automatically At Checkout To The Same Peptide, Never Across Different Peptides.</p>
              </div>
              <div style={{ padding: '4px 12px', background: 'rgba(0,196,188,0.1)', color: 'var(--teal)', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600, border: '1px solid rgba(0,196,188,0.2)', whiteSpace: 'nowrap' }}>
                ALWAYS ON
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 8 }}>
                <span style={{ color: 'var(--grey-300)' }}>3-4 Vials Of The Same Peptide</span>
                <strong style={{ color: '#68D391' }}>10% Off</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 8 }}>
                <span style={{ color: 'var(--grey-300)' }}>5-6 Vials Of The Same Peptide</span>
                <strong style={{ color: '#68D391' }}>15% Off</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 8 }}>
                <span style={{ color: 'var(--grey-300)' }}>7+ Vials Of The Same Peptide</span>
                <strong style={{ color: '#68D391' }}>20% Off</strong>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" onClick={handleSave} className="btn-neon-cyan" disabled={saving} style={{ padding: '8px 24px' }}>
              {saving ? 'Saving...' : 'Save Pricing Config'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
