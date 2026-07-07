/**
 * HomeSeoContent - SERVER component (no 'use client').
 *
 * The landing artwork (HomeClient) is an image with invisible click-zones and
 * carries no crawlable text. This block renders the homepage's real semantic
 * content - a single H1, an intro, and descriptive internal links - into the
 * initial HTML beneath the artwork, so search engines and non-JS AI crawlers
 * understand what the site is and can follow context-rich links into the key
 * sections.
 *
 * Title Case on all headings/labels/link text. No emojis.
 */

import Link from 'next/link';
import { DEFAULT_STORE_SLUG } from '@/lib/default-store';

const SECTION_LINKS: Array<{ href: string; label: string; blurb: string }> = [
  {
    href: '/research',
    label: 'Peptide Research Library',
    blurb: 'A citation-backed database of 300+ research-grade peptides with mechanism, evidence tier, pharmacokinetics, and referenced findings.',
  },
  {
    href: '/find-a-peptide',
    label: 'Find A Peptide',
    blurb: 'Discover compounds by research goal, therapeutic area, mechanism, half-life, and evidence tier.',
  },
  {
    href: '/peptide-101',
    label: 'Peptide 101 Research Academy',
    blurb: 'Foundational education on peptide science, reconstitution, handling, and laboratory research best practices.',
  },
  {
    href: '/research/calculators',
    label: 'Reconstitution Calculators',
    blurb: 'Precision reconstitution and dilution calculators for laboratory research workflows.',
  },
  {
    href: '/research/compare',
    label: 'Compare Compounds',
    blurb: 'Side-by-side comparison of mechanisms, half-lives, molecular weights, and evidence tiers.',
  },
  {
    href: `/${DEFAULT_STORE_SLUG}`,
    label: 'Browse The Research Catalog',
    blurb: 'Wholesale research peptide catalog for qualified researchers and institutions.',
  },
];

export default function HomeSeoContent() {
  return (
    <section
      aria-label="About Pep Nation Lab"
      style={{
        background: '#020617',
        color: 'var(--white, #fff)',
        padding: 'var(--space-8, 48px) var(--space-4, 16px)',
      }}
    >
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <h1 style={{ fontSize: 'clamp(1.8rem, 4.5vw, 2.8rem)', fontWeight: 800, margin: '0 0 16px', lineHeight: 1.15 }}>
          Pep Nation Lab - Premium Research Peptide Distribution And Peptide Research Library
        </h1>

        <p style={{ fontSize: '1.1rem', lineHeight: 1.65, margin: '0 0 16px', maxWidth: '72ch' }}>
          Pep Nation Lab Is A Wholesale Research Peptide Distribution Platform And Comprehensive Research
          Library Built For Qualified Researchers And Institutions. Access 300+ Research-Grade Compounds -
          Including BPC-157, TB-500, Semaglutide, Tirzepatide, GHK-Cu, Ipamorelin, And More - Alongside Full
          Scientific Monographs, Reconstitution Calculators, A Comparison Engine, And An AI Match Engine.
        </p>

        <p style={{ fontSize: '0.95rem', lineHeight: 1.6, margin: '0 0 28px', color: 'var(--silver, #D0DAE4)', maxWidth: '72ch' }}>
          Every Product And Reference On This Platform Is Provided Strictly For In Vitro Laboratory Research
          Use Only. Nothing Sold Or Described Here Is For Human Consumption, Diagnosis, Treatment, Or Any
          Clinical Use. See The <Link href="/disclaimer" style={{ color: 'var(--teal, #00C4BC)' }}>Full Research Disclaimer</Link>,{' '}
          <Link href="/compliance" style={{ color: 'var(--teal, #00C4BC)' }}>Compliance Policy</Link>, And{' '}
          <Link href="/terms" style={{ color: 'var(--teal, #00C4BC)' }}>Terms Of Service</Link>.
        </p>

        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 16px' }}>Explore The Platform</h2>
        <ul
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 'var(--space-4, 16px)',
            listStyle: 'none',
            padding: 0,
            margin: '0 0 28px',
          }}
        >
          {SECTION_LINKS.map((s) => (
            <li
              key={s.href}
              style={{
                border: '1px solid rgba(192,184,168,0.14)',
                borderRadius: 12,
                padding: 'var(--space-4, 16px)',
                background: 'rgba(255,255,255,0.02)',
              }}
            >
              <Link href={s.href} style={{ color: 'var(--teal, #00C4BC)', fontWeight: 700, fontSize: '1.05rem' }}>
                {s.label}
              </Link>
              <p style={{ margin: '6px 0 0', fontSize: '0.9rem', lineHeight: 1.55, color: 'var(--silver, #A8B4C0)' }}>
                {s.blurb}
              </p>
            </li>
          ))}
        </ul>

        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 12px' }}>Popular Research Compounds</h2>
        <ul style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px', listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
          {[
            ['bpc-157', 'BPC-157'],
            ['tb-500', 'TB-500'],
            ['semaglutide', 'Semaglutide'],
            ['tirzepatide', 'Tirzepatide'],
            ['ghk-cu', 'GHK-Cu'],
            ['ipamorelin', 'Ipamorelin'],
            ['cjc-1295-dac', 'CJC-1295'],
            ['retatrutide', 'Retatrutide'],
            ['nad-plus', 'NAD+'],
            ['epithalon', 'Epithalon'],
          ].map(([slug, name]) => (
            <li key={slug}>
              <Link href={`/research/${slug}`} style={{ color: 'var(--teal, #00C4BC)' }}>
                {name} Research
              </Link>
            </li>
          ))}
        </ul>

        <p style={{ fontSize: '0.9rem', color: 'var(--silver, #A8B4C0)', margin: 0 }}>
          New To The Platform?{' '}
          <Link href="/signup" style={{ color: 'var(--teal, #00C4BC)' }}>Create A Researcher Account</Link> Or{' '}
          <Link href="/about" style={{ color: 'var(--teal, #00C4BC)' }}>Learn More About Pep Nation Lab</Link>.
        </p>
      </div>
    </section>
  );
}
