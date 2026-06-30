/**
 * Search analytics dashboard. Admin-only via middleware role gate.
 * Surfaces top searches, no-result queries, CTR, latency from search_queries.
 */

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';

export const metadata: Metadata = {
  title: 'Search Analytics | Admin | Pep Nation Lab',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

export default async function AdminSearchAnalyticsPage() {
  const gate = await requireAdmin();
  if (!gate.ok) redirect('/login');

  const supabase = await createServiceClient();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: topQueries } = await supabase
    .from('search_queries')
    .select('query_normalized, latency_ms, no_result, clicked_position')
    .gte('created_at', since)
    .limit(5000);

  const rows = (topQueries ?? []) as Array<{ query_normalized: string; latency_ms: number | null; no_result: boolean; clicked_position: number | null }>;

  const groups = new Map<string, { count: number; noResult: number; clicks: number; latency: number[] }>();
  for (const r of rows) {
    const k = r.query_normalized || '(empty)';
    if (!groups.has(k)) groups.set(k, { count: 0, noResult: 0, clicks: 0, latency: [] });
    const g = groups.get(k)!;
    g.count += 1;
    if (r.no_result) g.noResult += 1;
    if (r.clicked_position && r.clicked_position > 0) g.clicks += 1;
    if (Number.isFinite(r.latency_ms ?? NaN)) g.latency.push(r.latency_ms as number);
  }

  const ranked = Array.from(groups.entries())
    .map(([q, g]) => ({ q, ...g, ctr: g.count > 0 ? g.clicks / g.count : 0 }))
    .sort((a, b) => b.count - a.count);

  const noResultRanked = ranked.filter((r) => r.noResult > 0).sort((a, b) => b.noResult - a.noResult);
  const ctrRanked = ranked.filter((r) => r.count >= 3).sort((a, b) => b.ctr - a.ctr);

  const allLatency = rows.map((r) => r.latency_ms).filter((n): n is number => Number.isFinite(n ?? NaN));
  allLatency.sort((a, b) => a - b);
  const pct = (p: number) => allLatency.length === 0 ? 0 : allLatency[Math.min(allLatency.length - 1, Math.floor((p / 100) * allLatency.length))];

  const headerStyle: React.CSSProperties = { fontSize: '1.1rem', fontWeight: 800, color: 'var(--white, #FFFFFF)', margin: 0, marginBottom: 'var(--space-3, 12px)' };
  const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' };
  const cellStyle: React.CSSProperties = { padding: '6px 12px', color: 'var(--silver-light, #D0DAE4)' };
  const thStyle: React.CSSProperties = { ...cellStyle, textAlign: 'left', color: 'var(--silver, #A8B4C0)', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em' };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: 'var(--space-6, 32px) var(--space-4, 16px)' }}>
      <header style={{ marginBottom: 'var(--space-5, 24px)' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--white, #FFFFFF)', margin: 0 }}>Search Analytics</h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1rem', marginTop: 'var(--space-2, 8px)' }}>Last 7 Days. {rows.length} Total Queries Across {groups.size} Unique Phrasings.</p>
      </header>

      <section className="glass-panel" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)', marginBottom: 'var(--space-5, 24px)' }}>
        <h2 style={headerStyle}>Latency Distribution</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-3, 12px)' }}>
          {([['P50', 50], ['P75', 75], ['P95', 95], ['P99', 99]] as const).map(([label, p]) => (
            <div key={label} className="glass-panel" style={{ padding: 'var(--space-3, 12px) var(--space-4, 16px)', borderRadius: 'var(--radius-md, 8px)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--silver, #A8B4C0)', fontWeight: 700, letterSpacing: '0.05em' }}>{label}</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--teal, #00C4BC)', marginTop: '4px' }}>{pct(p)}<span style={{ fontSize: '0.8rem', color: 'var(--silver, #A8B4C0)' }}> ms</span></div>
            </div>
          ))}
        </div>
      </section>

      <section className="glass-panel" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)', marginBottom: 'var(--space-5, 24px)' }}>
        <h2 style={headerStyle}>Top Searches</h2>
        {ranked.length === 0 ? (
          <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.9rem' }}>No Queries Logged Yet. The Search Engine Will Populate This Table As Users Visit /research/search.</p>
        ) : (
          <table style={tableStyle}>
            <thead><tr><th style={thStyle}>Query</th><th style={thStyle}>Count</th><th style={thStyle}>CTR</th></tr></thead>
            <tbody>
              {ranked.slice(0, 20).map((r) => (
                <tr key={r.q}><td style={cellStyle}>{r.q}</td><td style={cellStyle}>{r.count}</td><td style={cellStyle}>{(r.ctr * 100).toFixed(1)}%</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="glass-panel" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)', marginBottom: 'var(--space-5, 24px)', borderLeft: '3px solid var(--red-600, #E53E3E)' }}>
        <h2 style={headerStyle}>No-Result Queries (Content Gaps)</h2>
        {noResultRanked.length === 0 ? (
          <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.9rem' }}>No No-Result Queries Logged. The Catalog Coverage Is Holding.</p>
        ) : (
          <table style={tableStyle}>
            <thead><tr><th style={thStyle}>Query</th><th style={thStyle}>No-Result Hits</th></tr></thead>
            <tbody>
              {noResultRanked.slice(0, 10).map((r) => (
                <tr key={r.q}><td style={cellStyle}>{r.q}</td><td style={cellStyle}>{r.noResult}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="glass-panel" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)' }}>
        <h2 style={headerStyle}>Highest CTR Queries</h2>
        {ctrRanked.length === 0 ? (
          <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.9rem' }}>Need At Least Three Queries Per Phrase Before A CTR Is Computed.</p>
        ) : (
          <table style={tableStyle}>
            <thead><tr><th style={thStyle}>Query</th><th style={thStyle}>Count</th><th style={thStyle}>Clicks</th><th style={thStyle}>CTR</th></tr></thead>
            <tbody>
              {ctrRanked.slice(0, 10).map((r) => (
                <tr key={r.q}><td style={cellStyle}>{r.q}</td><td style={cellStyle}>{r.count}</td><td style={cellStyle}>{r.clicks}</td><td style={cellStyle}>{(r.ctr * 100).toFixed(1)}%</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
