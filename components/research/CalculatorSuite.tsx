'use client';

/**
 * CalculatorSuite -- eleven researcher calculators rendered as anchored
 * sections on /research/calculators. The first six are original (Wave 1);
 * the last five (HPLC RT, MS m/z, Fmoc-SPPS Cost, Solubility, Vial Quantity
 * Power) were added in Wave 2.
 *
 * Research use only. Lab-prep math, not human dosing.
 *
 * Bug fixes applied:
 *   - MW field in ConcentrationConverter hides when not needed (mass↔mass or molar↔molar).
 *   - Mass Spec validates for non-standard AA characters before predicting.
 *   - Sequence inputs have maxLength=500 to prevent UI freeze on large pastes.
 *   - Vial Quantity dose count formatted with toLocaleString().
 */

import { useState, useMemo } from 'react';
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
import IframeLink from '@/components/ui/IframeLink';

const RESEARCH_NOTE = 'Research Use Only. Not Intended As Medical Advice Or Human Dosing.';
// Note: CSS capitalization handles UI rendering

const chromeOuterStyle: React.CSSProperties = {
  scrollMarginTop: 100,
  marginBottom: 24,
  borderRadius: 20,
  padding: 4,
  background: 'linear-gradient(135deg, #e6e9f0 0%, #8a95a5 50%, #e6e9f0 100%)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
};

const chromeInnerStyle: React.CSSProperties = {
  borderRadius: 16,
  padding: 24,
  background: '#0B0E14',
  boxShadow: 'inset 0 0 20px rgba(0,0,0,0.8)',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: '#A8B4C0',
  marginBottom: 6,
  textTransform: 'capitalize', // Title Case
  letterSpacing: '0.02em',
};

const inputStyleBase: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255, 255, 255, 0.05)', // Glassmorphism
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  color: '#A8B2C1',
  padding: '10px 12px',
  borderRadius: 8,
  fontSize: 16,
  fontFamily: 'monospace',
  outline: 'none',
  transition: 'all 0.3s ease',
};

function StyledInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [focused, setFocused] = useState(false);
  return (
    <input 
      {...props}
      onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
      style={{
        ...inputStyleBase,
        borderColor: focused ? '#A8B2C1' : 'rgba(255, 255, 255, 0.1)',
        boxShadow: focused ? '0 0 10px rgba(168,178,193,0.3), inset 0 2px 4px rgba(0,0,0,0.3)' : 'inset 0 2px 4px rgba(0,0,0,0.3)',
        ...props.style
      }}
    />
  );
}

function StyledSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const [focused, setFocused] = useState(false);
  return (
    <select 
      {...props}
      onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
      style={{
        ...inputStyleBase,
        borderColor: focused ? '#A8B2C1' : 'rgba(255, 255, 255, 0.1)',
        boxShadow: focused ? '0 0 10px rgba(168,178,193,0.3), inset 0 2px 4px rgba(0,0,0,0.3)' : 'inset 0 2px 4px rgba(0,0,0,0.3)',
        ...props.style
      }}
    />
  );
}

const explainerStyle: React.CSSProperties = {
  color: '#A8B4C0',
  fontSize: 14,
  lineHeight: 1.6,
  margin: '0 0 16px',
};

const resultStyle: React.CSSProperties = {
  marginTop: 16,
  padding: 16,
  borderRadius: 12,
  background: '#080A0F',
  border: '1px solid rgba(168,178,193,0.5)',
  boxShadow: '0 0 20px rgba(168,178,193,0.2), inset 0 0 10px rgba(168,178,193,0.1)', // Neon Glow
  color: '#A8B2C1',
  fontSize: 16,
  fontFamily: 'monospace',
  textAlign: 'center',
  textTransform: 'capitalize', // Title Case
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
      <h3 style={{ margin: '12px 0 4px', color: '#A8B2C1', fontSize: 13, textTransform: 'capitalize', letterSpacing: '0.06em' }}>
        Why This Matters
      </h3>
      <p style={explainerStyle}>{why}</p>
    </>
  );
}

const POPULAR_PEPTIDES = [
  { name: 'Custom (Enter Manually)', vialMass: '', defaultDose: '', unit: 'mcg' },
  { name: 'BPC-157', vialMass: '5', defaultDose: '250', unit: 'mcg' },
  { name: 'TB-500', vialMass: '5', defaultDose: '2.5', unit: 'mg' },
  { name: 'CJC-1295 / Ipamorelin', vialMass: '5', defaultDose: '300', unit: 'mcg' },
  { name: 'Tirzepatide', vialMass: '10', defaultDose: '2.5', unit: 'mg' },
  { name: 'Semaglutide', vialMass: '5', defaultDose: '0.25', unit: 'mg' },
  { name: 'Retatrutide', vialMass: '10', defaultDose: '2', unit: 'mg' },
  { name: 'GHK-Cu', vialMass: '50', defaultDose: '2', unit: 'mg' },
  { name: 'Melanotan II', vialMass: '10', defaultDose: '250', unit: 'mcg' },
  { name: 'PT-141', vialMass: '10', defaultDose: '1', unit: 'mg' },
  { name: 'MOTS-c', vialMass: '10', defaultDose: '5', unit: 'mg' }
];

function Reconstitution() {
  const [peptide, setPeptide] = useState(POPULAR_PEPTIDES[0].name);
  const [vialMass, setVialMass] = useState('');
  const [diluentMl, setDiluentMl] = useState('');
  const [desiredMass, setDesiredMass] = useState('');
  const [unit, setUnit] = useState('mcg');

  // When peptide changes, update defaults
  const handlePeptideChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setPeptide(val);
    const found = POPULAR_PEPTIDES.find(p => p.name === val);
    if (found && found.name !== 'Custom (Enter Manually)') {
      setVialMass(found.vialMass);
      setDesiredMass(found.defaultDose);
      setUnit(found.unit);
      setDiluentMl('2'); // standard recommendation
    } else {
      setVialMass('');
      setDesiredMass('');
      setDiluentMl('');
    }
  };

  const vMass = Number(vialMass);
  const dilMl = Number(diluentMl);
  // desiredMass in the helper expects mg, so convert if mcg
  const dMassNumeric = Number(desiredMass);
  const dMassMg = unit === 'mcg' ? dMassNumeric / 1000 : dMassNumeric;

  const drawMl = drawVolumeMl(vMass, dilMl, dMassMg);
  const drawUnits = drawMl !== null && isFinite(drawMl) ? Math.round(drawMl * 100) : null;

  return (
    <section id="reconstitution" style={chromeOuterStyle}>
      <div style={chromeInnerStyle}>
        <CalculatorHeader
          title="Reconstitution Calculator"
          why="Most peptides ship freeze-dried. Reconstitution turns the powder into a usable working stock. Select your peptide or enter values manually to get plain-English preparation and drawing instructions."
        />
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, marginBottom: 16 }}>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Step 1: Select Peptide</div>
            <StyledSelect value={peptide} onChange={handlePeptideChange}>
              {POPULAR_PEPTIDES.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
            </StyledSelect>
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Step 2: Vial Mass (mg)</div>
            <StyledInput type="number" step="any" min={0} value={vialMass} placeholder="e.g. 5" onChange={(e) => setVialMass(e.target.value)} />
          </label>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Step 3: Bacteriostatic Water Added (mL)</div>
            <StyledInput type="number" step="any" min={0} value={diluentMl} placeholder="e.g. 2" onChange={(e) => setDiluentMl(e.target.value)} />
          </label>
        </div>

        <div style={{ ...resultStyle, marginTop: 20 }}>
          {vMass > 0 && dilMl > 0 ? (
            <div style={{ color: '#00E5FF', fontWeight: 800, fontSize: 18 }}>
              Add {dilMl} mL of sterile diluent to the vial.
            </div>
          ) : (
            <div style={{ fontSize: 14 }}>Enter vial mass and diluent volume above.</div>
          )}
        </div>

        <h3 style={{ margin: '24px 0 8px', color: '#FFFFFF', fontSize: 16 }}>Draw Volume Helper</h3>
        <p style={{ color: '#A8B4C0', fontSize: 14, marginBottom: 16 }}>
          How much do you want to draw for a single dose?
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Desired Target Dose</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <StyledInput style={{ flex: 1 }} type="number" step="any" min={0} value={desiredMass} placeholder="e.g. 250" onChange={(e) => setDesiredMass(e.target.value)} />
              <StyledSelect style={{ width: 80 }} value={unit} onChange={(e) => setUnit(e.target.value)}>
                <option value="mcg">mcg</option>
                <option value="mg">mg</option>
              </StyledSelect>
            </div>
          </label>
        </div>

        <div style={{ ...resultStyle, marginTop: 20 }}>
          {drawMl !== null && isFinite(drawMl) && drawMl > 0 ? (
            <div>
              To draw a dose of <strong>{dMassNumeric} {unit}</strong>, pull the syringe to 
              <br/>
              <span style={{ fontSize: 24, color: '#68D391', fontWeight: 800, display: 'block', margin: '12px 0' }}>
                {drawUnits} units
              </span>
              <span style={{ fontSize: 13, color: '#A8B4C0' }}>(on a standard U-100 syringe. That is {drawMl.toFixed(3)} mL)</span>
            </div>
          ) : (
            <div style={{ fontSize: 14 }}>Enter a desired dose above.</div>
          )}
        </div>

        <p style={noteStyle}>{RESEARCH_NOTE}</p>
      </div>
    </section>
  );
}

function DilutionSection() {
  const [stock, setStock] = useState('');
  const [factor, setFactor] = useState('');
  const [steps, setSteps] = useState('');

  const series = dilutionSeries({
    stockConcentration: Number(stock),
    dilutionFactor: Number(factor),
    steps: Math.max(1, Math.floor(Number(steps) || 1)),
  });

  return (
    <section id="dilution" style={chromeOuterStyle}>
      <div style={chromeInnerStyle}>
      <CalculatorHeader
        title="Serial Dilution Series"
        why="Many in-vitro assays need a serial dilution series across log-scale ranges. This generates the per-step concentrations from a stock down to your detection limit."
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <label style={{ display: "block" }}>
          <div style={labelStyle}>Stock Concentration (Units)</div>
          <StyledInput  type="number" step="any" min={0} value={stock} onChange={(e) => setStock(e.target.value)} />
        </label>
        <label style={{ display: "block" }}>
          <div style={labelStyle}>Dilution Factor</div>
          <StyledInput  type="number" step="any" min={2} value={factor} onChange={(e) => setFactor(e.target.value)} />
        </label>
        <label style={{ display: "block" }}>
          <div style={labelStyle}>Steps</div>
          <StyledInput  type="number" min={1} max={20} step={1} value={steps} onChange={(e) => setSteps(e.target.value)} />
        </label>
      </div>
      <div style={{ ...resultStyle, padding: 0, background: 'transparent', border: 'none' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8, color: '#A8B4C0', fontSize: 12 }}>Step</th>
              <th style={{ textAlign: 'left', padding: 8, color: '#A8B4C0', fontSize: 12 }}>Concentration (Same Units)</th>
            </tr>
          </thead>
          <tbody>
            {series.map((s) => (
              <tr key={s.stepNumber}>
                <td style={{ padding: 8, color: '#FFFFFF' }}>{s.stepNumber}</td>
                <td style={{ padding: 8, color: '#A8B2C1', fontWeight: 600 }}>
                  {Math.abs(s.concentration) >= 0.001 && Math.abs(s.concentration) < 1e5
                    ? s.concentration.toPrecision(4)
                    : s.concentration.toExponential(3)}
                </td>
              </tr>
            ))}
            {series.length === 0 && (
              <tr><td colSpan={2} style={{ padding: 8, color: '#A8B4C0' }}>Enter Positive Stock And A Factor Above 1.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p style={noteStyle}>{RESEARCH_NOTE}</p>
    </div>
    </section>
  );
}

const UNITS: ConcentrationUnit[] = ['mg/mL', 'mcg/mL', 'ng/mL', 'mmol/L', 'umol/L', 'nmol/L'];

const MASS_UNITS = new Set(['mg/mL', 'mcg/mL', 'ng/mL']);
const MOLAR_UNITS = new Set(['mmol/L', 'umol/L', 'nmol/L']);

function needsMW(from: ConcentrationUnit, to: ConcentrationUnit): boolean {
  return (MASS_UNITS.has(from) && MOLAR_UNITS.has(to)) ||
         (MOLAR_UNITS.has(from) && MASS_UNITS.has(to));
}

function ConcentrationSection() {
  const [value, setValue] = useState('');
  const [from, setFrom] = useState<ConcentrationUnit>('mg/mL');
  const [to, setTo] = useState<ConcentrationUnit>('mcg/mL');
  const [mw, setMw] = useState('');

  const mwRequired = needsMW(from, to);

  const result = concentrationConvert({
    value: Number(value),
    fromUnit: from,
    toUnit: to,
    molecularWeightDa: mwRequired ? (Number(mw) || null) : null,
  });

  return (
    <section id="concentration" style={chromeOuterStyle}>
      <div style={chromeInnerStyle}>
      <CalculatorHeader
        title="Concentration Converter"
        why="Studies report concentrations in many units. Convert freely between mass per volume (mg/mL, mcg/mL, ng/mL) and molar (mmol/L, umol/L, nmol/L). Molar conversions require molecular weight."
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <label style={{ display: "block" }}>
          <div style={labelStyle}>Value</div>
          <StyledInput  type="number" step="any" value={value} onChange={(e) => setValue(e.target.value)} />
        </label>
        <label style={{ display: "block" }}>
          <div style={labelStyle}>From Unit</div>
          <StyledSelect value={from} onChange={(e) => setFrom(e.target.value as ConcentrationUnit)}>
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </StyledSelect>
        </label>
        <label style={{ display: "block" }}>
          <div style={labelStyle}>To Unit</div>
          <StyledSelect value={to} onChange={(e) => setTo(e.target.value as ConcentrationUnit)}>
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </StyledSelect>
        </label>
        {mwRequired && (
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Molecular Weight (Da)</div>
            <StyledInput  type="number" step="any" value={mw} onChange={(e) => setMw(e.target.value)} />
          </label>
        )}
      </div>
      <div style={resultStyle}>
        {result === null
          ? 'Enter A Molecular Weight (Da) To Convert Between Mass And Molar Units.'
          : from === to
          ? <>Same Unit Selected — No Conversion Needed: <strong>{Number(value).toPrecision(6)}</strong> {to}</>
          : <>Converted: <strong>{result.toPrecision(6)}</strong> {to}</>
        }
      </div>
      <p style={noteStyle}>{RESEARCH_NOTE}</p>
    </div>
    </section>
  );
}

function StabilitySection() {
  const [shelf, setShelf] = useState('');
  const [tFrom, setTFrom] = useState('');
  const [tTo, setTTo] = useState('');
  const [ea, setEa] = useState('');

  const days = arrheniusStability({
    shelfDaysAtTempC: Number(shelf),
    fromTempC: Number(tFrom),
    toTempC: Number(tTo),
    activationEnergyKJmol: ea.trim() === '' ? undefined : Number(ea),
  });

  return (
    <section id="stability" style={chromeOuterStyle}>
      <div style={chromeInnerStyle}>
      <CalculatorHeader
        title="Arrhenius Stability Estimator"
        why="Predict shelf-life at one temperature given a known shelf-life at another. Useful for comparing fridge versus room-temp storage windows. Default Ea is 83 kJ/mol, a common literature value for lyophilized peptides."
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <label style={{ display: "block" }}>
          <div style={labelStyle}>Known Shelf Days</div>
          <StyledInput  type="number" step="any" value={shelf} onChange={(e) => setShelf(e.target.value)} />
        </label>
        <label style={{ display: "block" }}>
          <div style={labelStyle}>Known Temperature (C)</div>
          <StyledInput  type="number" step="any" value={tFrom} onChange={(e) => setTFrom(e.target.value)} />
        </label>
        <label style={{ display: "block" }}>
          <div style={labelStyle}>Target Temperature (C)</div>
          <StyledInput  type="number" step="any" value={tTo} onChange={(e) => setTTo(e.target.value)} />
        </label>
        <label style={{ display: "block" }}>
          <div style={labelStyle}>Activation Energy (kJ/mol)</div>
          <StyledInput  type="number" step="any" value={ea} onChange={(e) => setEa(e.target.value)} />
        </label>
      </div>
      <div style={resultStyle}>
        {days === null
          ? 'Enter Valid Inputs (Temperatures Must Be Above −273°C).'
          : ea.trim() !== '' && Number(ea) === 0
          ? 'Activation Energy Cannot Be Zero — Temperature Has No Effect At Ea=0. Use A Value > 0 kJ/mol.'
          : <>Predicted Shelf: <strong>{days.toFixed(1)} Days</strong> At {tTo}°C</>
        }
      </div>
      <p style={noteStyle}>{RESEARCH_NOTE}</p>
    </div>
    </section>
  );
}

function CostSection() {
  const [price, setPrice] = useState('');
  const [mass, setMass] = useState('');
  const [dose, setDose] = useState('');

  const out = costPerDose({
    vialPriceUsd: Number(price),
    vialMassMg: Number(mass),
    dosageMcg: Number(dose),
  });

  return (
    <section id="cost" style={chromeOuterStyle}>
      <div style={chromeInnerStyle}>
      <CalculatorHeader
        title="Cost-Per-Dose Calculator"
        why="Compare cost across vial sizes and dose levels. Useful for planning study budgets when running multi-dose experiments."
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <label style={{ display: "block" }}>
          <div style={labelStyle}>Vial Price (USD)</div>
          <StyledInput  type="number" step="any" value={price} onChange={(e) => setPrice(e.target.value)} />
        </label>
        <label style={{ display: "block" }}>
          <div style={labelStyle}>Vial Mass (mg)</div>
          <StyledInput  type="number" step="any" value={mass} onChange={(e) => setMass(e.target.value)} />
        </label>
        <label style={{ display: "block" }}>
          <div style={labelStyle}>Per-Dose Amount (mcg)</div>
          <StyledInput  type="number" step="any" value={dose} onChange={(e) => setDose(e.target.value)} />
        </label>
      </div>
      <div style={resultStyle}>
        {!out
          ? 'Enter Valid Inputs.'
          : <>Doses Per Vial: <strong>{out.dosesPerVial.toFixed(1)}</strong>{'  '}|{'  '}Dollars Per Dose: <strong>${out.dollarsPerDose === 0 ? '0.00' : out.dollarsPerDose.toFixed(3)}</strong></>
        }
      </div>
      <p style={noteStyle}>{RESEARCH_NOTE}</p>
    </div>
    </section>
  );
}

function PoolingSection() {
  const [mass, setMass] = useState('');
  const [count, setCount] = useState('');
  const [diluent, setDiluent] = useState('');

  const out = vialPooling({
    vialMassMg: Number(mass),
    vialCount: Math.max(1, Math.floor(Number(count) || 1)),
    totalDiluentMl: Number(diluent),
  });

  return (
    <section id="pooling" style={chromeOuterStyle}>
      <div style={chromeInnerStyle}>
      <CalculatorHeader
        title="Vial Pooling"
        why="When pooling multiple vials into a single sterile container, the resulting concentration depends on combined mass and total diluent. Use this to compute the final mg/mL."
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <label style={{ display: "block" }}>
          <div style={labelStyle}>Per-Vial Mass (mg)</div>
          <StyledInput  type="number" step="any" value={mass} onChange={(e) => setMass(e.target.value)} />
        </label>
        <label style={{ display: "block" }}>
          <div style={labelStyle}>Vial Count</div>
          <StyledInput  type="number" min={1} step={1} value={count} onChange={(e) => setCount(e.target.value)} />
        </label>
        <label style={{ display: "block" }}>
          <div style={labelStyle}>Total Diluent (mL)</div>
          <StyledInput  type="number" step="any" value={diluent} onChange={(e) => setDiluent(e.target.value)} />
        </label>
      </div>
      <div style={resultStyle}>
        {!out
          ? 'Enter Valid Inputs.'
          : <>Total Mass: <strong>{out.totalMassMg.toFixed(2)} mg</strong>{'  '}|{'  '}Concentration: <strong>{out.concentrationMgPerMl.toFixed(3)} mg/mL</strong></>
        }
      </div>
      <p style={noteStyle}>{RESEARCH_NOTE}</p>
    </div>
    </section>
  );
}

/* ----- Wave 2 calculators ----- */

function HplcRtSection() {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [seq, setSeq] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [gradient, setGradient] = useState('');

  const cleanSeq = seq.replace(/\s+/g, '').toUpperCase();
  const unknownChars = useMemo(() => {
    const chars = new Set<string>();
    for (const c of cleanSeq) {
      if (!STANDARD_AA.has(c)) chars.add(c);
    }
    return [...chars];
  }, [cleanSeq]);

  const rt = predictHplcRetentionTime({
    sequence: seq,
    gradientPctBStart: start.trim() === '' ? undefined : Number(start),
    gradientPctBEnd: end.trim() === '' ? undefined : Number(end),
    gradientMin: gradient.trim() === '' ? undefined : Number(gradient),
    c18Column: true,
  });

  const gradientInvalid = gradient.trim() !== '' && Number(gradient) <= 0;

  return (
    <section id="hplc-rt" style={chromeOuterStyle}>
      <div style={chromeInnerStyle}>
      <CalculatorHeader
        title="HPLC Retention Time Predictor"
        why="Roughly estimate where a peptide will elute on a C18 reverse-phase column using Bull-Breese hydrophobicity. Useful for planning a purification gradient before injection. Lab estimate, not a clinical prediction."
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
        <label style={{ display: "block" }}>
          <div style={labelStyle}>One-Letter Sequence (Standard 20 AA Codes)</div>
          <StyledInput  type="text" value={seq} maxLength={500} onChange={(e) => setSeq(e.target.value)} />
          {unknownChars.length > 0 && (
            <div style={{ marginTop: 6, fontSize: 12, color: '#F6AD55', background: 'rgba(246,173,85,0.10)', border: '1px solid rgba(246,173,85,0.30)', borderRadius: 6, padding: '5px 10px' }}>
              ⚠ Non-standard characters detected: <strong>{unknownChars.join(', ')}</strong>. These are ignored for hydrophobicity, affecting accuracy. Use only: A C D E F G H I K L M N P Q R S T V W Y.
            </div>
          )}
        </label>
      </div>
      <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} style={{ background: 'transparent', border: '1px solid rgba(168,178,193,0.3)', color: '#A8B2C1', padding: '6px 12px', borderRadius: 6, fontSize: 12, marginTop: 12, cursor: 'pointer' }}>{showAdvanced ? 'Hide Advanced Options' : 'Show Advanced Options'}</button>
      {showAdvanced && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginTop: 12 }}>
        <label style={{ display: "block" }}>
          <div style={labelStyle}>Gradient Start (%B)</div>
          <StyledInput  type="number" step="any" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label style={{ display: "block" }}>
          <div style={labelStyle}>Gradient End (%B)</div>
          <StyledInput  type="number" step="any" value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
        <label style={{ display: "block" }}>
          <div style={labelStyle}>Gradient Length (Min)</div>
          <StyledInput  type="number" step="any" value={gradient} onChange={(e) => setGradient(e.target.value)} />
        </label>
      </div>}
      <div style={resultStyle}>
        {gradientInvalid
          ? 'Gradient Length Must Be Greater Than 0 Minutes.'
          : rt === null
          ? Number(end) <= Number(start)
            ? 'Gradient End Must Be Greater Than Gradient Start.'
            : 'Enter A Valid One-Letter Sequence.'
          : <>
              Predicted Retention Time: <strong>{rt.toFixed(2)} Min</strong> (C18, 0.1% TFA)
            </>
        }
      </div>
      <p style={noteStyle}>{RESEARCH_NOTE}</p>
    </div>
    </section>
  );
}

// Standard 20 AA one-letter codes
const STANDARD_AA = new Set('ACDEFGHIKLMNPQRSTVWY');

function MassSpecSection() {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [seq, setSeq] = useState('');
  const [mode, setMode] = useState<'positive' | 'negative'>('positive');
  const [maxCharge, setMaxCharge] = useState('');

  const cleanSeq = seq.replace(/\s+/g, '').toUpperCase();
  const unknownChars = useMemo(() => {
    const chars = new Set<string>();
    for (const c of cleanSeq) {
      if (!STANDARD_AA.has(c)) chars.add(c);
    }
    return [...chars];
  }, [cleanSeq]);

  const peaks = predictMassSpecPeaks({
    sequence: seq,
    mode,
    maxCharge: maxCharge.trim() === '' ? undefined : Number(maxCharge),
  });

  return (
    <section id="mass-spec" style={chromeOuterStyle}>
      <div style={chromeInnerStyle}>
      <CalculatorHeader
        title="Mass Spec m/z Predictor"
        why="Predict the expected [M+nH]^n+ peaks for a peptide so you know where to look in the ESI-MS spectrum. Useful for identity confirmation after synthesis."
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
        <label style={{ display: "block" }}>
          <div style={labelStyle}>One-Letter Sequence (Standard 20 AA Codes)</div>
          <StyledInput  type="text" value={seq} maxLength={500} onChange={(e) => setSeq(e.target.value)} />
          {unknownChars.length > 0 && (
            <div style={{ marginTop: 6, fontSize: 12, color: '#F6AD55', background: 'rgba(246,173,85,0.10)', border: '1px solid rgba(246,173,85,0.30)', borderRadius: 6, padding: '5px 10px' }}>
              ⚠ Non-standard characters detected: <strong>{unknownChars.join(', ')}</strong>. These are treated as ~110 Da residues and will affect accuracy. Use only: A C D E F G H I K L M N P Q R S T V W Y.
            </div>
          )}
        </label>
      </div>
      <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} style={{ background: 'transparent', border: '1px solid rgba(168,178,193,0.3)', color: '#A8B2C1', padding: '6px 12px', borderRadius: 6, fontSize: 12, marginTop: 12, cursor: 'pointer' }}>{showAdvanced ? 'Hide Advanced Options' : 'Show Advanced Options'}</button>
      {showAdvanced && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginTop: 12 }}>
        <label style={{ display: "block" }}>
          <div style={labelStyle}>Ionization Mode</div>
          <StyledSelect value={mode} onChange={(e) => setMode(e.target.value as 'positive' | 'negative')}>
            <option value="positive">Positive</option>
            <option value="negative">Negative</option>
          </StyledSelect>
        </label>
        <label style={{ display: "block" }}>
          <div style={labelStyle}>Max Charge State</div>
          <StyledInput  type="number" step="any" min={1} value={maxCharge} onChange={(e) => setMaxCharge(e.target.value)} />
        </label>
      </div>}
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
                <td style={{ padding: 8, color: '#FFFFFF' }}>{mode === 'negative' ? `-${p.charge}` : `+${p.charge}`}</td>
                <td style={{ padding: 8, color: '#A8B2C1', fontWeight: 600 }}>{p.mz.toFixed(4)}</td>
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
    </div>
    </section>
  );
}

function SppsSection() {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [seq, setSeq] = useState('');
  const [scale, setScale] = useState('');
  const [aaCost, setAaCost] = useState('');
  const [resinCost, setResinCost] = useState('');

  const cleanSppsSeq = seq.replace(/\s+/g, '').toUpperCase();
  const sppsUnknownChars = useMemo(() => {
    const chars = new Set<string>();
    for (const c of cleanSppsSeq) {
      if (!STANDARD_AA.has(c)) chars.add(c);
    }
    return [...chars];
  }, [cleanSppsSeq]);

  const out = estimateFmocSppsCost({
    sequence: seq,
    scaleUmol: scale.trim() === '' ? undefined : Number(scale),
    fmocAaCostPerGram: aaCost.trim() === '' ? undefined : Number(aaCost),
    resinCostPerGram: resinCost.trim() === '' ? undefined : Number(resinCost),
    includeReagents: true,
  });

  return (
    <section id="spps-cost" style={chromeOuterStyle}>
      <div style={chromeInnerStyle}>
      <CalculatorHeader
        title="Fmoc-SPPS Cost Estimator"
        why="Plan the cost of synthesizing a peptide via solid-phase Fmoc chemistry. Breaks down amino acid, resin, reagent, cleavage, and labor costs."
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
        <label style={{ display: "block" }}>
          <div style={labelStyle}>One-Letter Sequence</div>
          <StyledInput  type="text" value={seq} maxLength={500} onChange={(e) => setSeq(e.target.value)} />
          {sppsUnknownChars.length > 0 && (
            <div style={{ marginTop: 6, fontSize: 12, color: '#F6AD55', background: 'rgba(246,173,85,0.10)', border: '1px solid rgba(246,173,85,0.30)', borderRadius: 6, padding: '5px 10px' }}>
              ⚠ Non-standard characters: <strong>{sppsUnknownChars.join(', ')}</strong>. Cost estimate may be inaccurate. Use standard 20 AA codes only.
            </div>
          )}
        </label>
      </div>
      <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} style={{ background: 'transparent', border: '1px solid rgba(168,178,193,0.3)', color: '#A8B2C1', padding: '6px 12px', borderRadius: 6, fontSize: 12, marginTop: 12, cursor: 'pointer' }}>{showAdvanced ? 'Hide Advanced Options' : 'Show Advanced Options'}</button>
      {showAdvanced && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginTop: 12 }}>
        <label style={{ display: "block" }}>
          <div style={labelStyle}>Scale (umol)</div>
          <StyledInput  type="number" step="any" value={scale} onChange={(e) => setScale(e.target.value)} />
        </label>
        <label style={{ display: "block" }}>
          <div style={labelStyle}>Fmoc AA Cost ($/g)</div>
          <StyledInput  type="number" step="any" value={aaCost} onChange={(e) => setAaCost(e.target.value)} />
        </label>
        <label style={{ display: "block" }}>
          <div style={labelStyle}>Resin Cost ($/g)</div>
          <StyledInput  type="number" step="any" value={resinCost} onChange={(e) => setResinCost(e.target.value)} />
        </label>
      </div>}
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
    </div>
    </section>
  );
}

function SolubilitySection() {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [gravy, setGravy] = useState('');
  const [pi, setPi] = useState('');
  const [len, setLen] = useState('');
  const [pH, setPH] = useState('');

  const out = predictSolubility({
    gravy: Number(gravy),
    isoelectricPoint: Number(pi),
    sequenceLength: Math.max(1, Math.floor(Number(len) || 1)),
    pH: pH.trim() === '' ? undefined : Number(pH),
  });

  return (
    <section id="solubility" style={chromeOuterStyle}>
      <div style={chromeInnerStyle}>
      <CalculatorHeader
        title="Solubility Predictor"
        why="A heuristic estimate of aqueous solubility using GRAVY (hydrophobicity), distance of pI from solution pH, and sequence length. Useful for guessing whether a peptide will dissolve cleanly in PBS, acetic acid, or DMSO. Get GRAVY and pI from ExPASy ProtParam (web.expasy.org/protparam)."
      />
      <div style={{ marginBottom: 10, fontSize: 12, color: '#A8B4C0' }}>
        💡 GRAVY score and isoelectric point (pI) can be calculated from your sequence at{' '}
        <IframeLink href="https://web.expasy.org/protparam/" style={{ color: '#A8B2C1' }}>ExPASy ProtParam</IframeLink>.
      </div>
      <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} style={{ background: 'transparent', border: '1px solid rgba(168,178,193,0.3)', color: '#A8B2C1', padding: '6px 12px', borderRadius: 6, fontSize: 12, marginBottom: 12, cursor: 'pointer' }}>{showAdvanced ? 'Hide Advanced Options' : 'Show Advanced Options'}</button>
      {showAdvanced && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <label style={{ display: "block" }}>
          <div style={labelStyle}>GRAVY</div>
          <StyledInput  type="number" step="0.01" value={gravy} onChange={(e) => setGravy(e.target.value)} />
        </label>
        <label style={{ display: "block" }}>
          <div style={labelStyle}>Isoelectric Point (pI)</div>
          <StyledInput  type="number" step="0.01" value={pi} onChange={(e) => setPi(e.target.value)} />
        </label>
        <label style={{ display: "block" }}>
          <div style={labelStyle}>Sequence Length</div>
          <StyledInput  type="number" step={1} min={1} value={len} onChange={(e) => setLen(e.target.value)} />
        </label>
        <label style={{ display: "block" }}>
          <div style={labelStyle}>Solution pH</div>
          <StyledInput  type="number" step="0.1" value={pH} onChange={(e) => setPH(e.target.value)} />
        </label>
      </div>}
      <div style={resultStyle}>
        {!out ? 'Enter Valid Inputs.' : (
          <>
            Predicted Solubility: <strong>{out.predictedSolubilityMgMl.toFixed(3)} mg/mL</strong> ({out.classification.toUpperCase()})
            <div style={{ fontSize: 12, color: '#A8B4C0', marginTop: 6 }}>{out.notes}</div>
          </>
        )}
      </div>
      <p style={noteStyle}>{RESEARCH_NOTE}</p>
    </div>
    </section>
  );
}

function VialQuantitySection() {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [n, setN] = useState('');
  const [doses, setDoses] = useState('');
  const [mgPerDose, setMgPerDose] = useState('');
  const [mgPerVial, setMgPerVial] = useState('');

  const out = vialQuantityPower({
    n: Math.max(1, Math.floor(Number(n) || 1)),
    dosesPerSubject: Math.max(1, Math.floor(Number(doses) || 1)),
    mgPerDose: Number(mgPerDose),
    mgPerVial: Number(mgPerVial),
  });

  return (
    <section id="vial-quantity" style={chromeOuterStyle}>
      <div style={chromeInnerStyle}>
      <CalculatorHeader
        title="Vial Quantity Power Calculator"
        why="Plan vial procurement for a study. Given a sample size, doses per subject, and dose mass, compute the number of vials to order."
      />
      <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} style={{ background: 'transparent', border: '1px solid rgba(168,178,193,0.3)', color: '#A8B2C1', padding: '6px 12px', borderRadius: 6, fontSize: 12, marginBottom: 12, cursor: 'pointer' }}>{showAdvanced ? 'Hide Advanced Options' : 'Show Advanced Options'}</button>
      {showAdvanced && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <label style={{ display: "block" }}>
          <div style={labelStyle}>Sample Size (n)</div>
          <StyledInput  type="number" min={1} step={1} value={n} onChange={(e) => setN(e.target.value)} />
        </label>
        <label style={{ display: "block" }}>
          <div style={labelStyle}>Doses Per Subject</div>
          <StyledInput  type="number" min={1} step={1} value={doses} onChange={(e) => setDoses(e.target.value)} />
        </label>
        <label style={{ display: "block" }}>
          <div style={labelStyle}>Mg Per Dose</div>
          <StyledInput  type="number" step="0.01" value={mgPerDose} onChange={(e) => setMgPerDose(e.target.value)} />
        </label>
        <label style={{ display: "block" }}>
          <div style={labelStyle}>Mg Per Vial</div>
          <StyledInput  type="number" step="0.01" value={mgPerVial} onChange={(e) => setMgPerVial(e.target.value)} />
        </label>
      </div>}
      <div style={resultStyle}>
        {!out ? 'Enter Valid Inputs.' : (
          <>
            Vials Needed: <strong>{out.vialsNeeded.toLocaleString()}</strong>{'  '}|{'  '}
            Per-Subject Mass: <strong>{Number(out.perSubjectMg).toPrecision(4)} mg</strong>{'  '}|{'  '}
            Total Mass: <strong>{Number(out.totalMg).toPrecision(6)} mg</strong>
          </>
        )}
      </div>
      <p style={noteStyle}>{RESEARCH_NOTE}</p>
    </div>
    </section>
  );
}

export default function CalculatorSuite({ activeId }: { activeId?: string | null }) {
  if (!activeId) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {activeId === 'reconstitution' && <Reconstitution />}
      {activeId === 'dilution' && <DilutionSection />}
      {activeId === 'concentration' && <ConcentrationSection />}
      {activeId === 'stability' && <StabilitySection />}
      {activeId === 'cost' && <CostSection />}
      {activeId === 'pooling' && <PoolingSection />}
      {activeId === 'hplc-rt' && <HplcRtSection />}
      {activeId === 'mass-spec' && <MassSpecSection />}
      {activeId === 'spps-cost' && <SppsSection />}
      {activeId === 'solubility' && <SolubilitySection />}
      {activeId === 'vial-quantity' && <VialQuantitySection />}
    </div>
  );
}
