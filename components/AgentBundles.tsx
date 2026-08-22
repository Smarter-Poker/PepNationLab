'use client';

import React, { useState, useEffect } from 'react';
import { Check, Package } from 'lucide-react';
import Image from 'next/image';

interface ProductOption {
  id: string;
  product_id: string;
  custom_name: string | null;
  retail_price: number;
  is_visible: boolean;
  products: {
    name: string;
    image_url: string | null;
    category: string;
    unit_size: string | null;
    unit_measure: string | null;
  };
}

interface Bundle {
  id: string;
  name: string;
  description: string;
  product_ids: string[];
  discount_percent: number;
  is_active: boolean;
  created_at: string;
}

export default function AgentBundles({ agentId }: { agentId: string }) {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [bundleName, setBundleName] = useState('');
  const [bundleDesc, setBundleDesc] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [discountPercent, setDiscountPercent] = useState(10);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [flyerImageUrl, setFlyerImageUrl] = useState('');
  const [vialImageUrl, setVialImageUrl] = useState('');

  // We can add a helper state for uploads
  const [uploadingFlyer, setUploadingFlyer] = useState(false);
  const [uploadingVial, setUploadingVial] = useState(false);

  useEffect(() => {
    fetchData();
  }, [agentId]);

  async function fetchData() {
    setLoading(true);
    try {
      const [productsRes, bundlesRes] = await Promise.all([
        fetch('/api/agent/products'),
        fetch('/api/agent/bundles'),
      ]);
      const productsJson = await productsRes.json();
      const bundlesJson = await bundlesRes.json();

      if (productsRes.ok) {
        setProducts((productsJson.data || []).filter((p: ProductOption) => p.is_visible));
      }
      if (bundlesRes.ok) {
        setBundles(bundlesJson.data || []);
      }
    } catch {} finally {
      setLoading(false);
    }
  }

  function toggleProductSelection(productId: string) {
    setSelectedProducts(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  }

  async function handleCreateBundle(e: React.FormEvent) {
    e.preventDefault();
    if (!bundleName.trim()) { setError('Bundle Name Is Required'); return; }
    if (selectedProducts.length < 2) { setError('Select At Least 2 Products'); return; }
    if (discountPercent < 0 || discountPercent > 90) { setError('Discount Must Be Between 0% And 90%'); return; }

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/agent/bundles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: bundleName.trim(),
          description: bundleDesc.trim(),
          image_url: flyerImageUrl || null,
          vial_image_url: vialImageUrl || null,
          product_ids: selectedProducts,
          discount_percent: discountPercent,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed To Create Bundle');

      setSuccess('Bundle Created Successfully!');
      setBundleName('');
      setBundleDesc('');
      setFlyerImageUrl('');
      setVialImageUrl('');
      setSelectedProducts([]);
      setDiscountPercent(10);
      await fetchData();
      setTimeout(() => { setShowCreate(false); setSuccess(''); }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleBundle(bundleId: string) {
    // Apply optimistic update first, then revert on failure
    setBundles(prev => prev.map(b => b.id === bundleId ? { ...b, is_active: !b.is_active } : b));
    try {
      const res = await fetch('/api/agent/bundles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: bundleId, action: 'toggle' }),
      });
      if (!res.ok) throw new Error('Failed To Toggle Bundle');
    } catch {
      // Revert optimistic update on failure
      setBundles(prev => prev.map(b => b.id === bundleId ? { ...b, is_active: !b.is_active } : b));
    }
  }

  async function deleteBundle(bundleId: string) {
    if (!confirm('Delete This Bundle?')) return;
    const snapshot = bundles.find(b => b.id === bundleId);
    // Apply optimistic removal first, then revert on failure
    setBundles(prev => prev.filter(b => b.id !== bundleId));
    try {
      const res = await fetch('/api/agent/bundles', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: bundleId }),
      });
      if (!res.ok) throw new Error('Failed To Delete Bundle');
    } catch {
      // Revert optimistic removal on failure
      if (snapshot) setBundles(prev => [...prev, snapshot].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
    }
  }

  function getBundlePrice(bundle: Bundle): number {
    const bundleProducts = products.filter(p => bundle.product_ids.includes(p.product_id));
    const total = bundleProducts.reduce((sum, p) => sum + Number(p.retail_price), 0);
    return total * (1 - bundle.discount_percent / 100);
  }

  function getOriginalPrice(bundle: Bundle): number {
    const bundleProducts = products.filter(p => bundle.product_ids.includes(p.product_id));
    return bundleProducts.reduce((sum, p) => sum + Number(p.retail_price), 0);
  }

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
        <p style={{ color: 'var(--teal)' }}>Loading Bundles...</p>
      </div>
    );
  }

  return (
    <div className="glass-panel">
      <div className="" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <h3 className="metal-text" style={{ fontSize: '1.25rem', marginBottom: 4, fontFamily: 'var(--font-brand)', textTransform: 'uppercase' }}>
              Research Bundles
            </h3>
            <p style={{ color: 'var(--grey-400)', fontSize: '0.82rem', margin: 0 }}>
              Combine Products Into Discounted Bundles For Your Storefront.
            </p>
          </div>
          <button
            className="btn-neon-cyan"
            onClick={() => setShowCreate(!showCreate)}
            style={{ fontSize: '0.85rem' }}
          >
            {showCreate ? 'Cancel' : '+ Create Bundle'}
          </button>
        </div>

        {/* Create Bundle Form */}
        {showCreate && (
          <div className="glass-panel" style={{ padding: 'var(--space-6)' }}>
            <h4 style={{ color: '#00E5FF', fontSize: '0.95rem', marginBottom: 'var(--space-4)' }}>New Research Bundle</h4>

            {error && (
              <div className="glass-panel" style={{ border: '1px solid rgba(229,62,62,0.3)', marginBottom: 'var(--space-4)', padding: 'var(--space-3)' }}>
                <p style={{ color: '#FFAAAA', fontSize: '0.8rem', margin: 0 }}>{error}</p>
              </div>
            )}
            {success && (
              <div className="glass-panel" style={{ border: '1px solid rgba(0,255,157,0.3)', marginBottom: 'var(--space-4)', padding: 'var(--space-3)' }}>
                <p style={{ color: '#00FF9D', fontSize: '0.8rem', margin: 0 }}>{success}</p>
              </div>
            )}

            <form onSubmit={handleCreateBundle} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="grid-2" style={{ gap: 'var(--space-4)' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--grey-300)', fontSize: '0.85rem' }}>Bundle Name</label>
                  <input
                    type="text"
                    style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-metal-dark)', border: '1px solid rgba(0,0,0,0.8)', color: 'var(--white)', borderRadius: '6px' }}
                    placeholder="e.g. Healing Stack, Weight Loss Pack"
                    value={bundleName}
                    onChange={e => setBundleName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--grey-300)', fontSize: '0.85rem' }}>Bundle Discount (%)</label>
                  <input
                    type="number"
                    style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-metal-dark)', border: '1px solid rgba(0,0,0,0.8)', color: 'var(--white)', borderRadius: '6px' }}
                    value={discountPercent}
                    onChange={e => setDiscountPercent(Number(e.target.value))}
                    min={0}
                    max={90}
                  />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--grey-300)', fontSize: '0.85rem' }}>Description (Optional)</label>
                <textarea
                  style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-metal-dark)', border: '1px solid rgba(0,0,0,0.8)', color: 'var(--white)', borderRadius: '6px' }}
                  rows={2}
                  placeholder="Describe What This Bundle Targets..."
                  value={bundleDesc}
                  onChange={e => setBundleDesc(e.target.value)}
                />
              </div>

              {/* Image Uploads */}
              <div className="grid-2" style={{ gap: 'var(--space-4)' }}>
                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--grey-300)', fontSize: '0.85rem' }}>Flyer Image (Storefront Grid)</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {flyerImageUrl && (
                      <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1', background: 'var(--bg-metal-dark)', borderRadius: '6px', overflow: 'hidden' }}>
                        <Image src={flyerImageUrl} alt="Flyer" fill style={{ objectFit: 'cover' }} unoptimized />
                      </div>
                    )}
                    <label style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', height: '36px',
                      background: 'var(--teal)', color: 'var(--background)', borderRadius: '6px', cursor: 'pointer',
                      fontSize: '0.85rem', fontWeight: 600, opacity: uploadingFlyer ? 0.7 : 1
                    }}>
                      <Package size={14} /> {uploadingFlyer ? 'Uploading...' : (flyerImageUrl ? 'Replace Flyer' : 'Upload Flyer')}
                      <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploadingFlyer} onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploadingFlyer(true);
                        const fd = new FormData();
                        fd.append('file', file);
                        try {
                          const res = await fetch('/api/agent/bundles/upload-image', { method: 'POST', body: fd });
                          const data = await res.json();
                          if (res.ok && data.url) setFlyerImageUrl(data.url);
                          else setError(data.error || 'Upload failed');
                        } catch (err: any) {
                          setError(err.message || 'Upload failed');
                        } finally {
                          setUploadingFlyer(false);
                        }
                      }} />
                    </label>
                  </div>
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--grey-300)', fontSize: '0.85rem' }}>Vials Image (Modal Detail)</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {vialImageUrl && (
                      <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1', background: 'var(--bg-metal-dark)', borderRadius: '6px', overflow: 'hidden' }}>
                        <Image src={vialImageUrl} alt="Vials" fill style={{ objectFit: 'cover' }} unoptimized />
                      </div>
                    )}
                    <label style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', height: '36px',
                      background: 'var(--teal)', color: 'var(--background)', borderRadius: '6px', cursor: 'pointer',
                      fontSize: '0.85rem', fontWeight: 600, opacity: uploadingVial ? 0.7 : 1
                    }}>
                      <Package size={14} /> {uploadingVial ? 'Uploading...' : (vialImageUrl ? 'Replace Vials Image' : 'Upload Vials Image')}
                      <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploadingVial} onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploadingVial(true);
                        const fd = new FormData();
                        fd.append('file', file);
                        try {
                          const res = await fetch('/api/agent/bundles/upload-image', { method: 'POST', body: fd });
                          const data = await res.json();
                          if (res.ok && data.url) setVialImageUrl(data.url);
                          else setError(data.error || 'Upload failed');
                        } catch (err: any) {
                          setError(err.message || 'Upload failed');
                        } finally {
                          setUploadingVial(false);
                        }
                      }} />
                    </label>
                  </div>
                </div>
              </div>

              {/* Product Picker */}
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--grey-300)', fontSize: '0.85rem' }}>
                  Select Products ({selectedProducts.length} Selected)
                </label>
                <div style={{
                  maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4,
                  background: 'var(--bg-metal-dark)', borderRadius: '6px', padding: 'var(--space-3)',
                  border: '1px solid rgba(0,0,0,0.8)', boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.9)'
                }}>
                  {products.map(p => {
                    const isSelected = selectedProducts.includes(p.product_id);
                    const displayName = p.custom_name || p.products.name;
                    const sizeLabel = p.products.unit_size ? `${p.products.unit_size}${p.products.unit_measure || ''}` : '';
                    return (
                      <button
                        key={p.product_id}
                        type="button"
                        onClick={() => toggleProductSelection(p.product_id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                          padding: '8px var(--space-3)', borderRadius: '4px',
                          background: isSelected ? 'rgba(0,229,255,0.1)' : 'transparent',
                          border: isSelected ? '1px solid rgba(0,229,255,0.3)' : '1px solid transparent',
                          cursor: 'pointer', transition: 'all 0.15s', width: '100%', textAlign: 'left',
                        }}
                      >
                        <div style={{
                          width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                          background: isSelected ? '#00E5FF' : 'rgba(0,0,0,0.5)',
                          border: isSelected ? 'none' : '1px solid rgba(255,255,255,0.1)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {isSelected && <Check size={12} color="#0b0f16" strokeWidth={3} aria-hidden="true" />}
                        </div>
                        <Image src={p.products.image_url || '/images/peptide_clear.png'} alt="" width={28} height={28} style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'cover' }} onError={(e) => { const target = e.target as HTMLImageElement; if (!target.src.includes('/images/peptide_clear.png')) { target.srcset = ''; target.src = '/images/peptide_clear.png'; } }} unoptimized />
                        <span style={{ fontSize: '0.82rem', color: 'var(--white)', flex: 1 }}>{displayName}</span>
                        {sizeLabel && <span style={{ fontSize: '0.68rem', color: 'var(--grey-400)' }}>{sizeLabel}</span>}
                        <span style={{ fontSize: '0.82rem', color: '#00E5FF', fontWeight: 600 }}>${Number(p.retail_price).toFixed(2)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Price Preview */}
              {selectedProducts.length >= 2 && (
                <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '6px', padding: 'var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--grey-400)', marginBottom: 4 }}>Bundle Price Preview</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--grey-400)', textDecoration: 'line-through' }}>
                        ${products.filter(p => selectedProducts.includes(p.product_id)).reduce((s, p) => s + Number(p.retail_price), 0).toFixed(2)}
                      </span>
                      <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#00E5FF' }}>
                        ${(products.filter(p => selectedProducts.includes(p.product_id)).reduce((s, p) => s + Number(p.retail_price), 0) * (1 - discountPercent / 100)).toFixed(2)}
                      </span>
                      <span style={{ fontSize: '0.75rem', background: 'rgba(0,229,255,0.15)', color: '#00E5FF', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>
                        Save {discountPercent}%
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--grey-400)' }}>
                    {selectedProducts.length} Products
                  </div>
                </div>
              )}

              <button type="submit" className="btn-neon-cyan" disabled={saving}>
                {saving ? 'Creating Bundle...' : 'Create Research Bundle'}
              </button>
            </form>
          </div>
        )}

        {/* Existing Bundles */}
        {bundles.length === 0 && !showCreate ? (
          <div className="glass-panel" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
            <div style={{ marginBottom: 'var(--space-3)', color: 'var(--grey-500)', display: 'flex', justifyContent: 'center' }}><Package size={32} aria-hidden="true" /></div>
            <p style={{ color: 'var(--grey-400)', fontSize: '0.9rem', marginBottom: 'var(--space-4)' }}>
              No Research Bundles Created Yet
            </p>
            <p style={{ color: 'var(--grey-400)', fontSize: '0.8rem' }}>
              Combine 2+ Products Into Discounted Bundles To Increase Average Order Value.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {bundles.map(bundle => {
              const bundleProducts = products.filter(p => bundle.product_ids.includes(p.product_id));
              const originalPrice = getOriginalPrice(bundle);
              const bundlePrice = getBundlePrice(bundle);

              return (
                <div key={bundle.id} className="glass-panel" style={{ padding: 'var(--space-5)', opacity: bundle.is_active ? 1 : 0.5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 4 }}>
                        <h4 style={{ fontSize: '1rem', color: 'var(--white)', margin: 0, fontFamily: 'var(--font-brand)' }}>{bundle.name}</h4>
                        <span className="badge-metal" style={{ fontSize: '0.68rem', color: bundle.is_active ? '#00FF9D' : 'var(--grey-400)' }}>
                          {bundle.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      {bundle.description && (
                        <p style={{ fontSize: '0.82rem', color: 'var(--grey-400)', margin: 0 }}>{bundle.description}</p>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      <button onClick={() => toggleBundle(bundle.id)} className="btn-silver" style={{ padding: '4px 10px', fontSize: '0.72rem' }}>
                        {bundle.is_active ? 'Disable' : 'Enable'}
                      </button>
                      <button onClick={() => deleteBundle(bundle.id)} className="btn-neon-red" style={{ padding: '4px 10px', fontSize: '0.72rem' }}>
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Bundle Products */}
                  <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-3)' }}>
                    {bundleProducts.map(p => (
                      <div key={p.product_id} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: '4px',
                        fontSize: '0.78rem', color: 'var(--silver)',
                      }}>
                        <Image src={p.products.image_url || '/images/peptide_clear.png'} alt="" width={20} height={20} style={{ width: 20, height: 20, borderRadius: 3 }} onError={(e) => { const target = e.target as HTMLImageElement; if (!target.src.includes('/images/peptide_clear.png')) { target.srcset = ''; target.src = '/images/peptide_clear.png'; } }} unoptimized />
                        {p.custom_name || p.products.name}
                      </div>
                    ))}
                    {bundle.product_ids.length > bundleProducts.length && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--grey-400)', padding: '4px 10px' }}>
                        +{bundle.product_ids.length - bundleProducts.length} Unavailable
                      </span>
                    )}
                  </div>

                  {/* Pricing */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--grey-400)', textDecoration: 'line-through' }}>
                      ${originalPrice.toFixed(2)}
                    </span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#00E5FF' }}>
                      ${bundlePrice.toFixed(2)}
                    </span>
                    <span style={{ fontSize: '0.72rem', background: 'rgba(0,229,255,0.15)', color: '#00E5FF', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>
                      {bundle.discount_percent}% Off
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--grey-400)', marginLeft: 'auto' }}>
                      {bundle.product_ids.length} Products
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
