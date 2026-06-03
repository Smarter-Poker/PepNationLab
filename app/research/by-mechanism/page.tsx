/**
 * Browse compounds clustered by mechanism keyword.
 * Server component.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllCompounds } from '@/lib/compounds-server';
import { evidenceTier, wadaLabel } from '@/lib/compounds';

export const metadata: Metadata = {
  title: 'Browse By Mechanism | Research Library | Pep Nation Lab',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

function mechanismKey(m: string | null): string {
  if (!m || !m.trim()) return 'Unspecified Mechanism';
  const words = m.trim().toLowerCase().split(/\s+/).slice(0, 3).join(' ');
  return words.replace(/(^|\s)\S/g, (s) => s.toUpperCase());
}

export default async function ResearchByMechanismPage() {
  const all = await getAllCompounds();
  const sorted = [...all].sort((a, b) => a.display_name.localeCompare(b.display_name));

  const buckets = new Map<string, typeof sorted>();
  for (const c of sorted) {
    const key = mechanismKey(c.mechanism);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(c);
  }
  const keys = Array.from(buckets.keys()).sort((a, b) => buckets.get(b)!.length - buckets.get(a)!.length || a.localeCompare(b));

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: 'var(--space-6, 32px) var(--space-4, 16px)' }}>
      <nav style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Link href="/research" style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.9rem', textDecoration: 'none' }}>
          Back To Research Library
        </Link>
      </nav>
      <header style={{ marginBottom: 'var(--space-5, 24px)' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--white, #FFFFFF)', margin: 0 }}>
          Browse By Mechanism
        </h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.05rem', marginTop: 'var(--space-2, 8px)', maxWidth: '760px' }}>
          Compounds Clustered By Stated Mechanism Of Action.
        </p>
      </header>

      {keys.length === 0 && (
        <div className="card-glass" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)', color: 'var(--silver, #A8B4C0)' }}>
          No Mechanism Annotations Are Currently Indexed.
        </div>
      )}

      {keys.map((k) => (
        <section key={k} style={{ marginBottom: 'var(--space-6, 32px)', scrollMarginTop: '90px' }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--teal, #00C4BC)', marginBottom: 'var(--space-3, 12px)' }}>
            {k} ({buckets.get(k)!.length})
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'var(--space-3, 12px)' }}>
            {buckets.get(k)!.map((c) => {
              const t = evidenceTier(c.evidence_tier);
              return (
                <Link
                  key={c.slug}
                  href={`/research/${c.slug}`}
                  className="card-metal"
                  style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1, 4px)', padding: 'var(--space-3, 12px) var(--space-4, 16px)', borderRadius: 'var(--radius-lg, 12px)', textDecoration: 'none', color: 'var(--white, #FFFFFF)' }}
                >
                  <span style={{ fontSize: '0.7rem', color: t.color, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>{t.label}</span>
                  <span style={{ fontSize: '1rem', fontWeight: 700 }}>{c.display_name}</span>
                  {c.plain_summary && (
                    <span style={{ fontSize: '0.78rem', color: 'var(--silver, #A8B4C0)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.plain_summary}</span>
                  )}
                  {c.wada_status && c.wada_status !== 'not_listed' && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--silver, #A8B4C0)', marginTop: '4px' }}>{wadaLabel(c.wada_status)}</span>
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
