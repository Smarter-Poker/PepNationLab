'use client';

import React, { useMemo, useState } from 'react';
import { Printer, Search, Minus, Plus, Trash2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface LabelProduct {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  unit_size: string | null;
  unit_measure: string | null;
}

const STORAGE_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/print-labels`;

/** Category accent colors - mirrors the label artwork color system. */
function categoryColor(category: string | null, slug: string): string {
  const s = (slug || '').toLowerCase();
  const c = (category || '').toLowerCase();
  if (s.startsWith('glutathione')) return '#E87818';
  if (s.startsWith('bac-water') || s.startsWith('acetic-acid')) return '#C0C0C0';
  if (c.includes('weight loss')) return '#E01818';
  if (c.includes('healing') || c.includes('recovery')) return '#1E86E8';
  if (c.includes('muscle')) return '#2451D8';
  if (c.includes('anti-aging') || c.includes('longevity')) return '#E8B418';
  if (c.includes('sexual') || c.includes('hormone')) return '#E8189E';
  if (c.includes('skin') || c.includes('hair') || c.includes('cosmetic')) return '#9A1FD8';
  if (c.includes('stack')) return '#C0C0C0';
  return '#00C4BC';
}

function doseString(p: LabelProduct): string {
  if (!p.unit_size) return '';
  const m = (p.unit_measure || '').toLowerCase();
  const size = String(p.unit_size).replace(/\.0$/, '');
  if (m === 'ml') return `${size}ML`;
  if (m === 'iu') return `${size}iu`;
  return `${size}${m || 'mg'}`;
}

const SIZE_PRESETS = [
  { key: 'default', label: '3/4" X 1 1/2" (Default)', w: 1.5, h: 0.75 },
  { key: 'small', label: '1/2" X 1"', w: 1, h: 0.5 },
  { key: 'medium', label: '1" X 2"', w: 2, h: 1 },
  { key: 'large', label: '1 1/4" X 2 1/2"', w: 2.5, h: 1.25 },
  { key: 'xl', label: '2" X 4"', w: 4, h: 2 },
  { key: 'custom', label: 'Custom Size', w: 0, h: 0 },
];

export default function PrintLabelsClient({ products, isAdmin }: { products: LabelProduct[]; isAdmin: boolean }) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [sizeKey, setSizeKey] = useState('default');
  const [customW, setCustomW] = useState('1.5');
  const [customH, setCustomH] = useState('0.75');
  const [mode, setMode] = useState<'roll' | 'sheet'>('roll');

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => { if (p.category) set.add(p.category); });
    return ['All', ...Array.from(set).sort()];
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(p => {
      if (activeCategory !== 'All' && p.category !== activeCategory) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        doseString(p).toLowerCase().includes(q)
      );
    });
  }, [products, search, activeCategory]);

  const setQty = (slug: string, qty: number) => {
    setQuantities(prev => {
      const next = { ...prev };
      if (qty <= 0) delete next[slug];
      else next[slug] = Math.min(qty, 999);
      return next;
    });
  };

  const totalSelected = Object.values(quantities).reduce((a, b) => a + b, 0);

  const preset = SIZE_PRESETS.find(s => s.key === sizeKey) || SIZE_PRESETS[0];
  const labelW = sizeKey === 'custom' ? Math.max(0.5, Math.min(8, parseFloat(customW) || 1.5)) : preset.w;
  const labelH = sizeKey === 'custom' ? Math.max(0.25, Math.min(10, parseFloat(customH) || 0.75)) : preset.h;

  const printItems = useMemo(() => {
    const items: { slug: string; name: string }[] = [];
    products.forEach(p => {
      const qty = quantities[p.slug] || 0;
      for (let i = 0; i < qty; i++) items.push({ slug: p.slug, name: p.name });
    });
    return items;
  }, [products, quantities]);

  const handlePrint = () => {
    if (totalSelected === 0) return;
    window.print();
  };

  const pageCss = mode === 'roll'
    ? `@page { size: ${labelW}in ${labelH}in; margin: 0; }
       @media print {
         body * { visibility: hidden !important; }
         #label-print-root, #label-print-root * { visibility: visible !important; }
         #label-print-root { display: block !important; position: absolute; left: 0; top: 0; width: auto; }
         #label-print-root .pl-item { width: ${labelW}in; height: ${labelH}in; page-break-after: always; break-after: page; overflow: hidden; }
         #label-print-root .pl-item img { width: ${labelW}in; height: ${labelH}in; object-fit: fill; display: block; }
       }`
    : `@page { size: letter portrait; margin: 0.25in; }
       @media print {
         body * { visibility: hidden !important; }
         #label-print-root, #label-print-root * { visibility: visible !important; }
         #label-print-root { display: block !important; position: absolute; left: 0; top: 0; width: 8in; font-size: 0; }
         #label-print-root .pl-item { display: inline-block; width: ${labelW}in; height: ${labelH}in; margin: 0.0625in; overflow: hidden; page-break-inside: avoid; break-inside: avoid; }
         #label-print-root .pl-item img { width: ${labelW}in; height: ${labelH}in; object-fit: fill; display: block; }
       }`;

  const surface: React.CSSProperties = { background: '#0F1923', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 };

  return (
    <div style={{ minHeight: '100vh', background: '#050A0F', color: '#FFFFFF', padding: '24px 16px 120px' }}>
      <style dangerouslySetInnerHTML={{ __html: pageCss }} />

      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
          <Link
            href={isAdmin ? '/admin' : '/dashboard/agent'}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#A8B4C0', textDecoration: 'none', fontSize: '0.85rem' }}
          >
            <ArrowLeft size={16} /> Back To Dashboard
          </Link>
        </div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0 0 4px' }}>Print Labels</h1>
        <p style={{ color: '#A8B4C0', fontSize: '0.9rem', margin: '0 0 20px' }}>
          Select Any Labels And Quantities, Pick A Label Size, Then Print. Labels Are Color-Coded By Research Category.
        </p>

        {/* Print Setup */}
        <div style={{ ...surface, padding: 16, marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', color: '#A8B4C0', marginBottom: 6, fontWeight: 600, letterSpacing: '0.04em' }}>Label Size</label>
            <select
              value={sizeKey}
              onChange={e => setSizeKey(e.target.value)}
              style={{ background: '#162230', color: '#FFF', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 8, padding: '10px 12px', fontSize: '0.85rem', minWidth: 200 }}
            >
              {SIZE_PRESETS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>

          {sizeKey === 'custom' && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: '#A8B4C0', marginBottom: 6, fontWeight: 600 }}>Width (Inches)</label>
                <input
                  type="number" step="0.125" min="0.5" max="8" value={customW}
                  onChange={e => setCustomW(e.target.value)}
                  style={{ background: '#162230', color: '#FFF', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 8, padding: '10px 12px', fontSize: '0.85rem', width: 110 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: '#A8B4C0', marginBottom: 6, fontWeight: 600 }}>Height (Inches)</label>
                <input
                  type="number" step="0.125" min="0.25" max="10" value={customH}
                  onChange={e => setCustomH(e.target.value)}
                  style={{ background: '#162230', color: '#FFF', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 8, padding: '10px 12px', fontSize: '0.85rem', width: 110 }}
                />
              </div>
            </>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', color: '#A8B4C0', marginBottom: 6, fontWeight: 600, letterSpacing: '0.04em' }}>Print Mode</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {([
                { key: 'roll', label: 'Label Printer (One Per Label)' },
                { key: 'sheet', label: 'Letter Sheet (Grid)' },
              ] as const).map(m => (
                <button
                  key={m.key}
                  onClick={() => setMode(m.key)}
                  style={{
                    background: mode === m.key ? 'rgba(0,196,188,0.16)' : '#162230',
                    color: mode === m.key ? '#00C4BC' : '#A8B4C0',
                    border: `1px solid ${mode === m.key ? '#00C4BC' : 'rgba(255,255,255,0.14)'}`,
                    borderRadius: 8, padding: '10px 12px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            {totalSelected > 0 && (
              <button
                onClick={() => setQuantities({})}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', color: '#A8B4C0', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 8, padding: '10px 14px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
              >
                <Trash2 size={15} /> Clear All
              </button>
            )}
            <button
              onClick={handlePrint}
              disabled={totalSelected === 0}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: totalSelected === 0 ? 'rgba(0,196,188,0.25)' : '#00C4BC',
                color: '#04211F', border: 'none', borderRadius: 8, padding: '12px 20px',
                fontSize: '0.9rem', fontWeight: 800, cursor: totalSelected === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              <Printer size={17} />
              {totalSelected === 0 ? 'Select Labels To Print' : `Print ${totalSelected} Label${totalSelected === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>

        {/* Search + Category Filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 16 }}>
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#A8B4C0' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search Labels"
              style={{ background: '#162230', color: '#FFF', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 8, padding: '10px 12px 10px 32px', fontSize: '0.85rem', width: 220 }}
            />
          </div>
          {categories.map(cat => {
            const active = activeCategory === cat;
            const dot = cat === 'All' ? '#00C4BC' : categoryColor(cat, '');
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  background: active ? 'rgba(0,196,188,0.14)' : '#0F1923',
                  color: active ? '#FFFFFF' : '#A8B4C0',
                  border: `1px solid ${active ? '#00C4BC' : 'rgba(255,255,255,0.10)'}`,
                  borderRadius: 999, padding: '8px 14px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                }}
              >
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: dot, display: 'inline-block' }} />
                {cat}
              </button>
            );
          })}
        </div>

        {/* Label Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {filtered.map(p => {
            const qty = quantities[p.slug] || 0;
            const accent = categoryColor(p.category, p.slug);
            const dose = doseString(p);
            return (
              <div key={p.id} style={{ ...surface, overflow: 'hidden', outline: qty > 0 ? `2px solid ${accent}` : 'none' }}>
                <div style={{ background: '#FFFFFF', aspectRatio: '2 / 1' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`${STORAGE_BASE}/${p.slug}.png`}
                    alt={`${p.name} Label`}
                    loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                  />
                </div>
                <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '0.83rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.name}{dose ? ` ${dose}` : ''}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: accent, fontWeight: 600 }}>{p.category || 'Uncategorized'}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button
                      onClick={() => setQty(p.slug, qty - 1)}
                      disabled={qty === 0}
                      aria-label={`Remove One ${p.name} Label`}
                      style={{ width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#162230', color: qty === 0 ? '#4A5560' : '#FFF', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 7, cursor: qty === 0 ? 'not-allowed' : 'pointer' }}
                    >
                      <Minus size={14} />
                    </button>
                    <input
                      type="number" min={0} max={999} value={qty === 0 ? '' : qty} placeholder="0"
                      onChange={e => setQty(p.slug, parseInt(e.target.value || '0', 10) || 0)}
                      style={{ width: 46, textAlign: 'center', background: '#162230', color: '#FFF', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 7, padding: '6px 4px', fontSize: '0.85rem' }}
                    />
                    <button
                      onClick={() => setQty(p.slug, qty + 1)}
                      aria-label={`Add One ${p.name} Label`}
                      style={{ width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,196,188,0.14)', color: '#00C4BC', border: '1px solid rgba(0,196,188,0.5)', borderRadius: 7, cursor: 'pointer' }}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div style={{ ...surface, padding: 40, textAlign: 'center', color: '#A8B4C0', marginTop: 8 }}>
            No Labels Match Your Search.
          </div>
        )}
      </div>

      {/* Sticky Print Bar (Mobile Friendly) */}
      {totalSelected > 0 && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: 'rgba(5,10,15,0.94)', borderTop: '1px solid rgba(255,255,255,0.10)', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, zIndex: 50, backdropFilter: 'blur(8px)' }}>
          <span style={{ color: '#A8B4C0', fontSize: '0.85rem' }}>
            {totalSelected} Label{totalSelected === 1 ? '' : 's'} Selected — {sizeKey === 'custom' ? `${labelH}" X ${labelW}"` : preset.label.replace(' (Default)', '')}
          </span>
          <button
            onClick={handlePrint}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#00C4BC', color: '#04211F', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer' }}
          >
            <Printer size={16} /> Print Now
          </button>
        </div>
      )}

      {/* Hidden Print Root - Only Visible To The Printer */}
      <div id="label-print-root" style={{ display: 'none' }}>
        {printItems.map((item, i) => (
          <div key={`${item.slug}-${i}`} className="pl-item">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${STORAGE_BASE}/${item.slug}.png`} alt={`${item.name} Label`} />
          </div>
        ))}
      </div>
    </div>
  );
}
