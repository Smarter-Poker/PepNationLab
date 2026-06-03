/**
 * /research/calculators -- six researcher calculators, each anchored for direct
 * linking from InstantAnswerCard CTAs. Server-component shell, client-side
 * <CalculatorSuite /> for the interactive math.
 */

import type { Metadata } from 'next';
import BrowseSurfaceNav from '@/components/research/BrowseSurfaceNav';
import CalculatorsClient from '@/components/research/CalculatorsClient';

export const metadata: Metadata = {
  title: 'Researcher Calculators | Research Library | Pep Nation Lab',
  robots: { index: false, follow: false },
};

export default function CalculatorsPage() {
  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '32px 16px 64px' }}>
      <CalculatorsClient />
      <BrowseSurfaceNav />
    </div>
  );
}
