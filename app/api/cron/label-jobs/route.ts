/**
 * GET /api/cron/label-jobs
 *
 * Processes the `label_jobs` queue: picks up pending jobs and calls
 * `buyLabel(input)` from lib/shippo.ts, which uses the platform account key.
 *
 * Each label_jobs row must have:
 *   order_id         — the parent order
 *   agent_id         — used by buyLabel to verify order ownership (can be NULL
 *                      for admin-created jobs, in which case we use the order's agent_id)
 *   service_level_token — optional preferred carrier
 *   origin_id        — optional override origin
 *   attempts         — retry counter
 *   status           — pending | succeeded | failed
 *
 * Job lifecycle: pending → (this run) → succeeded | failed
 * Max attempts: 3. Permanent failure writes admin_audit_log.
 *
 * Dedup: `claimCronRun` unique per job_name + 5-min partition key.
 */

import type { NextRequest } from 'next/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { buyLabel } from '@/lib/shippo';
import { createServiceClient } from '@/lib/supabase/server';
import { enqueueOrderPush } from '@/lib/push-enqueue';
import { enqueueWebhook, fetchOrderForWebhook } from '@/lib/webhook-dispatch';

export const dynamic = 'force-dynamic';

const BATCH_LIMIT = 20;
const MAX_ATTEMPTS = 3;

function fiveMinPartitionKey(d: Date = new Date()): string {
  const hh = d.toISOString().slice(0, 13);
  const slot = Math.floor(d.getUTCMinutes() / 5) * 5;
  return `${hh}:${String(slot).padStart(2, '0')}`;
}

export async function GET(req: NextRequest) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  const partitionKey = fiveMinPartitionKey();
  const claim = await claimCronRun('label_jobs', partitionKey);
  if (!claim) {
    return Response.json({ skipped: true, reason: 'already_ran_this_slot' });
  }

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let permanentlyFailed = 0;
  let errorNote: string | null = null;

  try {
    const supabase = await createServiceClient();

    const { data: jobs, error: fetchErr } = await supabase
      .from('label_jobs')
      .select('id, order_id, agent_id, service_level_token, preferred_service_level, origin_id, label_file_type, attempts')
      .in('status', ['pending', 'queued'])
      .lt('attempts', MAX_ATTEMPTS)
      .lte('next_attempt_at', new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(BATCH_LIMIT);

    if (fetchErr) {
      errorNote = `fetch_failed: ${fetchErr.message}`.slice(0, 300);
    } else {
      for (const job of (jobs ?? [])) {
        const jobId = job.id as string;
        const orderId = job.order_id as string;
        const attempts = (job.attempts as number) || 0;

        // Atomic claim. A parallel cron tick (Vercel sometimes double-fires
        // a single schedule slot, plus the same job can be visible in
        // overlapping batches) must lose the race here, NOT after we've
        // already paid Shippo. The UPDATE … WHERE status IN ('pending',
        // 'queued') AND attempts<MAX_ATTEMPTS RETURNING id is the only
        // ownership signal. The status='processing' value is whitelisted by
        // the label_jobs CHECK constraint in migration 002.
        const { data: claimedRows } = await supabase
          .from('label_jobs')
          .update({ status: 'processing', attempts: attempts + 1 })
          .eq('id', jobId)
          .in('status', ['pending', 'queued'])
          .lt('attempts', MAX_ATTEMPTS)
          .select('id');
        if (!claimedRows || claimedRows.length === 0) {
          // Lost the race — another worker is handling this row.
          continue;
        }

        processed++;

        // Resolve agent_id: prefer job row, fall back to the order's agent_id.
        let agentId = typeof job.agent_id === 'string' ? job.agent_id : null;
        if (!agentId) {
          const { data: order } = await supabase
            .from('orders')
            .select('agent_id')
            .eq('id', orderId)
            .maybeSingle();
          agentId = order?.agent_id ?? null;
        }

        if (!agentId) {
          await supabase.from('label_jobs').update({
            status: 'failed',
            last_error: 'no_agent_id',
          }).eq('id', jobId);
          permanentlyFailed++;
          continue;
        }

        // Call the platform buyLabel.
        const result = await buyLabel({
          orderId,
          agentId,
          preferredServiceLevel: (typeof job.service_level_token === 'string' ? job.service_level_token : null)
            ?? (typeof job.preferred_service_level === 'string' ? job.preferred_service_level : null),
          originId: typeof job.origin_id === 'string' ? job.origin_id : null,
          labelFileType: (['PDF', 'PDF_4x6', 'PNG', 'ZPL_203'].includes(String(job.label_file_type))
            ? String(job.label_file_type)
            : 'PDF_4x6') as 'PDF' | 'PDF_4x6' | 'PNG' | 'ZPL_203',
          labelJobId: jobId,
        });

        if (!result.ok) {
          const msg = result.error.slice(0, 300);
          // attempts was already incremented by the atomic claim above; the
          // post-claim value is `attempts + 1`.
          const newAttempts = attempts + 1;
          if (newAttempts >= MAX_ATTEMPTS) {
            await supabase.from('label_jobs').update({
              status: 'failed',
              last_error: msg,
            }).eq('id', jobId);
            await supabase.from('admin_audit_log').insert({
              actor_id: null,
              action: 'label_job_permanently_failed',
              entity_type: 'label_jobs',
              entity_id: jobId,
              changes: { order_id: orderId, error: msg, attempts: newAttempts },
            });
            permanentlyFailed++;
          } else {
            // Back-off: 5^attempt minutes. attempt=1→5min, 2→25min, 3→125min.
            // Flip back to 'queued' with next_attempt_at in the future so the
            // cron's lte filter skips this row until the backoff window expires.
            const backoffMinutes = Math.pow(5, newAttempts);
            const nextAt = new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString();
            await supabase.from('label_jobs').update({
              status: 'queued',
              last_error: msg,
              next_attempt_at: nextAt,
            }).eq('id', jobId);
          }
          failed++;
          continue;
        }

        // Success — update job row. Guard against a webhook racing us to
        // mark the same row succeeded (the webhook also updates label_jobs
        // by id, see app/api/webhooks/shippo/route.ts:handleTransaction).
        await supabase.from('label_jobs').update({
          status: 'succeeded',
          shippo_transaction_id: result.shippoTransactionId,
          label_url: result.labelUrl,
          tracking_number: result.trackingNumber,
          agent_charged_cents: result.labelCostCents,
          completed_at: new Date().toISOString(),
        }).eq('id', jobId).neq('status', 'succeeded');

        succeeded++;

        // Fetch buyer_id for push notification.
        const { data: orderRow } = await supabase
          .from('orders')
          .select('buyer_id')
          .eq('id', orderId)
          .maybeSingle();

        if (orderRow?.buyer_id) {
          try {
            await enqueueOrderPush(supabase, {
              userId: orderRow.buyer_id,
              orderId,
              event: 'order_shipped',
              tracking: result.trackingNumber,
            });
          } catch { /* non-blocking */ }
        }

        void (async () => {
          try {
            const orderPayload = await fetchOrderForWebhook(supabase, orderId);
            if (orderPayload) {
              await enqueueWebhook(supabase, {
                event: 'order.shipped',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                agentId: (orderPayload as any).agent_id ?? null,
                payload: { order: orderPayload },
                relatedOrderId: orderId,
              });
            }
          } catch { /* non-blocking */ }
        })();
      }
    }
  } catch (err: unknown) {
    errorNote = err instanceof Error ? err.message.slice(0, 300) : 'unknown_error';
  }

  const summary = `processed=${processed} succeeded=${succeeded} failed=${failed} permanentlyFailed=${permanentlyFailed}${errorNote ? ` err=${errorNote}` : ''}`;
  await finishCronRun(claim.id, errorNote ? 'failed' : 'succeeded', summary);

  return Response.json({
    ok: !errorNote,
    processed,
    succeeded,
    failed,
    permanentlyFailed,
    partitionKey,
    error: errorNote,
  });
}
