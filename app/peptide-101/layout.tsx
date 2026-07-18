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

// SERP breadcrumb eligibility for the course landing page.
const breadcrumbJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://pepnationlab.com' },
    { '@type': 'ListItem', position: 2, name: 'Peptide 101', item: 'https://pepnationlab.com/peptide-101' },
  ],
};

// Answer-first Q&A for the course. Rendered as real text in the crawlable
// layer below AND emitted as FAQPage JSON-LD - a high-value AI-citation and
// featured-snippet surface for "how to learn about peptides" style queries.
const COURSE_FAQ: { q: string; a: string }[] = [
  {
    q: 'Is The Peptide 101 Course Free?',
    a: 'Yes. Peptide 101 is a completely free 14-module research education course. There is no cost, no subscription, and no purchase required to complete the course or earn the certificate of completion.',
  },
  {
    q: 'Do I Need A Science Background To Take Peptide 101?',
    a: 'No prior background is required. The course starts with what a peptide is and builds up to reconstitution, evidence tiers, and research literacy in plain language, so newcomers and experienced researchers can both follow it.',
  },
  {
    q: 'What Does The Peptide 101 Course Cover?',
    a: 'The 14 modules cover peptide biology and structure, mechanisms of action, peptide families and categories, reconstitution with bacteriostatic water, storage and handling, certificate-of-analysis literacy, safety and sourcing, legality and research-use context, and a final quiz.',
  },
  {
    q: 'What Is Peptide Reconstitution?',
    a: 'Reconstitution is the process of dissolving a lyophilized (freeze-dried) peptide into a liquid, typically bacteriostatic water, to prepare a solution for laboratory research. The course includes a reconstitution calculator module that shows how concentration is calculated.',
  },
  {
    q: 'Are These Peptides Intended For Human Use?',
    a: 'No. All compounds referenced in Peptide 101 and across Pep Nation Lab are strictly for in vitro laboratory research use only. They are not FDA-approved and are not intended for human or animal consumption. The course is educational and is not medical advice.',
  },
  {
    q: 'Do I Get A Certificate After Completing Peptide 101?',
    a: 'Yes. Completing all modules and passing the final quiz unlocks a certificate of completion for the Peptide 101 research education course.',
  },
];

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  '@id': 'https://pepnationlab.com/peptide-101#faq',
  mainEntity: COURSE_FAQ.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
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
        <section aria-label="Peptide 101 Frequently Asked Questions">
          <h2>Peptide 101 Frequently Asked Questions</h2>
          {COURSE_FAQ.map((f) => (
            <div key={f.q}>
              <h3>{f.q}</h3>
              <p>{f.a}</p>
            </div>
          ))}
        </section>
      </section>
      {children}
    </>
  );
}
