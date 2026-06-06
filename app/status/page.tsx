import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'System Status | Pep Nation Lab',
  robots: { index: false, follow: false },
};

interface StatusReport {
  status: 'ok' | 'degraded' | 'down';
  service: string;
  ts: string;
  checks: {
    db: { ok: boolean; latency_ms?: number; error?: string };
    cron: { ok: boolean; lag_minutes?: number; last_run_at?: string; error?: string };
  };
}

async function fetchStatus(): Promise<StatusReport | null> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://pepnationlab.com'}/api/status`, {
      cache: 'no-store',
    });
    return (await res.json()) as StatusReport;
  } catch {
    return null;
  }
}

function statusColor(s: string | undefined): string {
  if (s === 'ok') return '#48BB78';
  if (s === 'degraded') return '#00E5FF';
  return '#E53E3E';
}

function statusLabel(s: string | undefined): string {
  if (s === 'ok') return 'All Systems Operational';
  if (s === 'degraded') return 'Partially Degraded';
  return 'Major Outage';
}

export default async function StatusPage() {
  const report = await fetchStatus();
  const overall = report?.status;

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--black)', padding: 'var(--space-6) var(--space-4)' }}>
      <div className="container" style={{ maxWidth: 720 }}>
        <h1 className="animated-gradient-text" style={{ color: 'var(--white)', fontSize: '1.8rem', fontFamily: 'var(--font-brand)', marginBottom: 'var(--space-4)' }}>
          Pep Nation Lab Status
        </h1>

        <div
          className="glass-panel hover-lift stagger-fade-in"
          style={{
            padding: 'var(--space-5)',
            borderLeft: `4px solid ${statusColor(overall)}`,
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-5)',
            animationDelay: '0.1s'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: statusColor(overall),
                boxShadow: `0 0 12px ${statusColor(overall)}`,
              }}
            />
            <span style={{ color: 'var(--white)', fontSize: '1.1rem', fontWeight: 700 }}>
              {statusLabel(overall)}
            </span>
          </div>
          <div style={{ color: 'var(--silver)', fontSize: '0.85rem', marginTop: 'var(--space-2)' }}>
            Last Checked: {report?.ts ? new Date(report.ts).toLocaleString() : 'Unknown'}
          </div>
        </div>

        <h2 style={{ color: 'var(--white)', fontSize: '1.05rem', marginBottom: 'var(--space-3)' }}>Component Status</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <ComponentRow
            label="Database (Supabase Postgres)"
            ok={report?.checks?.db?.ok ?? false}
            detail={
              report?.checks?.db?.ok
                ? `Healthy - ${report?.checks?.db?.latency_ms ?? '?'} ms`
                : `Error - ${report?.checks?.db?.error ?? 'unreachable'}`
            }
          />
          <ComponentRow
            label="Scheduled Jobs (Crons)"
            ok={report?.checks?.cron?.ok ?? false}
            detail={
              report?.checks?.cron?.ok
                ? `Last Run ${report?.checks?.cron?.lag_minutes ?? '?'} Minutes Ago`
                : `Lag - ${report?.checks?.cron?.error ?? 'no runs recorded'}`
            }
          />
        </div>

        <p style={{ color: 'var(--silver)', fontSize: '0.8rem', marginTop: 'var(--space-6)' }}>
          This Page Auto-Refreshes On Each Visit. No Subscription Or Login Required.
        </p>
      </div>
    </div>
  );
}

function ComponentRow({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div
      className="glass-panel"
      style={{
        padding: 'var(--space-4)',
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div>
        <div style={{ color: 'var(--white)', fontWeight: 600 }}>{label}</div>
        <div style={{ color: 'var(--silver)', fontSize: '0.82rem', marginTop: 2 }}>{detail}</div>
      </div>
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: ok ? '#48BB78' : '#E53E3E',
          boxShadow: ok ? '0 0 8px #48BB78' : '0 0 8px #E53E3E',
        }}
      />
    </div>
  );
}
