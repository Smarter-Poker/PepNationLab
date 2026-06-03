/**
 * Discontinued compounds -- WHERE is_discontinued = true.
 * Server component.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { evidenceTier, wadaLabel } from '@/lib/compounds';

export const metadata: Metadata = {
  title: 'Discontinued Compounds | Research Library | Pep Nation Lab',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

interface DiscontinuedRow {
  slug: string;
  display_name: string;
  evidence_tier: string;
  wada_status: string;
  category: string | null;
  plain_summary: string | null;
  discontinuation_reason: string | null;
  discontinuation_year: number | null;
}

export default async function ResearchDiscontinuedPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('compounds')
    .select('slug, display_name, evidence_tier, wada_status, category, plain_summary, discontinuation_reason, discontinuation_year')
    .eq('is_discontinued', true)
    .order('discontinuation_year', { ascending: false });

  const rows = (data ?? []) as DiscontinuedRow[];

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: 'var(--space-6, 32px) var(--space-4, 16px)' }}>
      <nav style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Link href="/research" style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.9rem', textDecoration: 'none' }}>
          Back To Research Library
        </Link>
      </nav>
      <header style={{ marginBottom: 'var(--space-5, 24px)' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--white, #FFFFFF)', margin: 0 }}>
          Discontinued Compounds
        </h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.05rem', marginTop: 'var(--space-2, 8px)', maxWidth: '760px' }}>
          Compounds Pulled From Development Or Marketed Use. Reasons Range From Safety Signals To Strategic Portfolio Decisions.
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="card-glass" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)', color: 'var(--silver, #A8B4C0)' }}>
          No Discontinued Compounds Currently In The Catalog.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4, 16px)' }}>
          {rows.map((c) => {
            const t = evidenceTier(c.evidence_tier);
            return (
              <article key={c.slug} className="card-metal" style={{ padding: 'var(--space-4, 16px) var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)', borderLeft: '3px solid var(--red-600, #E53E3E)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-3, 12px)', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                    <Link href={`/research/${c.slug}`} style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--white, #FFFFFF)', textDecoration: 'none' }}>
                      {c.display_name}
                    </Link>
                    <span style={{ fontSize: '0.82rem', color: 'var(--silver, #A8B4C0)' }}>
                      {c.category} - <span style={{ color: t.color }}>{t.label}</span>
                      {c.wada_status && c.wada_status !== 'not_listed' ? ` - ${wadaLabel(c.wada_status)}` : ''}
                    </span>
                  </div>
                  {c.discontinuation_year && (
                    <span style={{ fontSize: '0.85rem', color: 'var(--red-600, #E53E3E)', fontWeight: 700 }}>
                      Discontinued {c.discontinuation_year}
                    </span>
                  )}
                </div>
                {c.discontinuation_reason && (
                  <p style={{ marginTop: 'var(--space-3, 12px)', marginBottom: 0, fontSize: '0.9rem', color: 'var(--silver-light, #D0DAE4)', lineHeight: 1.6 }}>
                    <strong style={{ color: 'var(--white, #FFFFFF)' }}>Reason:</strong> {c.discontinuation_reason}
                  </p>
                )}
                {c.plain_summary && (
                  <p style={{ marginTop: 'var(--space-2, 8px)', marginBottom: 0, fontSize: '0.85rem', color: 'var(--silver, #A8B4C0)', lineHeight: 1.6 }}>
                    {c.plain_summary}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
