import type { Metadata } from 'next';
import { getAllCompounds } from '@/lib/compounds-server';
import { getAreaProducts } from '@/lib/area-products-server';
import StacksClient from '@/components/research/StacksClient';

export const metadata: Metadata = {
  title: 'Stacks & Combinations',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function StacksPage() {
  const compounds = await getAllCompounds();
  const stacks = compounds.filter((c) => c.is_stack);
  const allSlugs = Array.from(new Set(stacks.flatMap((s) => s.stack_components)));
  const productCtx = await getAreaProducts(allSlugs);
  const products = productCtx.products;

  return (
    <div style={{ position: 'relative', minHeight: '100dvh', overflowX: 'hidden', background: 'var(--black, #050A0F)' }}>
      {/* Ambient Background Orbs */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '50vw', height: '50vw', background: 'radial-gradient(circle, rgba(0, 196, 188, 0.15) 0%, transparent 70%)', filter: 'blur(80px)' }} />
        <div style={{ position: 'absolute', top: '20%', right: '-15%', width: '60vw', height: '60vw', background: 'radial-gradient(circle, rgba(0, 229, 255, 0.1) 0%, transparent 70%)', filter: 'blur(100px)' }} />
      </div>
      
      <div style={{ position: 'relative', zIndex: 1, maxWidth: '1200px', margin: '0 auto', padding: 'var(--space-8, 64px) var(--space-4, 16px)' }}>
        <header style={{ marginBottom: 'var(--space-8, 64px)', textAlign: 'center' }}>
          <h1
            style={{
              fontSize: 'clamp(2.5rem, 5vw, 4rem)',
              fontWeight: 900,
              letterSpacing: '-0.02em',
              background: 'linear-gradient(135deg, #FFFFFF 0%, #00E5FF 50%, #00C4BC 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              margin: '0 0 var(--space-3, 16px) 0',
              lineHeight: 1.1,
            }}
          >
            Stacks & Protocols
          </h1>
          <p
            style={{
              color: 'var(--silver, #A8B4C0)',
              fontSize: '1.15rem',
              maxWidth: '680px',
              margin: '0 auto',
              lineHeight: 1.6,
            }}
          >
            Design, compare, and optimize research combinations. Evaluate compound synergy, calculate cumulative risk factors, and auto-generate 12-week dosing protocols.
          </p>
        </header>
        
        <StacksClient compounds={compounds} stacks={stacks} products={products} />
      </div>
    </div>
  );
}
