'use client';

/**
 * DosingConverter — laboratory preparation math for research peptides:
 *  - Reconstitution concentration (mg in vial + diluent mL -> mg/mL and mcg/unit)
 *  - Aliquot draw (target amount in mcg -> insulin-syringe units + volume in mL)
 *  - Unit conversion (mg <-> mcg, and mg <-> IU via a compound-specific factor)
 *
 * Research-Use-Only. This is bench arithmetic for preparing research solutions,
 * NOT human or veterinary dosing guidance. Title Case, no emojis, teal/black.
 */

import { useMemo, useState } from 'react';

const card: React.CSSProperties = {
  background: 'var(--surface-1, #0F1923)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 'var(--radius-lg, 12px)',
  padding: 'var(--space-5, 24px)',
};
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.78rem',
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'var(--silver, #A8B4C0)',
  marginBottom: '6px',
};
const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.16)',
  borderRadius: '10px',
  color: '#FFFFFF',
  padding: '12px 14px',
  fontSize: '16px',
};
const statStyle: React.CSSProperties = {
  background: 'rgba(0,196,188,0.08)',
  border: '1px solid rgba(0,196,188,0.30)',
  borderRadius: '10px',
  padding: '14px 16px',
};

function num(v: string): number {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}
function fmt(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { maximumFractionDigits: digits });
}

function Field({
  label,
  value,
  setValue,
  suffix,
  placeholder,
}: {
  label: string;
  value: string;
  setValue: (v: string) => void;
  suffix?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          style={{ ...inputStyle, paddingRight: suffix ? '52px' : '14px' }}
        />
        {suffix && (
          <span
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--silver, #A8B4C0)',
              fontSize: '0.85rem',
              fontWeight: 700,
            }}
          >
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function Result({ k, v }: { k: string; v: string }) {
  return (
    <div style={statStyle}>
      <div style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--silver, #A8B4C0)' }}>
        {k}
      </div>
      <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#00C4BC', marginTop: '2px' }}>{v}</div>
    </div>
  );
}

export default function DosingConverter() {
  // Reconstitution + aliquot
  const [mg, setMg] = useState('5');
  const [ml, setMl] = useState('2');
  const [targetMcg, setTargetMcg] = useState('250');

  const recon = useMemo(() => {
    const m = num(mg);
    const v = num(ml);
    const concMgMl = v > 0 ? m / v : 0; // mg per mL
    const mcgPerUnit = v > 0 ? (m * 1000) / (v * 100) : 0; // U-100 syringe: 100 units = 1 mL
    const dose = num(targetMcg);
    const units = mcgPerUnit > 0 ? dose / mcgPerUnit : 0;
    const drawMl = concMgMl > 0 ? dose / 1000 / concMgMl : 0;
    return { concMgMl, mcgPerUnit, units, drawMl };
  }, [mg, ml, targetMcg]);

  // Unit conversion
  const [conv, setConv] = useState('1');
  const [iuPerMg, setIuPerMg] = useState('');
  const unit = useMemo(() => {
    const m = num(conv);
    const factor = num(iuPerMg);
    return {
      mcg: m * 1000,
      iu: factor > 0 ? m * factor : null,
    };
  }, [conv, iuPerMg]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5, 24px)' }}>
      {/* Reconstitution + aliquot */}
      <section style={card}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF', margin: '0 0 4px' }}>
          Reconstitution & Aliquot Math
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--silver, #A8B4C0)', margin: '0 0 var(--space-4, 16px)' }}>
          Enter The Lyophilized Amount In The Vial And The Diluent Volume To Get The Solution Concentration, Then A
          Target Amount Per Draw To Get Insulin-Syringe Units And Volume.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-3, 12px)' }}>
          <Field label="Peptide In Vial" value={mg} setValue={setMg} suffix="mg" />
          <Field label="Diluent Added" value={ml} setValue={setMl} suffix="mL" />
          <Field label="Target Per Draw" value={targetMcg} setValue={setTargetMcg} suffix="mcg" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-3, 12px)', marginTop: 'var(--space-4, 16px)' }}>
          <Result k="Concentration" v={`${fmt(recon.concMgMl)} mg/mL`} />
          <Result k="Per Insulin Unit" v={`${fmt(recon.mcgPerUnit)} mcg`} />
          <Result k="Units To Draw" v={`${fmt(recon.units, 1)} units`} />
          <Result k="Volume To Draw" v={`${fmt(recon.drawMl, 3)} mL`} />
        </div>
        <p style={{ fontSize: '0.72rem', color: 'var(--grey-500, #6B7785)', margin: 'var(--space-3, 12px) 0 0' }}>
          Units Assume A Standard U-100 Insulin Syringe (100 Units = 1 mL).
        </p>
      </section>

      {/* Unit conversion */}
      <section style={card}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF', margin: '0 0 4px' }}>
          Unit Conversion
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--silver, #A8B4C0)', margin: '0 0 var(--space-4, 16px)' }}>
          Convert A Milligram Amount To Micrograms, And To International Units When You Provide The Compound-Specific
          Activity Factor (IU Per mg). IU Has No Universal Conversion — It Is Defined Per Substance.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-3, 12px)' }}>
          <Field label="Amount" value={conv} setValue={setConv} suffix="mg" />
          <Field label="Activity Factor" value={iuPerMg} setValue={setIuPerMg} suffix="IU/mg" placeholder="Optional" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-3, 12px)', marginTop: 'var(--space-4, 16px)' }}>
          <Result k="In Micrograms" v={`${fmt(unit.mcg)} mcg`} />
          <Result k="In International Units" v={unit.iu == null ? 'Add A Factor' : `${fmt(unit.iu)} IU`} />
        </div>
      </section>

      <p style={{ fontSize: '0.78rem', color: 'var(--grey-500, #6B7785)', margin: 0 }}>
        For Laboratory Research Calculations Only. This Tool Performs Solution-Preparation Arithmetic And Is Not Human
        Or Veterinary Dosing Guidance.
      </p>
    </div>
  );
}
