/**
 * FAQ — general peptide and research-library questions, grouped by category.
 * Server component using native <details> disclosure so it needs no client JS.
 * Pure static content from lib/research-education. Research-use-only framing.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { HelpCircle } from 'lucide-react';
import { PEPTIDE_FAQ, FAQ_CATEGORY_ORDER } from '@/lib/research-education';

export const metadata: Metadata = {
  title: 'FAQ | Peptide Questions | Pep Nation Lab',
  robots: { index: false, follow: false },
};

export default function FaqPage() {
  const byCat: Record<string, typeof PEPTIDE_FAQ> = {};
  for (const f of PEPTIDE_FAQ) (byCat[f.category] ||= []).push(f);
  const cats = FAQ_CATEGORY_ORDER.filter((c) => byCat[c]?.length);

  return (
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
          Common Questions About Research Peptides, Handling, Storage, Safety, And How To Use This Library. For
          Laboratory Research Only. Not Medical Advice Or Dosing Guidance.
        </p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6, 32px)' }}>
        {cats.map((cat) => (
          <section key={cat}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--white, #FFFFFF)', margin: '0 0 var(--space-3, 12px)' }}>
              {cat}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2, 8px)' }}>
              {byCat[cat].map((f, i) => (
                <details
                  key={i}
                  className="card-glass"
                  style={{ borderRadius: 'var(--radius-lg, 12px)', padding: 'var(--space-3, 12px) var(--space-4, 16px)' }}
                >
                  <summary
                    style={{
                      cursor: 'pointer',
                      fontWeight: 700,
                      color: 'var(--white, #FFFFFF)',
                      fontSize: '0.98rem',
                      listStyle: 'revert',
                    }}
                  >
                    {f.q}
                  </summary>
                  <p style={{ margin: 'var(--space-2, 8px) 0 0', color: 'var(--silver, #A8B4C0)', fontSize: '0.93rem', lineHeight: 1.6 }}>{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p style={{ fontSize: '0.85rem', color: 'var(--silver, #A8B4C0)', marginTop: 'var(--space-7, 48px)' }}>
        Looking For A Specific Compound? Use Ask The Lab On The{' '}
        <Link href="/research" style={{ color: 'var(--teal, #00C4BC)', textDecoration: 'none' }}>Research Library</Link>{' '}
        Or Browse The Full Catalog.
      </p>
    </div>
  );
}
