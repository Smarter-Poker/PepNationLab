'use client';

/**
 * ReconstitutionCalculator — lab preparation tool (NOT dosing guidance).
 * Two modes:
 *   - "Add Diluent": enter vial mass + diluent volume; shows resulting
 *     concentration and a draw-volume table for example masses.
 *   - "Target Concentration": enter vial mass + desired concentration; shows
 *     the diluent volume to add.
 * All math comes from the pure helpers in `@/lib/compounds`.
 */
import { useState } from 'react';
import Link from 'next/link';
import { drawVolumeMl, reconstitutionVolumeMl } from '@/lib/compounds';

const EXAMPLE_DRAW_MASSES_MG = [0.25, 0.5, 1, 2, 5];

export default function ReconstitutionCalculator({ defaultMassMg }: { defaultMassMg?: number }) {
  const [mode, setMode] = useState<'diluent' | 'target'>('diluent');
  const [massMg, setMassMg] = useState<string>(defaultMassMg != null ? String(defaultMassMg) : '10');
  const [diluentMl, setDiluentMl] = useState<string>('2');
  const [targetConc, setTargetConc] = useState<string>('5');

  const mass = parseFloat(massMg);
  const diluent = parseFloat(diluentMl);
  const target = parseFloat(targetConc);

  const concentration =
    isFinite(mass) && isFinite(diluent) && diluent > 0 ? mass / diluent : null;
  const targetVolume = reconstitutionVolumeMl(mass, target);

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    background: 'var(--black)',
    border: '1px solid var(--grey-400)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--white)',
    fontSize: '0.9rem',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.8rem',
    fontWeight: 700,
    color: 'var(--silver)',
    marginBottom: '4px',
  };
  const tabBase: React.CSSProperties = {
    padding: '6px 12px',
    fontSize: '0.78rem',
    fontWeight: 700,
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    border: '1px solid var(--teal)',
    background: 'transparent',
    color: 'var(--silver)',
  };
  const tabActive: React.CSSProperties = { background: 'var(--teal)', color: 'var(--black)' };

  return (
    <div
      style={{
        border: '1px solid var(--grey-400)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-4)',
        background: 'var(--black)',
      }}
    >
      <div style={{ marginBottom: 'var(--space-2)' }}>
        <strong style={{ color: 'var(--teal)', fontSize: '0.95rem' }}>
          Lab Preparation Tool — Not Dosing Guidance
        </strong>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
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

      <div className="grid-2" style={{ gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
        <div>
          <label style={labelStyle} htmlFor="recon-mass">
            Vial Amount (Mg)
          </label>
          <input
            id="recon-mass"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={massMg}
            onChange={(e) => setMassMg(e.target.value)}
            style={inputStyle}
          />
        </div>

        {mode === 'diluent' ? (
          <div>
            <label style={labelStyle} htmlFor="recon-diluent">
              Bacteriostatic Water To Add (Ml)
            </label>
            <input
              id="recon-diluent"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={diluentMl}
              onChange={(e) => setDiluentMl(e.target.value)}
              style={inputStyle}
            />
          </div>
        ) : (
          <div>
            <label style={labelStyle} htmlFor="recon-target">
              Target Concentration (Mg/Ml)
            </label>
            <input
              id="recon-target"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={targetConc}
              onChange={(e) => setTargetConc(e.target.value)}
              style={inputStyle}
            />
          </div>
        )}
      </div>

      {mode === 'diluent' ? (
        <>
          <p style={{ color: 'var(--silver)', marginBottom: 'var(--space-3)' }}>
            Resulting Concentration:{' '}
            <strong style={{ color: 'var(--teal)' }}>
              {concentration != null ? `${concentration.toFixed(3)} Mg/Ml` : '—'}
            </strong>
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Example Mass (Mg)</th>
                  <th style={thStyle}>Volume To Draw (Ml)</th>
                  <th style={thStyle}>Units (100-Unit Syringe)</th>
                </tr>
              </thead>
              <tbody>
                {EXAMPLE_DRAW_MASSES_MG.map((dm) => {
                  const vol = drawVolumeMl(mass, diluent, dm);
                  return (
                    <tr key={dm}>
                      <td style={tdStyle}>{dm}</td>
                      <td style={tdStyle}>{vol != null ? vol.toFixed(3) : '—'}</td>
                      <td style={tdStyle}>{vol != null ? Math.round(vol * 100) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p style={{ color: 'var(--silver)' }}>
          Bacteriostatic Water To Add:{' '}
          <strong style={{ color: 'var(--teal)' }}>
            {targetVolume != null ? `${targetVolume.toFixed(3)} Ml` : '—'}
          </strong>
        </p>
      )}

      <p style={{ marginTop: 'var(--space-3)', fontSize: '0.82rem', color: 'var(--silver)' }}>
        Need Diluent?{' '}
        <Link href="/research/bac-water" style={{ color: 'var(--teal)', fontWeight: 700 }}>
          See Bacteriostatic Water.
        </Link>
      </p>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '6px 8px',
  borderBottom: '1px solid var(--grey-400)',
  color: 'var(--silver)',
  fontWeight: 700,
};
const tdStyle: React.CSSProperties = {
  padding: '6px 8px',
  borderBottom: '1px solid rgba(168,180,192,0.15)',
  color: 'var(--white)',
};
