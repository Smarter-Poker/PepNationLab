/**
 * /research/methodology - Editorial Standards And Research Methodology.
 *
 * An E-E-A-T (Experience, Expertise, Authoritativeness, Trust) page for a YMYL
 * (Your Money or Your Life) health-adjacent domain. It explains how the Pep
 * Nation Lab Research Library is sourced, tiered, reviewed, and maintained, and
 * reinforces the strict Research-Use-Only posture.
 *
 * Server component. Emits AboutPage + BreadcrumbList JSON-LD and fully
 * crawlable prose. Title Case headings/labels. No emojis.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { EVIDENCE_TIER } from '@/lib/compounds';

export const metadata: Metadata = {
  title: 'Editorial Standards & Research Methodology | Pep Nation Lab',
  description:
    'How the Pep Nation Lab Research Library is sourced, evidence-tiered, reviewed, and maintained. Our data standards, citation policy, and Research-Use-Only commitment.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://pepnationlab.com/research/methodology' },
  openGraph: {
    title: 'Editorial Standards & Research Methodology | Pep Nation Lab',
    description:
      'Our sourcing standards, evidence-tier system, review process, and citation policy for the peptide research library.',
    url: 'https://pepnationlab.com/research/methodology',
    type: 'article',
    images: [{ url: '/og-card.png', width: 1200, height: 630, alt: 'Pep Nation Lab Editorial Standards And Research Methodology' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Editorial Standards & Research Methodology | Pep Nation Lab',
    description: 'How the Pep Nation Lab Research Library is sourced, tiered, reviewed, and maintained.',
    images: ['/og-card.png'],
  },
};

const LAST_REVIEWED = '2026-07-07';

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'AboutPage',
      '@id': 'https://pepnationlab.com/research/methodology#webpage',
      url: 'https://pepnationlab.com/research/methodology',
      name: 'Editorial Standards And Research Methodology',
      description:
        'How the Pep Nation Lab Research Library is sourced, evidence-tiered, reviewed, and maintained, with a strict Research-Use-Only commitment.',
      isPartOf: { '@id': 'https://pepnationlab.com/#website' },
      publisher: { '@id': 'https://pepnationlab.com/#organization' },
      lastReviewed: LAST_REVIEWED,
      dateModified: LAST_REVIEWED,
      reviewedBy: { '@id': 'https://pepnationlab.com/#organization' },
      maintainer: { '@id': 'https://pepnationlab.com/#organization' },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://pepnationlab.com' },
        { '@type': 'ListItem', position: 2, name: 'Research Library', item: 'https://pepnationlab.com/research' },
        { '@type': 'ListItem', position: 3, name: 'Editorial Standards', item: 'https://pepnationlab.com/research/methodology' },
      ],
    },
  ],
};

const tierKeys = ['approved_drug', 'investigational', 'preclinical', 'research_chemical', 'cosmetic'] as const;

export default function MethodologyPage() {
  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: 'var(--space-6, 32px) var(--space-4, 16px)', color: 'var(--white, #fff)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Link href="/research" style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.9rem', textDecoration: 'none' }}>
          Back To Research Library
        </Link>
      </nav>

      <header style={{ marginBottom: 'var(--space-5, 24px)' }}>
        <h1 style={{ fontSize: 'clamp(1.7rem, 4vw, 2.4rem)', fontWeight: 800, margin: 0 }}>
          Editorial Standards And Research Methodology
        </h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.05rem', marginTop: 'var(--space-2, 8px)', maxWidth: '70ch', lineHeight: 1.6 }}>
          The Pep Nation Lab Research Library Exists To Give Qualified Researchers Accurate, Referenced, And
          Consistently-Structured Information On Peptides And Related Compounds. This Page Explains How That
          Library Is Built, Graded, And Maintained. Last Reviewed: July 7, 2026.
        </p>
      </header>

      <section style={{ marginBottom: 'var(--space-6, 32px)' }}>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0 0 8px' }}>Our Sourcing Standards</h2>
        <p style={{ lineHeight: 1.65, margin: 0, maxWidth: '72ch' }}>
          Each Compound Monograph Is Compiled From Primary And Authoritative Secondary Sources: Peer-Reviewed
          Literature Indexed In PubMed, Regulatory And Chemical Databases Including ChEMBL, UniProt, And The
          FDA Unique Ingredient Identifier (UNII) System, And Published Pharmacokinetic Data. Molecular
          Identity Fields Such As Sequence, Molecular Weight, And Receptor Targets Are Cross-Checked Against
          These Reference Databases Before Publication.
        </p>
      </section>

      <section style={{ marginBottom: 'var(--space-6, 32px)' }}>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0 0 8px' }}>Our Evidence-Tier System</h2>
        <p style={{ lineHeight: 1.65, margin: '0 0 12px', maxWidth: '72ch' }}>
          Every Compound Is Assigned An Evidence Tier That Communicates The Strength And Type Of Available
          Research At A Glance. Tiers Never Imply Endorsement For Human Use — They Describe The State Of The
          Scientific Literature Only.
        </p>
        <dl style={{ margin: 0 }}>
          {tierKeys.map((k) => {
            const t = EVIDENCE_TIER[k];
            if (!t) return null;
            return (
              <div key={k} style={{ marginBottom: 12 }}>
                <dt style={{ fontWeight: 700, color: 'var(--teal, #00C4BC)' }}>{t.label}</dt>
                <dd style={{ margin: '2px 0 0', lineHeight: 1.55, color: 'var(--silver, #D0DAE4)' }}>{t.blurb}</dd>
              </div>
            );
          })}
        </dl>
      </section>

      <section style={{ marginBottom: 'var(--space-6, 32px)' }}>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0 0 8px' }}>How We Review And Update</h2>
        <p style={{ lineHeight: 1.65, margin: 0, maxWidth: '72ch' }}>
          Monographs Are Maintained By The Pep Nation Lab Research Team. Entries Are Revised When New
          Peer-Reviewed Evidence, Regulatory Changes, Or Corrected Reference Data Become Available. Where The
          Literature Is Preliminary, Conflicting, Or Limited To Animal Or In-Vitro Models, We State That
          Explicitly Rather Than Overstating Certainty. Confidence Indicators Accompany Referenced Claims So
          Researchers Can Weigh The Strength Of The Underlying Evidence.
        </p>
      </section>

      <section style={{ marginBottom: 'var(--space-6, 32px)' }}>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0 0 8px' }}>Citations And Corrections</h2>
        <p style={{ lineHeight: 1.65, margin: 0, maxWidth: '72ch' }}>
          References Are Listed On Each Monograph And In The Machine-Readable Markdown Version Available At
          Each Compound&apos;s Data Endpoint. If You Identify An Error Or Have A Peer-Reviewed Source To
          Suggest, Contact The Research Team At{' '}
          <a href="mailto:research@pepnationlab.com" style={{ color: 'var(--teal, #00C4BC)' }}>research@pepnationlab.com</a>{' '}
          And We Will Review It.
        </p>
      </section>

      <section style={{ marginBottom: 'var(--space-6, 32px)' }}>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0 0 8px' }}>Research-Use-Only Commitment</h2>
        <p style={{ lineHeight: 1.65, margin: 0, maxWidth: '72ch' }}>
          All Content And Products Are Provided Strictly For In Vitro Laboratory Research Use Only. Nothing In
          The Research Library Is Medical Advice, Dosing Guidance, Or An Endorsement For Human Or Animal Use.
          Products Are Not FDA-Approved For Human Or Animal Use. See The{' '}
          <Link href="/disclaimer" style={{ color: 'var(--teal, #00C4BC)' }}>Full Research Disclaimer</Link>,{' '}
          <Link href="/compliance" style={{ color: 'var(--teal, #00C4BC)' }}>Compliance Policy</Link>, And{' '}
          <Link href="/terms" style={{ color: 'var(--teal, #00C4BC)' }}>Terms Of Service</Link>.
        </p>
      </section>

      <p style={{ fontSize: '0.9rem', color: 'var(--silver, #A8B4C0)', margin: 0 }}>
        Explore The{' '}
        <Link href="/research" style={{ color: 'var(--teal, #00C4BC)' }}>Research Library</Link>,{' '}
        <Link href="/research/glossary" style={{ color: 'var(--teal, #00C4BC)' }}>Glossary</Link>, And{' '}
        <Link href="/research/faq" style={{ color: 'var(--teal, #00C4BC)' }}>FAQ</Link>.
      </p>
    </div>
  );
}
