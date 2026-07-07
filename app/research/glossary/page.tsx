/**
 * Glossary - an A-to-Z reference of peptide-science terms. Server shell hands
 * the terms to GlossaryExplorer, which shows one letter at a time (or search
 * results) instead of every letter at once. Pure static content from
 * lib/research-education. Definitions are factual and research-framed.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { PEPTIDE_GLOSSARY } from '@/lib/research-education';
import GlossaryExplorer, { type GlossaryTermEntry } from '@/components/research/GlossaryExplorer';

export const metadata: Metadata = {
  title: 'Peptide Glossary | Research Terms Dictionary | Pep Nation Lab',
  description: 'Comprehensive glossary of peptide research terminology. Definitions for peptide biology, pharmacokinetics, receptor mechanisms, and laboratory protocols. Research use only.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://pepnationlab.com/research/glossary' },
  openGraph: {
    title: 'Peptide Research Glossary | Pep Nation Lab',
    description: 'Comprehensive definitions for peptide research terminology, pharmacokinetics, and mechanisms.',
    url: 'https://pepnationlab.com/research/glossary',
    type: 'website',
    images: [{ url: '/og-card.png', width: 1200, height: 630, alt: 'Peptide Research Glossary' }],
  },
};

// DefinedTermSet JSON-LD: makes every glossary term a machine-readable
// term/definition pair. This is one of the most directly extractable schema
// types for AI answer engines (ChatGPT, Claude, Perplexity), which quote
// definitions verbatim. BreadcrumbList aids SERP breadcrumb display.
const glossaryJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'DefinedTermSet',
      '@id': 'https://pepnationlab.com/research/glossary#termset',
      name: 'Pep Nation Lab Peptide Research Glossary',
      description:
        'A-to-Z definitions of peptide-science terminology used throughout the Pep Nation Lab Research Library. For in vitro laboratory research context only.',
      url: 'https://pepnationlab.com/research/glossary',
      hasDefinedTerm: PEPTIDE_GLOSSARY.map((e) => ({
        '@type': 'DefinedTerm',
        name: e.term,
        description: e.def,
        inDefinedTermSet: 'https://pepnationlab.com/research/glossary#termset',
      })),
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://pepnationlab.com' },
        { '@type': 'ListItem', position: 2, name: 'Research Library', item: 'https://pepnationlab.com/research' },
        { '@type': 'ListItem', position: 3, name: 'Glossary', item: 'https://pepnationlab.com/research/glossary' },
      ],
    },
  ],
};

export default function GlossaryPage() {
  const terms: GlossaryTermEntry[] = PEPTIDE_GLOSSARY.map((e) => ({ term: e.term, def: e.def }));

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: 'var(--space-6, 32px) var(--space-4, 16px)' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(glossaryJsonLd) }}
      />
      {/* Server-rendered term list: emits every glossary term + definition into
          the initial HTML (the interactive GlossaryExplorer below is a client
          component). Visually hidden but fully crawlable by non-JS AI crawlers. */}
      <div style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>
        <h2>Peptide Research Glossary Terms</h2>
        <dl>
          {PEPTIDE_GLOSSARY.map((e) => (
            <div key={e.term}>
              <dt>{e.term}</dt>
              <dd>{e.def}</dd>
            </div>
          ))}
        </dl>
      </div>
      <nav style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Link href="/research" style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.9rem', textDecoration: 'none' }}>
          Back To Research Library
        </Link>
      </nav>

      <header style={{ marginBottom: 'var(--space-5, 24px)' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--white, #FFFFFF)', margin: 0 }}>
          <BookOpen size={24} aria-hidden="true" style={{ verticalAlign: '-3px', marginRight: 10, color: 'var(--teal, #00C4BC)' }} />
          Peptide Glossary
        </h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.05rem', marginTop: 'var(--space-2, 8px)', maxWidth: '720px' }}>
          Plain-Language Definitions Of The Terms Used Throughout The Research Library, From Amino Acid To Angiogenesis. Tap A
          Letter Or Search. For Laboratory Research Only.
        </p>
      </header>

      <GlossaryExplorer terms={terms} />
    </div>
  );
}
