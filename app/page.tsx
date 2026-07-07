import type { Metadata } from 'next';
import HomeClient from './HomeClient';
import HomeSeoContent from '@/components/HomeSeoContent';

export const metadata: Metadata = {
  title: 'Pep Nation Lab | Premium Research Peptide Distribution',
  description: 'Wholesale research peptide distribution for qualified researchers. Access 300+ compounds including BPC-157, TB-500, Semaglutide, and Tirzepatide. Research use only.',
  keywords: 'research peptides, BPC-157, TB-500, Semaglutide, Tirzepatide, peptide wholesale, research grade peptides, RUO compounds, peptide distribution platform',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://pepnationlab.com' },
  openGraph: {
    title: 'Pep Nation Lab | Premium Research Peptide Distribution',
    description: 'Access 300+ research-grade peptides. Wholesale pricing for qualified researchers. Full research library, calculators, and AI match engine included.',
    url: 'https://pepnationlab.com',
    type: 'website',
    images: [{ url: '/og-card.png', width: 1200, height: 630, alt: 'Pep Nation Lab - Premium Research Peptide Distribution' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pep Nation Lab | Premium Research Peptide Distribution',
    description: 'Access 300+ research-grade peptides. Wholesale pricing for qualified researchers.',
    images: ['/og-card.png'],
  },
};

export default function HomePage() {
  return (
    <>
      <HomeClient />
      {/* Server-rendered crawlable homepage content: gives the root domain a
          real H1, intro copy, and descriptive internal links beneath the
          image-based landing artwork. */}
      <HomeSeoContent />
    </>
  );
}
