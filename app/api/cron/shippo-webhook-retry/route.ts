/**
 * GET /api/cron/shippo-webhook-retry
 *
 * Reprocesses inbound Shippo webhook events whose first processing attempt
 * failed. The live receiver (/api/webhooks/shippo) always returns 2XX so
 * Shippo never retries; that means a transient DB error during processing
 * would otherwise be lost. This cron closes that gap by re-running the stored
 * payload through the SAME lib/shippo-webhook.processShippoEvent path.
 *
 * Selection: rows in shippo_webhook_events that are
 *   - not signature-rejected (event_id NOT LIKE 'rejected:%', error not
 *     'signature_invalid'), and
 *   - still carry a processing_error,
 *   - and are at least 2 minutes old (so we never race the live handler),
 *   - within the trailing 7 days, capped per run.
 *
 * On success the row's processing_error is cleared and processed_at stamped.
 * On repeat failure the new error is recorded for the next pass / admin view.
 *
 * Schedule: every 15 minutes via vercel.json. Idempotent per 15-min slice via
 * claimCronRun so a double-trigger short-circuits.
 */

import type { NextRequest } from 'next/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { createServiceClient } from '@/lib/supabase/server';
import { processShippoEvent, asRecord, asString } from '@/lib/shippo-webhook';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BATCH = 25;
const GRACE_MS = 2 * 60 * 1000; // do not touch events younger than 2 minutes
const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function minutePartitionKey(d: Date = new Date()): string {
  // 15-minute bucket: YYYY-MM-DDTHH plus quarter index.
  const q = Math.floor(d.getUTCMinutes() / 15);
  return `${d.toISOString().slice(0, 13)}:${q}`;
}

export async function GET(req: NextRequest) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  const claim = await claimCronRun('shippo_webhook_retry', minutePartitionKey());
  if (!claim) {
    return Response.json({ skipped: true, reason: 'already_ran_this_slice' });
  }

  let scanned = 0;
  let recovered = 0;
  let stillFailing = 0;
  let errorNote: string | null = null;

  try {
    const supabase = await createServiceClient();
    const now = Date.now();
    const windowStart = new Date(now - WINDOW_MS).toISOString();
    const cutoff = new Date(now - GRACE_MS).toISOString();

    // Pull candidate rows: have an error, old enough, recent enough, not a
    // signature rejection.
    const { data: rows, error: selErr } = await supabase
      .from('shippo_webhook_events')
      .select('id, event_id, event_type, payload, processing_error, received_at')
      .not('processing_error', 'is', null)
      .neq('processing_error', 'signature_invalid')
      .not('event_id', 'like', 'rejected:%')
      .gte('received_at', windowStart)
      .lte('received_at', cutoff)
      .order('received_at', { ascending: true })
      .limit(BATCH);

    if (selErr) {
      errorNote = `select_failed: ${selErr.message}`.slice(0, 300);
    } else {
      for (const row of rows ?? []) {
        scanned++;
        const parsed = asRecord(row.payload);
        const event = asString(parsed.event) || String(row.event_type || 'unknown');
        const data = asRecord(parsed.data);
        try {
          await processShippoEvent(supabase, event, data, parsed);
          await supabase
            .from('shippo_webhook_events')
            .update({ processed_at: new Date().toISOString(), processing_error: null })
            .eq('id', row.id);
          recovered++;
        } catch (err) {
          stillFailing++;
          const msg = err instanceof Error ? err.message.slice(0, 300) : 'processing_error';
          await supabase
            .from('shippo_webhook_events')
            .update({ processing_error: msg })
            .eq('id', row.id)
            .then(() => undefined, () => undefined);
        }
      }
    }
  } catch (err) {
    errorNote = err instanceof Error ? err.message.slice(0, 300) : 'unknown_error';
  }

  const summary = `scanned=${scanned} recovered=${recovered} still_failing=${stillFailing}${errorNote ? ` err=${errorNote}` : ''}`;
  await finishCronRun(claim.id, errorNote ? 'failed' : 'succeeded', summary);

  return Response.json({ ok: !errorNote, scanned, recovered, stillFailing, error: errorNote });
}
