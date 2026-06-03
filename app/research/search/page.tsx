/**
 * Universal Search — the Google-style entry point to the whole Research Library.
 * Server component builds the full search index (compounds, stacks, areas, learn
 * guides, glossary, FAQ) and hands it to the client UniversalSearch ranker.
 * Accepts ?q= so links and the landing search box can deep-link a query.
 * Research-use-only.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { getAllCompounds } from '@/lib/compounds-server';
import { buildResearchSearchDocs } from '@/lib/research-search-docs';
import UniversalSearch from '@/components/research/UniversalSearch';

export const metadata: Metadata = {
  title: 'Search | Research Library | Pep Nation Lab',
  robots: { index: false, follow: false },
};

export default async function ResearchSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const compounds = await getAllCompounds();
  const docs = buildResearchSearchDocs(compounds);

  return (
    <div style={{ maxWidth: '820px', margin: '0 auto', padding: 'var(--space-6, 32px) var(--space-4, 16px)' }}>
      <nav style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Link href="/research" style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.9rem', textDecoration: 'none' }}>
          Back To Research Library
        </Link>
      </nav>

      <header style={{ marginBottom: 'var(--space-5, 24px)' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--white, #FFFFFF)', margin: 0 }}>
          <Search size={24} aria-hidden="true" style={{ verticalAlign: '-3px', marginRight: 10, color: 'var(--teal, #00C4BC)' }} />
          Search The Research Library
        </h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.05rem', marginTop: 'var(--space-2, 8px)', maxWidth: '660px' }}>
          One Search Across Every Compound, Stack, Research Area, Guide, Glossary Term, And FAQ. Type A Name, A Goal, A
          Mechanism, Or A Question. For Laboratory Research Only.
        </p>
      </header>

      <UniversalSearch docs={docs} initialQuery={q ?? ''} autoFocus />
    </div>
  );
}
