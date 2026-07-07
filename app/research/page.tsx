import type { Metadata } from 'next';
import ResearchLandingClient from './ResearchLandingClient';

export const metadata: Metadata = {
  title: 'Research Library | Peptide Science Database | Pep Nation Lab',
  description: 'Explore 300+ research-grade peptides in the Pep Nation Lab Research Library. Browse by therapeutic area, mechanism, half-life, evidence tier, or use the AI match engine. Research use only.',
  keywords: 'peptide research library, research grade peptides, peptide database, BPC-157 research, TB-500 research, peptide mechanisms, peptide half-life, therapeutic area peptides',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://pepnationlab.com/research' },
  openGraph: {
    title: 'Research Library | Peptide Science Database | Pep Nation Lab',
    description: 'Browse 300+ research-grade peptides by therapeutic area, mechanism, half-life, and evidence tier. Full research monographs with calculators and comparison tools.',
    url: 'https://pepnationlab.com/research',
    type: 'website',
    images: [{ url: '/og-card.png', width: 1200, height: 630, alt: 'Pep Nation Lab Research Library' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Research Library | Pep Nation Lab',
    description: 'Browse 300+ research-grade peptides with full research monographs, calculators, and comparison tools.',
    images: ['/og-card.png'],
  },
};

// CollectionPage JSON-LD for the research library hub
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'Pep Nation Lab Research Library',
  description: 'A comprehensive database of 300+ research-grade peptides and compounds with full research monographs, mechanism analysis, evidence tiers, and pharmacokinetic data.',
  url: 'https://pepnationlab.com/research',
  publisher: {
    '@type': 'Organization',
    name: 'Pep Nation Lab',
    url: 'https://pepnationlab.com',
  },
  about: {
    '@type': 'Thing',
    name: 'Research Peptides',
  },
};

export default function ResearchLandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ResearchLandingClient />
    </>
  );
}
