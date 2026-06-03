/**
 * /research/approved-drugs -- compounds with evidence_tier='approved_drug'.
 * Surfaces FDA / EMA approval year when the year_first_approved column is
 * populated.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { evidenceTier } from '@/lib/compounds';
import type { Compound } from '@/lib/compounds';
import GlobalSearchBar from '@/components/research/GlobalSearchBar';
import BrowseSurfaceNav from '@/components/research/BrowseSurfaceNav';

export const metadata: Metadata = {
  title: 'Approved Drugs | Research Library | Pep Nation Lab',
  robots: { index: false, follow: false },
};

interface ApprovedRow extends Compound {
  year_first_approved?: number | null;
}

export default async function ApprovedDrugsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('compounds')
    .select('*')
    .eq('evidence_tier', 'approved_drug')
    .order('display_name', { ascending: true });
  const rows = (data ?? []) as ApprovedRow[];

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '32px 16px 64px' }}>
      <nav style={{ marginBottom: 16 }}>
        <Link href="/research" style={{ color: '#00C4BC', fontSize: 13, textDecoration: 'none' }}>
          Back To Research Library
        </Link>
      </nav>

      <header style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: '#FFFFFF', margin: 0 }}>
          Approved Drugs
        </h1>
        <p style={{ color: '#A8B4C0', fontSize: 16, marginTop: 8, maxWidth: 760 }}>
          Compounds That Have Received FDA Or EMA Approval. The Strongest Evidence Tier In The
          Research Library. Approval Year Shown When Populated.
        </p>
      </header>

      <div style={{ marginBottom: 20 }}>
        <GlobalSearchBar compact />
      </div>

      {rows.length === 0 ? (
        <div className="card-glass" style={{ padding: 28, borderRadius: 14, color: '#A8B4C0', textAlign: 'center' }}>
          No Approved-Drug Entries Yet.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {rows.map((c) => {
            const t = evidenceTier(c.evidence_tier);
            return (
              <Link
                key={c.slug}
                href={`/research/${c.slug}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  padding: 16,
                  borderRadius: 14,
                  background: 'rgba(15,25,35,0.55)',
                  border: '1px solid rgba(104,211,145,0.35)',
                  textDecoration: 'none',
                  color: '#FFFFFF',
                }}
              >
                <span style={{ fontSize: 18, fontWeight: 800 }}>{c.display_name}</span>
                <span style={{
                  alignSelf: 'flex-start',
                  fontSize: 10, color: t.color, border: `1px solid ${t.color}`,
                  padding: '2px 8px', borderRadius: 999, fontWeight: 700,
                }}>{t.label}</span>
                {c.year_first_approved && (
                  <span style={{ fontSize: 12, color: '#00C4BC', fontWeight: 700 }}>
                    First Approved: {c.year_first_approved}
                  </span>
                )}
                {c.plain_summary && (
                  <p style={{ margin: 0, color: '#D0DAE4', fontSize: 13, lineHeight: 1.55 }}>
                    {c.plain_summary}
                  </p>
                )}
              </Link>
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
