/**
 * /research/calculators -- six researcher calculators, each anchored for direct
 * linking from InstantAnswerCard CTAs. Server-component shell, client-side
 * <CalculatorSuite /> for the interactive math.
 */

import type { Metadata } from 'next';
import CalculatorsClient from '@/components/research/CalculatorsClient';

export const metadata: Metadata = {
  title: 'Peptide Research Calculators | Dosing, Half-Life & Reconstitution | Pep Nation Lab',
  description: 'Free research calculators for peptides: dosing by body weight, half-life decay curves, BAC water reconstitution volumes, and injection site scheduling.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://pepnationlab.com/research/calculators' },
  openGraph: {
    title: 'Peptide Research Calculators | Pep Nation Lab',
    description: 'Dosing, reconstitution, half-life, and scheduling calculators for research-grade peptides.',
    url: 'https://pepnationlab.com/research/calculators',
    type: 'website',
  },
};

export default function CalculatorsPage() {
  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '32px 16px 64px' }}>
      <CalculatorsClient />
    </div>
  );
}
