/**
 * Glossary — an A-to-Z reference of peptide-science terms used across the
 * research library. Server component; pure static content from
 * lib/research-education. Definitions are factual and research-framed.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { PEPTIDE_GLOSSARY } from '@/lib/research-education';

export const metadata: Metadata = {
  title: 'Glossary | Peptide Terms | Pep Nation Lab',
  robots: { index: false, follow: false },
};

export default function GlossaryPage() {
  const sorted = [...PEPTIDE_GLOSSARY].sort((a, b) => a.term.localeCompare(b.term));

  // Group by first character (digits bucket under "#").
  const groups: Record<string, typeof sorted> = {};
  for (const e of sorted) {
    const first = e.term[0].toUpperCase();
    const key = /[A-Z]/.test(first) ? first : '#';
    (groups[key] ||= []).push(e);
  }
  const letters = Object.keys(groups).sort();

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: 'var(--space-6, 32px) var(--space-4, 16px)' }}>
      <nav style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Link href="/research" style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.9rem', textDecoration: 'none' }}>
          Back To Research Library
        </Link>
      </nav>

      <header style={{ marginBottom: 'var(--space-5, 24px)' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--white, #FFFFFF)', margin: 0 }}>
          <BookOpen size={24} aria-hidden="true" style={{ verticalAlign: '-3px', marginRight: 10, color: 'var(--teal, #00C4BC)' }} />
          Peptide Glossary
        </h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.05rem', marginTop: 'var(--space-2, 8px)', maxWidth: '720px' }}>
          Plain-Language Definitions Of The Terms Used Throughout The Research Library, From Amino Acid To WADA. For
          Laboratory Research Only.
        </p>
      </header>

      {/* Letter index */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: 'var(--space-6, 32px)' }}>
        {letters.map((l) => (
          <a
            key={l}
            href={`#letter-${l}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 34,
              height: 34,
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'var(--teal, #00C4BC)',
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: '0.85rem',
            }}
          >
            {l}
          </a>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6, 32px)' }}>
        {letters.map((l) => (
          <section key={l} id={`letter-${l}`} style={{ scrollMarginTop: '80px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--teal, #00C4BC)', margin: '0 0 var(--space-3, 12px)', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '6px' }}>
              {l}
            </h2>
            <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)' }}>
              {groups[l].map((e) => (
                <div key={e.term}>
                  <dt style={{ fontWeight: 700, color: 'var(--white, #FFFFFF)', fontSize: '0.98rem' }}>{e.term}</dt>
                  <dd style={{ margin: '2px 0 0', color: 'var(--silver, #A8B4C0)', fontSize: '0.92rem', lineHeight: 1.55 }}>{e.def}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}
