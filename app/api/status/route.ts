import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface StatusReport {
  status: 'ok' | 'degraded' | 'down';
  service: string;
  ts: string;
  checks: {
    db: { ok: boolean; latency_ms?: number; error?: string };
    cron: { ok: boolean; lag_minutes?: number; last_run_at?: string; error?: string };
  };
}

export async function GET() {
  const report: StatusReport = {
    status: 'ok',
    service: 'pepnationlab',
    ts: new Date().toISOString(),
    checks: {
      db: { ok: false },
      cron: { ok: false },
    },
  };

  const dbStart = Date.now();
  try {
    const svc = await createServiceClient();
    const { error } = await svc.from('profiles').select('id', { count: 'exact', head: true }).limit(1);
    if (error) throw new Error(error.message);
    report.checks.db = { ok: true, latency_ms: Date.now() - dbStart };
  } catch (err) {
    report.checks.db = { ok: false, error: err instanceof Error ? err.message.slice(0, 200) : 'unknown' };
    report.status = 'down';
  }

  try {
    const svc = await createServiceClient();
    const { data, error } = await svc
      .from('cron_runs')
      .select('finished_at, started_at, status')
      .order('started_at', { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) {
      report.checks.cron = { ok: false, error: 'no_runs_recorded' };
      if (report.status === 'ok') report.status = 'degraded';
    } else {
      const last = data[0];
      const lastAt = new Date(last.finished_at ?? last.started_at);
      const ageMin = (Date.now() - lastAt.getTime()) / 60_000;
      const ok = ageMin < 90;
      report.checks.cron = {
        ok,
        lag_minutes: Math.round(ageMin),
        last_run_at: lastAt.toISOString(),
      };
      if (!ok && report.status === 'ok') report.status = 'degraded';
    }
  } catch (err) {
    report.checks.cron = { ok: false, error: err instanceof Error ? err.message.slice(0, 200) : 'unknown' };
    if (report.status === 'ok') report.status = 'degraded';
  }

  const httpStatus = report.status === 'down' ? 503 : 200;
  return NextResponse.json(report, { status: httpStatus });
}
