/**
 * Learn hub — foundational, research-use-only education guides covering what
 * peptides are, evidence tiers, reconstitution, storage, reading a monograph,
 * WADA, quality verification, and the major peptide classes. Server component;
 * pure static content from lib/research-education. No dosing or medical advice.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { GraduationCap } from 'lucide-react';
import { LEARN_GUIDES } from '@/lib/research-education';

export const metadata: Metadata = {
  title: 'Learn | Peptide Education Hub | Pep Nation Lab',
  robots: { index: false, follow: false },
};

export default function LearnHubPage() {
  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: 'var(--space-6, 32px) var(--space-4, 16px)' }}>
      <nav style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Link href="/research" style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.9rem', textDecoration: 'none' }}>
          Back To Research Library
        </Link>
      </nav>

      <header style={{ marginBottom: 'var(--space-6, 32px)' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--white, #FFFFFF)', margin: 0 }}>
          <GraduationCap size={26} aria-hidden="true" style={{ verticalAlign: '-4px', marginRight: 10, color: 'var(--teal, #00C4BC)' }} />
          Peptide Education Hub
        </h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.05rem', marginTop: 'var(--space-2, 8px)', maxWidth: '720px' }}>
          Foundational Guides To Research Peptides — What They Are, How Evidence Is Graded, How They Are Prepared And
          Stored, And How To Read Every Page In This Library. For Laboratory Research Only. Not Medical Advice Or Dosing Guidance.
        </p>
      </header>

      {/* Jump links */}
      <nav
        aria-label="Guides"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 'var(--space-3, 12px)',
          marginBottom: 'var(--space-7, 48px)',
        }}
      >
        {LEARN_GUIDES.map((g) => (
          <a
            key={g.slug}
            href={`#${g.slug}`}
            className="card-metal"
            style={{
              display: 'block',
              padding: 'var(--space-3, 12px) var(--space-4, 16px)',
              borderRadius: 'var(--radius-lg, 12px)',
              textDecoration: 'none',
              color: 'var(--teal, #00C4BC)',
              fontWeight: 700,
              fontSize: '0.92rem',
            }}
          >
            {g.title}
          </a>
        ))}
      </nav>

      {/* Guides */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-7, 48px)' }}>
        {LEARN_GUIDES.map((g) => (
          <article key={g.slug} id={g.slug} style={{ scrollMarginTop: '80px' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--white, #FFFFFF)', margin: '0 0 var(--space-2, 8px)' }}>
              {g.title}
            </h2>
            <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1rem', margin: '0 0 var(--space-4, 16px)' }}>{g.intro}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4, 16px)' }}>
              {g.sections.map((s, i) => (
                <div key={i} className="card-glass" style={{ padding: 'var(--space-4, 16px)', borderRadius: 'var(--radius-lg, 12px)' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--teal, #00C4BC)', margin: '0 0 var(--space-2, 8px)' }}>
                    {s.heading}
                  </h3>
                  {s.body.split('\n\n').map((para, j) => (
                    <p key={j} style={{ color: 'var(--silver, #D0DAE4)', fontSize: '0.95rem', lineHeight: 1.6, margin: j === 0 ? 0 : 'var(--space-2, 8px) 0 0' }}>
                      {para}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>

      <p style={{ fontSize: '0.78rem', color: 'var(--grey-500, #6B7785)', marginTop: 'var(--space-7, 48px)' }}>
        For Laboratory Research Use Only. This Material Restates Published Science And Is Not Medical Advice, Dosing
        Guidance, Or An Endorsement Of Human Use.
      </p>
    </div>
  );
}
