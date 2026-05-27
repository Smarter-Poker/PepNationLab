'use client';

import React, { useState, useEffect } from 'react';

interface AgentProduct {
  id: string;
  agent_id: string;
  product_id: string;
  custom_name: string | null;
  custom_description: string | null;
  custom_image_url: string | null;
  retail_price: number;
  is_visible: boolean;
  products: {
    name: string;
    description: string;
    image_url: string | null;
    category: string;
    in_stock: boolean;
    inventory_count: number;
  };
}

export default function AgentStoreProducts({ agentId }: { agentId: string }) {
  const [products, setProducts] = useState<AgentProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<AgentProduct>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, [agentId]);

  async function fetchProducts() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/agent/products');
      const json = await res.json();
      if (res.ok) {
        setProducts(json.data || []);
      } else {
        setError(json.error || 'Failed to load products');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(p: AgentProduct) {
    setEditingId(p.id);
    setEditForm({
      id: p.id,
      custom_name: p.custom_name ?? '',
      custom_description: p.custom_description ?? '',
      custom_image_url: p.custom_image_url ?? '',
      retail_price: p.retail_price,
      is_visible: p.is_visible,
    });
  }

  function handleCancel() {
    setEditingId(null);
    setEditForm({});
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
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || 'Failed to save product');
      } else {
        await fetchProducts();
        setEditingId(null);
      }
    } catch (err: any) {
      alert(err.message || 'An error occurred');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
        <p style={{ color: 'var(--teal)', fontSize: '1rem' }}>Loading Store Products...</p>
      </div>
    );
  }

  return (
    <div className="card-metal" style={{ padding: 'var(--space-6)' }}>
      <h3 style={{ fontSize: '1.1rem', color: 'var(--white)', marginBottom: 'var(--space-2)', fontFamily: 'var(--font-brand)', textTransform: 'uppercase' }}>
        Store Products Configuration
      </h3>
      <p style={{ color: 'var(--grey-400)', fontSize: '0.85rem', marginBottom: 'var(--space-6)' }}>
        Set your own retail prices, custom names, descriptions, and visibility for products in your storefront.
      </p>

      {error && (
        <div style={{ background: 'rgba(229,62,62,0.1)', border: '1px solid rgba(229,62,62,0.3)', borderRadius: 8, padding: 'var(--space-3)', marginBottom: 'var(--space-4)', fontSize: '0.85rem', color: 'var(--red)' }}>
          {error}
        </div>
      )}

      {products.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-8) 0' }}>
          <p style={{ color: 'var(--grey-400)' }}>No products available yet. Contact admin.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {products.map((p) => {
            const isEditing = editingId === p.id;
            const displayName = p.custom_name || p.products.name;
            return (
              <div key={p.id} style={{ background: 'var(--surface-2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)' }}>
                {isEditing ? (
                  <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <div className="grid-2" style={{ gap: 'var(--space-4)' }}>
                      <div className="form-group">
                        <label className="form-label">Custom Product Name</label>
                        <input type="text" className="form-input" placeholder={`Default: ${p.products.name}`} value={editForm.custom_name || ''} onChange={e => setEditForm({ ...editForm, custom_name: e.target.value })} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Your Retail Price ($)</label>
                        <input type="number" step="0.01" className="form-input" required value={editForm.retail_price || ''} onChange={e => setEditForm({ ...editForm, retail_price: Number(e.target.value) })} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Custom Description</label>
                      <textarea className="form-input" placeholder={`Default: ${p.products.description || 'No description'}`} value={editForm.custom_description || ''} onChange={e => setEditForm({ ...editForm, custom_description: e.target.value })} rows={3} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Custom Image URL</label>
                      <input type="url" className="form-input" placeholder="https://..." value={editForm.custom_image_url || ''} onChange={e => setEditForm({ ...editForm, custom_image_url: e.target.value })} />
                    </div>
                    <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <input type="checkbox" id={`visible-${p.id}`} checked={editForm.is_visible} onChange={e => setEditForm({ ...editForm, is_visible: e.target.checked })} style={{ width: 16, height: 16, accentColor: 'var(--teal)' }} />
                      <label htmlFor={`visible-${p.id}`} style={{ fontSize: '0.9rem', color: 'var(--silver)', cursor: 'pointer' }}>Show in Storefront</label>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                      <button type="submit" disabled={saving} className="btn btn-primary btn-sm">
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button type="button" disabled={saving} onClick={handleCancel} className="btn btn-secondary btn-sm">
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                          <h4 style={{ fontSize: '1rem', color: 'var(--white)', margin: 0, fontFamily: 'var(--font-brand)' }}>{displayName}</h4>
                          <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 12, background: p.is_visible ? 'rgba(0,196,188,0.1)' : 'rgba(255,255,255,0.1)', color: p.is_visible ? 'var(--teal)' : 'var(--grey-400)' }}>
                            {p.is_visible ? 'Visible' : 'Hidden'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--teal)', fontWeight: 700 }}>
                          Retail Price: ${Number(p.retail_price).toFixed(2)}
                        </div>
                      </div>
                      <button onClick={() => handleEdit(p)} className="btn btn-secondary btn-sm" style={{ padding: '6px 12px' }}>
                        Edit Details
                      </button>
                    </div>
                    {p.custom_description && (
                      <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)', marginTop: 'var(--space-2)' }}>
                        {p.custom_description.substring(0, 100)}...
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
