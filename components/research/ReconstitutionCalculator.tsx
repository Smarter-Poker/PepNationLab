'use client';

/**
 * ReconstitutionCalculator - Lab Preparation Tool (NOT Dosing Guidance).
 * Two Modes:
 *   - "Add Diluent": Enter Vial Mass + Diluent Volume; Shows Resulting
 *     Concentration And A Draw-Volume Table For Example Masses.
 *   - "Target Concentration": Enter Vial Mass + Desired Concentration; Shows
 *     The Diluent Volume To Add.
 * All Math Comes From The Pure Helpers In `@/lib/compounds`.
 */
import { useRef, useState } from 'react';
import Link from 'next/link';
import { drawVolumeMl, reconstitutionVolumeMl } from '@/lib/compounds';
import { trackResearchEvent } from '@/lib/research-track';

const EXAMPLE_DRAW_MASSES_MG = [0.25, 0.5, 1, 2, 5];

const inputStyleBase: React.CSSProperties = {
  width: '100%',
  height: '46px',
  boxSizing: 'border-box',
  background: 'rgba(255, 255, 255, 0.04)', // Semi-transparent glassmorphic background
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  color: '#F3F4F6',
  padding: '0 16px',
  borderRadius: 8,
  fontSize: 15,
  fontFamily: 'monospace',
  outline: 'none',
  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
};

function StyledInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  return (
    <input 
      {...props}
      onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...inputStyleBase,
        borderColor: focused ? '#00E5FF' : hovered ? 'rgba(0, 229, 255, 0.35)' : 'rgba(255, 255, 255, 0.08)',
        boxShadow: focused 
          ? '0 0 12px rgba(0, 229, 255, 0.25), inset 0 2px 4px rgba(0,0,0,0.5)' 
          : hovered 
            ? '0 0 8px rgba(0, 229, 255, 0.1), inset 0 2px 4px rgba(0,0,0,0.2)' 
            : 'inset 0 2px 4px rgba(0,0,0,0.2)',
        ...props.style
      }}
    />
  );
}

export default function ReconstitutionCalculator({
  defaultMassMg,
  onAddDiluent,
}: {
  defaultMassMg?: number;
  /** When Provided, The Diluent CTA Becomes An "Add Bacteriostatic Water To Cart" Button. */
  onAddDiluent?: () => void;
}) {
  const [mode, setMode] = useState<'diluent' | 'target'>('diluent');
  const [massMg, setMassMg] = useState<string>(defaultMassMg != null ? String(defaultMassMg) : '10');
  const [diluentMl, setDiluentMl] = useState<string>('2');
  const [targetConc, setTargetConc] = useState<string>('5');

  // Usage analytics: one event per mount, on the researcher's FIRST interaction
  // with any input (not per keystroke). Fire-and-forget, never blocks the UI.
  const usageTrackedRef = useRef(false);
  const markCalculatorUsed = () => {
    if (usageTrackedRef.current) return;
    usageTrackedRef.current = true;
    trackResearchEvent('calculator_used', { tool: 'reconstitution' });
  };

  const mass = parseFloat(massMg);
  const diluent = parseFloat(diluentMl);
  const target = parseFloat(targetConc);

  const concentration =
    isFinite(mass) && isFinite(diluent) && diluent > 0 ? mass / diluent : null;
  const targetVolume = reconstitutionVolumeMl(mass, target);

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.8rem',
    fontWeight: 700,
    color: '#9CA3AF',
    marginBottom: '8px',
    letterSpacing: '0.05em',
  };
  const tabBase: React.CSSProperties = {
    padding: '8px 16px',
    fontSize: '0.85rem',
    fontWeight: 700,
    borderRadius: 8,
    cursor: 'pointer',
    border: '1px solid #00E5FF',
    background: 'transparent',
    color: '#A8B2C1',
    transition: 'all 0.2s',
  };
  const tabActive: React.CSSProperties = { background: '#00E5FF', color: '#000000' };

  return (
    <div
      className="calc-container"
      onInput={markCalculatorUsed}
      style={{
        border: '1px solid rgba(0, 229, 255, 0.2)',
        borderRadius: 16,
        padding: 24,
        background: 'radial-gradient(circle at 50% 0%, #111622 0%, #080a0f 100%)',
        boxShadow: '0 16px 40px rgba(0,0,0,0.7), 0 0 24px rgba(0, 229, 255, 0.04)',
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <strong style={{ color: '#00E5FF', fontSize: '0.95rem' }}>
          Lab Preparation Tool - Not Dosing Guidance
        </strong>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => setMode('diluent')}
          style={{ ...tabBase, ...(mode === 'diluent' ? tabActive : {}) }}
        >
          Add Diluent
        </button>
        <button
          type="button"
          onClick={() => setMode('target')}
          style={{ ...tabBase, ...(mode === 'target' ? tabActive : {}) }}
        >
          Target Concentration
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div>
          <label style={labelStyle} htmlFor="recon-mass">
            Vial Amount (<span className="calc-no-capitalize">mg</span>)
          </label>
          <StyledInput
            id="recon-mass"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={massMg}
            onChange={(e) => setMassMg(e.target.value)}
          />
        </div>

        {mode === 'diluent' ? (
          <div>
            <label style={labelStyle} htmlFor="recon-diluent">
              Bacteriostatic Water To Add (<span className="calc-no-capitalize">mL</span>)
            </label>
            <StyledInput
              id="recon-diluent"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={diluentMl}
              onChange={(e) => setDiluentMl(e.target.value)}
            />
          </div>
        ) : (
          <div>
            <label style={labelStyle} htmlFor="recon-target">
              Target Concentration (<span className="calc-no-capitalize">mg/mL</span>)
            </label>
            <StyledInput
              id="recon-target"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={targetConc}
              onChange={(e) => setTargetConc(e.target.value)}
            />
          </div>
        )}
      </div>

      {mode === 'diluent' ? (
        <>
          <p style={{ color: '#E5E7EB', marginBottom: 16 }}>
            Resulting Concentration:{' '}
            <strong style={{ color: '#00E5FF' }}>
              {concentration != null ? (
                <span className="calc-no-capitalize">{concentration.toFixed(3)} mg/mL</span>
              ) : '-'}
            </strong>
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Example Mass (<span className="calc-no-capitalize">mg</span>)</th>
                  <th style={thStyle}>Volume To Draw (<span className="calc-no-capitalize">mL</span>)</th>
                  <th style={thStyle}>Units (<span className="calc-no-capitalize">U-100</span> Syringe)</th>
                </tr>
              </thead>
              <tbody>
                {EXAMPLE_DRAW_MASSES_MG.map((dm) => {
                  const vol = drawVolumeMl(mass, diluent, dm);
                  const units = vol != null ? vol * 100 : null;
                  const unitsDisplay = units === null ? '-'
                    : units < 0.1 ? '<0.1'
                    : units < 1 ? `${units.toFixed(2)}`
                    : `${Math.round(units)}`;
                  return (
                    <tr key={dm}>
                      <td style={tdStyle} className="calc-no-capitalize">{dm}</td>
                      <td style={tdStyle} className="calc-no-capitalize">{vol != null ? vol.toFixed(3) : '-'}</td>
                      <td style={tdStyle} className="calc-no-capitalize">{unitsDisplay}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p style={{ color: '#E5E7EB' }}>
          Bacteriostatic Water To Add:{' '}
          <strong style={{ color: '#00E5FF' }}>
            {targetVolume != null ? (
              <span className="calc-no-capitalize">{targetVolume.toFixed(3)} mL</span>
            ) : '-'}
          </strong>
        </p>
      )}

      {onAddDiluent ? (
        <button
          type="button"
          onClick={onAddDiluent}
          style={{
            marginTop: 16,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            borderRadius: 8,
            background: '#00E5FF',
            color: '#000000',
            border: 'none',
            fontWeight: 800,
            fontSize: '0.85rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = '0 0 12px rgba(0, 229, 255, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          Add Bacteriostatic Water To Cart
        </button>
      ) : (
        <p style={{ marginTop: 16, fontSize: '0.82rem', color: '#9CA3AF' }}>
          Need Diluent?{' '}
          <Link href="/research/calculators#reconstitution" style={{ color: '#00E5FF', fontWeight: 700 }}>
            See Reconstitution Calculator.
          </Link>
        </p>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '6px 8px',
  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  color: '#A8B2C1',
  fontWeight: 700,
};
const tdStyle: React.CSSProperties = {
  padding: '6px 8px',
  borderBottom: '1px solid rgba(168,180,192,0.1)',
  color: '#FFFFFF',
};
