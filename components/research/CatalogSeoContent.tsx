/**
 * CatalogSeoContent - SERVER component (no 'use client').
 *
 * /research/catalog ("Research Intelligence Center") renders its entire UI
 * through client components (ResearchBrowser, MatchEngineCards, TrendingCarousel,
 * ...), so the initial HTML carries almost no crawlable text - just JSON-LD and
 * a loading fallback. This block renders the catalog's real semantic content -
 * an H1, an intro, every research-goal area, the browse-by facets, and a full
 * A-Z index of every compound linked to its monograph - into the initial HTML,
 * visually hidden via the site-wide clip-rect pattern (crawler- and screen-
 * reader-accessible; it mirrors the catalog's real content, NOT keyword
 * stuffing). Title Case on headings/labels. No emojis. Do not remove.
 */

import Link from 'next/link';
import type { Compound } from '@/lib/compounds';
import { RESEARCH_AREAS } from '@/lib/compounds';
import { DEFAULT_STORE_SLUG } from '@/lib/default-store';

const FACETS: [string, string][] = [
  ['/research/a-z', 'A-Z Compound Index'],
  ['/research/by-class', 'Browse By Compound Class'],
  ['/research/by-mechanism', 'Browse By Mechanism Of Action'],
  ['/research/by-half-life', 'Browse By Half-Life'],
  ['/research/by-mw', 'Browse By Molecular Weight'],
  ['/research/by-route', 'Browse By Administration Route'],
  ['/research/by-target', 'Browse By Molecular Target'],
  ['/research/most-cited', 'Most-Cited Research Compounds'],
  ['/research/most-studied-2026', 'Most-Studied Research Compounds'],
  ['/research/stacks', 'Research Stacks'],
  ['/research/match', 'Match Me To A Peptide'],
  ['/research/compare', 'Compare Compounds'],
  ['/research/calculators', 'Research Calculators'],
];

export default function CatalogSeoContent({ compounds }: { compounds: Compound[] }) {
  const areas = Object.entries(RESEARCH_AREAS) as [string, { label: string; blurb: string }][];
  const sorted = [...compounds]
    .filter((c) => c.slug && c.display_name)
    .sort((a, b) => a.display_name.localeCompare(b.display_name));

  return (
    <section
      aria-label="Peptide Research Catalog"
      style={{
        position: 'absolute',
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}
    >
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <h1>Peptide Research Catalog</h1>

        <p>
          The Pep Nation Lab Research Catalog Is A Comprehensive Database Of {sorted.length} Research-Grade
          Peptides And Compounds For Qualified Researchers And Institutions. Every Entry Links To A Full
          Monograph With Mechanism Of Action, Evidence Tier, Pharmacokinetics, Half-Life, Molecular Weight,
          Administration Route, And Referenced Findings. Browse By Research Goal, By Compound Class, By
          Mechanism, Or By Molecular Target, Or Use The Match Engine To Rank Candidates Against A Stated
          Research Goal.
        </p>

        <p>
          Everything In This Catalog Is Provided Strictly For In Vitro Laboratory Research Use Only And Is
          Not For Human Consumption, Diagnosis, Or Treatment. See The{' '}
          <Link href="/disclaimer">Full Research Disclaimer</Link>,{' '}
          <Link href="/compliance">Compliance Policy</Link>, And{' '}
          <Link href="/terms">Terms Of Service</Link>.
        </p>

        <h2>Browse By Research Goal</h2>
        <ul>
          {areas.map(([slug, meta]) => (
            <li key={slug}>
              <Link href={`/research/area/${slug}`}>{meta.label} Peptides</Link>
              <p>{meta.blurb}</p>
            </li>
          ))}
        </ul>

        <h2>Browse The Catalog</h2>
        <ul>
          {FACETS.map(([href, label]) => (
            <li key={href}>
              <Link href={href}>{label}</Link>
            </li>
          ))}
        </ul>

        <h2>All Research Compounds</h2>
        <ul>
          {sorted.map((c) => (
            <li key={c.slug}>
              <Link href={`/research/${c.slug}`}>{c.display_name} Research</Link>
            </li>
          ))}
        </ul>

        <p>
          Ready To Order?{' '}
          <Link href={`/${DEFAULT_STORE_SLUG}`}>Browse The Pep Nation Research Store</Link> Or{' '}
          <Link href="/peptide-101">Learn The Basics In Peptide 101</Link>.
        </p>
      </div>
    </section>
  );
}
