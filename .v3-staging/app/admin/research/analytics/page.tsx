/**
 * /admin/research/analytics -- search analytics. Aggregates search_queries
 * rows from the last 7 days into four tables: top searches, no-result
 * queries (content gaps), highest-CTR queries, and latency distribution.
 *
 * Admin-only via middleware role check.
 */

import type { Metadata } from 'next';
import { createServiceClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Research Search Analytics | Admin | Pep Nation Lab',
  robots: { index: false, follow: false },
};

interface RawQueryRow {
  query: string | null;
  normalized: string | null;
  results_count: number | null;
  clicked_position: number | null;
  latency_ms: number | null;
  created_at: string | null;
}

type Aggregate = {
  topQueries: Array<{ q: string; count: number }>;
  noResult: Array<{ q: string; count: number }>;
  highCtr: Array<{ q: string; ctr: number; count: number }>;
  latency: { p50: number; p95: number; max: number; n: number };
};

function aggregate(rows: RawQueryRow[]): Aggregate {
  const byQuery: Record<string, { count: number; clicks: number; results: number }> = {};
  const latencies: number[] = [];
  for (const r of rows) {
    const q = (r.normalized || r.query || '').trim().toLowerCase();
    if (!q) continue;
    if (!byQuery[q]) byQuery[q] = { count: 0, clicks: 0, results: 0 };
    byQuery[q].count++;
    if ((r.clicked_position ?? 0) === 1) byQuery[q].clicks++;
    byQuery[q].results += r.results_count ?? 0;
    if (typeof r.latency_ms === 'number' && r.latency_ms >= 0) latencies.push(r.latency_ms);
  }
  const topQueries = Object.entries(byQuery)
    .map(([q, v]) => ({ q, count: v.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
  const noResult = Object.entries(byQuery)
    .filter(([, v]) => v.results === 0)
    .map(([q, v]) => ({ q, count: v.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  const highCtr = Object.entries(byQuery)
    .filter(([, v]) => v.count >= 3)
    .map(([q, v]) => ({ q, ctr: v.clicks / v.count, count: v.count }))
    .sort((a, b) => b.ctr - a.ctr)
    .slice(0, 10);

  latencies.sort((a, b) => a - b);
  const p = (q: number) => latencies.length === 0 ? 0 : latencies[Math.min(latencies.length - 1, Math.floor(q * latencies.length))];

  return {
    topQueries,
    noResult,
    highCtr,
    latency: {
      p50: p(0.5),
      p95: p(0.95),
      max: latencies.length ? latencies[latencies.length - 1] : 0,
      n: latencies.length,
    },
  };
}

const tableBox: React.CSSProperties = {
  borderRadius: 12,
  border: '1px solid rgba(168,180,192,0.18)',
  background: 'rgba(15,25,35,0.55)',
  padding: 16,
  marginBottom: 20,
  overflowX: 'auto',
};

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '6px 10px',
  fontSize: 11,
  color: '#A8B4C0',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  borderBottom: '1px solid rgba(168,180,192,0.2)',
};

const td: React.CSSProperties = {
  padding: '8px 10px',
  fontSize: 13,
  color: '#FFFFFF',
  borderBottom: '1px solid rgba(168,180,192,0.08)',
};

export default async function ResearchAnalyticsPage() {
  const supabase = createServiceClient();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('search_queries')
    .select('query, normalized, results_count, clicked_position, latency_ms, created_at')
    .gte('created_at', since)
    .limit(20000);

  const rows: RawQueryRow[] = (data ?? []) as RawQueryRow[];
  const agg = aggregate(rows);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 16px 64px' }}>
      <header style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#FFFFFF', margin: 0 }}>
          Research Search Analytics
        </h1>
        <p style={{ color: '#A8B4C0', marginTop: 8, fontSize: 14 }}>
          Last Seven Days. {rows.length.toLocaleString()} Search Events Counted.
        </p>
      </header>

      <section style={tableBox}>
        <h2 style={{ margin: 0, color: '#FFFFFF', fontSize: 16, fontWeight: 800 }}>Top Searches</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
          <thead>
            <tr><th style={th}>Query</th><th style={{ ...th, textAlign: 'right' }}>Count</th></tr>
          </thead>
          <tbody>
            {agg.topQueries.length === 0 ? (
              <tr><td style={td} colSpan={2}>No Search Events Yet.</td></tr>
            ) : agg.topQueries.map((r) => (
              <tr key={r.q}>
                <td style={td}>{r.q}</td>
                <td style={{ ...td, textAlign: 'right', color: '#00C4BC', fontWeight: 700 }}>{r.count.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={tableBox}>
        <h2 style={{ margin: 0, color: '#FFFFFF', fontSize: 16, fontWeight: 800 }}>
          No-Result Queries (Content Gaps)
        </h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
          <thead>
            <tr><th style={th}>Query</th><th style={{ ...th, textAlign: 'right' }}>Count</th></tr>
          </thead>
          <tbody>
            {agg.noResult.length === 0 ? (
              <tr><td style={td} colSpan={2}>No Content Gaps Detected.</td></tr>
            ) : agg.noResult.map((r) => (
              <tr key={r.q}>
                <td style={td}>{r.q}</td>
                <td style={{ ...td, textAlign: 'right', color: '#F6AD55', fontWeight: 700 }}>{r.count.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={tableBox}>
        <h2 style={{ margin: 0, color: '#FFFFFF', fontSize: 16, fontWeight: 800 }}>Highest CTR Queries</h2>
        <p style={{ color: '#A8B4C0', fontSize: 12, marginTop: 6 }}>
          Click-Through Rate To The Position-1 Result. Minimum Three Searches To Appear.
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
          <thead>
            <tr>
              <th style={th}>Query</th>
              <th style={{ ...th, textAlign: 'right' }}>CTR</th>
              <th style={{ ...th, textAlign: 'right' }}>Count</th>
            </tr>
          </thead>
          <tbody>
            {agg.highCtr.length === 0 ? (
              <tr><td style={td} colSpan={3}>Not Enough Data Yet.</td></tr>
            ) : agg.highCtr.map((r) => (
              <tr key={r.q}>
                <td style={td}>{r.q}</td>
                <td style={{ ...td, textAlign: 'right', color: '#68D391', fontWeight: 700 }}>{(r.ctr * 100).toFixed(1)}%</td>
                <td style={{ ...td, textAlign: 'right' }}>{r.count.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={tableBox}>
        <h2 style={{ margin: 0, color: '#FFFFFF', fontSize: 16, fontWeight: 800 }}>Latency Distribution</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
          <thead>
            <tr>
              <th style={th}>Metric</th>
              <th style={{ ...th, textAlign: 'right' }}>Milliseconds</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style={td}>Sample Size</td><td style={{ ...td, textAlign: 'right' }}>{agg.latency.n.toLocaleString()}</td></tr>
            <tr><td style={td}>P50 (Median)</td><td style={{ ...td, textAlign: 'right' }}>{agg.latency.p50}</td></tr>
            <tr><td style={td}>P95</td><td style={{ ...td, textAlign: 'right' }}>{agg.latency.p95}</td></tr>
            <tr><td style={td}>Max</td><td style={{ ...td, textAlign: 'right' }}>{agg.latency.max}</td></tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
