'use client';

import { useState, useEffect } from 'react';

interface Override {
  id: string;
  product_id: string;
  product_name: string;
  tier_name: string;
  custom_multiplier: number;
}

export default function ProductTierOverrides() {
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Form State
  const [showForm, setShowForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedTier, setSelectedTier] = useState('tier_1');
  const [customMultiplier, setCustomMultiplier] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [overridesRes, productsRes] = await Promise.all([
        fetch('/api/admin/pricing-tiers/overrides'),
        fetch('/api/admin/products')
      ]);

      if (!overridesRes.ok || !productsRes.ok) throw new Error('Failed to fetch data');

      const oData = await overridesRes.json();
      const pData = await productsRes.json();

      // Both endpoints may return a bare array or a { data: [...] } envelope -
      // normalize before using array methods.
      const overrideList = Array.isArray(oData) ? oData : (oData?.data ?? []);
      const productList = Array.isArray(pData) ? pData : (pData?.data ?? []);

      setOverrides(overrideList);
      setProducts(productList.filter((p: any) => p.is_active));

      if (productList.length > 0) setSelectedProduct(productList[0].id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const res = await fetch('/api/admin/pricing-tiers/overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: selectedProduct,
          tier_name: selectedTier,
          custom_multiplier: Number(customMultiplier)
        })
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to save override');
      }

      await fetchData();
      setShowForm(false);
      setCustomMultiplier('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(productId: string, tierName: string) {
    if (!confirm('Remove this override?')) return;
    
    try {
      const res = await fetch('/api/admin/pricing-tiers/overrides', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId, tier_name: tierName })
      });

      if (!res.ok) throw new Error('Failed to delete override');
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  }

  if (loading) {
    return <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--teal)' }}>Loading Overrides...</div>;
  }

  return (
    <div className="glass-panel" style={{ padding: 'var(--space-6)', marginTop: 'var(--space-8)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
        <div>
          <h3 style={{ fontSize: '1.2rem', color: 'var(--white)', fontFamily: 'var(--font-brand)' }}>Product-Specific Multiplier Overrides</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)', marginTop: 4 }}>Set custom multipliers for specific products in specific tiers.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn btn-primary btn-sm">
          {showForm ? 'Cancel' : '+ Add Override'}
        </button>
      </div>

      {error && <div style={{ color: 'var(--red)', marginBottom: 'var(--space-4)', fontSize: '0.85rem' }}>{error}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} style={{ background: 'var(--surface-2)', padding: 'var(--space-5)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-6)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="grid-3" style={{ gap: 'var(--space-4)', alignItems: 'end' }}>
            <div className="form-group">
              <label className="form-label">Product</label>
              <select className="form-input" value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)} required>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Pricing Tier</label>
              <select className="form-input" value={selectedTier} onChange={e => setSelectedTier(e.target.value)} required>
                <option value="tier_1">Tier 1</option>
                <option value="tier_2">Tier 2</option>
                <option value="tier_3">Tier 3</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Custom Multiplier (e.g. 8.5)</label>
              <input type="number" step="0.01" min="1" max="99.99" className="form-input" value={customMultiplier} onChange={e => setCustomMultiplier(e.target.value)} required />
            </div>
          </div>
          <div style={{ marginTop: 'var(--space-4)', textAlign: 'right' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Override'}
            </button>
          </div>
        </form>
      )}

      {overrides.length > 0 ? (
        <table className="data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Tier</th>
              <th>Custom Multiplier</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {overrides.map(o => (
              <tr key={o.id}>
                <td style={{ fontWeight: 'bold' }}>{o.product_name}</td>
                <td><span className="badge badge-silver">{o.tier_name.replace('_', ' ').toUpperCase()}</span></td>
                <td style={{ color: 'var(--teal)', fontWeight: 'bold' }}>{Number(o.custom_multiplier).toFixed(2)}x</td>
                <td style={{ textAlign: 'right' }}>
                  <button onClick={() => handleDelete(o.product_id, o.tier_name)} className="btn btn-secondary btn-sm" style={{ color: 'var(--red)', borderColor: 'rgba(229,62,62,0.3)' }}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ textAlign: 'center', padding: 'var(--space-8)', opacity: 0.6 }}>
          <p>No product-specific overrides configured.</p>
        </div>
      )}
    </div>
  );
}
