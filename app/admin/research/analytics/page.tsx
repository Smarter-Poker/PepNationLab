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
  robots: { index: false, follow: true },
};
export const dynamic = 'force-dynamic';

export default async function AdminSearchAnalyticsPage() {
  const gate = await requireAdmin();
  if (!gate.ok) redirect('/login');

  const supabase = await createServiceClient();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: topQueries } = await supabase
    .from('search_queries')
    .select('query_normalized, latency_ms, no_result, clicked_position')
    .gte('created_at', since)
    .limit(5000);

  // Previously write-only telemetry, now surfaced here (30-day windows).
  const [missedRes, faqRes, matchRes, vitalsRes] = await Promise.all([
    supabase.from('missed_searches').select('query').gte('created_at', since30).limit(5000),
    supabase.from('faq_clicks').select('faq_id, user_role').gte('created_at', since30).limit(5000),
    supabase.from('research_match_analytics').select('goal, result_count').gte('created_at', since30).limit(5000),
    supabase.from('web_vitals').select('metric, value, rating').gte('created_at', since30).limit(20000),
  ]);

  // Missed searches: content gaps on the storefront (zero-result queries).
  const missedCounts = new Map<string, number>();
  for (const r of (missedRes.data ?? []) as Array<{ query: string }>) {
    const k = (r.query || '').trim().toLowerCase() || '(empty)';
    missedCounts.set(k, (missedCounts.get(k) ?? 0) + 1);
  }
  const missedRanked = Array.from(missedCounts.entries()).map(([q, n]) => ({ q, n })).sort((a, b) => b.n - a.n);

  // FAQ clicks: which help answers get used, and by which role.
  const faqCounts = new Map<string, number>();
  for (const r of (faqRes.data ?? []) as Array<{ faq_id: string; user_role: string | null }>) {
    const k = r.faq_id || '(unknown)';
    faqCounts.set(k, (faqCounts.get(k) ?? 0) + 1);
  }
  const faqRanked = Array.from(faqCounts.entries()).map(([id, n]) => ({ id, n })).sort((a, b) => b.n - a.n);
  const faqTotal = (faqRes.data ?? []).length;

  // Research match engine: usage and top goals.
  const matchRows = (matchRes.data ?? []) as Array<{ goal: string | null; result_count: number | null }>;
  const goalCounts = new Map<string, number>();
  for (const r of matchRows) {
    const k = (r.goal || '(none)').trim().toLowerCase();
    goalCounts.set(k, (goalCounts.get(k) ?? 0) + 1);
  }
  const goalRanked = Array.from(goalCounts.entries()).map(([g, n]) => ({ g, n })).sort((a, b) => b.n - a.n);
  const matchTotal = matchRows.length;

  // Web vitals: p75 per metric + good/needs-improvement/poor rating split.
  const vitalRows = (vitalsRes.data ?? []) as Array<{ metric: string; value: number | null; rating: string | null }>;
  const byMetric = new Map<string, { values: number[]; good: number; ni: number; poor: number }>();
  for (const r of vitalRows) {
    if (!byMetric.has(r.metric)) byMetric.set(r.metric, { values: [], good: 0, ni: 0, poor: 0 });
    const m = byMetric.get(r.metric)!;
    if (Number.isFinite(r.value ?? NaN)) m.values.push(r.value as number);
    if (r.rating === 'good') m.good += 1;
    else if (r.rating === 'poor') m.poor += 1;
    else if (r.rating) m.ni += 1;
  }
  const vitalStats = Array.from(byMetric.entries()).map(([metric, m]) => {
    const sorted = [...m.values].sort((a, b) => a - b);
    const p75 = sorted.length === 0 ? 0 : sorted[Math.min(sorted.length - 1, Math.floor(0.75 * sorted.length))];
    const total = m.good + m.ni + m.poor;
    return { metric, p75, good: m.good, ni: m.ni, poor: m.poor, goodPct: total > 0 ? (m.good / total) * 100 : 0, n: total };
  }).sort((a, b) => a.metric.localeCompare(b.metric));

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
        <h1 className="animated-gradient-text" style={{ fontSize: '2rem', margin: 0 }}>Search Analytics</h1>
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

      <div style={{ marginTop: 'var(--space-6, 32px)', marginBottom: 'var(--space-4, 16px)' }}>
        <h2 className="animated-gradient-text" style={{ fontSize: '1.5rem', margin: 0 }}>Telemetry (Last 30 Days)</h2>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.9rem', marginTop: 'var(--space-2, 8px)' }}>First-Party Signals Previously Collected But Not Surfaced.</p>
      </div>

      <section className="glass-panel" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)', marginBottom: 'var(--space-5, 24px)' }}>
        <h2 style={headerStyle}>Core Web Vitals (P75)</h2>
        {vitalStats.length === 0 ? (
          <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.9rem' }}>No Web Vitals Reported Yet.</p>
        ) : (
          <table style={tableStyle}>
            <thead><tr><th style={thStyle}>Metric</th><th style={thStyle}>P75</th><th style={thStyle}>Good %</th><th style={thStyle}>Samples</th></tr></thead>
            <tbody>
              {vitalStats.map((v) => (
                <tr key={v.metric}>
                  <td style={cellStyle}>{v.metric}</td>
                  <td style={cellStyle}>{v.metric === 'CLS' ? v.p75.toFixed(3) : `${Math.round(v.p75)} ms`}</td>
                  <td style={{ ...cellStyle, color: v.goodPct >= 75 ? 'var(--teal, #00C4BC)' : 'var(--silver-light, #D0DAE4)' }}>{v.goodPct.toFixed(0)}%</td>
                  <td style={cellStyle}>{v.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="glass-panel" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)', marginBottom: 'var(--space-5, 24px)', borderLeft: '3px solid var(--red-600, #E53E3E)' }}>
        <h2 style={headerStyle}>Missed Storefront Searches (Content Gaps)</h2>
        {missedRanked.length === 0 ? (
          <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.9rem' }}>No Zero-Result Storefront Searches Logged.</p>
        ) : (
          <table style={tableStyle}>
            <thead><tr><th style={thStyle}>Query</th><th style={thStyle}>Hits</th></tr></thead>
            <tbody>
              {missedRanked.slice(0, 15).map((r) => (
                <tr key={r.q}><td style={cellStyle}>{r.q}</td><td style={cellStyle}>{r.n}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="glass-panel" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)', marginBottom: 'var(--space-5, 24px)' }}>
        <h2 style={headerStyle}>Help Article Clicks ({faqTotal} Total)</h2>
        {faqRanked.length === 0 ? (
          <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.9rem' }}>No Help Article Clicks Logged.</p>
        ) : (
          <table style={tableStyle}>
            <thead><tr><th style={thStyle}>Article</th><th style={thStyle}>Clicks</th></tr></thead>
            <tbody>
              {faqRanked.slice(0, 12).map((r) => (
                <tr key={r.id}><td style={cellStyle}>{r.id}</td><td style={cellStyle}>{r.n}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="glass-panel" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)' }}>
        <h2 style={headerStyle}>Research Match Engine ({matchTotal} Runs)</h2>
        {goalRanked.length === 0 ? (
          <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.9rem' }}>No Match Engine Runs Logged.</p>
        ) : (
          <table style={tableStyle}>
            <thead><tr><th style={thStyle}>Goal</th><th style={thStyle}>Runs</th></tr></thead>
            <tbody>
              {goalRanked.slice(0, 12).map((r) => (
                <tr key={r.g}><td style={cellStyle}>{r.g}</td><td style={cellStyle}>{r.n}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
