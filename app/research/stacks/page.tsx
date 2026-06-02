import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllCompounds } from '@/lib/compounds-server';
import StackBuilder from '@/components/research/StackBuilder';

export const metadata: Metadata = {
  title: 'Stacks & Combinations',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function StacksPage() {
  const compounds = await getAllCompounds();
  const stacks = compounds.filter((c) => c.is_stack);
  const bySlug = new Map(compounds.map((c) => [c.slug, c]));

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: 'var(--space-6) var(--space-4)' }}>
      <header style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{ margin: 0, color: '#FFFFFF', fontSize: '2rem', fontWeight: 800 }}>
          Stacks &amp; Combinations
        </h1>
        <p style={{ margin: 'var(--space-3) 0 0', color: '#A8B4C0', maxWidth: 720, lineHeight: 1.55 }}>
          Documented Compound Combinations Studied Together In The Research Literature. For Research
          Use Only. Educational Reference, Not A Protocol Or Medical Advice.
        </p>
      </header>

      {stacks.length === 0 ? (
        <div className="card" style={{ padding: 'var(--space-6)', color: '#A8B4C0' }}>
          No Documented Combinations Are Listed Yet.
        </div>
      ) : (
        <div className="grid-2" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
          {stacks.map((stack) => (
            <article
              key={stack.slug}
              className="card-metal"
              style={{ padding: 0 }}
            >
              <div className="metal-frame">
                <div className="metal-content" style={{ padding: 'var(--space-5)' }}>
                  <Link
                    href={`/research/${stack.slug}`}
                    style={{ color: '#00C4BC', fontWeight: 700, fontSize: '1.2rem', textDecoration: 'none' }}
                  >
                    {stack.display_name}
                  </Link>
                  {stack.stack_rationale && (
                    <p style={{ margin: 'var(--space-3) 0 0', color: '#D0DAE4', lineHeight: 1.55 }}>
                      {stack.stack_rationale}
                    </p>
                  )}
                  {stack.stack_components.length > 0 && (
                    <div style={{ marginTop: 'var(--space-4)' }}>
                      <p style={{ margin: '0 0 var(--space-2)', color: '#A8B4C0', fontSize: '0.85rem', fontWeight: 700 }}>
                        Components
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {stack.stack_components.map((compSlug) => {
                          const comp = bySlug.get(compSlug);
                          const label = comp?.display_name ?? compSlug;
                          return (
                            <Link
                              key={compSlug}
                              href={`/research/${compSlug}`}
                              style={{
                                padding: '0.3rem 0.7rem',
                                borderRadius: '999px',
                                border: '1px solid #1D2D3E',
                                background: '#0F1923',
                                color: '#D0DAE4',
                                fontSize: '0.85rem',
                                textDecoration: 'none',
                              }}
                            >
                              {label}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <StackBuilder compounds={compounds} />
    </div>
  );
}
