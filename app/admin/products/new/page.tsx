'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const CATEGORIES = [
  'Peptides',
  'Research Chemicals',
  'Nootropics',
  'Growth Factors',
  'Amino Acids',
  'Other',
];

export default function NewProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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

  function set(field: string, val: string | boolean) {
    setForm(prev => ({ ...prev, [field]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await fetch('/api/admin/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        base_cost: parseFloat(form.base_cost),
        inventory_count: parseInt(form.inventory_count, 10) || 0,
        low_stock_threshold: parseInt(form.low_stock_threshold, 10) || 5,
        backorder_days: parseInt(form.backorder_days, 10) || 14,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Failed To Save Product');
      setLoading(false);
      return;
    }

    router.push('/admin/products');
    router.refresh();
  }

  const INPUT = (field: string, label: string, opts: Partial<{
    type: string; placeholder: string; required: boolean;
  }> = {}) => (
    <div className="form-group">
      <label className="form-label" htmlFor={field}>{label}</label>
      <input
        id={field}
        type={opts.type ?? 'text'}
        className="form-input"
        placeholder={opts.placeholder}
        value={String(form[field as keyof typeof form])}
        onChange={e => set(field, e.target.value)}
        required={opts.required}
      />
    </div>
  );

  return (
    <div style={{ padding: 'var(--space-8)', maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        <Link href="/admin/products" style={{ fontSize: '0.85rem', color: 'var(--grey-400)' }}>
          ← Products
        </Link>
        <h1 style={{ fontSize: '1.4rem' }}>
          Add New <span style={{ color: 'var(--teal)' }}>Product</span>
        </h1>
      </div>

      {error && (
        <div className="disclaimer-warning" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-3) var(--space-4)' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--red)' }}>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="card-metal" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
          <h3 style={{ fontSize: '0.95rem', marginBottom: 'var(--space-5)', color: 'var(--silver)' }}>
            Product Information
          </h3>

          <div className="grid-2" style={{ gap: 'var(--space-4)' }}>
            {INPUT('name', 'Product Name', { required: true, placeholder: 'e.g. BPC-157' })}
            {INPUT('sku', 'SKU', { placeholder: 'e.g. BPC-157-5MG' })}
          </div>

          <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
            <label className="form-label" htmlFor="category">Category</label>
            <select
              id="category"
              className="form-input"
              value={form.category}
              onChange={e => set('category', e.target.value)}
              style={{ cursor: 'pointer' }}
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
            <label className="form-label" htmlFor="description">Description</label>
            <textarea
              id="description"
              className="form-input"
              placeholder="Research compound description..."
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={4}
              style={{ resize: 'vertical' }}
            />
          </div>
        </div>

        <div className="card-metal" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
          <h3 style={{ fontSize: '0.95rem', marginBottom: 'var(--space-5)', color: 'var(--silver)' }}>
            Pricing & Inventory
          </h3>

          <div className="grid-2" style={{ gap: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="base_cost">
                Base Cost{' '}
                <span style={{ fontSize: '0.72rem', color: 'var(--grey-400)', fontWeight: 400 }}>
                  (Tier Prices Auto-Calculated)
                </span>
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--teal)', fontFamily: 'var(--font-brand)', fontWeight: 700, fontSize: '0.9rem'
                }}>$</span>
                <input
                  id="base_cost"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  className="form-input"
                  placeholder="0.00"
                  value={form.base_cost}
                  onChange={e => set('base_cost', e.target.value)}
                  style={{ paddingLeft: 28 }}
                />
              </div>

        {/* Inventory */}
        <div className="card-metal" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
          <h3 style={{ fontSize: '0.95rem', marginBottom: 'var(--space-5)', color: 'var(--silver)' }}>
            Inventory & Shipping
          </h3>

          {/* Shipping status preview */}
          <div style={{
            padding: 'var(--space-4)',
            background: parseInt(form.inventory_count) > 0 ? 'rgba(0,196,188,0.06)' : 'rgba(246,173,85,0.06)',
            border: `1px solid ${parseInt(form.inventory_count) > 0 ? 'rgba(0,196,188,0.3)' : 'rgba(246,173,85,0.3)'}`,
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-5)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)'
          }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: parseInt(form.inventory_count) > 0 ? 'var(--teal)' : '#F6AD55',
              boxShadow: `0 0 6px ${parseInt(form.inventory_count) > 0 ? 'var(--teal)' : '#F6AD55'}`,
              flexShrink: 0
            }} />
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: parseInt(form.inventory_count) > 0 ? 'var(--teal)' : '#F6AD55' }}>
                {parseInt(form.inventory_count) > 0
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
              <input
                id="inventory_count"
                type="number"
                min="0"
                className="form-input"
                placeholder="0"
                value={form.inventory_count}
                onChange={e => set('inventory_count', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="low_stock_threshold">
                Low Stock Alert
                <span style={{ fontSize: '0.7rem', color: 'var(--grey-400)', fontWeight: 400, marginLeft: 6 }}>
                  (Show Badge Below)
                </span>
              </label>
              <input
                id="low_stock_threshold"
                type="number"
                min="0"
                className="form-input"
                placeholder="5"
                value={form.low_stock_threshold}
                onChange={e => set('low_stock_threshold', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="backorder_days">Backorder Days</label>
              <input
                id="backorder_days"
                type="number"
                min="1"
                className="form-input"
                placeholder="14"
                value={form.backorder_days}
                onChange={e => set('backorder_days', e.target.value)}
              />
            </div>
          </div>

          <div style={{ marginTop: 'var(--space-3)', fontSize: '0.78rem', color: 'var(--grey-400)' }}>
            Setting Units In Stock to 0 automatically switches all agent storefronts to “Ships In {form.backorder_days || 14} Days”. 
            When restocked, storefronts instantly update to “Ships Now.”
          </div>
        </div>

              {form.base_cost && !isNaN(parseFloat(form.base_cost)) && (
                <div style={{
                  marginTop: 'var(--space-3)',
                  padding: 'var(--space-3)',
                  background: 'var(--surface-2)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.78rem',
                  display: 'flex',
                  gap: 'var(--space-4)'
                }}>
                  <span style={{ color: 'var(--teal)' }}>
                    Tier 1: ${(parseFloat(form.base_cost) * 5).toFixed(2)}
                  </span>
                  <span style={{ color: 'var(--silver)' }}>
                    Tier 2: ${(parseFloat(form.base_cost) * 6).toFixed(2)}
                  </span>
                  <span style={{ color: 'var(--grey-400)' }}>
                    Tier 3: ${(parseFloat(form.base_cost) * 7).toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            <div className="grid-2" style={{ gap: 'var(--space-3)', alignSelf: 'start' }}>
              {INPUT('unit_size', 'Unit Size', { placeholder: 'e.g. 5' })}
              <div className="form-group">
                <label className="form-label" htmlFor="unit_measure">Unit</label>
                <select
                  id="unit_measure"
                  className="form-input"
                  value={form.unit_measure}
                  onChange={e => set('unit_measure', e.target.value)}
                >
                  {['mg', 'mcg', 'g', 'ml', 'IU', 'unit'].map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Toggles */}
          <div style={{ display: 'flex', gap: 'var(--space-6)', marginTop: 'var(--space-5)' }}>
            {[
              { field: 'in_stock', label: 'In Stock' },
              { field: 'is_active', label: 'Active (Visible In Catalog)' },
            ].map(({ field, label }) => (
              <label key={field} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--silver)' }}>
                <input
                  type="checkbox"
                  checked={Boolean(form[field as keyof typeof form])}
                  onChange={e => set(field, e.target.checked)}
                  style={{ accentColor: 'var(--teal)', width: 16, height: 16 }}
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Saving Product...' : 'Save Product'}
          </button>
          <Link href="/admin/products" className="btn btn-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
