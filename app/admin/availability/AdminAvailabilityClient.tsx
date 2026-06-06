'use client';

import React from 'react';

interface FailedRow {
  id: number;
  occurred_at: string;
  field: string;
  value: string;
  normalized: string;
  reason: string;
  reason_code: string;
  ip: string | null;
}

interface Spike {
  ip: string;
  count: number;
  reasons: string[];
  first_at: string;
  last_at: string;
}

interface Burst {
  ip: string;
  count: number;
}

interface ApiResponse {
  recent: FailedRow[];
  spikes: Spike[];
  bursts: Burst[];
  totals_by_reason_24h: Record<string, number>;
}

export default function AdminAvailabilityClient() {
  const [data, setData] = React.useState<ApiResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch('/api/admin/availability', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed To Load');
      setData(await res.json());
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Failed To Load');
    }
  }

  React.useEffect(() => {
    load();
    const handle = setInterval(load, 30_000);
    return () => clearInterval(handle);
  }, []);

  const totalRejects24h = data
    ? Object.values(data.totals_by_reason_24h).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <div style={{ padding: 'var(--space-6)' }}>
      <h1 style={{ fontSize: '1.6rem', marginBottom: 'var(--space-2)' }}>Availability Audit</h1>
      <p style={{ color: 'var(--grey-400)', fontSize: '0.9rem', marginBottom: 'var(--space-6)' }}>
        Failed Slug / Username / Display Name Checks. Useful For Spotting Enumeration Sweeps And Competitive Squatting.
      </p>

      {error && (
        <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red)', borderRadius: 8, padding: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <p style={{ color: 'var(--red)', margin: 0 }}>{error}</p>
        </div>
      )}

      {data && data.bursts.length > 0 && (
        <div style={{
          background: 'rgba(229,62,62,0.12)',
          border: '1px solid #FC8181',
          borderRadius: 8,
          padding: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
        }}>
          <h3 style={{ color: '#FC8181', margin: 0, marginBottom: 8 }}>Active Burst Alert</h3>
          <p style={{ color: 'var(--silver)', fontSize: '0.85rem', margin: 0, marginBottom: 8 }}>
            One Or More IPs Have ≥50 Rejected Availability Checks In The Last 10 Minutes. Consider Blocking At The Edge.
          </p>
          <table style={{ width: '100%', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--grey-400)' }}>
                <th style={{ padding: '4px 8px' }}>IP</th>
                <th style={{ padding: '4px 8px' }}>Rejects In 10 Min</th>
              </tr>
            </thead>
            <tbody>
              {data.bursts.map((b) => (
                <tr key={b.ip} style={{ color: 'var(--white)' }}>
                  <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>{b.ip}</td>
                  <td style={{ padding: '4px 8px' }}>{b.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
          <KpiTile label="Total Rejects (24h)" value={String(totalRejects24h)} />
          <KpiTile label="Suspicious IPs (1h)" value={String(data.spikes.length)} />
          <KpiTile label="Active Bursts (10m)" value={String(data.bursts.length)} tone={data.bursts.length > 0 ? 'danger' : 'ok'} />
        </div>
      )}

      {data && Object.keys(data.totals_by_reason_24h).length > 0 && (
        <section style={{ marginBottom: 'var(--space-6)' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: 'var(--space-3)' }}>Totals By Reason (24h)</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {Object.entries(data.totals_by_reason_24h).map(([reason, count]) => (
              <div key={reason} style={{
                background: 'var(--surface-3)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 999,
                padding: '4px 12px',
                fontSize: '0.78rem',
                color: 'var(--silver)',
              }}>
                {reason}: <strong style={{ color: 'var(--white)' }}>{count}</strong>
              </div>
            ))}
          </div>
        </section>
      )}

      {data && data.spikes.length > 0 && (
        <section style={{ marginBottom: 'var(--space-6)' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: 'var(--space-3)' }}>Per-IP Burst Summary (1h)</h3>
          <div style={{ overflowX: 'auto', background: 'var(--surface-2)', borderRadius: 8, padding: 'var(--space-3)' }}>
            <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--grey-400)' }}>
                  <th style={{ padding: '6px 12px' }}>IP</th>
                  <th style={{ padding: '6px 12px' }}>Count</th>
                  <th style={{ padding: '6px 12px' }}>Reason Codes</th>
                  <th style={{ padding: '6px 12px' }}>First</th>
                  <th style={{ padding: '6px 12px' }}>Last</th>
                </tr>
              </thead>
              <tbody>
                {data.spikes.map((s) => (
                  <tr key={s.ip} style={{ }}>
                    <td style={{ padding: '6px 12px', fontFamily: 'monospace', color: 'var(--white)' }}>{s.ip}</td>
                    <td style={{ padding: '6px 12px', color: 'var(--silver)' }}>{s.count}</td>
                    <td style={{ padding: '6px 12px', color: 'var(--silver)' }}>{s.reasons.join(', ')}</td>
                    <td style={{ padding: '6px 12px', color: 'var(--grey-400)', fontSize: '0.75rem' }}>
                      {new Date(s.first_at).toLocaleString()}
                    </td>
                    <td style={{ padding: '6px 12px', color: 'var(--grey-400)', fontSize: '0.75rem' }}>
                      {new Date(s.last_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {data && data.recent.length > 0 && (
        <section>
          <h3 style={{ fontSize: '1rem', marginBottom: 'var(--space-3)' }}>Recent Failed Attempts</h3>
          <div style={{ overflowX: 'auto', background: 'var(--surface-2)', borderRadius: 8, padding: 'var(--space-3)' }}>
            <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--grey-400)' }}>
                  <th style={{ padding: '6px 12px' }}>When</th>
                  <th style={{ padding: '6px 12px' }}>Field</th>
                  <th style={{ padding: '6px 12px' }}>Value</th>
                  <th style={{ padding: '6px 12px' }}>Reason</th>
                  <th style={{ padding: '6px 12px' }}>IP</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((r) => (
                  <tr key={r.id} style={{ }}>
                    <td style={{ padding: '6px 12px', color: 'var(--grey-400)', whiteSpace: 'nowrap' }}>
                      {new Date(r.occurred_at).toLocaleString()}
                    </td>
                    <td style={{ padding: '6px 12px', color: 'var(--silver)' }}>{r.field}</td>
                    <td style={{ padding: '6px 12px', color: 'var(--white)', fontFamily: 'monospace', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.value}</td>
                    <td style={{ padding: '6px 12px', color: 'var(--silver)' }}>
                      <span style={{
                        background: r.reason_code === 'taken' ? 'rgba(252,129,129,0.15)' : 'rgba(255,209,117,0.15)',
                        border: `1px solid ${r.reason_code === 'taken' ? '#FC8181' : '#FFD175'}`,
                        borderRadius: 999,
                        padding: '2px 8px',
                        fontSize: '0.72rem',
                        color: r.reason_code === 'taken' ? '#FC8181' : '#FFD175',
                        marginRight: 6,
                      }}>{r.reason_code}</span>
                      {r.reason}
                    </td>
                    <td style={{ padding: '6px 12px', color: 'var(--silver)', fontFamily: 'monospace' }}>{r.ip || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!data && !error && (
        <p style={{ color: 'var(--grey-400)' }}>Loading…</p>
      )}
    </div>
  );
}

function KpiTile({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'danger' }) {
  const color = tone === 'danger' ? '#FC8181' : 'var(--white)';
  const border = tone === 'danger' ? '#FC8181' : 'rgba(255,255,255,0.08)';
  return (
    <div style={{
      background: 'var(--surface-2)',
      border: `1px solid ${border}`,
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-4)',
    }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--grey-400)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: '1.8rem', fontWeight: 700, color }}>{value}</div>
    </div>
  );
}
