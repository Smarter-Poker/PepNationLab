import type { SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export type WebhookEventType =
  | 'order.created'
  | 'order.approved'
  | 'order.shipped'
  | 'order.delivered'
  | 'order.cancelled'
  | 'order.refunded'
  | 'rma.created'
  | 'rma.resolved'
  | 'subscription.run'
  | 'price.changed'
  | 'webhook.test';

const MAX_ATTEMPTS = 6;
const BACKOFF_BASE_MS = 5 * 60 * 1000; // 5 minutes
const DELIVERY_TIMEOUT_MS = 10_000;

interface EndpointRow {
  id: string;
  owner_type: 'admin' | 'agent';
  owner_id: string | null;
  url: string;
  secret: string;
  event_types: string[];
  is_active: boolean;
  failure_count: number;
}

interface DeliveryRow {
  id: string;
  endpoint_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  attempts: number;
  status: string;
}

export interface EnqueueWebhookArgs {
  event: WebhookEventType;
  agentId?: string | null;
  payload: Record<string, unknown>;
  relatedOrderId?: string | null;
}

/**
 * Enqueue a webhook event to every admin endpoint that subscribes plus the
 * specific agent's endpoints that subscribe to this event type. Best-effort:
 * never throws — webhook side-effects must not break the caller.
 *
 * Returns the count of delivery rows inserted.
 */
export async function enqueueWebhook(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  { event, agentId, payload, relatedOrderId }: EnqueueWebhookArgs
): Promise<number> {
  try {
    let query = supabase
      .from('webhook_endpoints')
      .select('id, owner_type, owner_id, event_types, is_active')
      .eq('is_active', true);

    if (agentId) {
      query = query.or(`owner_type.eq.admin,and(owner_type.eq.agent,owner_id.eq.${agentId})`);
    } else {
      query = query.eq('owner_type', 'admin');
    }

    const { data: endpoints, error } = await query;
    if (error || !endpoints || endpoints.length === 0) return 0;

    const matching = endpoints.filter((e) => {
      const types = Array.isArray(e.event_types) ? e.event_types : [];
      return types.includes(event);
    });
    if (matching.length === 0) return 0;

    const rows = matching.map((e) => ({
      endpoint_id: e.id,
      event_type: event,
      payload,
      related_order_id: relatedOrderId ?? null,
      status: 'pending',
    }));

    const { data: inserted, error: insertError } = await supabase
      .from('webhook_deliveries')
      .insert(rows)
      .select('id');

    if (insertError) return 0;
    return Array.isArray(inserted) ? inserted.length : 0;
  } catch {
    // Webhook side-effects must never bubble up.
    return 0;
  }
}

/**
 * HMAC-SHA-256 signature in the `sha256=<hex>` format Stripe-style consumers
 * expect. Signs over the exact JSON body that will be POSTed.
 */
export function signPayload(secret: string, bodyJson: string): string {
  const h = crypto.createHmac('sha256', secret);
  h.update(bodyJson);
  return `sha256=${h.digest('hex')}`;
}

export interface DeliverWebhookResult {
  ok: boolean;
  statusCode?: number;
  expired?: boolean;
}

/**
 * Deliver a single pending webhook. Loads the row + endpoint, signs the body,
 * POSTs with a 10-second timeout, and updates status / attempts / backoff.
 * Never throws — returns { ok: false } on transport failure.
 */
export async function deliverWebhook(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  deliveryId: string
): Promise<DeliverWebhookResult> {
  try {
    const { data: delivery, error: dErr } = await supabase
      .from('webhook_deliveries')
      .select('id, endpoint_id, event_type, payload, attempts, status')
      .eq('id', deliveryId)
      .single();

    if (dErr || !delivery) return { ok: false };
    if ((delivery as DeliveryRow).status !== 'pending') {
      return { ok: false };
    }

    const { data: endpoint, error: eErr } = await supabase
      .from('webhook_endpoints')
      .select('id, owner_type, owner_id, url, secret, event_types, is_active, failure_count')
      .eq('id', (delivery as DeliveryRow).endpoint_id)
      .single();

    if (eErr || !endpoint) {
      await supabase
        .from('webhook_deliveries')
        .update({
          status: 'failed',
          last_response_body: 'endpoint_missing',
          last_attempted_at: new Date().toISOString(),
        })
        .eq('id', deliveryId);
      return { ok: false };
    }

    const ep = endpoint as EndpointRow;
    if (!ep.is_active) {
      await supabase
        .from('webhook_deliveries')
        .update({
          status: 'failed',
          last_response_body: 'endpoint_disabled',
          last_attempted_at: new Date().toISOString(),
        })
        .eq('id', deliveryId);
      return { ok: false };
    }

    const d = delivery as DeliveryRow;
    const bodyObj = {
      id: d.id,
      event: d.event_type,
      created_at: new Date().toISOString(),
      payload: d.payload ?? {},
    };
    const bodyJson = JSON.stringify(bodyObj);
    const signature = signPayload(ep.secret, bodyJson);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

    let statusCode: number | null = null;
    let responseBody = '';
    let networkErr: string | null = null;

    try {
      const res = await fetch(ep.url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-PNL-Event': d.event_type,
          'X-PNL-Delivery': d.id,
          'X-PNL-Signature': signature,
          'User-Agent': 'PepNationLab-Webhooks/1.0',
        },
        body: bodyJson,
      });
      statusCode = res.status;
      try {
        const text = await res.text();
        responseBody = text.slice(0, 2000);
      } catch {
        responseBody = '';
      }
    } catch (err) {
      networkErr = err instanceof Error ? err.message.slice(0, 500) : 'network_error';
    } finally {
      clearTimeout(timer);
    }

    const nowIso = new Date().toISOString();
    const nextAttempts = (d.attempts || 0) + 1;

    if (statusCode !== null && statusCode >= 200 && statusCode < 300) {
      await supabase
        .from('webhook_deliveries')
        .update({
          status: 'sent',
          attempts: nextAttempts,
          delivered_at: nowIso,
          last_status_code: statusCode,
          last_response_body: responseBody || null,
          last_attempted_at: nowIso,
        })
        .eq('id', deliveryId);
      await supabase
        .from('webhook_endpoints')
        .update({
          last_success_at: nowIso,
          failure_count: 0,
          last_failure_reason: null,
          updated_at: nowIso,
        })
        .eq('id', ep.id);
      return { ok: true, statusCode };
    }

    // Non-2xx OR network error.
    const isNetwork = networkErr !== null;
    const is4xx = statusCode !== null && statusCode >= 400 && statusCode < 500;
    const failureReason = isNetwork
      ? `network: ${networkErr}`
      : `http_${statusCode ?? 0}`;

    if (is4xx) {
      // Permanent failure — endpoint is configured wrong or rejected the call.
      await supabase
        .from('webhook_deliveries')
        .update({
          status: 'failed',
          attempts: nextAttempts,
          last_status_code: statusCode,
          last_response_body: (responseBody || failureReason).slice(0, 2000),
          last_attempted_at: nowIso,
        })
        .eq('id', deliveryId);
      await supabase
        .from('webhook_endpoints')
        .update({
          failure_count: (ep.failure_count || 0) + 1,
          last_failure_at: nowIso,
          last_failure_reason: failureReason.slice(0, 500),
          updated_at: nowIso,
        })
        .eq('id', ep.id);
      return { ok: false, statusCode: statusCode ?? undefined };
    }

    // 5xx or network: retry with exponential backoff up to MAX_ATTEMPTS.
    if (nextAttempts >= MAX_ATTEMPTS) {
      await supabase
        .from('webhook_deliveries')
        .update({
          status: 'expired',
          attempts: nextAttempts,
          last_status_code: statusCode,
          last_response_body: (responseBody || failureReason).slice(0, 2000),
          last_attempted_at: nowIso,
        })
        .eq('id', deliveryId);
      await supabase
        .from('webhook_endpoints')
        .update({
          failure_count: (ep.failure_count || 0) + 1,
          last_failure_at: nowIso,
          last_failure_reason: failureReason.slice(0, 500),
          updated_at: nowIso,
        })
        .eq('id', ep.id);
      return { ok: false, statusCode: statusCode ?? undefined, expired: true };
    }

    const backoffMs = BACKOFF_BASE_MS * Math.pow(2, nextAttempts - 1);
    const nextAttemptAt = new Date(Date.now() + backoffMs).toISOString();
    await supabase
      .from('webhook_deliveries')
      .update({
        status: 'pending',
        attempts: nextAttempts,
        next_attempt_at: nextAttemptAt,
        last_status_code: statusCode,
        last_response_body: (responseBody || failureReason).slice(0, 2000),
        last_attempted_at: nowIso,
      })
      .eq('id', deliveryId);
    await supabase
      .from('webhook_endpoints')
      .update({
        failure_count: (ep.failure_count || 0) + 1,
        last_failure_at: nowIso,
        last_failure_reason: failureReason.slice(0, 500),
        updated_at: nowIso,
      })
      .eq('id', ep.id);

    return { ok: false, statusCode: statusCode ?? undefined };
  } catch {
    return { ok: false };
  }
}

/**
 * Helper to re-fetch an order with line items for the webhook payload.
 * Returns a compact JSON-friendly object, or null on lookup failure.
 */
export async function fetchOrderForWebhook(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  orderId: string
): Promise<Record<string, unknown> | null> {
  try {
    const { data: order } = await supabase
      .from('orders')
      .select('id, status, total, agent_id, buyer_id, created_at, tracking_number')
      .eq('id', orderId)
      .maybeSingle();
    if (!order) return null;

    const { data: items } = await supabase
      .from('order_items')
      .select('product_id, product_name, quantity, unit_retail_price')
      .eq('order_id', orderId);

    return {
      id: order.id,
      status: order.status,
      total: Number(order.total) || 0,
      agent_id: order.agent_id,
      buyer_id: order.buyer_id,
      created_at: order.created_at,
      tracking_number: (order as { tracking_number?: string | null }).tracking_number ?? null,
      items: (items ?? []).map((it) => ({
        product_id: it.product_id,
        product_name: it.product_name,
        quantity: Number(it.quantity) || 0,
        unit_retail_price: Number(it.unit_retail_price) || 0,
      })),
    };
  } catch {
    return null;
  }
}
