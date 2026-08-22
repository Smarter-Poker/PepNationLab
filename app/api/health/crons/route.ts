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

// Known cron jobs and their nominal cadence. The job_name values MUST match
// EXACTLY the string each route passes to claimCronRun() / inserts into
// cron_runs - otherwise the dashboard reports false "never_run"/orphan rows.
// Most jobs record under a snake_case name; four record hyphenated
// (webhooks-dispatch, cancel-stale-pending, idempotency-sweep,
// shipping-reconcile). Schedules are the source-of-truth values from
// vercel.json. Update when vercel.json changes.
//
// NOTE: the following vercel.json crons intentionally do NOT instrument
// cron_runs and are therefore not tracked here (the dashboard cannot observe
// jobs that never write a row): reminders, search-refresh, coupons-expire,
// generate-embeddings, sub-agent-settle, and the five messenger/cron/* jobs.
// referrals-fulfil and label-jobs previously recorded but were decommissioned
// (label generation is now on-demand only). Instrumenting the remaining
// uninstrumented routes is tracked as separate follow-up work.
const KNOWN_CRONS: Array<{ job_name: string; schedule: string; expected_interval_seconds: number }> = [
  // High-frequency operational jobs
  { job_name: 'push_dispatch', schedule: '*/5 * * * *', expected_interval_seconds: 5 * 60 },
  { job_name: 'webhooks-dispatch', schedule: '*/5 * * * *', expected_interval_seconds: 5 * 60 },
  { job_name: 'shipping_webhook_retry', schedule: '*/15 * * * *', expected_interval_seconds: 15 * 60 },
  // Daily / multi-hour operational jobs
  { job_name: 'abandoned_cart_recovery', schedule: '0 */6 * * *', expected_interval_seconds: 6 * 3600 },
  { job_name: 'lifecycle_nudges', schedule: '0 16 * * *', expected_interval_seconds: 24 * 3600 },
  { job_name: 'cancel-stale-pending', schedule: '45 3 * * *', expected_interval_seconds: 24 * 3600 },
  { job_name: 'idempotency-sweep', schedule: '30 3 * * *', expected_interval_seconds: 24 * 3600 },
  { job_name: 'recommendations_refresh', schedule: '0 4 * * *', expected_interval_seconds: 24 * 3600 },
  { job_name: 'tier_recompute', schedule: '0 8 * * *', expected_interval_seconds: 24 * 3600 },
  { job_name: 'balance_alerts', schedule: '0 8 * * *', expected_interval_seconds: 24 * 3600 },
  { job_name: 'inventory_alerts', schedule: '0 9 * * *', expected_interval_seconds: 24 * 3600 },
  { job_name: 'biorxiv_watch', schedule: '0 9 * * *', expected_interval_seconds: 24 * 3600 },
  { job_name: 'refill_reminders', schedule: '0 15 * * *', expected_interval_seconds: 24 * 3600 },
  // Weekly billing + research-data sync jobs
  { job_name: 'weekly_invoices', schedule: '59 5 * * 1', expected_interval_seconds: 7 * 24 * 3600 },
  { job_name: 'pubmed_sync', schedule: '0 3 * * 1', expected_interval_seconds: 7 * 24 * 3600 },
  { job_name: 'trials_sync', schedule: '0 4 * * 1', expected_interval_seconds: 7 * 24 * 3600 },
  { job_name: 'uniprot_sync', schedule: '0 3 * * 2', expected_interval_seconds: 7 * 24 * 3600 },
  { job_name: 'chembl_sync', schedule: '0 4 * * 2', expected_interval_seconds: 7 * 24 * 3600 },
  { job_name: 'fda_drugs_sync', schedule: '0 5 * * 2', expected_interval_seconds: 7 * 24 * 3600 },
  { job_name: 'dailymed_sync', schedule: '0 6 * * 2', expected_interval_seconds: 7 * 24 * 3600 },
  { job_name: 'rxnorm_sync', schedule: '0 3 * * 3', expected_interval_seconds: 7 * 24 * 3600 },
  { job_name: 'europepmc_sync', schedule: '0 4 * * 3', expected_interval_seconds: 7 * 24 * 3600 },
  { job_name: 'retraction_watch', schedule: '0 5 * * 3', expected_interval_seconds: 7 * 24 * 3600 },
  { job_name: 'shipping-reconcile', schedule: '0 22 * * 0', expected_interval_seconds: 7 * 24 * 3600 },
  { job_name: 'companion_papers_compute', schedule: '0 10 * * 0', expected_interval_seconds: 7 * 24 * 3600 },
  { job_name: 'broken_link_crawler', schedule: '0 12 * * 6', expected_interval_seconds: 7 * 24 * 3600 },
  // Monthly
  { job_name: 'patents_sync', schedule: '0 8 1 * *', expected_interval_seconds: 31 * 24 * 3600 },
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
