'use client';

// Best-effort storefront funnel analytics.
//
// Fire-and-forget: NEVER throws and NEVER blocks the UI. Emits to
// /api/storefront/events, the agent-scoped funnel pipeline that already backs
// the agent analytics dashboard (agent_storefront_analytics_30d). Until now
// nothing emitted these events, so every agent's dashboard read zero -- this
// activates it. A stable per-browser session id is kept in localStorage so the
// funnel (pageview -> checkout_start -> order_complete) links across steps.

const SESSION_KEY = 'pnl_sid';

type StorefrontEventType =
  | 'pageview'
  | 'product_view'
  | 'search'
  | 'add_to_cart'
  | 'checkout_start'
  | 'order_complete';

interface TrackExtra {
  path?: string;
  search_term?: string;
  product_id?: string; // must be a UUID or it is dropped server-side
  order_id?: string;   // must be a UUID or it is dropped server-side
  amount_cents?: number;
}

function sessionId(): string {
  try {
    let sid = localStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid =
        (typeof crypto !== 'undefined' && crypto.randomUUID)
          ? crypto.randomUUID()
          : `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Emit a storefront funnel event. Safe to call from anywhere client-side.
 * No-ops when there is no agent slug (nothing to attribute the event to).
 */
export function trackStorefrontEvent(
  agentSlug: string | null | undefined,
  event_type: StorefrontEventType,
  extra?: TrackExtra,
): void {
  if (!agentSlug || typeof window === 'undefined') return;
  try {
    const body: Record<string, unknown> = {
      agent_slug: agentSlug,
      event_type,
      session_id: sessionId(),
      path: extra?.path ?? window.location.pathname,
    };
    if (navigator?.userAgent) body.user_agent = navigator.userAgent.slice(0, 240);
    if (extra?.search_term) body.search_term = extra.search_term.slice(0, 120);
    if (extra?.product_id && UUID_RE.test(extra.product_id)) body.product_id = extra.product_id;
    if (extra?.order_id && UUID_RE.test(extra.order_id)) body.order_id = extra.order_id;
    if (typeof extra?.amount_cents === 'number' && extra.amount_cents >= 0) {
      body.amount_cents = Math.round(extra.amount_cents);
    }

    fetch('/api/storefront/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => { /* best-effort */ });
  } catch {
    /* never throw */
  }
}
