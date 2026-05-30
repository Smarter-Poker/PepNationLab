/**
 * POST /api/webhooks/shippo
 *
 * Receives inbound Shippo platform events (track_updated, transaction.created, etc.)
 * and updates the corresponding order and label_job rows.
 *
 * Security:
 *   1. HMAC-SHA256 over the raw body using SHIPPO_WEBHOOK_SECRET.
 *   2. If SHIPPO_WEBHOOK_SECRET is not set, falls back to a URL token:
 *      ?token=<CRON_SECRET> (deprecated — set SHIPPO_WEBHOOK_SECRET asap).
 *
 * Idempotency: events are deduplicated by `event_id` via the
 * `shippo_webhook_events` table (UNIQUE on event_id). Duplicate calls
 * return 200 immediately.
 *
 * Supported event types:
 *   - track_updated            → update tracking on orders + label_jobs
 *   - transaction.created      → reconcile amountCents
 *   - transaction.updated      → update label_job status
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

function timingSafeCompare(a: string, b: string): boolean {
  try {
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    if (aBuf.length !== bBuf.length) return false;
    return crypto.timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}

function verifyHmacSignature(rawBody: string, header: string, secret: string): boolean {
  // Shippo sends: X-Shippo-Webhook-Signature: sha256=<hex>
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  return timingSafeCompare(header, expected);
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // --- Signature check ---
  const webhookSecret = process.env.SHIPPO_WEBHOOK_SECRET;
  const signatureHeader = req.headers.get('x-shippo-webhook-signature') ?? '';

  if (webhookSecret) {
    if (!signatureHeader || !verifyHmacSignature(rawBody, signatureHeader, webhookSecret)) {
      return NextResponse.json({ error: 'Invalid Signature.' }, { status: 401 });
    }
  } else {
    // Fallback: URL token mode (legacy until HMAC secret is provisioned).
    const cronSecret = process.env.CRON_SECRET;
    const urlToken = req.nextUrl.searchParams.get('token') ?? '';
    if (!cronSecret || !urlToken || !timingSafeCompare(urlToken, cronSecret)) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
  }

  // --- Parse body ---
  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const eventId = String(event.event_id ?? event.id ?? '').trim();
  const eventType = String(event.event ?? event.type ?? '').trim();
  const data = (event.data ?? {}) as Record<string, unknown>;

  if (!eventId || !eventType) {
    return NextResponse.json({ ok: true, reason: 'no_event_type_or_id' });
  }

  const supabase = await createServiceClient();

  // --- Deduplication ---
  const { error: insertErr } = await supabase
    .from('shippo_webhook_events')
    .insert({ event_id: eventId, event_type: eventType, payload: event });

  if (insertErr) {
    // 23505 = unique_violation — already processed.
    if (insertErr.code === '23505') {
      return NextResponse.json({ ok: true, reason: 'duplicate' });
    }
    // Other DB error — still return 200 so Shippo doesn't retry endlessly.
    console.error('[shippo-webhook] insert error:', insertErr.message);
    return NextResponse.json({ ok: true, reason: 'db_error' });
  }

  // --- Event handlers ---
  try {
    switch (eventType) {
      case 'track_updated':
        await handleTrackUpdated(supabase, data);
        break;
      case 'transaction.created':
      case 'transaction.updated':
        await handleTransaction(supabase, data);
        break;
      default:
        // Unknown event — log and acknowledge.
        break;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'handler_error';
    // Mark the event row as errored for observability.
    await supabase
      .from('shippo_webhook_events')
      .update({ processing_error: msg.slice(0, 500) })
      .eq('event_id', eventId);
    // Still return 200 — Shippo should not retry based on our handler failure.
    return NextResponse.json({ ok: true, reason: 'handler_error', error: msg.slice(0, 200) });
  }

  // Mark as processed.
  await supabase
    .from('shippo_webhook_events')
    .update({ processed_at: new Date().toISOString() })
    .eq('event_id', eventId);

  return NextResponse.json({ ok: true });
}

// ---------------------------------------------------------------------------
// track_updated handler
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleTrackUpdated(supabase: any, data: Record<string, unknown>) {
  const trackingNumber = String(data.tracking_number ?? '').trim();
  if (!trackingNumber) return;

  const status = String(data.tracking_status?.status ?? data.status ?? '').trim().toUpperCase();

  // Find the order by tracking number.
  const { data: order } = await supabase
    .from('orders')
    .select('id, status, buyer_id')
    .eq('tracking_number', trackingNumber)
    .maybeSingle();

  if (!order) return;

  // Map Shippo tracking status to order status.
  const deliveredStatuses = ['DELIVERED'];
  const inTransitStatuses = ['TRANSIT', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'];

  if (deliveredStatuses.includes(status) && order.status !== 'delivered') {
    await supabase
      .from('orders')
      .update({ status: 'delivered', updated_at: new Date().toISOString() })
      .eq('id', order.id);

    // Enqueue push notification.
    if (order.buyer_id) {
      try {
        const { enqueueOrderPush } = await import('@/lib/push-enqueue');
        await enqueueOrderPush(supabase, {
          userId: order.buyer_id,
          orderId: order.id,
          event: 'order_delivered',
        });
      } catch { /* non-blocking */ }
    }
  } else if (inTransitStatuses.includes(status) && order.status === 'shipped') {
    // No status change needed — order is already 'shipped'. Could log tracking events.
    await supabase
      .from('orders')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', order.id);
  }
}

// ---------------------------------------------------------------------------
// transaction.created / transaction.updated handler
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleTransaction(supabase: any, data: Record<string, unknown>) {
  const transactionId = String(data.object_id ?? data.transaction_id ?? '').trim();
  if (!transactionId) return;

  const labelUrl = String(data.label_url ?? '').trim() || null;
  const trackingNumber = String(data.tracking_number ?? '').trim() || null;
  const status = String(data.status ?? '').trim().toUpperCase();
  const amountStr = String(data.rate?.amount ?? data.amount ?? '').trim();
  const amountCents = amountStr ? Math.round(Number(amountStr) * 100) : null;

  // Find label_job by shippo_transaction_id.
  const { data: job } = await supabase
    .from('label_jobs')
    .select('id, order_id, status')
    .eq('shippo_transaction_id', transactionId)
    .maybeSingle();

  if (!job) return;

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (labelUrl) updates.label_url = labelUrl;
  if (trackingNumber) updates.tracking_number = trackingNumber;
  if (amountCents && amountCents > 0) updates.agent_charged_cents = amountCents;
  if (status === 'SUCCESS') updates.status = 'succeeded';
  else if (status === 'ERROR') updates.status = 'failed';

  await supabase.from('label_jobs').update(updates).eq('id', job.id);

  // Also update the shipping_label_purchases ledger row if amount changed.
  if (amountCents && amountCents > 0) {
    await supabase
      .from('shipping_label_purchases')
      .update({
        label_amount_cents: amountCents,
        agent_charged_cents: amountCents,
        label_url: labelUrl,
        tracking_number: trackingNumber,
      })
      .eq('label_job_id', job.id);
  }
}
