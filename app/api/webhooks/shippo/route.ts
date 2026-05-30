/**
 * POST /api/webhooks/shippo
 *
 * Receives inbound Shippo platform events (track_updated, transaction.created,
 * transaction.updated, etc.) and updates the corresponding order and label_job
 * rows. Writes a forensic row to shipping_webhook_deliveries and a tracking
 * row to shipping_tracking_events.
 *
 * Security:
 *   HMAC-SHA256 over the raw body using SHIPPO_WEBHOOK_SECRET. If the env var
 *   is unset the handler refuses every request with 503 — there is NO URL-
 *   token bypass anymore (it was a CRON_SECRET-based fallback that any
 *   internal-knowledge attacker could forge).
 *
 * Idempotency: events are deduplicated by event_id via the
 * shippo_webhook_events table (UNIQUE on event_id). Duplicate calls return
 * 200 immediately. The full payload is also archived in
 * shipping_webhook_deliveries for admin forensics.
 *
 * Order status writes go through canTransition() so we cannot resurrect a
 * cancelled order to delivered.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { safeCompare } from '@/lib/shippo-crypto';
import { canTransition, type OrderStatus } from '@/lib/order-states';
import type { SupabaseClient } from '@supabase/supabase-js';
import { notifyOrderDelivered } from '@/lib/notify';
import { shortOrderId } from '@/lib/push-enqueue';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

function verifyHmacSignature(rawBody: string, header: string, secret: string): boolean {
  // Shippo sends: X-Shippo-Webhook-Signature: sha256=<hex>
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  return safeCompare(header, expected);
}

// ---------------------------------------------------------------------------
// Forensic deliveries writer
// ---------------------------------------------------------------------------

async function recordDelivery(
  supabase: SupabaseClient,
  args: {
    eventId: string | null;
    eventType: string;
    signatureValid: boolean;
    payload: unknown;
    processed?: boolean;
    deadLettered?: boolean;
    errorMessage?: string | null;
  },
): Promise<void> {
  try {
    await supabase.from('shipping_webhook_deliveries').insert({
      shippo_event_id: args.eventId,
      event_type: args.eventType,
      signature_valid: args.signatureValid,
      processed: args.processed ?? false,
      dead_lettered: args.deadLettered ?? false,
      error_message: args.errorMessage ?? null,
      payload: args.payload,
      processed_at: args.processed ? new Date().toISOString() : null,
    });
  } catch {
    /* forensics row is best-effort; do not block ack */
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // --- Signature check ---
  const webhookSecret = process.env.SHIPPO_WEBHOOK_SECRET;
  if (!webhookSecret) {
    // No secret configured — refuse rather than accept anything. The previous
    // URL-token fallback shared CRON_SECRET's blast radius and was an HMAC
    // bypass for any caller who knew the cron secret.
    return NextResponse.json({ error: 'Webhook Not Configured.' }, { status: 503 });
  }
  const signatureHeader = req.headers.get('x-shippo-webhook-signature') ?? '';
  if (!signatureHeader || !verifyHmacSignature(rawBody, signatureHeader, webhookSecret)) {
    // Record an attempted-but-invalid delivery for forensic alerting
    // (the admin UI can surface a spike of bad-sig events as an attack
    // signal). Best-effort; do not block the 401.
    try {
      const sb = await createServiceClient();
      await sb.from('shipping_webhook_deliveries').insert({
        shippo_event_id: null,
        event_type: 'unknown',
        signature_valid: false,
        processed: false,
        dead_lettered: true,
        error_message: 'invalid_signature',
        payload: { rawBodyLength: rawBody.length },
      });
    } catch { /* ignore */ }
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  // --- Parse body ---
  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const eventId = String(event.event_id ?? event.id ?? '').trim() || null;
  const eventType = String(event.event ?? event.type ?? '').trim();
  const data = (event.data ?? {}) as Record<string, unknown>;

  const supabase = await createServiceClient();

  if (!eventId || !eventType) {
    await recordDelivery(supabase, {
      eventId,
      eventType: eventType || 'unknown',
      signatureValid: true,
      payload: event,
      processed: false,
      deadLettered: true,
      errorMessage: 'no_event_type_or_id',
    });
    return NextResponse.json({ ok: true, reason: 'no_event_type_or_id' });
  }

  // --- Deduplication on shippo_webhook_events ---
  const { error: dedupeErr } = await supabase
    .from('shippo_webhook_events')
    .insert({ event_id: eventId, event_type: eventType, payload: event });

  if (dedupeErr) {
    if (dedupeErr.code === '23505') {
      // Duplicate — already saw this event. Forensic row was already written
      // on the original attempt; skip a second write.
      return NextResponse.json({ ok: true, reason: 'duplicate' });
    }
    // Other DB error — still return 200 so Shippo does not retry forever.
    // Log a delivery row so ops can see it.
    await recordDelivery(supabase, {
      eventId,
      eventType,
      signatureValid: true,
      payload: event,
      processed: false,
      deadLettered: true,
      errorMessage: 'dedupe_insert_failed',
    });
    return NextResponse.json({ ok: true, reason: 'db_error' });
  }

  // --- Event handlers ---
  let handlerError: string | null = null;
  try {
    switch (eventType) {
      case 'track_updated':
        await handleTrackUpdated(supabase, data, event);
        break;
      case 'transaction.created':
      case 'transaction.updated':
        await handleTransaction(supabase, data, event);
        break;
      default:
        // Unknown event — acknowledge and record for review.
        break;
    }
  } catch (err) {
    handlerError = err instanceof Error ? err.message.slice(0, 500) : 'handler_error';
    await supabase
      .from('shippo_webhook_events')
      .update({ processing_error: handlerError })
      .eq('event_id', eventId);
  }

  // --- Forensic delivery row + processed marker ---
  await recordDelivery(supabase, {
    eventId,
    eventType,
    signatureValid: true,
    payload: event,
    processed: !handlerError,
    deadLettered: !!handlerError,
    errorMessage: handlerError,
  });

  if (!handlerError) {
    await supabase
      .from('shippo_webhook_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('event_id', eventId);
  }

  // Always 200 — Shippo retries on non-2xx; we already persisted the failure.
  // Body is generic; do NOT leak handler error details to the carrier.
  return NextResponse.json({ ok: true });
}

// ---------------------------------------------------------------------------
// track_updated handler
// ---------------------------------------------------------------------------

async function handleTrackUpdated(
  supabase: SupabaseClient,
  data: Record<string, unknown>,
  fullEvent: Record<string, unknown>,
) {
  const trackingNumber = String(data.tracking_number ?? '').trim();
  if (!trackingNumber) return;

  const trackingStatusObj = (data.tracking_status && typeof data.tracking_status === 'object')
    ? data.tracking_status as Record<string, unknown>
    : null;
  const status = String(trackingStatusObj?.status ?? data.status ?? '').trim().toUpperCase();
  const substatusObj = (trackingStatusObj?.substatus && typeof trackingStatusObj.substatus === 'object')
    ? trackingStatusObj.substatus as Record<string, unknown>
    : null;
  const substatus = substatusObj?.code ? String(substatusObj.code) : null;
  const statusDetails = trackingStatusObj?.status_details
    ? String(trackingStatusObj.status_details).slice(0, 500)
    : null;
  const statusDate = trackingStatusObj?.status_date
    ? String(trackingStatusObj.status_date)
    : new Date().toISOString();
  const location = (trackingStatusObj?.location && typeof trackingStatusObj.location === 'object')
    ? trackingStatusObj.location as Record<string, unknown>
    : null;
  const carrier = String(data.carrier ?? '').trim().toLowerCase() || null;

  // Find the order by tracking number.
  const { data: order } = await supabase
    .from('orders')
    .select('id, status, buyer_id')
    .eq('tracking_number', trackingNumber)
    .maybeSingle();

  if (!order) return;
  const currentStatus = order.status as OrderStatus;

  // Always log the tracking event row, regardless of whether we move the order.
  await supabase.from('shipping_tracking_events').insert({
    order_id: order.id,
    tracking_number: trackingNumber,
    carrier,
    status: status || 'UNKNOWN',
    substatus,
    status_details: statusDetails,
    location,
    occurred_at: statusDate,
    raw_payload: fullEvent,
  });

  // Map Shippo tracking status to order status.
  const deliveredStatuses = ['DELIVERED'];
  const inTransitStatuses = ['TRANSIT', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'];

  if (deliveredStatuses.includes(status)) {
    // Only flip to 'delivered' when the state-machine allows it. We
    // explicitly do NOT resurrect cancelled or already-delivered orders.
    if (canTransition(currentStatus, 'delivered', 'admin')) {
      await supabase
        .from('orders')
        .update({
          status: 'delivered',
          delivered_at: statusDate,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)
        .neq('status', 'delivered');

      if (order.buyer_id) {
        void (async () => {
          try {
            const { enqueueOrderPush } = await import('@/lib/push-enqueue');
            const short = shortOrderId(order.id);
            // In-app notification — shows in bell immediately
            await notifyOrderDelivered(supabase, order.buyer_id, order.id, short);
            // Web push
            await enqueueOrderPush(supabase, { userId: order.buyer_id, orderId: order.id, event: 'order_delivered' });
          } catch { /* non-blocking */ }
        })();
      }
    }
  } else if (inTransitStatuses.includes(status) && currentStatus === 'shipped') {
    await supabase
      .from('orders')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', order.id);
  }
}

// ---------------------------------------------------------------------------
// transaction.created / transaction.updated handler
// ---------------------------------------------------------------------------

async function handleTransaction(
  supabase: SupabaseClient,
  data: Record<string, unknown>,
  fullEvent: Record<string, unknown>,
) {
  const transactionId = String(data.object_id ?? data.transaction_id ?? '').trim();
  if (!transactionId) return;

  const labelUrl = String(data.label_url ?? '').trim() || null;
  const trackingNumber = String(data.tracking_number ?? '').trim() || null;
  const status = String(data.status ?? '').trim().toUpperCase();
  const rateObj = (data.rate && typeof data.rate === 'object') ? data.rate as Record<string, unknown> : null;
  const amountStr = String(rateObj?.amount ?? data.amount ?? '').trim();
  const amountCents = amountStr ? Math.round(Number(amountStr) * 100) : null;

  // Always update shipping_label_purchases directly by shippo_transaction_id.
  // This covers both cron-based purchases (where label_job_id is set) and
  // direct agent purchases (where no label_jobs row exists at all).
  if (amountCents && amountCents > 0) {
    const purchaseUpdate: Record<string, unknown> = {
      label_amount_cents: amountCents,
      agent_charged_cents: amountCents,
    };
    if (labelUrl) purchaseUpdate.label_url = labelUrl;
    if (trackingNumber) purchaseUpdate.tracking_number = trackingNumber;
    await supabase
      .from('shipping_label_purchases')
      .update(purchaseUpdate)
      .eq('shippo_transaction_id', transactionId);
  }

  // Find label_job by shippo_transaction_id (only exists for cron-queued purchases).
  const { data: job } = await supabase
    .from('label_jobs')
    .select('id, order_id, status')
    .eq('shippo_transaction_id', transactionId)
    .maybeSingle();

  if (!job) return; // No label_jobs row — agent direct purchase, ledger already updated above.

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (labelUrl) updates.label_url = labelUrl;
  if (trackingNumber) updates.tracking_number = trackingNumber;
  if (amountCents && amountCents > 0) updates.agent_charged_cents = amountCents;
  if (status === 'SUCCESS') updates.status = 'succeeded';
  else if (status === 'ERROR') updates.status = 'failed';

  await supabase.from('label_jobs').update(updates).eq('id', job.id);

  // Also update shipping_label_purchases via label_job_id FK for the cron path.
  // (Already updated by shippo_transaction_id above — this ensures label_job_id linkage
  // is also reflected if the row was inserted without the FK set historically.)
  if (amountCents && amountCents > 0) {
    await supabase
      .from('shipping_label_purchases')
      .update({ label_amount_cents: amountCents, agent_charged_cents: amountCents })
      .eq('label_job_id', job.id);
  }
}
