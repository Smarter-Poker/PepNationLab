'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Package, Search, Upload, Pencil, Trash2, Eye, EyeOff, Plus, X, DollarSign, Tag, TrendingUp } from 'lucide-react';

const MIN_PRODUCTS = 2;
const MAX_PRODUCTS = 5;
const MAX_DISCOUNT = 90;

type BundleScope = 'self' | 'downline' | 'global';

interface Bundle {
  id: string;
  name: string;
  tagline: string;
  description: string;
  image_url: string | null;
  product_ids: string[];
  discount_percent: number;
  custom_price: number | null;
  is_active: boolean;
  scope: BundleScope;
  // Returned by the GET endpoint (computed from agent_products prices)
  base_cost_total?: number;
  retail_value_total?: number;
}

interface CatalogEntry {
  productId: string;
  name: string;
  baseCost: number;
  retailPrice: number;
}

interface Props {
  agentId: string;
}

const SCOPE_LABELS: Record<BundleScope, string> = {
  self: 'This Store Only',
  downline: 'This Store And My Sub-Agents',
  global: 'Every Storefront',
};

function fmt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return '—';
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Storefront Bundles: lets an agent, super agent, or admin group 2-5 catalog
 * products into a named, described, image-backed bundle sold at an optional
 * discount or flat custom price. Now includes tagline, base cost, retail value,
 * and custom price fields.
 */
export default function BundleManager({ agentId }: Props) {
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [perms, setPerms] = useState<{ canDownline: boolean; canGlobal: boolean }>({ canDownline: false, canGlobal: false });
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [discount, setDiscount] = useState(0);
  const [customPrice, setCustomPrice] = useState('');
  const [scope, setScope] = useState<BundleScope>('self');
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const formRef = useRef<HTMLDivElement | null>(null);

  const catalogName = useCallback(
    (id: string) => catalog.find((c) => c.productId === id)?.name || 'Unnamed Product',
    [catalog],
  );

  const loadBundles = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/bundles', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setBundles(Array.isArray(json.data) ? json.data : []);
        if (json.permissions) setPerms(json.permissions);
      }
    } catch {
      /* surfaced by the empty state */
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const [catRes] = await Promise.all([
        fetch('/api/agent/products').then(res => res.ok ? res.json() : { data: [] }).catch(() => ({ data: [] })),
        loadBundles(),
      ]);
      if (!active) return;
      if (catRes && catRes.data) {
        const seen = new Set<string>();
        const entries: CatalogEntry[] = [];
        for (const row of catRes.data) {
          if (!row.product_id || seen.has(row.product_id) || !row.is_visible) continue;
          seen.add(row.product_id);
          
          const baseName = row.custom_name || row.products?.name || 'Unnamed Product';
          const sizeLabel = row.products?.unit_size && row.products?.unit_measure ? ` ${row.products.unit_size}${row.products.unit_measure}` : '';
          const productName = `${baseName}${sizeLabel}`;
          
          const isBacWater = /bac\.?\s*water/i.test(row.products?.name || '');
          const divFactor = isBacWater ? 1 : 10;
          
          const baseCost = row.agent_cost != null && row.agent_cost > 0 ? row.agent_cost / divFactor : 0;
          const retailPriceRaw = row.is_on_sale && row.sale_price ? row.sale_price : (row.retail_price || 0);
          const retailPrice = retailPriceRaw > 0 ? retailPriceRaw / divFactor : 0;

          entries.push({ 
            productId: row.product_id, 
            name: productName,
            baseCost,
            retailPrice
          });
        }
        entries.sort((a, b) => a.name.localeCompare(b.name));
        setCatalog(entries);
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [agentId, loadBundles]);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setTagline('');
    setDescription('');
    setImageUrl('');
    setSelectedIds([]);
    setDiscount(0);
    setCustomPrice('');
    setScope('self');
    setQuery('');
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 30);
  };

  const openEdit = (b: Bundle) => {
    setEditingId(b.id);
    setName(b.name);
    setTagline(b.tagline || '');
    setDescription(b.description || '');
    setImageUrl(b.image_url || '');
    setSelectedIds([...b.product_ids]);
    setDiscount(b.discount_percent || 0);
    setCustomPrice(b.custom_price != null ? String(b.custom_price) : '');
    setScope(b.scope || 'self');
    setQuery('');
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 30);
  };

  const toggleProduct = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_PRODUCTS) {
        toast.error(`A Bundle Can Include Up To ${MAX_PRODUCTS} Products`);
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch('/api/agent/bundles/upload-image', {
        method: 'POST',
        body: formData,
      });
      
      const json = await res.json().catch(() => ({}));
      
      if (!res.ok) {
        toast.error('Failed To Upload Image: ' + (json.error || res.statusText));
        return;
      }
      
      if (json.url) {
        setImageUrl(json.url);
        toast.success('Image Uploaded');
      }
    } catch (err: any) {
      toast.error('Upload Error: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!name.trim()) {
      toast.error('Please Enter A Bundle Name');
      return;
    }
    if (selectedIds.length < MIN_PRODUCTS) {
      toast.error(`Select At Least ${MIN_PRODUCTS} Products`);
      return;
    }
    // Validate custom price if provided
    const cpNum = customPrice.trim() !== '' ? Number(customPrice) : null;
    if (cpNum !== null && (!Number.isFinite(cpNum) || cpNum < 0)) {
      toast.error('Custom Price Must Be A Positive Number');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        id: editingId || undefined,
        action: editingId ? 'update' : undefined,
        name: name.trim(),
        tagline: tagline.trim(),
        description: description.trim(),
        image_url: imageUrl.trim() || null,
        product_ids: selectedIds,
        discount_percent: Math.min(Math.max(Math.round(Number(discount) || 0), 0), MAX_DISCOUNT),
        custom_price: cpNum,
        scope,
      };
      const res = await fetch('/api/agent/bundles', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || 'Failed To Save Bundle');
        return;
      }
      toast.success(editingId ? 'Bundle Updated' : 'Bundle Created');
      await loadBundles();
      resetForm();
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (b: Bundle) => {
    const res = await fetch('/api/agent/bundles', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: b.id, action: 'toggle' }),
    });
    if (res.ok) {
      setBundles((prev) => prev.map((x) => (x.id === b.id ? { ...x, is_active: !x.is_active } : x)));
    } else {
      toast.error('Failed To Update Bundle');
    }
  };

  const remove = async (b: Bundle) => {
    const res = await fetch('/api/agent/bundles', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: b.id }),
    });
    if (res.ok) {
      setBundles((prev) => prev.filter((x) => x.id !== b.id));
      toast.success('Bundle Removed');
      if (editingId === b.id) {
        resetForm();
        setShowForm(false);
      }
    } else {
      toast.error('Failed To Remove Bundle');
    }
  };

  const visibleCatalog = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter((e) => e.name.toLowerCase().includes(q));
  }, [catalog, query]);

  const scopeChoices: BundleScope[] = useMemo(() => {
    const list: BundleScope[] = ['self'];
    if (perms.canDownline) list.push('downline');
    if (perms.canGlobal) list.push('global');
    return list;
  }, [perms]);

  if (loading) {
    return <div style={{ color: 'var(--silver)', fontSize: '0.85rem' }}>Loading Your Bundles...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <div style={{ color: 'var(--silver)', fontSize: '0.85rem', lineHeight: 1.5, maxWidth: 520 }}>
          Group 2 To {MAX_PRODUCTS} Products Into A Named Bundle With Its Own Image And Optional Discount Or Custom Price. Bundles Appear Below The Top 10 On Your Storefront.
        </div>
        {!showForm && (
          <button type="button" onClick={openCreate} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 38, padding: '0 16px', fontSize: '0.85rem', flexShrink: 0 }}>
            <Plus size={15} aria-hidden="true" />
            Create A Bundle
          </button>
        )}
      </div>

      {catalog.length < MIN_PRODUCTS && (
        <div style={{ color: 'var(--silver)', fontSize: '0.85rem', padding: 'var(--space-3)', background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.06)' }}>
          You Need At Least {MIN_PRODUCTS} Visible Products To Build A Bundle. Enable More Products First.
        </div>
      )}

      {/* Existing bundles */}
      {bundles.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {bundles.map((b) => (
            <div
              key={b.id}
              style={{
                display: 'flex', gap: 'var(--space-3)', padding: '12px 14px',
                borderRadius: 'var(--radius-md)', background: 'var(--surface-2)',
                border: '1px solid rgba(255,255,255,0.06)', opacity: b.is_active ? 1 : 0.55,
                alignItems: 'flex-start',
              }}
            >
              {/* Thumbnail */}
              <div style={{ width: 50, height: 50, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                {b.image_url ? (
                  <Image src={b.image_url} alt={b.name} width={100} height={100} unoptimized style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <Package size={18} style={{ color: 'var(--grey-500)' }} aria-hidden="true" />
                )}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Name + badges */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--white)' }}>{b.name}</span>
                  {b.custom_price != null && b.custom_price > 0 ? (
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#fbbf24', background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.35)', borderRadius: 'var(--radius-full)', padding: '1px 8px', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <DollarSign size={9} aria-hidden="true" />{b.custom_price.toFixed(2)} Fixed
                    </span>
                  ) : b.discount_percent > 0 ? (
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--teal)', background: 'rgba(0,196,188,0.10)', border: '1px solid rgba(0,196,188,0.35)', borderRadius: 'var(--radius-full)', padding: '1px 8px' }}>
                      {b.discount_percent}% Off
                    </span>
                  ) : null}
                  {b.scope !== 'self' && (
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--silver-light)', background: 'var(--surface-3)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 'var(--radius-full)', padding: '1px 8px' }}>
                      {SCOPE_LABELS[b.scope]}
                    </span>
                  )}
                  {!b.is_active && (
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--grey-400)' }}>Hidden</span>
                  )}
                </div>

                {/* Tagline */}
                {b.tagline && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--teal)', fontStyle: 'italic', marginBottom: 3 }}>"{b.tagline}"</div>
                )}

                {/* Products */}
                <div style={{ fontSize: '0.75rem', color: 'var(--silver)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 6 }}>
                  {b.product_ids.map(catalogName).join(', ')}
                </div>

                {/* Pricing row */}
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: '0.68rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Base Cost</span>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--silver-light)' }}>
                      {fmt(b.product_ids.reduce((sum, pid) => sum + (catalog.find(c => c.productId === pid)?.baseCost || 0), 0))}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: '0.68rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Listed Price</span>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--silver-light)', textDecoration: 'line-through', opacity: 0.8 }}>
                      {fmt(b.product_ids.reduce((sum, pid) => sum + (catalog.find(c => c.productId === pid)?.retailPrice || 0), 0))}
                    </span>
                  </div>
                  {b.custom_price != null && b.custom_price > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: '0.68rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Bundle Price</span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fbbf24' }}>{fmt(b.custom_price)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, paddingTop: 2 }}>
                <button type="button" title={b.is_active ? 'Hide' : 'Show'} aria-label={b.is_active ? 'Hide Bundle' : 'Show Bundle'} onClick={() => toggleActive(b)} className="btn-ghost" style={{ padding: 6 }}>
                  {b.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
                <button type="button" title="Edit" aria-label="Edit Bundle" onClick={() => openEdit(b)} className="btn-ghost" style={{ padding: 6 }}>
                  <Pencil size={16} />
                </button>
                <button type="button" title="Delete" aria-label="Delete Bundle" onClick={() => remove(b)} className="btn-ghost" style={{ padding: 6, color: 'var(--red)' }}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / edit form */}
      {showForm && (
        <div ref={formRef} style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', background: 'var(--surface-2)', border: '1px solid rgba(0,196,188,0.25)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h5 style={{ fontSize: '0.95rem', color: 'var(--white)', fontWeight: 700, margin: 0 }}>{editingId ? 'Edit Bundle' : 'New Bundle'}</h5>
            <button type="button" aria-label="Close" onClick={() => { resetForm(); setShowForm(false); }} className="btn-ghost" style={{ padding: 4 }}>
              <X size={16} />
            </button>
          </div>

          {/* Image upload */}
          <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
            <div style={{ width: 84, height: 84, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: 'var(--surface-3)', border: '1px dashed rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              {imageUrl ? (
                <Image src={imageUrl} alt="Bundle" width={168} height={168} unoptimized style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <Package size={24} style={{ color: 'var(--grey-500)' }} aria-hidden="true" />
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', borderRadius: 'var(--radius-md)', background: 'var(--teal)', color: 'var(--background)', fontWeight: 600, fontSize: '0.8rem', cursor: uploading ? 'wait' : 'pointer' }}>
                <Upload size={13} aria-hidden="true" />
                {uploading ? 'Uploading...' : imageUrl ? 'Replace Image' : 'Upload Image'}
                <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
              </label>
              {imageUrl && (
                <button type="button" onClick={() => setImageUrl('')} style={{ fontSize: '0.72rem', color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                  Remove Image
                </button>
              )}
            </div>
          </div>

          {/* Bundle Name */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="bundle-name" style={{ color: 'var(--grey-400)' }}>Bundle Name</label>
            <input id="bundle-name" className="form-input" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} placeholder="e.g. Recovery Research Stack" />
          </div>

          {/* Tagline */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="bundle-tagline" style={{ color: 'var(--grey-400)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Tag size={13} aria-hidden="true" />
              Tagline / Popular Name <span style={{ fontSize: '0.72rem', color: 'var(--grey-500)' }}>(Optional)</span>
            </label>
            <input
              id="bundle-tagline"
              className="form-input"
              value={tagline}
              maxLength={120}
              onChange={(e) => setTagline(e.target.value)}
              placeholder='e.g. "The Healing Trio" — shown as a subtitle on your storefront'
            />
            <div style={{ fontSize: '0.72rem', color: 'var(--silver)', marginTop: 4 }}>Displayed as a catchy subtitle below the bundle name, like a peptide popular name.</div>
          </div>

          {/* Description */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="bundle-desc" style={{ color: 'var(--grey-400)' }}>Description (Optional)</label>
            <textarea id="bundle-desc" className="form-input" value={description} maxLength={5000} onChange={(e) => setDescription(e.target.value)} placeholder="What This Bundle Is For" rows={2} style={{ resize: 'vertical' }} />
          </div>

          {/* Product selection */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label className="form-label" style={{ color: 'var(--grey-400)', margin: 0 }}>Products</label>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: selectedIds.length >= MAX_PRODUCTS ? 'var(--teal)' : 'var(--silver)' }}>
                {selectedIds.length} / {MAX_PRODUCTS} Selected
              </span>
            </div>
            {catalog.length > 8 && (
              <div style={{ position: 'relative', marginBottom: 8 }}>
                <Search size={14} aria-hidden="true" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--silver)' }} />
                <input type="text" className="form-input" placeholder="Search Your Catalog" aria-label="Search Your Catalog" value={query} onChange={(e) => setQuery(e.target.value)} style={{ paddingLeft: 34, fontSize: '0.85rem' }} />
              </div>
            )}
            <div role="group" aria-label="Bundle Product Selection" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-2)', maxHeight: 220, overflowY: 'auto', paddingRight: 4 }}>
              {visibleCatalog.map((p) => {
                const checked = selectedIds.includes(p.productId);
                return (
                  <label key={p.productId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderRadius: 'var(--radius-md)', cursor: 'pointer', background: checked ? 'rgba(0,196,188,0.08)' : 'var(--surface-3)', border: checked ? '1px solid rgba(0,196,188,0.45)' : '1px solid rgba(255,255,255,0.06)' }}>
                    <input type="checkbox" checked={checked} onChange={() => toggleProduct(p.productId)} style={{ width: 15, height: 15, accentColor: 'var(--teal)', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.82rem', fontWeight: 500, color: checked ? 'var(--white)' : 'var(--silver-light)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  </label>
                );
              })}
              {visibleCatalog.length === 0 && (
                <div style={{ color: 'var(--silver)', fontSize: '0.82rem', padding: 'var(--space-2)' }}>No Products Match Your Search</div>
              )}
            </div>
          </div>

          {/* Bundle Pricing Summary */}
          {(() => {
            const selectedProducts = selectedIds.map(id => catalog.find(c => c.productId === id)).filter(Boolean);
            if (selectedProducts.length > 0) {
              const totalBase = selectedProducts.reduce((sum, p) => sum + (p?.baseCost || 0), 0);
              const totalRetail = selectedProducts.reduce((sum, p) => sum + (p?.retailPrice || 0), 0);
              return (
                <div style={{ 
                  backgroundColor: 'var(--surface-3)', 
                  padding: '12px 16px', 
                  borderRadius: 'var(--radius-md)', 
                  border: '1px solid rgba(255,255,255,0.06)', 
                  marginBottom: '16px',
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center' 
                }}>
                  <div style={{ fontSize: '0.82rem', color: 'var(--silver)', fontWeight: 500 }}>
                    Selected Products Value
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', gap: '20px' }}>
                    <div style={{ fontSize: '0.82rem', color: 'var(--silver-light)' }}>
                      Base Cost: <span style={{ fontWeight: 600, color: 'var(--white)' }}>${totalBase.toFixed(2)}</span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--teal)' }}>
                      Listed Price: <span style={{ fontWeight: 700 }}>${totalRetail.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {/* Pricing row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            {/* Discount % */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" htmlFor="bundle-discount" style={{ color: 'var(--grey-400)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <TrendingUp size={13} aria-hidden="true" />
                Discount % <span style={{ fontSize: '0.72rem', color: 'var(--grey-500)' }}>(Optional)</span>
              </label>
              <input
                id="bundle-discount"
                type="number"
                min={0}
                max={MAX_DISCOUNT}
                className="form-input"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
                placeholder="0"
                disabled={customPrice.trim() !== '' && Number(customPrice) > 0}
              />
              <div style={{ fontSize: '0.72rem', color: 'var(--silver)', marginTop: 4 }}>
                {customPrice.trim() !== '' && Number(customPrice) > 0
                  ? 'Disabled — Custom Price Is Set'
                  : 'Applied To The Bundle Total At Checkout.'}
              </div>
            </div>

            {/* Custom flat price */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" htmlFor="bundle-custom-price" style={{ color: 'var(--grey-400)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <DollarSign size={13} aria-hidden="true" />
                Custom Bundle Price <span style={{ fontSize: '0.72rem', color: 'var(--grey-500)' }}>(Optional)</span>
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--silver)', fontSize: '0.9rem', pointerEvents: 'none' }}>$</span>
                <input
                  id="bundle-custom-price"
                  type="number"
                  min={0}
                  step={0.01}
                  className="form-input"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  placeholder="0.00"
                  style={{ paddingLeft: 26 }}
                />
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--silver)', marginTop: 4 }}>
                {customPrice.trim() !== '' && Number(customPrice) > 0
                  ? 'Overrides the discount % — charged exactly at this price.'
                  : 'Set a flat price to override discount % entirely.'}
              </div>
            </div>
          </div>

          {/* Scope */}
          {scopeChoices.length > 1 && (
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" htmlFor="bundle-scope" style={{ color: 'var(--grey-400)' }}>Where It Shows</label>
              <select id="bundle-scope" className="form-input" value={scope} onChange={(e) => setScope(e.target.value as BundleScope)}>
                {scopeChoices.map((s) => (
                  <option key={s} value={s}>{SCOPE_LABELS[s]}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => { resetForm(); setShowForm(false); }} className="btn-ghost" style={{ height: 38, padding: '0 16px' }}>Cancel</button>
            <button type="button" onClick={submit} disabled={saving} className="btn-primary" style={{ height: 38, padding: '0 22px', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Bundle'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
