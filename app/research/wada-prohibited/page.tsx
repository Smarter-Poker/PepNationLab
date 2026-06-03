/**
 * Focused view: all WADA-prohibited compounds with per-year history.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';
import { getAllCompounds } from '@/lib/compounds-server';
import { evidenceTier, wadaLabel } from '@/lib/compounds';

export const metadata: Metadata = {
  title: 'WADA Prohibited | Research Library | Pep Nation Lab',
  robots: { index: false, follow: false },
};

export default async function ResearchWadaProhibitedPage() {
  const supabase = await createServiceClient();
  const compounds = (await getAllCompounds()).filter((c) => c.wada_status === 'prohibited' || c.wada_status === 'prohibited_males');

  const slugs = compounds.map((c) => c.slug);
  const { data: historyRows } = slugs.length
    ? await supabase.from('compound_wada_history').select('compound_slug, year, status, notes, source_url').in('compound_slug', slugs).order('year', { ascending: false })
    : { data: [] };

  const historyBySlug = new Map<string, Array<{ year: number; status: string; notes: string | null; source_url: string | null }>>();
  for (const row of (historyRows ?? []) as Array<{ compound_slug: string; year: number; status: string; notes: string | null; source_url: string | null }>) {
    if (!historyBySlug.has(row.compound_slug)) historyBySlug.set(row.compound_slug, []);
    historyBySlug.get(row.compound_slug)!.push({ year: row.year, status: row.status, notes: row.notes, source_url: row.source_url });
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: 'var(--space-6, 32px) var(--space-4, 16px)' }}>
      <nav style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Link href="/research" style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.9rem', textDecoration: 'none' }}>
          Back To Research Library
        </Link>
      </nav>
      <header style={{ marginBottom: 'var(--space-5, 24px)' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--white, #FFFFFF)', margin: 0 }}>
          WADA Prohibited
        </h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.05rem', marginTop: 'var(--space-2, 8px)', maxWidth: '760px' }}>
          Compounds Currently On The WADA Prohibited List. Not For Use By Tested Athletes. Per-Year History Where Available.
        </p>
      </header>

      {compounds.length === 0 ? (
        <div className="card-glass" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)', color: 'var(--silver, #A8B4C0)' }}>
          No WADA-Prohibited Compounds Currently In The Catalog.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4, 16px)' }}>
          {compounds.map((c) => {
            const t = evidenceTier(c.evidence_tier);
            const history = historyBySlug.get(c.slug) ?? [];
            return (
              <article key={c.slug} className="card-metal" style={{ padding: 'var(--space-4, 16px) var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)', borderLeft: '3px solid var(--red-600, #E53E3E)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-3, 12px)', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                    <Link href={`/research/${c.slug}`} style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--white, #FFFFFF)', textDecoration: 'none' }}>
                      {c.display_name}
                    </Link>
                    <span style={{ fontSize: '0.82rem', color: 'var(--silver, #A8B4C0)' }}>{c.category} · <span style={{ color: t.color }}>{t.label}</span></span>
                  </div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--red-600, #E53E3E)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{wadaLabel(c.wada_status)}</span>
                </div>
                {history.length > 0 && (
                  <div style={{ marginTop: 'var(--space-3, 12px)' }}>
                    <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--silver-light, #D0DAE4)', margin: 0, marginBottom: 'var(--space-2, 8px)' }}>Prohibition History</h3>
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {history.map((h) => (
                        <li key={h.year} style={{ fontSize: '0.8rem', color: 'var(--silver, #A8B4C0)' }}>
                          <strong style={{ color: 'var(--white, #FFFFFF)' }}>{h.year}</strong>: {h.status}{h.notes ? ` — ${h.notes}` : ''}
                          {h.source_url && (
                            <>{' '}<a href={h.source_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--teal, #00C4BC)', textDecoration: 'none' }}>Source</a></>
                          )}
                        </li>
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
