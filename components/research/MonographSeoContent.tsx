/**
 * MonographSeoContent - SERVER component (no 'use client').
 *
 * Renders the core compound prose directly into the initial HTML so that
 * search engines AND non-JavaScript AI crawlers (GPTBot, ClaudeBot,
 * PerplexityBot, CCBot) can read the substance of every monograph without
 * executing the client-rendered MonographTabs.
 *
 * This is deliberately plain, semantic HTML: a single H1, a summary
 * paragraph, a definition list of key facts, and clearly-headed sections.
 * It doubles as a fast "Quick Reference" for human visitors above the
 * interactive tabbed experience.
 *
 * Every string is written in Title Case for headings/labels per platform
 * rules; body prose from the database is rendered as-authored. No emojis.
 */

import type { Compound } from '@/lib/compounds';
import { EVIDENCE_TIER } from '@/lib/compounds';

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <dt style={{ fontSize: '0.72rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--silver, #A8B4C0)' }}>
        {label}
      </dt>
      <dd style={{ margin: 0, fontSize: '0.95rem', color: 'var(--white, #fff)', fontWeight: 600 }}>{value}</dd>
    </div>
  );
}

export default function MonographSeoContent({ compound }: { compound: Compound }) {
  const tier = EVIDENCE_TIER[compound.evidence_tier];
  const aliases = (compound.aliases ?? []).filter(Boolean);
  const halfLife =
    compound.half_life ??
    (compound.measured_half_life_hours != null ? `${compound.measured_half_life_hours} Hours` : null) ??
    (compound.predicted_half_life_hours != null ? `~${compound.predicted_half_life_hours} Hours (Predicted)` : null);

  return (
    <section
      aria-label={`${compound.display_name} Research Summary`}
      style={{
        maxWidth: '1100px',
        margin: '0 auto',
        padding: 'var(--space-6, 32px) var(--space-4, 16px) var(--space-2, 8px)',
        color: 'var(--white, #fff)',
      }}
    >
      <h1 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', fontWeight: 800, margin: '0 0 8px' }}>
        {compound.display_name}
      </h1>

      {aliases.length > 0 && (
        <p style={{ margin: '0 0 12px', color: 'var(--silver, #A8B4C0)', fontSize: '0.95rem' }}>
          Also Known As: {aliases.join(', ')}
        </p>
      )}

      {tier && (
        <p style={{ margin: '0 0 16px', fontSize: '0.9rem' }}>
          <strong>Evidence Tier:</strong> {tier.label} — {tier.blurb}
        </p>
      )}

      {compound.plain_summary && (
        <p className="compound-summary" style={{ margin: '0 0 20px', fontSize: '1.05rem', lineHeight: 1.6 }}>
          {compound.plain_summary}
        </p>
      )}

      <dl
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 'var(--space-4, 16px)',
          margin: '0 0 24px',
        }}
      >
        <Fact label="Category" value={compound.category} />
        <Fact label="Compound Class" value={compound.compound_class} />
        <Fact label="Molecular Target" value={compound.molecular_target} />
        <Fact label="Half-Life" value={halfLife} />
        <Fact label="Molecular Weight" value={compound.molecular_weight_da != null ? `${compound.molecular_weight_da} Da` : null} />
        <Fact label="Sequence" value={compound.sequence_one_letter ?? compound.identity?.sequence ?? null} />
        <Fact label="WADA Status" value={compound.wada_status} />
        <Fact label="Route Of Administration" value={(compound.route_of_admin ?? []).filter(Boolean).join(', ') || null} />
      </dl>

      {compound.mechanism && (
        <div style={{ margin: '0 0 20px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 8px' }}>Mechanism Of Action</h2>
          <p className="mechanism-text" style={{ margin: 0, lineHeight: 1.6 }}>{compound.mechanism}</p>
        </div>
      )}

      {(compound.studied_for ?? []).filter(Boolean).length > 0 && (
        <div style={{ margin: '0 0 20px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 8px' }}>Studied For</h2>
          <ul style={{ margin: 0, paddingLeft: '1.2rem', lineHeight: 1.6 }}>
            {compound.studied_for.filter(Boolean).map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {compound.benefits && (
        <div style={{ margin: '0 0 20px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 8px' }}>Reported Research Findings</h2>
          <p style={{ margin: 0, lineHeight: 1.6 }}>{compound.benefits}</p>
        </div>
      )}

      {compound.pk_summary && (
        <div style={{ margin: '0 0 20px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 8px' }}>Pharmacokinetics</h2>
          <p style={{ margin: 0, lineHeight: 1.6 }}>{compound.pk_summary}</p>
        </div>
      )}

      {(compound.warnings || compound.side_effects) && (
        <div style={{ margin: '0 0 20px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 8px' }}>Safety And Handling Notes</h2>
          {compound.side_effects && <p style={{ margin: '0 0 8px', lineHeight: 1.6 }}>{compound.side_effects}</p>}
          {compound.warnings && <p style={{ margin: 0, lineHeight: 1.6 }}>{compound.warnings}</p>}
        </div>
      )}

      {compound.regulatory && (
        <div style={{ margin: '0 0 20px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 8px' }}>Regulatory Status</h2>
          <p style={{ margin: 0, lineHeight: 1.6 }}>{compound.regulatory}</p>
        </div>
      )}

      <p style={{ margin: '8px 0 0', fontSize: '0.85rem', color: 'var(--silver, #A8B4C0)' }}>
        Maintained By The Pep Nation Lab Research Team. See Our{' '}
        <a href="/research/methodology" style={{ color: 'var(--teal, #00C4BC)' }}>Editorial Standards And Research Methodology</a>{' '}
        For How This Reference Is Sourced And Reviewed.
      </p>
      <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--silver, #A8B4C0)' }}>
        This Reference Is Provided For In Vitro Laboratory Research Use Only. Not For Human Consumption. See The{' '}
        <a href="/disclaimer" style={{ color: 'var(--teal, #00C4BC)' }}>Full Research Disclaimer</a>.
      </p>
    </section>
  );
}
