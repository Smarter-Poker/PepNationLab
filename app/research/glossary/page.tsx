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
  title: 'Glossary | Peptide Terms | Pep Nation Lab',
  robots: { index: false, follow: false },
};

export default function GlossaryPage() {
  const terms: GlossaryTermEntry[] = PEPTIDE_GLOSSARY.map((e) => ({ term: e.term, def: e.def }));

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: 'var(--space-6, 32px) var(--space-4, 16px)' }}>
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
