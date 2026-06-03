'use client';

/**
 * CalculatorSuite -- eleven researcher calculators rendered as anchored
 * sections on /research/calculators. The first six are original (Wave 1);
 * the last five (HPLC RT, MS m/z, Fmoc-SPPS Cost, Solubility, Vial Quantity
 * Power) were added in Wave 2.
 *
 * Research use only. Lab-prep math, not human dosing.
 */

import { useState } from 'react';
import {
  reconstitutionVolumeMl,
  drawVolumeMl,
  arrheniusStability,
  concentrationConvert,
  costPerDose,
  dilutionSeries,
  vialPooling,
  predictHplcRetentionTime,
  predictMassSpecPeaks,
  estimateFmocSppsCost,
  predictSolubility,
  vialQuantityPower,
  type ConcentrationUnit,
} from '@/lib/research/calculators';

const RESEARCH_NOTE = 'Research Use Only. Not Intended As Medical Advice Or Human Dosing.';

const sectionStyle: React.CSSProperties = {
  scrollMarginTop: 100,
  padding: 24,
  borderRadius: 14,
  border: '1px solid rgba(168,180,192,0.2)',
  background: 'rgba(15,25,35,0.55)',
  marginBottom: 24,
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  color: '#A8B4C0',
  marginBottom: 4,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#0F1923',
  border: '1px solid rgba(168,180,192,0.25)',
  color: '#FFFFFF',
  padding: '8px 10px',
  borderRadius: 8,
  fontSize: 14,
};

const explainerStyle: React.CSSProperties = {
  color: '#A8B4C0',
  fontSize: 13,
  lineHeight: 1.6,
  margin: '0 0 14px',
};

const resultStyle: React.CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 10,
  background: 'rgba(0,196,188,0.10)',
  border: '1px solid rgba(0,196,188,0.35)',
  color: '#FFFFFF',
  fontSize: 14,
};

const noteStyle: React.CSSProperties = {
  marginTop: 14,
  marginBottom: 0,
  color: '#A8B4C0',
  fontSize: 11,
  fontStyle: 'italic',
};

function CalculatorHeader({ title, why }: { title: string; why: string }) {
  return (
    <>
      <h2 style={{ margin: 0, color: '#FFFFFF', fontSize: 20, fontWeight: 800 }}>{title}</h2>
      <h3 style={{ margin: '12px 0 4px', color: '#00C4BC', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Why This Matters
      </h3>
      <p style={explainerStyle}>{why}</p>
    </>
  );
}

function Reconstitution() {
  const [vialMass, setVialMass] = useState('5');
  const [targetConc, setTargetConc] = useState('5');
  const [diluentMl, setDiluentMl] = useState('2');
  const [desiredMass, setDesiredMass] = useState('0.25');

  const volMl = reconstitutionVolumeMl(Number(vialMass), Number(targetConc));
  const drawMl = drawVolumeMl(Number(vialMass), Number(diluentMl), Number(desiredMass));

  return (
    <section id="reconstitution" style={sectionStyle}>
      <CalculatorHeader
        title="Reconstitution Calculator"
        why="Most peptides ship freeze-dried. Reconstitution turns the powder into a usable working stock. Get the volume of diluent right and every downstream volume comes out clean."
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <div>
          <label style={labelStyle}>Vial Mass (mg)</label>
          <input style={inputStyle} type="number" min={0} value={vialMass} onChange={(e) => setVialMass(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Target Concentration (mg/mL)</label>
          <input style={inputStyle} type="number" min={0} value={targetConc} onChange={(e) => setTargetConc(e.target.value)} />
        </div>
      </div>
      <div style={resultStyle}>
        Add{' '}
        <strong>{volMl === null ? '-' : volMl.toFixed(2)} mL</strong>{' '}
        Of Sterile Diluent To Reach The Target Concentration.
      </div>

      <h3 style={{ margin: '20px 0 6px', color: '#FFFFFF', fontSize: 15 }}>Draw Volume Helper</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <div>
          <label style={labelStyle}>Diluent Added (mL)</label>
          <input style={inputStyle} type="number" min={0} value={diluentMl} onChange={(e) => setDiluentMl(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Desired Mass (mg)</label>
          <input style={inputStyle} type="number" min={0} value={desiredMass} onChange={(e) => setDesiredMass(e.target.value)} />
        </div>
      </div>
      <div style={resultStyle}>
        Draw{' '}
        <strong>{drawMl === null ? '-' : drawMl.toFixed(3)} mL</strong>{' '}
        From The Reconstituted Vial.
      </div>

      <p style={noteStyle}>{RESEARCH_NOTE}</p>
    </section>
  );
}

function DilutionSection() {
  const [stock, setStock] = useState('100');
  const [factor, setFactor] = useState('10');
  const [steps, setSteps] = useState('5');

  const series = dilutionSeries({
    stockConcentration: Number(stock),
    dilutionFactor: Number(factor),
    steps: Number(steps),
  });

  return (
    <section id="dilution" style={sectionStyle}>
      <CalculatorHeader
        title="Serial Dilution Series"
        why="Many in-vitro assays need a serial dilution series across log-scale ranges. This generates the per-step concentrations from a stock down to your detection limit."
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <div>
          <label style={labelStyle}>Stock Concentration</label>
          <input style={inputStyle} type="number" min={0} value={stock} onChange={(e) => setStock(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Dilution Factor</label>
          <input style={inputStyle} type="number" min={2} value={factor} onChange={(e) => setFactor(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Steps</label>
          <input style={inputStyle} type="number" min={1} max={20} value={steps} onChange={(e) => setSteps(e.target.value)} />
        </div>
      </div>
      <div style={{ ...resultStyle, padding: 0, background: 'transparent', border: 'none' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8, color: '#A8B4C0', fontSize: 12 }}>Step</th>
              <th style={{ textAlign: 'left', padding: 8, color: '#A8B4C0', fontSize: 12 }}>Concentration</th>
            </tr>
          </thead>
          <tbody>
            {series.map((s) => (
              <tr key={s.stepNumber}>
                <td style={{ padding: 8, color: '#FFFFFF' }}>{s.stepNumber}</td>
                <td style={{ padding: 8, color: '#00C4BC', fontWeight: 600 }}>{s.concentration.toExponential(3)}</td>
              </tr>
            ))}
            {series.length === 0 && (
              <tr><td colSpan={2} style={{ padding: 8, color: '#A8B4C0' }}>Enter Positive Stock And A Factor Above 1.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p style={noteStyle}>{RESEARCH_NOTE}</p>
    </section>
  );
}

const UNITS: ConcentrationUnit[] = ['mg/mL', 'mcg/mL', 'ng/mL', 'mmol/L', 'umol/L', 'nmol/L'];

function ConcentrationSection() {
  const [value, setValue] = useState('1');
  const [from, setFrom] = useState<ConcentrationUnit>('mg/mL');
  const [to, setTo] = useState<ConcentrationUnit>('mcg/mL');
  const [mw, setMw] = useState('3367');

  const result = concentrationConvert({
    value: Number(value),
    fromUnit: from,
    toUnit: to,
    molecularWeightDa: Number(mw) || null,
  });

  return (
    <section id="concentration" style={sectionStyle}>
      <CalculatorHeader
        title="Concentration Converter"
        why="Studies report concentrations in many units. Convert freely between mass per volume (mg/mL, mcg/mL, ng/mL) and molar (mmol/L, umol/L, nmol/L). Molar conversions require molecular weight."
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <div>
          <label style={labelStyle}>Value</label>
          <input style={inputStyle} type="number" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>From Unit</label>
          <select style={inputStyle} value={from} onChange={(e) => setFrom(e.target.value as ConcentrationUnit)}>
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>To Unit</label>
          <select style={inputStyle} value={to} onChange={(e) => setTo(e.target.value as ConcentrationUnit)}>
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Molecular Weight (Da)</label>
          <input style={inputStyle} type="number" value={mw} onChange={(e) => setMw(e.target.value)} />
        </div>
      </div>
      <div style={resultStyle}>
        {result === null
          ? 'Provide A Molecular Weight To Convert Across Mass And Molar Units.'
          : <>Converted: <strong>{result.toPrecision(6)}</strong> {to}</>
        }
      </div>
      <p style={noteStyle}>{RESEARCH_NOTE}</p>
    </section>
  );
}

function StabilitySection() {
  const [shelf, setShelf] = useState('28');
  const [tFrom, setTFrom] = useState('4');
  const [tTo, setTTo] = useState('25');
  const [ea, setEa] = useState('83');

  const days = arrheniusStability({
    shelfDaysAtTempC: Number(shelf),
    fromTempC: Number(tFrom),
    toTempC: Number(tTo),
    activationEnergyKJmol: Number(ea) || undefined,
  });

  return (
    <section id="stability" style={sectionStyle}>
      <CalculatorHeader
        title="Arrhenius Stability Estimator"
        why="Predict shelf-life at one temperature given a known shelf-life at another. Useful for comparing fridge versus room-temp storage windows. Default Ea is 83 kJ/mol, a common literature value for lyophilized peptides."
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <div>
          <label style={labelStyle}>Known Shelf Days</label>
          <input style={inputStyle} type="number" value={shelf} onChange={(e) => setShelf(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Known Temperature (C)</label>
          <input style={inputStyle} type="number" value={tFrom} onChange={(e) => setTFrom(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Target Temperature (C)</label>
          <input style={inputStyle} type="number" value={tTo} onChange={(e) => setTTo(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Activation Energy (kJ/mol)</label>
          <input style={inputStyle} type="number" value={ea} onChange={(e) => setEa(e.target.value)} />
        </div>
      </div>
      <div style={resultStyle}>
        {days === null
          ? 'Enter Valid Inputs.'
          : <>Predicted Shelf: <strong>{days.toFixed(1)} Days</strong> At {tTo} C</>
        }
      </div>
      <p style={noteStyle}>{RESEARCH_NOTE}</p>
    </section>
  );
}

function CostSection() {
  const [price, setPrice] = useState('120');
  const [mass, setMass] = useState('5');
  const [dose, setDose] = useState('250');

  const out = costPerDose({
    vialPriceUsd: Number(price),
    vialMassMg: Number(mass),
    dosageMcg: Number(dose),
  });

  return (
    <section id="cost" style={sectionStyle}>
      <CalculatorHeader
        title="Cost-Per-Dose Calculator"
        why="Compare cost across vial sizes and dose levels. Useful for planning study budgets when running multi-dose experiments."
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <div>
          <label style={labelStyle}>Vial Price (USD)</label>
          <input style={inputStyle} type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Vial Mass (mg)</label>
          <input style={inputStyle} type="number" value={mass} onChange={(e) => setMass(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Per-Dose Amount (mcg)</label>
          <input style={inputStyle} type="number" value={dose} onChange={(e) => setDose(e.target.value)} />
        </div>
      </div>
      <div style={resultStyle}>
        {!out
          ? 'Enter Valid Inputs.'
          : <>Doses Per Vial: <strong>{out.dosesPerVial.toFixed(1)}</strong>{'  '}|{'  '}Dollars Per Dose: <strong>${out.dollarsPerDose.toFixed(3)}</strong></>
        }
      </div>
      <p style={noteStyle}>{RESEARCH_NOTE}</p>
    </section>
  );
}

function PoolingSection() {
  const [mass, setMass] = useState('5');
  const [count, setCount] = useState('3');
  const [diluent, setDiluent] = useState('10');

  const out = vialPooling({
    vialMassMg: Number(mass),
    vialCount: Number(count),
    totalDiluentMl: Number(diluent),
  });

  return (
    <section id="pooling" style={sectionStyle}>
      <CalculatorHeader
        title="Vial Pooling"
        why="When pooling multiple vials into a single sterile container, the resulting concentration depends on combined mass and total diluent. Use this to compute the final mg/mL."
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <div>
          <label style={labelStyle}>Vial Mass (mg)</label>
          <input style={inputStyle} type="number" value={mass} onChange={(e) => setMass(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Vial Count</label>
          <input style={inputStyle} type="number" value={count} onChange={(e) => setCount(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Total Diluent (mL)</label>
          <input style={inputStyle} type="number" value={diluent} onChange={(e) => setDiluent(e.target.value)} />
        </div>
      </div>
      <div style={resultStyle}>
        {!out
          ? 'Enter Valid Inputs.'
          : <>Total Mass: <strong>{out.totalMassMg.toFixed(2)} mg</strong>{'  '}|{'  '}Concentration: <strong>{out.concentrationMgPerMl.toFixed(3)} mg/mL</strong></>
        }
      </div>
      <p style={noteStyle}>{RESEARCH_NOTE}</p>
    </section>
  );
}

/* ----- Wave 2 calculators ----- */

function HplcRtSection() {
  const [seq, setSeq] = useState('GIGAVLKVLTTGLPALISWIKRKRQQ');
  const [start, setStart] = useState('5');
  const [end, setEnd] = useState('65');
  const [gradient, setGradient] = useState('20');

  const rt = predictHplcRetentionTime({
    sequence: seq,
    gradientPctBStart: Number(start),
    gradientPctBEnd: Number(end),
    gradientMin: Number(gradient),
    c18Column: true,
  });

  return (
    <section id="hplc-rt" style={sectionStyle}>
      <CalculatorHeader
        title="HPLC Retention Time Predictor"
        why="Roughly estimate where a peptide will elute on a C18 reverse-phase column using Bull-Breese hydrophobicity. Useful for planning a purification gradient before injection. Lab estimate, not a clinical prediction."
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>One-Letter Sequence</label>
          <input style={inputStyle} type="text" value={seq} onChange={(e) => setSeq(e.target.value)} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginTop: 12 }}>
        <div>
          <label style={labelStyle}>Gradient Start (%B)</label>
          <input style={inputStyle} type="number" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Gradient End (%B)</label>
          <input style={inputStyle} type="number" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Gradient Length (Min)</label>
          <input style={inputStyle} type="number" value={gradient} onChange={(e) => setGradient(e.target.value)} />
        </div>
      </div>
      <div style={resultStyle}>
        {rt === null
          ? 'Enter A Valid One-Letter Sequence.'
          : <>Predicted Retention Time: <strong>{rt.toFixed(2)} Min</strong> (C18, 0.1% TFA)</>
        }
      </div>
      <p style={noteStyle}>{RESEARCH_NOTE}</p>
    </section>
  );
}

function MassSpecSection() {
  const [seq, setSeq] = useState('GIGAVLKVLTTGLPALISWIKRKRQQ');
  const [mode, setMode] = useState<'positive' | 'negative'>('positive');
  const [maxCharge, setMaxCharge] = useState('4');

  const peaks = predictMassSpecPeaks({
    sequence: seq,
    mode,
    maxCharge: Number(maxCharge),
  });

  return (
    <section id="mass-spec" style={sectionStyle}>
      <CalculatorHeader
        title="Mass Spec m/z Predictor"
        why="Predict the expected [M+nH]^n+ peaks for a peptide so you know where to look in the ESI-MS spectrum. Useful for identity confirmation after synthesis."
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>One-Letter Sequence</label>
          <input style={inputStyle} type="text" value={seq} onChange={(e) => setSeq(e.target.value)} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginTop: 12 }}>
        <div>
          <label style={labelStyle}>Ionization Mode</label>
          <select style={inputStyle} value={mode} onChange={(e) => setMode(e.target.value as 'positive' | 'negative')}>
            <option value="positive">Positive</option>
            <option value="negative">Negative</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Max Charge State</label>
          <input style={inputStyle} type="number" value={maxCharge} onChange={(e) => setMaxCharge(e.target.value)} />
        </div>
      </div>
      <div style={{ ...resultStyle, padding: 0, background: 'transparent', border: 'none' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, marginTop: 8 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8, color: '#A8B4C0', fontSize: 12 }}>Charge</th>
              <th style={{ textAlign: 'left', padding: 8, color: '#A8B4C0', fontSize: 12 }}>m/z</th>
              <th style={{ textAlign: 'left', padding: 8, color: '#A8B4C0', fontSize: 12 }}>Rel Intensity</th>
            </tr>
          </thead>
          <tbody>
            {peaks.map((p) => (
              <tr key={p.charge}>
                <td style={{ padding: 8, color: '#FFFFFF' }}>{`+${p.charge}`}</td>
                <td style={{ padding: 8, color: '#00C4BC', fontWeight: 600 }}>{p.mz.toFixed(4)}</td>
                <td style={{ padding: 8, color: '#D0DAE4' }}>{p.intensity.toFixed(3)}</td>
              </tr>
            ))}
            {peaks.length === 0 && (
              <tr><td colSpan={3} style={{ padding: 8, color: '#A8B4C0' }}>Enter A Valid One-Letter Sequence.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p style={noteStyle}>{RESEARCH_NOTE}</p>
    </section>
  );
}

function SppsSection() {
  const [seq, setSeq] = useState('GIGAVLKVLTTGLPALISWIKRKRQQ');
  const [scale, setScale] = useState('100');
  const [aaCost, setAaCost] = useState('10');
  const [resinCost, setResinCost] = useState('20');

  const out = estimateFmocSppsCost({
    sequence: seq,
    scaleUmol: Number(scale),
    fmocAaCostPerGram: Number(aaCost),
    resinCostPerGram: Number(resinCost),
    includeReagents: true,
  });

  return (
    <section id="spps-cost" style={sectionStyle}>
      <CalculatorHeader
        title="Fmoc-SPPS Cost Estimator"
        why="Plan the cost of synthesizing a peptide via solid-phase Fmoc chemistry. Breaks down amino acid, resin, reagent, cleavage, and labor costs."
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>One-Letter Sequence</label>
          <input style={inputStyle} type="text" value={seq} onChange={(e) => setSeq(e.target.value)} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginTop: 12 }}>
        <div>
          <label style={labelStyle}>Scale (umol)</label>
          <input style={inputStyle} type="number" value={scale} onChange={(e) => setScale(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Fmoc AA Cost ($/g)</label>
          <input style={inputStyle} type="number" value={aaCost} onChange={(e) => setAaCost(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Resin Cost ($/g)</label>
          <input style={inputStyle} type="number" value={resinCost} onChange={(e) => setResinCost(e.target.value)} />
        </div>
      </div>
      <div style={resultStyle}>
        {!out ? 'Enter A Valid Sequence.' : (
          <>
            Total Estimated Cost: <strong>${out.totalUsd.toFixed(2)}</strong>
            <div style={{ marginTop: 10 }}>
              {out.breakdown.map((b) => (
                <div key={b.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#D0DAE4' }}>
                  <span>{b.label}</span>
                  <span>${b.costUsd.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <p style={noteStyle}>{RESEARCH_NOTE}</p>
    </section>
  );
}

function SolubilitySection() {
  const [gravy, setGravy] = useState('-0.4');
  const [pi, setPi] = useState('10.2');
  const [len, setLen] = useState('25');
  const [pH, setPH] = useState('7.4');

  const out = predictSolubility({
    gravy: Number(gravy),
    isoelectricPoint: Number(pi),
    sequenceLength: Number(len),
    pH: Number(pH),
  });

  return (
    <section id="solubility" style={sectionStyle}>
      <CalculatorHeader
        title="Solubility Predictor"
        why="A heuristic estimate of aqueous solubility using GRAVY (hydrophobicity), distance of pI from solution pH, and sequence length. Useful for guessing whether a peptide will dissolve cleanly in PBS, acetic acid, or DMSO."
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <div>
          <label style={labelStyle}>GRAVY</label>
          <input style={inputStyle} type="number" step="0.01" value={gravy} onChange={(e) => setGravy(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Isoelectric Point (pI)</label>
          <input style={inputStyle} type="number" step="0.01" value={pi} onChange={(e) => setPi(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Sequence Length</label>
          <input style={inputStyle} type="number" value={len} onChange={(e) => setLen(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Solution pH</label>
          <input style={inputStyle} type="number" step="0.1" value={pH} onChange={(e) => setPH(e.target.value)} />
        </div>
      </div>
      <div style={resultStyle}>
        {!out ? 'Enter Valid Inputs.' : (
          <>
            Predicted Solubility: <strong>{out.predictedSolubilityMgMl.toFixed(3)} mg/mL</strong> ({out.classification.toUpperCase()})
            <div style={{ fontSize: 12, color: '#A8B4C0', marginTop: 6 }}>{out.notes}</div>
          </>
        )}
      </div>
      <p style={noteStyle}>{RESEARCH_NOTE}</p>
    </section>
  );
}

function VialQuantitySection() {
  const [n, setN] = useState('30');
  const [doses, setDoses] = useState('12');
  const [mgPerDose, setMgPerDose] = useState('0.25');
  const [mgPerVial, setMgPerVial] = useState('5');

  const out = vialQuantityPower({
    n: Number(n),
    dosesPerSubject: Number(doses),
    mgPerDose: Number(mgPerDose),
    mgPerVial: Number(mgPerVial),
  });

  return (
    <section id="vial-quantity" style={sectionStyle}>
      <CalculatorHeader
        title="Vial Quantity Power Calculator"
        why="Plan vial procurement for a study. Given a sample size, doses per subject, and dose mass, compute the number of vials to order."
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <div>
          <label style={labelStyle}>Sample Size (n)</label>
          <input style={inputStyle} type="number" value={n} onChange={(e) => setN(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Doses Per Subject</label>
          <input style={inputStyle} type="number" value={doses} onChange={(e) => setDoses(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Mg Per Dose</label>
          <input style={inputStyle} type="number" step="0.01" value={mgPerDose} onChange={(e) => setMgPerDose(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Mg Per Vial</label>
          <input style={inputStyle} type="number" step="0.01" value={mgPerVial} onChange={(e) => setMgPerVial(e.target.value)} />
        </div>
      </div>
      <div style={resultStyle}>
        {!out ? 'Enter Valid Inputs.' : (
          <>
            Vials Needed: <strong>{out.vialsNeeded}</strong>{'  '}|{'  '}
            Per-Subject Mass: <strong>{out.perSubjectMg.toFixed(2)} mg</strong>{'  '}|{'  '}
            Total Mass: <strong>{out.totalMg.toFixed(2)} mg</strong>
          </>
        )}
      </div>
      <p style={noteStyle}>{RESEARCH_NOTE}</p>
    </section>
  );
}

export default function CalculatorSuite() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <Reconstitution />
      <DilutionSection />
      <ConcentrationSection />
      <StabilitySection />
      <CostSection />
      <PoolingSection />
      <HplcRtSection />
      <MassSpecSection />
      <SppsSection />
      <SolubilitySection />
      <VialQuantitySection />
    </div>
  );
}
