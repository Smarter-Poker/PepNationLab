'use client';

import { useMemo, useState } from 'react';
import { drawVolumeMl } from '@/lib/compounds';

/**
 * Lab Tools - Reconstitution & Dosing Math.
 *
 * Pure Client-Side Calculator (No Network, No Data). Helps A Researcher Work
 * Out How Much Bacteriostatic Water To Add To A Lyophilised Vial And How Much
 * To Draw For A Target Amount. For Research Calculation Purposes Only - Not
 * Medical Advice And Not Dosing Guidance For Use In Humans.
 *
 * All Math Delegates To The Canonical Helpers In @/lib/compounds So This
 * Widget Stays In Sync With The Rest Of The Platform Automatically.
 *
 * Math (U-100 Insulin Syringe Convention: 1 mL = 100 Units):
 *   Concentration (mg/mL)   = Vial_mg / Bac_mL
 *   Concentration (mcg/unit)= (Vial_mg * 10) / Bac_mL
 *   Draw Volume (mL)        = Target_mcg / (Vial_mg / Bac_mL * 1000)
 *   Draw (Units, U-100)     = Draw_volume_mL * 100
 *   Total Doses Per Vial    = (Vial_mg * 1000) / Target_mcg
 */

const round = (n: number, dp = 2) => {
  if (!Number.isFinite(n)) return 0;
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
};

/** Format A Dose Count With Commas; Show "<1" For Fractional Sub-Unit Results. */
function formatDoseCount(n: number): string {
  if (n <= 0) return '-';
  if (n < 1) return '<1';
  return Math.floor(n).toLocaleString();
}

/** Format Syringe Units; Show "<1 u" For Sub-Unit Draws Instead Of "0 u". */
function formatUnits(units: number): string {
  if (units <= 0) return '-';
  if (units < 0.1) return '<0.1 u';
  return `${round(units, 1)} u`;
}

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

function Field({
  label,
  value,
  onChange,
  suffix,
  step = '0.1',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suffix: string;
  step?: string;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontSize: '0.72rem', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
        {label}
      </span>
      <div style={{ position: 'relative' }}>
        <StyledInput
          type="number"
          inputMode="decimal"
          min="0"
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ paddingRight: 52, width: '100%' }}
        />
        <span 
          className="calc-no-capitalize"
          style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', fontSize: '0.78rem', color: '#9CA3AF', fontWeight: 600 }}
        >
          {suffix}
        </span>
      </div>
    </label>
  );
}

function Stat({ label, value, hero }: { label: string; value: string; hero?: boolean }) {
  return (
    <div
      style={{
        background: hero ? 'rgba(0,196,188,0.08)' : 'rgba(255, 255, 255, 0.02)',
        border: `1px solid ${hero ? 'rgba(0, 229, 255, 0.25)' : 'rgba(255, 255, 255, 0.06)'}`,
        borderRadius: 8,
        padding: 16,
        textAlign: 'center',
      }}
    >
      <div 
        className="calc-no-capitalize"
        style={{ fontSize: hero ? '1.6rem' : '1.2rem', fontWeight: 800, color: hero ? '#00E5FF' : '#FFFFFF', fontFamily: 'monospace', lineHeight: 1.1 }}
      >
        {value}
      </div>
      <div style={{ fontSize: '0.7rem', color: '#9CA3AF', marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
        {label}
      </div>
    </div>
  );
}

export default function LabToolsCalculators() {
  const [vialMg, setVialMg] = useState('5');
  const [bacMl, setBacMl] = useState('2');
  const [targetMcg, setTargetMcg] = useState('250');

  const r = useMemo(() => {
    const mg = Number(vialMg) || 0;
    const ml = Number(bacMl) || 0;
    const mcg = Number(targetMcg) || 0;
    const valid = mg > 0 && ml > 0;

    const concMgMl = valid ? mg / ml : 0;           // mg per mL
    const concMcgUnit = valid ? (mg * 10) / ml : 0; // mcg per U-100 unit

    const targetMg = mcg / 1000;
    const drawMlRaw = (valid && mcg > 0) ? drawVolumeMl(mg, ml, targetMg) : null;
    const drawMl = drawMlRaw ?? 0;
    const drawUnits = drawMl * 100; // 1 mL = 100 U-100 units

    const totalDoses = (mg > 0 && mcg > 0) ? (mg * 1000) / mcg : 0;

    return { valid, concMgMl, concMcgUnit, drawMl, drawUnits, totalDoses };
  }, [vialMg, bacMl, targetMcg]);

  return (
    <div className="calc-container" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div 
        style={{
          border: '1px solid rgba(0, 229, 255, 0.2)',
          borderRadius: 16,
          padding: 24,
          background: 'radial-gradient(circle at 50% 0%, #111622 0%, #080a0f 100%)',
          boxShadow: '0 16px 40px rgba(0,0,0,0.7), 0 0 24px rgba(0, 229, 255, 0.04)',
        }}
      >
        <h3 style={{ fontSize: '1rem', color: '#FFFFFF', fontWeight: 800, marginBottom: 4 }}>Reconstitution Calculator</h3>
        <p style={{ fontSize: '0.82rem', color: '#9CA3AF', marginBottom: 20, lineHeight: 1.5 }}>
          Enter Your Vial Strength, How Much Bacteriostatic Water You Are Adding, And Your Target Amount Per Draw. The Tool Computes The Concentration And Exactly How Much To Draw On A <span className="calc-no-capitalize">U-100</span> Syringe.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginBottom: 24 }}>
          <Field label="Vial Strength" value={vialMg} onChange={setVialMg} suffix="mg" />
          <Field label="BAC Water Added" value={bacMl} onChange={setBacMl} suffix="mL" />
          <Field label="Target Per Draw" value={targetMcg} onChange={setTargetMcg} suffix="mcg" step="5" />
        </div>

        {r.valid && Number(targetMcg) > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
            <Stat hero label="Units To Draw (U-100)" value={formatUnits(r.drawUnits)} />
            <Stat hero label="Volume To Draw" value={`${round(r.drawMl, 3)} mL`} />
            <Stat label="Concentration" value={`${round(r.concMgMl, 2)} mg/mL`} />
            <Stat label="Per Unit" value={`${round(r.concMcgUnit, 1)} mcg/u`} />
            <Stat label="Draws Per Vial" value={formatDoseCount(r.totalDoses)} />
          </div>
        ) : r.valid ? (
          <div style={{ padding: 16, color: '#9CA3AF', fontSize: '0.85rem', textAlign: 'center' }}>
            Enter A Target Per Draw Amount Above To See Your Numbers.
          </div>
        ) : (
          <div style={{ padding: 16, color: '#9CA3AF', fontSize: '0.85rem', textAlign: 'center' }}>
            Enter A Vial Strength And BAC Water Amount Above To See Your Numbers.
          </div>
        )}
      </div>

      {/* Quick reference */}
      <div 
        style={{
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: 16,
          padding: 24,
          background: 'rgba(255, 255, 255, 0.01)',
        }}
      >
        <h3 style={{ fontSize: '0.82rem', color: '#A8B2C1', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16 }}>
          How The Math Works
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.84rem', color: '#D1D5DB', lineHeight: 1.5 }}>
          <div>Concentration (<span className="calc-no-capitalize">mg/mL</span>) = Vial Strength ÷ BAC Water Added.</div>
          <div>On A <span className="calc-no-capitalize">U-100</span> Syringe, <span className="calc-no-capitalize">1 mL = 100</span> Units, So Each Unit Holds (Vial Strength × 10) ÷ BAC Water <span className="calc-no-capitalize">mcg</span>.</div>
          <div>Units To Draw = Target <span className="calc-no-capitalize">mcg</span> ÷ (Vial Strength × 10 ÷ BAC Water).</div>
          <div>Draws Per Vial = (Vial Strength × 1000) ÷ Target <span className="calc-no-capitalize">mcg</span>.</div>
        </div>
      </div>

      <div
        style={{ padding: 16, borderRadius: 8, border: '1px solid rgba(239, 68, 68, 0.15)', background: 'rgba(239, 68, 68, 0.03)' }}
      >
        <p style={{ fontSize: '0.8rem', color: '#9CA3AF', margin: 0, lineHeight: 1.5 }}>
          <strong style={{ color: '#EF4444' }}>Research Use Only.</strong>{' '}
          These Calculators Are Provided For Laboratory Reconstitution Math Only. They Are Not Medical Advice And Are Not Dosing Guidance For Use In Humans Or Animals. All Products Are Sold Strictly For In-Vitro Research.
        </p>
      </div>
    </div>
  );
}
