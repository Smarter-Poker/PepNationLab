'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

const CATEGORIES = [
  'Peptides',
  'Research Chemicals',
  'Nootropics',
  'Growth Factors',
  'Amino Acids',
  'Other',
];

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [multipliers, setMultipliers] = useState<Record<string, number>>({
    tier_1: 5.0,
    tier_2: 6.0,
    tier_3: 7.0,
  });

  const [form, setForm] = useState({
    name: '',
    sku: '',
    category: 'Peptides',
    description: '',
    base_cost: '',
    unit_size: '',
    unit_measure: 'mg',
    inventory_count: '0',
    low_stock_threshold: '5',
    backorder_days: '14',
    is_active: true,
  });

  // Fetch real multipliers and product details on mount
  useEffect(() => {
    if (!id) return;

    // 1. Fetch Multipliers
    fetch('/api/admin/pricing-tiers')
      .then(r => r.json())
      .then(data => {
        if (data && Array.isArray(data)) {
          const m: Record<string, number> = {};
          data.forEach((t: { tier_name: string; multiplier: number }) => {
            m[t.tier_name] = t.multiplier;
          });
          setMultipliers(m);
        }
      })
      .catch(() => {/* Keep Defaults On Error */});

    // 2. Fetch Product Info
    fetch(`/api/admin/products?id=${id}`)
      .then(async r => {
        if (!r.ok) {
          const data = await r.json();
          throw new Error(data.error ?? 'Failed To Fetch Product Details');
        }
        return r.json();
      })
      .then(product => {
        setForm({
          name: product.name || '',
          sku: product.sku || '',
          category: product.category || 'Peptides',
          description: product.description || '',
          base_cost: product.base_cost !== undefined ? String(product.base_cost) : '',
          unit_size: product.unit_size !== undefined ? String(product.unit_size) : '',
          unit_measure: product.unit_measure || 'mg',
          inventory_count: product.inventory_count !== undefined ? String(product.inventory_count) : '0',
          low_stock_threshold: product.low_stock_threshold !== undefined ? String(product.low_stock_threshold) : '5',
          backorder_days: product.backorder_days !== undefined ? String(product.backorder_days) : '14',
          is_active: product.is_active ?? true,
        });
        setLoading(false);
      })
      .catch(err => {
        setError(err.message ?? 'An Error Occurred While Loading Product Details');
        setLoading(false);
      });
  }, [id]);

  function set(field: string, val: string | boolean) {
    setForm(prev => ({ ...prev, [field]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);

    const res = await fetch('/api/admin/products', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        name: form.name,
        sku: form.sku || null,
        category: form.category,
        description: form.description || null,
        base_cost: parseFloat(form.base_cost),
        unit_size: form.unit_size || null,
        unit_measure: form.unit_measure,
        inventory_count: parseInt(form.inventory_count, 10) || 0,
        low_stock_threshold: parseInt(form.low_stock_threshold, 10) || 5,
        backorder_days: parseInt(form.backorder_days, 10) || 14,
        is_active: form.is_active,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Failed To Save Product');
      setSaving(false);
      return;
    }

    router.push('/admin/products');
    router.refresh();
  }

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
        <p style={{ color: 'var(--teal)', fontSize: '1.1rem', fontWeight: 600 }}>
          Loading Product Details...
        </p>
      </div>
    );
  }

  const baseCost = parseFloat(form.base_cost);
  const validCost = form.base_cost && !isNaN(baseCost);
  const invCount = parseInt(form.inventory_count, 10) || 0;

  return (
    <div style={{ padding: 'var(--space-8)', maxWidth: 760 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        <Link href="/admin/products" style={{ fontSize: '0.85rem', color: 'var(--grey-400)' }}>
          ← Products
        </Link>
        <h1 style={{ fontSize: '1.4rem' }}>
          Edit <span style={{ color: 'var(--teal)' }}>Product</span>
        </h1>
      </div>

      {error && (
        <div className="disclaimer-warning" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-3) var(--space-4)' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--red)' }}>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

        {/* ── Product Information ── */}
        <div className="card-metal" style={{ padding: 'var(--space-6)' }}>
          <h3 style={{ fontSize: '0.95rem', marginBottom: 'var(--space-5)', color: 'var(--silver)' }}>
            Product Information
          </h3>

          <div className="grid-2" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="name">Product Name</label>
              <input id="name" type="text" className="form-input" placeholder="e.g. BPC-157"
                value={form.name} onChange={e => set('name', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="sku">SKU</label>
              <input id="sku" type="text" className="form-input" placeholder="e.g. BPC-157-5MG"
                value={form.sku} onChange={e => set('sku', e.target.value)} />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
            <label className="form-label" htmlFor="category">Category</label>
            <select id="category" className="form-input" value={form.category}
              onChange={e => set('category', e.target.value)} style={{ cursor: 'pointer' }}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="description">Description</label>
            <textarea id="description" className="form-input" placeholder="Research Compound Description..."
              value={form.description} onChange={e => set('description', e.target.value)}
              rows={4} style={{ resize: 'vertical' }} />
          </div>
        </div>

        {/* ── Pricing ── */}
        <div className="card-metal" style={{ padding: 'var(--space-6)' }}>
          <h3 style={{ fontSize: '0.95rem', marginBottom: 'var(--space-5)', color: 'var(--silver)' }}>
            Pricing
          </h3>

          <div className="grid-2" style={{ gap: 'var(--space-4)' }}>
            {/* Base cost */}
            <div className="form-group">
              <label className="form-label" htmlFor="base_cost">
                Base Cost{' '}
                <span style={{ fontSize: '0.72rem', color: 'var(--grey-400)', fontWeight: 400 }}>
                  (Your COGS)
                </span>
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--teal)', fontFamily: 'var(--font-brand)', fontWeight: 700, fontSize: '0.9rem'
                }}>$</span>
                <input id="base_cost" type="number" step="0.01" min="0" required
                  className="form-input" placeholder="0.00"
                  value={form.base_cost} onChange={e => set('base_cost', e.target.value)}
                  style={{ paddingLeft: 28 }} />
              </div>
            </div>

            {/* Unit */}
            <div className="grid-2" style={{ gap: 'var(--space-3)', alignSelf: 'start' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="unit_size">Unit Size</label>
                <input id="unit_size" type="text" className="form-input" placeholder="e.g. 5"
                  value={form.unit_size} onChange={e => set('unit_size', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="unit_measure">Unit</label>
                <select id="unit_measure" className="form-input" value={form.unit_measure}
                  onChange={e => set('unit_measure', e.target.value)}>
                  {['mg', 'mcg', 'g', 'ml', 'IU', 'unit'].map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Live tier price preview — reads REAL multipliers from DB */}
          {validCost && (
            <div style={{
              marginTop: 'var(--space-4)',
              padding: 'var(--space-4)',
              background: 'var(--surface-2)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(0,196,188,0.15)',
            }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--grey-400)', marginBottom: 'var(--space-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Agent Sell Prices (From DB Multipliers)
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-6)' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--grey-400)' }}>Tier 1 ({multipliers.tier_1}×)</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--teal)', fontFamily: 'var(--font-brand)' }}>
                    ${(baseCost * multipliers.tier_1).toFixed(2)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--grey-400)' }}>Tier 2 ({multipliers.tier_2}×)</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--silver)', fontFamily: 'var(--font-brand)' }}>
                    ${(baseCost * multipliers.tier_2).toFixed(2)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--grey-400)' }}>Tier 3 ({multipliers.tier_3}×)</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--grey-400)', fontFamily: 'var(--font-brand)' }}>
                    ${(baseCost * multipliers.tier_3).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Inventory & Shipping ── */}
        <div className="card-metal" style={{ padding: 'var(--space-6)' }}>
          <h3 style={{ fontSize: '0.95rem', marginBottom: 'var(--space-5)', color: 'var(--silver)' }}>
            Inventory & Shipping
          </h3>

          {/* Live shipping status preview */}
          <div style={{
            padding: 'var(--space-4)',
            background: invCount > 0 ? 'rgba(0,196,188,0.06)' : 'rgba(246,173,85,0.06)',
            border: `1px solid ${invCount > 0 ? 'rgba(0,196,188,0.3)' : 'rgba(246,173,85,0.3)'}`,
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-5)',
            display: 'flex', alignItems: 'center', gap: 'var(--space-3)'
          }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: invCount > 0 ? 'var(--teal)' : '#F6AD55',
              boxShadow: `0 0 6px ${invCount > 0 ? 'var(--teal)' : '#F6AD55'}`,
              flexShrink: 0
            }} />
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: invCount > 0 ? 'var(--teal)' : '#F6AD55' }}>
                {invCount > 0
                  ? `Ships Now — ${form.inventory_count} Units In Stock`
                  : `Ships In ${form.backorder_days || 14} Days — Out Of Stock`}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--grey-400)', marginTop: 2 }}>
                This Status Shows Live On All Agent Storefronts
              </div>
            </div>
          </div>

          <div className="grid-3" style={{ gap: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="inventory_count">Units In Stock</label>
              <input id="inventory_count" type="number" min="0" className="form-input"
                placeholder="0" value={form.inventory_count}
                onChange={e => set('inventory_count', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="low_stock_threshold">
                Low Stock Alert
                <span style={{ fontSize: '0.7rem', color: 'var(--grey-400)', fontWeight: 400, marginLeft: 6 }}>
                  (Badge Below This)
                </span>
              </label>
              <input id="low_stock_threshold" type="number" min="0" className="form-input"
                placeholder="5" value={form.low_stock_threshold}
                onChange={e => set('low_stock_threshold', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="backorder_days">Backorder Days</label>
              <input id="backorder_days" type="number" min="1" className="form-input"
                placeholder="14" value={form.backorder_days}
                onChange={e => set('backorder_days', e.target.value)} />
            </div>
          </div>

          <div style={{ marginTop: 'var(--space-3)', fontSize: '0.78rem', color: 'var(--grey-400)' }}>
            Setting Units In Stock To 0 Automatically Switches All Agent Storefronts To "Ships In {form.backorder_days || 14} Days".
            When Restocked, Storefronts Instantly Update To "Ships Now."
          </div>
        </div>

        {/* ── Visibility ── */}
        <div className="card-metal" style={{ padding: 'var(--space-5)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--silver)' }}>
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={e => set('is_active', e.target.checked)}
              style={{ accentColor: 'var(--teal)', width: 18, height: 18 }}
            />
            <div>
              <div style={{ fontWeight: 600 }}>Active — Visible In Agent Catalogs</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--grey-400)', marginTop: 2 }}>
                Uncheck To Save As Draft Without Publishing
              </div>
            </div>
          </label>
        </div>

        {/* ── Submit ── */}
        <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
          <button type="submit" className="btn btn-primary" disabled={saving}
            style={{ opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving Product...' : 'Save Product'}
          </button>
          <Link href="/admin/products" className="btn btn-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
