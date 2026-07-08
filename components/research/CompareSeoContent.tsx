/**
 * CompareSeoContent - SERVER component (no 'use client').
 *
 * The interactive CompareTool is client-rendered, so crawlers and non-JS AI
 * fetchers see only the page header. This block renders real, crawlable content
 * beneath the tool: an intro, a "Popular Comparisons" grid that internally links
 * every curated /research/compare/[matchup] page (otherwise those pages are
 * orphaned from their most relevant parent), a directory of comparable
 * compounds, and an FAQ with FAQPage schema for rich-result eligibility.
 *
 * Title Case headings/labels. No emojis. Research-use-only framing.
 */

import Link from 'next/link';
import type { Compound } from '@/lib/compounds';
import { COMPARISON_PAIRS, matchupSlug } from '@/lib/research/comparisons';

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: 'What Can I Compare With The Pep Nation Lab Comparison Tool?',
    a: 'Any research-grade compound in the library can be placed side by side - up to four at a time. The tool compares mechanism of action, molecular target, evidence tier, molecular weight, amino acid sequence, reported half-life, and what each compound has been studied for, all drawn from referenced monographs.',
  },
  {
    q: 'What Does The Evidence Tier Mean?',
    a: 'The evidence tier reflects how extensively a compound has been studied in the referenced literature, from early preclinical signals through to compounds with human clinical data. It is a research-quality signal only, never a safety or efficacy endorsement.',
  },
  {
    q: 'How Are "X vs Y" Comparison Pages Built?',
    a: 'Each comparison page is generated from the same referenced compound database - a genuine side-by-side of mechanism, identity, pharmacokinetics, and evidence, plus data-derived key differences. They are curated, not auto-generated thin pages.',
  },
  {
    q: 'Is Any Of This Medical Or Dosing Advice?',
    a: 'No. Every comparison is for in vitro laboratory research use only. Nothing here is medical advice, a treatment recommendation, or dosing guidance, and no product is for human or animal consumption.',
  },
];

export default function CompareSeoContent({ compounds }: { compounds: Compound[] }) {
  const nameOf = new Map(compounds.map((c) => [c.slug, c.display_name] as const));

  // Compounds featured in curated comparisons, deduped, for a focused directory.
  const featuredSlugs = Array.from(
    new Set(COMPARISON_PAIRS.flatMap((p) => [p.a, p.b])),
  ).filter((s) => nameOf.has(s));

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <section
      aria-label="About The Compound Comparison Tool"
      style={{ maxWidth: 1200, margin: '48px auto 0', padding: '0 var(--space-4, 16px) var(--space-8, 48px)', color: 'var(--white, #fff)' }}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <div style={{ borderTop: '1px solid rgba(192,184,168,0.12)', paddingTop: 'var(--space-7, 40px)' }}>
        <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 800, margin: '0 0 12px' }}>
          Compare Research Peptides Side By Side
        </h2>
        <p style={{ fontSize: '1rem', lineHeight: 1.7, margin: '0 0 8px', maxWidth: '75ch', color: 'var(--silver, #D0DAE4)' }}>
          Pep Nation Lab&apos;s comparison tool puts research-grade peptides and compounds head to head - mechanism of
          action, molecular target, evidence tier, molecular weight, sequence, half-life, and documented research
          focus - so qualified researchers can evaluate the differences that matter. Every data point is drawn from a
          referenced monograph. For in vitro laboratory research use only.
        </p>
      </div>

      <div style={{ marginTop: 'var(--space-7, 40px)' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 16px' }}>Popular Research Comparisons</h2>
        <ul
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 'var(--space-4, 16px)',
            listStyle: 'none',
            padding: 0,
            margin: 0,
          }}
        >
          {COMPARISON_PAIRS.map((p) => {
            const aName = nameOf.get(p.a) ?? p.a;
            const bName = nameOf.get(p.b) ?? p.b;
            return (
              <li
                key={`${p.a}-${p.b}`}
                style={{ border: '1px solid rgba(192,184,168,0.14)', borderRadius: 12, padding: 'var(--space-4, 16px)', background: 'rgba(255,255,255,0.02)' }}
              >
                <Link href={`/research/compare/${matchupSlug(p.a, p.b)}`} style={{ color: 'var(--teal, #00C4BC)', fontWeight: 700, fontSize: '1.02rem', textDecoration: 'none' }}>
                  {aName} vs {bName}
                </Link>
                <p style={{ margin: '6px 0 0', fontSize: '0.86rem', lineHeight: 1.55, color: 'var(--silver, #A8B4C0)' }}>
                  {p.angle.charAt(0).toUpperCase() + p.angle.slice(1)}.
                </p>
              </li>
            );
          })}
        </ul>
      </div>

      <div style={{ marginTop: 'var(--space-7, 40px)' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 12px' }}>Compounds You Can Compare</h2>
        <ul style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px', listStyle: 'none', padding: 0, margin: '0 0 12px' }}>
          {featuredSlugs.map((slug) => (
            <li key={slug}>
              <Link href={`/research/${slug}`} style={{ color: 'var(--teal, #00C4BC)' }}>
                {nameOf.get(slug)}
              </Link>
            </li>
          ))}
        </ul>
        <p style={{ fontSize: '0.9rem', color: 'var(--silver, #A8B4C0)', margin: 0 }}>
          Browse the{' '}
          <Link href="/research/catalog" style={{ color: 'var(--teal, #00C4BC)' }}>full research catalog</Link>{' '}or the{' '}
          <Link href="/research/a-z" style={{ color: 'var(--teal, #00C4BC)' }}>A To Z index</Link>{' '}to compare any compound.
        </p>
      </div>

      <div style={{ marginTop: 'var(--space-7, 40px)' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 16px' }}>Comparison Tool FAQ</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)' }}>
          {FAQS.map((f) => (
            <details key={f.q} style={{ border: '1px solid rgba(192,184,168,0.14)', borderRadius: 10, padding: '14px 16px' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: '0.98rem' }}>{f.q}</summary>
              <p style={{ margin: '10px 0 0', lineHeight: 1.65, fontSize: '0.92rem', color: 'var(--silver, #D0DAE4)' }}>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
