/**
 * /research/calculators -- six researcher calculators, each anchored for direct
 * linking from InstantAnswerCard CTAs. Server-component shell, client-side
 * <CalculatorSuite /> for the interactive math.
 */

import type { Metadata } from 'next';
import CalculatorsClient from '@/components/research/CalculatorsClient';

export const metadata: Metadata = {
  title: 'Peptide Research Calculators | Dosing, Half-Life & Reconstitution | Pep Nation Lab',
  description: 'Free research calculators for peptides: dosing by body weight, half-life decay curves, BAC water reconstitution volumes, and injection site scheduling. Research use only.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://pepnationlab.com/research/calculators' },
  openGraph: {
    title: 'Peptide Research Calculators | Pep Nation Lab',
    description: 'Dosing, reconstitution, half-life, and scheduling calculators for research-grade peptides.',
    url: 'https://pepnationlab.com/research/calculators',
    type: 'website',
    images: [{ url: '/og-card.png', width: 1200, height: 630, alt: 'Peptide Research Calculators' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Peptide Research Calculators | Pep Nation Lab',
    description: 'Free dosing, reconstitution, and half-life calculators for research peptides.',
    images: ['/og-card.png'],
  },
};

const softwareJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Pep Nation Lab Peptide Research Calculators',
  applicationCategory: 'LifestyleApplication',
  description: 'Free online calculators for peptide research: dosing by body weight, BAC water reconstitution, half-life decay curves, and injection site scheduling.',
  url: 'https://pepnationlab.com/research/calculators',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  operatingSystem: 'Web Browser',
  provider: {
    '@type': 'Organization',
    name: 'Pep Nation Lab',
    url: 'https://pepnationlab.com',
  },
};

export default function CalculatorsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
      />
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '32px 16px 64px' }}>
        <CalculatorsClient />
      </div>
    </>
  );
}
