/**
 * GET /api/cron/trials-sync
 *
 * Weekly ClinicalTrials.gov v2 sync. Pulls trials whose intervention
 * matches the compound display_name for every compound flagged as
 * approved_drug or investigational, then upserts the result set into
 * compound_clinical_trials keyed on (compound_slug, nct_id). Updates
 * the active/completed trial counters on the compound row.
 *
 * Batched to 30 compounds per invocation. Schedule: Mon 04:00 UTC
 * (see vercel.json).
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { searchTrials, type CtgovTrial } from '@/lib/research/clinical-trials';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BATCH_SIZE = 30;
const INTER_REQUEST_MS = 250;

const ACTIVE_STATUSES = new Set([
  'RECRUITING',
  'ENROLLING_BY_INVITATION',
  'ACTIVE_NOT_RECRUITING',
  'NOT_YET_RECRUITING',
]);
const COMPLETED_STATUSES = new Set(['COMPLETED']);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function partitionKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function trialRow(slug: string, t: CtgovTrial) {
  return {
    compound_slug: slug,
    nct_id: t.nctId,
    title: t.briefTitle,
    status: t.overallStatus,
    phase: t.phase,
    enrollment: t.enrollmentCount,
    lead_sponsor: t.leadSponsor,
    start_date: t.startDate,
    primary_completion_date: t.primaryCompletionDate,
    condition: t.conditions.join(' | ').slice(0, 500) || null,
    intervention: t.interventions.join(' | ').slice(0, 500) || null,
    url: t.url,
    raw_data: t.raw,
  };
}

export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  const claim = await claimCronRun('trials_sync', partitionKey());
  if (!claim) {
    return NextResponse.json({ skipped: true, reason: 'already_ran_today' });
  }

  let processed = 0;
  let upserted = 0;
  let failed = 0;

  try {
    const supabase = await createServiceClient();
    const { data: rowsData } = await supabase
      .from('compounds')
      .select('slug, display_name, evidence_tier')
      .in('evidence_tier', ['approved_drug', 'investigational'])
      .limit(BATCH_SIZE);

    const rows = (rowsData ?? []) as Array<{
      slug: string;
      display_name: string;
      evidence_tier: string;
    }>;

    for (const row of rows) {
      processed += 1;
      const trials = await searchTrials(row.display_name, { pageSize: 50 });
      if (trials.length === 0) {
        // Still update counters so we don't recompute a dead compound forever.
        await supabase
          .from('compounds')
          .update({ active_trial_count: 0, completed_trial_count: 0 })
          .eq('slug', row.slug);
        await sleep(INTER_REQUEST_MS);
        continue;
      }

      const upsertRows = trials.map((t) => trialRow(row.slug, t));
      const { error: upsertErr } = await supabase
        .from('compound_clinical_trials')
        .upsert(upsertRows, { onConflict: 'compound_slug,nct_id' });

      if (upsertErr) {
        failed += 1;
      } else {
        upserted += upsertRows.length;
        const active = trials.filter((t) => ACTIVE_STATUSES.has(t.overallStatus ?? '')).length;
        const completed = trials.filter((t) => COMPLETED_STATUSES.has(t.overallStatus ?? ''))
          .length;
        await supabase
          .from('compounds')
          .update({
            active_trial_count: active,
            completed_trial_count: completed,
          })
          .eq('slug', row.slug);
      }
      await sleep(INTER_REQUEST_MS);
    }

    await finishCronRun(
      claim.id,
      'succeeded',
      `processed=${processed} upserted=${upserted} failed=${failed}`,
    );

    return NextResponse.json({
      ok: true,
      processed,
      upserted,
      failed,
      ranAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await finishCronRun(claim.id, 'failed', message.slice(0, 500));
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
