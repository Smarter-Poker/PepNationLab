'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

const CATEGORIES = [
  'Weight Loss & Metabolism',
  'Muscle Growth & Performance',
  'Healing & Recovery',
  'Skin, Hair & Cosmetics',
  'Anti-Aging & Longevity',
  'Sexual Health & Hormones',
  'Immunity & Wellness',
  'Research Chemicals',
  'Nootropics',
  'Amino Acids',
  'Other',
];

export default function NewProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [multipliers, setMultipliers] = useState<Record<string, number>>({
    tier_1: 5.0,
    tier_2: 6.0,
    tier_3: 7.0,
  });
  const [form, setForm] = useState({
    name: '',
    sku: '',
    category: 'Weight Loss & Metabolism',
    description: '',
    image_url: '',
    base_cost: '',
    unit_size: '',
    unit_measure: 'mg',
    inventory_count: '0',
    low_stock_threshold: '5',
    backorder_days: '14',
    is_active: true,
    admin_bulk_price: '',
    admin_bulk_threshold: '100',
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch real multipliers from DB on mount
  useEffect(() => {
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
      .catch(() => {/* keep defaults on error */});
  }, []);

  function set(field: string, val: string | boolean) {
    setForm(prev => ({ ...prev, [field]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validate base_cost > 0 before any network call
    const parsedBaseCost = parseFloat(form.base_cost);
    if (!form.base_cost || isNaN(parsedBaseCost) || parsedBaseCost <= 0) {
      setError('Base Cost Must Be Greater Than $0.00');
      setLoading(false);
      return;
    }

    const supabase = createClient();
    let finalImageUrl = form.image_url;

    // Handle Image Upload if a file was selected
    if (fileInputRef.current?.files?.[0]) {
      setUploadingImage(true);
      const file = fileInputRef.current.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from('product-images')
        .upload(filePath, file);

      if (uploadError) {
        setError(`Image Upload Failed: ${uploadError.message}`);
        setLoading(false);
        setUploadingImage(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      finalImageUrl = publicUrlData.publicUrl;
      setUploadingImage(false);
    }

    const res = await fetch('/api/admin/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        image_url: finalImageUrl,
        base_cost: parseFloat(form.base_cost),
        inventory_count: parseInt(form.inventory_count, 10) || 0,
        low_stock_threshold: parseInt(form.low_stock_threshold, 10) || 5,
        backorder_days: parseInt(form.backorder_days, 10) || 14,
        admin_bulk_price: form.admin_bulk_price ? parseFloat(form.admin_bulk_price) : null,
        admin_bulk_threshold: parseInt(form.admin_bulk_threshold, 10) || 100,
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

  const baseCost = parseFloat(form.base_cost);
  const validCost = form.base_cost && !isNaN(baseCost);
  const invCount = parseInt(form.inventory_count, 10) || 0;

  return (
    <div style={{ padding: 'var(--space-8)', maxWidth: 760 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        <Link href="/admin/products" style={{ fontSize: '0.85rem', color: 'var(--grey-400)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Products
        </Link>
        <h1 style={{ fontSize: '1.4rem' }}>
          Add New Product
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
              <input id="name" type="text" className="form-input" placeholder="E.g. BPC-157"
                value={form.name} onChange={e => set('name', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="sku">SKU</label>
              <input id="sku" type="text" className="form-input" placeholder="E.g. BPC-157-5MG"
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

          <div className="form-group">
            <label className="form-label" htmlFor="image_url">
              Product Image
              <span style={{ fontSize: '0.72rem', color: 'var(--grey-400)', fontWeight: 400 }}>Optional</span>
            </label>
            <input 
              id="image_url" 
              type="file" 
              accept="image/*"
              ref={fileInputRef}
              className="form-input"
              style={{ padding: '8px' }}
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  const url = URL.createObjectURL(e.target.files[0]);
                  set('image_url', url);
                }
              }}
            />
            {form.image_url && (
              <div style={{ marginTop: 'var(--space-3)', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: 'var(--border-subtle)', width: 120, height: 120, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.image_url} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
            )}
            {uploadingImage && <div style={{ fontSize: '0.8rem', color: 'var(--teal)', marginTop: 8 }}>Uploading Image...</div>}
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
                <input id="base_cost" type="number" step="0.01" min="0.01" required
                  className="form-input" placeholder="0.00"
                  value={form.base_cost} onChange={e => set('base_cost', e.target.value)}
                  style={{ paddingLeft: 28 }} />
              </div>
            </div>

            {/* Unit */}
            <div className="grid-2" style={{ gap: 'var(--space-3)', alignSelf: 'start' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="unit_size">Unit Size</label>
                <input id="unit_size" type="text" className="form-input" placeholder="E.g. 5"
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

          {/* Bulk Pricing */}
          <div style={{ marginTop: 'var(--space-6)', padding: 'var(--space-4)', background: 'var(--surface-3)', borderRadius: 'var(--radius-md)', border: '1px dashed rgba(192, 184, 168, 0.3)' }}>
            <h4 style={{ fontSize: '0.85rem', color: 'var(--teal)', marginBottom: 'var(--space-3)' }}>
              Bulk Wholesale Pricing
            </h4>
            <div className="grid-2" style={{ gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="admin_bulk_threshold">Threshold (Vials)</label>
                <input id="admin_bulk_threshold" type="number" min="1" className="form-input" placeholder="e.g. 100"
                  value={form.admin_bulk_threshold} onChange={e => set('admin_bulk_threshold', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="admin_bulk_price">Bulk Unit Cost ($)</label>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--teal)', fontFamily: 'var(--font-brand)', fontWeight: 700, fontSize: '0.9rem'
                  }}>$</span>
                  <input id="admin_bulk_price" type="number" step="0.01" min="0" className="form-input" placeholder="Optional"
                    value={form.admin_bulk_price} onChange={e => set('admin_bulk_price', e.target.value)}
                    style={{ paddingLeft: 28 }} />
                </div>
              </div>
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--grey-400)', marginTop: 'var(--space-2)', marginBottom: 0 }}>
              If set, Agents purchasing at or above the threshold quantity will receive this flat unit cost regardless of their tier.
            </p>
          </div>

          {/* Live tier price preview — reads REAL multipliers from DB */}
          {validCost && (
            <div style={{
              marginTop: 'var(--space-4)',
              padding: 'var(--space-4)',
              background: 'var(--surface-2)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(192,184,168,0.15)',
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
            background: invCount > 0 ? 'rgba(192,184,168,0.06)' : 'rgba(246,173,85,0.06)',
            border: `1px solid ${invCount > 0 ? 'rgba(192,184,168,0.3)' : 'rgba(246,173,85,0.3)'}`,
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
                  ? `In Stock — Ships Now (${form.inventory_count} Units)`
                  : `Out of Stock / Backordered`}
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
            Setting Units In Stock To 0 Automatically Switches All Agent Storefronts To "Out of Stock / Backordered".
            When Restocked, Storefronts Instantly Update To "In Stock — Ships Now."
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
          <button type="submit" className="btn btn-primary" disabled={loading}
            style={{ opacity: loading ? 0.7 : 1 }}>
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
