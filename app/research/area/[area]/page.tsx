/**
 * Research Area hub — lists every compound studied within a single research
 * area. Server component. Research-use-only framing throughout.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAllCompounds } from '@/lib/compounds-server';
import { RESEARCH_AREAS, researchAreaLabel, evidenceTier, wadaLabel } from '@/lib/compounds';

type PageProps = { params: Promise<{ area: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { area } = await params;
  const label = RESEARCH_AREAS[area]?.label ?? 'Research Area';
  return {
    title: `${label} | Research Library | Pep Nation Lab`,
    robots: { index: false, follow: false },
  };
}

export default async function ResearchAreaPage({ params }: PageProps) {
  const { area } = await params;

  if (!RESEARCH_AREAS[area]) {
    notFound();
  }

  const meta = RESEARCH_AREAS[area];
  const all = await getAllCompounds();
  const compounds = all.filter((c) => (c.research_areas ?? []).includes(area));

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: 'var(--space-6, 32px) var(--space-4, 16px)' }}>
      <nav style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Link href="/research" style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.9rem', textDecoration: 'none' }}>
          Back To Research Library
        </Link>
      </nav>

      <header style={{ marginBottom: 'var(--space-6, 32px)' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--white, #FFFFFF)', margin: 0 }}>
          {researchAreaLabel(area)}
        </h1>
        <p
          style={{
            color: 'var(--silver, #A8B4C0)',
            fontSize: '1.05rem',
            marginTop: 'var(--space-2, 8px)',
            maxWidth: '720px',
          }}
        >
          {meta.blurb}
        </p>
      </header>

      {compounds.length === 0 ? (
        <div
          className="card-glass"
          style={{
            padding: 'var(--space-6, 32px)',
            textAlign: 'center',
            color: 'var(--silver, #A8B4C0)',
            borderRadius: 'var(--radius-lg, 12px)',
          }}
        >
          No Compounds Are Currently Listed For This Research Area.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 'var(--space-4, 16px)',
          }}
        >
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
                <span
                  style={{
                    display: 'inline-flex',
                    alignSelf: 'flex-start',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: t.color,
                    border: `1px solid ${t.color}`,
                    borderRadius: '999px',
                    padding: '2px 10px',
                  }}
                >
                  {t.label}
                </span>
                <span style={{ fontSize: '1.05rem', fontWeight: 700 }}>{c.display_name}</span>
                {aliasLine && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--silver, #A8B4C0)' }}>{aliasLine}</span>
                )}
                {c.category && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--teal, #00C4BC)', marginTop: 'auto' }}>
                    {c.category}
                  </span>
                )}
                {c.wada_status && c.wada_status !== 'not_listed' && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--silver, #A8B4C0)' }}>
                    {wadaLabel(c.wada_status)}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
