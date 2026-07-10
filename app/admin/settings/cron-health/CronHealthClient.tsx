'use client';

import { useEffect, useState } from 'react';

interface CronJob {
  job_name: string;
  schedule: string;
  expected_interval_seconds: number;
  last_run_at: string | null;
  last_finished_at: string | null;
  last_status: string;
  last_notes: string | null;
  seconds_since_run: number | null;
  healthy: boolean;
  reason: string;
}

interface CronHealth {
  now: string;
  jobs: CronJob[];
  orphan_runs: unknown[];
  summary: {
    total: number;
    healthy: number;
    never_run: number;
    overdue: number;
    failed: number;
  };
}

function statusColor(reason: string): string {
  switch (reason) {
    case 'ok': return '#00FF9D';
    case 'last_status_failed': return '#FF6B81';
    case 'overdue': return '#FFB020';
    case 'never_run': return 'var(--grey-500)';
    default: return 'var(--grey-500)';
  }
}

function statusLabel(reason: string): string {
  switch (reason) {
    case 'ok': return 'Healthy';
    case 'last_status_failed': return 'Failed';
    case 'overdue': return 'Overdue';
    case 'never_run': return 'Never Run';
    default: return reason;
  }
}

function fmtDuration(seconds: number | null): string {
  if (seconds === null) return '-';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function CronHealthClient() {
  const [data, setData] = useState<CronHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'healthy' | 'unhealthy' | 'never_run'>('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/health/crons', { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed To Load');
        if (!cancelled) setData(json);
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = data?.jobs.filter((j) => {
    if (filter === 'healthy') return j.healthy;
    if (filter === 'unhealthy') return !j.healthy;
    if (filter === 'never_run') return j.reason === 'never_run';
    return true;
  }) ?? [];

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: 1100, margin: '0 auto', animation: 'fadeIn 0.3s ease-out' }}>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 className="animated-gradient-text" style={{ fontSize: '1.8rem', margin: '0 0 4px' }}>
          Cron Health Monitor
        </h1>
        <p style={{ color: 'var(--grey-400)', fontSize: '0.88rem', margin: 0 }}>
          Live status of all instrumented background jobs
        </p>
      </div>

      {loading && (
        <div style={{ color: 'var(--silver)', padding: 'var(--space-6)' }}>Loading Cron Health Data...</div>
      )}

      {error && (
        <div style={{ color: '#FF6B81', padding: 'var(--space-4)', background: 'rgba(255,107,129,0.08)', borderRadius: 10 }}>
          Error: {error}
        </div>
      )}

      {data && (
        <>
          {/* Summary strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
            {[
              { label: 'Total Jobs', value: data.summary.total, color: 'var(--white)' },
              { label: 'Healthy', value: data.summary.healthy, color: '#00FF9D' },
              { label: 'Never Run', value: data.summary.never_run, color: 'var(--grey-500)' },
              { label: 'Overdue', value: data.summary.overdue, color: '#FFB020' },
              { label: 'Failed', value: data.summary.failed, color: '#FF6B81' },
            ].map((s) => (
              <div key={s.label} className="glass-panel" style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: s.color, fontFamily: 'var(--font-brand)' }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Filter bar */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
            {(['all', 'healthy', 'unhealthy', 'never_run'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: filter === f ? 'var(--teal)' : 'rgba(255,255,255,0.04)',
                  color: filter === f ? '#04201f' : 'var(--silver)',
                }}
              >
                {f === 'all' ? 'All' : f === 'healthy' ? 'Healthy' : f === 'unhealthy' ? 'Unhealthy' : 'Never Run'}
              </button>
            ))}
          </div>

          {/* Jobs table */}
          <div className="glass-panel">
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem', minWidth: 700 }}>
                <thead>
                  <tr>
                    {['Status', 'Job Name', 'Schedule', 'Last Run', 'Duration', 'Last Status', 'Notes'].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: h === 'Status' || h === 'Duration' ? 'center' : 'left',
                          color: 'var(--grey-400)',
                          fontWeight: 700,
                          padding: '12px 14px',
                          borderBottom: '1px solid rgba(255,255,255,0.08)',
                          fontSize: '0.71rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((job) => {
                    const dotColor = statusColor(job.reason);
                    const duration = job.last_run_at && job.last_finished_at
                      ? Math.floor((new Date(job.last_finished_at).getTime() - new Date(job.last_run_at).getTime()) / 1000)
                      : null;

                    return (
                      <tr
                        key={job.job_name}
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                      >
                        <td style={{ textAlign: 'center', padding: '10px 14px' }}>
                          <span
                            title={statusLabel(job.reason)}
                            style={{
                              display: 'inline-block',
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              background: dotColor,
                              boxShadow: `0 0 6px ${dotColor}`,
                            }}
                          />
                        </td>
                        <td style={{ padding: '10px 14px', color: 'var(--white)', fontWeight: 600, fontFamily: 'monospace', fontSize: '0.8rem' }}>
                          {job.job_name}
                        </td>
                        <td style={{ padding: '10px 14px', color: 'var(--grey-400)', fontFamily: 'monospace', fontSize: '0.77rem' }}>
                          {job.schedule}
                        </td>
                        <td style={{ padding: '10px 14px', color: 'var(--silver)', whiteSpace: 'nowrap' }}>
                          {fmtDate(job.last_run_at)}
                        </td>
                        <td style={{ textAlign: 'center', padding: '10px 14px', color: 'var(--grey-400)', whiteSpace: 'nowrap' }}>
                          {fmtDuration(duration)}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '3px 9px',
                              borderRadius: 6,
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              background: `${dotColor}20`,
                              color: dotColor,
                              border: `1px solid ${dotColor}40`,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {statusLabel(job.reason)}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', color: 'var(--grey-400)', fontSize: '0.78rem', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {job.last_notes || '-'}
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--grey-400)' }}>
                        No Jobs Match This Filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ marginTop: 'var(--space-3)', fontSize: '0.75rem', color: 'var(--grey-500)' }}>
            Last Checked: {fmtDate(data.now)}
          </div>
        </>
      )}
    </div>
  );
}
