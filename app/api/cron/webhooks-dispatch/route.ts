import type { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { deliverWebhook } from '@/lib/webhook-dispatch';

export const dynamic = 'force-dynamic';

const BATCH_LIMIT = 100;

function fivemPartitionKey(d: Date = new Date()): string {
  // YYYY-MM-DDTHH:MM rounded down to the nearest 5-minute slot. Cron fires
  // every 5 minutes and each firing must do real work, so the partition key
  // is granular enough that each invocation gets its own row in cron_runs.
  // Concurrent re-triggers inside the same 5-minute window still dedupe.
  const hh = d.toISOString().slice(0, 13);
  const slot = Math.floor(d.getUTCMinutes() / 5) * 5;
  return `${hh}:${String(slot).padStart(2, '0')}`;
}

export async function GET(req: NextRequest) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  const partitionKey = fivemPartitionKey();
  const claim = await claimCronRun('webhooks_dispatch', partitionKey);
  if (!claim) {
    return Response.json({ skipped: true, reason: 'already_ran_this_slot' });
  }

  let processed = 0;
  let sent = 0;
  let failed = 0;
  let expired = 0;
  let errorNote: string | null = null;

  try {
    const supabase = await createServiceClient();

    const { data: rows, error } = await supabase
      .from('webhook_deliveries')
      .select('id')
      .eq('status', 'pending')
      .lte('next_attempt_at', new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(BATCH_LIMIT);

    if (error) {
      errorNote = `select_failed: ${error.message}`.slice(0, 300);
    } else {
      for (const row of (rows ?? []) as Array<{ id: string }>) {
        processed++;
        const result = await deliverWebhook(supabase, row.id);
        if (result.ok) sent++;
        else if (result.expired) expired++;
        else failed++;
      }
    }
  } catch (err: unknown) {
    errorNote = err instanceof Error ? err.message.slice(0, 300) : 'unknown_error';
  }

  const summary = `processed=${processed} sent=${sent} failed=${failed} expired=${expired}${errorNote ? ` err=${errorNote}` : ''}`;
  await finishCronRun(claim.id, errorNote ? 'failed' : 'succeeded', summary);

  return Response.json({
    ok: !errorNote,
    processed,
    sent,
    failed,
    expired,
    partitionKey,
    error: errorNote,
  });
}
