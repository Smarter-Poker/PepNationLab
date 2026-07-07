import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Peptide 101 | Free Peptide Research Course | Pep Nation Lab',
  description: 'The definitive free course on peptide research. 14 modules covering peptide biology, mechanisms, families, reconstitution protocols, safety, and research applications. For qualified researchers.',
  keywords: 'peptide 101, peptide course, peptide education, learn peptides, peptide biology, peptide mechanisms, peptide research course, free peptide course',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://pepnationlab.com/peptide-101' },
  openGraph: {
    title: 'Peptide 101 | Free Peptide Research Course | Pep Nation Lab',
    description: '14-module free course covering peptide biology, mechanisms, families, reconstitution, and research applications. For qualified researchers.',
    url: 'https://pepnationlab.com/peptide-101',
    type: 'website',
    images: [{ url: '/og-card.png', width: 1200, height: 630, alt: 'Peptide 101 Research Course by Pep Nation Lab' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Peptide 101 | Free Peptide Research Course',
    description: '14 modules covering peptide biology, mechanisms, reconstitution, and more. Free for qualified researchers.',
    images: ['/og-card.png'],
  },
};

const courseJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Course',
  name: 'Peptide 101',
  description: 'A free 14-module course covering peptide biology, mechanisms of action, peptide families, reconstitution protocols, safety considerations, and research applications.',
  url: 'https://pepnationlab.com/peptide-101',
  provider: {
    '@type': 'Organization',
    name: 'Pep Nation Lab',
    url: 'https://pepnationlab.com',
  },
  numberOfCredits: 14,
  educationalLevel: 'Advanced',
  teaches: 'Peptide research, peptide biology, reconstitution protocols, peptide mechanisms',
  isAccessibleForFree: true,
  inLanguage: 'en',
};

export default function Peptide101Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(courseJsonLd) }}
      />
      {children}
    </>
  );
}
