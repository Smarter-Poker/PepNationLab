import { NextResponse } from 'next/server';
import { safeError } from '@/lib/api-error';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/health/crons
 *
 * Admin-only diagnostic that returns one row per known cron job with the
 * most recent execution from public.cron_runs. Surfaces silent failures
 * where the schedule is configured but the route never runs (404), the
 * job throws inside its handler, or the cron has not fired within the
 * expected interval.
 *
 * Response shape:
 *   {
 *     now: ISO,
 *     jobs: Array<{
 *       job_name, schedule, expected_interval_seconds,
 *       last_run_at, last_finished_at, last_status, last_notes,
 *       seconds_since_run, healthy
 *     }>,
 *     orphan_runs: cron_runs rows whose job_name is not in the known list
 *   }
 *
 * "healthy" means: a row exists for the job AND seconds_since_run is
 * within 1.5 × expected_interval_seconds AND last_status != 'failed'.
 */

// Known cron jobs and their nominal cadence. Update when vercel.json changes.
const KNOWN_CRONS: Array<{ job_name: string; schedule: string; expected_interval_seconds: number }> = [
  { job_name: 'reminders', schedule: '0 12 * * *', expected_interval_seconds: 24 * 3600 },
  { job_name: 'invoices', schedule: '59 23 * * 0', expected_interval_seconds: 7 * 24 * 3600 },
  { job_name: 'sub-agent-settle', schedule: '50 23 * * 0', expected_interval_seconds: 7 * 24 * 3600 },
  { job_name: 'abandoned-cart-recovery', schedule: '0 */6 * * *', expected_interval_seconds: 6 * 3600 },
  { job_name: 'referrals-fulfil', schedule: '30 * * * *', expected_interval_seconds: 3600 },
  { job_name: 'push-dispatch', schedule: '*/5 * * * *', expected_interval_seconds: 5 * 60 },
  { job_name: 'recommendations-refresh', schedule: '0 4 * * *', expected_interval_seconds: 24 * 3600 },
  { job_name: 'label-jobs', schedule: '*/5 * * * *', expected_interval_seconds: 5 * 60 },
  { job_name: 'shippo-reconcile', schedule: '0 22 * * 0', expected_interval_seconds: 7 * 24 * 3600 },
  { job_name: 'webhooks-dispatch', schedule: '*/5 * * * *', expected_interval_seconds: 5 * 60 },
];

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const supabase = await createServiceClient();

  // Pull the most-recent run per job_name in a single query
  const { data: rows, error } = await supabase
    .from('cron_runs')
    .select('job_name, partition_key, started_at, finished_at, status, notes, summary')
    .order('started_at', { ascending: false })
    .limit(1000);

  if (error) {
    return NextResponse.json(
      { error: 'Failed To Load Cron Runs.' },
      { status: 500 }
    );
  }

  const latestByJob = new Map<string, typeof rows[number]>();
  const orphanRuns: typeof rows = [];
  for (const r of rows ?? []) {
    if (!latestByJob.has(r.job_name)) {
      latestByJob.set(r.job_name, r);
    }
  }

  // Anything in cron_runs that isn't in the known list - could be ad-hoc,
  // legacy, or a misnamed job. Surface so operators can clean up.
  const knownNames = new Set(KNOWN_CRONS.map((k) => k.job_name));
  for (const r of rows ?? []) {
    if (!knownNames.has(r.job_name)) {
      orphanRuns.push(r);
    }
  }

  const now = new Date();
  const jobs = KNOWN_CRONS.map((k) => {
    const last = latestByJob.get(k.job_name) || null;
    const lastRunAt = last?.started_at ? new Date(last.started_at) : null;
    const secondsSinceRun = lastRunAt ? Math.floor((now.getTime() - lastRunAt.getTime()) / 1000) : null;
    const overdue = secondsSinceRun != null && secondsSinceRun > k.expected_interval_seconds * 1.5;
    const failed = last?.status === 'failed' || last?.status === 'error';
    const healthy = !!last && !overdue && !failed;
    return {
      job_name: k.job_name,
      schedule: k.schedule,
      expected_interval_seconds: k.expected_interval_seconds,
      last_run_at: last?.started_at ?? null,
      last_finished_at: last?.finished_at ?? null,
      last_status: last?.status ?? 'never_run',
      last_notes: last?.notes ?? last?.summary ?? null,
      seconds_since_run: secondsSinceRun,
      healthy,
      reason: !last
        ? 'never_run'
        : failed
          ? 'last_status_failed'
          : overdue
            ? 'overdue'
            : 'ok',
    };
  });

  return NextResponse.json({
    now: now.toISOString(),
    jobs,
    orphan_runs: orphanRuns.slice(0, 20),
    summary: {
      total: jobs.length,
      healthy: jobs.filter((j) => j.healthy).length,
      never_run: jobs.filter((j) => !j.last_run_at).length,
      overdue: jobs.filter((j) => j.reason === 'overdue').length,
      failed: jobs.filter((j) => j.reason === 'last_status_failed').length,
    },
  });
}
