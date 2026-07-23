/**
 * Shared agent-owned ship transition.
 *
 * The platform no longer buys shipping labels for agents. Agents purchase
 * labels with their own carrier account (recommended tool: Pirate Ship, which
 * has no API) and paste the tracking number back into the portal - either one
 * order at a time (POST /api/agent/orders/ship) or as a CSV round trip
 * (POST /api/agent/shipping/import-tracking). Both routes funnel through
 * `shipOrderWithTracking` below so the transition and its side effects stay
 * identical:
 *
 *   1. Validate ownership (agent or parent super-agent), fulfillment method,
 *      status (approved_ship | in_fulfillment), and the tracking number.
 *   2. Atomically claim the order: tracking_number, carrier, status shipped,
 *      shipped_at (compare-and-swap on status so a double submit loses clean).
 *   3. Best-effort side effects, mirroring the retired label-purchase route:
 *      EasyPost tracker subscription (platform key, buyer-facing tracking
 *      only), buyer push/in-app notification, order timeline event, shipped
 *      email, and the order.shipped webhook. None of these can fail the ship.
 */

import { createServiceClient } from '@/lib/supabase/server';
import { pickOne } from '@/lib/relations';
import { subscribeTracking } from '@/lib/shipping';
import { shortOrderId } from '@/lib/push-enqueue';
import { enqueueWebhook, fetchOrderForWebhook } from '@/lib/webhook-dispatch';
import { notifyOrderShipped } from '@/lib/notify';
import { logOrderEvent } from '@/lib/order-events';
import { emailConfigured, sendOrderShippedEmail } from '@/lib/email';
import { detectCarrier, normalizeTracking, VALID_CARRIERS, type DetectedCarrier } from '@/lib/carrier-detect';

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

const SHIPPABLE_STATUSES = ['approved_ship', 'in_fulfillment'] as const;

export interface ShipWithTrackingInput {
  orderId: string;
  /** The authenticated agent performing the ship. */
  actorId: string;
  /** Raw tracking number as pasted / imported. */
  rawTracking: string;
  /** Optional carrier hint. Validated against the four supported carriers. */
  rawCarrier?: string | null;
  /**
   * When true (CSV import path) an order that already has a tracking number
   * is skipped instead of overwritten.
   */
  requireNoExistingTracking?: boolean;
}

export type ShipWithTrackingResult =
  | { ok: true; trackingNumber: string; carrier: DetectedCarrier }
  | { ok: false; status: number; error: string };

/** Map a user/CSV-supplied carrier string onto a supported carrier, if any. */
export function normalizeCarrierInput(raw: string | null | undefined): DetectedCarrier | null {
  const cleaned = String(raw ?? '').trim().replace(/[\s_-]+/g, '').toUpperCase();
  if (!cleaned) return null;
  for (const c of VALID_CARRIERS) {
    if (c.toUpperCase() === cleaned) return c;
  }
  if (cleaned === 'DHL') return 'DHLExpress';
  return null;
}

export async function shipOrderWithTracking(
  supabase: ServiceClient,
  input: ShipWithTrackingInput,
): Promise<ShipWithTrackingResult> {
  const { orderId, actorId, requireNoExistingTracking } = input;

  const tracking = normalizeTracking(input.rawTracking);
  if (tracking.length < 8 || tracking.length > 40 || !/^[A-Z0-9]+$/.test(tracking)) {
    return { ok: false, status: 400, error: 'Tracking Number Must Be 8 To 40 Letters And Digits.' };
  }

  // Carrier: explicit (validated) value wins; otherwise detect from the
  // number shape; USPS is the fallback (the overwhelmingly common carrier
  // on Pirate Ship labels).
  const explicitCarrier = normalizeCarrierInput(input.rawCarrier);
  if (input.rawCarrier && String(input.rawCarrier).trim() && !explicitCarrier) {
    return { ok: false, status: 400, error: 'Carrier Must Be USPS, UPS, FedEx, Or DHL Express.' };
  }
  const carrier: DetectedCarrier = explicitCarrier ?? detectCarrier(tracking) ?? 'USPS';

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, buyer_id, agent_id, status, fulfillment_method, tracking_number, profiles!orders_agent_id_fkey(parent_agent_id)')
    .eq('id', orderId)
    .maybeSingle();

  if (orderError || !order) return { ok: false, status: 404, error: 'Order Not Found' };

  const orderAgentProfile = pickOne<{ parent_agent_id: string | null }>(order.profiles);
  if (order.agent_id !== actorId && orderAgentProfile?.parent_agent_id !== actorId) {
    return { ok: false, status: 403, error: 'Unauthorized To Ship This Order' };
  }

  if (order.fulfillment_method !== 'ship') {
    return { ok: false, status: 409, error: 'Pickup Orders Do Not Ship. Mark Them Delivered At Handoff Instead.' };
  }
  if (!SHIPPABLE_STATUSES.includes(order.status as (typeof SHIPPABLE_STATUSES)[number])) {
    return {
      ok: false,
      status: 409,
      error: 'This Order Is Not Ready To Ship. Pending Orders Need Admin Approval First; Only Approved Ship Or In Fulfillment Orders Can Be Marked Shipped.',
    };
  }
  if (requireNoExistingTracking && order.tracking_number) {
    return { ok: false, status: 409, error: 'Order Already Has A Tracking Number.' };
  }

  // Atomic claim: the .in('status', ...) compare-and-swap means exactly one
  // concurrent submit wins the shipped transition.
  const nowIso = new Date().toISOString();
  const { data: claimed, error: updateError } = await supabase
    .from('orders')
    .update({
      tracking_number: tracking,
      carrier,
      status: 'shipped',
      shipped_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', orderId)
    .in('status', [...SHIPPABLE_STATUSES])
    .select('id');

  if (updateError) {
    console.error('[agent-ship] failed to mark order shipped:', updateError.message, { orderId });
    return { ok: false, status: 500, error: 'Failed To Update Order. Please Try Again.' };
  }
  if (!claimed || claimed.length === 0) {
    return { ok: false, status: 409, error: 'Order Was Already Processed. Please Refresh To See Its Current Status.' };
  }

  // ------------------------------------------------------------------
  // Best-effort side effects - none may fail the ship.
  // ------------------------------------------------------------------

  // Subscribe a platform EasyPost tracker so the researcher order page gets
  // live shipping_tracking_events for the pasted number.
  try {
    await subscribeTracking(tracking, carrier);
  } catch { /* tracker subscription must not break shipping */ }

  if (order.buyer_id) {
    try {
      const short = shortOrderId(orderId);
      await notifyOrderShipped(supabase, order.buyer_id, orderId, short, tracking);
    } catch { /* notification failures must not break shipping */ }

    try {
      await logOrderEvent(supabase, {
        orderId,
        event: 'shipped',
        actorId,
        actorRole: 'agent',
        payload: { tracking_number: tracking, carrier, via: 'agent_tracking' },
      });
    } catch { /* timeline must not break shipping */ }

    try {
      if (emailConfigured()) {
        const { data: buyer } = await supabase
          .from('profiles')
          .select('full_name, contact_email, email_verified')
          .eq('id', order.buyer_id)
          .maybeSingle();
        if (buyer?.contact_email && buyer.email_verified) {
          await sendOrderShippedEmail({
            to: buyer.contact_email,
            fullName: buyer.full_name,
            orderId,
            trackingNumber: tracking,
          });
        }
      }
    } catch { /* email failures must not break shipping */ }
  }

  try {
    const orderPayload = await fetchOrderForWebhook(supabase, orderId);
    if (orderPayload) {
      await enqueueWebhook(supabase, {
        event: 'order.shipped',
        agentId: (orderPayload as { agent_id?: string | null }).agent_id ?? null,
        payload: { order: orderPayload },
        relatedOrderId: orderId,
      });
    }
  } catch { /* webhook errors must not break shipping */ }

  return { ok: true, trackingNumber: tracking, carrier };
}
