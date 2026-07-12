import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllCompounds } from '@/lib/compounds-server';
import MatchPageHero from '@/components/research/MatchPageHero';
import MatchForm from '@/components/research/MatchForm';

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

const FAQS: { q: string; a: string }[] = [
  {
    q: 'What does the peptide match engine do?',
    a: 'It ranks Pep Nation Lab\'s research-grade compound catalog against a stated research goal, evidence-tier comfort, and risk tolerance, then returns the best-matched candidate compounds for in vitro laboratory research. It is an educational suggestion tool, not medical advice.',
  },
  {
    q: 'How is the match score calculated?',
    a: 'Each compound receives a transparent, additive score out of 100: an exact research-area match, cumulative goal-keyword relevance, an evidence-tier gradient (stronger human evidence ranks higher), class synergy, and research interest derived from citation and active-trial counts, with optional budget shaping. The full breakdown is shown on each result.',
  },
  {
    q: 'What is evidence-tier comfort?',
    a: 'It sets how much human evidence you require: approved drugs only, investigational or better, preclinical or better, or any level. Compounds below your chosen threshold are excluded from the results entirely.',
  },
  {
    q: 'What does risk tolerance control?',
    a: 'It hard-excludes compounds above your chosen research-risk classification. You can allow low risk only, low or moderate risk, or any risk level.',
  },
  {
    q: 'Are the results medical advice?',
    a: 'No. The engine restates cataloged laboratory facts for research framing only. Every compound is Research Use Only and is not for human or animal consumption, ingestion, or injection.',
  },
];

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
        mainEntity: FAQS.map((f) => ({
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
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: 'var(--space-6, 32px) var(--space-4, 16px)' }}>
        <nav style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Link href="/research/catalog" style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.9rem', textDecoration: 'none' }}>
          Back To Research Library
        </Link>
      </nav>
      
      <MatchPageHero compounds={compounds}>
        <header style={{ marginBottom: 'var(--space-5, 24px)' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--white, #FFFFFF)', margin: 0 }}>
            Match Me To A Peptide
          </h1>
          <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.05rem', marginTop: 'var(--space-2, 8px)', maxWidth: '760px' }}>
            Tell Us Your Research Goal, Evidence Comfort, And Risk Tolerance, And The Engine Will Rank The Best-Matched Candidate Compounds From{' '}
            <Link href="/research/catalog" style={{ color: 'var(--teal, #00C4BC)' }}>The Library</Link>.
          </p>
        </header>

        <MatchForm />

        <section style={{ marginTop: 'var(--space-8, 56px)', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 'var(--space-6, 32px)' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--white, #FFFFFF)', margin: '0 0 var(--space-3, 12px)' }}>
            How The Match Engine Works
          </h2>
          <p style={{ color: 'var(--silver, #A8B4C0)', lineHeight: 1.7, fontSize: '0.98rem', maxWidth: '760px' }}>
            The Pep Nation Lab match engine is a deterministic, explainable ranking tool for the
            research-grade compound catalog. You describe a primary research goal, how much human
            evidence you require, and your research-risk tolerance; the engine hard-excludes compounds
            that fall outside your constraints, then ranks the rest with a transparent, additive score
            out of 100. Every result shows exactly how its score was built.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4, 16px)', marginTop: 'var(--space-5, 24px)' }}>
            <div>
              <h3 style={{ color: 'var(--teal, #00C4BC)', fontSize: '1rem', margin: '0 0 6px' }}>Goal Relevance</h3>
              <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>
                An exact research-area tag is the strongest signal, with additional credit for cumulative
                goal-keyword mentions across a compound&apos;s mechanism, class, and studied-for entries.
              </p>
            </div>
            <div>
              <h3 style={{ color: 'var(--teal, #00C4BC)', fontSize: '1rem', margin: '0 0 6px' }}>Evidence Tier</h3>
              <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>
                Stronger human evidence ranks higher on a gradient from approved drugs down through
                investigational, preclinical, research-compound, and cosmetic tiers.
              </p>
            </div>
            <div>
              <h3 style={{ color: 'var(--teal, #00C4BC)', fontSize: '1rem', margin: '0 0 6px' }}>Research Interest</h3>
              <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>
                Cataloged citation and active-trial counts separate heavily studied compounds from
                obscure ones at the same evidence tier, so the ranking reflects real research depth.
              </p>
            </div>
          </div>

          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--white, #FFFFFF)', margin: 'var(--space-8, 56px) 0 var(--space-4, 16px)' }}>
            Frequently Asked Questions
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4, 16px)', maxWidth: '760px' }}>
            {FAQS.map((f) => (
              <div key={f.q}>
                <h3 style={{ color: 'var(--white, #FFFFFF)', fontSize: '1.02rem', fontWeight: 700, margin: '0 0 6px' }}>{f.q}</h3>
                <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.94rem', lineHeight: 1.7, margin: 0 }}>{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        <p style={{ fontSize: '0.78rem', color: 'var(--grey-500, #6B7785)', marginTop: 'var(--space-7, 48px)' }}>
          For Laboratory Research Use Only. Results Are Ranked By A Scoring Algorithm Against Stored Compound
          Profiles And Do Not Constitute Medical Advice, A Diagnosis, Or A Treatment Recommendation.
        </p>
      </MatchPageHero>
    </div>
    </>
  );
}
