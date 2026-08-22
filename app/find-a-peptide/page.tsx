import type { Metadata } from 'next';
import { getAllCompounds } from '@/lib/compounds-server';
import MatchPageHero from '@/components/research/MatchPageHero';
import FindAPeptideSeoContent, { FIND_A_PEPTIDE_FAQS } from '@/components/research/FindAPeptideSeoContent';

export const metadata: Metadata = {
  title: 'Find A Peptide | AI Research Match Engine | Pep Nation Lab',
  description: 'Tell Us Your Research Goal, Evidence Comfort, And Risk Tolerance, And The Engine Will Rank The Best-Matched Candidate Compounds.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://pepnationlab.com/find-a-peptide' },
  openGraph: {
    title: 'Find A Peptide | Pep Nation Lab',
    description: 'Find the most relevant research peptides for your goals using the AI-powered match engine.',
    url: 'https://pepnationlab.com/find-a-peptide',
    type: 'website',
    images: [{ url: '/og-card.png', width: 1200, height: 630, alt: 'Pep Nation Lab Peptide Match Engine' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@PepNationLab',
    creator: '@PepNationLab',
    title: 'Find A Peptide | AI Research Match Engine | Pep Nation Lab',
    description: 'Tell Us Your Research Goal, Evidence Comfort, And Risk Tolerance, And The Engine Will Rank The Best-Matched Candidate Compounds.',
    images: ['https://pepnationlab.com/og-card.png'],
  },
};

export default async function FindAPeptidePage() {
  const compounds = await getAllCompounds();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        '@id': 'https://pepnationlab.com/find-a-peptide#webpage',
        url: 'https://pepnationlab.com/find-a-peptide',
        name: 'Find A Peptide | AI Research Match Engine | Pep Nation Lab',
        description: 'Describe your research goal and let the Pep Nation Lab AI match engine identify the most relevant research-grade peptides. Powered by evidence-tier data. Research use only.',
        applicationCategory: 'ReferenceApplication',
        isPartOf: { '@id': 'https://pepnationlab.com/#website' },
        publisher: { '@id': 'https://pepnationlab.com/#organization' }
      },
      {
        '@type': 'FAQPage',
        mainEntity: FIND_A_PEPTIDE_FAQS.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://pepnationlab.com' },
          { '@type': 'ListItem', position: 2, name: 'Find A Peptide', item: 'https://pepnationlab.com/find-a-peptide' }
        ]
      }
    ]
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: 'var(--space-5, 24px) var(--space-4, 16px)' }}>
        <MatchPageHero compounds={compounds} />
      </div>
      <FindAPeptideSeoContent />
    </>
  );
}
