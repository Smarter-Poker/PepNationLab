import type { Metadata } from 'next';
import { getAllCompounds } from '@/lib/compounds-server';
import { getAreaProducts } from '@/lib/area-products-server';
import StacksClient from '@/components/research/StacksClient';

export const metadata: Metadata = {
  title: 'Research Stacks & Combinations | Pep Nation Lab',
  description: 'Explore curated peptide research stacks and multi-compound combinations. Study synergistic compound protocols organized by research goal. Research use only.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://pepnationlab.com/research/stacks' },
  openGraph: {
    title: 'Research Stacks & Combinations | Pep Nation Lab',
    description: 'Curated peptide research stacks and multi-compound combinations organized by research goal.',
    url: 'https://pepnationlab.com/research/stacks',
    type: 'website',
    images: [{ url: '/og-card.png', width: 1200, height: 630, alt: 'Pep Nation Lab Research Stacks' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@PepNationLab',
    creator: '@PepNationLab',
    title: 'Research Stacks & Combinations | Pep Nation Lab',
    description: 'Explore curated peptide research stacks and multi-compound combinations. Study synergistic compound protocols organized by research goal. Research use only.',
    images: ['https://pepnationlab.com/images/og-card.jpg'],
  },
};

// ISR: data comes from unstable_cache'd helpers (60s); render once, revalidate hourly.
export const revalidate = 3600;

export default async function StacksPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': 'https://pepnationlab.com/research/stacks#webpage',
        url: 'https://pepnationlab.com/research/stacks',
        name: 'Research Stacks & Combinations | Pep Nation Lab',
        description: 'Explore curated peptide research stacks and multi-compound combinations. Study synergistic compound protocols organized by research goal. Research use only.',
        isPartOf: { '@id': 'https://pepnationlab.com/#website' },
        publisher: { '@id': 'https://pepnationlab.com/#organization' }
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://pepnationlab.com' },
          { '@type': 'ListItem', position: 2, name: 'Research Library', item: 'https://pepnationlab.com/research' },
          { '@type': 'ListItem', position: 3, name: 'Stacks', item: 'https://pepnationlab.com/research/stacks' }
        ]
      }
    ]
  };

  const compounds = await getAllCompounds();
  const stacks = compounds.filter((c) => c.is_stack);
  const allSlugs = Array.from(new Set([
    ...stacks.map((s) => s.slug),
    ...stacks.flatMap((s) => s.stack_components)
  ]));
  const productCtx = await getAreaProducts(allSlugs);
  const products = productCtx.products;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div style={{ position: 'relative', minHeight: '100dvh', overflowX: 'hidden', background: 'var(--black, #050A0F)' }}>
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '50vw', height: '50vw', background: 'radial-gradient(circle, rgba(0, 196, 188, 0.15) 0%, transparent 70%)', filter: 'blur(80px)' }} />
        <div style={{ position: 'absolute', top: '20%', right: '-15%', width: '60vw', height: '60vw', background: 'radial-gradient(circle, rgba(0, 229, 255, 0.1) 0%, transparent 70%)', filter: 'blur(100px)' }} />
      </div>
      <div style={{ position: 'relative', zIndex: 1, maxWidth: '1200px', margin: '0 auto', padding: 'var(--space-8, 64px) var(--space-4, 16px)' }}>
        <header style={{ marginBottom: 'var(--space-8, 64px)', textAlign: 'center' }}>
          <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 900, letterSpacing: '-0.02em', background: 'linear-gradient(135deg, #FFFFFF 0%, #00E5FF 50%, #00C4BC 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: '0 0 var(--space-3, 16px) 0', lineHeight: 1.1 }}>Peptide Stacks</h1>
          <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.15rem', maxWidth: '680px', margin: '0 auto', lineHeight: 1.6 }}>Design, Compare, And Optimize Research Combinations. Evaluate Compound Synergy, Calculate Cumulative Risk Factors, And Auto-Generate 12-Week Dosing Protocols.</p>
        </header>
        <StacksClient compounds={compounds} stacks={stacks} products={products} />
      </div>
    </div>
      </>
  );
}
