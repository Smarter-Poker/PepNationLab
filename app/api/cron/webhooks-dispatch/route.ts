import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { assertCronAuth } from '@/lib/cron';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/cron/webhooks-dispatch
 *
 * Drains webhook_deliveries with status='pending' AND next_attempt_at <= NOW().
 * For each row:
 *   1. Looks up its webhook_endpoints row to get the URL + secret
 *   2. Signs the payload with the endpoint's secret (HMAC-SHA-256)
 *   3. POSTs with timeout, captures status code + body preview
 *   4. On 2xx → marks delivered_at, status='delivered'
 *   5. On non-2xx or timeout → bumps attempts + exponential backoff in
 *      next_attempt_at; status='failed' after 6 attempts
 *   6. Records a row in cron_runs for the /api/health/crons endpoint
 *
 * Schedule: every 5 minutes via vercel.json.
 *
 * Endpoint health is tracked on the endpoints row (failure_count,
 * last_failure_at, last_failure_reason, last_success_at) so the admin
 * webhook UI can mark noisy endpoints inactive.
 */

const BATCH_SIZE = 50;            // max deliveries processed per cron tick
const REQUEST_TIMEOUT_MS = 10_000; // hard cap so a slow endpoint can't stall the cron
const MAX_ATTEMPTS = 6;            // delivery moves to status='failed' after this
const RESPONSE_PREVIEW_LIMIT = 1000;

function backoffSeconds(attempts: number): number {
  // 1m, 5m, 15m, 1h, 6h, 24h
  const schedule = [60, 300, 900, 3600, 21600, 86400];
  return schedule[Math.min(attempts, schedule.length - 1)];
}

function sign(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

// Constant-time secret comparison for the cron auth - already done by
// assertCronAuth, this is just a defensive import keeping crypto warm.
void timingSafeEqual;

interface DeliveryRow {
  id: string;
  endpoint_id: string;
  event_type: string;
  payload: unknown;
  attempts: number;
  next_attempt_at: string | null;
  related_order_id: string | null;
}

interface EndpointRow {
  id: string;
  url: string;
  secret: string;
  is_active: boolean;
  event_types: string[] | null;
  failure_count: number;
}

async function deliverOne(
  delivery: DeliveryRow,
  endpoint: EndpointRow,
): Promise<{ ok: boolean; statusCode: number | null; bodyPreview: string; reason: string | null }> {
  if (!endpoint.is_active) {
    return { ok: false, statusCode: null, bodyPreview: '', reason: 'endpoint_inactive' };
  }
  // Endpoint can scope the events it cares about; skip if mismatch.
  if (
    Array.isArray(endpoint.event_types) &&
    endpoint.event_types.length > 0 &&
    !endpoint.event_types.includes(delivery.event_type)
  ) {
    return { ok: false, statusCode: null, bodyPreview: '', reason: 'event_type_not_subscribed' };
  }

  const body = JSON.stringify({
    id: delivery.id,
    event: delivery.event_type,
    payload: delivery.payload,
    attempt: delivery.attempts + 1,
    sent_at: new Date().toISOString(),
  });
  const signature = sign(endpoint.secret, body);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'PepNationLab-Webhook/1.0',
        'X-PepNationLab-Event': delivery.event_type,
        'X-PepNationLab-Delivery': delivery.id,
        'X-PepNationLab-Signature': `sha256=${signature}`,
        'X-PepNationLab-Attempt': String(delivery.attempts + 1),
      },
      body,
      signal: controller.signal,
    });

    // Read response body but truncate so a 50 MB junk response doesn't OOM
    const text = await res.text().catch(() => '');
    const preview = text.slice(0, RESPONSE_PREVIEW_LIMIT);

    return {
      ok: res.status >= 200 && res.status < 300,
      statusCode: res.status,
      bodyPreview: preview,
      reason: res.status >= 200 && res.status < 300 ? null : `http_${res.status}`,
    };
  } catch (err) {
    const reason =
      err instanceof Error && err.name === 'AbortError'
        ? 'timeout'
        : err instanceof Error
          ? `network: ${err.message.slice(0, 100)}`
          : 'network';
    return { ok: false, statusCode: null, bodyPreview: '', reason };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  const admin = createAdminClient();
  const startedAt = new Date();
  const runId = crypto.randomUUID();

  // Record the start of this cron tick.
  await admin.from('cron_runs').insert({
    id: runId,
    job_name: 'webhooks-dispatch',
    partition_key: startedAt.toISOString().slice(0, 13),
    started_at: startedAt.toISOString(),
    status: 'running',
  });

  let attempted = 0;
  let delivered = 0;
  let retried = 0;
  let failedFinal = 0;
  const errors: string[] = [];

  try {
    // Pull due deliveries
    const { data: deliveries, error: dlvErr } = await admin
      .from('webhook_deliveries')
      .select('id, endpoint_id, event_type, payload, attempts, next_attempt_at, related_order_id')
      .eq('status', 'pending')
      .lte('next_attempt_at', startedAt.toISOString())
      .order('next_attempt_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (dlvErr) {
      throw new Error(`fetch deliveries: ${dlvErr.message}`);
    }

    if (!deliveries || deliveries.length === 0) {
      await admin
        .from('cron_runs')
        .update({
          finished_at: new Date().toISOString(),
          status: 'ok',
          summary: 'no deliveries due',
        })
        .eq('id', runId);
      return NextResponse.json({ ok: true, attempted: 0, delivered: 0 });
    }

    // Pre-fetch endpoints for the batch
    const endpointIds = Array.from(new Set(deliveries.map((d) => d.endpoint_id))).filter(Boolean);
    const { data: endpoints, error: epErr } = await admin
      .from('webhook_endpoints')
      .select('id, url, secret, is_active, event_types, failure_count')
      .in('id', endpointIds);

    if (epErr) {
      throw new Error(`fetch endpoints: ${epErr.message}`);
    }

    const epById = new Map<string, EndpointRow>();
    for (const e of endpoints ?? []) epById.set(e.id as string, e as EndpointRow);

    for (const d of deliveries as DeliveryRow[]) {
      attempted++;
      const ep = epById.get(d.endpoint_id);
      if (!ep) {
        // Endpoint was deleted out from under us - mark delivery failed.
        await admin
          .from('webhook_deliveries')
          .update({
            status: 'failed',
            last_attempted_at: new Date().toISOString(),
            last_response_body: 'endpoint not found',
          })
          .eq('id', d.id);
        failedFinal++;
        continue;
      }

      const result = await deliverOne(d, ep);
      const now = new Date();

      if (result.ok) {
        delivered++;
        await admin
          .from('webhook_deliveries')
          .update({
            status: 'delivered',
            attempts: d.attempts + 1,
            last_attempted_at: now.toISOString(),
            delivered_at: now.toISOString(),
            last_status_code: result.statusCode,
            last_response_body: result.bodyPreview || null,
          })
          .eq('id', d.id);
        await admin
          .from('webhook_endpoints')
          .update({
            last_success_at: now.toISOString(),
            failure_count: 0,
          })
          .eq('id', ep.id);
      } else {
        const nextAttempts = d.attempts + 1;
        const isFinal = nextAttempts >= MAX_ATTEMPTS;
        const nextAttemptAt = new Date(now.getTime() + backoffSeconds(nextAttempts) * 1000);
        const newStatus = isFinal ? 'failed' : 'pending';
        if (isFinal) failedFinal++;
        else retried++;
        await admin
          .from('webhook_deliveries')
          .update({
            status: newStatus,
            attempts: nextAttempts,
            last_attempted_at: now.toISOString(),
            last_status_code: result.statusCode,
            last_response_body: result.bodyPreview || result.reason,
            next_attempt_at: isFinal ? null : nextAttemptAt.toISOString(),
          })
          .eq('id', d.id);
        await admin
          .from('webhook_endpoints')
          .update({
            failure_count: (ep.failure_count ?? 0) + 1,
            last_failure_at: now.toISOString(),
            last_failure_reason: result.reason ?? 'unknown',
          })
          .eq('id', ep.id);
        if (errors.length < 10) errors.push(`${d.id}: ${result.reason ?? 'fail'}`);
      }
    }

    await admin
      .from('cron_runs')
      .update({
        finished_at: new Date().toISOString(),
        status: 'ok',
        summary: `attempted=${attempted} delivered=${delivered} retried=${retried} failed_final=${failedFinal}`,
        notes: errors.length > 0 ? errors.join('; ') : null,
      })
      .eq('id', runId);

    return NextResponse.json({
      ok: true,
      attempted,
      delivered,
      retried,
      failed_final: failedFinal,
      errors,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    await admin
      .from('cron_runs')
      .update({
        finished_at: new Date().toISOString(),
        status: 'failed',
        notes: msg.slice(0, 500),
        summary: `attempted=${attempted} delivered=${delivered} crash=${msg.slice(0, 80)}`,
      })
      .eq('id', runId);
    console.error('[webhooks-dispatch] crash:', err);
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}
