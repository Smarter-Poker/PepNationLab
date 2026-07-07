/**
 * MonographSeoContent - SERVER component (no 'use client').
 *
 * Renders the core compound prose directly into the initial HTML so that
 * search engines AND non-JavaScript AI crawlers (GPTBot, ClaudeBot,
 * PerplexityBot, CCBot) can read the substance of every monograph without
 * executing the client-rendered MonographTabs.
 *
 * Phase 2 AIO:
 *  - Semantic <article> / <section> structure with a clean h1 -> h2 hierarchy.
 *  - An answer-first one-sentence definition (AEO: answer engines and featured
 *    snippets extract a short self-contained definition before prose).
 *  - An "At A Glance" HTML <table> of the hard facts (molecular weight, amino
 *    acid sequence, CAS number, half-life) which AI answer engines extract
 *    preferentially over prose.
 *
 * Every string is written in Title Case for headings/labels per platform
 * rules; body prose from the database is rendered as-authored. No emojis.
 */

import type { Compound } from '@/lib/compounds';
import { EVIDENCE_TIER } from '@/lib/compounds';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <tr>
      <th
        scope="row"
        style={{
          textAlign: 'left',
          verticalAlign: 'top',
          padding: '8px 16px 8px 0',
          fontSize: '0.8rem',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: 'var(--silver, #A8B4C0)',
          fontWeight: 600,
          whiteSpace: 'nowrap',
          borderBottom: '1px solid rgba(192,184,168,0.12)',
        }}
      >
        {label}
      </th>
      <td
        style={{
          padding: '8px 0',
          fontSize: '0.95rem',
          color: 'var(--white, #fff)',
          fontWeight: 600,
          wordBreak: 'break-word',
          borderBottom: '1px solid rgba(192,184,168,0.12)',
        }}
      >
        {value}
      </td>
    </tr>
  );
}

export default function MonographSeoContent({ compound }: { compound: Compound }) {
  const tier = EVIDENCE_TIER[compound.evidence_tier];
  const aliases = (compound.aliases ?? []).filter(Boolean);
  const halfLife =
    compound.half_life ??
    (compound.measured_half_life_hours != null ? `${compound.measured_half_life_hours} Hours` : null) ??
    (compound.predicted_half_life_hours != null ? `~${compound.predicted_half_life_hours} Hours (Predicted)` : null);
  const molecularWeight =
    compound.molecular_weight_da != null ? `${compound.molecular_weight_da} Da` : compound.identity?.molecular_weight ?? null;
  const sequence = compound.sequence_one_letter ?? compound.identity?.sequence ?? null;
  const casNumber = compound.identity?.cas ?? null;
  const routes = (compound.route_of_admin ?? []).filter(Boolean).join(', ') || null;

  // Answer-first definition: a single, self-contained sentence that AI answer
  // engines and featured snippets extract before longer prose. Composed only
  // from existing fields, and RUO-framed. Tagged .compound-summary so it feeds
  // the page's existing speakable selector.
  const defClass = compound.compound_class || 'research compound';
  const defTarget = compound.molecular_target ? ` targeting ${compound.molecular_target}` : '';
  const defArea = compound.category ? `${compound.category} research` : 'laboratory research';

  return (
    <article
      aria-label={`${compound.display_name} Research Summary`}
      style={{
        maxWidth: '1100px',
        margin: '0 auto',
        padding: 'var(--space-6, 32px) var(--space-4, 16px) var(--space-2, 8px)',
        color: 'var(--white, #fff)',
      }}
    >
      <header>
        <h1 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', fontWeight: 800, margin: '0 0 8px' }}>
          {compound.display_name}
        </h1>

        {aliases.length > 0 && (
          <p style={{ margin: '0 0 12px', color: 'var(--silver, #A8B4C0)', fontSize: '0.95rem' }}>
            Also Known As: {aliases.join(', ')}
          </p>
        )}

        {/* Answer-first definition callout (AEO). */}
        <p
          className="compound-summary compound-definition"
          style={{
            margin: '0 0 16px',
            padding: '12px 16px',
            borderLeft: '3px solid var(--teal, #00C4BC)',
            background: 'rgba(0,196,188,0.06)',
            borderRadius: '0 8px 8px 0',
            fontSize: '1.02rem',
            lineHeight: 1.6,
          }}
        >
          <strong>{compound.display_name}</strong> is a research-grade {defClass}{defTarget} studied in {defArea}.
          It is supplied strictly for in vitro laboratory research use only — not for human or animal consumption,
          and not FDA-approved.
        </p>

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
      </header>

      <section aria-label="At A Glance Facts" style={{ margin: '0 0 24px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 10px' }}>At A Glance</h2>
        <table
          style={{
            width: '100%',
            maxWidth: '640px',
            borderCollapse: 'collapse',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <caption style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
            {compound.display_name} Key Research Facts
          </caption>
          <tbody>
            <Row label="Category" value={compound.category} />
            <Row label="Compound Class" value={compound.compound_class} />
            <Row label="Molecular Target" value={compound.molecular_target} />
            <Row label="Molecular Weight" value={molecularWeight} />
            <Row label="Amino Acid Sequence" value={sequence} />
            <Row label="CAS Number" value={casNumber} />
            <Row label="Half-Life" value={halfLife} />
            <Row label="Route Of Administration" value={routes} />
            <Row label="WADA Status" value={compound.wada_status} />
            {tier && <Row label="Evidence Tier" value={tier.label} />}
          </tbody>
        </table>
      </section>

      {compound.mechanism && (
        <section style={{ margin: '0 0 20px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 8px' }}>Mechanism Of Action</h2>
          <p className="mechanism-text" style={{ margin: 0, lineHeight: 1.6 }}>{compound.mechanism}</p>
        </section>
      )}

      {(compound.studied_for ?? []).filter(Boolean).length > 0 && (
        <section style={{ margin: '0 0 20px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 8px' }}>Studied For</h2>
          <ul style={{ margin: 0, paddingLeft: '1.2rem', lineHeight: 1.6 }}>
            {compound.studied_for.filter(Boolean).map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>
      )}

      {compound.benefits && (
        <section style={{ margin: '0 0 20px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 8px' }}>Reported Research Findings</h2>
          <p style={{ margin: 0, lineHeight: 1.6 }}>{compound.benefits}</p>
        </section>
      )}

      {compound.pk_summary && (
        <section style={{ margin: '0 0 20px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 8px' }}>Pharmacokinetics</h2>
          <p style={{ margin: 0, lineHeight: 1.6 }}>{compound.pk_summary}</p>
        </section>
      )}

      {(compound.warnings || compound.side_effects) && (
        <section style={{ margin: '0 0 20px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 8px' }}>Safety And Handling Notes</h2>
          {compound.side_effects && <p style={{ margin: '0 0 8px', lineHeight: 1.6 }}>{compound.side_effects}</p>}
          {compound.warnings && <p style={{ margin: 0, lineHeight: 1.6 }}>{compound.warnings}</p>}
        </section>
      )}

      {compound.regulatory && (
        <section style={{ margin: '0 0 20px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 8px' }}>Regulatory Status</h2>
          <p style={{ margin: 0, lineHeight: 1.6 }}>{compound.regulatory}</p>
        </section>
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
    </article>
  );
}
