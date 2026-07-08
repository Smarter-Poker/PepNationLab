import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Database, Clock, CheckCircle2, AlertTriangle, Activity } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'System Status | Pep Nation Lab',
  robots: { index: false, follow: true },
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
  const color = statusColor(overall);

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--black)',
        padding: 'calc(var(--space-8) + env(safe-area-inset-top)) var(--space-4) calc(var(--space-10) + env(safe-area-inset-bottom))',
      }}
    >
      {/* Ambient glow tinted by the current status */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          background: `radial-gradient(ellipse at 50% 0%, ${color}1A 0%, transparent 55%)`,
          pointerEvents: 'none',
        }}
      />

      <div style={{ maxWidth: 720, margin: '0 auto', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
          <Activity size={18} aria-hidden="true" style={{ color: 'var(--teal)' }} />
          <span style={{ color: 'var(--silver)', fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Live Status
          </span>
        </div>
        <h1
          className="animated-gradient-text"
          style={{
            color: 'var(--white)',
            fontSize: 'clamp(1.5rem, 6vw, 2.1rem)',
            fontFamily: 'var(--font-brand)',
            fontWeight: 800,
            lineHeight: 1.15,
            marginBottom: 'var(--space-5)',
          }}
        >
          Pep Nation Lab Status
        </h1>

        {/* Overall status hero */}
        <div
          className="glass-panel stagger-fade-in"
          style={{
            padding: 'var(--space-6)',
            borderRadius: 'var(--radius-lg)',
            border: `1px solid ${color}55`,
            background: `linear-gradient(135deg, ${color}14 0%, transparent 70%)`,
            marginBottom: 'var(--space-6)',
            animationDelay: '0.05s',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <span
              aria-hidden="true"
              style={{
                position: 'relative',
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: color,
                boxShadow: `0 0 14px ${color}`,
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  inset: -6,
                  borderRadius: '50%',
                  border: `2px solid ${color}`,
                  opacity: 0.6,
                  animation: 'pnl-status-pulse 2s ease-out infinite',
                }}
              />
            </span>
            <span
              role="status"
              aria-live="polite"
              style={{ color: 'var(--white)', fontSize: 'clamp(1.05rem, 4.5vw, 1.35rem)', fontWeight: 700 }}
            >
              {statusLabel(overall)}
            </span>
          </div>
          <div style={{ color: 'var(--silver)', fontSize: '0.85rem', marginTop: 'var(--space-3)' }}>
            Last Checked: {report?.ts ? new Date(report.ts).toLocaleString() : 'Unknown'}
          </div>
        </div>

        <h2
          style={{
            color: 'var(--white)',
            fontSize: '0.78rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: 'var(--space-3)',
          }}
        >
          Component Status
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <ComponentRow
            icon={<Database size={18} aria-hidden="true" />}
            label="Database (Supabase Postgres)"
            ok={report?.checks?.db?.ok ?? false}
            detail={
              report?.checks?.db?.ok
                ? `Healthy - ${report?.checks?.db?.latency_ms ?? '?'} ms`
                : `Error - ${report?.checks?.db?.error ?? 'unreachable'}`
            }
          />
          <ComponentRow
            icon={<Clock size={18} aria-hidden="true" />}
            label="Scheduled Jobs (Crons)"
            ok={report?.checks?.cron?.ok ?? false}
            detail={
              report?.checks?.cron?.ok
                ? `Last Run ${report?.checks?.cron?.lag_minutes ?? '?'} Minutes Ago`
                : `Lag - ${report?.checks?.cron?.error ?? 'no runs recorded'}`
            }
          />
        </div>

        <p style={{ color: 'var(--grey-500)', fontSize: '0.8rem', marginTop: 'var(--space-8)', lineHeight: 1.6 }}>
          This Page Auto-Refreshes On Each Visit. No Subscription Or Login Required.
        </p>
      </div>

      <style>{`
        @keyframes pnl-status-pulse {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function ComponentRow({
  icon,
  label,
  ok,
  detail,
}: {
  icon: ReactNode;
  label: string;
  ok: boolean;
  detail: string;
}) {
  const tone = ok ? '#48BB78' : '#E53E3E';
  return (
    <div
      className="glass-panel hover-lift"
      style={{
        padding: 'var(--space-4)',
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        gap: 'var(--space-3)',
        alignItems: 'center',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0,
          width: 40,
          height: 40,
          borderRadius: 'var(--radius-md)',
          background: 'var(--surface-2)',
          border: 'var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--silver)',
        }}
      >
        {icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: 'var(--white)', fontWeight: 600, fontSize: '0.92rem' }}>{label}</div>
        <div style={{ color: 'var(--silver)', fontSize: '0.82rem', marginTop: 2 }}>{detail}</div>
      </div>
      <span
        style={{
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          borderRadius: 'var(--radius-full)',
          background: `${tone}1A`,
          border: `1px solid ${tone}55`,
          color: tone,
          fontSize: '0.74rem',
          fontWeight: 700,
        }}
      >
        {ok ? <CheckCircle2 size={13} aria-hidden="true" /> : <AlertTriangle size={13} aria-hidden="true" />}
        {ok ? 'Operational' : 'Issue'}
      </span>
    </div>
  );
}
