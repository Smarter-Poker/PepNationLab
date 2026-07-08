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
  '@id': 'https://pepnationlab.com/peptide-101#course',
  name: 'Peptide 101',
  description: 'A free 14-module course covering peptide biology, mechanisms of action, peptide families, reconstitution protocols, safety considerations, and research applications.',
  url: 'https://pepnationlab.com/peptide-101',
  provider: { '@id': 'https://pepnationlab.com/#organization' },
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
      {/* Crawlable course content layer - visually hidden (clip-rect).
          The Peptide 101 page is fully client-rendered and blank before
          hydration, so this layer is the no-JS equivalent for crawlers. */}
      <section aria-label="Peptide 101 Course Overview" style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}>
        <h1>Peptide 101 - Free Research Peptide Education Course</h1>
        <p>
          Peptide 101 Is A Free Interactive Education Course For New Peptide Researchers. Learn
          What Research Peptides Are And How They Work, How To Reconstitute Peptides With
          Bacteriostatic Water, Proper Peptide Storage And Handling, How To Read A Certificate
          Of Analysis And Verify Purity, Peptide Evidence Tiers And Research Literacy, And How
          To Navigate The Research Peptide Landscape Safely And Compliantly. All Content Is For
          In Vitro Laboratory Research Education Only - Not Medical Advice.
        </p>
        <nav aria-label="Course Resources">
          <a href="/research">Peptide Research Library</a>
          <a href="/research/calculators">Reconstitution Calculators</a>
          <a href="/research/glossary">Peptide Science Glossary</a>
          <a href="/research/guides">Research Guides</a>
          <a href="/research/faq">Research Library FAQ</a>
        </nav>
      </section>
      {children}
    </>
  );
}
