/**
 * Match Me To A Peptide - Research Library page.
 *
 * Server shell: renders the static chrome, subtitle, and disclaimer footer,
 * then mounts the client-side MatchForm component which owns all interactivity.
 * Research-Use-Only throughout.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import MatchForm from '@/components/research/MatchForm';

export const metadata: Metadata = {
  title: 'Match Me To A Peptide | Research Library | Pep Nation Lab',
  robots: { index: false, follow: false },
};

export default function MatchPage() {
  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: 'var(--space-6, 32px) var(--space-4, 16px)' }}>
      <nav style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Link href="/research" style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.9rem', textDecoration: 'none' }}>
          Back To Research Library
        </Link>
      </nav>

      <header style={{ marginBottom: 'var(--space-5, 24px)' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--white, #FFFFFF)', margin: 0 }}>
          Match Me To A Peptide
        </h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.05rem', marginTop: 'var(--space-2, 8px)', maxWidth: '760px' }}>
          Tell Us Your Research Goal, Evidence Comfort, And Risk Tolerance. We Will Rank The Top 5 Candidate Compounds From{' '}
          <Link href="/research" style={{ color: 'var(--teal, #00C4BC)' }}>The Library</Link>.
        </p>
      </header>

      <MatchForm />

      <p style={{ fontSize: '0.78rem', color: 'var(--grey-500, #6B7785)', marginTop: 'var(--space-7, 48px)' }}>
        For Laboratory Research Use Only. Results Are Ranked By A Scoring Algorithm Against Stored Compound
        Profiles And Do Not Constitute Medical Advice, A Diagnosis, Or A Treatment Recommendation.
      </p>
    </div>
  );
}
