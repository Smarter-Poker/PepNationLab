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
 * The per-event side effects live in lib/shippo-webhook.ts so the
 * shippo-webhook-retry cron reprocesses failed events through the exact same
 * code path.
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
 * admin client (RLS bypass); these tables are otherwise admin-read-only.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { safeCompare } from '@/lib/shippo-crypto';
import {
  resolveWebhookSecret,
  processShippoEvent,
  dedupKey,
  asRecord,
  asString,
} from '@/lib/shippo-webhook';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

  const supabase = createAdminClient();
  const { secret, source } = await resolveWebhookSecret(supabase);

  const authorised = verifyShared(req, rawBody, secret);
  const signatureValid = authorised; // true only when a secret matched

  // If no secret is configured at all, reject in production to prevent forged
  // tracking events from being accepted (fail-closed). The only exception is
  // during initial setup when NEXT_PUBLIC_VERCEL_ENV is not set or is 'development'.
  const isDev = !process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NEXT_PUBLIC_VERCEL_ENV === 'development';
  if (!secret) {
    if (!isDev) {
      // No secret configured in a live environment -> refuse; forces operator to configure the webhook secret.
      return NextResponse.json({ error: 'Webhook Secret Not Configured.' }, { status: 503 });
    }
    // Dev/setup mode: accept but flag as unverified so the audit log is honest.
  }

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
    // is recoverable via the shippo-webhook-retry cron.
    return NextResponse.json({ ok: true, duplicate: true });
  }

  let processingError: string | null = null;
  let orderTouched: string | null = null;

  try {
    const result = await processShippoEvent(supabase, event, data, parsed);
    orderTouched = result.orderTouched;
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
  // shippo_webhook_events.processing_error and retried by the cron.
  return NextResponse.json({
    ok: true,
    event,
    secret_source: source,
    signature_valid: signatureValid,
    order: orderTouched,
    processing_error: processingError,
  });
}
