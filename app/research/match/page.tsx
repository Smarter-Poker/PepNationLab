/**
 * Match Me To A Peptide — Research Library page.
 *
 * Server component. Loads the compound catalog so the page can show how many
 * compounds the engine is choosing from, then renders the client-side form.
 *
 * The actual ranking happens server-side in `POST /api/research/match`, which
 * also loads `getAllCompounds()`. We load here only for the count badge.
 */

import type { Metadata } from 'next';
import { getAllCompounds } from '@/lib/compounds-server';
import MatchForm from '@/components/research/MatchForm';

export const metadata: Metadata = {
  title: 'Match Me To A Peptide | Pep Nation Lab Research Library',
  description:
    'Pick A Research Goal And Your Comfort Levels. The Research Library Returns The Top Candidate Compounds With A Plain-English Rationale. Research Use Only.',
  robots: { index: false, follow: false },
};

export default async function MatchPage() {
  const compounds = await getAllCompounds();
  const count = compounds.length;

  return (
    <div
      style={{
        maxWidth: '1100px',
        margin: '0 auto',
        padding: 'var(--space-6, 32px) var(--space-4, 16px)',
      }}
    >
      <header style={{ marginBottom: 'var(--space-6, 24px)' }}>
        <p
          style={{
            color: 'var(--teal, #00C4BC)',
            fontSize: '0.85rem',
            fontWeight: 700,
            margin: 0,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Research Library
        </p>
        <h1
          style={{
            fontSize: '2.25rem',
            fontWeight: 900,
            color: 'var(--white, #FFFFFF)',
            margin: 'var(--space-2, 8px) 0',
          }}
        >
          Match Me To A Peptide
        </h1>
        <p
          style={{
            color: 'var(--silver, #A8B4C0)',
            fontSize: '1.05rem',
            maxWidth: '720px',
            margin: 0,
          }}
        >
          Tell Us Your Research Goal, Evidence Comfort, WADA Constraint, And Risk Tolerance. We Will Rank The Top 5 Candidate Compounds From{' '}
          <span style={{ color: 'var(--white, #FFFFFF)', fontWeight: 700 }}>{count}</span> In The Catalog With A Plain-English Rationale. For Laboratory Research Only.
        </p>
      </header>

      <MatchForm />
    </div>
  );
}
