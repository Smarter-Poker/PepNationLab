'use client';

import { useState } from 'react';
import { predictSolubility } from '@/lib/research/calculators';
import {
  StyledInput,
  CalculatorHeader,
  SaveToJournalButton,
  chromeOuterStyle,
  chromeInnerStyle,
  labelStyle,
  resultStyle,
  noteStyle,
  RESEARCH_NOTE,
  GRAVY_VALUES,
} from './_shared';

export function SolubilitySection() {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [seq, setSeq] = useState('');
  const [gravy, setGravy] = useState('');
  const [pi, setPi] = useState('');
  const [len, setLen] = useState('');
  const [pH, setPH] = useState('7.4');

  const onSequenceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sequence = e.target.value;
    setSeq(sequence);

    const clean = sequence.toUpperCase().replace(/[^A-Z]/g, '');
    if (!clean) {
      setGravy('');
      setLen('');
      return;
    }

    let sum = 0;
    let count = 0;
    for (const char of clean) {
      if (char in GRAVY_VALUES) {
        sum += GRAVY_VALUES[char];
        count++;
      }
    }
    setLen(count.toString());
    setGravy(count > 0 ? (sum / count).toFixed(3) : '0');
  };

  const out = predictSolubility({
    gravy: Number(gravy),
    isoelectricPoint: Number(pi) || 6.0,
    sequenceLength: Math.max(1, Math.floor(Number(len) || 1)),
    pH: pH.trim() === '' ? undefined : Number(pH),
    sequence: seq,
  });

  return (
    <section id="solubility" style={chromeOuterStyle}>
      <div style={chromeInnerStyle}>
        <CalculatorHeader
          title="Solubility Predictor"
          why="Heuristic Calculation Of Aqueous Solubility. Input The Sequence For Automatic Residue Diagnostics (GRAVY, Cysteine Ratios, And Hydrophobic Aggregations)."
        />
        <div style={{ marginBottom: 12, fontSize: 12, color: '#A8B4C0' }}>
          Enter Sequence To Auto-Calculate Sequence Length And GRAVY Score.
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <button
            onClick={() => { setPH('7.4'); setShowAdvanced(true); }}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #00E5FF', background: 'transparent', color: '#00E5FF', cursor: 'pointer', fontSize: 13 }}
          >
            Preset: PBS (<span className="calc-no-capitalize">pH 7.4</span>)
          </button>
          <button
            onClick={() => { setPH('2.5'); setShowAdvanced(true); }}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #F6AD55', background: 'transparent', color: '#F6AD55', cursor: 'pointer', fontSize: 13 }}
          >
            Preset: 10% Acetic Acid (<span className="calc-no-capitalize">pH ~2.5</span>)
          </button>
          <button
            onClick={() => { setPH('7.0'); setShowAdvanced(true); }}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #D6BCFA', background: 'transparent', color: '#D6BCFA', cursor: 'pointer', fontSize: 13 }}
          >
            Preset: Pure Water (<span className="calc-no-capitalize">pH 7.0</span>)
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 12 }}>
          <label style={{ display: 'block' }}>
            <div style={labelStyle}>Peptide Sequence (Optional)</div>
            <StyledInput type="text" value={seq} onChange={onSequenceChange} placeholder="E.g. FLGPLG" className="calc-no-capitalize" />
          </label>
        </div>

        <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} style={{ background: 'transparent', border: '1px solid rgba(168,178,193,0.3)', color: '#A8B2C1', padding: '6px 12px', borderRadius: 6, fontSize: 12, marginBottom: 12, cursor: 'pointer' }}>{showAdvanced ? 'Hide Parameter Details' : 'Configure Parameter Details'}</button>
        {showAdvanced && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 12 }}>
          <label style={{ display: 'block' }}>
            <div style={labelStyle}><span className="calc-no-capitalize">GRAVY</span> Score</div>
            <StyledInput type="number" step="0.01" value={gravy} onChange={(e) => setGravy(e.target.value)} placeholder="Auto-calculated" />
          </label>
          <label style={{ display: 'block' }}>
            <div style={labelStyle}>Isoelectric Point (<span className="calc-no-capitalize">pI</span>)</div>
            <StyledInput type="number" step="0.01" value={pi} onChange={(e) => setPi(e.target.value)} placeholder="E.g. 6.0" />
          </label>
          <label style={{ display: 'block' }}>
            <div style={labelStyle}>Sequence Length</div>
            <StyledInput type="number" step={1} min={1} value={len} onChange={(e) => setLen(e.target.value)} placeholder="Auto-calculated" />
          </label>
          <label style={{ display: 'block' }}>
            <div style={labelStyle}>Solution <span className="calc-no-capitalize">pH</span></div>
            <StyledInput type="number" step="0.1" value={pH} onChange={(e) => setPH(e.target.value)} placeholder="E.g. 7.4" />
          </label>
        </div>}

        {out?.warnings && out.warnings.length > 0 && (
          <div style={{ margin: '12px 0', fontSize: 13, color: '#F6AD55', background: 'rgba(246,173,85,0.1)', border: '1px solid rgba(246,173,85,0.3)', borderRadius: 8, padding: '10px 14px' }}>
            {out.warnings.map((w, idx) => (
              <div key={idx} style={{ marginBottom: 4 }} className="calc-no-capitalize">Warning: {w}</div>
            ))}
          </div>
        )}

        <div style={resultStyle} aria-live="polite">
          {!out ? 'Enter Valid Inputs.' : (
            <>
              Predicted Solubility: <strong className="calc-no-capitalize">{out.predictedSolubilityMgMl.toFixed(3)} mg/mL</strong> (<span className="calc-no-capitalize">{out.classification.toUpperCase()}</span>)
              <div style={{ fontSize: 12, color: '#A8B4C0', marginTop: 6 }} className="calc-no-capitalize">{out.notes}</div>
            </>
          )}
        </div>

        {out?.bufferAdvice && (
          <div style={{ margin: '12px 0', padding: 12, borderRadius: 8, background: 'rgba(0, 229, 255, 0.03)', border: '1px solid rgba(0, 229, 255, 0.12)', fontSize: 13, color: '#A8B2C1' }}>
            <strong style={{ color: '#00E5FF', display: 'block', marginBottom: 4 }}>Solubility &amp; Reconstitution Advice</strong>
            {out.bufferAdvice}
          </div>
        )}

        {out && (
          <SaveToJournalButton
            title="Sequence Solubility Prediction"
            noteText={`Sequence: ${seq}
Predicted Solubility: ${out.predictedSolubilityMgMl.toFixed(3)} mg/mL
Classification: ${out.classification.toUpperCase()}
GRAVY Score: ${gravy}
Isoelectric Point (pI): ${pi}
Sequence Length: ${len}
Solution pH: ${pH}
Notes: ${out.notes}
Advice: ${out.bufferAdvice}`}
          />
        )}

        <p style={noteStyle}>{RESEARCH_NOTE}</p>
      </div>
    </section>
  );
}
