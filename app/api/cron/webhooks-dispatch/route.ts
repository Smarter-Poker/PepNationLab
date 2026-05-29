import type { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { deliverWebhook } from '@/lib/webhook-dispatch';

export const dynamic = 'force-dynamic';

const BATCH_LIMIT = 100;

function hourlyPartitionKey(d: Date = new Date()): string {
  // YYYY-MM-DDTHH — cron runs every 5 minutes; the hourly partition lets a
  // re-trigger inside the same UTC hour short-circuit cleanly.
  return d.toISOString().slice(0, 13);
}

export async function GET(req: NextRequest) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  const partitionKey = hourlyPartitionKey();
  const claim = await claimCronRun('webhooks_dispatch', partitionKey);
  if (!claim) {
    return Response.json({ skipped: true, reason: 'already_ran_this_hour' });
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
