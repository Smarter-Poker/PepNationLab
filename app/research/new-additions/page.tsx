/**
 * Recent catalog additions. Ordered by created_at DESC.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';
import { evidenceTier } from '@/lib/compounds';

export const metadata: Metadata = {
  title: 'New Additions | Research Library | Pep Nation Lab',
  robots: { index: false, follow: false },
};

export default async function ResearchNewAdditionsPage() {
  const supabase = await createServiceClient();
  const { data: rows } = await supabase
    .from('compounds')
    .select('slug, display_name, evidence_tier, category, plain_summary, created_at')
    .order('created_at', { ascending: false })
    .limit(40);

  const items = (rows ?? []) as Array<{ slug: string; display_name: string; evidence_tier: string; category: string | null; plain_summary: string | null; created_at: string }>;

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: 'var(--space-6, 32px) var(--space-4, 16px)' }}>
      <nav style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Link href="/research" style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.9rem', textDecoration: 'none' }}>
          Back To Research Library
        </Link>
      </nav>
      <header style={{ marginBottom: 'var(--space-5, 24px)' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--white, #FFFFFF)', margin: 0 }}>
          Recent Catalog Additions
        </h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.05rem', marginTop: 'var(--space-2, 8px)', maxWidth: '760px' }}>
          The Forty Most Recently Added Compounds. The Newest Entries Are At The Top.
        </p>
      </header>

      {items.length === 0 ? (
        <div className="card-glass" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)', color: 'var(--silver, #A8B4C0)' }}>
          No Compounds In The Catalog Yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)' }}>
          {items.map((c) => {
            const t = evidenceTier(c.evidence_tier);
            const added = new Date(c.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
            return (
              <Link
                key={c.slug}
                href={`/research/${c.slug}`}
                className="card-metal"
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3, 12px)', padding: 'var(--space-3, 12px) var(--space-4, 16px)', borderRadius: 'var(--radius-lg, 12px)', textDecoration: 'none', color: 'var(--white, #FFFFFF)' }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '1.05rem', fontWeight: 700 }}>{c.display_name}</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--silver, #A8B4C0)' }}>{c.category} · <span style={{ color: t.color }}>{t.label}</span></span>
                  {c.plain_summary && <span style={{ fontSize: '0.78rem', color: 'var(--silver-light, #D0DAE4)', marginTop: '4px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.plain_summary}</span>}
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--silver, #A8B4C0)', whiteSpace: 'nowrap' }}>Added {added}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
