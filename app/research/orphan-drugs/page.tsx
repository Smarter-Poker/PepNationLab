/**
 * Orphan-drug-designated compounds. WHERE is_orphan_drug = true.
 * Server component.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { evidenceTier, wadaLabel } from '@/lib/compounds';

export const metadata: Metadata = {
  title: 'Orphan Drug Designations | Research Library | Pep Nation Lab',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

interface OrphanRow {
  slug: string;
  display_name: string;
  evidence_tier: string;
  wada_status: string;
  category: string | null;
  plain_summary: string | null;
  orphan_indications: string[] | null;
  fda_approval_year: number | null;
  ema_approval_year: number | null;
}

export default async function ResearchOrphanDrugsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('compounds')
    .select('slug, display_name, evidence_tier, wada_status, category, plain_summary, orphan_indications, fda_approval_year, ema_approval_year')
    .eq('is_orphan_drug', true)
    .order('display_name', { ascending: true });

  const rows = (data ?? []) as OrphanRow[];

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: 'var(--space-6, 32px) var(--space-4, 16px)' }}>
      <nav style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Link href="/research" style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.9rem', textDecoration: 'none' }}>
          Back To Research Library
        </Link>
      </nav>
      <header style={{ marginBottom: 'var(--space-5, 24px)' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--white, #FFFFFF)', margin: 0 }}>
          Orphan Drug Designations
        </h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.05rem', marginTop: 'var(--space-2, 8px)', maxWidth: '760px' }}>
          Compounds Granted Orphan Drug Status By The FDA Or EMA For Rare-Disease Indications.
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="card-glass" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)', color: 'var(--silver, #A8B4C0)' }}>
          Orphan Designations Will Populate Once The FDA Orphan Drug And EMA Sync Crons Run.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4, 16px)' }}>
          {rows.map((c) => {
            const t = evidenceTier(c.evidence_tier);
            return (
              <article key={c.slug} className="card-metal" style={{ padding: 'var(--space-4, 16px) var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)' }}>
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
                  <div style={{ display: 'flex', gap: 'var(--space-3, 12px)', fontSize: '0.78rem', color: 'var(--teal, #00C4BC)' }}>
                    {c.fda_approval_year && <span>FDA: {c.fda_approval_year}</span>}
                    {c.ema_approval_year && <span>EMA: {c.ema_approval_year}</span>}
                  </div>
                </div>
                {c.orphan_indications && c.orphan_indications.length > 0 && (
                  <div style={{ marginTop: 'var(--space-3, 12px)' }}>
                    <h3 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--silver-light, #D0DAE4)', margin: 0, marginBottom: 'var(--space-2, 8px)' }}>Orphan Indications</h3>
                    <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--silver, #A8B4C0)', fontSize: '0.85rem' }}>
                      {c.orphan_indications.map((ind, i) => (
                        <li key={i} style={{ lineHeight: 1.6 }}>{ind}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
