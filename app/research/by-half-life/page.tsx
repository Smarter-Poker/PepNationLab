/**
 * Browse compounds by half-life bucket. Server component.
 * Uses COALESCE(measured_half_life_hours, predicted_half_life_hours).
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { evidenceTier, wadaLabel } from '@/lib/compounds';

export const metadata: Metadata = {
  title: 'Browse By Half-Life | Research Library | Pep Nation Lab',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

interface HalfLifeRow {
  slug: string;
  display_name: string;
  evidence_tier: string;
  wada_status: string;
  plain_summary: string | null;
  measured_half_life_hours: number | null;
  predicted_half_life_hours: number | null;
}

const BUCKETS: Array<{ key: string; label: string; range: string; test: (h: number) => boolean }> = [
  { key: 'acute', label: 'Acute (Under 2 Hours)', range: 'Less Than 2h', test: (h) => h < 2 },
  { key: 'short', label: 'Short (2 To 12 Hours)', range: '2 To 12h', test: (h) => h >= 2 && h < 12 },
  { key: 'medium', label: 'Medium (12 To 72 Hours)', range: '12 To 72h', test: (h) => h >= 12 && h < 72 },
  { key: 'long', label: 'Long (72 Hours To 2 Weeks)', range: '72 To 336h', test: (h) => h >= 72 && h < 336 },
  { key: 'depot', label: 'Depot (Over 2 Weeks)', range: 'Over 336h', test: (h) => h >= 336 },
];

export default async function ResearchByHalfLifePage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('compounds')
    .select('slug, display_name, evidence_tier, wada_status, plain_summary, measured_half_life_hours, predicted_half_life_hours')
    .order('display_name', { ascending: true });

  const rows = (data ?? []) as HalfLifeRow[];

  const groups = BUCKETS.map((b) => ({ ...b, compounds: [] as HalfLifeRow[] }));
  const unknown: HalfLifeRow[] = [];
  for (const r of rows) {
    const hl = r.measured_half_life_hours ?? r.predicted_half_life_hours;
    if (hl === null || hl === undefined || !isFinite(hl)) {
      unknown.push(r);
      continue;
    }
    const target = groups.find((g) => g.test(hl));
    if (target) target.compounds.push(r);
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
          Browse By Half-Life
        </h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.05rem', marginTop: 'var(--space-2, 8px)', maxWidth: '760px' }}>
          Compounds Grouped By Their Measured Or Predicted Plasma Half-Life.
        </p>
      </header>

      {groups.map((g) => (
        <section key={g.key} style={{ marginBottom: 'var(--space-6, 32px)' }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--teal, #00C4BC)', marginBottom: 'var(--space-2, 8px)' }}>
            {g.label}
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--silver, #A8B4C0)', marginBottom: 'var(--space-3, 12px)' }}>
            {g.range} - {g.compounds.length} Compounds
          </p>
          {g.compounds.length === 0 ? (
            <div className="card-glass" style={{ padding: 'var(--space-4, 16px)', borderRadius: 'var(--radius-lg, 12px)', color: 'var(--silver, #A8B4C0)', fontSize: '0.9rem' }}>
              No Compounds In This Bucket Yet.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'var(--space-3, 12px)' }}>
              {g.compounds.map((c) => {
                const t = evidenceTier(c.evidence_tier);
                const hl = c.measured_half_life_hours ?? c.predicted_half_life_hours;
                return (
                  <Link
                    key={c.slug}
                    href={`/research/${c.slug}`}
                    className="card-metal"
                    style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1, 4px)', padding: 'var(--space-3, 12px) var(--space-4, 16px)', borderRadius: 'var(--radius-lg, 12px)', textDecoration: 'none', color: 'var(--white, #FFFFFF)' }}
                  >
                    <span style={{ fontSize: '0.7rem', color: t.color, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>{t.label}</span>
                    <span style={{ fontSize: '1rem', fontWeight: 700 }}>{c.display_name}</span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--teal, #00C4BC)' }}>Half-Life: {hl?.toFixed(1)} h</span>
                    {c.wada_status && c.wada_status !== 'not_listed' && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--silver, #A8B4C0)' }}>{wadaLabel(c.wada_status)}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      ))}

      {unknown.length > 0 && (
        <section style={{ marginBottom: 'var(--space-6, 32px)' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--silver, #A8B4C0)', marginBottom: 'var(--space-3, 12px)' }}>
            Awaiting Half-Life Data ({unknown.length})
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2, 8px)' }}>
            {unknown.map((c) => (
              <Link key={c.slug} href={`/research/${c.slug}`} className="card-metal" style={{ padding: '6px 12px', borderRadius: 'var(--radius-md, 8px)', textDecoration: 'none', color: 'var(--white, #FFFFFF)', fontSize: '0.85rem' }}>
                {c.display_name}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
