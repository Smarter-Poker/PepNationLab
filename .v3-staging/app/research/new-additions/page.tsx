/**
 * /research/new-additions -- ten most-recently created compounds, sorted by
 * compounds.created_at DESC. Acts as a catalog changelog.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { evidenceTier } from '@/lib/compounds';
import type { Compound } from '@/lib/compounds';
import GlobalSearchBar from '@/components/research/GlobalSearchBar';
import BrowseSurfaceNav from '@/components/research/BrowseSurfaceNav';

export const metadata: Metadata = {
  title: 'Recent Catalog Additions | Research Library | Pep Nation Lab',
  robots: { index: false, follow: false },
};

interface AdditionRow extends Compound {
  created_at?: string | null;
}

export default async function NewAdditionsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('compounds')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
  const rows: AdditionRow[] = (data ?? []) as AdditionRow[];

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '32px 16px 64px' }}>
      <nav style={{ marginBottom: 16 }}>
        <Link href="/research" style={{ color: '#00C4BC', fontSize: 13, textDecoration: 'none' }}>
          Back To Research Library
        </Link>
      </nav>

      <header style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: '#FFFFFF', margin: 0 }}>
          Recent Catalog Additions
        </h1>
        <p style={{ color: '#A8B4C0', fontSize: 16, marginTop: 8, maxWidth: 700 }}>
          The Newest Compounds Added To The Research Library. Each Entry Links Through To The Full
          Research-Use-Only Monograph.
        </p>
      </header>

      <div style={{ marginBottom: 20 }}>
        <GlobalSearchBar compact />
      </div>

      {rows.length === 0 ? (
        <div className="card-glass" style={{ padding: 28, borderRadius: 14, color: '#A8B4C0', textAlign: 'center' }}>
          No Compounds Found Yet.
        </div>
      ) : (
        <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
          {rows.map((c) => {
            const t = evidenceTier(c.evidence_tier);
            const added = c.created_at
              ? new Date(c.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
              : null;
            return (
              <li key={c.slug}>
                <Link
                  href={`/research/${c.slug}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    padding: '14px 18px',
                    borderRadius: 12,
                    background: 'rgba(15,25,35,0.55)',
                    border: '1px solid rgba(168,180,192,0.18)',
                    textDecoration: 'none',
                    color: '#FFFFFF',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 17, fontWeight: 800 }}>{c.display_name}</span>
                    <span style={{
                      fontSize: 10, color: t.color, border: `1px solid ${t.color}`,
                      padding: '2px 8px', borderRadius: 999, fontWeight: 700,
                    }}>{t.label}</span>
                    {added && (
                      <span style={{ fontSize: 11, color: '#A8B4C0', marginLeft: 'auto' }}>Added {added}</span>
                    )}
                  </div>
                  {c.plain_summary && (
                    <span style={{ color: '#D0DAE4', fontSize: 13, lineHeight: 1.55 }}>{c.plain_summary}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ol>
      )}

      <div style={{ marginTop: 24 }}>
        <BrowseSurfaceNav />
      </div>
    </div>
  );
}
