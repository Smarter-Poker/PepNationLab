'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';

const CALCULATORS = [
  {
    id: 'reconstitution',
    label: 'Reconstitution',
    desc: 'Calculate exactly how much bacteriostatic water to add to your lyophilized peptide vial to hit a target concentration, then read off your syringe draw in units.'
  },
  {
    id: 'dilution',
    label: 'Serial Dilution',
    desc: 'Design multi-step dilution curves for dose-response assays. Calculates concentrations and pipetting volumes for each tube in the series.'
  },
  {
    id: 'concentration',
    label: 'Concentration Converter',
    desc: 'Convert between mass units (mg/mL, mcg/mL, ng/mL) and molar units (mmol/L, µmol/L, nmol/L). Pulls molecular weight automatically from the compound database.'
  },
  {
    id: 'stability',
    label: 'Arrhenius Stability',
    desc: 'Predicts how long a peptide stays potent at a new storage temperature using the Arrhenius equation — the same math used in pharmaceutical stability testing.'
  },
  {
    id: 'cost',
    label: 'Cost Per Dose',
    desc: 'Enter a vial price, peptide mass, and your per-dose amount to instantly see cost-per-dose, doses-per-vial, and projected monthly / annual spend. Side-by-side vendor comparison included.'
  },
  {
    id: 'pooling',
    label: 'Vial Pooling',
    desc: 'Aggregate multiple vials into one working stock. Accounts for pipette tip type, fluid viscosity, and transfer loss to give you the true final concentration.'
  },
  {
    id: 'hplc-rt',
    label: 'HPLC RT Predictor',
    desc: 'Estimates reversed-phase HPLC retention time for a peptide sequence based on amino acid hydrophobicity (Kyte–Doolittle scale) — useful for method development.'
  },
  {
    id: 'mass-spec',
    label: 'Mass Spec m/z',
    desc: 'Predicts ESI-MS charge-state envelopes (m/z peaks) for a peptide sequence. Enter the sequence to see expected [M+H]⁺, [M+2H]²⁺, and higher charge states.'
  },
  {
    id: 'spps-cost',
    label: 'Fmoc-SPPS Cost',
    desc: 'Estimates solid-phase peptide synthesis reagent cost using Fmoc amino acid prices, coupling cycles, resin load, and scale — useful for budgeting custom synthesis runs.'
  },
  {
    id: 'solubility',
    label: 'Solubility Predictor',
    desc: 'Predicts aqueous solubility of a peptide from its sequence using charge, hydrophobicity, and isoelectric point — flags sequences likely to precipitate.'
  },
  {
    id: 'vial-quantity',
    label: 'Vial Quantity Power',
    desc: 'Calculates how many vials you need to complete a research protocol given a dose amount, schedule, number of subjects, and desired buffer supply.'
  },
  {
    id: 'shelf-life',
    label: 'Shelf Life Tracker',
    desc: 'Track reconstituted vial shelf life and get expiry alerts based on the compound and storage temperature.'
  },
];


export default function DynamicCalculatorHero({ onSelect }: { onSelect?: (id: string) => void }) {
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

  const buttonStyle: React.CSSProperties = { 
    background: 'transparent', 
    border: 'none', 
    cursor: 'pointer',
    width: '100%',
    height: '100%',
    display: 'block'
  };

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 1024, aspectRatio: '1024/564', margin: '0 auto 40px' }}>
      <Image 
        src="/images/researcher_calculators_hero.png" 
        alt="Researcher Calculators Dashboard" 
        fill 
        style={{ objectFit: 'contain' }}
        priority
      unoptimized />

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
            if (results.length > 0) {
              handleSelect(results[0].id);
            }
          }}
          style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}
        >
          <input 
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            aria-label="Search Calculators"
            style={{ 
              flex: 1,
              height: '100%', 
              background: 'transparent', 
              border: 'none', 
              color: '#fff', 
              fontSize: '1rem', 
              outline: 'none',
              padding: '0 10px 0 45px' // Moved over past the magnifying glass
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
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
          }}>
            {results.length > 0 ? results.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => handleSelect(r.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '12px 16px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  color: '#fff',
                  fontSize: '0.9rem',
                  cursor: 'pointer'
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
        .calc-hero-btn { position: relative; background: transparent; border: none; cursor: pointer; width: 100%; height: 100%; display: block; }
        .calc-hero-btn:hover .calc-tip { opacity: 1; pointer-events: auto; transform: translateY(0); }
        .calc-tip {
          position: absolute;
          bottom: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%) translateY(6px);
          min-width: 200px;
          max-width: 240px;
          background: rgba(8, 10, 20, 0.97);
          border: 1px solid rgba(0, 229, 255, 0.35);
          border-radius: 10px;
          padding: 10px 13px;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.18s ease, transform 0.18s ease;
          z-index: 999;
          backdrop-filter: blur(12px);
          box-shadow: 0 8px 32px rgba(0,0,0,0.8), 0 0 0 1px rgba(0,229,255,0.08);
          text-align: left;
        }
        .calc-tip-name {
          display: block;
          font-weight: 800;
          font-size: 12px;
          color: #00E5FF;
          margin-bottom: 5px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .calc-tip-desc {
          display: block;
          font-size: 11px;
          color: #A8B4C0;
          line-height: 1.5;
          font-weight: 400;
          text-transform: none;
        }
        .calc-tip-cta {
          display: inline-block;
          margin-top: 6px;
          font-size: 10px;
          font-weight: 700;
          color: #00E5FF;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
      ` }} />
      <div style={{ 
        position: 'absolute', 
        top: '45.2%', 
        bottom: '6.1%', 
        left: '5.8%', 
        right: '5.9%', 
        display: 'grid', 
        gridTemplateColumns: 'repeat(6, 1fr)', 
        gridTemplateRows: 'repeat(2, 1fr)', 
        columnGap: '1.5%',
        rowGap: '6%',
        zIndex: 10
      }}>
        {/* Row 1: first 6 calculators */}
        {CALCULATORS.slice(0, 6).map(calc => (
          <button
            key={calc.id}
            type="button"
            aria-label={calc.label}
            className="calc-hero-btn"
            onClick={() => onSelect?.(calc.id)}
          >
            <span className="calc-tip">
              <span className="calc-tip-name">{calc.label}</span>
              <span className="calc-tip-desc">{calc.desc}</span>
              <span className="calc-tip-cta">Open Calculator →</span>
            </span>
          </button>
        ))}
        {/* Row 2: next 5 calculators + empty slot */}
        {CALCULATORS.slice(6, 11).map(calc => (
          <button
            key={calc.id}
            type="button"
            aria-label={calc.label}
            className="calc-hero-btn"
            onClick={() => onSelect?.(calc.id)}
          >
            <span className="calc-tip">
              <span className="calc-tip-name">{calc.label}</span>
              <span className="calc-tip-desc">{calc.desc}</span>
              <span className="calc-tip-cta">Open Calculator →</span>
            </span>
          </button>
        ))}
        <div /> {/* Empty 6th slot in row 2 */}
      </div>
    </div>
  );
}