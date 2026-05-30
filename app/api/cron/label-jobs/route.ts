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
      .order('created_at', { ascending: true })
      .limit(BATCH_LIMIT);

    if (fetchErr) {
      errorNote = `fetch_failed: ${fetchErr.message}`.slice(0, 300);
    } else {
      for (const job of (jobs ?? [])) {
        processed++;
        const jobId = job.id as string;
        const orderId = job.order_id as string;
        const attempts = (job.attempts as number) || 0;

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
            attempts: attempts + 1,
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
          const nextAttempts = attempts + 1;
          if (nextAttempts >= MAX_ATTEMPTS) {
            await supabase.from('label_jobs').update({
              status: 'failed',
              last_error: msg,
              attempts: nextAttempts,
            }).eq('id', jobId);
            await supabase.from('admin_audit_log').insert({
              actor_id: null,
              action: 'label_job_permanently_failed',
              entity_type: 'label_jobs',
              entity_id: jobId,
              changes: { order_id: orderId, error: msg, attempts: nextAttempts },
            });
            permanentlyFailed++;
          } else {
            await supabase.from('label_jobs').update({
              last_error: msg,
              attempts: nextAttempts,
            }).eq('id', jobId);
          }
          failed++;
          continue;
        }

        // Success — update job row.
        await supabase.from('label_jobs').update({
          status: 'succeeded',
          shippo_transaction_id: result.shippoTransactionId,
          label_url: result.labelUrl,
          tracking_number: result.trackingNumber,
          agent_charged_cents: result.labelCostCents,
          attempts: attempts + 1,
          completed_at: new Date().toISOString(),
        }).eq('id', jobId);

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
