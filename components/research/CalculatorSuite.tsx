'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import {
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
  RESIDUE_MASS,
} from '@/lib/research/calculators';
import { toast } from 'sonner';

const RESEARCH_NOTE = 'Research Use Only. Not Intended As Medical Advice Or Human Dosing.';

const chromeOuterStyle: React.CSSProperties = {
  scrollMarginTop: 100,
  marginBottom: 28,
  borderRadius: 24,
  padding: '2px', // High-tech ultra-thin border gradient
  background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.3) 0%, rgba(104, 211, 145, 0.05) 50%, rgba(0, 229, 255, 0.3) 100%)',
  boxShadow: '0 16px 40px rgba(0,0,0,0.7), 0 0 24px rgba(0, 229, 255, 0.04)',
  transition: 'all 0.3s ease',
};

const chromeInnerStyle: React.CSSProperties = {
  borderRadius: 22,
  padding: 32,
  background: 'radial-gradient(circle at 50% 0%, #111622 0%, #080a0f 100%)',
  boxShadow: 'inset 0 0 30px rgba(0,0,0,0.9)',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 700,
  color: '#9CA3AF',
  marginBottom: 8,
  textTransform: 'capitalize', // Enforce Title Case on Labels
  letterSpacing: '0.05em',
};

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

const selectStyleBase: React.CSSProperties = {
  ...inputStyleBase,
  appearance: 'none',
  WebkitAppearance: 'none',
  MozAppearance: 'none',
  // Custom encoded SVG arrow chevron
  backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23A8B2C1' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 16px center',
  backgroundSize: '16px',
  paddingRight: '42px',
  cursor: 'pointer',
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

function StyledSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  return (
    <select 
      {...props}
      onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...selectStyleBase,
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

const explainerStyle: React.CSSProperties = {
  color: '#9CA3AF',
  fontSize: 14,
  lineHeight: 1.6,
  margin: '0 0 20px',
};

const resultStyle: React.CSSProperties = {
  marginTop: 20,
  padding: 20,
  borderRadius: 14,
  background: '#07090e',
  border: '1px solid rgba(0, 229, 255, 0.2)',
  boxShadow: '0 4px 20px rgba(0, 229, 255, 0.05), inset 0 0 15px rgba(0, 229, 255, 0.02)',
  color: '#E5E7EB',
  fontSize: 16,
  fontFamily: 'monospace',
  textAlign: 'center',
  textTransform: 'capitalize', // Enforce Title Case
};

const noteStyle: React.CSSProperties = {
  marginTop: 18,
  marginBottom: 0,
  color: '#6B7280',
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
  { name: 'Custom (Enter Manually)', vialMass: '10', defaultDose: '1', unit: 'mg' },
  { name: 'BPC-157', vialMass: '5', defaultDose: '250', unit: 'mcg' },
  { name: 'TB-500', vialMass: '5', defaultDose: '1', unit: 'mg' },
  { name: 'CJC-1295 / Ipamorelin', vialMass: '5', defaultDose: '300', unit: 'mcg' },
  { name: 'Tirzepatide', vialMass: '10', defaultDose: '1', unit: 'mg' },
  { name: 'Semaglutide', vialMass: '5', defaultDose: '0.25', unit: 'mg' },
  { name: 'Retatrutide', vialMass: '10', defaultDose: '1', unit: 'mg' },
  { name: 'GHK-Cu', vialMass: '50', defaultDose: '1', unit: 'mg' },
  { name: 'Melanotan II', vialMass: '10', defaultDose: '250', unit: 'mcg' },
  { name: 'PT-141', vialMass: '10', defaultDose: '1', unit: 'mg' },
  { name: 'MOTS-c', vialMass: '10', defaultDose: '1', unit: 'mg' }
];

const STANDARD_AA = new Set('ACDEFGHIKLMNPQRSTVWY');

interface VisualSyringeProps {
  ml: number;
  size: 0.3 | 0.5 | 1.0;
  type?: 'u100' | 'u40' | 'u80';
  onDrawMlChange?: (newMl: number) => void;
}

function VisualSyringe({ ml, size, type = 'u100', onDrawMlChange }: VisualSyringeProps) {
  const maxMl = size;
  const pct = Math.min(100, Math.max(0, (ml / maxMl) * 100));
  
  const multiplier = type === 'u40' ? 40 : type === 'u80' ? 80 : 100;
  const units = Math.round(ml * multiplier);
  const maxUnits = Math.round(size * multiplier);
  
  const tickCount = size === 1.0 ? 10 : size === 0.5 ? 5 : 3;
  const subdivisions = size === 1.0 ? 100 : size === 0.5 ? 50 : 30;

  const [isDragging, setIsDragging] = useState(false);
  const barrelRef = useRef<HTMLDivElement>(null);

  const updateVolumeFromEvent = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!barrelRef.current || !onDrawMlChange) return;
    const rect = barrelRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const relativeX = Math.min(width, Math.max(0, clickX));
    const pct = relativeX / width;
    const newMl = pct * size;
    onDrawMlChange(newMl);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onDrawMlChange || !barrelRef.current) return;
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    updateVolumeFromEvent(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    updateVolumeFromEvent(e);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };
  
  return (
    <div style={{ background: '#121620', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 12, color: '#A8B4C0', fontFamily: 'monospace' }}>
        <span>Syringe Capacity: <span className="calc-no-capitalize">{size} mL ({maxUnits} Units Max, {type.toUpperCase()})</span></span>
        <span style={{ color: '#00E5FF', fontWeight: 'bold' }} className="calc-no-capitalize">{units} Units ({ml.toFixed(3)} mL)</span>
      </div>
      
      {ml > size ? (
        <div style={{ color: '#FF6B6B', fontSize: 13, textAlign: 'center', padding: '8px 0', border: '1px dashed rgba(255,107,107,0.3)', borderRadius: 6, background: 'rgba(255,107,107,0.05)' }}>
          Warning: Dose Volume <span className="calc-no-capitalize">({ml.toFixed(3)} mL)</span> Exceeds Syringe Capacity <span className="calc-no-capitalize">({size} mL)</span>. Select A Larger Syringe Or Increase Reconstitution Diluent Volume.
        </div>
      ) : (
        <>
          {onDrawMlChange && (
            <div style={{ fontSize: 11, color: '#A8B2C1', marginBottom: 8, fontStyle: 'italic', textTransform: 'capitalize' }}>
              Click Or Drag Plunger Inside Barrel To Adjust Target Dose Volume
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', height: 60, paddingLeft: 40, position: 'relative' }}>
            {/* Plunger shaft */}
            <div style={{ position: 'absolute', left: 0, width: 40, height: 8, background: '#4A5568', borderRadius: '4px 0 0 4px' }} />
            {/* Plunger thumb press */}
            <div style={{ position: 'absolute', left: 0, width: 4, height: 24, background: '#4A5568', borderRadius: 2 }} />
            
            {/* Syringe body barrel */}
            <div 
              ref={barrelRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              style={{ 
                flex: 1, 
                height: 32, 
                background: 'rgba(255,255,255,0.03)', 
                border: '2px solid #718096', 
                borderRadius: '0 4px 4px 0', 
                position: 'relative', 
                display: 'flex', 
                alignItems: 'center', 
                overflow: 'hidden',
                cursor: onDrawMlChange ? 'ew-resize' : 'default',
                touchAction: 'none',
              }}
            >
              {/* Liquid / Plunger fill */}
              <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, rgba(0, 229, 255, 0.3) 0%, rgba(0, 229, 255, 0.15) 100%)', borderRight: '4px solid #00E5FF', transition: isDragging ? 'none' : 'width 0.4s ease-out' }} />
              
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
                  if (i % (maxUnits / subdivisions) === 0) return <div key={i} />;
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
        </>
      )}
    </div>
  );
}

function Reconstitution({ compounds }: { compounds: CompoundListItem[] }) {
  const [peptide, setPeptide] = useState(POPULAR_PEPTIDES[0].name);
  const [vialMass, setVialMass] = useState('10');
  const [diluentMl, setDiluentMl] = useState('2');
  const [desiredMass, setDesiredMass] = useState('1');
  const [unit, setUnit] = useState('mg');
  const [syringeSize, setSyringeSize] = useState<0.3 | 0.5 | 1.0>(1.0);
  const [syringeType, setSyringeType] = useState<'u100' | 'u40' | 'u80'>('u100');
  const [diluentType, setDiluentType] = useState<'bac-water' | 'acetic-acid'>('bac-water');
  const [showGuide, setShowGuide] = useState(false);

  const peptideList = useMemo(() => {
    const dbPeptides = compounds.map(c => ({
      name: c.display_name,
      vialMass: '10',
      defaultDose: '1',
      unit: 'mg'
    }));
    return [...POPULAR_PEPTIDES, ...dbPeptides];
  }, [compounds]);

  const handlePeptideChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setPeptide(val);
    const found = peptideList.find(p => p.name === val);
    if (found && found.name !== 'Custom (Enter Manually)') {
      setVialMass(found.vialMass || '10');
      setDesiredMass(found.defaultDose || '1');
      setUnit(found.unit || 'mg');
      setDiluentMl('2');
    } else {
      setVialMass('');
      setDesiredMass('1');
      setDiluentMl('');
      setUnit('mg');
    }
  };

  const vMass = Number(vialMass);
  const dilMl = Number(diluentMl);
  const dMassNumeric = Number(desiredMass);
  const dMassMg = unit === 'mcg' ? dMassNumeric / 1000 : dMassNumeric;

  const drawMl = drawVolumeMl(vMass, dilMl, dMassMg);

  const isIgf = peptide.toLowerCase().includes('igf');

  useEffect(() => {
    if (isIgf) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDiluentType('acetic-acid');
    } else {
      setDiluentType('bac-water');
    }
  }, [isIgf]);

  const syringeMultiplier = syringeType === 'u40' ? 40 : syringeType === 'u80' ? 80 : 100;

  const handleDrawMlChange = (newMl: number) => {
    if (vMass <= 0 || dilMl <= 0) return;
    const concentration = vMass / dilMl; // mg/mL
    const desiredMg = newMl * concentration;
    const finalVal = unit === 'mcg' ? desiredMg * 1000 : desiredMg;
    const rounded = Number(finalVal.toFixed(3));
    setDesiredMass(rounded.toString());
  };

  const totalDoses = dMassMg > 0 ? vMass / dMassMg : 0;
  const showExhaustionWarning = dMassMg > vMass;

  const getStabilityAdvice = () => {
    const name = peptide.toLowerCase();
    if (name.includes('tirzepatide') || name.includes('semaglutide') || name.includes('retatrutide')) {
      return {
        title: 'GLP-1 Stability Advice',
        advice: 'GLP-1 Receptor Agonists Are Highly Sensitive To Thermal Stress And Vigorous Mechanical Agitation. Store At <span class="calc-no-capitalize">2-8°C (36-46°F)</span> And Protect From Light. Do Not Freeze. Reconstituted Vials Remain Thermally Stable For Up To 28 Days Under Proper Refrigeration. Swirl Gently To Mix; Do Not Shake.',
      };
    } else if (name.includes('bpc-157') || name.includes('bpc157')) {
      return {
        title: 'BPC-157 Stability Advice',
        advice: 'BPC-157 Exhibits High Structural Resilience Compared To Most Peptides. However, Reconstituted Solutions In Bacteriostatic Water Must Be Kept Refrigerated At <span class="calc-no-capitalize">2-8°C</span> To Prevent Degradation And Inhibit Bacterial Proliferation. Reconstituted Solutions Are Best Used Within 30 Days.',
      };
    } else if (name.includes('igf') || name.includes('lr3')) {
      return {
        title: 'IGF-1 Stability Advice',
        advice: 'IGF-1 Analogues Precipitate Rapidly In Standard Aqueous Solutions. Reconstitute In <span class="calc-no-capitalize">0.6%</span> Acetic Acid As Recommended Above To Maintain Stability. Keep Reconstituted Solutions Refrigerated At <span class="calc-no-capitalize">2-8°C</span> And Use Within 14 Days For Maximum Active Recoverability.',
      };
    } else {
      return {
        title: 'Standard Peptide Stability Advice',
        advice: 'Lyophilized Peptides Are Fragile Biomolecules. Once Reconstituted, Keep Refrigerated At <span class="calc-no-capitalize">2-8°C (36-46°F)</span>. Protect Vials From Vibration, Thermal Shock, And Ultraviolet Light. Swirl Gently To Dissolve; Never Shake Reconstituted Vials.',
      };
    }
  };

  const stability = getStabilityAdvice();

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Pop-Up Blocker Prevented Opening The Print Layout. Please Enable Pop-Ups.');
      return;
    }
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Reconstitution Protocol Sheet - ${peptide}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              color: #111827;
              padding: 40px;
              max-width: 600px;
              margin: 0 auto;
            }
            .card {
              border: 2px solid #10B981;
              border-radius: 12px;
              padding: 24px;
              background: #F9FAFB;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
            }
            h1 {
              font-size: 20px;
              color: #047857;
              margin-top: 0;
              border-bottom: 2px solid #E5E7EB;
              padding-bottom: 12px;
              text-transform: capitalize;
            }
            .recipe-item {
              margin: 16px 0;
              font-size: 15px;
              line-height: 1.5;
            }
            .recipe-label {
              font-weight: bold;
              color: #4B5563;
              text-transform: capitalize;
            }
            .recipe-value {
              font-family: monospace;
              font-size: 16px;
              color: #111827;
              font-weight: bold;
            }
            .alert-box {
              background: #FEF3C7;
              border-left: 4px solid #F59E0B;
              padding: 12px;
              margin-top: 20px;
              border-radius: 4px;
              font-size: 13px;
              color: #78350F;
            }
            .footer {
              margin-top: 30px;
              font-size: 11px;
              color: #9CA3AF;
              text-align: center;
              font-style: italic;
            }
            @media print {
              body { padding: 0; }
              .card { border: 1px solid #10B981; box-shadow: none; }
            }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Reconstitution Protocol Sheet</h1>
            <div class="recipe-item">
              <span class="recipe-label">Peptide Compound:</span>
              <span class="recipe-value">${peptide}</span>
            </div>
            <div class="recipe-item">
              <span class="recipe-label">Vial Mass:</span>
              <span class="recipe-value">${vMass} mg</span>
            </div>
            <div class="recipe-item">
              <span class="recipe-label">Reconstitution Diluent:</span>
              <span class="recipe-value">${dilMl} mL (${diluentType === 'bac-water' ? 'Bacteriostatic Water' : '0.6% Acetic Acid'})</span>
            </div>
            <div class="recipe-item">
              <span class="recipe-label">Desired Target Dose:</span>
              <span class="recipe-value">${dMassNumeric} ${unit}</span>
            </div>
            <div class="recipe-item" style="background: #ECFDF5; padding: 12px; border-radius: 8px; border: 1px solid #A7F3D0; margin-top: 20px;">
              <span class="recipe-label" style="font-size: 16px; color: #065F46;">Recommended Syringe Draw:</span>
              <span class="recipe-value" style="font-size: 22px; color: #047857; display: block; margin-top: 4px;">
                ${drawMl !== null && isFinite(drawMl) ? Math.round(drawMl * syringeMultiplier) : 0} Units (${syringeType.toUpperCase()})
              </span>
              <span style="font-size: 12px; color: #065F46; display: block; margin-top: 2px;">
                (${drawMl !== null && isFinite(drawMl) ? drawMl.toFixed(3) : 0} mL drawn on a ${syringeSize} mL insulin syringe)
              </span>
            </div>
            
            ${isIgf ? `
              <div class="alert-box">
                IGF-1 Stability Notice: Diluted In 0.6% Acetic Acid To Maintain Long-Term Solubility And Prevent Rapid Isoelectric Precipitation.
              </div>
            ` : ''}

            <div class="footer">
              ${RESEARCH_NOTE}
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <section id="reconstitution" style={chromeOuterStyle}>
      <div style={chromeInnerStyle}>
        <CalculatorHeader
          title="Reconstitution & Syringe Calculator"
          why="Lyophilized Peptide Preparation Guidelines. Select Standard Compounds, Configure Diluent Matrices, And Visually Confirm Draw Volumes Using Standard Insulin Syringe Models."
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
            <div style={labelStyle}>Step 2: Vial Mass (<span className="calc-no-capitalize">mg</span>)</div>
            <StyledInput type="number" step="any" min={0} value={vialMass} placeholder="e.g. 5" onChange={(e) => setVialMass(e.target.value)} />
          </label>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Step 3: Diluent Added (<span className="calc-no-capitalize">mL</span>)</div>
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
            Stability Warning: <span className="calc-no-capitalize">IGF-1</span> Family Peptides Precipitate Quickly In Neutral <span className="calc-no-capitalize">pH</span> (Bacteriostatic Water). Reconstituting In <span className="calc-no-capitalize">0.6%</span> Acetic Acid Maintains Solubility And Shelf-Stability.
          </div>
        )}

        <div style={{ ...resultStyle, marginTop: 12 }}>
          {vMass > 0 && dilMl > 0 ? (
            <div style={{ color: '#00E5FF', fontWeight: 800, fontSize: 18 }}>
              Add {dilMl} <span className="calc-no-capitalize">mL</span> Of {diluentType === 'bac-water' ? 'Bacteriostatic Water' : '0.6% Acetic Acid'} To The Vial.
            </div>
          ) : (
            <div style={{ fontSize: 14 }}>Enter Vial Mass And Diluent Volume Above.</div>
          )}
        </div>

        <h3 style={{ margin: '24px 0 8px', color: '#FFFFFF', fontSize: 16 }}>Draw Volume & Syringe Visualizer</h3>
        <p style={{ color: '#A8B4C0', fontSize: 14, marginBottom: 16 }}>
          Input Desired Target Dose To Map Pulling Volume To Tick Marks.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Desired Target Dose</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <StyledInput style={{ flex: 1 }} type="number" step="any" min={0} value={desiredMass} placeholder="e.g. 1" onChange={(e) => setDesiredMass(e.target.value)} />
              <StyledSelect style={{ width: 90 }} value={unit} onChange={(e) => setUnit(e.target.value)}>
                <option value="mcg" className="calc-no-capitalize">mcg</option>
                <option value="mg" className="calc-no-capitalize">mg</option>
              </StyledSelect>
            </div>
          </label>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Insulin Syringe Capacity</div>
            <StyledSelect value={syringeSize} onChange={(e) => setSyringeSize(Number(e.target.value) as 0.3 | 0.5 | 1.0)}>
              <option value="1.0"><span className="calc-no-capitalize">1.0 mL</span> ({syringeMultiplier} Units Max)</option>
              <option value="0.5"><span className="calc-no-capitalize">0.5 mL</span> ({Math.round(0.5 * syringeMultiplier)} Units Max)</option>
              <option value="0.3"><span className="calc-no-capitalize">0.3 mL</span> ({Math.round(0.3 * syringeMultiplier)} Units Max)</option>
            </StyledSelect>
          </label>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Syringe Concentration Type</div>
            <StyledSelect value={syringeType} onChange={(e) => setSyringeType(e.target.value as any)}>
              <option value="u100">U-100 (Standard, 100 U/mL)</option>
              <option value="u40">U-40 (Veterinary, 40 U/mL)</option>
              <option value="u80">U-80 (Specialized, 80 U/mL)</option>
            </StyledSelect>
          </label>
        </div>

        {drawMl !== null && isFinite(drawMl) && drawMl > 0 ? (
          <>
            <div style={{ ...resultStyle, marginTop: 20 }}>
              To Draw A Dose Of <strong>{dMassNumeric} <span className="calc-no-capitalize">{unit}</span></strong>, Pull Liquid To:
              <span style={{ fontSize: 28, color: '#68D391', fontWeight: 800, display: 'block', margin: '8px 0' }}>
                {Math.round(drawMl * syringeMultiplier)} Units (${syringeType.toUpperCase()})
              </span>
              <span style={{ fontSize: 13, color: '#A8B4C0' }}>
                (<span className="calc-no-capitalize">{drawMl.toFixed(3)} mL</span> Of Working Solution)
              </span>
              
              {!showExhaustionWarning && totalDoses > 0 && (
                <div style={{ marginTop: 16, borderTop: '1px dashed rgba(0, 229, 255, 0.2)', paddingTop: 12, fontSize: 13, color: '#A8B4C0' }}>
                  Timeline Summary: This <span className="calc-no-capitalize">{vMass} mg</span> Vial Yields Approximately <strong>{Math.floor(totalDoses)}</strong> Draws Of <span className="calc-no-capitalize">{dMassNumeric} {unit}</span>.
                </div>
              )}
            </div>
            
            {showExhaustionWarning && (
              <div style={{ color: '#FF6B6B', fontSize: 13, padding: '12px', border: '1px dashed rgba(255,107,107,0.3)', borderRadius: 6, background: 'rgba(255,107,107,0.05)', marginTop: 12, textAlign: 'center' }}>
                Warning: Desired Target Dose <span className="calc-no-capitalize">({dMassNumeric} {unit})</span> Exceeds Total Vial Capacity <span className="calc-no-capitalize">({vMass} mg)</span>. Please Adjust Vial Mass Or Desired Target Dose.
              </div>
            )}
            
            <VisualSyringe ml={drawMl} size={syringeSize} type={syringeType} onDrawMlChange={handleDrawMlChange} />
          </>
        ) : (
          <div style={{ ...resultStyle, marginTop: 20, fontSize: 14 }}>Enter A Desired Dose Above.</div>
        )}

        {/* Dynamic Stability Advice Section */}
        <div style={{ marginTop: 20, padding: 16, borderRadius: 10, background: 'rgba(0, 229, 255, 0.02)', border: '1px solid rgba(0, 229, 255, 0.1)', color: '#A8B2C1', fontSize: 13, lineHeight: 1.5 }}>
          <h4 style={{ margin: '0 0 6px', color: '#00E5FF', fontSize: 14, fontWeight: 700 }}>
            {stability.title}
          </h4>
          <p style={{ margin: 0 }} dangerouslySetInnerHTML={{ __html: stability.advice }} />
        </div>

        {vMass > 0 && dilMl > 0 && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
            <SaveToJournalButton
              title={`Reconstitution Recipe - ${peptide}`}
              noteText={`Peptide Name: ${peptide}
Vial Mass: ${vMass} mg
Diluent Volume: ${dilMl} mL (${diluentType === 'bac-water' ? 'Bacteriostatic Water' : '0.6% Acetic Acid'})
Target Dose: ${dMassNumeric} ${unit}
Syringe Type: ${syringeType.toUpperCase()} (${syringeMultiplier} U/mL)
Recommended Syringe Draw: ${drawMl !== null && isFinite(drawMl) ? Math.round(drawMl * syringeMultiplier) : 0} Units (On A ${syringeSize} mL Syringe)`}
              compoundSlug={compounds.find(c => c.display_name === peptide)?.slug || null}
            />
            <button
              type="button"
              onClick={handlePrint}
              style={{
                background: 'transparent',
                border: '1px solid #00E5FF',
                color: '#00E5FF',
                padding: '8px 16px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                marginTop: 12,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0, 229, 255, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              Print Protocol Sheet
            </button>
          </div>
        )}

        {/* Needle Gauge & Syringe Ticks Reference Guide */}
        <div style={{ marginTop: 24, borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: 16 }}>
          <button
            type="button"
            onClick={() => setShowGuide(!showGuide)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#A8B2C1',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: 0,
            }}
          >
            <svg 
              style={{ transform: showGuide ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', width: 16, height: 16 }} 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
            Needle Gauge & Syringe Ticks Reference Guide
          </button>
          
          {showGuide && (
            <div style={{ marginTop: 12, padding: 16, background: 'rgba(255, 255, 255, 0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)', fontSize: 13, color: '#9CA3AF', lineHeight: 1.6 }}>
              <h4 style={{ margin: '0 0 8px', color: '#FFFFFF', fontSize: 14 }}>Reading Insulin Syringe Tick Marks</h4>
              <p style={{ margin: '0 0 12px' }}>
                Insulin Syringes Are Divided Into Units Rather Than Milliliters. For A Standard <span className="calc-no-capitalize">U-100</span> Concentration:
              </p>
              <ul style={{ margin: '0 0 16px', paddingLeft: 20 }}>
                <li><strong style={{ color: '#E5E7EB' }}>1.0 <span className="calc-no-capitalize">mL</span> Syringe:</strong> Each Tick Mark Represents 2 Units (<span className="calc-no-capitalize">0.02 mL</span>). Major Numbers Are Placed Every 10 Units.</li>
                <li><strong style={{ color: '#E5E7EB' }}>0.5 <span className="calc-no-capitalize">mL</span> Syringe:</strong> Each Tick Mark Represents 1 Unit (<span className="calc-no-capitalize">0.01 mL</span>). Major Numbers Are Placed Every 5 Or 10 Units.</li>
                <li><strong style={{ color: '#E5E7EB' }}>0.3 <span className="calc-no-capitalize">mL</span> Syringe:</strong> Each Tick Mark Represents 1 Unit (<span className="calc-no-capitalize">0.01 mL</span>) Or 0.5 Units (<span className="calc-no-capitalize">0.005 mL</span>). Major Numbers Are Placed Every 5 Units.</li>
              </ul>
              
              <h4 style={{ margin: '0 0 8px', color: '#FFFFFF', fontSize: 14 }}>Selecting Needle Gauge Sizes</h4>
              <p style={{ margin: '0 0 12px' }}>
                Needle Gauge (G) Measures The Thickness Of The Needle. Larger Gauge Numbers Indicate Thinner Needles:
              </p>
              <ul style={{ margin: '0 0 16px', paddingLeft: 20 }}>
                <li><strong style={{ color: '#E5E7EB' }} className="calc-no-capitalize">31G (31 Gauge):</strong> Ultra-Thin Needle. Provides Minimal Discomfort. Recommended For Standard Aqueous Solutions.</li>
                <li><strong style={{ color: '#E5E7EB' }} className="calc-no-capitalize">30G (30 Gauge):</strong> Slightly Thicker. Best For Viscous Diluents Or When Drawing Is Slow.</li>
                <li><strong style={{ color: '#E5E7EB' }} className="calc-no-capitalize">29G (29 Gauge):</strong> Thicker Shaft. Suitable For Large Draw Volumes Or Viscous Carriers.</li>
              </ul>
              
              <h4 style={{ margin: '0 0 8px', color: '#FFFFFF', fontSize: 14 }}>Subcutaneous Injection Guidelines</h4>
              <p style={{ margin: 0 }}>
                Subcutaneous Injections Are Placed Into The Fat Layer Directly Below The Skin. Typical Needle Lengths Range From <span className="calc-no-capitalize">4mm</span> To <span className="calc-no-capitalize">8mm</span> (5/16 Inch). Always Maintain Strict Aseptic Techniques, Disinfecting Vial Stopper Seals Prior To Extraction.
              </p>
            </div>
          )}
        </div>

        <p style={noteStyle}>{RESEARCH_NOTE}</p>
      </div>
    </section>
  );
}

function TubesRack({ steps, currentStep, onSelectStep }: { steps: Array<{ stepNumber: number; concentration: number; transferVolumeMl?: number; diluentVolumeMl?: number }>; currentStep: number; onSelectStep: (idx: number) => void }) {
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
  return (
    <section id="dilution" style={chromeOuterStyle}>
      <div style={chromeInnerStyle}>
        <CalculatorHeader
          title="Serial Dilution & Assay Curve Generator"
          why="Design Multi-Step Dilution Curves For Pharmacological Profiles. Standard Curve Assay Mode Calculates Pipetting Guides For Microcentrifuge Tube Racks."
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
              <div style={labelStyle}>Target Vol Per Tube (ML)</div>
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
                  <div>
                    Transfer <strong style={{ color: '#68D391' }} className="calc-no-capitalize">{selectedTubeData.transferVolumeMl?.toFixed(3)} mL</strong> Of Stock Into The Tube, And Mix With <strong style={{ color: '#68D391' }} className="calc-no-capitalize">{selectedTubeData.diluentVolumeMl?.toFixed(3)} mL</strong> Of Diluent.
                  </div>
                ) : (
                  <div>
                    Transfer <strong style={{ color: '#68D391' }} className="calc-no-capitalize">{selectedTubeData.transferVolumeMl?.toFixed(3)} mL</strong> Of Tube {selectedTube - 1} (T{selectedTube - 1}) Into The Tube, And Mix With <strong style={{ color: '#68D391' }} className="calc-no-capitalize">{selectedTubeData.diluentVolumeMl?.toFixed(3)} mL</strong> Of Diluent.
                  </div>
                )}
                <div style={{ marginTop: 6, fontSize: 12, color: '#A8B4C0' }}>
                  Target Concentration: <strong className="calc-no-capitalize">{selectedTubeData.concentration.toExponential(3)}</strong> Units. Total Volume: <span className="calc-no-capitalize">{(selectedTubeData.transferVolumeMl! + selectedTubeData.diluentVolumeMl!).toFixed(3)} mL</span>
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
                {assayMode && <th style={{ textAlign: 'left', padding: 8, color: '#A8B4C0', fontSize: 12 }}>Transfer Vol (ML)</th>}
                {assayMode && <th style={{ textAlign: 'left', padding: 8, color: '#A8B4C0', fontSize: 12 }}>Diluent Vol (ML)</th>}
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
  const [fetchingMw, setFetchingMw] = useState(false);

  const mwRequired = needsMW(from, to);

  const filteredCompounds = useMemo(() => {
    if (!searchQuery) return compounds.slice(0, 10);
    return compounds.filter(c => 
      c.display_name.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 10);
  }, [compounds, searchQuery]);

  const isRawSequence = useMemo(() => {
    const clean = searchQuery.replace(/\s+/g, '').toUpperCase();
    if (clean.length < 2) return false;
    return Array.from(clean).every(char => char in RESIDUE_MASS);
  }, [searchQuery]);

  const handleSelectCompound = (c: CompoundListItem) => {
    if (c.molecular_weight_da) {
      setMw(c.molecular_weight_da.toString());
    }
    setSearchQuery(c.display_name);
    setShowDropdown(false);
  };

  const handleUniProtLookup = async () => {
    if (!searchQuery) return;
    setFetchingMw(true);
    try {
      const res = await fetch(`https://rest.uniprot.org/uniprotkb/search?query=${encodeURIComponent(searchQuery)}&size=1`);
      if (res.ok) {
        const data = await res.json();
        const entry = data.results?.[0];
        if (entry) {
          const sequence = entry.sequence?.value;
          const name = entry.proteinDescription?.recommendedName?.fullName?.value || entry.uniProtkbId;
          
          if (sequence) {
            let mass = 18.0106; // H2O
            for (const aa of sequence.toUpperCase()) {
              mass += RESIDUE_MASS[aa] || 110; // average residue mass fallback
            }
            setMw(Math.round(mass).toString());
            toast.success(`UniProt: ${name} (MW: ${Math.round(mass)} Da)`);
          } else {
            toast.error('No sequence data found in UniProt.');
          }
        } else {
          toast.error('No UniProt match found.');
        }
      } else {
        toast.error('Failed to contact UniProt API.');
      }
    } catch {
      toast.error('Error looking up UniProt database.');
    } finally {
      setFetchingMw(false);
    }
  };

  const handleCalculateSequenceMw = () => {
    const clean = searchQuery.replace(/\s+/g, '').toUpperCase();
    let mass = 18.0106;
    for (const aa of clean) {
      mass += RESIDUE_MASS[aa] || 0;
    }
    setMw(mass.toFixed(2));
    toast.success(`Calculated from sequence: ${mass.toFixed(2)} Da`);
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
          why="Convert Mass Concentrations (Mg/ML, Mcg/ML, Ng/ML) To Molar Metrics (Mmol/L, Umol/L, Nmol/L). Automatic Library Integration Retrieves Exact Molecular Weights."
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 12 }}>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Value</div>
            <StyledInput type="number" step="any" value={value} onChange={(e) => setValue(e.target.value)} />
          </label>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>From Unit</div>
            <StyledSelect value={from} onChange={(e) => setFrom(e.target.value as ConcentrationUnit)}>
              {UNITS.map((u) => <option key={u} value={u} className="calc-no-capitalize">{u}</option>)}
            </StyledSelect>
          </label>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>To Unit</div>
            <StyledSelect value={to} onChange={(e) => setTo(e.target.value as ConcentrationUnit)}>
              {UNITS.map((u) => <option key={u} value={u} className="calc-no-capitalize">{u}</option>)}
            </StyledSelect>
          </label>
        </div>

        {mwRequired && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 12, position: 'relative' }}>
            <div style={{ position: 'relative' }}>
              <div style={labelStyle}>Search Database or Sequence</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <StyledInput 
                  type="text" 
                  value={searchQuery} 
                  placeholder="Peptide name or sequence..." 
                  onFocus={() => setShowDropdown(true)}
                  onChange={(e) => { setSearchQuery(e.target.value); setShowDropdown(true); }}
                  style={{ flex: 1 }}
                />
                {isRawSequence ? (
                  <button
                    type="button"
                    onClick={handleCalculateSequenceMw}
                    style={{ padding: '0 12px', background: '#00C4BC', color: '#000', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    Calc MW
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleUniProtLookup}
                    disabled={fetchingMw || !searchQuery}
                    style={{ padding: '0 12px', background: 'transparent', border: '1px solid #00E5FF', color: '#00E5FF', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    {fetchingMw ? '...' : 'UniProt'}
                  </button>
                )}
              </div>
              {showDropdown && filteredCompounds.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#121620', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, zIndex: 10, maxHeight: 200, overflowY: 'auto', marginTop: 4 }}>
                  {filteredCompounds.map((c) => (
                    <div 
                      key={c.slug} 
                      onClick={() => handleSelectCompound(c)}
                      className="calc-no-capitalize"
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
              <StyledInput type="number" step="any" value={mw} onChange={(e) => setMw(e.target.value)} placeholder="Enter Da Manually..." />
            </label>
          </div>
        )}

        <div style={resultStyle}>
          {result === null
            ? 'Enter A Molecular Weight (Da) To Convert Between Mass And Molar Units.'
            : from === to
            ? <>Same Unit Selected — No Conversion Needed: <strong className="calc-no-capitalize">{Number(value).toPrecision(6)}</strong> <span className="calc-no-capitalize">{to}</span></>
            : <>Converted: <strong className="calc-no-capitalize">{result.toPrecision(6)}</strong> <span className="calc-no-capitalize">{to}</span></>
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
          why="Model Temperature-Dependent Shelf Life. Activation Energy (Ea) Governs Degradation Rates; Select Preset Peptide Categories Or Customize Ea."
        />
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <button 
            onClick={() => { setTFrom('-20'); setTTo('4'); }} 
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #00E5FF', background: 'transparent', color: '#00E5FF', cursor: 'pointer', fontSize: 13 }}
          >
            Preset: Freezer To Fridge
          </button>
          <button 
            onClick={() => { setTFrom('4'); setTTo('25'); }} 
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #F6AD55', background: 'transparent', color: '#F6AD55', cursor: 'pointer', fontSize: 13 }}
          >
            Preset: Fridge To Room Temp
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
              {DEGRADATION_PROFILES.map((p) => <option key={p.ea} value={p.ea} className="calc-no-capitalize">{p.name}</option>)}
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

  return (
    <section id="cost" style={chromeOuterStyle}>
      <div style={chromeInnerStyle}>
        <CalculatorHeader
          title="Study Budget & Economics Calculator"
          why="Determine Unit Dose Economics And Analyze Monthly/Annual Cohort Expenditures. Compare Vendor Pricing Tiers Side-By-Side."
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
                <div style={labelStyle}>Vial Mass (Mg)</div>
                <StyledInput type="number" step="any" value={massA} onChange={(e) => setMassA(e.target.value)} />
              </label>
              <label style={{ display: "block" }}>
                <div style={labelStyle}>Per-Dose Amount (Mcg)</div>
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
                  <div style={labelStyle}>Vial Mass (Mg)</div>
                  <StyledInput type="number" step="any" value={massB} onChange={(e) => setMassB(e.target.value)} />
                </label>
                <label style={{ display: "block" }}>
                  <div style={labelStyle}>Per-Dose Amount (Mcg)</div>
                  <StyledInput type="number" step="any" value={doseB} onChange={(e) => setDoseB(e.target.value)} />
                </label>
              </div>
            </div>
          )}
        </div>

        <div style={{ marginTop: 16 }}>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Dosing Frequency (Doses Per Week)</div>
            <StyledSelect value={frequency} onChange={(e) => setFrequency(e.target.value)}>
              <option value="7">Daily (7x / Week)</option>
              <option value="2">Twice Weekly (2x / Week)</option>
              <option value="1">Weekly (1x / Week)</option>
              <option value="0.5">Bi-Weekly (0.5x / Week)</option>
            </StyledSelect>
          </label>
        </div>

        {!comparisonMode ? (
          <div style={resultStyle}>
            {!outA
              ? 'Enter Valid Inputs.'
              : <>
                  <div>Doses Per Vial: <strong className="calc-no-capitalize">{outA.dosesPerVial.toFixed(1)}</strong>{'  '}|{'  '}Cost Per Dose: <strong className="calc-no-capitalize">${outA.dollarsPerDose.toFixed(2)}</strong></div>
                  {daysPerVialA !== null && daysPerVialA > 0 && (
                    <div style={{ marginTop: 8, color: '#00E5FF' }}>Vial Lasts Approximately: <strong className="calc-no-capitalize">{daysPerVialA.toFixed(1)} Days</strong></div>
                  )}
                  {outA.monthlyCostUsd && (
                    <div style={{ marginTop: 8, fontSize: 13, color: '#A8B4C0' }}>
                      Est. Monthly Cost: <strong className="calc-no-capitalize">${outA.monthlyCostUsd.toFixed(2)}</strong> | Annual Cost: <strong className="calc-no-capitalize">${outA.annualCostUsd?.toFixed(2)}</strong>
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
                    <div>Cost/Dose: <strong className="calc-no-capitalize">${outA.dollarsPerDose.toFixed(2)}</strong></div>
                    <div>Doses/Vial: <strong className="calc-no-capitalize">{outA.dosesPerVial.toFixed(1)}</strong></div>
                    <div>Monthly: <strong className="calc-no-capitalize">${outA.monthlyCostUsd?.toFixed(2)}</strong></div>
                    <div>Annual: <strong className="calc-no-capitalize">${outA.annualCostUsd?.toFixed(2)}</strong></div>
                  </div>
                ) : 'Invalid Inputs'}
              </div>
              
              {/* Option B Result */}
              <div style={{ ...resultStyle, margin: 0, borderColor: 'rgba(246,173,85,0.4)', background: 'rgba(246,173,85,0.01)' }}>
                <div style={{ color: '#F6AD55', fontWeight: 'bold', fontSize: 13, marginBottom: 8 }}>OPTION B RESULTS</div>
                {outB ? (
                  <div style={{ fontSize: 13, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div>Cost/Dose: <strong className="calc-no-capitalize">${outB.dollarsPerDose.toFixed(2)}</strong></div>
                    <div>Doses/Vial: <strong className="calc-no-capitalize">{outB.dosesPerVial.toFixed(1)}</strong></div>
                    <div>Monthly: <strong className="calc-no-capitalize">${outB.monthlyCostUsd?.toFixed(2)}</strong></div>
                    <div>Annual: <strong className="calc-no-capitalize">${outB.annualCostUsd?.toFixed(2)}</strong></div>
                  </div>
                ) : 'Invalid Inputs'}
              </div>
            </div>

            {outA && outB && outA.dollarsPerDose > 0 && outB.dollarsPerDose > 0 && (
              <div style={{ ...resultStyle, background: 'rgba(104,211,145,0.05)', border: '1px solid #68D391', color: '#E2E8F0', fontSize: 14 }}>
                {outA.dollarsPerDose < outB.dollarsPerDose ? (
                  <span>
                    Success: <strong>Option A</strong> Is More Cost-Effective. It Saves You <strong style={{ color: '#68D391' }} className="calc-no-capitalize">${(outB.dollarsPerDose - outA.dollarsPerDose).toFixed(2)}</strong> Per Dose (<strong style={{ color: '#68D391' }} className="calc-no-capitalize">{((1 - outA.dollarsPerDose / outB.dollarsPerDose) * 100).toFixed(1)}%</strong> Savings).
                  </span>
                ) : outB.dollarsPerDose < outA.dollarsPerDose ? (
                  <span>
                    Success: <strong>Option B</strong> Is More Cost-Effective. It Saves You <strong style={{ color: '#68D391' }} className="calc-no-capitalize">${(outA.dollarsPerDose - outB.dollarsPerDose).toFixed(2)}</strong> Per Dose (<strong style={{ color: '#68D391' }} className="calc-no-capitalize">{((1 - outB.dollarsPerDose / outA.dollarsPerDose) * 100).toFixed(1)}%</strong> Savings).
                  </span>
                ) : (
                  <span>Both Options Yield Identical Cost-Per-Dose Metrics.</span>
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
  const [pipetteTip, setPipetteTip] = useState<'standard' | 'low-retention'>('standard');
  const [viscosity, setViscosity] = useState<'aqueous' | 'glycerol' | 'viscous'>('aqueous');

  const out = vialPooling({
    vialMassMg: Number(mass),
    vialCount: Math.max(1, Math.floor(Number(count) || 1)),
    totalDiluentMl: Number(diluent),
    transferLossPct: loss !== '' ? Number(loss) : undefined,
    pipetteTipType: pipetteTip,
    viscosityModifier: viscosity,
  });

  return (
    <section id="pooling" style={chromeOuterStyle}>
      <div style={chromeInnerStyle}>
        <CalculatorHeader
          title="Vial Pooling & Solubility Estimator"
          why="Aggregate Multiple Vial Masses Into A Single Working Concentration. Integrates Physical Solubility Safeguards To Warn Against Precipitation."
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 12 }}>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Per-Vial Mass (Mg)</div>
            <StyledInput type="number" step="any" value={mass} onChange={(e) => setMass(e.target.value)} />
          </label>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Vial Count</div>
            <StyledInput type="number" min={1} step={1} value={count} onChange={(e) => setCount(e.target.value)} />
          </label>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Total Diluent (ML)</div>
            <StyledInput type="number" step="any" value={diluent} onChange={(e) => setDiluent(e.target.value)} />
          </label>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Pipette Tip Type</div>
            <StyledSelect value={pipetteTip} onChange={(e) => setPipetteTip(e.target.value as any)}>
              <option value="standard">Standard Tips (+2.0% loss)</option>
              <option value="low-retention">Low-Retention (+0.5% loss)</option>
            </StyledSelect>
          </label>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Fluid Viscosity</div>
            <StyledSelect value={viscosity} onChange={(e) => setViscosity(e.target.value as any)}>
              <option value="aqueous">Aqueous (0.0% loss)</option>
              <option value="glycerol">Glycerol Carrier (+3.0% loss)</option>
              <option value="viscous">Viscous/Gelatin (+6.0% loss)</option>
            </StyledSelect>
          </label>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Custom Loss Overrides (%)</div>
            <StyledInput type="number" step="any" min="0" max="100" value={loss} placeholder="Override calculated" onChange={(e) => setLoss(e.target.value)} />
          </label>
        </div>

        {out && out.concentrationMgPerMl > 50 && (
          <div style={{ color: '#F6AD55', fontSize: 13, padding: '8px 12px', border: '1px solid rgba(246,173,85,0.3)', borderRadius: 6, background: 'rgba(246,173,85,0.05)', marginBottom: 12 }}>
            Aqueous Precipitation Risk: Calculated Concentration Is <strong className="calc-no-capitalize">{out.concentrationMgPerMl.toFixed(1)} mg/mL</strong>. Concentrations Exceeding <span className="calc-no-capitalize">50 mg/mL</span> Are Highly Prone To Peptide Aggregation Or Gelation In Standard Aqueous Buffers.
          </div>
        )}

        {out && (
          <div style={{ margin: '12px 0', padding: 12, borderRadius: 8, background: 'rgba(0, 229, 255, 0.03)', border: '1px solid rgba(0, 229, 255, 0.12)', fontSize: 13, color: '#A8B2C1' }}>
            <strong style={{ color: '#00E5FF', display: 'block', marginBottom: 4 }}>Pipetting Optimization Advice</strong>
            {out.recommendation}
          </div>
        )}

        <div style={resultStyle}>
          {!out
            ? 'Enter Valid Inputs.'
            : <>Total Mass: <strong className="calc-no-capitalize">{out.totalMassMg.toFixed(2)} mg</strong>{'  '}|{'  '}Concentration: <strong className="calc-no-capitalize">{out.concentrationMgPerMl.toFixed(3)} mg/mL</strong>{'  '}|{'  '}Loss: <strong className="calc-no-capitalize">{out.calculatedLossPct.toFixed(1)}%</strong></>
          }
        </div>

        {out && (
          <SaveToJournalButton
            title="Vial Pooling Recipe"
            noteText={`Vials Pooled: ${count}
Mass Per Vial: ${mass} mg
Diluent Added: ${diluent} mL
Pipette Tip Type: ${pipetteTip}
Viscosity Modifier: ${viscosity}
Calculated Transfer Loss: ${out.calculatedLossPct.toFixed(1)}%
Total Pooled Mass: ${out.totalMassMg.toFixed(2)} mg
Final Pooled Concentration: ${out.concentrationMgPerMl.toFixed(3)} mg/mL
Advice: ${out.recommendation}`}
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
  const [hoveredPoint, setHoveredPoint] = useState<{ time: number; val: number } | null>(null);

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

  const points = useMemo(() => {
    if (rt === null || Number(gradient) <= 0 || rt > Number(gradient)) return [];
    const pts = [];
    const maxTime = Number(gradient) || 20;
    const peakTime = rt;
    const sigma = 0.15; // peak standard deviation width
    const height = 120; // max peak height in mAU
    
    // Generate 300 points for a smooth Gaussian curve
    for (let i = 0; i <= 300; i++) {
      const t = (i / 300) * maxTime;
      // Baseline drift representing RP gradient
      const drift = 5 + (t / maxTime) * 6; 
      // Micro noise for chromatogram authenticity
      const noise = Math.sin(t * 12) * 0.2 + (Math.sin(t * 89) * 0.15);
      // Gaussian Peak
      const peak = height * Math.exp(-Math.pow(t - peakTime, 2) / (2 * Math.pow(sigma, 2)));
      
      pts.push({ time: t, val: drift + noise + peak });
    }
    return pts;
  }, [rt, gradient]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (points.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - 50; // padding left
    const plotWidth = rect.width - 70; // padding left + right
    const maxTime = Number(gradient) || 20;
    const mouseTime = (mouseX / plotWidth) * maxTime;
    
    let closest = points[0];
    let minDiff = Math.abs(points[0].time - mouseTime);
    for (const p of points) {
      const diff = Math.abs(p.time - mouseTime);
      if (diff < minDiff) {
        minDiff = diff;
        closest = p;
      }
    }
    if (closest.time >= 0 && closest.time <= maxTime) {
      setHoveredPoint(closest);
    }
  };

  const handlePrintReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Pop-up blocker prevented printing HPLC report.');
      return;
    }
    
    const maxTime = Number(gradient) || 20;
    const svgWidth = 600;
    const svgHeight = 200;
    const paddingLeft = 50;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 40;
    const plotWidth = svgWidth - paddingLeft - paddingRight;
    const plotHeight = svgHeight - paddingTop - paddingBottom;
    const pathD = points.map((p, i) => {
      const px = paddingLeft + (p.time / maxTime) * plotWidth;
      const py = svgHeight - paddingBottom - (p.val / 150) * plotHeight;
      return `${i === 0 ? 'M' : 'L'} ${px} ${py}`;
    }).join(' ');

    printWindow.document.write(`
      <html>
        <head>
          <title>Analytical HPLC Quality Control Report</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111827; padding: 40px; max-width: 700px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 2px solid #00C4BC; padding-bottom: 12px; margin-bottom: 24px; }
            h1 { font-size: 22px; color: #047857; margin: 0; text-transform: uppercase; }
            .subtitle { font-size: 12px; color: #6B7280; letter-spacing: 0.05em; margin-top: 4px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
            .card { background: #F9FAFB; border: 1px solid #E5E7EB; padding: 16px; border-radius: 8px; font-size: 14px; }
            .section-title { font-weight: bold; font-size: 13px; color: #374151; margin-bottom: 8px; border-bottom: 1px solid #E5E7EB; padding-bottom: 4px; text-transform: uppercase; }
            .item { display: flex; justify-content: space-between; margin: 6px 0; }
            .label { color: #6B7280; }
            .value { font-weight: 600; font-family: monospace; }
            .chart-container { border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px; background: #FFFFFF; margin-bottom: 24px; text-align: center; }
            .disclaimer { font-size: 10px; color: #9CA3AF; text-align: center; font-style: italic; border-top: 1px dashed #E5E7EB; paddingTop: 16px; margin-top: 30px; }
            .signature-block { display: flex; justify-content: space-between; margin-top: 40px; font-size: 12px; }
            .sig-line { border-top: 1px solid #9CA3AF; width: 180px; text-align: center; padding-top: 4px; color: #6B7280; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>HPLC Analytical Assessment Report</h1>
            <div class="subtitle">PREDICTIVE CHROMATOGRAM FOR FRACTION VERIFICATION</div>
          </div>
          
          <div class="grid">
            <div class="card">
              <div class="section-title">Compound Details</div>
              <div class="item"><span class="label">Sequence Length:</span><span class="value">${cleanSeq.length} Residues</span></div>
              <div class="item"><span class="label">Amino Acid Sequence:</span><span class="value" style="word-break: break-all;">${cleanSeq}</span></div>
            </div>
            <div class="card">
              <div class="section-title">HPLC Parameters</div>
              <div class="item"><span class="label">Column Type:</span><span class="value">${columnType} Phase</span></div>
              <div class="item"><span class="label">Acid Modifier:</span><span class="value">0.1% ${modifier}</span></div>
              <div class="item"><span class="label">Gradient Run:</span><span class="value">${start}% to ${end}% B (${gradient} Min)</span></div>
              <div class="item"><span class="label">Predicted RT:</span><span class="value">${rt !== null ? rt.toFixed(2) : 'N/A'} Min</span></div>
            </div>
          </div>

          <div class="chart-container">
            <div style="font-weight: bold; font-size: 12px; margin-bottom: 10px; color: #374151;">Chromatogram Peak Plot</div>
            <svg width="600" height="200">
              <!-- grid lines -->
              <line x1="50" y1="20" x2="50" y2="160" stroke="#E5E7EB" stroke-width="1" />
              <line x1="50" y1="160" x2="580" y2="160" stroke="#374151" stroke-width="2" />
              <!-- plot path -->
              <path d="${pathD}" fill="none" stroke="#00C4BC" stroke-width="2.5" />
              <!-- peak indicator -->
              ${rt !== null ? `
                <line x1="${paddingLeft + (rt / maxTime) * plotWidth}" y1="${paddingTop}" x2="${paddingLeft + (rt / maxTime) * plotWidth}" y2="160" stroke="#F59E0B" stroke-width="1.5" stroke-dasharray="3,3" />
                <text x="${paddingLeft + (rt / maxTime) * plotWidth}" y="15" fill="#B45309" font-size="10" font-family="monospace" text-anchor="middle">RT = ${rt.toFixed(2)} min</text>
              ` : ''}
              <text x="315" y="190" fill="#6B7280" font-size="10" font-family="sans-serif" text-anchor="middle">Retention Time (Minutes)</text>
              <text x="15" y="90" fill="#6B7280" font-size="10" font-family="sans-serif" text-anchor="middle" transform="rotate(-90 15 90)">UV Absorbance (mAU)</text>
            </svg>
          </div>

          <div class="signature-block">
            <div>
              <div class="sig-line" style="margin-top: 30px;">Date Analyzed</div>
            </div>
            <div>
              <div class="sig-line" style="margin-top: 30px;">QC Officer Signature</div>
            </div>
          </div>

          <div class="disclaimer">
            ${RESEARCH_NOTE}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <section id="hplc-rt" style={chromeOuterStyle}>
      <div style={chromeInnerStyle}>
        <CalculatorHeader
          title="HPLC Retention Time Predictor"
          why="Predict Peptide Elution Retention Profiles Under Reverse-Phase (C18, C8, C4) Or Normal-Phase (HILIC) Columns Using Bull-Breese Residue Hydrophobicity Indices."
        />
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <button 
            onClick={() => { setStart('5'); setEnd('65'); setGradient('20'); setShowAdvanced(true); }} 
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #00E5FF', background: 'transparent', color: '#00E5FF', cursor: 'pointer', fontSize: 13 }}
          >
            Preset: Standard 20 Min (5% - 65% B)
          </button>
          <button 
            onClick={() => { setStart('10'); setEnd('90'); setGradient('30'); setShowAdvanced(true); }} 
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #F6AD55', background: 'transparent', color: '#F6AD55', cursor: 'pointer', fontSize: 13 }}
          >
            Preset: Long 30 Min (10% - 90% B)
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 12 }}>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>One-Letter Sequence (Standard 20 AA Codes)</div>
            <StyledInput type="text" value={seq} maxLength={500} onChange={(e) => setSeq(e.target.value)} placeholder="E.g. PLG" className="calc-no-capitalize" />
            {unknownChars.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 12, color: '#F6AD55', background: 'rgba(246,173,85,0.10)', border: '1px solid rgba(246,173,85,0.30)', borderRadius: 6, padding: '5px 10px' }}>
                Warning: Non-Standard Characters Detected: <strong className="calc-no-capitalize">{unknownChars.join(', ')}</strong>. Standard Codes: A C D E F G H I K L M N P Q R S T V W Y.
              </div>
            )}
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>HPLC Column Phase</div>
            <StyledSelect value={columnType} onChange={(e) => setColumnType(e.target.value as 'C18' | 'C8' | 'C4' | 'HILIC')}>
              <option value="C18" className="calc-no-capitalize">C18 Octadecylsilane (Standard RP)</option>
              <option value="C8" className="calc-no-capitalize">C8 Octylsilane (Moderate RP)</option>
              <option value="C4" className="calc-no-capitalize">C4 Butylsilane (Fragile / Large RP)</option>
              <option value="HILIC" className="calc-no-capitalize">HILIC Hydrophilic Interaction (Normal Phase)</option>
            </StyledSelect>
          </label>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Acid Modifier</div>
            <StyledSelect value={modifier} onChange={(e) => setModifier(e.target.value as 'TFA' | 'FA')}>
              <option value="TFA" className="calc-no-capitalize">0.1% Trifluoroacetic Acid (Strong Ion-Pairing)</option>
              <option value="FA" className="calc-no-capitalize">0.1% Formic Acid (Weaker Ion-Pairing, MS Friendly)</option>
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

        {points.length > 0 && rt !== null && (
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 16, background: 'rgba(0,0,0,0.3)', padding: 20, borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 11, color: '#A8B4C0', textTransform: 'uppercase', letterSpacing: '0.1em' }}>UV Absorbance Chromatogram (mAU)</span>
              <span style={{ fontSize: 11, color: '#00E5FF', fontFamily: 'monospace' }} className="calc-no-capitalize">
                {hoveredPoint ? `Time: ${hoveredPoint.time.toFixed(2)} min | UV: ${hoveredPoint.val.toFixed(1)} mAU` : `Peak RT: ${rt.toFixed(2)} min`}
              </span>
            </div>
            <div style={{ height: 160, position: 'relative' }}>
              <svg 
                width="100%" 
                height="100%" 
                viewBox="0 0 600 160" 
                preserveAspectRatio="none"
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHoveredPoint(null)}
                style={{ overflow: 'visible' }}
              >
                {/* Grid Lines */}
                <line x1="50" y1="10" x2="50" y2="130" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                <line x1="50" y1="130" x2="580" y2="130" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" />
                
                {/* Draw points path */}
                <path 
                  d={points.map((p, i) => {
                    const px = 50 + (p.time / (Number(gradient) || 20)) * 530;
                    const py = 130 - (p.val / 150) * 110;
                    return `${i === 0 ? 'M' : 'L'} ${px} ${py}`;
                  }).join(' ')} 
                  fill="none" 
                  stroke="#00E5FF" 
                  strokeWidth="2"
                />

                {/* Peak marker */}
                <line 
                  x1={50 + (rt / (Number(gradient) || 20)) * 530} 
                  y1="10" 
                  x2={50 + (rt / (Number(gradient) || 20)) * 530} 
                  y2="130" 
                  stroke="#68D391" 
                  strokeWidth="1" 
                  strokeDasharray="4,4" 
                />
                
                {/* Hover Line Indicator */}
                {hoveredPoint && (
                  <>
                    <line 
                      x1={50 + (hoveredPoint.time / (Number(gradient) || 20)) * 530} 
                      y1="10" 
                      x2={50 + (hoveredPoint.time / (Number(gradient) || 20)) * 530} 
                      y2="130" 
                      stroke="rgba(255, 255, 255, 0.4)" 
                      strokeWidth="1" 
                    />
                    <circle 
                      cx={50 + (hoveredPoint.time / (Number(gradient) || 20)) * 530} 
                      cy={130 - (hoveredPoint.val / 150) * 110} 
                      r="4" 
                      fill="#FFFFFF" 
                    />
                  </>
                )}
              </svg>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#A8B4C0', fontFamily: 'monospace', paddingLeft: 40, marginTop: 8 }}>
              <span>0 min</span>
              <span>{(Number(gradient) || 20) / 2} min</span>
              <span>{Number(gradient) || 20} min</span>
            </div>
          </div>
        )}

        <div style={resultStyle}>
          {gradientInvalid
            ? 'Gradient Length Must Be Greater Than 0 Minutes.'
            : rt === null
            ? Number(end) <= Number(start)
              ? 'Gradient End Must Be Greater Than Gradient Start.'
              : 'Enter A Valid One-Letter Sequence.'
            : <>
                Predicted Retention Time: <strong className="calc-no-capitalize">{rt.toFixed(2)} Min</strong> (<span className="calc-no-capitalize">{columnType}, 0.1% {modifier}</span>)
              </>
          }
        </div>

        {rt !== null && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
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
            <button
              type="button"
              onClick={handlePrintReport}
              style={{
                background: 'transparent',
                border: '1px solid #00E5FF',
                color: '#00E5FF',
                padding: '8px 16px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                marginTop: 12,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0, 229, 255, 0.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              Print Analytical Report
            </button>
          </div>
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
  const [hoveredPeak, setHoveredPeak] = useState<any | null>(null);

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

  const minMz = useMemo(() => {
    if (chartPeaks.length === 0) return 0;
    return Math.max(0, Math.floor(chartPeaks[0].mz - 100));
  }, [chartPeaks]);

  const maxMz = useMemo(() => {
    if (chartPeaks.length === 0) return 1000;
    return Math.ceil(chartPeaks[chartPeaks.length - 1].mz + 100);
  }, [chartPeaks]);

  const handlePrintMSReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Pop-up blocker prevented printing Mass Spec report.');
      return;
    }

    const svgWidth = 600;
    const svgHeight = 220;
    const paddingLeft = 60;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 45;
    const plotWidth = svgWidth - paddingLeft - paddingRight;
    const plotHeight = svgHeight - paddingTop - paddingBottom;

    const stickElements = chartPeaks.map((p) => {
      const x = paddingLeft + ((p.mz - minMz) / (maxMz - minMz || 1)) * plotWidth;
      const y = svgHeight - paddingBottom - (p.intensity / maxIntensity) * plotHeight;
      const isBase = p.charge === basePeakCharge;
      const strokeColor = isBase ? '#047857' : '#0284C7';
      
      return `
        <line x1="${x}" y1="${svgHeight - paddingBottom}" x2="${x}" y2="${y}" stroke="${strokeColor}" stroke-width="3" />
        <circle cx="${x}" cy="${y}" r="4" fill="${strokeColor}" />
        <text x="${x}" y="${y - 8}" fill="${strokeColor}" font-size="9" font-family="monospace" text-anchor="middle" font-weight="bold">
          ${isBase ? 'BASE' : `z=${p.charge}`}
        </text>
        <text x="${x}" y="${svgHeight - paddingBottom + 15}" fill="#374151" font-size="9" font-family="monospace" text-anchor="middle">
          ${p.mz.toFixed(1)}
        </text>
      `;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Mass Spectrometry Analytical Report</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111827; padding: 40px; max-width: 700px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 2px solid #00C4BC; padding-bottom: 12px; margin-bottom: 24px; }
            h1 { font-size: 22px; color: #047857; margin: 0; text-transform: uppercase; }
            .subtitle { font-size: 12px; color: #6B7280; letter-spacing: 0.05em; margin-top: 4px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
            .card { background: #F9FAFB; border: 1px solid #E5E7EB; padding: 16px; border-radius: 8px; font-size: 14px; }
            .section-title { font-weight: bold; font-size: 13px; color: #374151; margin-bottom: 8px; border-bottom: 1px solid #E5E7EB; padding-bottom: 4px; text-transform: uppercase; }
            .item { display: flex; justify-content: space-between; margin: 6px 0; }
            .label { color: #6B7280; }
            .value { font-weight: 600; font-family: monospace; }
            .chart-container { border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px; background: #FFFFFF; margin-bottom: 24px; text-align: center; }
            .peaks-table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
            .peaks-table th { border-bottom: 2px solid #E5E7EB; padding: 6px; text-align: left; color: #6B7280; }
            .peaks-table td { border-bottom: 1px solid #F3F4F6; padding: 6px; }
            .disclaimer { font-size: 10px; color: #9CA3AF; text-align: center; font-style: italic; border-top: 1px dashed #E5E7EB; paddingTop: 16px; margin-top: 30px; }
            .signature-block { display: flex; justify-content: space-between; margin-top: 40px; font-size: 12px; }
            .sig-line { border-top: 1px solid #9CA3AF; width: 180px; text-align: center; padding-top: 4px; color: #6B7280; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Mass Spectrometry Assessment Report</h1>
            <div class="subtitle">THEORETICAL CHARGE STATE PEAK VERIFICATION</div>
          </div>
          
          <div class="grid">
            <div class="card">
              <div class="section-title">Sequence Specs</div>
              <div class="item"><span class="label">Amino Acid Sequence:</span><span class="value" style="word-break: break-all;">${cleanSeq}</span></div>
              <div class="item"><span class="label">Sequence Length:</span><span class="value">${cleanSeq.length} AA</span></div>
            </div>
            <div class="card">
              <div class="section-title">MS Settings</div>
              <div class="item"><span class="label">Ionization Mode:</span><span class="value">${mode === 'positive' ? 'ESI+' : 'ESI-'}</span></div>
              <div class="item"><span class="label">Adduct Type:</span><span class="value">${mode === 'positive' ? (adduct === '1.00728' ? '+H (Proton)' : adduct === '22.98977' ? '+Na' : '+K') : '-H'}</span></div>
              <div class="item"><span class="label">Base Peak m/z:</span><span class="value">${chartPeaks.length > 0 ? chartPeaks.find(p => p.charge === basePeakCharge)?.mz.toFixed(2) : 'N/A'}</span></div>
            </div>
          </div>

          <div class="chart-container">
            <div style="font-weight: bold; font-size: 12px; margin-bottom: 10px; color: #374151;">Electrospray Ionization (ESI) Stick Spectrum</div>
            <svg width="600" height="220">
              <line x1="${paddingLeft}" y1="20" x2="${paddingLeft}" y2="${svgHeight - paddingBottom}" stroke="#E5E7EB" stroke-width="1" />
              <line x1="${paddingLeft}" y1="${svgHeight - paddingBottom}" x2="580" y2="${svgHeight - paddingBottom}" stroke="#374151" stroke-width="2" />
              
              <!-- ticks and labels -->
              <text x="320" y="210" fill="#6B7280" font-size="10" font-family="sans-serif" text-anchor="middle">Mass-to-Charge Ratio (m/z)</text>
              <text x="15" y="100" fill="#6B7280" font-size="10" font-family="sans-serif" text-anchor="middle" transform="rotate(-90 15 100)">Relative Abundance (%)</text>
              
              ${stickElements}
            </svg>
          </div>

          <div class="card">
            <div class="section-title">Theoretical Peak List</div>
            <table class="peaks-table">
              <thead>
                <tr>
                  <th>Charge State</th>
                  <th>m/z Ratio</th>
                  <th>Relative Abundance</th>
                </tr>
              </thead>
              <tbody>
                ${chartPeaks.map(p => `
                  <tr style="${p.charge === basePeakCharge ? 'background: #ECFDF5; font-weight: bold;' : ''}">
                    <td>${mode === 'negative' ? `-${p.charge}` : `+${p.charge}`}</td>
                    <td>${p.mz.toFixed(4)}</td>
                    <td>${(p.intensity * 100).toFixed(0)}%</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="signature-block">
            <div>
              <div class="sig-line" style="margin-top: 30px;">QC Date</div>
            </div>
            <div>
              <div class="sig-line" style="margin-top: 30px;">Analyst Signature</div>
            </div>
          </div>

          <div class="disclaimer">
            ${RESEARCH_NOTE}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <section id="mass-spec" style={chromeOuterStyle}>
      <div style={chromeInnerStyle}>
        <CalculatorHeader
          title="Mass Spec m/z & Stick Plot Predictor"
          why="Generate Theoretical Charge State Isotope Profiles ([M+nH]^n+) For HPLC Fraction Verification. The Interactive Spectrum Plots Simulated Mass Spectrum Readouts."
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 12 }}>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>One-Letter Sequence (Standard 20 AA Codes)</div>
            <StyledInput type="text" value={seq} maxLength={500} onChange={(e) => setSeq(e.target.value)} placeholder="E.g. GLP-1 Sequence..." className="calc-no-capitalize" />
            {unknownChars.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 12, color: '#F6AD55', background: 'rgba(246,173,85,0.10)', border: '1px solid rgba(246,173,85,0.30)', borderRadius: 6, padding: '5px 10px' }}>
                Warning: Non-Standard Characters Detected: <strong className="calc-no-capitalize">{unknownChars.join(', ')}</strong>. Residues Estimated At ~110 Da Average. Standard Codes Only: A C D E F G H I K L M N P Q R S T V W Y.
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
                <option value="1.00728" className="calc-no-capitalize">+H (Proton, 1.007 Da)</option>
                <option value="22.98977" className="calc-no-capitalize">+Na (Sodium, 22.990 Da)</option>
                <option value="38.96371" className="calc-no-capitalize">+K (Potassium, 38.964 Da)</option>
              </StyledSelect>
            </label>
          )}
        </div>}

        {chartPeaks.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 16, background: 'rgba(0,0,0,0.3)', padding: 20, borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 11, color: '#A8B4C0', textTransform: 'uppercase', letterSpacing: '0.1em' }}>ESI-MS Stick Plot Spectrum</span>
              <span style={{ fontSize: 11, color: '#00E5FF', fontFamily: 'monospace' }} className="calc-no-capitalize">
                {hoveredPeak ? `m/z: ${hoveredPeak.mz.toFixed(2)} | Abundance: ${(hoveredPeak.intensity * 100).toFixed(0)}%` : `Base Peak z=${basePeakCharge}`}
              </span>
            </div>
            <div style={{ height: 165, position: 'relative' }}>
              <svg 
                width="100%" 
                height="100%" 
                viewBox="0 0 600 165" 
                preserveAspectRatio="none"
                style={{ overflow: 'visible' }}
              >
                {/* Grid Lines */}
                <line x1="50" y1="10" x2="50" y2="135" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                <line x1="50" y1="135" x2="580" y2="135" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" />
                
                {chartPeaks.map((p, idx) => {
                  const x = 50 + ((p.mz - minMz) / (maxMz - minMz || 1)) * 530;
                  const y = 135 - (p.intensity / maxIntensity) * 110;
                  const isBase = p.charge === basePeakCharge;
                  
                  return (
                    <g 
                      key={idx}
                      onMouseEnter={() => setHoveredPeak(p)}
                      onMouseLeave={() => setHoveredPeak(null)}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Interactive wider hit box */}
                      <line 
                        x1={x} 
                        y1="10" 
                        x2={x} 
                        y2="135" 
                        stroke="transparent" 
                        strokeWidth="16" 
                      />
                      
                      {/* MS Peak Line */}
                      <line 
                        x1={x} 
                        y1="135" 
                        x2={x} 
                        y2={y} 
                        stroke={isBase ? '#68D391' : '#00E5FF'} 
                        strokeWidth={hoveredPeak?.charge === p.charge ? '5' : '3'} 
                        style={{ transition: 'stroke-width 0.1s' }}
                      />
                      
                      {/* Dot at top of stick */}
                      <circle 
                        cx={x} 
                        cy={y} 
                        r={hoveredPeak?.charge === p.charge ? '5' : '3.5'} 
                        fill={isBase ? '#68D391' : '#00E5FF'} 
                        style={{ transition: 'r 0.1s' }}
                      />

                      {/* Charge label */}
                      <text 
                        x={x} 
                        y={y - 8} 
                        fill={isBase ? '#68D391' : '#A8B4C0'} 
                        fontSize="9" 
                        fontFamily="monospace" 
                        textAnchor="middle"
                        fontWeight={isBase ? 'bold' : 'normal'}
                      >
                        {isBase ? 'BASE' : `z=${p.charge}`}
                      </text>

                      {/* m/z label under axis */}
                      <text 
                        x={x} 
                        y="150" 
                        fill="#A8B4C0" 
                        fontSize="9" 
                        fontFamily="monospace" 
                        textAnchor="middle"
                      >
                        {p.mz.toFixed(0)}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#A8B4C0', fontFamily: 'monospace', paddingLeft: 40, marginTop: 8 }}>
              <span>{minMz} m/z</span>
              <span>{Math.round((minMz + maxMz) / 2)} m/z</span>
              <span>{maxMz} m/z</span>
            </div>
          </div>
        )}

        <div style={{ ...resultStyle, padding: 0, background: 'transparent', border: 'none' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, marginTop: 8 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <th style={{ textAlign: 'left', padding: 8, color: '#A8B4C0', fontSize: 12 }}>Charge State</th>
                <th style={{ textAlign: 'left', padding: 8, color: '#A8B4C0', fontSize: 12 }}><span className="calc-no-capitalize">m/z (Theoretical)</span></th>
                <th style={{ textAlign: 'left', padding: 8, color: '#A8B4C0', fontSize: 12 }}>Rel Intensity</th>
              </tr>
            </thead>
            <tbody>
              {peaks.map((p) => {
                const isBase = p.charge === basePeakCharge;
                return (
                  <tr key={p.charge} style={{ background: isBase ? 'rgba(104,211,145,0.06)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: 8, color: isBase ? '#68D391' : '#FFFFFF', fontWeight: isBase ? 800 : 'normal' }}>
                      <span className="calc-no-capitalize">{mode === 'negative' ? `-${p.charge}` : `+${p.charge}`}</span>
                      {isBase && <span style={{ marginLeft: 8, fontSize: 10, background: '#68D391', color: '#000', padding: '1px 4px', borderRadius: 4, fontWeight: 'bold' }}>BASE</span>}
                    </td>
                    <td style={{ padding: 8, color: isBase ? '#68D391' : '#A8B2C1', fontWeight: 600 }} className="calc-no-capitalize">{p.mz.toFixed(4)}</td>
                    <td style={{ padding: 8, color: isBase ? '#68D391' : '#D0DAE4' }} className="calc-no-capitalize">{(p.intensity * 100).toFixed(0)}%</td>
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
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
            <SaveToJournalButton
              title="Mass Spec m/z Prediction"
              noteText={`Sequence: ${seq}
Ionization Mode: ${mode}
Adduct Type: ${adduct}
Predicted Peaks (charge, m/z, relative intensity):
${peaks.map(p => `- Charge ${mode === 'negative' ? `-${p.charge}` : `+${p.charge}`}: m/z ${p.mz.toFixed(4)} (${(p.intensity * 100).toFixed(0)}% intensity)`).join('\n')}`}
            />
            <button
              type="button"
              onClick={handlePrintMSReport}
              style={{
                background: 'transparent',
                border: '1px solid #00E5FF',
                color: '#00E5FF',
                padding: '8px 16px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                marginTop: 12,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0, 229, 255, 0.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              Print Analytical Report
            </button>
          </div>
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
          why="Forecast Experimental Synthesis Costs For Custom Peptides. Adjust Scales, Coupling Reagents (HATU Vs DIC), Yields, And Resin Values."
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 12 }}>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>One-Letter Sequence</div>
            <StyledInput type="text" value={seq} maxLength={500} onChange={(e) => setSeq(e.target.value)} placeholder="E.g. FLG" className="calc-no-capitalize" />
            {sppsUnknownChars.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 12, color: '#F6AD55', background: 'rgba(246,173,85,0.10)', border: '1px solid rgba(246,173,85,0.30)', borderRadius: 6, padding: '5px 10px' }}>
                Warning: Non-Standard Characters: <strong className="calc-no-capitalize">{sppsUnknownChars.join(', ')}</strong>. Codes Ignored In Residue Yield Projections.
              </div>
            )}
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 12 }}>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Synthesis Scale (Umol)</div>
            <StyledInput type="number" step="any" value={scale} onChange={(e) => setScale(e.target.value)} />
          </label>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Coupling Chemistry Reagents</div>
            <StyledSelect value={chemistry} onChange={(e) => setChemistry(e.target.value as 'DIC/Oxyma' | 'HATU/DIEA' | 'HBTU/DIEA')}>
              <option value="DIC/Oxyma" className="calc-no-capitalize">DIC/Oxyma (Cost-Effective / Standard)</option>
              <option value="HATU/DIEA" className="calc-no-capitalize">HATU/DIEA (Premium / High Coupling Efficiency)</option>
              <option value="HBTU/DIEA" className="calc-no-capitalize">HBTU/DIEA (Moderate Standard)</option>
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
              <div>Total Synthesizer Cost: <strong className="calc-no-capitalize">${out.totalUsd.toFixed(2)}</strong></div>
              <div style={{ color: '#00E5FF', marginTop: 6, fontSize: 18 }}>
                Cost Per Recovered Mg: <strong className="calc-no-capitalize">${out.costPerRecoveredMg.toFixed(2)}</strong>
                <span style={{ display: 'block', fontSize: 12, color: '#A8B4C0', marginTop: 4, fontWeight: 'normal' }}>
                  Assuming ~<span className="calc-no-capitalize">{out.recoveredMg.toFixed(1)} mg</span> Final Pure Peptide Recovered.
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
                      <span className="calc-no-capitalize">{b.label}</span>
                    </span>
                    <span className="calc-no-capitalize">${b.costUsd.toFixed(2)}</span>
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
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Peptide Sequence (Optional)</div>
            <StyledInput type="text" value={seq} onChange={onSequenceChange} placeholder="E.g. FLGPLG" className="calc-no-capitalize" />
          </label>
        </div>

        <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} style={{ background: 'transparent', border: '1px solid rgba(168,178,193,0.3)', color: '#A8B2C1', padding: '6px 12px', borderRadius: 6, fontSize: 12, marginBottom: 12, cursor: 'pointer' }}>{showAdvanced ? 'Hide Parameter Details' : 'Configure Parameter Details'}</button>
        {showAdvanced && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 12 }}>
          <label style={{ display: "block" }}>
            <div style={labelStyle}><span className="calc-no-capitalize">GRAVY</span> Score</div>
            <StyledInput type="number" step="0.01" value={gravy} onChange={(e) => setGravy(e.target.value)} />
          </label>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Isoelectric Point (<span className="calc-no-capitalize">pI</span>)</div>
            <StyledInput type="number" step="0.01" value={pi} onChange={(e) => setPi(e.target.value)} placeholder="E.g. 6.0" />
          </label>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Sequence Length</div>
            <StyledInput type="number" step={1} min={1} value={len} onChange={(e) => setLen(e.target.value)} />
          </label>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Solution <span className="calc-no-capitalize">pH</span></div>
            <StyledInput type="number" step="0.1" value={pH} onChange={(e) => setPH(e.target.value)} />
          </label>
        </div>}

        {out?.warnings && out.warnings.length > 0 && (
          <div style={{ margin: '12px 0', fontSize: 13, color: '#F6AD55', background: 'rgba(246,173,85,0.1)', border: '1px solid rgba(246,173,85,0.3)', borderRadius: 8, padding: '10px 14px' }}>
            {out.warnings.map((w, idx) => (
              <div key={idx} style={{ marginBottom: 4 }} className="calc-no-capitalize">Warning: {w}</div>
            ))}
          </div>
        )}

        <div style={resultStyle}>
          {!out ? 'Enter Valid Inputs.' : (
            <>
              Predicted Solubility: <strong className="calc-no-capitalize">{out.predictedSolubilityMgMl.toFixed(3)} mg/mL</strong> (<span className="calc-no-capitalize">{out.classification.toUpperCase()}</span>)
              <div style={{ fontSize: 12, color: '#A8B4C0', marginTop: 6 }} className="calc-no-capitalize">{out.notes}</div>
            </>
          )}
        </div>

        {out?.bufferAdvice && (
          <div style={{ margin: '12px 0', padding: 12, borderRadius: 8, background: 'rgba(0, 229, 255, 0.03)', border: '1px solid rgba(0, 229, 255, 0.12)', fontSize: 13, color: '#A8B2C1' }}>
            <strong style={{ color: '#00E5FF', display: 'block', marginBottom: 4 }}>Solubility & Reconstitution Advice</strong>
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

function VialQuantitySection() {
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
          why="Synthesize Sample Cohorts And Schedule Studies. Dynamically Outputs Total Animal Cohort Mass Requirements And Coordinates Vial Quantities Needed Including Overage Bounds."
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
            <div style={labelStyle}>Doses Per Subject (Weekly)</div>
            <StyledSelect value={dosesPerSubjectPerWeek} onChange={(e) => setDosesPerSubjectPerWeek(e.target.value)}>
              <option value="7">Daily (7x / Week)</option>
              <option value="3">Three Times Weekly (3x / Week)</option>
              <option value="2">Twice Weekly (2x / Week)</option>
              <option value="1">Weekly (1x / Week)</option>
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
            <StyledInput type="number" step="0.001" value={mgPerDose} onChange={(e) => setMgPerDose(e.target.value)} placeholder="E.g. 0.250" />
          </label>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Mg Per Vial</div>
            <StyledInput type="number" step="0.01" value={mgPerVial} onChange={(e) => setMgPerVial(e.target.value)} placeholder="E.g. 5" />
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
                <strong style={{ fontSize: 16, color: '#FFF' }} className="calc-no-capitalize">{totalN}</strong>
              </div>
              <div style={{ padding: 8, background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
                <span style={{ display: 'block', color: '#A8B4C0', fontSize: 10 }}>DOSES PER SUBJECT</span>
                <strong style={{ fontSize: 16, color: '#FFF' }} className="calc-no-capitalize">{Math.round(Number(dosesPerSubjectPerWeek) * Number(studyDurationWeeks))}</strong>
              </div>
              <div style={{ padding: 8, background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
                <span style={{ display: 'block', color: '#A8B4C0', fontSize: 10 }}>STUDY WEEKS</span>
                <strong style={{ fontSize: 16, color: '#FFF' }} className="calc-no-capitalize">{studyDurationWeeks}</strong>
              </div>
            </div>
          </div>
        )}

        <div style={resultStyle}>
          {!out ? 'Enter Valid Inputs.' : (
            <>
              Vials Needed: <strong style={{ color: '#00E5FF', fontSize: 20 }} className="calc-no-capitalize">{out.vialsNeeded.toLocaleString()}</strong>{'  '}|{'  '}
              Per-Subject Mass: <strong className="calc-no-capitalize">{Number(out.perSubjectMg).toFixed(2)} mg</strong>{'  '}|{'  '}
              Total Mass: <strong className="calc-no-capitalize">{Number(out.totalMg).toFixed(2)} mg</strong>
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
    <div className="calc-container" style={{ display: 'flex', flexDirection: 'column' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .calc-container {
          text-transform: capitalize !important;
        }
        .calc-container input,
        .calc-container select,
        .calc-container option,
        .calc-container textarea,
        .calc-container code,
        .calc-container pre,
        .calc-no-capitalize,
        .calc-no-capitalize * {
          text-transform: none !important;
        }
        select option {
          background-color: #0b0e14 !important;
          color: #f3f4f6 !important;
        }
      ` }} />
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
