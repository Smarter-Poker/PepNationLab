/**
 * Compare Compounds page - hosts the interactive side-by-side comparison tool.
 * Server component fetches the catalog and hands it to the client tool.
 * Research-use-only framing throughout.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllCompounds } from '@/lib/compounds-server';
import CompareTool from '@/components/research/CompareTool';

export const metadata: Metadata = {
  title: 'Compare Compounds | Research Library | Pep Nation Lab',
  robots: { index: false, follow: false },
};

export default async function CompareCompoundsPage({
  searchParams,
}: {
  searchParams: Promise<{ add?: string; compare?: string }>;
}) {
  const params = await searchParams;
  const rawCompare = params.compare ?? params.add ?? '';
  const compounds = await getAllCompounds();
  const initialSlugs = rawCompare
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: 'var(--space-6, 32px) var(--space-4, 16px)' }}>
      <nav style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Link href="/research" style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.9rem', textDecoration: 'none' }}>
          Back To Research Library
        </Link>
      </nav>

      <header style={{ marginBottom: 'var(--space-6, 32px)' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--white, #FFFFFF)', margin: 0 }}>
          Compare Compounds
        </h1>
        <p
          style={{
            color: 'var(--silver, #A8B4C0)',
            fontSize: '1.05rem',
            marginTop: 'var(--space-2, 8px)',
            maxWidth: '720px',
          }}
        >
          Select Up To Four Compounds To Review Their Evidence, Targets, And Handling Side By Side. For Laboratory
          Research Only.
        </p>
      </header>

      <CompareTool compounds={compounds} initialSlugs={initialSlugs} />
    </div>
  );
}
