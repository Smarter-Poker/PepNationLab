'use client';

import { useState } from 'react';
import { arrheniusStability } from '@/lib/research/calculators';
import {
  chromeOuterStyle, chromeInnerStyle, labelStyle, resultStyle, noteStyle,
  RESEARCH_NOTE, StyledInput, StyledSelect, CalculatorHeader, SaveToJournalButton,
} from './_shared';

const DEGRADATION_PROFILES = [
  { name: 'Standard Peptide (83 kJ/mol)', ea: 83 },
  { name: 'Fragile Peptide e.g. IGF-1, hGH (100 kJ/mol)', ea: 100 },
  { name: 'Highly Stable e.g. BPC-157 Arg (65 kJ/mol)', ea: 65 },
];

export function StabilitySection() {
  const [shelf, setShelf] = useState('');
  const [tFrom, setTFrom] = useState('');
  const [tTo, setTTo] = useState('');
  const [ea, setEa] = useState('');
  const [profile, setProfile] = useState('83');
  const [showExplainer, setShowExplainer] = useState(false);

  // Inputs are entered in Fahrenheit; the Arrhenius math works in Celsius/Kelvin,
  // so convert F → C before computing. (F - 32) * 5/9.
  const fToC = (f: string) => (Number(f) - 32) * 5 / 9;
  const days = arrheniusStability({
    shelfDaysAtTempC: Number(shelf),
    fromTempC: fToC(tFrom),
    toTempC: fToC(tTo),
    activationEnergyKJmol: ea.trim() === '' ? undefined : Number(ea),
  });

  const handleProfileChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setProfile(val);
    if (val !== 'custom') {
      setEa(val);
    }
  };

  return (
    <section id="stability" style={chromeOuterStyle}>
      <div style={chromeInnerStyle}>
        <CalculatorHeader
          title="Arrhenius Stability & Thermal Degradation Predictor"
          why="If you know how long a peptide lasts at one temperature, this calculator tells you how long it will last at any other temperature — using the same kinetics equation pharmaceutical companies use for accelerated stability testing."
        />

        {/* Plain-English Explainer Toggle */}
        <div style={{ marginBottom: 20 }}>
          <button
            type="button"
            onClick={() => setShowExplainer(s => !s)}
            aria-expanded={showExplainer}
            aria-controls="stability-explainer"
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(0,229,255,0.05)',
              border: '1px solid rgba(0,229,255,0.25)',
              borderRadius: 8, padding: '8px 14px',
              color: '#00E5FF', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          >
            <svg style={{ width: 16, height: 16, transform: showExplainer ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
            How Does This Work? (Plain-English Explainer)
          </button>

          {showExplainer && (
            <div
              id="stability-explainer"
              style={{
                marginTop: 10, padding: 18, borderRadius: 10,
                background: 'rgba(0,229,255,0.03)',
                border: '1px solid rgba(0,229,255,0.15)',
                fontSize: 13, color: '#A8B4C0', lineHeight: 1.65,
              }}
            >
              <h4 style={{ margin: '0 0 10px', color: '#FFFFFF', fontSize: 15 }}>The Short Version</h4>
              <p style={{ margin: '0 0 12px' }}>
                Chemical reactions — including the breakdown of peptides — speed up dramatically as temperature rises. The <strong style={{ color: '#00E5FF' }}>Arrhenius equation</strong> quantifies this relationship so you can predict, for example, that a vial stable for 180 days at 39°F will only last ~14 days left out at room temperature (77°F).
              </p>

              <h4 style={{ margin: '0 0 8px', color: '#FFFFFF', fontSize: 14 }}>The Three Inputs Explained</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 12 }}>
                <div style={{ padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ color: '#00E5FF', fontWeight: 700, marginBottom: 4 }}>Known Shelf Days</div>
                  <div>How long the manufacturer (or literature) says the peptide stays stable at the <em>known</em> temperature. Example: reconstituted BPC-157 is stable for 30 days at 39°F.</div>
                </div>
                <div style={{ padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ color: '#00E5FF', fontWeight: 700, marginBottom: 4 }}>Known Temperature</div>
                  <div>The temperature the shelf-life figure was measured at — usually refrigerator temp (39°F) or freezer temp (4°F for long-term lyophilized storage).</div>
                </div>
                <div style={{ padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ color: '#00E5FF', fontWeight: 700, marginBottom: 4 }}>Target Temperature</div>
                  <div>The temperature you actually plan to store (or temporarily leave) the vial at. Even a few hours at room temp eats into shelf life — this makes it visible.</div>
                </div>
              </div>

              <h4 style={{ margin: '0 0 8px', color: '#FFFFFF', fontSize: 14 }}>What Is Activation Energy (Ea)?</h4>
              <p style={{ margin: '0 0 12px' }}>
                Ea is a number (in kJ/mol) that describes <em>how sensitive</em> a peptide is to temperature changes. A higher Ea means the peptide degrades much faster with even a small temperature rise. Most peptides fall between 65–100 kJ/mol:
              </p>
              <ul style={{ margin: '0 0 12px', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <li><strong style={{ color: '#68D391' }}>65 kJ/mol (Stable)</strong> — e.g., BPC-157. Relatively forgiving to mild temperature excursions.</li>
                <li><strong style={{ color: '#F6AD55' }}>83 kJ/mol (Standard)</strong> — most research peptides. A common default when Ea is unknown.</li>
                <li><strong style={{ color: '#FC8181' }}>100 kJ/mol (Fragile)</strong> — e.g., GH, IGF-1 analogues. Highly sensitive; even 30 min at room temp causes measurable loss.</li>
              </ul>
              <p style={{ margin: 0, fontSize: 12, color: '#6B7280', fontStyle: 'italic' }}>
                If you don&apos;t know your peptide&apos;s Ea, use the 83 kJ/mol preset — it gives a conservative, real-world estimate. The result is a <em>prediction</em>, not a guarantee.
              </p>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => { setTFrom('-4'); setTTo('39'); }} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #00E5FF', background: 'transparent', color: '#00E5FF', cursor: 'pointer', fontSize: 13 }}>
            Preset: Freezer To Fridge
          </button>
          <button type="button" onClick={() => { setTFrom('39'); setTTo('77'); }} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #F6AD55', background: 'transparent', color: '#F6AD55', cursor: 'pointer', fontSize: 13 }}>
            Preset: Fridge To Room Temp
          </button>
          <button type="button" onClick={() => { setTFrom('39'); setTTo('98.6'); }} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #FC8181', background: 'transparent', color: '#FC8181', cursor: 'pointer', fontSize: 13 }}>
            Preset: Fridge To Body Temp
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          <label style={{ display: 'block' }}>
            <div style={labelStyle}>Known Shelf Days</div>
            <StyledInput type="number" step="any" value={shelf} onChange={(e) => setShelf(e.target.value)} placeholder="e.g. 30" />
          </label>
          <label style={{ display: 'block' }}>
            <div style={labelStyle}>Known Temperature (°F)</div>
            <StyledInput type="number" step="any" value={tFrom} onChange={(e) => setTFrom(e.target.value)} placeholder="e.g. 39" />
          </label>
          <label style={{ display: 'block' }}>
            <div style={labelStyle}>Target Temperature (°F)</div>
            <StyledInput type="number" step="any" value={tTo} onChange={(e) => setTTo(e.target.value)} placeholder="e.g. 77" />
          </label>
          <label style={{ display: 'block' }}>
            <div style={labelStyle}>Degradation Profile</div>
            <StyledSelect value={profile} onChange={handleProfileChange}>
              {DEGRADATION_PROFILES.map((p) => <option key={p.ea} value={p.ea} className="calc-no-capitalize">{p.name}</option>)}
              <option value="custom">Custom Ea</option>
            </StyledSelect>
          </label>
          {profile === 'custom' && (
            <label style={{ display: 'block' }}>
              <div style={labelStyle}>Activation Energy (Ea, kJ/mol)</div>
              <StyledInput type="number" step="any" value={ea} onChange={(e) => setEa(e.target.value)} placeholder="e.g. 83" />
            </label>
          )}
        </div>

        <div aria-live="polite" style={resultStyle}>
          {days === null
            ? 'Enter Valid Inputs (Temperatures Must Be Above −459.67°F).'
            : ea.trim() !== '' && Number(ea) === 0
            ? 'Activation Energy Cannot Be Zero - Temperature Has No Effect At Ea=0.'
            : <><strong style={{ fontSize: 22, color: '#00E5FF' }}>{days.toFixed(1)} Days</strong> <span style={{ fontSize: 13, color: '#A8B4C0' }}>predicted shelf life at {tTo}°F</span>
              {days < 1 && <div style={{ color: '#FC8181', fontSize: 13, marginTop: 6 }}>⚠ Less than 1 day — this compound degrades rapidly at this temperature.</div>}
              {days >= 1 && days < 7 && <div style={{ color: '#F6AD55', fontSize: 13, marginTop: 6 }}>⚡ Short window — use promptly and return to proper storage immediately.</div>}
              {days >= 7 && <div style={{ color: '#68D391', fontSize: 13, marginTop: 6 }}>✓ Reasonable stability window at this temperature.</div>}
            </>
          }
        </div>

        {days !== null && (
          <SaveToJournalButton
            title="Arrhenius Stability Prediction"
            noteText={`Initial Shelf Life: ${shelf} Days At ${tFrom}°F\nTarget Temperature: ${tTo}°F\nActivation Energy (Ea): ${ea || '83 (default)'} kJ/mol\nPredicted Shelf Life At ${tTo}°F: ${days.toFixed(1)} Days`}
          />
        )}

        <p style={noteStyle}>{RESEARCH_NOTE}</p>
      </div>
    </section>
  );
}
