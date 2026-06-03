'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';

const CALCULATORS = [
  { id: 'reconstitution', label: 'Reconstitution' },
  { id: 'dilution', label: 'Serial Dilution' },
  { id: 'concentration', label: 'Concentration Converter' },
  { id: 'stability', label: 'Arrhenius Stability' },
  { id: 'cost', label: 'Cost Per Dose' },
  { id: 'pooling', label: 'Vial Pooling' },
  { id: 'hplc-rt', label: 'HPLC RT Predictor' },
  { id: 'mass-spec', label: 'Mass Spec m/z' },
  { id: 'spps-cost', label: 'Fmoc-SPPS Cost' },
  { id: 'solubility', label: 'Solubility Predictor' },
  { id: 'vial-quantity', label: 'Vial Quantity Power' },
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
                No calculators found.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Grid Overlay */}
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
        <button type="button" aria-label="Reconstitution" style={buttonStyle} onClick={() => onSelect?.('reconstitution')} />
        <button type="button" aria-label="Serial Dilution" style={buttonStyle} onClick={() => onSelect?.('dilution')} />
        <button type="button" aria-label="Concentration Converter" style={buttonStyle} onClick={() => onSelect?.('concentration')} />
        <button type="button" aria-label="Arrhenius Stability" style={buttonStyle} onClick={() => onSelect?.('stability')} />
        <button type="button" aria-label="Cost Per Dose" style={buttonStyle} onClick={() => onSelect?.('cost')} />
        <button type="button" aria-label="Vial Pooling" style={buttonStyle} onClick={() => onSelect?.('pooling')} />
        
        <button type="button" aria-label="HPLC RT Predictor" style={buttonStyle} onClick={() => onSelect?.('hplc-rt')} />
        <button type="button" aria-label="Mass Spec m/z" style={buttonStyle} onClick={() => onSelect?.('mass-spec')} />
        <button type="button" aria-label="Fmoc-SPPS Cost" style={buttonStyle} onClick={() => onSelect?.('spps-cost')} />
        <button type="button" aria-label="Solubility Predictor" style={buttonStyle} onClick={() => onSelect?.('solubility')} />
        <button type="button" aria-label="Vial Quantity Power" style={buttonStyle} onClick={() => onSelect?.('vial-quantity')} />
        <div /> {/* Empty 6th slot */}
      </div>
    </div>
  );
}
