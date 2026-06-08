/**
 * Learn hub - foundational, research-use-only education guides covering what
 * peptides are, evidence tiers, reconstitution, storage, reading a monograph,
 * quality verification, and the major peptide classes. Server shell;
 * the interactive guide-picker (LearnGuidesExplorer) shows one guide at a time
 * instead of one endless scroll. No dosing or medical advice.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { GraduationCap } from 'lucide-react';
import LearnGuidesExplorer from '@/components/research/LearnGuidesExplorer';

export const metadata: Metadata = {
  title: 'Learn | Peptide Education Hub | Pep Nation Lab',
  robots: { index: false, follow: false },
};

export default function LearnHubPage() {
  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: 'var(--space-6, 32px) var(--space-4, 16px)' }}>
      <nav style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Link href="/research" style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.9rem', textDecoration: 'none' }}>
          Back To Research Library
        </Link>
      </nav>

      <header style={{ marginBottom: 'var(--space-6, 32px)' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--white, #FFFFFF)', margin: 0 }}>
          <GraduationCap size={26} aria-hidden="true" style={{ verticalAlign: '-4px', marginRight: 10, color: 'var(--teal, #00C4BC)' }} />
          Peptide Education Hub
        </h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.05rem', marginTop: 'var(--space-2, 8px)', maxWidth: '720px' }}>
          Foundational Guides To Research Peptides - What They Are, How Evidence Is Graded, How They Are Prepared And
          Stored, And How To Read Every Page In This Library. Pick A Topic Below. For Laboratory Research Only. Not
          Medical Advice Or Dosing Guidance.
        </p>
      </header>

      <LearnGuidesExplorer />

      <p style={{ fontSize: '0.78rem', color: 'var(--grey-500, #6B7785)', marginTop: 'var(--space-7, 48px)' }}>
        For Laboratory Research Use Only. This Material Restates Published Science And Is Not Medical Advice, Dosing
        Guidance, Or An Endorsement Of Human Use.
      </p>
    </div>
  );
}
