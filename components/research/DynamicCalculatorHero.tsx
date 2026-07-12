'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';

const CALCULATORS = [
  {
    id: 'reconstitution',
    label: 'Reconstitution',
    desc: 'Calculate exactly how much bacteriostatic water to add to your lyophilized peptide vial to hit a target concentration, then read off your syringe draw in units.',
    col: 1, // 1 = leftmost column, 6 = rightmost — used for tooltip alignment
  },
  {
    id: 'dilution',
    label: 'Serial Dilution',
    desc: 'Design multi-step dilution curves for dose-response assays. Calculates concentrations and pipetting volumes for each tube in the series.',
    col: 2,
  },
  {
    id: 'concentration',
    label: 'Concentration Converter',
    desc: 'Convert between mass units (mg/mL, mcg/mL, ng/mL) and molar units (mmol/L, µmol/L, nmol/L). Pulls molecular weight automatically from the compound database.',
    col: 3,
  },
  {
    id: 'stability',
    label: 'Arrhenius Stability',
    desc: 'Predicts how long a peptide stays potent at a new storage temperature using the Arrhenius equation — the same math used in pharmaceutical stability testing.',
    col: 4,
  },
  {
    id: 'cost',
    label: 'Cost Per Dose',
    desc: 'Enter a vial price, peptide mass, and your per-dose amount to instantly see cost-per-dose, doses-per-vial, and projected monthly / annual spend. Side-by-side vendor comparison included.',
    col: 5,
  },
  {
    id: 'pooling',
    label: 'Vial Pooling',
    desc: 'Aggregate multiple vials into one working stock. Accounts for pipette tip type, fluid viscosity, and transfer loss to give you the true final concentration.',
    col: 6, // rightmost
  },
  {
    id: 'hplc-rt',
    label: 'HPLC RT Predictor',
    desc: 'Estimates reversed-phase HPLC retention time for a peptide sequence based on amino acid hydrophobicity (Kyte–Doolittle scale) — useful for method development.',
    col: 1,
  },
  {
    id: 'mass-spec',
    label: 'Mass Spec m/z',
    desc: 'Predicts ESI-MS charge-state envelopes (m/z peaks) for a peptide sequence. Enter the sequence to see expected [M+H]⁺, [M+2H]²⁺, and higher charge states.',
    col: 2,
  },
  {
    id: 'spps-cost',
    label: 'Fmoc-SPPS Cost',
    desc: 'Estimates solid-phase peptide synthesis reagent cost using Fmoc amino acid prices, coupling cycles, resin load, and scale — useful for budgeting custom synthesis runs.',
    col: 3,
  },
  {
    id: 'solubility',
    label: 'Solubility Predictor',
    desc: 'Predicts aqueous solubility of a peptide from its sequence using charge, hydrophobicity, and isoelectric point — flags sequences likely to precipitate.',
    col: 4,
  },
  {
    id: 'vial-quantity',
    label: 'Vial Quantity Power',
    desc: 'Calculates how many vials you need to complete a research protocol given a dose amount, schedule, number of subjects, and desired buffer supply.',
    col: 5,
  },
  {
    id: 'shelf-life',
    label: 'Shelf Life Tracker',
    desc: 'Track reconstituted vial shelf life and get expiry alerts based on the compound and storage temperature.',
    col: 6,
  },
];

export default function DynamicCalculatorHero({
  onSelect,
  activeId,
}: {
  onSelect?: (id: string) => void;
  activeId?: string | null;
}) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const results = query.trim()
    ? CALCULATORS.filter(c => c.label.toLowerCase().includes(query.toLowerCase()))
    : [];

  const handleSelect = (id: string) => {
    setQuery('');
    setFocused(false);
    onSelect?.(id);
  };

  // Tooltip horizontal alignment based on column position to prevent off-screen clipping
  const tipAlign = (col: number): React.CSSProperties => {
    if (col === 1) return { left: 0, transform: 'translateY(0)', right: 'auto' };
    if (col === 6) return { right: 0, left: 'auto', transform: 'translateY(0)' };
    return { left: '50%', transform: 'translateX(-50%) translateY(0)' };
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* ── Desktop / tablet: image-based grid ── */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 1024,
          aspectRatio: '1024/564',
          margin: '0 auto 8px',
          display: 'block',
        }}
        className="calc-hero-desktop"
      >
        <Image
          src="/images/researcher_calculators_hero.png"
          alt="Researcher Calculators Dashboard"
          fill
          style={{ objectFit: 'contain' }}
          priority
          unoptimized
        />

        {/* Back Button */}
        <Link
          href="/research"
          aria-label="Back To Research Library"
          style={{ position: 'absolute', top: '17%', right: '5%', width: '25%', height: '10%', zIndex: 10, display: 'block' }}
        />

        {/* Search Bar Wrapper */}
        <div
          ref={wrapperRef}
          style={{ position: 'absolute', top: '30%', left: '8%', right: '8%', height: '9.5%', zIndex: 20 }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (results.length > 0) handleSelect(results[0].id);
            }}
            style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}
            role="search"
          >
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              aria-label="Search Calculators"
              placeholder="Search calculators…"
              style={{
                flex: 1,
                height: '100%',
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: '1rem',
                outline: 'none',
                padding: '0 10px 0 45px',
              }}
            />
          </form>

          {/* Autocomplete Dropdown */}
          {focused && query.trim() && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: '40px',
              right: 0,
              background: 'var(--surface-1, #1A1C20)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              marginTop: '4px',
              overflow: 'hidden',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            }}>
              {results.length > 0 ? results.map(r => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handleSelect(r.id)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '12px 16px',
                    background: 'transparent', border: 'none',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    color: '#fff', fontSize: '0.9rem', cursor: 'pointer',
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'rgba(0,196,188,0.1)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  {r.label}
                </button>
              )) : (
                <div style={{ padding: '12px 16px', color: '#888', fontSize: '0.9rem' }}>
                  No Calculators Found.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Grid Overlay — transparent hit-targets with rich hover tooltips */}
        <style dangerouslySetInnerHTML={{ __html: `
          .calc-hero-btn {
            position: relative; background: transparent; border: none; cursor: pointer;
            width: 100%; height: 100%; display: block;
            border-radius: 6px;
            transition: box-shadow 0.18s ease;
          }
          .calc-hero-btn[data-active="true"] {
            box-shadow: inset 0 0 0 2px rgba(0,229,255,0.7), 0 0 12px rgba(0,229,255,0.3);
            background: rgba(0,229,255,0.06);
          }
          .calc-hero-btn:hover { box-shadow: inset 0 0 0 1px rgba(0,229,255,0.35); }
          .calc-hero-btn:hover .calc-tip { opacity: 1; pointer-events: auto; transform: translateY(0); }
          .calc-tip {
            position: absolute;
            bottom: calc(100% + 8px);
            min-width: 210px;
            max-width: 250px;
            background: rgba(8,10,20,0.97);
            border: 1px solid rgba(0,229,255,0.35);
            border-radius: 10px;
            padding: 10px 13px;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.18s ease, transform 0.18s ease;
            z-index: 999;
            backdrop-filter: blur(12px);
            box-shadow: 0 8px 32px rgba(0,0,0,0.8), 0 0 0 1px rgba(0,229,255,0.08);
            text-align: left;
            transform: translateY(6px);
          }
          .calc-tip-name {
            display: block; font-weight: 800; font-size: 12px; color: #00E5FF;
            margin-bottom: 5px; letter-spacing: 0.04em; text-transform: uppercase;
          }
          .calc-tip-desc {
            display: block; font-size: 11px; color: #A8B4C0;
            line-height: 1.5; font-weight: 400; text-transform: none;
          }
          .calc-tip-cta {
            display: inline-block; margin-top: 6px; font-size: 10px;
            font-weight: 700; color: #00E5FF; text-transform: uppercase; letter-spacing: 0.06em;
          }
          /* Mobile: hide the desktop image grid entirely */
          @media (max-width: 640px) { .calc-hero-desktop { display: none !important; } }
        ` }} />
        <div style={{
          position: 'absolute',
          top: '45.2%', bottom: '6.1%', left: '5.8%', right: '5.9%',
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gridTemplateRows: 'repeat(2, 1fr)',
          columnGap: '1.5%',
          rowGap: '6%',
          zIndex: 10,
        }}>
          {CALCULATORS.slice(0, 6).map(calc => (
            <button
              key={calc.id}
              type="button"
              aria-label={`Open ${calc.label} calculator`}
              aria-pressed={activeId === calc.id}
              className="calc-hero-btn"
              data-active={activeId === calc.id ? 'true' : undefined}
              onClick={() => handleSelect(calc.id)}
            >
              <span className="calc-tip" style={tipAlign(calc.col)}>
                <span className="calc-tip-name">{calc.label}</span>
                <span className="calc-tip-desc">{calc.desc}</span>
                <span className="calc-tip-cta">Open Calculator →</span>
              </span>
            </button>
          ))}
          {CALCULATORS.slice(6, 11).map(calc => (
            <button
              key={calc.id}
              type="button"
              aria-label={`Open ${calc.label} calculator`}
              aria-pressed={activeId === calc.id ? true : undefined}
              className="calc-hero-btn"
              data-active={activeId === calc.id ? 'true' : undefined}
              onClick={() => handleSelect(calc.id)}
            >
              <span className="calc-tip" style={tipAlign(calc.col)}>
                <span className="calc-tip-name">{calc.label}</span>
                <span className="calc-tip-desc">{calc.desc}</span>
                <span className="calc-tip-cta">Open Calculator →</span>
              </span>
            </button>
          ))}
          <div /> {/* Empty 6th slot in row 2 */}
        </div>
      </div>

      {/* ── Mobile: pill-button grid (shown when desktop grid is hidden) ── */}
      <div className="calc-hero-mobile" style={{ display: 'none', padding: '0 16px 8px' }}>
        <style dangerouslySetInnerHTML={{ __html: `
          @media (max-width: 640px) { .calc-hero-mobile { display: block !important; } }
        ` }} />
        {/* Mobile search */}
        <div style={{ marginBottom: 12 }}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search Calculators"
            placeholder="Search calculators…"
            style={{
              width: '100%', height: 44, boxSizing: 'border-box',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(0,229,255,0.25)',
              borderRadius: 10, color: '#fff', fontSize: 15,
              padding: '0 14px', outline: 'none',
            }}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {CALCULATORS.filter(c =>
            !query.trim() || c.label.toLowerCase().includes(query.toLowerCase())
          ).map(calc => (
            <button
              key={calc.id}
              type="button"
              onClick={() => handleSelect(calc.id)}
              aria-pressed={activeId === calc.id}
              style={{
                padding: '12px 10px',
                borderRadius: 10,
                border: activeId === calc.id
                  ? '1.5px solid #00E5FF'
                  : '1px solid rgba(255,255,255,0.1)',
                background: activeId === calc.id
                  ? 'rgba(0,229,255,0.1)'
                  : 'rgba(255,255,255,0.04)',
                color: activeId === calc.id ? '#00E5FF' : '#D1D5DB',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.15s',
                lineHeight: 1.3,
              }}
            >
              {calc.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}