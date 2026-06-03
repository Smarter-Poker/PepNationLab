/**
 * /research/wada-prohibited -- focused list of WADA-flagged compounds with
 * the year-by-year regulatory history rendered when available from the
 * compound_wada_history table.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { evidenceTier, wadaLabel } from '@/lib/compounds';
import type { Compound } from '@/lib/compounds';
import GlobalSearchBar from '@/components/research/GlobalSearchBar';
import BrowseSurfaceNav from '@/components/research/BrowseSurfaceNav';

export const metadata: Metadata = {
  title: 'WADA Prohibited Compounds | Research Library | Pep Nation Lab',
  robots: { index: false, follow: false },
};

interface HistoryRow {
  compound_slug: string;
  year: number;
  status: string;
  note: string | null;
}

export default async function WadaProhibitedPage() {
  const supabase = await createClient();
  const { data: comps } = await supabase
    .from('compounds')
    .select('*')
    .in('wada_status', ['prohibited', 'prohibited_males'])
    .order('display_name', { ascending: true });
  const compounds = (comps ?? []) as Compound[];

  let historyBySlug: Record<string, HistoryRow[]> = {};
  if (compounds.length > 0) {
    const slugs = compounds.map((c) => c.slug);
    const { data: hist } = await supabase
      .from('compound_wada_history')
      .select('compound_slug, year, status, note')
      .in('compound_slug', slugs)
      .order('year', { ascending: true });
    const rows = (hist ?? []) as HistoryRow[];
    historyBySlug = rows.reduce<Record<string, HistoryRow[]>>((acc, r) => {
      (acc[r.compound_slug] ??= []).push(r);
      return acc;
    }, {});
  }

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '32px 16px 64px' }}>
      <nav style={{ marginBottom: 16 }}>
        <Link href="/research" style={{ color: '#00C4BC', fontSize: 13, textDecoration: 'none' }}>
          Back To Research Library
        </Link>
      </nav>

      <header style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: '#FFFFFF', margin: 0 }}>
          WADA Prohibited Compounds
        </h1>
        <p style={{ color: '#A8B4C0', fontSize: 16, marginTop: 8, maxWidth: 760 }}>
          Compounds Currently On The World Anti-Doping Agency Prohibited List, With Per-Year
          Regulatory History Where Available. Not For Use By Tested Athletes.
        </p>
      </header>

      <div style={{ marginBottom: 20 }}>
        <GlobalSearchBar compact />
      </div>

      {compounds.length === 0 ? (
        <div className="card-glass" style={{ padding: 28, borderRadius: 14, color: '#A8B4C0', textAlign: 'center' }}>
          No WADA-Prohibited Compounds In The Catalog.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {compounds.map((c) => {
            const t = evidenceTier(c.evidence_tier);
            const history = historyBySlug[c.slug] ?? [];
            return (
              <article
                key={c.slug}
                style={{
                  padding: 18,
                  borderRadius: 14,
                  background: 'rgba(15,25,35,0.55)',
                  border: '1px solid rgba(229,62,62,0.4)',
                  borderLeft: '3px solid #E53E3E',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                  <Link href={`/research/${c.slug}`} style={{ color: '#FFFFFF', textDecoration: 'none', fontSize: 18, fontWeight: 800 }}>
                    {c.display_name}
                  </Link>
                  <span style={{
                    fontSize: 10, color: '#E53E3E', border: '1px solid #E53E3E',
                    padding: '2px 8px', borderRadius: 999, fontWeight: 700,
                  }}>{wadaLabel(c.wada_status)}</span>
                  <span style={{
                    fontSize: 10, color: t.color, border: `1px solid ${t.color}`,
                    padding: '2px 8px', borderRadius: 999, fontWeight: 700,
                  }}>{t.label}</span>
                </div>
                {c.plain_summary && (
                  <p style={{ margin: '8px 0 0', color: '#D0DAE4', fontSize: 13, lineHeight: 1.6 }}>
                    {c.plain_summary}
                  </p>
                )}
                {history.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 11, color: '#A8B4C0', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>
                      Regulatory History
                    </div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 4 }}>
                      {history.map((h, idx) => (
                        <li key={`${h.year}-${idx}`} style={{ display: 'flex', gap: 10, fontSize: 13, color: '#D0DAE4' }}>
                          <span style={{ color: '#00C4BC', fontWeight: 700, minWidth: 48 }}>{h.year}</span>
                          <span style={{ color: '#FFFFFF', minWidth: 140 }}>{wadaLabel(h.status)}</span>
                          {h.note && <span style={{ color: '#A8B4C0' }}>{h.note}</span>}
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

      <div style={{ marginTop: 24 }}>
        <BrowseSurfaceNav />
      </div>
    </div>
  );
}
