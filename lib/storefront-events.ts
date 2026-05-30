/**
 * Client-side helper for emitting storefront events.
 * Stores a stable session_id in sessionStorage so a single visit gets one ID.
 * Calls are fire-and-forget and never throw.
 */
const SESSION_KEY = 'pnl_storefront_session_id';

function ensureSessionId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
        ? crypto.randomUUID().replace(/-/g, '')
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return 'no_session';
  }
}

export type StorefrontEventType =
  | 'pageview'
  | 'product_view'
  | 'search'
  | 'add_to_cart'
  | 'checkout_start'
  | 'order_complete';

export interface StorefrontEventPayload {
  agent_slug: string;
  event_type: StorefrontEventType;
  path?: string;
  search_term?: string;
  product_id?: string;
  order_id?: string;
  amount_cents?: number;
}

export function emitStorefrontEvent(payload: StorefrontEventPayload): void {
  if (typeof window === 'undefined') return;
  try {
    const body = JSON.stringify({
      ...payload,
      session_id: ensureSessionId(),
      user_agent: navigator.userAgent.slice(0, 240),
    });
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon('/api/storefront/events', blob);
    } else {
      fetch('/api/storefront/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => { /* fire-and-forget */ });
    }
  } catch {
    /* never throw from telemetry */
  }
}
