// @ts-nocheck
/**
 * POST /api/webhooks/easypost  (also GET for portal liveness checks)
 *
 * Inbound receiver for EasyPost webhooks. This is the endpoint the admin
 * Shipping Settings page advertises ("POST /api/webhooks/easypost") and that
 * the operator registers in the EasyPost dashboard once the live key is
 * connected. EasyPost delivers Event objects:
 *
 *   {id: 'evt_...', object: 'Event', description: 'tracker.updated',
 *    mode: 'test'|'production', result: {...the updated object...}}
 *
 * Event families handled:
 *   - tracker.created /     -> append a shipping_tracking_events row and, when
 *     tracker.updated          the carrier reports delivered, stamp
 *                             orders.delivered_at + advance status to
 *                             'delivered' (state-machine guarded). Also keeps
 *                             orders.delivery_eta fresh from est_delivery_date.
 *   - refund.successful     -> mark the matching shipping_label_purchases row
 *                             refunded.
 *   - everything else       -> recorded for the audit trail, no state change.
 *
 * The per-event side effects live in lib/shipping-webhook.ts so the
 * shipping-webhook-retry cron reprocesses failed events through the exact
 * same code path.
 *
 * Security model (EasyPost's documented HMAC scheme):
 *   EasyPost signs each delivery with the webhook secret configured in their
 *   dashboard. Header:
 *     X-Hmac-Signature: hmac-sha256-hex=<hex(HMAC_SHA256(NFKD(secret), rawBody))>
 *   The secret is NFKD-normalized before use (per EasyPost docs). We verify
 *   with a constant-time compare. Resolution order for the expected secret:
 *     1. Active shipping_provider_credentials webhook secret (decrypted).
 *     2. EASYPOST_WEBHOOK_SECRET env var.
 *   Fail-closed: no secret configured -> 503 in production (accept-but-flag in
 *   dev so dashboard test pings work during setup); bad signature -> forensic
 *   shipping_webhook_events row + 401.
 *   Even a forged tracker event cannot touch an arbitrary order: updates only
 *   apply to an order whose stored tracking_number matches the payload.
 *
 * Idempotency: EasyPost events carry a natural id (evt_...), inserted into
 * shipping_webhook_events.event_id (UNIQUE). A duplicate delivery
 * short-circuits with 200. A missing id falls back to a sha256 hash of the
 * raw body.
 *
 * Timeliness: EasyPost expects a 2XX promptly and retries on failure. All
 * work here is a handful of indexed DB writes - no outbound EasyPost re-fetch
 * in the hot path - so it returns well inside the window. All writes use the
 * admin client (RLS bypass); these tables are otherwise admin-read-only.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { safeCompare } from '@/lib/shipping-crypto';
import { captureError } from '@/lib/sentry';
import { logError } from '@/lib/log';
import {
  resolveWebhookSecret,
  processShippingEvent,
  asRecord,
  asString,
} from '@/lib/shipping-webhook';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ---------------------------------------------------------------------------
// Verify the EasyPost HMAC signature. Returns true when the caller is
// authorised, false when a secret IS configured but the signature does not
// match. When no secret is configured we return false here and the call site
// treats it as accept-but-flag (dev) or 503 (production).
// ---------------------------------------------------------------------------
function verifySignature(req: NextRequest, rawBody: string, secret: string | null): boolean {
  if (!secret) return false;
  const sigHeader = req.headers.get('x-hmac-signature')?.trim() ?? '';
  if (!sigHeader) return false;

  // EasyPost NFKD-normalizes the secret before keying the HMAC.
  const normalizedSecret = secret.normalize('NFKD');
  const digest = crypto
    .createHmac('sha256', Buffer.from(normalizedSecret, 'utf8'))
    .update(rawBody, 'utf8')
    .digest('hex');
  const expected = `hmac-sha256-hex=${digest}`;
  return safeCompare(sigHeader, expected);
}

function fallbackEventId(rawBody: string): string {
  return 'sha256:' + crypto.createHash('sha256').update(rawBody, 'utf8').digest('hex').slice(0, 32);
}

// ---------------------------------------------------------------------------
// GET - liveness / portal probe. Never reveals config.
// ---------------------------------------------------------------------------
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: 'easypost-webhook' });
}

// ---------------------------------------------------------------------------
// POST - the actual receiver.
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  // Always read the raw body first (needed for the HMAC + JSON parse).
  const rawBody = await req.text().catch(() => '');

  let parsed: Record<string, unknown>;
  try {
    parsed = asRecord(JSON.parse(rawBody || '{}'));
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const description = asString(parsed.description) || 'unknown';
  const result = asRecord(parsed.result);

  const supabase = createAdminClient();
  const { secret, source } = await resolveWebhookSecret(supabase);

  const authorised = verifySignature(req, rawBody, secret);
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

  // A secret is configured but the signature does not verify -> reject (and
  // leave a forensic row). Without this, anyone could POST forged tracking.
  if (secret && !authorised) {
    await supabase
      .from('shipping_webhook_events')
      .insert({
        event_id: `rejected:${asString(parsed.id) || fallbackEventId(rawBody)}:${Date.now()}`,
        event_type: description,
        payload: parsed,
        provider: 'easypost',
        processing_error: 'signature_invalid',
      })
      .then(() => undefined, () => undefined);
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  // Idempotency: claim this event by its EasyPost event id (evt_...). A
  // duplicate delivery short-circuits.
  const eventId = asString(parsed.id) || fallbackEventId(rawBody);
  const { error: claimErr } = await supabase
    .from('shipping_webhook_events')
    .insert({ event_id: eventId, event_type: description, payload: parsed, provider: 'easypost' });
  if (claimErr) {
    // Unique violation => already processed; anything else is a genuine DB
    // failure. Returning 200 on a genuine failure permanently loses the
    // event (the retry cron only replays events that were RECORDED), so
    // return 500 to make EasyPost redeliver, and log/capture the failure.
    if ((claimErr as { code?: string }).code === '23505') {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    logError('webhooks.easypost.claim_insert', { eventId, description }, claimErr);
    captureError(claimErr, { context: 'webhooks.easypost.claim_insert', eventId });
    return NextResponse.json({ error: 'Event Could Not Be Recorded. Please Retry.' }, { status: 500 });
  }

  let processingError: string | null = null;
  let orderTouched: string | null = null;

  try {
    const processed = await processShippingEvent(supabase, description, result, parsed);
    orderTouched = processed.orderTouched;
  } catch (err) {
    processingError = err instanceof Error ? err.message.slice(0, 300) : 'processing_error';
    console.error('[easypost-webhook] processing error:', err);
  }

  await supabase
    .from('shipping_webhook_events')
    .update({ processed_at: new Date().toISOString(), processing_error: processingError })
    .eq('event_id', eventId)
    .then(() => undefined, () => undefined);

  // Always 2XX for an accepted event so EasyPost does not retry a payload we
  // have already durably recorded. Internal processing failures are captured
  // in shipping_webhook_events.processing_error and retried by the cron.
  // Response is intentionally minimal: EasyPost only needs a 2XX, and the
  // previous body leaked internal error text (processing_error) and secret
  // provenance (secret_source) to any caller who could reach the endpoint.
  // Full forensic detail is durably recorded in shipping_webhook_events.
  if (processingError) {
    captureError(new Error(processingError), { context: 'webhooks.easypost.processing', eventId, event: description, order: orderTouched });
  }
  return NextResponse.json({ ok: true, event: description });
}
