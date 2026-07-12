import type { SupabaseClient } from '@supabase/supabase-js';

// Server-side analytics emission for revenue-bearing and lifecycle events.
//
// order_complete, order_cancelled, and signup are SERVER-authoritative: they
// are inserted by the API routes that own the underlying state change, using
// server-computed values, so ad blockers, tab closes, and forged client
// payloads can never lose or fabricate them. The client events endpoint
// rejects these types.
//
// Every call is best-effort: failures are logged and swallowed so analytics
// can never break an order, a cancellation, or a registration.

export type ServerAnalyticsEventType = 'order_complete' | 'order_cancelled' | 'signup';

export interface ServerAnalyticsEvent {
  agent_id: string;
  event_type: ServerAnalyticsEventType;
  /** Client rolling session id when the request carried one; falls back to a server tag. */
  session_id?: string | null;
  /** Durable anonymous visitor id (UUID) when the request carried one. */
  visitor_id?: string | null;
  path?: string | null;
  order_id?: string | null;
  amount_cents?: number | null;
  quantity?: number | null;
  is_wholesale?: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function recordServerAnalyticsEvent(
  svc: SupabaseClient,
  ev: ServerAnalyticsEvent,
): Promise<void> {
  try {
    const sessionId =
      typeof ev.session_id === 'string' && ev.session_id.length >= 8 && ev.session_id.length <= 80
        ? ev.session_id
        : `srv_${ev.order_id ?? ev.agent_id}`.slice(0, 80);

    const { error } = await svc.from('agent_storefront_events').insert({
      agent_id: ev.agent_id,
      visitor_id: ev.visitor_id && UUID_RE.test(ev.visitor_id) ? ev.visitor_id : null,
      session_id: sessionId,
      event_type: ev.event_type,
      path: ev.path ?? null,
      order_id: ev.order_id ?? null,
      amount_cents:
        typeof ev.amount_cents === 'number' && Number.isFinite(ev.amount_cents)
          ? Math.max(0, Math.round(ev.amount_cents))
          : null,
      quantity:
        typeof ev.quantity === 'number' && ev.quantity > 0
          ? Math.round(ev.quantity)
          : null,
      is_wholesale: ev.is_wholesale === true,
    });
    // Unique-index conflicts (one order_complete / order_cancelled per order)
    // are expected on idempotent retries; everything else is worth a log line.
    if (error && (error as { code?: string }).code !== '23505') {
      console.error(`[server-analytics] ${ev.event_type} insert failed:`, error.message);
    }
  } catch (e) {
    console.error('[server-analytics] emit threw:', e instanceof Error ? e.message : String(e));
  }
}
