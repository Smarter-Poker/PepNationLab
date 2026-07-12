/**
 * lib/shipping-webhook.ts
 *
 * Shared processing core for inbound EasyPost webhooks. Extracted from the
 * route handler so two callers can use the exact same logic:
 *
 *   - app/api/webhooks/easypost/route.ts        - the live receiver (real-time).
 *   - app/api/cron/shipping-webhook-retry       - reprocesses events whose
 *                                                 first processing attempt failed.
 *
 * Keeping this in one module guarantees a retried event takes precisely the
 * same code path as a fresh delivery. All functions operate on the Supabase
 * service-role client passed in; they perform no auth of their own - the route
 * does HMAC signature verification before dispatch.
 *
 * EasyPost delivers an Event object:
 *   {id: 'evt_...', object: 'Event', description: 'tracker.updated',
 *    mode: 'test'|'production', result: {...the updated object...}}
 *
 * Event families handled:
 *   - tracker.created /      -> result is a Tracker. Append a
 *     tracker.updated           shipping_tracking_events row and, when the
 *                              carrier reports delivered, stamp
 *                              orders.delivered_at + advance status to
 *                              'delivered' (state-machine guarded). Also keeps
 *                              orders.delivery_eta fresh from est_delivery_date.
 *   - refund.successful      -> result is a Refund. Mark the matching
 *                              shipping_label_purchases row refunded.
 *   - everything else        -> recorded by the caller; no state change.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptSecret } from '@/lib/shipping-crypto';
import { canTransition, type OrderStatus } from '@/lib/order-states';
import { enqueueOrderPush } from '@/lib/push-enqueue';
import { emailConfigured, sendOrderDeliveredEmail } from '@/lib/email';

// ---------------------------------------------------------------------------
// bytea coercion - Supabase/PostgREST can hand bytea back as a Buffer, a
// Uint8Array, a base64 string, or a "\\x.." hex string depending on transport.
// Normalise all of them so decryptSecret always receives real bytes.
// ---------------------------------------------------------------------------
export function coerceBytea(input: unknown): Buffer | null {
  if (input == null) return null;
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof Uint8Array) return Buffer.from(input);
  if (typeof input === 'string') {
    if (input.startsWith('\\x')) return Buffer.from(input.slice(2), 'hex');
    if (input.startsWith('0x')) return Buffer.from(input.slice(2), 'hex');
    return Buffer.from(input, 'base64');
  }
  return null;
}

export interface WebhookSecretResult {
  secret: string | null;
  source: 'platform_db' | 'env' | 'none';
}

/**
 * Resolve the expected webhook signing secret: active platform credentials row
 * (encrypted) first, then the EASYPOST_WEBHOOK_SECRET env var.
 */
export async function resolveWebhookSecret(
  supabase: SupabaseClient,
): Promise<WebhookSecretResult> {
  try {
    const { data: row } = await supabase
      .from('shipping_provider_credentials')
      .select('webhook_secret_ciphertext, webhook_secret_iv, webhook_secret_tag')
      .eq('is_active', true)
      .maybeSingle();
    const ct = coerceBytea(row?.webhook_secret_ciphertext);
    const iv = coerceBytea(row?.webhook_secret_iv);
    const tag = coerceBytea(row?.webhook_secret_tag);
    if (ct && iv && tag) {
      const plaintext = decryptSecret({ ciphertext: ct, iv, tag });
      if (plaintext) return { secret: plaintext, source: 'platform_db' };
    }
  } catch (err) {
    console.warn('[shipping-webhook] secret decrypt failed; falling through:', err);
  }

  const env = process.env.EASYPOST_WEBHOOK_SECRET?.trim();
  if (env) return { secret: env, source: 'env' };

  return { secret: null, source: 'none' };
}

// ---------------------------------------------------------------------------
// Loose payload readers
// ---------------------------------------------------------------------------
export function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}
export function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

// ---------------------------------------------------------------------------
// Tracker payload readers
// ---------------------------------------------------------------------------

interface NewestDetail {
  message: string | null;
  occurredAt: string | null;
  location: Record<string, unknown> | null;
}

/**
 * Pick the newest entry from an EasyPost tracker's tracking_details array
 * (greatest `datetime`; ISO strings compare lexicographically).
 */
export function newestTrackingDetail(result: Record<string, unknown>): NewestDetail {
  const details = Array.isArray(result.tracking_details) ? result.tracking_details : [];
  let newest: Record<string, unknown> | null = null;
  for (const d of details) {
    const rec = asRecord(d);
    if (!newest || asString(rec.datetime) >= asString(newest.datetime)) newest = rec;
  }
  if (!newest) return { message: null, occurredAt: null, location: null };
  const loc = newest.tracking_location;
  return {
    message: asString(newest.message) || null,
    occurredAt: asString(newest.datetime) || null,
    location: loc && typeof loc === 'object' ? (loc as Record<string, unknown>) : null,
  };
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------
export interface ProcessResult {
  orderTouched: string | null;
}

/**
 * Apply the side effects of a single EasyPost event. Throws on a hard failure
 * so the caller can record processing_error and (for the cron) retry later.
 * The caller is responsible for dedup/event-log bookkeeping.
 *
 * `description` is the EasyPost Event.description (e.g. 'tracker.updated');
 * `result` is the Event.result object.
 */
export async function processShippingEvent(
  supabase: SupabaseClient,
  description: string,
  result: Record<string, unknown>,
  rawPayload: Record<string, unknown>,
): Promise<ProcessResult> {
  if (description === 'tracker.created' || description === 'tracker.updated') {
    return { orderTouched: await handleTrackerEvent(supabase, result, rawPayload) };
  }
  if (description === 'refund.successful') {
    return { orderTouched: await handleRefundSuccessful(supabase, result) };
  }
  return { orderTouched: null };
}

// ---------------------------------------------------------------------------
// tracker.created / tracker.updated
// ---------------------------------------------------------------------------
const DELIVERED_STATUSES = new Set(['DELIVERED']);

export async function handleTrackerEvent(
  supabase: SupabaseClient,
  result: Record<string, unknown>,
  rawPayload: Record<string, unknown>,
): Promise<string | null> {
  const trackingNumber = asString(result.tracking_code);
  if (!trackingNumber) return null;
  const carrier = asString(result.carrier) || null;
  const eta = asString(result.est_delivery_date) || null;

  // EasyPost tracker statuses are lowercase snake_case
  // ('in_transit', 'out_for_delivery', ...). Store UPPERCASE.
  const status = (asString(result.status) || 'unknown').toUpperCase();
  const substatus = asString(result.status_detail) || null;
  const newest = newestTrackingDetail(result);

  // Resolve the order from the tracking number. Prefer the label-purchase
  // ledger (authoritative), fall back to orders.tracking_number.
  let orderId: string | null = null;

  const { data: purchase } = await supabase
    .from('shipping_label_purchases')
    .select('order_id')
    .eq('tracking_number', trackingNumber)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (purchase?.order_id) orderId = purchase.order_id as string;

  if (!orderId) {
    const { data: order } = await supabase
      .from('orders')
      .select('id')
      .eq('tracking_number', trackingNumber)
      .limit(1)
      .maybeSingle();
    if (order?.id) orderId = order.id as string;
  }

  // Forgery guard: only mutate an order we can tie to a tracking number we
  // actually issued. Unknown tracking numbers are recorded only at the
  // event-log level (handled by the caller) and ignored here.
  if (!orderId) return null;

  const occurredAt = newest.occurredAt ?? new Date().toISOString();

  // Append the tracking event. Idempotency at the event level is handled by
  // the caller (shipping_webhook_events.event_id). Guard against a duplicate
  // timeline row when a retry re-applies the same status.
  const { data: dupe } = await supabase
    .from('shipping_tracking_events')
    .select('id')
    .eq('order_id', orderId)
    .eq('tracking_number', trackingNumber)
    .eq('status', status)
    .eq('occurred_at', occurredAt)
    .limit(1)
    .maybeSingle();

  if (!dupe) {
    await supabase.from('shipping_tracking_events').insert({
      order_id: orderId,
      tracking_number: trackingNumber,
      carrier,
      status,
      substatus,
      status_details: newest.message,
      location: newest.location,
      occurred_at: occurredAt,
      raw_payload: rawPayload,
    });
  }

  // Load order state for a guarded transition.
  const { data: orderRow } = await supabase
    .from('orders')
    .select('id, status, buyer_id, delivered_at')
    .eq('id', orderId)
    .maybeSingle();
  if (!orderRow) return orderId;
  const currentStatus = orderRow.status as OrderStatus;
  const buyerId = (orderRow.buyer_id as string | null) ?? null;

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (eta) update.delivery_eta = eta;

  let justDelivered = false;
  if (DELIVERED_STATUSES.has(status) && !orderRow.delivered_at) {
    update.delivered_at = occurredAt;
    if (canTransition(currentStatus, 'delivered', 'admin')) {
      update.status = 'delivered';
      justDelivered = true;
    }
  }

  await supabase.from('orders').update(update).eq('id', orderId);

  // Best-effort delivery push (single insert, stays within the time budget).
  if (justDelivered && buyerId) {
    try {
      await enqueueOrderPush(supabase, {
        userId: buyerId,
        orderId,
        event: 'order_delivered',
        tracking: trackingNumber,
      });
    } catch {
      /* notifications must not break webhook ack */
    }

    // Delivered email on the PRIMARY delivery path. The carrier webhook is
    // what marks orders delivered in production; once it has transitioned the
    // order, the admin route's delivered email is unreachable, so it must be
    // sent from here. Verified contact email only; never breaks the ack.
    try {
      if (emailConfigured()) {
        const { data: buyer } = await supabase
          .from('profiles')
          .select('contact_email, email_verified, full_name')
          .eq('id', buyerId)
          .maybeSingle();
        if (buyer?.contact_email && buyer.email_verified) {
          await sendOrderDeliveredEmail({
            to: buyer.contact_email,
            fullName: buyer.full_name,
            orderId,
          });
        }
      }
    } catch {
      /* email failures must not break webhook ack */
    }
  }

  return orderId;
}

// ---------------------------------------------------------------------------
// refund.successful
// ---------------------------------------------------------------------------

/**
 * result is an EasyPost Refund: {tracking_code, shipment_id, status, ...}.
 * Mark the matching shipping_label_purchases row refunded. Match by
 * provider_transaction_id (= EasyPost shipment id) first, then fall back to
 * the tracking number.
 */
export async function handleRefundSuccessful(
  supabase: SupabaseClient,
  result: Record<string, unknown>,
): Promise<string | null> {
  const shipmentId = asString(result.shipment_id);
  const trackingCode = asString(result.tracking_code);
  if (!shipmentId && !trackingCode) return null;

  const patch = { refunded: true, refunded_at: new Date().toISOString() };

  if (shipmentId) {
    const { data: rows } = await supabase
      .from('shipping_label_purchases')
      .update(patch)
      .eq('provider_transaction_id', shipmentId)
      .eq('refunded', false)
      .select('order_id');
    if (rows && rows.length > 0) {
      return (rows[0].order_id as string | null) ?? null;
    }
  }

  if (trackingCode) {
    const { data: rows } = await supabase
      .from('shipping_label_purchases')
      .update(patch)
      .eq('tracking_number', trackingCode)
      .eq('refunded', false)
      .select('order_id');
    if (rows && rows.length > 0) {
      return (rows[0].order_id as string | null) ?? null;
    }
  }

  return null;
}
