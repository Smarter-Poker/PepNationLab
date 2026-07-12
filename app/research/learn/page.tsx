/**
 * Learn hub - foundational, research-use-only education guides covering what
 * peptides are, evidence tiers, reconstitution, storage, reading a monograph,
 * quality verification, and the major peptide classes. Server shell;
 * the interactive guide-picker (LearnGuidesExplorer) shows one guide at a time
 * instead of one endless scroll. No dosing or medical advice.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { GraduationCap } from 'lucide-react';
import LearnGuidesExplorer from '@/components/research/LearnGuidesExplorer';
import { LEARN_GUIDES } from '@/lib/research-education';

export const metadata: Metadata = {
  title: 'Peptide Education Hub | Learn About Research Peptides | Pep Nation Lab',
  description: 'Foundational education guides for peptide researchers. Learn about evidence tiers, reconstitution, storage, peptide classes, how to read a monograph, and quality verification. Research use only.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://pepnationlab.com/research/learn' },
  openGraph: {
    title: 'Peptide Education Hub | Pep Nation Lab',
    description: 'Research education guides covering evidence tiers, reconstitution, storage, peptide classes, and quality verification for qualified researchers.',
    url: 'https://pepnationlab.com/research/learn',
    type: 'website',
    images: [{ url: '/og-card.png', width: 1200, height: 630, alt: 'Peptide Research Education Hub' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Peptide Education Hub | Pep Nation Lab',
    description: 'Research education guides on evidence tiers, reconstitution, storage, and peptide classes.',
    images: ['/og-card.png'],
  },
};

export default function LearnHubPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': 'https://pepnationlab.com/research/learn#webpage',
        url: 'https://pepnationlab.com/research/learn',
        name: 'Peptide Education Hub | Learn About Research Peptides | Pep Nation Lab',
        description: 'Foundational education guides for peptide researchers. Learn about evidence tiers, reconstitution, storage, peptide classes, how to read a monograph, and quality verification. Research use only.',
        isPartOf: { '@id': 'https://pepnationlab.com/#website' },
        publisher: { '@id': 'https://pepnationlab.com/#organization' }
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://pepnationlab.com' },
          { '@type': 'ListItem', position: 2, name: 'Research Library', item: 'https://pepnationlab.com/research' },
          { '@type': 'ListItem', position: 3, name: 'Learn', item: 'https://pepnationlab.com/research/learn' }
        ]
      }
    ]
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: 'var(--space-6, 32px) var(--space-4, 16px)' }}>
      <nav style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Link href="/research" style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.9rem', textDecoration: 'none' }}>
          Back To Research Library
        </Link>
      </nav>

      <header style={{ marginBottom: 'var(--space-6, 32px)' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--white, #FFFFFF)', margin: 0 }}>
          <GraduationCap size={26} aria-hidden="true" style={{ verticalAlign: '-4px', marginRight: 10, color: 'var(--teal, #00C4BC)' }} />
          Peptide Education Hub
        </h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.05rem', marginTop: 'var(--space-2, 8px)', maxWidth: '720px' }}>
          Foundational Guides To Research Peptides - What They Are, How Evidence Is Graded, How They Are Prepared And
          Stored, And How To Read Every Page In This Library. Pick A Topic Below. For Laboratory Research Only. Not
          Medical Advice Or Dosing Guidance.
        </p>
      </header>

      <LearnGuidesExplorer />

      <section aria-label="All Education Guides" style={{ marginTop: 'var(--space-7, 48px)' }}>
        <h2 className="sr-only">Complete Guide Library</h2>
        {LEARN_GUIDES.map((guide) => (
          <article key={guide.slug} style={{ marginBottom: 'var(--space-7, 48px)' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--white, #FFFFFF)', margin: '0 0 var(--space-2, 8px)' }}>
              {guide.title}
            </h2>
            <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1rem', margin: '0 0 var(--space-4, 16px)' }}>
              {guide.intro}
            </p>
            {guide.sections.map((section, i) => (
              <div key={i} style={{ marginBottom: 'var(--space-4, 16px)' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--white, #FFFFFF)', margin: '0 0 var(--space-2, 8px)' }}>
                  {section.heading}
                </h3>
                {section.body.split('\n\n').map((para, j) => (
                  <p key={j} style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.95rem', lineHeight: 1.7, margin: '0 0 var(--space-2, 8px)' }}>
                    {para}
                  </p>
                ))}
              </div>
            ))}
          </article>
        ))}
      </section>

      <p style={{ fontSize: '0.78rem', color: 'var(--grey-500, #6B7785)', marginTop: 'var(--space-7, 48px)' }}>
        For Laboratory Research Use Only. This Material Restates Published Science And Is Not Medical Advice, Dosing
        Guidance, Or An Endorsement Of Human Use.
      </p>
    </div>
      </>
  );
}
