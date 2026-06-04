'use client';

import { useState, useMemo, useEffect } from 'react';
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
  syringeTicks,
  type ConcentrationUnit,
} from '@/lib/research/calculators';
import IframeLink from '@/components/ui/IframeLink';
import { toast } from 'sonner';

const RESEARCH_NOTE = 'Research Use Only. Not Intended As Medical Advice Or Human Dosing.';

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

const GRAVY_VALUES: Record<string, number> = {
  A: 1.80, R: -4.50, N: -3.50, D: -3.50, C: 2.50, E: -3.50, Q: -3.50,
  G: -0.40, H: -3.20, I: 4.50, L: 3.80, K: -3.90, M: 1.90, F: 2.80,
  P: -1.60, S: -0.80, T: -0.70, W: -0.90, Y: -1.30, V: 4.20
};

interface CompoundListItem {
  slug: string;
  display_name: string;
  molecular_weight_da: number | null;
  sequence: string | null;
}

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

function SaveToJournalButton({
  title,
  noteText,
  compoundSlug = null
}: {
  title: string;
  noteText: string;
  compoundSlug?: string | null;
}) {
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/researcher/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          note_text: noteText,
          compound_slug: compoundSlug,
        }),
      });

      if (res.status === 401) {
        toast.error('Please Sign In To Save To Lab Journal');
      } else if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed To Save Note');
      } else {
        toast.success('Calculated Recipe Saved Successfully To Lab Journal');
      }
    } catch (err) {
      console.error(err);
      toast.error('An Error Occurred While Saving');
    } finally {
      setSaving(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleSave}
      disabled={saving}
      style={{
        background: 'var(--teal)',
        border: 'none',
        color: '#000',
        padding: '8px 16px',
        borderRadius: 6,
        fontSize: 13,
        fontWeight: 600,
        cursor: saving ? 'not-allowed' : 'pointer',
        opacity: saving ? 0.7 : 1,
        transition: 'all 0.2s',
        marginTop: 12,
        alignSelf: 'flex-start'
      }}
    >
      {saving ? 'Saving...' : 'Save To Journal'}
    </button>
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

const STANDARD_AA = new Set('ACDEFGHIKLMNPQRSTVWY');

function VisualSyringe({ ml, size }: { ml: number; size: 0.3 | 0.5 | 1.0 }) {
  const maxMl = size;
  const pct = Math.min(100, Math.max(0, (ml / maxMl) * 100));
  const units = Math.round(ml * 100);
  const maxUnits = Math.round(size * 100);
  
  const tickCount = size === 1.0 ? 10 : size === 0.5 ? 5 : 3;
  const subdivisions = size === 1.0 ? 100 : size === 0.5 ? 50 : 30;
  
  return (
    <div style={{ background: '#121620', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 12, color: '#A8B4C0', fontFamily: 'monospace' }}>
        <span>Syringe Capacity: {size} mL ({maxUnits} Units Max)</span>
        <span style={{ color: '#00E5FF', fontWeight: 'bold' }}>{units} Units ({ml.toFixed(3)} mL)</span>
      </div>
      
      {ml > size ? (
        <div style={{ color: '#FF6B6B', fontSize: 13, textAlign: 'center', padding: '8px 0', border: '1px dashed rgba(255,107,107,0.3)', borderRadius: 6, background: 'rgba(255,107,107,0.05)' }}>
          Warning: Dose volume ({ml.toFixed(3)} mL) exceeds syringe capacity ({size} mL). Select a larger syringe or increase reconstitution diluent volume.
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', height: 60, paddingLeft: 40, position: 'relative' }}>
          {/* Plunger shaft */}
          <div style={{ position: 'absolute', left: 0, width: 40, height: 8, background: '#4A5568', borderRadius: '4px 0 0 4px' }} />
          {/* Plunger thumb press */}
          <div style={{ position: 'absolute', left: 0, width: 4, height: 24, background: '#4A5568', borderRadius: 2 }} />
          
          {/* Syringe body barrel */}
          <div style={{ flex: 1, height: 32, background: 'rgba(255,255,255,0.03)', border: '2px solid #718096', borderRadius: '0 4px 4px 0', position: 'relative', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
            {/* Liquid / Plunger fill */}
            <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, rgba(0, 229, 255, 0.3) 0%, rgba(0, 229, 255, 0.15) 100%)', borderRight: '4px solid #00E5FF', transition: 'width 0.4s ease-out' }} />
            
            {/* Major Ticks */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'space-between', pointerEvents: 'none', padding: '0 2px' }}>
              {Array.from({ length: tickCount + 1 }).map((_, i) => {
                const val = Math.round(i * (maxUnits / tickCount));
                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'space-between' }}>
                    <div style={{ width: 2, height: 8, background: 'rgba(255,255,255,0.4)' }} />
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', transform: 'translateY(-2px)' }}>{val}</span>
                  </div>
                );
              })}
            </div>
            {/* Minor Ticks */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'space-between', pointerEvents: 'none', padding: '0 2px' }}>
              {Array.from({ length: subdivisions + 1 }).map((_, i) => {
                if (i % (maxUnits / tickCount) === 0) return <div key={i} />;
                return (
                  <div key={i} style={{ width: 1, height: 4, background: 'rgba(255,255,255,0.15)' }} />
                );
              })}
            </div>
          </div>
          {/* Needle attachment */}
          <div style={{ width: 12, height: 8, background: '#718096', borderRadius: '0 2px 2px 0' }} />
          {/* Needle line */}
          <div style={{ width: 30, height: 1, background: '#E2E8F0' }} />
        </div>
      )}
    </div>
  );
}

function Reconstitution({ compounds }: { compounds: CompoundListItem[] }) {
  const [peptide, setPeptide] = useState(POPULAR_PEPTIDES[0].name);
  const [vialMass, setVialMass] = useState('');
  const [diluentMl, setDiluentMl] = useState('');
  const [desiredMass, setDesiredMass] = useState('');
  const [unit, setUnit] = useState('mcg');
  const [syringeSize, setSyringeSize] = useState<0.3 | 0.5 | 1.0>(1.0);
  const [diluentType, setDiluentType] = useState<'bac-water' | 'acetic-acid'>('bac-water');

  const peptideList = useMemo(() => {
    const dbPeptides = compounds.map(c => ({
      name: c.display_name,
      vialMass: '',
      defaultDose: '',
      unit: 'mcg'
    }));
    return [...POPULAR_PEPTIDES, ...dbPeptides];
  }, [compounds]);

  const handlePeptideChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setPeptide(val);
    const found = peptideList.find(p => p.name === val);
    if (found && found.name !== 'Custom (Enter Manually)') {
      setVialMass(found.vialMass || '5');
      setDesiredMass(found.defaultDose || '250');
      setUnit(found.unit || 'mcg');
      setDiluentMl('2');
    } else {
      setVialMass('');
      setDesiredMass('');
      setDiluentMl('');
    }
  };

  const vMass = Number(vialMass);
  const dilMl = Number(diluentMl);
  const dMassNumeric = Number(desiredMass);
  const dMassMg = unit === 'mcg' ? dMassNumeric / 1000 : dMassNumeric;

  const drawMl = drawVolumeMl(vMass, dilMl, dMassMg);
  const ticks = drawMl !== null && isFinite(drawMl) ? syringeTicks(drawMl) : null;

  const isIgf = peptide.toLowerCase().includes('igf');

  useEffect(() => {
    if (isIgf) {
      setDiluentType('acetic-acid');
    } else {
      setDiluentType('bac-water');
    }
  }, [isIgf]);

  return (
    <section id="reconstitution" style={chromeOuterStyle}>
      <div style={chromeInnerStyle}>
        <CalculatorHeader
          title="Reconstitution & Syringe Calculator"
          why="Lyophilized peptide preparation guidelines. Select standard compounds, configure diluent matrices, and visually confirm draw volumes using standard insulin syringe models."
        />
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, marginBottom: 16 }}>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Step 1: Select Peptide</div>
            <StyledSelect value={peptide} onChange={handlePeptideChange}>
              {peptideList.map((p, idx) => <option key={`${p.name}-${idx}`} value={p.name}>{p.name}</option>)}
            </StyledSelect>
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 16 }}>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Step 2: Vial Mass (mg)</div>
            <StyledInput type="number" step="any" min={0} value={vialMass} placeholder="e.g. 5" onChange={(e) => setVialMass(e.target.value)} />
          </label>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Step 3: Diluent Added (mL)</div>
            <StyledInput type="number" step="any" min={0} value={diluentMl} placeholder="e.g. 2" onChange={(e) => setDiluentMl(e.target.value)} />
          </label>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Diluent Type</div>
            <StyledSelect value={diluentType} onChange={(e) => setDiluentType(e.target.value as 'bac-water' | 'acetic-acid')}>
              <option value="bac-water">Bacteriostatic Water</option>
              <option value="acetic-acid">Acetic Acid (0.6%)</option>
            </StyledSelect>
          </label>
        </div>

        {isIgf && (
          <div style={{ color: '#F6AD55', fontSize: 13, padding: '8px 12px', border: '1px solid rgba(246,173,85,0.3)', borderRadius: 6, background: 'rgba(246,173,85,0.05)', marginBottom: 12 }}>
            Stability Warning: IGF-1 family peptides precipitate quickly in neutral pH (bac-water). Reconstituting in 0.6% Acetic Acid maintains solubility and shelf-stability.
          </div>
        )}

        <div style={{ ...resultStyle, marginTop: 12 }}>
          {vMass > 0 && dilMl > 0 ? (
            <div style={{ color: '#00E5FF', fontWeight: 800, fontSize: 18 }}>
              Add {dilMl} mL of {diluentType === 'bac-water' ? 'Bacteriostatic Water' : '0.6% Acetic Acid'} to the vial.
            </div>
          ) : (
            <div style={{ fontSize: 14 }}>Enter vial mass and diluent volume above.</div>
          )}
        </div>

        <h3 style={{ margin: '24px 0 8px', color: '#FFFFFF', fontSize: 16 }}>Draw Volume & Syringe Visualizer</h3>
        <p style={{ color: '#A8B4C0', fontSize: 14, marginBottom: 16 }}>
          Input desired target dose to map pulling volume to tick marks.
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
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Insulin Syringe Capacity</div>
            <StyledSelect value={syringeSize} onChange={(e) => setSyringeSize(Number(e.target.value) as 0.3 | 0.5 | 1.0)}>
              <option value="1.0">1.0 mL (100 units)</option>
              <option value="0.5">0.5 mL (50 units)</option>
              <option value="0.3">0.3 mL (30 units)</option>
            </StyledSelect>
          </label>
        </div>

        {drawMl !== null && isFinite(drawMl) && drawMl > 0 ? (
          <>
            <div style={{ ...resultStyle, marginTop: 20 }}>
              To draw a dose of <strong>{dMassNumeric} {unit}</strong>, pull liquid to:
              <span style={{ fontSize: 28, color: '#68D391', fontWeight: 800, display: 'block', margin: '8px 0' }}>
                {Math.round(drawMl * 100)} units
              </span>
              <span style={{ fontSize: 13, color: '#A8B4C0' }}>({drawMl.toFixed(3)} mL of working solution)</span>
            </div>
            <VisualSyringe ml={drawMl} size={syringeSize} />
          </>
        ) : (
          <div style={{ ...resultStyle, marginTop: 20, fontSize: 14 }}>Enter a desired dose above.</div>
        )}

        {vMass > 0 && dilMl > 0 && (
          <SaveToJournalButton
            title={`Reconstitution Recipe - ${peptide}`}
            noteText={`Peptide Name: ${peptide}
Vial Mass: ${vMass} mg
Diluent Volume: ${dilMl} mL (${diluentType === 'bac-water' ? 'Bacteriostatic Water' : '0.6% Acetic Acid'})
Target Dose: ${dMassNumeric} ${unit}
Recommended Syringe Draw: ${drawMl !== null && isFinite(drawMl) ? Math.round(drawMl * 100) : 0} Units (on a ${syringeSize} mL syringe)`}
            compoundSlug={compounds.find(c => c.display_name === peptide)?.slug || null}
          />
        )}

        <p style={noteStyle}>{RESEARCH_NOTE}</p>
      </div>
    </section>
  );
}

function TubesRack({ steps, currentStep, onSelectStep }: { steps: any[]; currentStep: number; onSelectStep: (idx: number) => void }) {
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
              width: 32,
              height: 70,
              border: isActive ? '2px solid #00E5FF' : '2px solid rgba(255,255,255,0.2)',
              borderRadius: '0 0 16px 16px',
              position: 'relative',
              background: 'rgba(255,255,255,0.02)',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'flex-end',
              boxShadow: isActive ? '0 0 15px rgba(0,229,255,0.4)' : 'none',
            }}>
              <div style={{
                width: '100%',
                height: '60%',
                background: `rgba(0, 229, 255, ${opacity * 0.8})`,
                borderTop: '1px solid rgba(0,229,255,0.8)',
                transition: 'height 0.3s ease',
              }} />
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

function DilutionSection() {
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

  const fv = Number(finalVol);
  const df = Number(factor);
  const stockNeeded = (fv > 0 && df > 1) ? fv / df : null;
  const diluentNeeded = stockNeeded !== null ? fv - stockNeeded : null;

  return (
    <section id="dilution" style={chromeOuterStyle}>
      <div style={chromeInnerStyle}>
        <CalculatorHeader
          title="Serial Dilution & Assay Curve Generator"
          why="Design multi-step dilution curves for pharmacological profiles. Standard curve assay mode calculates pipetting guides for microcentrifuge tube racks."
        />

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={assayMode} onChange={(e) => setAssayMode(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#00E5FF' }} />
            <span style={{ fontSize: 14, color: '#FFFFFF', fontWeight: 600 }}>Enable Assay Standard Curve Mode (Pipetting Volume Recipes)</span>
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Stock Concentration (Units)</div>
            <StyledInput type="number" step="any" min={0} value={stock} onChange={(e) => setStock(e.target.value)} />
          </label>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Dilution Factor</div>
            <StyledInput type="number" step="any" min={2} value={factor} onChange={(e) => setFactor(e.target.value)} />
          </label>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Steps</div>
            <StyledInput type="number" min={1} max={20} step={1} value={steps} onChange={(e) => { setSteps(e.target.value); setSelectedTube(1); }} />
          </label>
          {assayMode && (
            <label style={{ display: "block" }}>
              <div style={labelStyle}>Target Vol per Tube (mL)</div>
              <StyledInput type="number" step="any" min={0} value={finalVol} placeholder="e.g. 100" onChange={(e) => setFinalVol(e.target.value)} />
            </label>
          )}
        </div>

        {assayMode && series.length > 0 && (
          <>
            <TubesRack steps={series} currentStep={selectedTube} onSelectStep={setSelectedTube} />
            
            {selectedTubeData && (
              <div style={{ ...resultStyle, marginBottom: 16, fontSize: 14, border: '1px solid #00E5FF', background: 'rgba(0,229,255,0.02)' }}>
                <div style={{ color: '#00E5FF', fontWeight: 'bold', marginBottom: 6 }}>Recipe for Tube {selectedTube} (T{selectedTube}):</div>
                {selectedTube === 1 ? (
                  <div>
                    Transfer <strong style={{ color: '#68D391' }}>{selectedTubeData.transferVolumeMl?.toFixed(3)} mL</strong> of Stock into the tube, and mix with <strong style={{ color: '#68D391' }}>{selectedTubeData.diluentVolumeMl?.toFixed(3)} mL</strong> of diluent.
                  </div>
                ) : (
                  <div>
                    Transfer <strong style={{ color: '#68D391' }}>{selectedTubeData.transferVolumeMl?.toFixed(3)} mL</strong> of Tube {selectedTube - 1} (T{selectedTube - 1}) into the tube, and mix with <strong style={{ color: '#68D391' }}>{selectedTubeData.diluentVolumeMl?.toFixed(3)} mL</strong> of diluent.
                  </div>
                )}
                <div style={{ marginTop: 6, fontSize: 12, color: '#A8B4C0' }}>
                  Target Concentration: <strong>{selectedTubeData.concentration.toExponential(3)}</strong> units. Total Volume: {(selectedTubeData.transferVolumeMl! + selectedTubeData.diluentVolumeMl!).toFixed(3)} mL
                </div>
              </div>
            )}
          </>
        )}

        <div style={{ ...resultStyle, padding: 0, background: 'transparent', border: 'none' }}>
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
                  <td style={{ padding: 8, color: '#A8B2C1', fontWeight: 600 }}>
                    {Math.abs(s.concentration) >= 0.001 && Math.abs(s.concentration) < 1e5
                      ? s.concentration.toPrecision(4)
                      : s.concentration.toExponential(3)}
                  </td>
                  {assayMode && <td style={{ padding: 8, color: '#68D391' }}>{s.transferVolumeMl?.toFixed(3)}</td>}
                  {assayMode && <td style={{ padding: 8, color: '#68D391' }}>{s.diluentVolumeMl?.toFixed(3)}</td>}
                </tr>
              ))}
              {series.length === 0 && (
                <tr><td colSpan={assayMode ? 4 : 2} style={{ padding: 8, color: '#A8B4C0' }}>Enter stock concentration and a dilution factor &gt; 1.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {Number(stock) > 0 && Number(factor) > 1 && (
          <SaveToJournalButton
            title="Dilution Series Protocol"
            noteText={`Stock Concentration: ${stock}
Dilution Factor: ${factor}
Steps: ${steps}
Assay Mode: ${assayMode ? 'Yes' : 'No'}
Final Volume Per Tube: ${finalVol || 'N/A'} mL
Tube Breakdown:
${series.map(s => `- Step ${s.stepNumber} (T${s.stepNumber}): Conc ${s.concentration.toExponential(3)}${assayMode ? `, Transfer: ${s.transferVolumeMl?.toFixed(3)} mL, Diluent: ${s.diluentVolumeMl?.toFixed(3)} mL` : ''}`).join('\n')}`}
          />
        )}

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

function ConcentrationSection({ compounds }: { compounds: CompoundListItem[] }) {
  const [value, setValue] = useState('');
  const [from, setFrom] = useState<ConcentrationUnit>('mg/mL');
  const [to, setTo] = useState<ConcentrationUnit>('mcg/mL');
  const [mw, setMw] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const mwRequired = needsMW(from, to);

  const filteredCompounds = useMemo(() => {
    if (!searchQuery) return compounds.slice(0, 10);
    return compounds.filter(c => 
      c.display_name.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 10);
  }, [compounds, searchQuery]);

  const handleSelectCompound = (c: CompoundListItem) => {
    if (c.molecular_weight_da) {
      setMw(c.molecular_weight_da.toString());
    }
    setSearchQuery(c.display_name);
    setShowDropdown(false);
  };

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
          why="Convert mass concentrations (mg/mL, mcg/mL, ng/mL) to molar metrics (mmol/L, umol/L, nmol/L). Automatic library integration retrieves exact molecular weights."
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 12 }}>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Value</div>
            <StyledInput type="number" step="any" value={value} onChange={(e) => setValue(e.target.value)} />
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
        </div>

        {mwRequired && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 12, position: 'relative' }}>
            <div style={{ position: 'relative' }}>
              <div style={labelStyle}>Search Database Peptide</div>
              <StyledInput 
                type="text" 
                value={searchQuery} 
                placeholder="Type compound name..." 
                onFocus={() => setShowDropdown(true)}
                onChange={(e) => { setSearchQuery(e.target.value); setShowDropdown(true); }}
              />
              {showDropdown && filteredCompounds.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#121620', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, zIndex: 10, maxHeight: 200, overflowY: 'auto', marginTop: 4 }}>
                  {filteredCompounds.map((c) => (
                    <div 
                      key={c.slug} 
                      onClick={() => handleSelectCompound(c)}
                      style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13, color: '#E2E8F0' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      {c.display_name} {c.molecular_weight_da ? `(${c.molecular_weight_da} Da)` : ''}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <label style={{ display: "block" }}>
              <div style={labelStyle}>Molecular Weight (Da)</div>
              <StyledInput type="number" step="any" value={mw} onChange={(e) => setMw(e.target.value)} placeholder="Enter Da manually..." />
            </label>
          </div>
        )}

        <div style={resultStyle}>
          {result === null
            ? 'Enter A Molecular Weight (Da) To Convert Between Mass And Molar Units.'
            : from === to
            ? <>Same Unit Selected — No Conversion Needed: <strong>{Number(value).toPrecision(6)}</strong> {to}</>
            : <>Converted: <strong>{result.toPrecision(6)}</strong> {to}</>
          }
        </div>

        {result !== null && (
          <SaveToJournalButton
            title={`Concentration Conversion${searchQuery ? ` - ${searchQuery}` : ''}`}
            noteText={`Input Value: ${value} ${from}
Converted Value: ${result.toPrecision(6)} ${to}
Molecular Weight: ${mw} Da
Peptide: ${searchQuery || 'Custom'}`}
            compoundSlug={compounds.find(c => c.display_name === searchQuery)?.slug || null}
          />
        )}

        <p style={noteStyle}>{RESEARCH_NOTE}</p>
      </div>
    </section>
  );
}

const DEGRADATION_PROFILES = [
  { name: 'Standard Peptide (83 kJ/mol)', ea: 83 },
  { name: 'Fragile Peptide e.g. IGF-1, hGH (100 kJ/mol)', ea: 100 },
  { name: 'Highly Stable e.g. BPC-157 Arg (65 kJ/mol)', ea: 65 }
];

function StabilitySection() {
  const [shelf, setShelf] = useState('');
  const [tFrom, setTFrom] = useState('');
  const [tTo, setTTo] = useState('');
  const [ea, setEa] = useState('');
  const [profile, setProfile] = useState('83');

  const days = arrheniusStability({
    shelfDaysAtTempC: Number(shelf),
    fromTempC: Number(tFrom),
    toTempC: Number(tTo),
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
          why="Model temperature-dependent shelf life. Activation Energy (Ea) governs degradation rates; select preset peptide categories or customize Ea."
        />
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <button 
            onClick={() => { setTFrom('-20'); setTTo('4'); }} 
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #00E5FF', background: 'transparent', color: '#00E5FF', cursor: 'pointer', fontSize: 13 }}
          >
            Preset: Freezer to Fridge
          </button>
          <button 
            onClick={() => { setTFrom('4'); setTTo('25'); }} 
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #F6AD55', background: 'transparent', color: '#F6AD55', cursor: 'pointer', fontSize: 13 }}
          >
            Preset: Fridge to Room Temp
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Known Shelf Days</div>
            <StyledInput type="number" step="any" value={shelf} onChange={(e) => setShelf(e.target.value)} />
          </label>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Known Temperature (C)</div>
            <StyledInput type="number" step="any" value={tFrom} onChange={(e) => setTFrom(e.target.value)} />
          </label>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Target Temperature (C)</div>
            <StyledInput type="number" step="any" value={tTo} onChange={(e) => setTTo(e.target.value)} />
          </label>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Degradation Profile</div>
            <StyledSelect value={profile} onChange={handleProfileChange}>
              {DEGRADATION_PROFILES.map((p) => <option key={p.ea} value={p.ea}>{p.name}</option>)}
              <option value="custom">Custom Ea</option>
            </StyledSelect>
          </label>
          {profile === 'custom' && (
            <label style={{ display: "block" }}>
              <div style={labelStyle}>Activation Energy (Ea, kJ/mol)</div>
              <StyledInput type="number" step="any" value={ea} onChange={(e) => setEa(e.target.value)} />
            </label>
          )}
        </div>
        <div style={resultStyle}>
          {days === null
            ? 'Enter Valid Inputs (Temperatures Must Be Above −273°C).'
            : ea.trim() !== '' && Number(ea) === 0
            ? 'Activation Energy Cannot Be Zero — Temperature Has No Effect At Ea=0.'
            : <>Predicted Shelf: <strong>{days.toFixed(1)} Days</strong> At {tTo}°C</>
          }
        </div>

        {days !== null && (
          <SaveToJournalButton
            title="Arrhenius Stability Prediction"
            noteText={`Initial Shelf Life: ${shelf} Days At ${tFrom} C
Target Temperature: ${tTo} C
Activation Energy (Ea): ${ea} kJ/mol
Predicted Shelf Life At ${tTo} C: ${days.toFixed(1)} Days`}
          />
        )}

        <p style={noteStyle}>{RESEARCH_NOTE}</p>
      </div>
    </section>
  );
}

function CostSection() {
  const [comparisonMode, setComparisonMode] = useState(false);
  const [priceA, setPriceA] = useState('');
  const [massA, setMassA] = useState('');
  const [doseA, setDoseA] = useState('');
  const [frequency, setFrequency] = useState('1');

  // Option B states
  const [priceB, setPriceB] = useState('');
  const [massB, setMassB] = useState('');
  const [doseB, setDoseB] = useState('');

  const outA = costPerDose({
    vialPriceUsd: Number(priceA),
    vialMassMg: Number(massA),
    dosageMcg: Number(doseA),
    dosesPerWeek: Number(frequency),
  });

  const outB = costPerDose({
    vialPriceUsd: Number(priceB),
    vialMassMg: Number(massB),
    dosageMcg: Number(doseB),
    dosesPerWeek: Number(frequency),
  });

  const dosesPerWeek = Number(frequency);
  const daysPerVialA = (outA && dosesPerWeek > 0) ? (outA.dosesPerVial / dosesPerWeek) * 7 : null;
  const daysPerVialB = (outB && dosesPerWeek > 0) ? (outB.dosesPerVial / dosesPerWeek) * 7 : null;

  return (
    <section id="cost" style={chromeOuterStyle}>
      <div style={chromeInnerStyle}>
        <CalculatorHeader
          title="Study Budget & Economics Calculator"
          why="Determine unit dose economics and analyze monthly/annual cohort expenditures. Compare vendor pricing tiers side-by-side."
        />

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={comparisonMode} onChange={(e) => setComparisonMode(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#00E5FF' }} />
            <span style={{ fontSize: 14, color: '#FFFFFF', fontWeight: 600 }}>Enable Side-By-Side Comparison Mode</span>
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: comparisonMode ? '1fr 1fr' : '1fr', gap: 24 }}>
          {/* Column A / Single */}
          <div>
            {comparisonMode && <h4 style={{ color: '#00E5FF', fontSize: 14, fontWeight: 'bold', marginBottom: 12 }}>OPTION A</h4>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ display: "block" }}>
                <div style={labelStyle}>Vial Price (USD)</div>
                <StyledInput type="number" step="any" value={priceA} onChange={(e) => setPriceA(e.target.value)} />
              </label>
              <label style={{ display: "block" }}>
                <div style={labelStyle}>Vial Mass (mg)</div>
                <StyledInput type="number" step="any" value={massA} onChange={(e) => setMassA(e.target.value)} />
              </label>
              <label style={{ display: "block" }}>
                <div style={labelStyle}>Per-Dose Amount (mcg)</div>
                <StyledInput type="number" step="any" value={doseA} onChange={(e) => setDoseA(e.target.value)} />
              </label>
            </div>
          </div>

          {/* Column B */}
          {comparisonMode && (
            <div>
              <h4 style={{ color: '#F6AD55', fontSize: 14, fontWeight: 'bold', marginBottom: 12 }}>OPTION B</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={{ display: "block" }}>
                  <div style={labelStyle}>Vial Price (USD)</div>
                  <StyledInput type="number" step="any" value={priceB} onChange={(e) => setPriceB(e.target.value)} />
                </label>
                <label style={{ display: "block" }}>
                  <div style={labelStyle}>Vial Mass (mg)</div>
                  <StyledInput type="number" step="any" value={massB} onChange={(e) => setMassB(e.target.value)} />
                </label>
                <label style={{ display: "block" }}>
                  <div style={labelStyle}>Per-Dose Amount (mcg)</div>
                  <StyledInput type="number" step="any" value={doseB} onChange={(e) => setDoseB(e.target.value)} />
                </label>
              </div>
            </div>
          )}
        </div>

        <div style={{ marginTop: 16 }}>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Dosing Frequency (doses per week)</div>
            <StyledSelect value={frequency} onChange={(e) => setFrequency(e.target.value)}>
              <option value="7">Daily (7x / week)</option>
              <option value="2">Twice Weekly (2x / week)</option>
              <option value="1">Weekly (1x / week)</option>
              <option value="0.5">Bi-Weekly (0.5x / week)</option>
            </StyledSelect>
          </label>
        </div>

        {!comparisonMode ? (
          <div style={resultStyle}>
            {!outA
              ? 'Enter Valid Inputs.'
              : <>
                  <div>Doses Per Vial: <strong>{outA.dosesPerVial.toFixed(1)}</strong>{'  '}|{'  '}Cost Per Dose: <strong>${outA.dollarsPerDose.toFixed(2)}</strong></div>
                  {daysPerVialA !== null && daysPerVialA > 0 && (
                    <div style={{ marginTop: 8, color: '#00E5FF' }}>Vial Lasts Approximately: <strong>{daysPerVialA.toFixed(1)} Days</strong></div>
                  )}
                  {outA.monthlyCostUsd && (
                    <div style={{ marginTop: 8, fontSize: 13, color: '#A8B4C0' }}>
                      Est. Monthly Cost: <strong>${outA.monthlyCostUsd.toFixed(2)}</strong> | Annual Cost: <strong>${outA.annualCostUsd?.toFixed(2)}</strong>
                    </div>
                  )}
                </>
            }
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Option A Result */}
              <div style={{ ...resultStyle, margin: 0, borderColor: 'rgba(0,229,255,0.4)', background: 'rgba(0,229,255,0.01)' }}>
                <div style={{ color: '#00E5FF', fontWeight: 'bold', fontSize: 13, marginBottom: 8 }}>OPTION A RESULTS</div>
                {outA ? (
                  <div style={{ fontSize: 13, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div>Cost/Dose: <strong>${outA.dollarsPerDose.toFixed(2)}</strong></div>
                    <div>Doses/Vial: <strong>{outA.dosesPerVial.toFixed(1)}</strong></div>
                    <div>Monthly: <strong>${outA.monthlyCostUsd?.toFixed(2)}</strong></div>
                    <div>Annual: <strong>${outA.annualCostUsd?.toFixed(2)}</strong></div>
                  </div>
                ) : 'Invalid Inputs'}
              </div>
              
              {/* Option B Result */}
              <div style={{ ...resultStyle, margin: 0, borderColor: 'rgba(246,173,85,0.4)', background: 'rgba(246,173,85,0.01)' }}>
                <div style={{ color: '#F6AD55', fontWeight: 'bold', fontSize: 13, marginBottom: 8 }}>OPTION B RESULTS</div>
                {outB ? (
                  <div style={{ fontSize: 13, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div>Cost/Dose: <strong>${outB.dollarsPerDose.toFixed(2)}</strong></div>
                    <div>Doses/Vial: <strong>{outB.dosesPerVial.toFixed(1)}</strong></div>
                    <div>Monthly: <strong>${outB.monthlyCostUsd?.toFixed(2)}</strong></div>
                    <div>Annual: <strong>${outB.annualCostUsd?.toFixed(2)}</strong></div>
                  </div>
                ) : 'Invalid Inputs'}
              </div>
            </div>

            {outA && outB && outA.dollarsPerDose > 0 && outB.dollarsPerDose > 0 && (
              <div style={{ ...resultStyle, background: 'rgba(104,211,145,0.05)', border: '1px solid #68D391', color: '#E2E8F0', fontSize: 14 }}>
                {outA.dollarsPerDose < outB.dollarsPerDose ? (
                  <span>
                    Success: <strong>Option A</strong> is more cost-effective. It saves you <strong style={{ color: '#68D391' }}>${(outB.dollarsPerDose - outA.dollarsPerDose).toFixed(2)}</strong> per dose (<strong style={{ color: '#68D391' }}>{((1 - outA.dollarsPerDose / outB.dollarsPerDose) * 100).toFixed(1)}%</strong> savings).
                  </span>
                ) : outB.dollarsPerDose < outA.dollarsPerDose ? (
                  <span>
                    Success: <strong>Option B</strong> is more cost-effective. It saves you <strong style={{ color: '#68D391' }}>${(outA.dollarsPerDose - outB.dollarsPerDose).toFixed(2)}</strong> per dose (<strong style={{ color: '#68D391' }}>{((1 - outB.dollarsPerDose / outA.dollarsPerDose) * 100).toFixed(1)}%</strong> savings).
                  </span>
                ) : (
                  <span>Both options yield identical cost-per-dose metrics.</span>
                )}
              </div>
            )}
          </div>
        )}

        {outA && (
          <SaveToJournalButton
            title={comparisonMode ? "Vendor Cost Comparison" : "Cost Per Dose Economics"}
            noteText={!comparisonMode
              ? `Option A Price: $${priceA}
Vial Mass: ${massA} mg
Dose Amount: ${doseA} mcg
Dosing Frequency: ${frequency} doses/week
Cost Per Dose: $${outA.dollarsPerDose.toFixed(2)}
Monthly Projected Cost: $${outA.monthlyCostUsd?.toFixed(2) ?? 'N/A'}
Annual Projected Cost: $${outA.annualCostUsd?.toFixed(2) ?? 'N/A'}`
              : `Option A: Price $${priceA}, Mass ${massA} mg, Dose ${doseA} mcg
Option B: Price $${priceB}, Mass ${massB} mg, Dose ${doseB} mcg
Option A Cost Per Dose: $${outA.dollarsPerDose.toFixed(2)}
Option B Cost Per Dose: $${outB?.dollarsPerDose.toFixed(2) ?? 'N/A'}
Projected Winner: ${outB ? (outA.dollarsPerDose < outB.dollarsPerDose ? 'Option A' : 'Option B') : 'Option A'}`}
          />
        )}

        <p style={noteStyle}>{RESEARCH_NOTE}</p>
      </div>
    </section>
  );
}

function PoolingSection() {
  const [mass, setMass] = useState('');
  const [count, setCount] = useState('');
  const [diluent, setDiluent] = useState('');
  const [loss, setLoss] = useState('');

  const out = vialPooling({
    vialMassMg: Number(mass),
    vialCount: Math.max(1, Math.floor(Number(count) || 1)),
    totalDiluentMl: Number(diluent),
    transferLossPct: Number(loss) || 0,
  });

  return (
    <section id="pooling" style={chromeOuterStyle}>
      <div style={chromeInnerStyle}>
        <CalculatorHeader
          title="Vial Pooling & Solubility Estimator"
          why="Aggregate multiple vial masses into a single working concentration. Integrates physical solubility safeguards to warn against precipitation."
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 12 }}>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Per-Vial Mass (mg)</div>
            <StyledInput type="number" step="any" value={mass} onChange={(e) => setMass(e.target.value)} />
          </label>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Vial Count</div>
            <StyledInput type="number" min={1} step={1} value={count} onChange={(e) => setCount(e.target.value)} />
          </label>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Total Diluent (mL)</div>
            <StyledInput type="number" step="any" value={diluent} onChange={(e) => setDiluent(e.target.value)} />
          </label>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Transfer Loss Buffer (%)</div>
            <StyledInput type="number" step="any" min="0" max="100" value={loss} placeholder="e.g. 5" onChange={(e) => setLoss(e.target.value)} />
          </label>
        </div>

        {out && out.concentrationMgPerMl > 50 && (
          <div style={{ color: '#F6AD55', fontSize: 13, padding: '8px 12px', border: '1px solid rgba(246,173,85,0.3)', borderRadius: 6, background: 'rgba(246,173,85,0.05)', marginBottom: 12 }}>
            Aqueous Precipitation Risk: Calculated concentration is <strong>{out.concentrationMgPerMl.toFixed(1)} mg/mL</strong>. Concentrations exceeding 50 mg/mL are highly prone to peptide aggregation or gelation in standard aqueous buffers.
          </div>
        )}

        <div style={resultStyle}>
          {!out
            ? 'Enter Valid Inputs.'
            : <>Total Mass: <strong>{out.totalMassMg.toFixed(2)} mg</strong>{'  '}|{'  '}Concentration: <strong>{out.concentrationMgPerMl.toFixed(3)} mg/mL</strong></>
          }
        </div>

        {out && (
          <SaveToJournalButton
            title="Vial Pooling Recipe"
            noteText={`Vials Pooled: ${count}
Mass Per Vial: ${mass} mg
Diluent Added: ${diluent} mL
Transfer Loss: ${loss}%
Total Pooled Mass: ${out.totalMassMg.toFixed(2)} mg
Final Pooled Concentration: ${out.concentrationMgPerMl.toFixed(3)} mg/mL`}
          />
        )}

        <p style={noteStyle}>{RESEARCH_NOTE}</p>
      </div>
    </section>
  );
}

function HplcRtSection() {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [seq, setSeq] = useState('');
  const [start, setStart] = useState('5');
  const [end, setEnd] = useState('65');
  const [gradient, setGradient] = useState('20');
  const [columnType, setColumnType] = useState<'C18' | 'C8' | 'C4' | 'HILIC'>('C18');
  const [modifier, setModifier] = useState<'TFA' | 'FA'>('TFA');

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
    columnType,
    modifier,
  });

  const gradientInvalid = gradient.trim() !== '' && Number(gradient) <= 0;

  return (
    <section id="hplc-rt" style={chromeOuterStyle}>
      <div style={chromeInnerStyle}>
        <CalculatorHeader
          title="HPLC Retention Time Predictor"
          why="Predict peptide elution retention profiles under reverse-phase (C18, C8, C4) or normal-phase (HILIC) columns using Bull-Breese residue hydrophobicity indices."
        />
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <button 
            onClick={() => { setStart('5'); setEnd('65'); setGradient('20'); setShowAdvanced(true); }} 
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #00E5FF', background: 'transparent', color: '#00E5FF', cursor: 'pointer', fontSize: 13 }}
          >
            Preset: Standard 20min (5% - 65% B)
          </button>
          <button 
            onClick={() => { setStart('10'); setEnd('90'); setGradient('30'); setShowAdvanced(true); }} 
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #F6AD55', background: 'transparent', color: '#F6AD55', cursor: 'pointer', fontSize: 13 }}
          >
            Preset: Long 30min (10% - 90% B)
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 12 }}>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>One-Letter Sequence (Standard 20 AA Codes)</div>
            <StyledInput type="text" value={seq} maxLength={500} onChange={(e) => setSeq(e.target.value)} placeholder="e.g. PLG" />
            {unknownChars.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 12, color: '#F6AD55', background: 'rgba(246,173,85,0.10)', border: '1px solid rgba(246,173,85,0.30)', borderRadius: 6, padding: '5px 10px' }}>
                Warning: Non-standard characters detected: <strong>{unknownChars.join(', ')}</strong>. Standard codes: A C D E F G H I K L M N P Q R S T V W Y.
              </div>
            )}
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>HPLC Column Phase</div>
            <StyledSelect value={columnType} onChange={(e) => setColumnType(e.target.value as any)}>
              <option value="C18">C18 Octadecylsilane (Standard RP)</option>
              <option value="C8">C8 Octylsilane (Moderate RP)</option>
              <option value="C4">C4 Butylsilane (Fragile / Large RP)</option>
              <option value="HILIC">HILIC Hydrophilic Interaction (Normal Phase)</option>
            </StyledSelect>
          </label>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Acid Modifier</div>
            <StyledSelect value={modifier} onChange={(e) => setModifier(e.target.value as any)}>
              <option value="TFA">0.1% Trifluoroacetic Acid (Strong Ion-Pairing)</option>
              <option value="FA">0.1% Formic Acid (Weaker Ion-Pairing, MS Friendly)</option>
            </StyledSelect>
          </label>
        </div>

        <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} style={{ background: 'transparent', border: '1px solid rgba(168,178,193,0.3)', color: '#A8B2C1', padding: '6px 12px', borderRadius: 6, fontSize: 12, marginBottom: 12, cursor: 'pointer' }}>{showAdvanced ? 'Hide Gradient Details' : 'Configure Gradient Details'}</button>
        {showAdvanced && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 12 }}>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Gradient Start (%B)</div>
            <StyledInput type="number" step="any" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Gradient End (%B)</div>
            <StyledInput type="number" step="any" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Gradient Length (Min)</div>
            <StyledInput type="number" step="any" value={gradient} onChange={(e) => setGradient(e.target.value)} />
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
                Predicted Retention Time: <strong>{rt.toFixed(2)} Min</strong> ({columnType}, 0.1% {modifier})
              </>
          }
        </div>

        {rt !== null && (
          <SaveToJournalButton
            title="HPLC Retention Time Prediction"
            noteText={`Sequence: ${seq}
Column Type: ${columnType}
Acid Modifier: ${modifier}
Predicted Retention Time: ${rt.toFixed(2)} Min
Gradient Start (%B): ${start}%
Gradient End (%B): ${end}%
Gradient Length: ${gradient} Min`}
          />
        )}

        <p style={noteStyle}>{RESEARCH_NOTE}</p>
      </div>
    </section>
  );
}

function MassSpecSection() {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [seq, setSeq] = useState('');
  const [mode, setMode] = useState<'positive' | 'negative'>('positive');
  const [maxCharge, setMaxCharge] = useState('4');
  const [adduct, setAdduct] = useState('1.00728'); // Default +H

  const cleanSeq = seq.replace(/\s+/g, '').toUpperCase();
  const unknownChars = useMemo(() => {
    const chars = new Set<string>();
    for (const c of cleanSeq) {
      if (!STANDARD_AA.has(c)) chars.add(c);
    }
    return [...chars];
  }, [cleanSeq]);

  const peaks = useMemo(() => {
    return predictMassSpecPeaks({
      sequence: seq,
      mode,
      maxCharge: maxCharge.trim() === '' ? undefined : Number(maxCharge),
      adductMass: Number(adduct),
    });
  }, [seq, mode, maxCharge, adduct]);
  
  const basePeakCharge = peaks.length > 0 ? peaks[0].charge : null;

  const chartPeaks = useMemo(() => {
    return [...peaks].sort((a, b) => a.mz - b.mz);
  }, [peaks]);

  const maxIntensity = useMemo(() => {
    return Math.max(...peaks.map(p => p.intensity), 0.001);
  }, [peaks]);

  return (
    <section id="mass-spec" style={chromeOuterStyle}>
      <div style={chromeInnerStyle}>
        <CalculatorHeader
          title="Mass Spec m/z & Stick Plot Predictor"
          why="Generate theoretical charge state isotope profiles ([M+nH]^n+) for HPLC fraction verification. The interactive spectrum plots simulated mass spectrum readouts."
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 12 }}>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>One-Letter Sequence (Standard 20 AA Codes)</div>
            <StyledInput type="text" value={seq} maxLength={500} onChange={(e) => setSeq(e.target.value)} placeholder="e.g. GLP1 sequence..." />
            {unknownChars.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 12, color: '#F6AD55', background: 'rgba(246,173,85,0.10)', border: '1px solid rgba(246,173,85,0.30)', borderRadius: 6, padding: '5px 10px' }}>
                Warning: Non-standard characters detected: <strong>{unknownChars.join(', ')}</strong>. Residues estimated at ~110 Da average. Standard codes only: A C D E F G H I K L M N P Q R S T V W Y.
              </div>
            )}
          </label>
        </div>

        <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} style={{ background: 'transparent', border: '1px solid rgba(168,178,193,0.3)', color: '#A8B2C1', padding: '6px 12px', borderRadius: 6, fontSize: 12, marginBottom: 12, cursor: 'pointer' }}>{showAdvanced ? 'Hide Advanced Options' : 'Show Advanced Options'}</button>
        {showAdvanced && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginTop: 12, marginBottom: 12 }}>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Ionization Mode</div>
            <StyledSelect value={mode} onChange={(e) => setMode(e.target.value as 'positive' | 'negative')}>
              <option value="positive">Positive</option>
              <option value="negative">Negative</option>
            </StyledSelect>
          </label>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Max Charge State</div>
            <StyledInput type="number" step="any" min={1} value={maxCharge} onChange={(e) => setMaxCharge(e.target.value)} />
          </label>
          {mode === 'positive' && (
            <label style={{ display: "block" }}>
              <div style={labelStyle}>Adduct</div>
              <StyledSelect value={adduct} onChange={(e) => setAdduct(e.target.value)}>
                <option value="1.00728">+H (Proton, 1.007 Da)</option>
                <option value="22.98977">+Na (Sodium, 22.990 Da)</option>
                <option value="38.96371">+K (Potassium, 38.964 Da)</option>
              </StyledSelect>
            </label>
          )}
        </div>}

        {chartPeaks.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 16, background: 'rgba(0,0,0,0.3)', padding: 20, borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: 11, color: '#A8B4C0', textAlign: 'center', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.1em' }}>ESI-MS Stick Plot Spectrum</div>
            <div style={{ height: 160, display: 'flex', alignItems: 'flex-end', gap: 16, borderBottom: '2px solid rgba(255,255,255,0.15)', paddingBottom: 8, paddingLeft: 16, paddingRight: 16, position: 'relative' }}>
              {chartPeaks.map((p, idx) => {
                const heightPct = (p.intensity / maxIntensity) * 100;
                const isBase = p.charge === basePeakCharge;
                return (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', flex: 1, minWidth: 40 }}>
                    <span style={{ fontSize: 10, color: isBase ? '#68D391' : '#00E5FF', marginBottom: 4, fontFamily: 'monospace', fontWeight: isBase ? 'bold' : 'normal' }}>
                      {isBase ? 'BASE' : `z=${p.charge}`}
                    </span>
                    <div 
                      title={`Charge: z=${p.charge}, m/z: ${p.mz}, Rel Intensity: ${(p.intensity * 100).toFixed(0)}%`}
                      style={{
                        width: 8,
                        height: `${heightPct}%`,
                        background: isBase ? '#68D391' : '#00E5FF',
                        boxShadow: isBase ? '0 0 10px rgba(104,211,145,0.5)' : '0 0 8px rgba(0,229,255,0.3)',
                        borderRadius: '4px 4px 0 0',
                        transition: 'height 0.3s ease',
                      }} 
                    />
                    <span style={{ fontSize: 9, color: '#A8B4C0', marginTop: 6, fontFamily: 'monospace' }}>
                      {p.mz}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ ...resultStyle, padding: 0, background: 'transparent', border: 'none' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, marginTop: 8 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <th style={{ textAlign: 'left', padding: 8, color: '#A8B4C0', fontSize: 12 }}>Charge State</th>
                <th style={{ textAlign: 'left', padding: 8, color: '#A8B4C0', fontSize: 12 }}>m/z (Theoretical)</th>
                <th style={{ textAlign: 'left', padding: 8, color: '#A8B4C0', fontSize: 12 }}>Rel Intensity</th>
              </tr>
            </thead>
            <tbody>
              {peaks.map((p) => {
                const isBase = p.charge === basePeakCharge;
                return (
                  <tr key={p.charge} style={{ background: isBase ? 'rgba(104,211,145,0.06)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: 8, color: isBase ? '#68D391' : '#FFFFFF', fontWeight: isBase ? 800 : 'normal' }}>
                      {mode === 'negative' ? `-${p.charge}` : `+${p.charge}`}
                      {isBase && <span style={{ marginLeft: 8, fontSize: 10, background: '#68D391', color: '#000', padding: '1px 4px', borderRadius: 4, fontWeight: 'bold' }}>BASE</span>}
                    </td>
                    <td style={{ padding: 8, color: isBase ? '#68D391' : '#A8B2C1', fontWeight: 600 }}>{p.mz.toFixed(4)}</td>
                    <td style={{ padding: 8, color: isBase ? '#68D391' : '#D0DAE4' }}>{(p.intensity * 100).toFixed(0)}%</td>
                  </tr>
                );
              })}
              {peaks.length === 0 && (
                <tr><td colSpan={3} style={{ padding: 8, color: '#A8B4C0' }}>Enter A Valid One-Letter Sequence.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {peaks.length > 0 && (
          <SaveToJournalButton
            title="Mass Spec m/z Prediction"
            noteText={`Sequence: ${seq}
Ionization Mode: ${mode}
Adduct Type: ${adduct}
Predicted Peaks (charge, m/z, relative intensity):
${peaks.map(p => `- Charge ${mode === 'negative' ? `-${p.charge}` : `+${p.charge}`}: m/z ${p.mz.toFixed(4)} (${(p.intensity * 100).toFixed(0)}% intensity)`).join('\n')}`}
          />
        )}

        <p style={noteStyle}>{RESEARCH_NOTE}</p>
      </div>
    </section>
  );
}

function SppsSection() {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [seq, setSeq] = useState('');
  const [scale, setScale] = useState('100');
  const [aaCost, setAaCost] = useState('10');
  const [resinCost, setResinCost] = useState('20');
  const [synthYield, setSynthYield] = useState('90');
  const [purYield, setPurYield] = useState('50');
  const [chemistry, setChemistry] = useState<'DIC/Oxyma' | 'HATU/DIEA' | 'HBTU/DIEA'>('DIC/Oxyma');

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
    chemistry,
    synthesisYieldPct: Number(synthYield),
    purificationYieldPct: Number(purYield),
  });

  const costColors = ['#68D391', '#4299E1', '#805AD5', '#ED64A6', '#ECC94B'];

  return (
    <section id="spps-cost" style={chromeOuterStyle}>
      <div style={chromeInnerStyle}>
        <CalculatorHeader
          title="Fmoc-SPPS Synthesis Cost Estimator"
          why="Forecast experimental synthesis costs for custom peptides. Adjust scales, coupling reagents (HATU vs DIC), yields, and resin values."
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 12 }}>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>One-Letter Sequence</div>
            <StyledInput type="text" value={seq} maxLength={500} onChange={(e) => setSeq(e.target.value)} placeholder="e.g. FLG" />
            {sppsUnknownChars.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 12, color: '#F6AD55', background: 'rgba(246,173,85,0.10)', border: '1px solid rgba(246,173,85,0.30)', borderRadius: 6, padding: '5px 10px' }}>
                Warning: Non-standard characters: <strong>{sppsUnknownChars.join(', ')}</strong>. Codes ignored in residue yield projections.
              </div>
            )}
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 12 }}>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Synthesis Scale (umol)</div>
            <StyledInput type="number" step="any" value={scale} onChange={(e) => setScale(e.target.value)} />
          </label>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Coupling Chemistry Reagents</div>
            <StyledSelect value={chemistry} onChange={(e) => setChemistry(e.target.value as any)}>
              <option value="DIC/Oxyma">DIC/Oxyma (Cost-Effective / standard)</option>
              <option value="HATU/DIEA">HATU/DIEA (Premium / high coupling efficiency)</option>
              <option value="HBTU/DIEA">HBTU/DIEA (Moderate standard)</option>
            </StyledSelect>
          </label>
        </div>

        <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} style={{ background: 'transparent', border: '1px solid rgba(168,178,193,0.3)', color: '#A8B2C1', padding: '6px 12px', borderRadius: 6, fontSize: 12, marginBottom: 12, cursor: 'pointer' }}>{showAdvanced ? 'Hide Advanced Options' : 'Show Advanced Options'}</button>
        {showAdvanced && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginTop: 12, marginBottom: 12 }}>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Fmoc AA Cost ($/g)</div>
            <StyledInput type="number" step="any" value={aaCost} onChange={(e) => setAaCost(e.target.value)} />
          </label>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Resin Cost ($/g)</div>
            <StyledInput type="number" step="any" value={resinCost} onChange={(e) => setResinCost(e.target.value)} />
          </label>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Synthesis Yield (%)</div>
            <StyledInput type="number" step="any" min="1" max="100" value={synthYield} onChange={(e) => setSynthYield(e.target.value)} />
          </label>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Purification Yield (%)</div>
            <StyledInput type="number" step="any" min="1" max="100" value={purYield} onChange={(e) => setPurYield(e.target.value)} />
          </label>
        </div>}

        <div style={resultStyle}>
          {!out ? 'Enter A Valid Sequence.' : (
            <>
              <div>Total Synthesizer Cost: <strong>${out.totalUsd.toFixed(2)}</strong></div>
              <div style={{ color: '#00E5FF', marginTop: 6, fontSize: 18 }}>
                Cost Per Recovered Mg: <strong>${out.costPerRecoveredMg.toFixed(2)}</strong>
                <span style={{ display: 'block', fontSize: 12, color: '#A8B4C0', marginTop: 4, fontWeight: 'normal' }}>
                  Assuming ~{out.recoveredMg.toFixed(1)} mg final pure peptide recovered.
                </span>
              </div>
              
              <div style={{ display: 'flex', height: 16, borderRadius: 8, overflow: 'hidden', margin: '20px 0', border: '1px solid rgba(255,255,255,0.1)' }}>
                {out.breakdown.map((b, idx) => {
                  const pct = out.totalUsd > 0 ? (b.costUsd / out.totalUsd) * 100 : 0;
                  if (pct <= 0) return null;
                  return (
                    <div 
                      key={b.label} 
                      title={`${b.label}: $${b.costUsd.toFixed(2)}`} 
                      style={{ width: `${pct}%`, height: '100%', background: costColors[idx % costColors.length] }} 
                    />
                  );
                })}
              </div>

              <div style={{ marginTop: 16 }}>
                {out.breakdown.map((b, idx) => (
                  <div key={b.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#D0DAE4', marginBottom: 4 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: costColors[idx % costColors.length] }} />
                      {b.label}
                    </span>
                    <span>${b.costUsd.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {out && (
          <SaveToJournalButton
            title="Fmoc-SPPS Cost Estimate"
            noteText={`Scale: ${scale} mmol
Sequence Length: ${cleanSppsSeq.length} AA
Coupling Chemistry: ${chemistry === 'DIC/Oxyma' ? 'DIC/Oxyma (Standard)' : chemistry === 'HATU/DIEA' ? 'HATU/DIEA (Premium)' : 'HBTU/DIEA'}
Total Estimated Cost: $${out.totalUsd.toFixed(2)}
Cost Breakdown:
${out.breakdown.map(b => `- ${b.label}: $${b.costUsd.toFixed(2)}`).join('\n')}`}
          />
        )}

        <p style={noteStyle}>{RESEARCH_NOTE}</p>
      </div>
    </section>
  );
}

function SolubilitySection() {
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
          why="Heuristic calculation of aqueous solubility. Input the sequence for automatic residue diagnostics (GRAVY, Cysteine ratios, and hydrophobic aggregations)."
        />
        <div style={{ marginBottom: 12, fontSize: 12, color: '#A8B4C0' }}>
          Enter Sequence To Auto-Calculate Sequence Length And GRAVY Score.
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <button 
            onClick={() => { setPH('7.4'); setShowAdvanced(true); }} 
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #00E5FF', background: 'transparent', color: '#00E5FF', cursor: 'pointer', fontSize: 13 }}
          >
            Preset: PBS (pH 7.4)
          </button>
          <button 
            onClick={() => { setPH('2.5'); setShowAdvanced(true); }} 
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #F6AD55', background: 'transparent', color: '#F6AD55', cursor: 'pointer', fontSize: 13 }}
          >
            Preset: 10% Acetic Acid (pH ~2.5)
          </button>
          <button 
            onClick={() => { setPH('7.0'); setShowAdvanced(true); }} 
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #D6BCFA', background: 'transparent', color: '#D6BCFA', cursor: 'pointer', fontSize: 13 }}
          >
            Preset: Pure Water (pH 7.0)
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 12 }}>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Peptide Sequence (Optional)</div>
            <StyledInput type="text" value={seq} onChange={onSequenceChange} placeholder="e.g. FLGPLG" />
          </label>
        </div>

        <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} style={{ background: 'transparent', border: '1px solid rgba(168,178,193,0.3)', color: '#A8B2C1', padding: '6px 12px', borderRadius: 6, fontSize: 12, marginBottom: 12, cursor: 'pointer' }}>{showAdvanced ? 'Hide Parameter Details' : 'Configure Parameter Details'}</button>
        {showAdvanced && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 12 }}>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>GRAVY Score</div>
            <StyledInput type="number" step="0.01" value={gravy} onChange={(e) => setGravy(e.target.value)} />
          </label>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Isoelectric Point (pI)</div>
            <StyledInput type="number" step="0.01" value={pi} onChange={(e) => setPi(e.target.value)} placeholder="e.g. 6.0" />
          </label>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Sequence Length</div>
            <StyledInput type="number" step={1} min={1} value={len} onChange={(e) => setLen(e.target.value)} />
          </label>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Solution pH</div>
            <StyledInput type="number" step="0.1" value={pH} onChange={(e) => setPH(e.target.value)} />
          </label>
        </div>}

        {out?.warnings && out.warnings.length > 0 && (
          <div style={{ margin: '12px 0', fontSize: 13, color: '#F6AD55', background: 'rgba(246,173,85,0.1)', border: '1px solid rgba(246,173,85,0.3)', borderRadius: 8, padding: '10px 14px' }}>
            {out.warnings.map((w, idx) => (
              <div key={idx} style={{ marginBottom: 4 }}>Warning: {w}</div>
            ))}
          </div>
        )}

        <div style={resultStyle}>
          {!out ? 'Enter Valid Inputs.' : (
            <>
              Predicted Solubility: <strong>{out.predictedSolubilityMgMl.toFixed(3)} mg/mL</strong> ({out.classification.toUpperCase()})
              <div style={{ fontSize: 12, color: '#A8B4C0', marginTop: 6 }}>{out.notes}</div>
            </>
          )}
        </div>

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
Notes: ${out.notes}`}
          />
        )}

        <p style={noteStyle}>{RESEARCH_NOTE}</p>
      </div>
    </section>
  );
}

function VialQuantitySection() {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [groups, setGroups] = useState('2');
  const [subjectsPerGroup, setSubjectsPerGroup] = useState('8');
  const [dosesPerSubjectPerWeek, setDosesPerSubjectPerWeek] = useState('2');
  const [studyDurationWeeks, setStudyDurationWeeks] = useState('4');
  const [mgPerDose, setMgPerDose] = useState('');
  const [mgPerVial, setMgPerVial] = useState('');
  const [overage, setOverage] = useState('15');

  const parsedGroups = Math.max(1, Math.floor(Number(groups) || 1));
  const parsedSubjects = Math.max(1, Math.floor(Number(subjectsPerGroup) || 1));
  const totalN = parsedGroups * parsedSubjects;

  const out = vialQuantityPower({
    groups: parsedGroups,
    subjectsPerGroup: parsedSubjects,
    dosesPerSubjectPerWeek: Math.max(1, Number(dosesPerSubjectPerWeek) || 1),
    studyDurationWeeks: Math.max(1, Math.floor(Number(studyDurationWeeks) || 1)),
    mgPerDose: Number(mgPerDose),
    mgPerVial: Number(mgPerVial),
    overagePct: Number(overage) || 0,
  });

  return (
    <section id="vial-quantity" style={chromeOuterStyle}>
      <div style={chromeInnerStyle}>
        <CalculatorHeader
          title="In Vivo Study Cohort Design & Procurement Tool"
          why="Synthesize sample cohorts and schedule studies. Dynamically outputs total animal cohort mass requirements and coordinates vial quantities needed including overage bounds."
        />
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Treatment Groups</div>
            <StyledInput type="number" min={1} step={1} value={groups} onChange={(e) => setGroups(e.target.value)} />
          </label>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Subjects Per Group</div>
            <StyledInput type="number" min={1} step={1} value={subjectsPerGroup} onChange={(e) => setSubjectsPerGroup(e.target.value)} />
          </label>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Doses per Subject (Weekly)</div>
            <StyledSelect value={dosesPerSubjectPerWeek} onChange={(e) => setDosesPerSubjectPerWeek(e.target.value)}>
              <option value="7">Daily (7x / week)</option>
              <option value="3">Three Times Weekly (3x / week)</option>
              <option value="2">Twice Weekly (2x / week)</option>
              <option value="1">Weekly (1x / week)</option>
            </StyledSelect>
          </label>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Study Duration (Weeks)</div>
            <StyledInput type="number" min={1} step={1} value={studyDurationWeeks} onChange={(e) => setStudyDurationWeeks(e.target.value)} />
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 12 }}>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Mg Per Dose</div>
            <StyledInput type="number" step="0.001" value={mgPerDose} onChange={(e) => setMgPerDose(e.target.value)} placeholder="e.g. 0.250" />
          </label>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Mg Per Vial</div>
            <StyledInput type="number" step="0.01" value={mgPerVial} onChange={(e) => setMgPerVial(e.target.value)} placeholder="e.g. 5" />
          </label>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Overage Buffer (%)</div>
            <StyledInput type="number" step="any" min="0" max="100" value={overage} onChange={(e) => setOverage(e.target.value)} />
          </label>
        </div>

        {out && (
          <div style={{ margin: '16px 0', background: 'rgba(0,0,0,0.2)', padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: 11, color: '#A8B4C0', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Cohort Summary Timeline</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, textAlign: 'center', fontSize: 13 }}>
              <div style={{ padding: 8, background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
                <span style={{ display: 'block', color: '#A8B4C0', fontSize: 10 }}>TOTAL SUBJECTS (N)</span>
                <strong style={{ fontSize: 16, color: '#FFF' }}>{totalN}</strong>
              </div>
              <div style={{ padding: 8, background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
                <span style={{ display: 'block', color: '#A8B4C0', fontSize: 10 }}>DOSES PER SUBJECT</span>
                <strong style={{ fontSize: 16, color: '#FFF' }}>{Math.round(Number(dosesPerSubjectPerWeek) * Number(studyDurationWeeks))}</strong>
              </div>
              <div style={{ padding: 8, background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
                <span style={{ display: 'block', color: '#A8B4C0', fontSize: 10 }}>STUDY WEEKS</span>
                <strong style={{ fontSize: 16, color: '#FFF' }}>{studyDurationWeeks}</strong>
              </div>
            </div>
          </div>
        )}

        <div style={resultStyle}>
          {!out ? 'Enter Valid Inputs.' : (
            <>
              Vials Needed: <strong style={{ color: '#00E5FF', fontSize: 20 }}>{out.vialsNeeded.toLocaleString()}</strong>{'  '}|{'  '}
              Per-Subject Mass: <strong>{Number(out.perSubjectMg).toFixed(2)} mg</strong>{'  '}|{'  '}
              Total Mass: <strong>{Number(out.totalMg).toFixed(2)} mg</strong>
            </>
          )}
        </div>

        {out && (
          <SaveToJournalButton
            title="Study Procurement Plan"
            noteText={`Treatment Groups: ${groups}
Subjects Per Group: ${subjectsPerGroup} (Total N: ${totalN})
Doses Per Subject (Weekly): ${dosesPerSubjectPerWeek}
Study Duration: ${studyDurationWeeks} Weeks
Mg Per Dose: ${mgPerDose}
Mg Per Vial: ${mgPerVial}
Overage Buffer: ${overage}%
Total Vials Needed: ${out.vialsNeeded}
Per-Subject Mass: ${Number(out.perSubjectMg).toFixed(2)} mg
Total Mass Needed: ${Number(out.totalMg).toFixed(2)} mg`}
          />
        )}

        <p style={noteStyle}>{RESEARCH_NOTE}</p>
      </div>
    </section>
  );
}

export default function CalculatorSuite({ activeId }: { activeId?: string | null }) {
  const [compounds, setCompounds] = useState<CompoundListItem[]>([]);

  useEffect(() => {
    fetch('/api/research/compounds-list')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.compounds)) {
          setCompounds(data.compounds);
        }
      })
      .catch(err => console.error('Error loading compounds list for autocomplete:', err));
  }, []);

  if (!activeId) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {activeId === 'reconstitution' && <Reconstitution compounds={compounds} />}
      {activeId === 'dilution' && <DilutionSection />}
      {activeId === 'concentration' && <ConcentrationSection compounds={compounds} />}
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
