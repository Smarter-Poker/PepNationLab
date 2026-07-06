/**
 * Encyclopedic A-Z index of every compound in the Research Library.
 * Server component, public, research-use-only framing.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllCompounds } from '@/lib/compounds-server';
import { evidenceTier } from '@/lib/compounds';

export const metadata: Metadata = {
  title: 'Peptide A-Z Index | Research Library | Pep Nation Lab',
  description: 'Complete alphabetical index of research-grade peptides and compounds. Find BPC-157, Semaglutide, TB-500, Tirzepatide, and hundreds more RUO compounds.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://pepnationlab.com/research/a-z' },
  openGraph: {
    title: 'Peptide A-Z Index | Pep Nation Lab Research Library',
    description: 'Alphabetical directory of 300+ research-grade peptides with mechanism, evidence, and handling data.',
    url: 'https://pepnationlab.com/research/a-z',
    type: 'website',
  },
};

export default async function ResearchAZPage() {
  const compounds = await getAllCompounds();
  const sorted = [...compounds].sort((a, b) => a.display_name.localeCompare(b.display_name));

  const buckets = new Map<string, typeof sorted>();
  for (const c of sorted) {
    const first = (c.display_name[0] ?? '#').toUpperCase();
    const key = /[A-Z]/.test(first) ? first : '0-9';
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(c);
  }
  const letters = Array.from(buckets.keys()).sort((a, b) => {
    if (a === '0-9') return 1;
    if (b === '0-9') return -1;
    return a.localeCompare(b);
  });

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: 'var(--space-6, 32px) var(--space-4, 16px)' }}>
      <nav style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Link href="/research" style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.9rem', textDecoration: 'none' }}>
          Back To Research Library
        </Link>
      </nav>
      <header style={{ marginBottom: 'var(--space-5, 24px)' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--white, #FFFFFF)', margin: 0 }}>
          A-Z Encyclopedia
        </h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.05rem', marginTop: 'var(--space-2, 8px)', maxWidth: '760px' }}>
          Every Compound In The Catalog, Alphabetized. Click Any Letter To Jump.
        </p>
      </header>

      <nav
        aria-label="Letter Index"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 5,
          background: 'rgba(5,10,15,0.92)',
          backdropFilter: 'blur(8px)',
          padding: 'var(--space-2, 8px) 0',
          marginBottom: 'var(--space-5, 24px)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
        }}
      >
        {letters.map((L) => (
          <a key={L} href={`#letter-${L}`} className="glass-panel" style={{ padding: '4px 10px', borderRadius: 'var(--radius-md, 8px)', color: 'var(--teal, #00C4BC)', textDecoration: 'none', fontWeight: 700, fontSize: '0.85rem' }}>
            {L}
          </a>
        ))}
      </nav>

      {letters.map((L) => (
        <section key={L} id={`letter-${L}`} style={{ marginBottom: 'var(--space-6, 32px)', scrollMarginTop: '90px' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--teal, #00C4BC)', marginBottom: 'var(--space-3, 12px)' }}>{L}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'var(--space-3, 12px)' }}>
            {buckets.get(L)!.map((c) => {
              const t = evidenceTier(c.evidence_tier);
              return (
                <Link
                  key={c.slug}
                  href={`/research/${c.slug}`}
                  className="glass-panel"
                  style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1, 4px)', padding: 'var(--space-3, 12px) var(--space-4, 16px)', borderRadius: 'var(--radius-lg, 12px)', textDecoration: 'none', color: 'var(--white, #FFFFFF)' }}
                >
                  <span style={{ fontSize: '0.7rem', color: t.color, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>{t.label}</span>
                  <span style={{ fontSize: '1rem', fontWeight: 700 }}>{c.display_name}</span>
                  {c.plain_summary && (
                    <span style={{ fontSize: '0.78rem', color: 'var(--silver, #A8B4C0)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.plain_summary}</span>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
