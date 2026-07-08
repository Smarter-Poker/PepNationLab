/**
 * Compare Compounds page - hosts the interactive side-by-side comparison tool.
 * Server component fetches the catalog and hands it to the client tool.
 * Research-use-only framing throughout.
 */

import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getAllCompounds } from '@/lib/compounds-server';
import { getAreaProducts, type AreaProduct } from '@/lib/area-products-server';
import CompareTool from '@/components/research/CompareTool';

export const metadata: Metadata = {
  title: 'Compare Research Compounds | Pep Nation Lab',
  description: 'Side-by-side comparison of research-grade peptides and compounds. Compare mechanisms, half-lives, research evidence, and handling for informed research decisions.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://pepnationlab.com/research/compare' },
  openGraph: {
    title: 'Compare Research Compounds | Pep Nation Lab',
    description: 'Side-by-side peptide comparison: mechanisms, half-lives, evidence, and dosing guides.',
    url: 'https://pepnationlab.com/research/compare',
    type: 'website',
    images: [{ url: '/og-card.png', width: 1200, height: 630, alt: 'Research Compound Comparison Tool' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Compare Research Compounds | Pep Nation Lab',
    description: 'Side-by-side peptide comparison: mechanisms, half-lives, research evidence, and handling.',
    images: ['/og-card.png'],
  },
};

export default async function CompareCompoundsPage({
  searchParams,
}: {
  searchParams: Promise<{ add?: string; compare?: string }>;
}) {
  const params = await searchParams;
  const rawCompare = String(params.compare ?? params.add ?? '');
  const compounds = await getAllCompounds();
  const initialSlugs = rawCompare
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const { products } = await getAreaProducts(compounds.map((c) => c.slug));

  return (
    <div style={{ minHeight: '100dvh', position: 'relative' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'WebPage',
              '@id': 'https://pepnationlab.com/research/compare#webpage',
              url: 'https://pepnationlab.com/research/compare',
              name: 'Compare Research Compounds | Pep Nation Lab',
              description: 'Side-by-side comparison of research-grade peptides. Compare mechanisms, half-lives, research evidence, and handling.',
              isPartOf: { '@id': 'https://pepnationlab.com/#website' },
              publisher: { '@id': 'https://pepnationlab.com/#organization' },
            },
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://pepnationlab.com' },
                { '@type': 'ListItem', position: 2, name: 'Research Library', item: 'https://pepnationlab.com/research' },
                { '@type': 'ListItem', position: 3, name: 'Compare Compounds', item: 'https://pepnationlab.com/research/compare' },
              ],
            },
          ],
        }) }}
      />

      {/* Dynamic Animated Background Mesh/Glow */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '60%', height: '80%', background: 'radial-gradient(ellipse at center, rgba(0, 196, 188, 0.08) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(80px)' }} />
        <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '60%', height: '80%', background: 'radial-gradient(ellipse at center, rgba(104, 211, 145, 0.06) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(80px)' }} />
        <div style={{ position: 'absolute', top: '10%', right: '20%', width: '40%', height: '40%', background: 'radial-gradient(circle at center, rgba(59, 130, 246, 0.04) 0%, rgba(0,0,0,0) 60%)', filter: 'blur(100px)' }} />
      </div>

      {/* Main Content Container */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: 'var(--space-6, 40px) var(--space-4, 20px)', position: 'relative', zIndex: 1 }}>
        <nav style={{ marginBottom: 'var(--space-5, 24px)' }}>
          <Link href="/research" style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.9rem', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, letterSpacing: '0.02em', background: 'rgba(0,196,188,0.08)', padding: '6px 14px', borderRadius: 99, border: '1px solid rgba(0,196,188,0.2)' }}>
            <ArrowLeft size={16} /> Back To Research Library
          </Link>
        </nav>

        <header style={{ marginBottom: 'var(--space-7, 48px)', textAlign: 'center' }}>
          <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', fontWeight: 900, color: 'var(--white, #FFFFFF)', margin: '0 0 16px 0', letterSpacing: '-0.03em', lineHeight: 1.1, textShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
            Compare <span style={{ background: 'linear-gradient(135deg, #00C4BC 0%, #68D391 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Compounds</span>
          </h1>
          <p
            style={{
              color: 'var(--silver, #A8B4C0)',
              fontSize: 'clamp(1rem, 2vw, 1.15rem)',
              margin: '0 auto',
              maxWidth: '640px',
              lineHeight: 1.6,
              fontWeight: 500,
            }}
          >
            Select Up To Four Compounds To Review Their Evidence, Targets, And Handling Side By Side. <br/>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85em', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: 12, display: 'inline-block' }}>For Laboratory Research Only</span>
          </p>
        </header>

        <Suspense fallback={<div style={{ textAlign: 'center', padding: '60px', color: 'var(--silver, #A8B4C0)' }}>Loading Compare Tool…</div>}>
          <CompareTool compounds={compounds} initialSlugs={initialSlugs} products={products} />
        </Suspense>
      </div>
    </div>
  );
}
