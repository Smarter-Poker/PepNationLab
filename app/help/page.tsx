import type { Metadata } from 'next';
import Link from 'next/link';

// Public Help Center hub. /help previously returned a 404 (only the
// messenger-call-permissions subroute existed), losing a standard high-intent
// navigational target. This page is the internal-linking parent for FAQ,
// guides, education, COA verification, shipping, and compliance.
export const metadata: Metadata = {
  title: 'Help Center | Researcher Support And Guides | Pep Nation Lab',
  description:
    'Find answers about research peptide handling, COA verification, shipping, compliance, and the research library. Support directory for qualified researchers. Research Use Only.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://pepnationlab.com/help' },
};

export const revalidate = 86400;

const SECTIONS: { title: string; description: string; href: string; linkLabel: string }[] = [
  {
    title: 'Peptide Research FAQ',
    description: 'Answers To The Most Common Questions About Research Peptides, Evidence Tiers, And The Library.',
    href: '/research/faq',
    linkLabel: 'Browse The FAQ',
  },
  {
    title: 'Research Guides',
    description: 'Long-Form Guides Covering Storage, Reconstitution, Purity, And Reading A Certificate Of Analysis.',
    href: '/research/guides',
    linkLabel: 'Read The Guides',
  },
  {
    title: 'Peptide Education Hub',
    description: 'Foundational Primers On What Research Peptides Are, Evidence Tiers, And Quality Verification.',
    href: '/research/learn',
    linkLabel: 'Start Learning',
  },
  {
    title: 'Verify A COA',
    description: 'Enter A Vial Lot Number To View The Third-Party Certificate Of Analysis For That Batch.',
    href: '/coa',
    linkLabel: 'Verify A Certificate',
  },
  {
    title: 'Shipping Information',
    description: 'How Orders Are Packed, Shipped, And Tracked, Including Cold-Chain Handling Notes.',
    href: '/shipping',
    linkLabel: 'Shipping Details',
  },
  {
    title: 'Compliance',
    description: 'Our Research-Use-Only Policy, Required Acknowledgments, And Platform Compliance Standards.',
    href: '/compliance',
    linkLabel: 'Read Compliance',
  },
  {
    title: 'Research Glossary',
    description: 'Plain-Language Definitions For The Scientific Terms Used Across The Research Library.',
    href: '/research/glossary',
    linkLabel: 'Open The Glossary',
  },
  {
    title: 'Calculators And Lab Tools',
    description: 'Reconstitution And Concentration Calculators For Laboratory Preparation Workflows.',
    href: '/research/calculators',
    linkLabel: 'Open Lab Tools',
  },
  {
    title: 'Contact Support',
    description: 'Reach The Support Team With Account, Order, Or Research Library Questions.',
    href: '/contact',
    linkLabel: 'Contact Us',
  },
];

export default function HelpCenterPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': 'https://pepnationlab.com/help#webpage',
        url: 'https://pepnationlab.com/help',
        name: 'Help Center | Researcher Support And Guides | Pep Nation Lab',
        description:
          'Support directory for qualified researchers: FAQ, guides, COA verification, shipping, and compliance.',
        isPartOf: { '@id': 'https://pepnationlab.com/#website' },
        publisher: { '@id': 'https://pepnationlab.com/#organization' },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://pepnationlab.com' },
          { '@type': 'ListItem', position: 2, name: 'Help Center', item: 'https://pepnationlab.com/help' },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: 'var(--space-7, 48px) var(--space-4, 16px)' }}>
        <header style={{ marginBottom: 'var(--space-6, 32px)' }}>
          <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 900, color: 'var(--white, #FFFFFF)', margin: '0 0 var(--space-3, 12px)' }}>
            Help Center
          </h1>
          <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.05rem', lineHeight: 1.7, maxWidth: 720, margin: 0 }}>
            Everything You Need To Work With The Research Library And The Platform: Frequently Asked
            Questions, Handling And Storage Guides, Certificate Of Analysis Verification, Shipping
            Details, And Compliance Standards. All Products Are For In Vitro Research Use Only.
          </p>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-4, 16px)' }}>
          {SECTIONS.map((s) => (
            <section key={s.href} className="card" style={{ padding: 'var(--space-5, 24px)' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--white, #FFFFFF)', margin: '0 0 var(--space-2, 8px)' }}>
                {s.title}
              </h2>
              <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.92rem', lineHeight: 1.6, margin: '0 0 var(--space-3, 12px)' }}>
                {s.description}
              </p>
              <Link href={s.href} style={{ color: 'var(--teal, #00C4BC)', fontWeight: 700, fontSize: '0.95rem', textDecoration: 'none' }}>
                {s.linkLabel}
              </Link>
            </section>
          ))}
        </div>

        <p style={{ fontSize: '0.78rem', color: 'var(--silver, #A8B4C0)', marginTop: 'var(--space-7, 48px)', opacity: 0.7 }}>
          For Laboratory Research Use Only. Nothing On This Page Is Medical Advice, Dosing Guidance,
          Or An Endorsement Of Human Use.
        </p>
      </div>
    </>
  );
}
