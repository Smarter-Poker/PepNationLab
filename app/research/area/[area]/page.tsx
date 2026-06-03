/**
 * Research Area hub — deep landing page for one of the 15 research-areas.
 * Server component. Progressive disclosure via AreaContentTabs.
 *
 * Tabs: Overview | Mechanisms | Evidence | Safety | Compounds | References
 */

import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAllCompounds } from '@/lib/compounds-server';
import { RESEARCH_AREAS, researchAreaLabel, evidenceTier, wadaLabel } from '@/lib/compounds';
import { RESEARCH_AREA_CONTENT } from '@/lib/research-area-content';
import AreaContentTabs from '@/components/research/AreaContentTabs';
import type { AreaTab } from '@/components/research/AreaContentTabs';

type PageProps = { params: Promise<{ area: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { area } = await params;
  const label = RESEARCH_AREAS[area]?.label ?? 'Research Area';
  return {
    title: `${label} | Research Library | Pep Nation Lab`,
    robots: { index: false, follow: false },
  };
}

const sectionHeadStyle: CSSProperties = {
  fontSize: '1.15rem',
  fontWeight: 800,
  color: 'var(--white, #FFFFFF)',
  margin: 0,
  marginBottom: 'var(--space-3, 12px)',
};

const bodyTextStyle: CSSProperties = {
  color: 'var(--silver-light, #D0DAE4)',
  fontSize: '0.95rem',
  lineHeight: 1.7,
  margin: 0,
};

const bulletListStyle: CSSProperties = {
  margin: 0,
  paddingLeft: '1.2rem',
  color: 'var(--silver-light, #D0DAE4)',
};

const bulletItemStyle: CSSProperties = {
  fontSize: '0.92rem',
  lineHeight: 1.6,
  marginBottom: 'var(--space-2, 8px)',
};

export default async function ResearchAreaPage({ params }: PageProps) {
  const { area } = await params;

  if (!RESEARCH_AREAS[area]) {
    notFound();
  }

  const meta = RESEARCH_AREAS[area];
  const content = RESEARCH_AREA_CONTENT[area];
  const all = await getAllCompounds();
  const compounds = all.filter((c) => (c.research_areas ?? []).includes(area));

  const bySlug: Record<string, (typeof all)[number]> = {};
  for (const c of all) {
    bySlug[c.slug] = c;
  }

  // Build tabs
  const tabs: AreaTab[] = [];

  // ── Overview tab ──
  if (content) {
    tabs.push({
      key: 'overview',
      label: 'Overview',
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5, 24px)' }}>
          <section className="card-metal" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)' }}>
            <h2 style={sectionHeadStyle}>Overview</h2>
            <p style={bodyTextStyle}>{content.overview}</p>
          </section>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-4, 16px)' }}>
            <section className="card-metal" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)' }}>
              <h2 style={sectionHeadStyle}>Key Mechanisms</h2>
              <ul style={bulletListStyle}>
                {content.keyMechanisms.map((m, i) => (
                  <li key={i} style={bulletItemStyle}>{m}</li>
                ))}
              </ul>
            </section>
            <section className="card-metal" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)' }}>
              <h2 style={sectionHeadStyle}>Studied For (Research Use Cases)</h2>
              <ul style={bulletListStyle}>
                {content.studiedFor.map((m, i) => (
                  <li key={i} style={bulletItemStyle}>{m}</li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      ),
    });
  } else {
    tabs.push({
      key: 'overview',
      label: 'Overview',
      children: (
        <section className="card-metal" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)' }}>
          <p style={bodyTextStyle}>{meta.blurb}</p>
        </section>
      ),
    });
  }

  // ── Compounds tab ──
  tabs.push({
    key: 'compounds',
    label: `Compounds (${compounds.length})`,
    children:
      compounds.length === 0 ? (
        <div className="card-metal" style={{ padding: 'var(--space-6, 32px)', textAlign: 'center', color: 'var(--silver, #A8B4C0)', borderRadius: 'var(--radius-lg, 12px)' }}>
          No Compounds Are Currently Listed For This Research Area.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'var(--space-4, 16px)' }}>
          {compounds.map((c) => {
            const t = evidenceTier(c.evidence_tier);
            const aliasLine = (c.aliases ?? []).slice(0, 3).join(', ');
            return (
              <Link
                key={c.slug}
                href={`/research/${c.slug}`}
                className="card-metal"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-2, 8px)',
                  padding: 'var(--space-4, 16px)',
                  borderRadius: 'var(--radius-lg, 12px)',
                  textDecoration: 'none',
                  color: 'var(--white, #FFFFFF)',
                  height: '100%',
                }}
              >
                <span style={{ display: 'inline-flex', alignSelf: 'flex-start', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: t.color, border: `1px solid ${t.color}`, borderRadius: '999px', padding: '2px 10px' }}>
                  {t.label}
                </span>
                <span style={{ fontSize: '1.05rem', fontWeight: 700 }}>{c.display_name}</span>
                {aliasLine && <span style={{ fontSize: '0.8rem', color: 'var(--silver, #A8B4C0)' }}>{aliasLine}</span>}
                {c.category && <span style={{ fontSize: '0.75rem', color: 'var(--teal, #00C4BC)', marginTop: 'auto' }}>{c.category}</span>}
                {c.wada_status && c.wada_status !== 'not_listed' && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--silver, #A8B4C0)' }}>{wadaLabel(c.wada_status)}</span>
                )}
              </Link>
            );
          })}
        </div>
      ),
  });

  // ── Evidence tab ──
  if (content) {
    const evidenceChildren = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4, 16px)' }}>
        <section className="card-metal" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)' }}>
          <h2 style={sectionHeadStyle}>Evidence Landscape</h2>
          <p style={bodyTextStyle}>{content.evidenceLandscape}</p>
        </section>
        {content.topCompounds.length > 0 && (
          <section>
            <h2 style={{ ...sectionHeadStyle, marginBottom: 'var(--space-3, 12px)' }}>Most-Studied Compounds In This Area</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--space-3, 12px)' }}>
              {content.topCompounds.map((slug, i) => {
                const c = bySlug[slug];
                if (!c) return null;
                const t = evidenceTier(c.evidence_tier);
                return (
                  <Link key={slug} href={`/research/${slug}`} className="card-metal" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1, 4px)', padding: 'var(--space-3, 12px) var(--space-4, 16px)', borderRadius: 'var(--radius-lg, 12px)', textDecoration: 'none', color: 'var(--white, #FFFFFF)' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--silver, #A8B4C0)' }}>#{i + 1} Most Studied</span>
                    <span style={{ fontSize: '1rem', fontWeight: 700 }}>{c.display_name}</span>
                    <span style={{ fontSize: '0.72rem', color: t.color }}>{t.label}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
        {content.topStacks && content.topStacks.length > 0 && (
          <section className="card-metal" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)' }}>
            <h2 style={sectionHeadStyle}>Stacks Studied In This Area</h2>
            <ul style={bulletListStyle}>
              {content.topStacks.map((s, i) => <li key={i} style={bulletItemStyle}>{s}</li>)}
            </ul>
            <p style={{ ...bodyTextStyle, fontSize: '0.82rem', marginTop: 'var(--space-3, 12px)', color: 'var(--silver, #A8B4C0)' }}>
              Stack combinations reflect the research literature only. Not clinical guidance.
            </p>
          </section>
        )}
      </div>
    );
    tabs.push({ key: 'evidence', label: 'Evidence', children: evidenceChildren });
  }

  // ── Safety tab ──
  if (content) {
    tabs.push({
      key: 'safety',
      label: 'Safety',
      children: (
        <section className="card-metal" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)', borderLeft: '3px solid var(--red-600, #E53E3E)' }}>
          <h2 style={sectionHeadStyle}>Notable Safety Considerations</h2>
          <p style={bodyTextStyle}>{content.notableSafety}</p>
        </section>
      ),
    });
  }

  // ── References tab ──
  if (content && content.keyReferences.length > 0) {
    tabs.push({
      key: 'references',
      label: 'References',
      children: (
        <section className="card-metal" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)' }}>
          <h2 style={sectionHeadStyle}>Key References</h2>
          <ol style={{ ...bulletListStyle, listStyleType: 'decimal', paddingLeft: '1.4rem' }}>
            {content.keyReferences.map((r, i) => (
              <li key={i} style={bulletItemStyle}>
                {r.url ? (
                  <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--teal, #00C4BC)', textDecoration: 'none' }}>
                    {r.citation}
                  </a>
                ) : (
                  r.citation
                )}
              </li>
            ))}
          </ol>
        </section>
      ),
    });
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: 'var(--space-6, 32px) var(--space-4, 16px)' }}>
      <nav style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Link href="/research" style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.9rem', textDecoration: 'none' }}>
          Back To Research Library
        </Link>
        {' '}·{' '}
        <Link href="/research/areas" style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.9rem', textDecoration: 'none' }}>
          All Areas
        </Link>
      </nav>

      <header style={{ marginBottom: 'var(--space-5, 24px)' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--white, #FFFFFF)', margin: 0 }}>
          {researchAreaLabel(area)}
        </h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.05rem', marginTop: 'var(--space-2, 8px)', maxWidth: '760px' }}>
          {meta.blurb}
        </p>
      </header>

      <AreaContentTabs tabs={tabs} />
    </div>
  );
}
