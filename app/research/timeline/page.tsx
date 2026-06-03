/**
 * Historical timeline of every compound by year of discovery / first human trial.
 * Server component. Compounds without a known year render in an "Era Unknown"
 * footer bucket so the catalog stays exhaustive without polluting the timeline.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllCompounds } from '@/lib/compounds-server';
import { evidenceTier } from '@/lib/compounds';

export const metadata: Metadata = {
  title: 'Timeline | Research Library | Pep Nation Lab',
  robots: { index: false, follow: false },
};

type Decade = '1960s' | '1970s' | '1980s' | '1990s' | '2000s' | '2010s' | '2020s' | 'Era Unknown';

function decadeOf(year?: number | null): Decade {
  if (!year || !Number.isFinite(year)) return 'Era Unknown';
  if (year >= 2020) return '2020s';
  if (year >= 2010) return '2010s';
  if (year >= 2000) return '2000s';
  if (year >= 1990) return '1990s';
  if (year >= 1980) return '1980s';
  if (year >= 1970) return '1970s';
  return '1960s';
}

const ORDER: Decade[] = ['1960s', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s', 'Era Unknown'];

export default async function ResearchTimelinePage() {
  const compounds = await getAllCompounds();

  const buckets = new Map<Decade, typeof compounds>();
  for (const d of ORDER) buckets.set(d, []);
  for (const c of compounds) {
    const year =
      (c as unknown as { year_discovered?: number | null }).year_discovered ??
      (c as unknown as { year_first_human_trial?: number | null }).year_first_human_trial ??
      null;
    buckets.get(decadeOf(year))!.push(c);
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
          Historical Timeline
        </h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.05rem', marginTop: 'var(--space-2, 8px)', maxWidth: '760px' }}>
          Every Compound Plotted By Year Of Discovery Or First Human Trial. Year-Stamp Data Will Densify As The Catalog Is Enriched.
        </p>
      </header>

      {ORDER.map((decade) => {
        const items = buckets.get(decade) ?? [];
        if (items.length === 0) return null;
        return (
          <section key={decade} style={{ marginBottom: 'var(--space-6, 32px)' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--teal, #00C4BC)', marginBottom: 'var(--space-3, 12px)' }}>{decade}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'var(--space-3, 12px)' }}>
              {items.map((c) => {
                const t = evidenceTier(c.evidence_tier);
                const yr =
                  (c as unknown as { year_discovered?: number | null }).year_discovered ??
                  (c as unknown as { year_first_human_trial?: number | null }).year_first_human_trial ??
                  null;
                return (
                  <Link
                    key={c.slug}
                    href={`/research/${c.slug}`}
                    className="card-metal"
                    style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1, 4px)', padding: 'var(--space-3, 12px) var(--space-4, 16px)', borderRadius: 'var(--radius-lg, 12px)', textDecoration: 'none', color: 'var(--white, #FFFFFF)' }}
                  >
                    <span style={{ fontSize: '0.7rem', color: t.color, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>{t.label}</span>
                    <span style={{ fontSize: '1rem', fontWeight: 700 }}>{c.display_name}</span>
                    {yr && <span style={{ fontSize: '0.75rem', color: 'var(--silver, #A8B4C0)' }}>Year {yr}</span>}
                    {c.category && <span style={{ fontSize: '0.72rem', color: 'var(--teal, #00C4BC)' }}>{c.category}</span>}
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
