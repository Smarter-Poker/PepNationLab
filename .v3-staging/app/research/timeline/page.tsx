/**
 * /research/timeline -- horizontal discovery timeline. Buckets compounds by
 * decade using year_discovered or year_first_human_trial. Pure CSS, no chart
 * lib. Empty buckets render as soft placeholders.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllCompounds } from '@/lib/compounds-server';
import { evidenceTier } from '@/lib/compounds';
import GlobalSearchBar from '@/components/research/GlobalSearchBar';
import BrowseSurfaceNav from '@/components/research/BrowseSurfaceNav';

export const metadata: Metadata = {
  title: 'Discovery Timeline | Research Library | Pep Nation Lab',
  robots: { index: false, follow: false },
};

interface TimelineRow {
  slug: string;
  display_name: string;
  year: number;
  evidence_tier: string;
}

function decadeOf(year: number): string {
  const d = Math.floor(year / 10) * 10;
  return `${d}s`;
}

const DECADES = ['1970s', '1980s', '1990s', '2000s', '2010s', '2020s', '2030s'];

export default async function TimelinePage() {
  const all = await getAllCompounds();

  const rows: TimelineRow[] = [];
  for (const c of all) {
    const raw =
      // these optional fields may exist on enriched compound rows
      ((c as unknown as { year_discovered?: number | null; year_first_human_trial?: number | null }).year_discovered ??
        (c as unknown as { year_first_human_trial?: number | null }).year_first_human_trial) ??
      null;
    if (typeof raw === 'number' && raw >= 1970 && raw <= 2099) {
      rows.push({
        slug: c.slug,
        display_name: c.display_name,
        year: raw,
        evidence_tier: c.evidence_tier,
      });
    }
  }
  rows.sort((a, b) => a.year - b.year);

  const buckets: Record<string, TimelineRow[]> = {};
  for (const d of DECADES) buckets[d] = [];
  for (const r of rows) {
    const d = decadeOf(r.year);
    if (buckets[d]) buckets[d].push(r);
  }

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 16px 64px' }}>
      <nav style={{ marginBottom: 16 }}>
        <Link href="/research" style={{ color: '#00C4BC', fontSize: 13, textDecoration: 'none' }}>
          Back To Research Library
        </Link>
      </nav>
      <header style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: '#FFFFFF', margin: 0 }}>
          Discovery Timeline
        </h1>
        <p style={{ color: '#A8B4C0', fontSize: 16, marginTop: 8, maxWidth: 760 }}>
          Compounds Plotted By Year Of Discovery Or First Human Trial. As More Catalog Entries Are
          Enriched, This Timeline Will Fill In.
        </p>
      </header>

      <div style={{ marginBottom: 20 }}>
        <GlobalSearchBar compact />
      </div>

      {rows.length === 0 ? (
        <div className="card-glass" style={{ padding: 28, borderRadius: 14, color: '#A8B4C0', textAlign: 'center' }}>
          No Compounds Have Year Data Yet. The Enrichment Cron Will Populate This Surface.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', padding: '14px 0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${DECADES.length}, minmax(220px, 1fr))`, gap: 14 }}>
            {DECADES.map((d) => (
              <div
                key={d}
                style={{
                  border: '1px solid rgba(168,180,192,0.2)',
                  background: 'rgba(15,25,35,0.5)',
                  borderRadius: 12,
                  padding: 14,
                  minHeight: 200,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div style={{ fontSize: 14, color: '#00C4BC', fontWeight: 800, marginBottom: 10 }}>{d}</div>
                {buckets[d].length === 0 ? (
                  <div style={{ color: '#404B57', fontSize: 12 }}>No Entries Yet.</div>
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
                    {buckets[d].map((r) => {
                      const t = evidenceTier(r.evidence_tier);
                      return (
                        <li key={r.slug}>
                          <Link
                            href={`/research/${r.slug}`}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 2,
                              padding: '6px 8px',
                              borderRadius: 8,
                              background: 'rgba(0,196,188,0.06)',
                              border: '1px solid rgba(0,196,188,0.18)',
                              textDecoration: 'none',
                              color: '#FFFFFF',
                            }}
                          >
                            <span style={{ fontSize: 11, color: '#A8B4C0' }}>{r.year}</span>
                            <span style={{ fontSize: 13, fontWeight: 700 }}>{r.display_name}</span>
                            <span style={{ fontSize: 10, color: t.color }}>{t.label}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <BrowseSurfaceNav />
      </div>
    </div>
  );
}
