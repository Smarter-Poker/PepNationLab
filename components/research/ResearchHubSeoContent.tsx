/**
 * ResearchHubSeoContent - SERVER component (no 'use client').
 *
 * Emits a crawlable H1, intro copy, tool/area navigation, and the full
 * compound index into the initial HTML of /research so that search engines
 * and non-JS AI crawlers can read and enumerate the library without running
 * the client-rendered ResearchLandingClient.
 *
 * Fails soft: if the database is unreachable (e.g. preview build with no env),
 * it still renders the static intro + tool links.
 *
 * Title Case on all headings/labels. No emojis.
 */

import Link from 'next/link';
import { getAllCompounds } from '@/lib/compounds-server';

const TOOL_LINKS: Array<{ href: string; label: string }> = [
  { href: '/research/catalog', label: 'Full Compound Catalog' },
  { href: '/research/a-z', label: 'A To Z Index' },
  { href: '/research/areas', label: 'Browse By Research Area' },
  { href: '/research/glossary', label: 'Peptide Science Glossary' },
  { href: '/research/calculators', label: 'Reconstitution Calculators' },
  { href: '/research/compare', label: 'Compare Compounds' },
  { href: '/research/stacks', label: 'Research Stacks' },
  { href: '/research/match', label: 'AI Match Engine' },
  { href: '/research/most-cited', label: 'Most-Cited Compounds' },
  { href: '/research/approved-drugs', label: 'Approved Drugs' },
  { href: '/research/faq', label: 'Research Library FAQ' },
  { href: '/research/methodology', label: 'Editorial Standards And Methodology' },
];

export default async function ResearchHubSeoContent() {
  let compounds: Awaited<ReturnType<typeof getAllCompounds>> = [];
  try {
    compounds = await getAllCompounds();
  } catch {
    compounds = [];
  }

  // Group compounds by research area for a crawlable, well-structured index.
  const byCategory = new Map<string, Array<{ slug: string; name: string }>>();
  for (const c of compounds) {
    const cat = c.category ?? 'Other Compounds';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push({ slug: c.slug, name: c.display_name });
  }
  const categories = Array.from(byCategory.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <section
      aria-label="Research Library Overview"
      style={{
        maxWidth: '1100px',
        margin: '0 auto',
        padding: 'var(--space-6, 32px) var(--space-4, 16px)',
        color: 'var(--white, #fff)',
      }}
    >
      <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 800, margin: '0 0 12px' }}>
        Peptide Research Library
      </h1>
      <p style={{ fontSize: '1.05rem', lineHeight: 1.6, margin: '0 0 12px', maxWidth: '70ch' }}>
        The Pep Nation Lab Research Library Is A Comprehensive, Citation-Backed Database Of{' '}
        {compounds.length > 0 ? `${compounds.length}+` : '300+'} Research-Grade Peptides And Compounds.
        Each Monograph Covers Mechanism Of Action, Evidence Tier, Pharmacokinetics, Molecular Identity,
        Handling, And Referenced Findings. Browse By Therapeutic Area, Mechanism, Half-Life, Molecular
        Weight, Or Evidence Tier, Or Use The Match Engine To Find Compounds By Research Goal.
      </p>
      <p style={{ fontSize: '0.9rem', color: 'var(--silver, #A8B4C0)', margin: '0 0 24px' }}>
        All Content And Products Are For In Vitro Laboratory Research Use Only. Not For Human Consumption.
      </p>

      <nav aria-label="Research Tools And Filters" style={{ margin: '0 0 28px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 10px' }}>Research Tools And Filters</h2>
        <ul style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 18px', listStyle: 'none', padding: 0, margin: 0 }}>
          {TOOL_LINKS.map((t) => (
            <li key={t.href}>
              <Link href={t.href} style={{ color: 'var(--teal, #00C4BC)', fontWeight: 600 }}>
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {categories.length > 0 && (
        <div aria-label="Compound Index By Research Area">
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 12px' }}>Browse All Compounds</h2>
          {categories.map(([cat, items]) => (
            <div key={cat} style={{ margin: '0 0 20px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 8px', color: 'var(--silver, #D0DAE4)' }}>
                {cat}
              </h3>
              <ul style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', listStyle: 'none', padding: 0, margin: 0 }}>
                {items.map((it) => (
                  <li key={it.slug}>
                    <Link href={`/research/${it.slug}`} style={{ color: 'var(--teal, #00C4BC)' }}>
                      {it.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
