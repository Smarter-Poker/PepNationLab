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

const STORAGE_ROOT = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/print-labels`;
const brandBase = (brand: 'pepnation' | 'savage') => brand === 'savage' ? `${STORAGE_ROOT}/savage` : STORAGE_ROOT;

/** Category accent colors – mirrors the label artwork color system. */
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
  if (m === 'iu') return `${size}IU`;
  return `${size}${(m || 'mg').toUpperCase()}`;
}

// ─── Pep Nation Dynamic Label Helpers ──────────────────────────────────────

/** Scale peptide name font size (px) by character count for screen preview. */
function pepNameFontPx(name: string): number {
  const len = name.length;
  if (len <= 7)  return 28;
  if (len <= 10) return 23;
  if (len <= 13) return 19;
  if (len <= 17) return 15;
  if (len <= 22) return 12;
  return 10;
}

/** Scale peptide name font size (pt) by character count for print. */
function pepNameFontPt(name: string): string {
  const len = name.length;
  if (len <= 7)  return '14pt';
  if (len <= 10) return '11.5pt';
  if (len <= 13) return '9.5pt';
  if (len <= 17) return '8pt';
  if (len <= 22) return '6.5pt';
  return '5.5pt';
}

/**
 * Builds a self-contained HTML snippet for one Pep Nation label
 * at the exact target print dimensions. Used inside the print popup window.
 */
function buildPepNationLabelHtml(name: string, dose: string, logoUrl: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const nameFontSize = pepNameFontPt(name);
  const doseSpan = dose
    ? `<span class="pnl-mg">${esc(dose)}</span>`
    : `<span style="display:inline-block;width:18pt"></span>`;
  return (
    `<div class="pnl">` +
      `<div class="pnl-top"></div>` +
      `<div class="pnl-main">` +
        `<div class="pnl-logo-row">${doseSpan}<img class="pnl-logo" src="${esc(logoUrl)}" alt="Pep Nation">${doseSpan}</div>` +
        `<div class="pnl-name" style="font-size:${nameFontSize}">${esc(name)}</div>` +
      `</div>` +
      `<div class="pnl-footer"><span class="pnl-ftext">FOR RESEARCH USE ONLY</span></div>` +
    `</div>`
  );
}

/** CSS injected into every Pep Nation print window. */
const PEP_NATION_LABEL_CSS = `
  .pnl{background:#000;display:flex;flex-direction:column;font-family:Impact,'Arial Narrow',Arial,sans-serif;overflow:hidden;box-sizing:border-box;}
  .pnl-top{height:2pt;background:#C0C0C0;flex-shrink:0;}
  .pnl-main{flex:1;display:flex;flex-direction:column;}
  .pnl-logo-row{flex:1;display:flex;align-items:center;justify-content:space-between;padding:1pt 5pt;}
  .pnl-mg{color:#CCCCCC;font-style:italic;font-size:14pt;line-height:1;text-shadow:-1pt -1pt 0 #0a1a50,1pt -1pt 0 #0a1a50,-1pt 1pt 0 #0a1a50,1pt 1pt 0 #0a1a50;}
  .pnl-logo{height:22pt;width:auto;object-fit:contain;}
  .pnl-name{color:#CCCCCC;text-align:center;line-height:1;letter-spacing:0.5pt;padding:1pt 3pt 0;flex-shrink:0;}
  .pnl-footer{background:#C0C0C0;height:11pt;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
  .pnl-ftext{font-size:4.5pt;font-weight:700;color:#111;letter-spacing:0.5pt;}
`;

/**
 * Screen-side preview of one Pep Nation label rendered with React/CSS.
 * Fills its parent container at a 2:1 aspect ratio.
 */
function PepNationLabelPreview({ name, dose }: { name: string; dose: string }) {
  const nameFontSize = pepNameFontPx(name);
  const stroke =
    '-2px -2px 0 #0a1a50,2px -2px 0 #0a1a50,-2px 2px 0 #0a1a50,2px 2px 0 #0a1a50,' +
    '-3px 0 0 #0a1a50,3px 0 0 #0a1a50';

  return (
    <div style={{
      width: '100%', aspectRatio: '2 / 1', background: '#000',
      display: 'flex', flexDirection: 'column',
      fontFamily: "Impact, 'Arial Narrow', Arial, sans-serif",
      overflow: 'hidden',
    }}>
      {/* Thin top line */}
      <div style={{ height: 3, background: '#C0C0C0', flexShrink: 0 }} />

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Logo row */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: '4px 10px',
        }}>
          {dose
            ? <span style={{ color: '#CCCCCC', fontStyle: 'italic', fontSize: 28, lineHeight: 1, textShadow: stroke }}>{dose}</span>
            : <span />}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/pep-nation-label-logo.png"
            alt="Pep Nation"
            style={{ height: 50, width: 'auto', objectFit: 'contain' }}
          />
          {dose
            ? <span style={{ color: '#CCCCCC', fontStyle: 'italic', fontSize: 28, lineHeight: 1, textShadow: stroke }}>{dose}</span>
            : <span />}
        </div>

        {/* Peptide name */}
        <div style={{
          color: '#CCCCCC', fontSize: nameFontSize,
          textAlign: 'center', letterSpacing: 2,
          lineHeight: 1, padding: '0 6px 3px',
        }}>
          {name}
        </div>
      </div>

      {/* Footer stripe */}
      <div style={{
        background: '#C0C0C0', height: 22,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 8, fontWeight: 700, color: '#111', letterSpacing: 1 }}>
          FOR RESEARCH USE ONLY
        </span>
      </div>
    </div>
  );
}

// ─── Size Presets ──────────────────────────────────────────────────────────

const SIZE_PRESETS = [
  { key: 'default', label: '3/4" X 1 1/2" (Default)', w: 1.5, h: 0.75 },
  { key: 'small',   label: '1/2" X 1"',               w: 1,   h: 0.5  },
  { key: 'medium',  label: '1" X 2"',                  w: 2,   h: 1    },
  { key: 'large',   label: '1 1/4" X 2 1/2"',          w: 2.5, h: 1.25 },
  { key: 'xl',      label: '2" X 4"',                  w: 4,   h: 2    },
  { key: 'custom',  label: 'Custom Size',              w: 0,   h: 0    },
];

// ─── Main Component ────────────────────────────────────────────────────────

export default function PrintLabelsClient({
  products,
  isAdmin,
  brand = 'pepnation',
}: {
  products: LabelProduct[];
  isAdmin: boolean;
  brand?: 'pepnation' | 'savage';
}) {
  const STORAGE_BASE = brandBase(brand);
  const isPepNation = brand === 'pepnation';

  const [search, setSearch]               = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [quantities, setQuantities]       = useState<Record<string, number>>({});
  const [sizeKey, setSizeKey]             = useState('default');
  const [customW, setCustomW]             = useState('1.5');
  const [customH, setCustomH]             = useState('0.75');
  const [mode, setMode]                   = useState<'avery' | 'roll' | 'grid'>('avery');
  const [bleed, setBleed]                 = useState<number>(1.06);

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
  const labelW = sizeKey === 'custom' ? Math.max(0.5, Math.min(8,  parseFloat(customW) || 1.5)) : preset.w;
  const labelH = sizeKey === 'custom' ? Math.max(0.25, Math.min(10, parseFloat(customH) || 0.75)) : preset.h;

  const printItems = useMemo(() => {
    const items: { slug: string; name: string; dose: string }[] = [];
    products.forEach(p => {
      const qty  = quantities[p.slug] || 0;
      const dose = doseString(p);
      for (let i = 0; i < qty; i++) items.push({ slug: p.slug, name: p.name, dose });
    });
    return items;
  }, [products, quantities]);

  // Avery 61525 geometry (PermaTrack Asset Tags, 3/4" × 1 1/2", 40 per sheet)
  const AVERY_COLS       = [0.5, 2.5, 4.5, 6.5];
  const AVERY_TOP        = 0.625;
  const AVERY_PITCH_Y    = 1.0;
  const AVERY_PER_SHEET  = 40;

  const buildPrintDocument = (): string => {
    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

    // For Savage: static images from Supabase storage.
    const imgTag = (slug: string, name: string) =>
      `<img src="${STORAGE_BASE}/${esc(slug)}.png?v=6" alt="${esc(name)}">`;

    // For Pep Nation: CSS labels (logo served from same origin as the page).
    const logoUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/pep-nation-label-logo.png`
        : '/pep-nation-label-logo.png';

    let pages = '';
    let css   = '';

    /* ── Avery 61525 sheet mode ── */
    if (mode === 'avery') {
      if (isPepNation) {
        css = `
          @page { size: 8.5in 11in; margin: 0; }
          body { margin: 0; }
          .sheet { position:relative; width:8.5in; height:11in; page-break-after:always; overflow:hidden; }
          .cell  { position:absolute; width:1.5in; height:0.75in; overflow:hidden; }
          .cell .pnl {
            position:absolute;
            width:calc(1.5in * ${bleed}); height:calc(0.75in * ${bleed});
            top:50%; left:50%; transform:translate(-50%,-50%);
          }
          ${PEP_NATION_LABEL_CSS}
        `;
        for (let s = 0; s * AVERY_PER_SHEET < printItems.length; s++) {
          const batch = printItems.slice(s * AVERY_PER_SHEET, (s + 1) * AVERY_PER_SHEET);
          const cells = batch.map((item, i) => {
            const col  = i % 4;
            const row  = Math.floor(i / 4);
            const left = AVERY_COLS[col];
            const top  = AVERY_TOP + row * AVERY_PITCH_Y;
            return `<div class="cell" style="left:${left}in;top:${top}in;">${buildPepNationLabelHtml(item.name, item.dose, logoUrl)}</div>`;
          }).join('');
          pages += `<div class="sheet">${cells}</div>`;
        }
      } else {
        css = `
          @page { size: 8.5in 11in; margin: 0; }
          body { margin: 0; }
          .sheet { position:relative; width:8.5in; height:11in; page-break-after:always; overflow:hidden; }
          .cell  { position:absolute; width:1.5in; height:0.75in; overflow:hidden; }
          .cell img {
            display:block; position:absolute;
            width:calc(1.5in * ${bleed}); height:calc(0.75in * ${bleed});
            top:50%; left:50%; transform:translate(-50%,-50%); object-fit:fill;
          }
        `;
        for (let s = 0; s * AVERY_PER_SHEET < printItems.length; s++) {
          const batch = printItems.slice(s * AVERY_PER_SHEET, (s + 1) * AVERY_PER_SHEET);
          const cells = batch.map((item, i) => {
            const col  = i % 4;
            const row  = Math.floor(i / 4);
            const left = AVERY_COLS[col];
            const top  = AVERY_TOP + row * AVERY_PITCH_Y;
            return `<div class="cell" style="left:${left}in;top:${top}in;">${imgTag(item.slug, item.name)}</div>`;
          }).join('');
          pages += `<div class="sheet">${cells}</div>`;
        }
      }

    /* ── Roll mode (1 label per page) ── */
    } else if (mode === 'roll') {
      if (isPepNation) {
        css = `
          @page { size: ${labelW}in ${labelH}in; margin: 0; }
          body { margin: 0; }
          .pl { width:${labelW}in; height:${labelH}in; page-break-after:always; overflow:hidden; position:relative; }
          .pl .pnl {
            position:absolute;
            width:calc(${labelW}in * ${bleed}); height:calc(${labelH}in * ${bleed});
            top:50%; left:50%; transform:translate(-50%,-50%);
          }
          ${PEP_NATION_LABEL_CSS}
        `;
        pages = printItems
          .map(item => `<div class="pl">${buildPepNationLabelHtml(item.name, item.dose, logoUrl)}</div>`)
          .join('');
      } else {
        css = `
          @page { size: ${labelW}in ${labelH}in; margin: 0; }
          body { margin: 0; }
          .pl { width:${labelW}in; height:${labelH}in; page-break-after:always; overflow:hidden; position:relative; }
          .pl img {
            display:block; position:absolute;
            width:calc(${labelW}in * ${bleed}); height:calc(${labelH}in * ${bleed});
            top:50%; left:50%; transform:translate(-50%,-50%); object-fit:fill;
          }
        `;
        pages = printItems
          .map(item => `<div class="pl">${imgTag(item.slug, item.name)}</div>`)
          .join('');
      }

    /* ── Grid mode (multiple per page) ── */
    } else {
      if (isPepNation) {
        css = `
          @page { size: 8.5in 11in; margin: 0.25in; }
          body { margin: 0; font-size: 0; }
          .pl {
            display:inline-block; width:${labelW}in; height:${labelH}in;
            margin:0.0625in; overflow:hidden;
            page-break-inside:avoid; break-inside:avoid; position:relative;
          }
          .pl .pnl {
            position:absolute;
            width:calc(${labelW}in * ${bleed}); height:calc(${labelH}in * ${bleed});
            top:50%; left:50%; transform:translate(-50%,-50%);
          }
          ${PEP_NATION_LABEL_CSS}
        `;
        pages = printItems
          .map(item => `<div class="pl">${buildPepNationLabelHtml(item.name, item.dose, logoUrl)}</div>`)
          .join('');
      } else {
        css = `
          @page { size: 8.5in 11in; margin: 0.25in; }
          body { margin: 0; font-size: 0; }
          .pl {
            display:inline-block; width:${labelW}in; height:${labelH}in;
            margin:0.0625in; overflow:hidden;
            page-break-inside:avoid; break-inside:avoid; position:relative;
          }
          .pl img {
            display:block; position:absolute;
            width:calc(${labelW}in * ${bleed}); height:calc(${labelH}in * ${bleed});
            top:50%; left:50%; transform:translate(-50%,-50%); object-fit:fill;
          }
        `;
        pages = printItems
          .map(item => `<div class="pl">${imgTag(item.slug, item.name)}</div>`)
          .join('');
      }
    }

    // Wait for all images to load before triggering print
    const waitScript =
      `<script>(function(){` +
        `var imgs=Array.prototype.slice.call(document.images);` +
        `var pending=imgs.length;var fired=false;` +
        `function go(){if(fired)return;fired=true;setTimeout(function(){window.focus();window.print();},300);}` +
        `if(!pending){go();return;}` +
        `imgs.forEach(function(img){` +
          `function done(){if(--pending<=0)go();}` +
          `if(img.complete&&img.naturalWidth>0){done();}` +
          `else{img.addEventListener('load',done);img.addEventListener('error',done);}` +
        `});` +
        `setTimeout(go,15000);` +
        `window.onafterprint=function(){setTimeout(function(){window.close();},300);};` +
      `})();<` + `/script>`;

    return `<!DOCTYPE html><html><head><title>Pep Nation Labels</title><style>${css}</style></head><body>${pages}${waitScript}</body></html>`;
  };

  const handlePrint = () => {
    if (totalSelected === 0) return;
    const win = window.open('', '_blank');
    if (!win) {
      alert('Please Allow Pop-Ups For This Site To Print Labels.');
      return;
    }
    win.document.open();
    win.document.write(buildPrintDocument());
    win.document.close();
  };

  const surface: React.CSSProperties = {
    background: '#0F1923',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
  };

  return (
    <div style={{ minHeight: '100vh', background: '#050A0F', color: '#FFFFFF', padding: '24px 16px 120px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
          <Link
            href="/dashboard"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#A8B4C0', textDecoration: 'none', fontSize: '0.85rem' }}
          >
            <ArrowLeft size={16} /> Dashboard
          </Link>
        </div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0 0 4px' }}>Print Labels</h1>
        <p style={{ color: '#A8B4C0', fontSize: '0.9rem', margin: '0 0 20px' }}>
          Select quantities then click print. Labels are exactly 1.5&quot; × 0.75&quot;.
        </p>

        {/* Toolbar */}
        <div style={{ ...surface, padding: 16, marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end' }}>

          {mode === 'avery' ? (
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: '#A8B4C0', marginBottom: 6, fontWeight: 600, letterSpacing: '0.04em' }}>Label Size</label>
              <div style={{ background: '#162230', color: '#A8B4C0', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 8, padding: '10px 12px', fontSize: '0.85rem', minWidth: 200 }}>
                3/4&quot; × 1 1/2&quot; (Avery 61525 Fixed)
              </div>
            </div>
          ) : (
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
          )}

          {mode !== 'avery' && sizeKey === 'custom' && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: '#A8B4C0', marginBottom: 6, fontWeight: 600 }}>Width (Inches)</label>
                <input
                  type="number" step="0.25" value={customW}
                  onChange={e => setCustomW(e.target.value)}
                  style={{ background: '#162230', color: '#FFF', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 8, padding: '10px 12px', fontSize: '0.85rem', width: 110 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: '#A8B4C0', marginBottom: 6, fontWeight: 600 }}>Height (Inches)</label>
                <input
                  type="number" step="0.25" value={customH}
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
                { key: 'avery', label: 'Avery 61525 Sheet (40 Per Page)' },
                { key: 'roll',  label: 'Roll (1 Per Page)' },
                { key: 'grid',  label: 'Grid (Multiple Per Page)' },
              ] as const).map(m => (
                <button
                  key={m.key}
                  onClick={() => setMode(m.key)}
                  style={{
                    background: mode === m.key ? 'rgba(0,196,188,0.14)' : '#162230',
                    color:      mode === m.key ? '#00C4BC' : '#A8B4C0',
                    border:     `1px solid ${mode === m.key ? '#00C4BC' : 'rgba(255,255,255,0.14)'}`,
                    borderRadius: 8, padding: '10px 12px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', color: '#A8B4C0', marginBottom: 6, fontWeight: 600, letterSpacing: '0.04em' }}>Bleed (Overscan)</label>
            <select
              value={bleed}
              onChange={e => setBleed(parseFloat(e.target.value))}
              style={{ background: '#162230', color: '#FFF', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 8, padding: '10px 12px', fontSize: '0.85rem', minWidth: 140 }}
            >
              <option value={1}>None (Exact Fit)</option>
              <option value={1.02}>Small (+2%)</option>
              <option value={1.04}>Standard (+4%)</option>
              <option value={1.06}>Medium (+6%) — Recommended</option>
              <option value={1.08}>Large (+8%)</option>
              <option value={1.10}>Extra Large (+10%) — Physical Avery</option>
            </select>
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

        <p style={{ color: '#6E7B88', fontSize: '0.75rem', margin: '-8px 0 16px' }}>
          Tip: In The Browser Print Dialog Set Margins To None And Scale To 100% So Labels Line Up Exactly.
        </p>

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
            const dot    = cat === 'All' ? '#00C4BC' : categoryColor(cat, '');
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  background: active ? 'rgba(0,196,188,0.14)' : '#0F1923',
                  color:      active ? '#FFFFFF' : '#A8B4C0',
                  border:     `1px solid ${active ? '#00C4BC' : 'rgba(255,255,255,0.10)'}`,
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
            const qty    = quantities[p.slug] || 0;
            const accent = categoryColor(p.category, p.slug);
            const dose   = doseString(p);
            return (
              <div key={p.id} style={{ ...surface, overflow: 'hidden', outline: qty > 0 ? `2px solid ${accent}` : 'none' }}>

                {/* Label preview */}
                {isPepNation ? (
                  <PepNationLabelPreview name={p.name} dose={dose} />
                ) : (
                  <div style={{ background: '#FFFFFF', aspectRatio: '2 / 1' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`${STORAGE_BASE}/${p.slug}.png?v=6`}
                      alt={`${p.name} Label`}
                      loading="lazy"
                      style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                    />
                  </div>
                )}

                {/* Name + quantity controls */}
                <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '0.83rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.name}{dose ? ` ${dose}` : ''}
                    </div>
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
                      type="number" min={0} max={999}
                      value={qty === 0 ? '' : qty} placeholder="0"
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

      {/* Sticky Print Bar (mobile-friendly) */}
      {totalSelected > 0 && (
        <div style={{
          position: 'fixed', left: 0, right: 0, bottom: 0,
          background: 'rgba(5,10,15,0.94)',
          borderTop: '1px solid rgba(255,255,255,0.10)',
          padding: '10px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          zIndex: 50, backdropFilter: 'blur(8px)',
        }}>
          <span style={{ color: '#A8B4C0', fontSize: '0.85rem' }}>
            {totalSelected} Label{totalSelected === 1 ? '' : 's'} Selected —{' '}
            {mode === 'avery'
              ? `Avery 61525 (${Math.ceil(totalSelected / 40)} Sheet${Math.ceil(totalSelected / 40) === 1 ? '' : 's'})`
              : sizeKey === 'custom'
                ? `${labelH}" × ${labelW}"`
                : preset.label.replace(' (Default)', '')}
          </span>
          <button
            onClick={handlePrint}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#00C4BC', color: '#04211F', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer' }}
          >
            <Printer size={16} /> Print Now
          </button>
        </div>
      )}
    </div>
  );
}
