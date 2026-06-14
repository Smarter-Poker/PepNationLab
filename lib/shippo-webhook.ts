/**
 * lib/shippo-webhook.ts
 *
 * Shared processing core for inbound Shippo webhooks. Extracted from the
 * route handler so two callers can use the exact same logic:
 *
 *   - app/api/webhooks/shippo/route.ts        - the live receiver (real-time).
 *   - app/api/cron/shippo-webhook-retry       - reprocesses events whose first
 *                                               processing attempt failed.
 *
 * Keeping this in one module guarantees a retried event takes precisely the
 * same code path as a fresh delivery. All functions operate on the Supabase
 * service-role client passed in; they perform no auth of their own - the route
 * does shared-secret verification before dispatch.
 *
 * Event families handled (see Shippo docs):
 *   - track_updated         -> shipping_tracking_events row + guarded
 *                              orders.delivered_at / status='delivered' +
 *                              orders.delivery_eta refresh.
 *   - transaction_created   -> backfill shipping_label_purchases
 *   - transaction_updated      .label_amount_cents (real charged amount) and
 *                              tracking_url_provider.
 *   - batch_* / unknown     -> recorded by the caller; no state change.
 */

import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptSecret } from '@/lib/shippo-crypto';
import { canTransition, type OrderStatus } from '@/lib/order-states';
import { enqueueOrderPush } from '@/lib/push-enqueue';

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
 * Resolve the expected shared webhook secret: active platform credentials row
 * (encrypted) first, then the SHIPPO_WEBHOOK_SECRET env var.
 */
export async function resolveWebhookSecret(
  supabase: SupabaseClient,
): Promise<WebhookSecretResult> {
  try {
    const { data: row } = await supabase
      .from('platform_shippo_credentials')
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
    console.warn('[shippo-webhook] secret decrypt failed; falling through:', err);
  }

  const env = process.env.SHIPPO_WEBHOOK_SECRET?.trim();
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

/** Normalise a Shippo tracking status (string OR object) to its status code. */
export function readTrackingStatus(data: Record<string, unknown>): {
  status: string;
  substatus: string | null;
  details: string | null;
  occurredAt: string | null;
  location: Record<string, unknown> | null;
} {
  const ts = data.tracking_status;
  if (typeof ts === 'string') {
    return { status: ts.toUpperCase(), substatus: null, details: null, occurredAt: null, location: null };
  }
  const o = asRecord(ts);
  const sub = asRecord(o.substatus);
  return {
    status: asString(o.status).toUpperCase() || 'UNKNOWN',
    substatus: asString(sub.code) || null,
    details: asString(o.status_details) || null,
    occurredAt: asString(o.status_date) || null,
    location: o.location && typeof o.location === 'object' ? (o.location as Record<string, unknown>) : null,
  };
}

/** Deterministic dedup key - Shippo payloads carry no event id. */
export function dedupKey(event: string, data: Record<string, unknown>): string {
  if (event === 'track_updated') {
    const ts = readTrackingStatus(data);
    return `track:${asString(data.tracking_number)}:${ts.status}:${ts.occurredAt ?? ''}`;
  }
  if (event === 'transaction_created' || event === 'transaction_updated') {
    return `${event}:${asString(data.object_id)}:${asString(data.object_updated)}`;
  }
  const h = createHash('sha256').update(JSON.stringify(data ?? {})).digest('hex').slice(0, 32);
  return `${event}:${h}`;
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------
export interface ProcessResult {
  orderTouched: string | null;
}

/**
 * Apply the side effects of a single Shippo event. Throws on a hard failure so
 * the caller can record processing_error and (for the cron) retry later. The
 * caller is responsible for dedup/event-log bookkeeping.
 */
export async function processShippoEvent(
  supabase: SupabaseClient,
  event: string,
  data: Record<string, unknown>,
  rawPayload: Record<string, unknown>,
): Promise<ProcessResult> {
  if (event === 'track_updated') {
    return { orderTouched: await handleTrackUpdated(supabase, data, rawPayload) };
  }
  if (event === 'transaction_created' || event === 'transaction_updated') {
    return { orderTouched: await handleTransaction(supabase, data) };
  }
  return { orderTouched: null };
}

// ---------------------------------------------------------------------------
// track_updated
// ---------------------------------------------------------------------------
const DELIVERED_STATUSES = new Set(['DELIVERED']);

export async function handleTrackUpdated(
  supabase: SupabaseClient,
  data: Record<string, unknown>,
  rawPayload: Record<string, unknown>,
): Promise<string | null> {
  const trackingNumber = asString(data.tracking_number);
  if (!trackingNumber) return null;
  const carrier = asString(data.carrier) || null;
  const eta = asString(data.eta) || null;
  const ts = readTrackingStatus(data);

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

  const occurredAt = ts.occurredAt ?? new Date().toISOString();

  // Append the tracking event. Idempotency at the event level is handled by
  // the caller (shippo_webhook_events.event_id). Guard against a duplicate
  // timeline row when a retry re-applies the same status.
  const { data: dupe } = await supabase
    .from('shipping_tracking_events')
    .select('id')
    .eq('order_id', orderId)
    .eq('tracking_number', trackingNumber)
    .eq('status', ts.status)
    .eq('occurred_at', occurredAt)
    .limit(1)
    .maybeSingle();

  if (!dupe) {
    await supabase.from('shipping_tracking_events').insert({
      order_id: orderId,
      tracking_number: trackingNumber,
      carrier,
      status: ts.status,
      substatus: ts.substatus,
      status_details: ts.details,
      location: ts.location,
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
  if (DELIVERED_STATUSES.has(ts.status) && !orderRow.delivered_at) {
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
  }

  return orderId;
}

// ---------------------------------------------------------------------------
// transaction_created / transaction_updated
// ---------------------------------------------------------------------------
export async function handleTransaction(
  supabase: SupabaseClient,
  data: Record<string, unknown>,
): Promise<string | null> {
  const txId = asString(data.object_id);
  if (!txId) return null;

  const rate = asRecord(data.rate);
  const amountStr = asString(rate.amount);
  const amountCents = amountStr ? Math.round(parseFloat(amountStr) * 100) : null;
  const trackingUrl = asString(data.tracking_url_provider) || null;

  const patch: Record<string, unknown> = {};
  if (amountCents != null && Number.isFinite(amountCents) && amountCents >= 0) {
    patch.label_amount_cents = amountCents;
  }
  if (trackingUrl) patch.tracking_url_provider = trackingUrl;
  if (Object.keys(patch).length === 0) return null;

  const { data: updated } = await supabase
    .from('shipping_label_purchases')
    .update(patch)
    .eq('shippo_transaction_id', txId)
    .select('order_id')
    .maybeSingle();

  return (updated?.order_id as string | null) ?? null;
}
