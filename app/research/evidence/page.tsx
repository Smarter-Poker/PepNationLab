/**
 * Evidence & Safety Reference — a cross-compound hub that surfaces, in one
 * place, how strong the evidence is for each catalog compound, which compounds
 * are WADA-prohibited, and which carry notable safety flags. Server component;
 * reads the same `compounds` source of truth as the rest of the Research
 * section. Research-use-only framing throughout; nothing here is dosing or
 * medical advice.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldAlert, FlaskConical, Ban } from 'lucide-react';
import { getAllCompounds } from '@/lib/compounds-server';
import { RISK_META, evidenceTier, wadaLabel } from '@/lib/compounds';
import type { Compound } from '@/lib/compounds';

export const metadata: Metadata = {
  title: 'Evidence & Safety Reference | Research Library | Pep Nation Lab',
  robots: { index: false, follow: false },
};

// Strongest-to-weakest so the reader calibrates top-down.
const TIER_ORDER = ['approved_drug', 'investigational', 'preclinical', 'research_chemical', 'cosmetic', 'supply'];

function CompoundChip({ c }: { c: Compound }) {
  return (
    <Link
      href={`/research/${c.slug}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        borderRadius: '999px',
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(255,255,255,0.03)',
        color: 'var(--white, #FFFFFF)',
        fontSize: '0.82rem',
        textDecoration: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {c.display_name}
    </Link>
  );
}

export default async function EvidenceSafetyPage() {
  const compounds = await getAllCompounds();

  const byTier: Record<string, Compound[]> = {};
  for (const c of compounds) {
    const t = c.evidence_tier || 'research_chemical';
    (byTier[t] ||= []).push(c);
  }
  const tiers = TIER_ORDER.filter((t) => byTier[t]?.length);

  const wadaProhibited = compounds
    .filter((c) => c.wada_status === 'prohibited' || c.wada_status === 'prohibited_males')
    .sort((a, b) => a.display_name.localeCompare(b.display_name));

  const flagged = compounds
    .filter(
      (c) =>
        c.risk_level === 'critical' ||
        c.risk_level === 'high' ||
        c.is_pro_angiogenic ||
        c.is_glp1 ||
        c.is_temp_sensitive,
    )
    .sort((a, b) => {
      const order = { critical: 0, high: 1, moderate: 2, low: 3 } as Record<string, number>;
      return (order[a.risk_level] ?? 9) - (order[b.risk_level] ?? 9) || a.display_name.localeCompare(b.display_name);
    });

  const sectionTitle = {
    fontSize: '1.35rem',
    fontWeight: 800,
    color: 'var(--white, #FFFFFF)',
    margin: 0,
    marginBottom: 'var(--space-4, 16px)',
  } as const;

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: 'var(--space-6, 32px) var(--space-4, 16px)' }}>
      <nav style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Link href="/research" style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.9rem', textDecoration: 'none' }}>
          Back To Research Library
        </Link>
      </nav>

      <header style={{ marginBottom: 'var(--space-6, 32px)' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--white, #FFFFFF)', margin: 0 }}>
          Evidence & Safety Reference
        </h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.05rem', marginTop: 'var(--space-2, 8px)', maxWidth: '760px' }}>
          A Cross-Compound View Of How Strong The Evidence Is, Which Compounds Are WADA-Prohibited, And Which Carry
          Notable Safety Flags. For Laboratory Research Only. Not Medical Advice Or Dosing Guidance.
        </p>
      </header>

      <section style={{ marginBottom: 'var(--space-7, 48px)' }}>
        <h2 style={sectionTitle}>
          <FlaskConical size={20} aria-hidden="true" style={{ verticalAlign: '-3px', marginRight: 8, color: 'var(--teal, #00C4BC)' }} />
          Evidence At A Glance
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4, 16px)' }}>
          {tiers.map((t) => {
            const meta = evidenceTier(t);
            const items = byTier[t].slice().sort((a, b) => a.display_name.localeCompare(b.display_name));
            return (
              <div
                key={t}
                className="card-glass"
                style={{ padding: 'var(--space-4, 16px)', borderRadius: 'var(--radius-lg, 12px)', borderLeft: `3px solid ${meta.color}` }}
              >
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2, 8px)', marginBottom: 'var(--space-2, 8px)' }}>
                  <span style={{ fontSize: '1rem', fontWeight: 800, color: meta.color }}>{meta.label}</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--silver, #A8B4C0)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '999px', padding: '1px 8px' }}>
                    {items.length}
                  </span>
                </div>
                {meta.blurb && (
                  <p style={{ fontSize: '0.85rem', color: 'var(--silver, #A8B4C0)', margin: '0 0 var(--space-3, 12px)' }}>{meta.blurb}</p>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {items.map((c) => (
                    <CompoundChip key={c.slug} c={c} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <p style={{ fontSize: '0.78rem', color: 'var(--grey-500, #6B7785)', marginTop: 'var(--space-3, 12px)' }}>
          Evidence Tiers Describe What Researchers Have Published, Not What A Compound Will Do For Any Individual.
        </p>
      </section>

      <section style={{ marginBottom: 'var(--space-7, 48px)' }}>
        <h2 style={sectionTitle}>
          <Ban size={20} aria-hidden="true" style={{ verticalAlign: '-3px', marginRight: 8, color: '#F6AD55' }} />
          Anti-Doping: WADA-Prohibited Compounds
        </h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--silver, #A8B4C0)', marginTop: 0, marginBottom: 'var(--space-4, 16px)', maxWidth: '760px' }}>
          The Following Catalog Compounds Appear On, Or Map To Classes On, The WADA Prohibited List. Not For Use By
          Tested Athletes. Status Can Change — Always Verify Against The Current WADA List Before Any Competition Context.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--space-3, 12px)' }}>
          {wadaProhibited.map((c) => (
            <Link
              key={c.slug}
              href={`/research/${c.slug}`}
              className="card-metal"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                padding: 'var(--space-3, 12px) var(--space-4, 16px)',
                borderRadius: 'var(--radius-lg, 12px)',
                textDecoration: 'none',
                color: 'var(--white, #FFFFFF)',
              }}
            >
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{c.display_name}</span>
              <span style={{ fontSize: '0.74rem', color: '#F6AD55' }}>{wadaLabel(c.wada_status)}</span>
            </Link>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 'var(--space-6, 32px)' }}>
        <h2 style={sectionTitle}>
          <ShieldAlert size={20} aria-hidden="true" style={{ verticalAlign: '-3px', marginRight: 8, color: '#FF6B6B' }} />
          Safety Flags
        </h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--silver, #A8B4C0)', marginTop: 0, marginBottom: 'var(--space-4, 16px)', maxWidth: '760px' }}>
          Compounds Carrying A Notable Handling Or Safety Consideration. Surfacing These Plainly Is Part Of The
          Research-Use-Only Posture. Read Each Compound Page For The Full Warnings Section.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)' }}>
          {flagged.map((c) => {
            const risk = RISK_META[c.risk_level];
            const flags: string[] = [];
            if (c.is_pro_angiogenic) flags.push('Pro-Angiogenic');
            if (c.is_glp1) flags.push('GLP-1 Class');
            if (c.is_temp_sensitive) flags.push('Cold-Chain');
            return (
              <div
                key={c.slug}
                className="card-glass"
                style={{ padding: 'var(--space-4, 16px)', borderRadius: 'var(--radius-lg, 12px)' }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-2, 8px)', marginBottom: '6px' }}>
                  <Link href={`/research/${c.slug}`} style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--white, #FFFFFF)', textDecoration: 'none' }}>
                    {c.display_name}
                  </Link>
                  {risk && (
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: risk.color, background: risk.bg, borderRadius: '999px', padding: '2px 9px' }}>
                      {risk.label} Risk
                    </span>
                  )}
                  {flags.map((f) => (
                    <span key={f} style={{ fontSize: '0.72rem', color: 'var(--silver, #A8B4C0)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '999px', padding: '2px 9px' }}>
                      {f}
                    </span>
                  ))}
                </div>
                {c.risk_reasons?.length > 0 && (
                  <ul style={{ margin: '4px 0 0', paddingLeft: '18px', color: 'var(--silver, #A8B4C0)', fontSize: '0.85rem' }}>
                    {c.risk_reasons.map((r, i) => (
                      <li key={i} style={{ marginBottom: '2px' }}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
