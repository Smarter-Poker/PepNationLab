/**
 * Research Library index — the entry point to the PepNationLab Research section.
 * Server component: fetches the full compound catalog, renders research-area
 * tiles, quick links, the Ask The Lab assistant, and the faceted browser.
 * Research-use-only framing throughout.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { GitCompare, Layers, ShieldCheck, GraduationCap, BookOpen, HelpCircle, Sparkles, Calculator, Library, Table2 } from 'lucide-react';
import { getAllCompounds } from '@/lib/compounds-server';
import { RESEARCH_AREAS } from '@/lib/compounds';
import AskTheLab from '@/components/research/AskTheLab';
import ResearchBrowser from '@/components/research/ResearchBrowser';
import UniversalSearch from '@/components/research/UniversalSearch';
import { buildResearchSearchDocs } from '@/lib/research-search-docs';

export const metadata: Metadata = {
  title: 'Research Library | Pep Nation Lab',
  robots: { index: false, follow: false },
};

export default async function ResearchLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const compounds = await getAllCompounds();
  const searchIndex = buildResearchSearchDocs(compounds);

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: 'var(--space-6, 32px) var(--space-4, 16px)' }}>
      <header style={{ marginBottom: 'var(--space-5, 24px)' }}>
        <h1
          style={{
            fontSize: '2.25rem',
            fontWeight: 900,
            color: 'var(--white, #FFFFFF)',
            margin: 0,
          }}
        >
          Research Library
        </h1>
        <p
          style={{
            color: 'var(--silver, #A8B4C0)',
            fontSize: '1.05rem',
            marginTop: 'var(--space-2, 8px)',
            maxWidth: '720px',
          }}
        >
          Factual, Research-Use-Only Reference For Every Compound In The Catalog. Fifteen Research
          Areas, Every Sold Compound Profiled, And A Match-Me Engine To Suggest Candidates From Your
          Research Goal. For Laboratory Research Only.
        </p>
      </header>

      {/* Universal instant search across compounds, areas, guides, glossary, FAQ */}
      <section style={{ marginBottom: 'var(--space-7, 48px)' }}>
        <UniversalSearch docs={searchIndex} initialQuery={q ?? ''} autoFocus={Boolean(q)} />
      </section>

      <section style={{ marginBottom: 'var(--space-7, 48px)' }}>
        <h2
          style={{
            fontSize: '1.35rem',
            fontWeight: 800,
            color: 'var(--white, #FFFFFF)',
            marginBottom: 'var(--space-4, 16px)',
          }}
        >
          Browse By Research Area
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 'var(--space-4, 16px)',
          }}
        >
          {Object.keys(RESEARCH_AREAS).map((key) => {
            const meta = RESEARCH_AREAS[key];
            return (
              <Link
                key={key}
                href={`/research/area/${key}`}
                className="card-metal"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-2, 8px)',
                  padding: 'var(--space-4, 16px)',
                  borderRadius: 'var(--radius-lg, 12px)',
                  textDecoration: 'none',
                  color: 'var(--white, #FFFFFF)',
                }}
              >
                <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--teal, #00C4BC)' }}>
                  {meta.label}
                </span>
                <span style={{ fontSize: '0.85rem', color: 'var(--silver, #A8B4C0)' }}>{meta.blurb}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-3, 12px)',
          marginBottom: 'var(--space-7, 48px)',
        }}
      >
        <Link
          href="/research/match"
          className="btn-primary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2, 8px)',
            textDecoration: 'none',
          }}
        >
          <Sparkles size={18} aria-hidden="true" />
          Match Me To A Peptide
        </Link>
        <Link
          href="/research/compare"
          className="btn-secondary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2, 8px)',
            textDecoration: 'none',
          }}
        >
          <GitCompare size={18} aria-hidden="true" />
          Compare Compounds
        </Link>
        <Link
          href="/research/data"
          className="btn-secondary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2, 8px)',
            textDecoration: 'none',
          }}
        >
          <Table2 size={18} aria-hidden="true" />
          Full Data Table
        </Link>
        <Link
          href="/research/stacks"
          className="btn-secondary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2, 8px)',
            textDecoration: 'none',
          }}
        >
          <Layers size={18} aria-hidden="true" />
          Stacks And Combinations
        </Link>
        <Link
          href="/research/evidence"
          className="btn-secondary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2, 8px)',
            textDecoration: 'none',
          }}
        >
          <ShieldCheck size={18} aria-hidden="true" />
          Evidence And Safety
        </Link>
        <Link
          href="/research/learn"
          className="btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2, 8px)', textDecoration: 'none' }}
        >
          <GraduationCap size={18} aria-hidden="true" />
          Learn
        </Link>
        <Link
          href="/research/glossary"
          className="btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2, 8px)', textDecoration: 'none' }}
        >
          <BookOpen size={18} aria-hidden="true" />
          Glossary
        </Link>
        <Link
          href="/research/faq"
          className="btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2, 8px)', textDecoration: 'none' }}
        >
          <HelpCircle size={18} aria-hidden="true" />
          FAQ
        </Link>
        <Link
          href="/research/converter"
          className="btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2, 8px)', textDecoration: 'none' }}
        >
          <Calculator size={18} aria-hidden="true" />
          Dosing & Unit Converter
        </Link>
        <Link
          href="/research/references"
          className="btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2, 8px)', textDecoration: 'none' }}
        >
          <Library size={18} aria-hidden="true" />
          References
        </Link>
      </section>

      <section style={{ marginBottom: 'var(--space-7, 48px)' }}>
        <AskTheLab />
      </section>

      <ResearchBrowser compounds={compounds} />
    </div>
  );
}
