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
  '@graph': [
    {
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
      provider: { '@id': 'https://pepnationlab.com/#organization' },
    },
    // HowTo: reconstitution steps as machine-readable, AI-extractable procedure.
    // Framed strictly for in vitro laboratory research handling.
    {
      '@type': 'HowTo',
      name: 'How To Reconstitute A Research Peptide',
      description:
        'General laboratory procedure for reconstituting a lyophilized research peptide with bacteriostatic water for in vitro research use. Not for human or animal use.',
      totalTime: 'PT5M',
      supply: [
        { '@type': 'HowToSupply', name: 'Lyophilized Research Peptide Vial' },
        { '@type': 'HowToSupply', name: 'Bacteriostatic Water' },
        { '@type': 'HowToSupply', name: 'Sterile Syringe' },
        { '@type': 'HowToSupply', name: 'Alcohol Prep Pad' },
      ],
      tool: [{ '@type': 'HowToTool', name: 'Reconstitution Calculator' }],
      step: [
        {
          '@type': 'HowToStep',
          name: 'Calculate The Diluent Volume',
          text: 'Use the reconstitution calculator to determine the exact volume of bacteriostatic water needed for your target research concentration based on the vial peptide mass.',
          url: 'https://pepnationlab.com/research/calculators',
        },
        {
          '@type': 'HowToStep',
          name: 'Sanitize The Vial Stoppers',
          text: 'Wipe the rubber stopper of both the peptide vial and the bacteriostatic water vial with an alcohol prep pad and allow to dry.',
        },
        {
          '@type': 'HowToStep',
          name: 'Draw The Diluent',
          text: 'Draw the calculated volume of bacteriostatic water into a sterile syringe.',
        },
        {
          '@type': 'HowToStep',
          name: 'Add Water Slowly Down The Vial Wall',
          text: 'Insert the needle and let the water run slowly down the inside wall of the peptide vial rather than directly onto the powder, to avoid foaming or degradation.',
        },
        {
          '@type': 'HowToStep',
          name: 'Swirl, Do Not Shake',
          text: 'Gently swirl the vial until the peptide fully dissolves. Do not shake. Store reconstituted peptide refrigerated and protected from light per handling guidance.',
        },
      ],
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://pepnationlab.com' },
        { '@type': 'ListItem', position: 2, name: 'Research Library', item: 'https://pepnationlab.com/research' },
        { '@type': 'ListItem', position: 3, name: 'Calculators', item: 'https://pepnationlab.com/research/calculators' },
      ],
    },
  ],
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
