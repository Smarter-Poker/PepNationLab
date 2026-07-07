/**
 * FAQ - general peptide and research-library questions. Server shell hands the
 * questions to FaqExplorer, which shows one category at a time via a button
 * rail instead of every category at once. Pure static content from
 * lib/research-education. Research-use-only framing.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { HelpCircle } from 'lucide-react';
import { PEPTIDE_FAQ, FAQ_CATEGORY_ORDER } from '@/lib/research-education';
import FaqExplorer, { type FaqItem } from '@/components/research/FaqExplorer';

export const metadata: Metadata = {
  title: 'Peptide Research FAQ | Frequently Asked Questions | Pep Nation Lab',
  description: 'Frequently asked questions about research peptides, ordering, reconstitution, storage, and the Pep Nation Lab platform. Answers for qualified researchers.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://pepnationlab.com/research/faq' },
  openGraph: {
    title: 'Peptide Research FAQ | Pep Nation Lab',
    description: 'Answers to common questions about research peptides, ordering, reconstitution, and storage.',
    url: 'https://pepnationlab.com/research/faq',
    type: 'website',
    images: [{ url: '/og-card.png', width: 1200, height: 630, alt: 'Peptide Research FAQ' }],
  },
};

export default function FaqPage() {
  const items: FaqItem[] = PEPTIDE_FAQ.map((f) => ({ q: f.q, a: f.a, category: f.category }));
  const present = new Set(items.map((f) => f.category));
  const categories = FAQ_CATEGORY_ORDER.filter((c) => present.has(c));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          name: 'Peptide Research FAQ',
          url: 'https://pepnationlab.com/research/faq',
          // mainEntity carries the real Q&A pairs so this is a valid FAQPage
          // eligible for rich results and directly extractable by AI answer
          // engines. Answers are plain-text-stripped for schema cleanliness.
          mainEntity: items.map((f) => ({
            '@type': 'Question',
            name: f.q,
            acceptedAnswer: {
              '@type': 'Answer',
              text: String(f.a).replace(/<[^>]+>/g, '').trim(),
            },
          })),
        }) }}
      />
    <div style={{ maxWidth: '820px', margin: '0 auto', padding: 'var(--space-6, 32px) var(--space-4, 16px)' }}>
      <nav style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Link href="/research" style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.9rem', textDecoration: 'none' }}>
          Back To Research Library
        </Link>
      </nav>

      <header style={{ marginBottom: 'var(--space-6, 32px)' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--white, #FFFFFF)', margin: 0 }}>
          <HelpCircle size={24} aria-hidden="true" style={{ verticalAlign: '-3px', marginRight: 10, color: 'var(--teal, #00C4BC)' }} />
          Frequently Asked Questions
        </h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.05rem', marginTop: 'var(--space-2, 8px)', maxWidth: '720px' }}>
          Common Questions About Research Peptides, Handling, Storage, Safety, And How To Use This Library. Pick A
          Category Below. For Laboratory Research Only. Not Medical Advice Or Dosing Guidance.
        </p>
      </header>

      <FaqExplorer items={items} categories={categories} />

      <p style={{ fontSize: '0.85rem', color: 'var(--silver, #A8B4C0)', marginTop: 'var(--space-7, 48px)' }}>
        Looking For A Specific Compound? Use Ask The Lab On The{' '}
        <Link href="/research" style={{ color: 'var(--teal, #00C4BC)', textDecoration: 'none' }}>Research Library</Link>{' '}
        Or Browse The Full Catalog.
      </p>
    </div>
    </>
  );
}
