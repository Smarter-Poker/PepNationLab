import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Applies all due scheduled_price_changes rows.
 * Partitioned by the ISO minute (YYYY-MM-DDTHH:MM) so multiple invocations
 * inside the same 15-min cron window are deduped via cron_runs.
 *
 * Cron schedule (vercel.json): every 15 minutes.
 */
export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  const partitionKey = new Date().toISOString().slice(0, 16);
  const run = await claimCronRun('apply_price_changes', partitionKey);
  if (!run) {
    return new Response(
      JSON.stringify({ ok: true, skipped: true, reason: 'Already Ran This Window' }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  }

  try {
    const supabase = await createServiceClient();
    const { data, error } = await supabase.rpc('apply_due_price_changes');
    if (error) {
      await finishCronRun(run.id, 'failed', error.message);
      return new Response(
        JSON.stringify({ ok: false, error: error.message }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }
    const applied = typeof data === 'number' ? data : 0;
    await finishCronRun(run.id, 'succeeded', `applied=${applied}`);
    return new Response(
      JSON.stringify({ ok: true, applied }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown Error';
    await finishCronRun(run.id, 'failed', message);
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}
