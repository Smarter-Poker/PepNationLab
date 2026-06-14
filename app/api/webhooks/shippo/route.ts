/**
 * POST /api/webhooks/shippo  (also GET for portal liveness checks)
 *
 * Inbound receiver for Shippo webhooks. This is the endpoint the admin
 * Shipping Settings page advertises ("POST /api/webhooks/shippo") and that
 * the operator registers in the Shippo API Portal once the live key is
 * connected. It ingests the three event families Shippo emits:
 *
 *   - track_updated         -> append a shipping_tracking_events row and, when
 *                              the carrier reports DELIVERED, stamp
 *                              orders.delivered_at + advance status to
 *                              'delivered' (state-machine guarded). Also keeps
 *                              orders.delivery_eta fresh.
 *   - transaction_created   -> backfill the real Shippo-charged amount
 *   - transaction_updated      (rate.amount -> shipping_label_purchases
 *                              .label_amount_cents) and tracking_url_provider.
 *   - batch_*               -> recorded for the audit trail, no state change.
 *
 * Security model (matches Shippo's documented model + this app's admin UI):
 *   Shippo does NOT HMAC-sign payloads. The portal-recommended approach is a
 *   shared secret carried in the webhook URL. So:
 *     1. The active platform_shippo_credentials webhook secret (decrypted) OR
 *        the SHIPPO_WEBHOOK_SECRET env var is the expected shared secret.
 *     2. The caller must present it as ?token=<secret> (constant-time compare).
 *        An "X-Shippo-Signature" / "Shippo-Signature" HMAC header is also
 *        accepted if present, for forward-compatibility.
 *     3. If no secret is configured at all, the receiver still accepts the
 *        event (so the portal "send test" works during setup) but records
 *        signature_valid = false so the gap is visible in the audit log.
 *   Even a forged track_updated cannot touch an arbitrary order: updates only
 *   apply to an order whose stored tracking_number matches the payload.
 *
 * Idempotency: Shippo payloads carry no event id, so a deterministic dedup key
 * is synthesised per event and inserted into shippo_webhook_events.event_id
 * (UNIQUE). A duplicate delivery short-circuits with 200.
 *
 * Timeliness: Shippo expects a 2XX within ~3s and retries on 5xx/timeout. All
 * work here is a handful of indexed DB writes - no outbound Shippo re-fetch in
 * the hot path - so it returns well inside the window. All writes use the
 * service-role client (RLS bypass); these tables are otherwise admin-read-only.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { decryptSecret, safeCompare } from '@/lib/shippo-crypto';
import { canTransition, type OrderStatus } from '@/lib/order-states';
import { enqueueOrderPush } from '@/lib/push-enqueue';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ---------------------------------------------------------------------------
// bytea coercion - Supabase/PostgREST can hand bytea back as a Buffer, a
// Uint8Array, a base64 string, or a "\\x.." hex string depending on transport.
// Normalise all of them so decryptSecret always receives real bytes.
// ---------------------------------------------------------------------------
function coerceBytea(input: unknown): Buffer | null {
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

interface WebhookSecretResult {
  secret: string | null;
  source: 'platform_db' | 'env' | 'none';
}

async function resolveWebhookSecret(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
): Promise<WebhookSecretResult> {
  // 1) Active platform credentials row (encrypted webhook secret).
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

  // 2) Env fallback.
  const env = process.env.SHIPPO_WEBHOOK_SECRET?.trim();
  if (env) return { secret: env, source: 'env' };

  return { secret: null, source: 'none' };
}

// ---------------------------------------------------------------------------
// Verify the shared secret. Returns true when the caller is authorised, false
// when a secret IS configured but the caller did not present a matching one.
// When no secret is configured we return false here and the call site treats
// it as accept-but-flag so setup-time test pings still succeed.
// ---------------------------------------------------------------------------
function verifyShared(req: NextRequest, rawBody: string, secret: string | null): boolean {
  if (!secret) return false;
  // URL token mode (Shippo's documented approach).
  const url = new URL(req.url);
  const token = url.searchParams.get('token') ?? url.searchParams.get('secret') ?? '';
  if (token && safeCompare(token, secret)) return true;

  // Optional HMAC header mode (forward-compat; Shippo does not send this today).
  const sigHeader =
    req.headers.get('x-shippo-signature') ??
    req.headers.get('shippo-signature') ??
    '';
  if (sigHeader) {
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const provided = sigHeader.replace(/^sha256=/i, '').trim();
    if (provided && safeCompare(provided, expected)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Helpers to read deeply/loosely-typed Shippo payloads.
// ---------------------------------------------------------------------------
function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}
function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/** Normalise a Shippo tracking status (string OR object) to its status code. */
function readTrackingStatus(data: Record<string, unknown>): {
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

function dedupKey(event: string, data: Record<string, unknown>): string {
  if (event === 'track_updated') {
    const ts = readTrackingStatus(data);
    return `track:${asString(data.tracking_number)}:${ts.status}:${ts.occurredAt ?? ''}`;
  }
  if (event === 'transaction_created' || event === 'transaction_updated') {
    return `${event}:${asString(data.object_id)}:${asString(data.object_updated)}`;
  }
  // Fallback: hash the whole data blob so even unknown events dedup.
  const h = crypto.createHash('sha256').update(JSON.stringify(data ?? {})).digest('hex').slice(0, 32);
  return `${event}:${h}`;
}

// ---------------------------------------------------------------------------
// GET - liveness / portal probe. Never reveals config.
// ---------------------------------------------------------------------------
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: 'shippo-webhook' });
}

// ---------------------------------------------------------------------------
// POST - the actual receiver.
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  // Always read the raw body first (needed for optional HMAC + JSON parse).
  const rawBody = await req.text().catch(() => '');

  let parsed: Record<string, unknown>;
  try {
    parsed = asRecord(JSON.parse(rawBody || '{}'));
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const event = asString(parsed.event) || 'unknown';
  const data = asRecord(parsed.data);

  const supabase = await createServiceClient();
  const { secret, source } = await resolveWebhookSecret(supabase);

  const authorised = verifyShared(req, rawBody, secret);
  const signatureValid = authorised; // true only when a secret matched

  // A secret is configured but the caller did not present it -> reject (and
  // leave a forensic row). Without this, anyone could POST forged tracking.
  if (secret && !authorised) {
    await supabase
      .from('shippo_webhook_events')
      .insert({
        event_id: `rejected:${dedupKey(event, data)}:${Date.now()}`,
        event_type: event,
        payload: parsed,
        processing_error: 'signature_invalid',
      })
      .then(() => undefined, () => undefined);
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  // Idempotency: claim this event. A duplicate delivery short-circuits.
  const eventId = dedupKey(event, data);
  const { error: claimErr } = await supabase
    .from('shippo_webhook_events')
    .insert({ event_id: eventId, event_type: event, payload: parsed });
  if (claimErr) {
    // Unique violation => already processed. Any other error => still 200 so
    // Shippo does not hammer us with retries for a transient DB blip; the miss
    // is recoverable via the weekly reconcile + manual tracking refresh.
    return NextResponse.json({ ok: true, duplicate: true });
  }

  let processingError: string | null = null;
  let orderTouched: string | null = null;

  try {
    if (event === 'track_updated') {
      orderTouched = await handleTrackUpdated(supabase, data, parsed);
    } else if (event === 'transaction_created' || event === 'transaction_updated') {
      orderTouched = await handleTransaction(supabase, data);
    }
    // batch_* and unknown events are recorded above; no state change needed.
  } catch (err) {
    processingError = err instanceof Error ? err.message.slice(0, 300) : 'processing_error';
    console.error('[shippo-webhook] processing error:', err);
  }

  await supabase
    .from('shippo_webhook_events')
    .update({ processed_at: new Date().toISOString(), processing_error: processingError })
    .eq('event_id', eventId)
    .then(() => undefined, () => undefined);

  // Always 2XX for an accepted event so Shippo does not retry a payload we have
  // already durably recorded. Internal processing failures are captured in
  // shippo_webhook_events.processing_error for follow-up.
  return NextResponse.json({
    ok: true,
    event,
    secret_source: source,
    signature_valid: signatureValid,
    order: orderTouched,
    processing_error: processingError,
  });
}

// ---------------------------------------------------------------------------
// track_updated handler
// ---------------------------------------------------------------------------
const DELIVERED_STATUSES = new Set(['DELIVERED']);

async function handleTrackUpdated(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
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
  // event-log level (already done) and ignored here.
  if (!orderId) return null;

  const occurredAt = ts.occurredAt ?? new Date().toISOString();

  // Append the tracking event (idempotency at the event level already handled).
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
// transaction_created / transaction_updated handler
// Backfills the real Shippo-charged amount + tracking_url_provider onto the
// label-purchase ledger row, keyed by the Shippo transaction object id.
// ---------------------------------------------------------------------------
async function handleTransaction(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
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
