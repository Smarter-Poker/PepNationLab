'use client';

import { useMemo, useState } from 'react';

/**
 * Lab Tools — reconstitution & dosing math.
 *
 * Pure client-side calculators (no network, no data). Helps a researcher work
 * out how much bacteriostatic water to add to a lyophilised vial and how much
 * to draw for a target amount. For research calculation purposes only — not
 * medical advice and not dosing guidance for use in humans.
 *
 * Math (U-100 insulin syringe convention: 1 mL = 100 units):
 *   concentration (mg/mL)   = vial_mg / bac_mL
 *   concentration (mcg/unit)= (vial_mg * 10) / bac_mL
 *   draw volume (mL)        = target_mcg * bac_mL / (vial_mg * 1000)
 *   draw (units, U-100)     = target_mcg * bac_mL / (vial_mg * 10)
 *   total doses per vial    = (vial_mg * 1000) / target_mcg
 */

const round = (n: number, dp = 2) => {
  if (!Number.isFinite(n)) return 0;
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
};

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
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: '0.72rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
        {label}
      </span>
      <div style={{ position: 'relative' }}>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="form-input"
          style={{ paddingRight: 52, width: '100%' }}
        />
        <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: '0.78rem', color: 'var(--grey-500)', fontWeight: 600 }}>
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
        background: hero ? 'rgba(0,196,188,0.08)' : 'var(--surface-1)',
        border: `1px solid ${hero ? 'rgba(0,196,188,0.25)' : 'rgba(255,255,255,0.06)'}`,
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-4)',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: hero ? '1.6rem' : '1.2rem', fontWeight: 800, color: hero ? 'var(--teal)' : 'var(--white)', fontFamily: 'var(--font-brand)', lineHeight: 1.1 }}>
        {value}
      </div>
      <div style={{ fontSize: '0.7rem', color: 'var(--grey-400)', marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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
    const concMgMl = valid ? mg / ml : 0; // mg per mL
    const concMcgUnit = valid ? (mg * 10) / ml : 0; // mcg per U-100 unit
    const drawMl = valid && mcg > 0 ? (mcg * ml) / (mg * 1000) : 0;
    const drawUnits = valid && mcg > 0 ? (mcg * ml) / (mg * 10) : 0;
    const totalDoses = mcg > 0 ? (mg * 1000) / mcg : 0;
    return { valid, concMgMl, concMcgUnit, drawMl, drawUnits, totalDoses };
  }, [vialMg, bacMl, targetMcg]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <div className="card-metal" style={{ padding: 'var(--space-6)' }}>
        <h3 style={{ fontSize: '1rem', color: 'var(--white)', fontWeight: 800, marginBottom: 4 }}>Reconstitution Calculator</h3>
        <p style={{ fontSize: '0.82rem', color: 'var(--grey-400)', marginBottom: 'var(--space-5)', lineHeight: 1.5 }}>
          Enter Your Vial Strength, How Much Bacteriostatic Water You Are Adding, And Your Target Amount Per Draw. The Tool Computes The Concentration And Exactly How Much To Draw On A U-100 Syringe.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
          <Field label="Vial Strength" value={vialMg} onChange={setVialMg} suffix="mg" />
          <Field label="BAC Water Added" value={bacMl} onChange={setBacMl} suffix="mL" />
          <Field label="Target Per Draw" value={targetMcg} onChange={setTargetMcg} suffix="mcg" step="5" />
        </div>

        {r.valid ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-3)' }}>
            <Stat hero label="Units To Draw (U-100)" value={`${round(r.drawUnits, 1)} u`} />
            <Stat hero label="Volume To Draw" value={`${round(r.drawMl, 3)} mL`} />
            <Stat label="Concentration" value={`${round(r.concMgMl, 2)} mg/mL`} />
            <Stat label="Per Unit" value={`${round(r.concMcgUnit, 1)} mcg/u`} />
            <Stat label="Draws Per Vial" value={r.totalDoses > 0 ? `${Math.floor(r.totalDoses)}` : '—'} />
          </div>
        ) : (
          <div style={{ padding: 'var(--space-4)', color: 'var(--grey-400)', fontSize: '0.85rem', textAlign: 'center' }}>
            Enter A Vial Strength And BAC Water Amount Above To See Your Numbers.
          </div>
        )}
      </div>

      {/* Quick reference */}
      <div className="card-metal" style={{ padding: 'var(--space-6)' }}>
        <h3 style={{ fontSize: '0.82rem', color: 'var(--silver)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 'var(--space-4)' }}>
          How The Math Works
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.84rem', color: 'var(--grey-300)', lineHeight: 1.5 }}>
          <div>Concentration (mg/mL) = Vial Strength / BAC Water Added.</div>
          <div>On A U-100 Syringe, 1 mL = 100 Units, So Each Unit Holds (Vial Strength x 10) / BAC Water mcg.</div>
          <div>Units To Draw = Target mcg x BAC Water / (Vial Strength x 10).</div>
          <div>Draws Per Vial = (Vial Strength x 1000) / Target mcg.</div>
        </div>
      </div>

      <div
        className="disclaimer-warning"
        style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-md)' }}
      >
        <p style={{ fontSize: '0.8rem', color: 'var(--silver)', margin: 0, lineHeight: 1.5 }}>
          <strong style={{ color: 'var(--red)' }}>Research Use Only.</strong>{' '}
          These Calculators Are Provided For Laboratory Reconstitution Math Only. They Are Not Medical Advice And Are Not Dosing Guidance For Use In Humans Or Animals. All Products Are Sold Strictly For In-Vitro Research.
        </p>
      </div>
    </div>
  );
}
