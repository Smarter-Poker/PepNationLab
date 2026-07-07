/**
 * /research/compare/[matchup] - "X vs Y" compound comparison landing page.
 *
 * Targets high-intent comparison search queries (e.g. "BPC-157 vs TB-500")
 * that the individual monographs do not rank for. Each page is a genuine,
 * data-rich side-by-side built from the compound database — semantic HTML, an
 * at-a-glance comparison table (the format AI answer engines extract), unique
 * metadata, breadcrumb + WebPage schema, and internal links to both full
 * monographs.
 *
 * ISR: pre-rendered for the curated pair set, revalidated daily. dynamicParams
 * is false so only the vetted matchups exist (no thin combinatorial pages).
 *
 * Title Case headings/labels. No emojis. Research-Use-Only framing.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCompound } from '@/lib/compounds-server';
import { EVIDENCE_TIER, type Compound } from '@/lib/compounds';
import { COMPARISON_PAIRS, findPair, matchupSlug } from '@/lib/research/comparisons';

export const revalidate = 86400;
export const dynamicParams = false;

export async function generateStaticParams() {
  return COMPARISON_PAIRS.map((p) => ({ matchup: matchupSlug(p.a, p.b) }));
}

function halfLifeOf(c: Compound): string | null {
  return (
    c.half_life ??
    (c.measured_half_life_hours != null ? `${c.measured_half_life_hours} Hours` : null) ??
    (c.predicted_half_life_hours != null ? `~${c.predicted_half_life_hours} Hours (Predicted)` : null)
  );
}
function mwOf(c: Compound): string | null {
  return c.molecular_weight_da != null ? `${c.molecular_weight_da} Da` : c.identity?.molecular_weight ?? null;
}
function seqOf(c: Compound): string | null {
  return c.sequence_one_letter ?? c.identity?.sequence ?? null;
}
function tierLabel(c: Compound): string {
  return EVIDENCE_TIER[c.evidence_tier]?.label ?? c.evidence_tier;
}

export async function generateMetadata({ params }: { params: Promise<{ matchup: string }> }): Promise<Metadata> {
  const { matchup } = await params;
  const pair = findPair(matchup);
  if (!pair) return { title: 'Compound Comparison | Pep Nation Lab' };
  const [a, b] = await Promise.all([getCompound(pair.a), getCompound(pair.b)]);
  if (!a || !b) return { title: 'Compound Comparison | Pep Nation Lab' };

  const title = `${a.display_name} vs ${b.display_name}: Research Comparison | Pep Nation Lab`;
  const description = `A side-by-side research comparison of ${a.display_name} and ${b.display_name} — ${pair.angle}. Mechanism, evidence tier, molecular weight, half-life, and references. Research use only.`;
  const url = `https://pepnationlab.com/research/compare/${matchup}`;
  return {
    title,
    description,
    keywords: `${a.display_name} vs ${b.display_name}, ${a.display_name}, ${b.display_name}, peptide comparison, research peptides, Pep Nation Lab`,
    robots: { index: true, follow: true },
    alternates: { canonical: url },
    openGraph: {
      title: `${a.display_name} vs ${b.display_name}: Research Comparison`,
      description,
      url,
      type: 'article',
      images: [{ url: '/og-card.png', width: 1200, height: 630, alt: `${a.display_name} vs ${b.display_name} Research Comparison` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${a.display_name} vs ${b.display_name} | Pep Nation Lab`,
      description,
      images: ['/og-card.png'],
    },
  };
}

function Cell({ children }: { children: React.ReactNode }) {
  return (
    <td style={{ padding: '10px 14px', fontSize: '0.92rem', color: 'var(--white, #fff)', borderBottom: '1px solid rgba(192,184,168,0.12)', verticalAlign: 'top', wordBreak: 'break-word' }}>
      {children ?? '—'}
    </td>
  );
}

function CompareRow({ label, a, b }: { label: string; a: React.ReactNode; b: React.ReactNode }) {
  return (
    <tr>
      <th scope="row" style={{ textAlign: 'left', padding: '10px 14px 10px 0', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--silver, #A8B4C0)', fontWeight: 700, whiteSpace: 'nowrap', borderBottom: '1px solid rgba(192,184,168,0.12)', verticalAlign: 'top' }}>
        {label}
      </th>
      <Cell>{a}</Cell>
      <Cell>{b}</Cell>
    </tr>
  );
}

export default async function ComparisonPage({ params }: { params: Promise<{ matchup: string }> }) {
  const { matchup } = await params;
  const pair = findPair(matchup);
  if (!pair) notFound();
  const [a, b] = await Promise.all([getCompound(pair.a), getCompound(pair.b)]);
  if (!a || !b) notFound();

  const url = `https://pepnationlab.com/research/compare/${matchup}`;

  // Key differences — factual, derived from the data (never dosing guidance).
  const diffs: string[] = [];
  if (a.category && b.category && a.category !== b.category) {
    diffs.push(`${a.display_name} is categorized under ${a.category}, while ${b.display_name} falls under ${b.category}.`);
  }
  if (tierLabel(a) !== tierLabel(b)) {
    diffs.push(`Evidence tier differs: ${a.display_name} is classified as ${tierLabel(a)}; ${b.display_name} is classified as ${tierLabel(b)}.`);
  }
  const aHalf = halfLifeOf(a);
  const bHalf = halfLifeOf(b);
  if (aHalf && bHalf && aHalf !== bHalf) {
    diffs.push(`Reported half-life differs: ${a.display_name} at ${aHalf} versus ${b.display_name} at ${bHalf}.`);
  }
  if (a.molecular_target && b.molecular_target && a.molecular_target !== b.molecular_target) {
    diffs.push(`Primary molecular target differs: ${a.display_name} acts on ${a.molecular_target}; ${b.display_name} acts on ${b.molecular_target}.`);
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        url,
        name: `${a.display_name} vs ${b.display_name}: Research Comparison`,
        description: `Side-by-side research comparison of ${a.display_name} and ${b.display_name}. Research use only.`,
        isPartOf: { '@id': 'https://pepnationlab.com/#website' },
        publisher: { '@id': 'https://pepnationlab.com/#organization' },
        about: [
          { '@type': 'ChemicalSubstance', name: a.display_name, url: `https://pepnationlab.com/research/${a.slug}` },
          { '@type': 'ChemicalSubstance', name: b.display_name, url: `https://pepnationlab.com/research/${b.slug}` },
        ],
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://pepnationlab.com' },
          { '@type': 'ListItem', position: 2, name: 'Research Library', item: 'https://pepnationlab.com/research' },
          { '@type': 'ListItem', position: 3, name: 'Compare', item: 'https://pepnationlab.com/research/compare' },
          { '@type': 'ListItem', position: 4, name: `${a.display_name} vs ${b.display_name}`, item: url },
        ],
      },
    ],
  };

  const linkStyle = { color: 'var(--teal, #00C4BC)', fontWeight: 700 } as const;

  return (
    <article style={{ maxWidth: '1000px', margin: '0 auto', padding: 'var(--space-6, 32px) var(--space-4, 16px)', color: 'var(--white, #fff)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav style={{ marginBottom: 'var(--space-4, 16px)', fontSize: '0.9rem' }}>
        <Link href="/research" style={{ color: 'var(--teal, #00C4BC)', textDecoration: 'none' }}>Research Library</Link>
        <span style={{ color: 'var(--silver, #A8B4C0)' }}> / Compare</span>
      </nav>

      <header style={{ marginBottom: 'var(--space-5, 24px)' }}>
        <h1 style={{ fontSize: 'clamp(1.7rem, 4.2vw, 2.5rem)', fontWeight: 800, margin: '0 0 12px', lineHeight: 1.15 }}>
          {a.display_name} vs {b.display_name}: Research Comparison
        </h1>
        <p style={{ fontSize: '1.05rem', lineHeight: 1.65, margin: 0, maxWidth: '72ch', color: 'var(--silver, #D0DAE4)' }}>
          A Side-By-Side Research Comparison Of {a.display_name} And {b.display_name} — {pair.angle}. This Reference
          Compares Mechanism, Evidence Tier, Molecular Identity, And Pharmacokinetics For Qualified Researchers. For
          In Vitro Laboratory Research Use Only. Not Medical Advice Or Dosing Guidance.
        </p>
      </header>

      <section aria-label="Side By Side Comparison" style={{ margin: '0 0 28px', overflowX: 'auto' }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '0 0 12px' }}>Side-By-Side Comparison</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '520px' }}>
          <caption style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
            {a.display_name} versus {b.display_name} research comparison
          </caption>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '0 14px 10px 0' }}></th>
              <th style={{ textAlign: 'left', padding: '0 14px 10px', fontSize: '1rem', color: 'var(--teal, #00C4BC)' }}>{a.display_name}</th>
              <th style={{ textAlign: 'left', padding: '0 14px 10px', fontSize: '1rem', color: 'var(--teal, #00C4BC)' }}>{b.display_name}</th>
            </tr>
          </thead>
          <tbody>
            <CompareRow label="Category" a={a.category} b={b.category} />
            <CompareRow label="Compound Class" a={a.compound_class} b={b.compound_class} />
            <CompareRow label="Evidence Tier" a={tierLabel(a)} b={tierLabel(b)} />
            <CompareRow label="Molecular Target" a={a.molecular_target} b={b.molecular_target} />
            <CompareRow label="Molecular Weight" a={mwOf(a)} b={mwOf(b)} />
            <CompareRow label="Amino Acid Sequence" a={seqOf(a)} b={seqOf(b)} />
            <CompareRow label="CAS Number" a={a.identity?.cas ?? null} b={b.identity?.cas ?? null} />
            <CompareRow label="Half-Life" a={halfLifeOf(a)} b={halfLifeOf(b)} />
            <CompareRow
              label="Studied For"
              a={(a.studied_for ?? []).filter(Boolean).slice(0, 4).join(', ') || null}
              b={(b.studied_for ?? []).filter(Boolean).slice(0, 4).join(', ') || null}
            />
          </tbody>
        </table>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4, 16px)', margin: '0 0 28px' }}>
        {[a, b].map((c) => (
          <div key={c.slug} style={{ border: '1px solid rgba(192,184,168,0.14)', borderRadius: 12, padding: 'var(--space-4, 16px)' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 8px' }}>About {c.display_name}</h2>
            {c.plain_summary && <p style={{ margin: '0 0 10px', lineHeight: 1.6, fontSize: '0.95rem' }}>{c.plain_summary}</p>}
            <Link href={`/research/${c.slug}`} style={linkStyle}>Read The Full {c.display_name} Monograph</Link>
          </div>
        ))}
      </section>

      {diffs.length > 0 && (
        <section style={{ margin: '0 0 28px' }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '0 0 10px' }}>Key Differences</h2>
          <ul style={{ margin: 0, paddingLeft: '1.2rem', lineHeight: 1.7 }}>
            {diffs.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </section>
      )}

      <section style={{ margin: '0 0 8px' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 8px' }}>Continue Researching</h2>
        <p style={{ margin: 0, lineHeight: 1.7 }}>
          <Link href={`/research/${a.slug}`} style={linkStyle}>{a.display_name}</Link>{' · '}
          <Link href={`/research/${b.slug}`} style={linkStyle}>{b.display_name}</Link>{' · '}
          <Link href="/research/compare" style={linkStyle}>Compare Tool</Link>{' · '}
          <Link href="/research" style={linkStyle}>Research Library</Link>
        </p>
      </section>

      <p style={{ fontSize: '0.85rem', color: 'var(--silver, #A8B4C0)', margin: '20px 0 0' }}>
        This Comparison Is Provided For In Vitro Laboratory Research Use Only. Not For Human Consumption, Diagnosis, Or
        Treatment. See The <Link href="/disclaimer" style={{ color: 'var(--teal, #00C4BC)' }}>Full Research Disclaimer</Link>.
      </p>
    </article>
  );
}
