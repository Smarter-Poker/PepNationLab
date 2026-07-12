'use client';

import { useState, useMemo } from 'react';
import { dilutionSeries } from '@/lib/research/calculators';
import {
  chromeOuterStyle, chromeInnerStyle, labelStyle, resultStyle, noteStyle,
  RESEARCH_NOTE, StyledInput, CalculatorHeader, SaveToJournalButton,
} from './_shared';

function TubesRack({ steps, currentStep, onSelectStep }: {
  steps: Array<{ stepNumber: number; concentration: number; transferVolumeMl?: number; diluentVolumeMl?: number }>;
  currentStep: number;
  onSelectStep: (idx: number) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 16, overflowX: 'auto', padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)', marginBottom: 20 }}>
      {steps.map((s, idx) => {
        const isActive = idx + 1 === currentStep;
        const opacity = Math.max(0.15, Math.min(1.0, 1 - idx / steps.length));
        return (
          <div
            key={idx}
            onClick={() => onSelectStep(idx + 1)}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', transform: isActive ? 'scale(1.08)' : 'scale(1.0)', transition: 'all 0.2s ease', minWidth: 50 }}
          >
            <div style={{
              width: 32, height: 70,
              border: isActive ? '2px solid #00E5FF' : '2px solid rgba(255,255,255,0.2)',
              borderRadius: '0 0 16px 16px', position: 'relative',
              background: 'rgba(255,255,255,0.02)', overflow: 'hidden',
              display: 'flex', alignItems: 'flex-end',
              boxShadow: isActive ? '0 0 15px rgba(0,229,255,0.4)' : 'none',
            }}>
              <div style={{ width: '100%', height: '60%', background: `rgba(0,229,255,${opacity * 0.8})`, borderTop: '1px solid rgba(0,229,255,0.8)', transition: 'height 0.3s ease' }} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' }}>
                <span style={{ fontSize: 10, color: '#FFF', fontWeight: 'bold' }}>T{idx + 1}</span>
              </div>
            </div>
            <span style={{ fontSize: 11, color: isActive ? '#00E5FF' : '#A8B4C0', marginTop: 8, fontFamily: 'monospace' }}>
              Step {idx + 1}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function DilutionSection() {
  const [stock, setStock] = useState('');
  const [factor, setFactor] = useState('');
  const [steps, setSteps] = useState('');
  const [finalVol, setFinalVol] = useState('');
  const [selectedTube, setSelectedTube] = useState<number>(1);
  const [assayMode, setAssayMode] = useState<boolean>(false);

  const parsedSteps = Math.max(1, Math.min(20, Math.floor(Number(steps) || 1)));

  const series = useMemo(() => {
    return dilutionSeries({
      stockConcentration: Number(stock),
      dilutionFactor: Number(factor),
      steps: parsedSteps,
      finalVolumeMl: assayMode ? (Number(finalVol) || undefined) : undefined,
    });
  }, [stock, factor, parsedSteps, finalVol, assayMode]);

  const selectedTubeData = useMemo(() => {
    if (!series || series.length < selectedTube) return null;
    return series[selectedTube - 1];
  }, [series, selectedTube]);

  return (
    <section id="dilution" style={chromeOuterStyle}>
      <div style={chromeInnerStyle}>
        <CalculatorHeader
          title="Serial Dilution & Assay Curve Generator"
          why="Design Multi-Step Dilution Curves For Pharmacological Profiles. Standard Curve Assay Mode Calculates Pipetting Guides For Microcentrifuge Tube Racks."
        />

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={assayMode} onChange={(e) => setAssayMode(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#00E5FF' }} aria-label="Enable Assay Standard Curve Mode" />
            <span style={{ fontSize: 14, color: '#FFFFFF', fontWeight: 600 }}>Enable Assay Standard Curve Mode (Pipetting Volume Recipes)</span>
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
          <label style={{ display: 'block' }}>
            <div style={labelStyle}>Stock Concentration (Units)</div>
            <StyledInput type="number" step="any" min={0} value={stock} onChange={(e) => setStock(e.target.value)} placeholder="e.g. 1000" />
          </label>
          <label style={{ display: 'block' }}>
            <div style={labelStyle}>Dilution Factor</div>
            <StyledInput type="number" step="any" min={2} value={factor} onChange={(e) => setFactor(e.target.value)} placeholder="e.g. 2" />
          </label>
          <label style={{ display: 'block' }}>
            <div style={labelStyle}>Steps</div>
            <StyledInput type="number" min={1} max={20} step={1} value={steps} onChange={(e) => { setSteps(e.target.value); setSelectedTube(1); }} placeholder="e.g. 8" />
          </label>
          {assayMode && (
            <label style={{ display: 'block' }}>
              <div style={labelStyle}>Target Vol Per Tube (mL)</div>
              <StyledInput type="number" step="any" min={0} value={finalVol} placeholder="e.g. 100" onChange={(e) => setFinalVol(e.target.value)} />
            </label>
          )}
        </div>

        {assayMode && series.length > 0 && (
          <>
            <TubesRack steps={series} currentStep={selectedTube} onSelectStep={setSelectedTube} />
            {selectedTubeData && (
              <div style={{ ...resultStyle, marginBottom: 16, fontSize: 14, border: '1px solid #00E5FF', background: 'rgba(0,229,255,0.02)' }}>
                <div style={{ color: '#00E5FF', fontWeight: 'bold', marginBottom: 6 }}>Recipe For Tube {selectedTube} (T{selectedTube}):</div>
                {selectedTube === 1 ? (
                  <div>Transfer <strong style={{ color: '#68D391' }} className="calc-no-capitalize">{selectedTubeData.transferVolumeMl?.toFixed(3)} mL</strong> Of Stock Into The Tube, And Mix With <strong style={{ color: '#68D391' }} className="calc-no-capitalize">{selectedTubeData.diluentVolumeMl?.toFixed(3)} mL</strong> Of Diluent.</div>
                ) : (
                  <div>Transfer <strong style={{ color: '#68D391' }} className="calc-no-capitalize">{selectedTubeData.transferVolumeMl?.toFixed(3)} mL</strong> Of Tube {selectedTube - 1} (T{selectedTube - 1}) Into The Tube, And Mix With <strong style={{ color: '#68D391' }} className="calc-no-capitalize">{selectedTubeData.diluentVolumeMl?.toFixed(3)} mL</strong> Of Diluent.</div>
                )}
                <div style={{ marginTop: 6, fontSize: 12, color: '#A8B4C0' }}>
                  Target Concentration: <strong className="calc-no-capitalize">{selectedTubeData.concentration.toExponential(3)}</strong> Units. Total Volume: <span className="calc-no-capitalize">{(selectedTubeData.transferVolumeMl! + selectedTubeData.diluentVolumeMl!).toFixed(3)} mL</span>
                </div>
              </div>
            )}
          </>
        )}

        <div aria-live="polite" style={{ ...resultStyle, padding: 0, background: 'transparent', border: 'none' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <th style={{ textAlign: 'left', padding: 8, color: '#A8B4C0', fontSize: 12 }}>Step / Tube</th>
                <th style={{ textAlign: 'left', padding: 8, color: '#A8B4C0', fontSize: 12 }}>Concentration</th>
                {assayMode && <th style={{ textAlign: 'left', padding: 8, color: '#A8B4C0', fontSize: 12 }}>Transfer Vol (mL)</th>}
                {assayMode && <th style={{ textAlign: 'left', padding: 8, color: '#A8B4C0', fontSize: 12 }}>Diluent Vol (mL)</th>}
              </tr>
            </thead>
            <tbody>
              {series.map((s) => (
                <tr key={s.stepNumber} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: assayMode && selectedTube === s.stepNumber ? 'rgba(0,229,255,0.05)' : 'transparent' }}>
                  <td style={{ padding: 8, color: '#FFFFFF' }}>Step {s.stepNumber} (T{s.stepNumber})</td>
                  <td style={{ padding: 8, color: '#A8B2C1', fontWeight: 600 }} className="calc-no-capitalize">
                    {Math.abs(s.concentration) >= 0.001 && Math.abs(s.concentration) < 1e5
                      ? s.concentration.toPrecision(4)
                      : s.concentration.toExponential(3)}
                  </td>
                  {assayMode && <td style={{ padding: 8, color: '#68D391' }} className="calc-no-capitalize">{s.transferVolumeMl?.toFixed(3)}</td>}
                  {assayMode && <td style={{ padding: 8, color: '#68D391' }} className="calc-no-capitalize">{s.diluentVolumeMl?.toFixed(3)}</td>}
                </tr>
              ))}
              {series.length === 0 && (
                <tr><td colSpan={assayMode ? 4 : 2} style={{ padding: 8, color: '#A8B4C0' }}>Enter Stock Concentration And A Dilution Factor &gt; 1.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {Number(stock) > 0 && Number(factor) > 1 && (
          <SaveToJournalButton
            title="Dilution Series Protocol"
            noteText={`Stock Concentration: ${stock}\nDilution Factor: ${factor}\nSteps: ${steps}\nAssay Mode: ${assayMode ? 'Yes' : 'No'}\nFinal Volume Per Tube: ${finalVol || 'N/A'} mL\nTube Breakdown:\n${series.map(s => `- Step ${s.stepNumber} (T${s.stepNumber}): Conc ${s.concentration.toExponential(3)}${assayMode ? `, Transfer: ${s.transferVolumeMl?.toFixed(3)} mL, Diluent: ${s.diluentVolumeMl?.toFixed(3)} mL` : ''}`).join('\n')}`}
          />
        )}

        <p style={noteStyle}>{RESEARCH_NOTE}</p>
      </div>
    </section>
  );
}
