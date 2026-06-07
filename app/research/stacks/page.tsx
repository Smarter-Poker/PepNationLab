import type { Metadata } from 'next';
import { getAllCompounds } from '@/lib/compounds-server';
import { getAreaProducts } from '@/lib/area-products-server';
import StackBuilder from '@/components/research/StackBuilder';

export const metadata: Metadata = {
  title: 'Stacks & Combinations',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function StacksPage() {
  const compounds = await getAllCompounds();

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
          Research Stacks & Protocol Builder
        </h1>
        <p
          style={{
            color: 'var(--silver, #A8B4C0)',
            fontSize: '1.05rem',
            marginTop: 'var(--space-2, 8px)',
            maxWidth: '720px',
          }}
        >
          Select compounds to evaluate synergy, cumulative risk, and generate a customizable 12-week dosing protocol.
        </p>
      </header>
      <StackBuilder compounds={compounds} />
    </div>
  );
}
