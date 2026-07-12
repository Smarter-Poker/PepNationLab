'use client';

// Best-effort storefront funnel analytics.
//
// Fire-and-forget: NEVER throws and NEVER blocks the UI. Emits to
// /api/storefront/events, the agent-scoped funnel pipeline that backs the
// agent analytics dashboard (agent_storefront_analytics_30d).
//
// Hardening (2026-07-11 analytics audit):
// - Session id is a ROLLING 30-minute session (rotates after inactivity), not
//   a permanent browser id, so unique_sessions_30d approximates real sessions
//   and a customer's full history is not linkable through one eternal id.
// - A separate durable visitor id (shared with the attribution pipeline's
//   pnl_visitor_id) rides along so funnel sessions can be joined to
//   first-party UTM attribution.
// - Once-per-session dedupe for pageview and checkout_start prevents remounts,
//   refreshes, and StrictMode double-invokes from inflating funnel counts.
// - Transport ladder: sendBeacon first (survives unload), then fetch with
//   keepalive. Both wrapped so no failure ever reaches the caller.
// - order_complete is SERVER-emitted by POST /api/orders and is no longer a
//   client event type; the events endpoint rejects it from browsers.

const SESSION_KEY = 'pnl_sid';
const SESSION_TS_KEY = 'pnl_sid_ts';
const VISITOR_KEY = 'pnl_visitor_id'; // shared with components/UtmCapture.tsx
const DEDUPE_KEY_PREFIX = 'pnl_evt_';
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes of inactivity ends a session

type StorefrontEventType =
  | 'pageview'
  | 'product_view'
  | 'search'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'checkout_start';

interface TrackExtra {
  path?: string;
  search_term?: string;
  product_id?: string; // must be a UUID or it is dropped server-side
  quantity?: number;
  amount_cents?: number;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function newId(): string {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Rolling analytics session id: rotates after 30 minutes of inactivity.
 * Every call refreshes the activity timestamp.
 */
export function getAnalyticsSessionId(): string {
  try {
    const now = Date.now();
    const last = Number(localStorage.getItem(SESSION_TS_KEY) || 0);
    let sid = localStorage.getItem(SESSION_KEY);
    if (!sid || !Number.isFinite(last) || now - last > SESSION_TTL_MS) {
      sid = newId();
      localStorage.setItem(SESSION_KEY, sid);
      // New session: clear the once-per-session dedupe flags.
      try {
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
          const k = sessionStorage.key(i);
          if (k && k.startsWith(DEDUPE_KEY_PREFIX)) sessionStorage.removeItem(k);
        }
      } catch { /* dedupe reset is best-effort */ }
    }
    localStorage.setItem(SESSION_TS_KEY, String(now));
    return sid;
  } catch {
    return `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

/**
 * Durable anonymous visitor id, shared with the attribution pipeline so the
 * funnel can be joined to UTM/referrer capture. Returns null when storage is
 * unavailable or the id is not a UUID (the server only accepts UUIDs).
 */
export function getAnalyticsVisitorId(): string | null {
  try {
    let vid = localStorage.getItem(VISITOR_KEY);
    if (!vid && typeof crypto !== 'undefined' && crypto.randomUUID) {
      vid = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, vid);
    }
    return vid && UUID_RE.test(vid) ? vid : null;
  } catch {
    return null;
  }
}

/** Events that should only be counted once per session (per path). */
const ONCE_PER_SESSION: ReadonlySet<string> = new Set(['pageview', 'checkout_start']);

function alreadySentThisSession(event_type: string, path: string): boolean {
  if (!ONCE_PER_SESSION.has(event_type)) return false;
  try {
    const key = `${DEDUPE_KEY_PREFIX}${event_type}:${path}`;
    if (sessionStorage.getItem(key)) return true;
    sessionStorage.setItem(key, '1');
    return false;
  } catch {
    return false; // storage unavailable: prefer possible dupes over lost data
  }
}

function send(body: Record<string, unknown>): void {
  const url = '/api/storefront/events';
  const json = JSON.stringify(body);
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([json], { type: 'application/json' });
      if (navigator.sendBeacon(url, blob)) return;
    }
  } catch { /* fall through to fetch */ }
  try {
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: json,
      keepalive: true,
    }).catch(() => { /* best-effort */ });
  } catch { /* never throw */ }
}

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
    const path = extra?.path ?? window.location.pathname;
    if (alreadySentThisSession(event_type, path)) return;

    const body: Record<string, unknown> = {
      agent_slug: agentSlug,
      event_type,
      session_id: getAnalyticsSessionId(),
      path,
    };
    const vid = getAnalyticsVisitorId();
    if (vid) body.visitor_id = vid;
    if (navigator?.userAgent) body.user_agent = navigator.userAgent.slice(0, 240);
    if (extra?.search_term) body.search_term = extra.search_term.slice(0, 120);
    if (extra?.product_id && UUID_RE.test(extra.product_id)) body.product_id = extra.product_id;
    if (typeof extra?.quantity === 'number' && extra.quantity > 0 && Number.isFinite(extra.quantity)) {
      body.quantity = Math.min(Math.round(extra.quantity), 100000);
    }
    if (typeof extra?.amount_cents === 'number' && extra.amount_cents >= 0 && Number.isFinite(extra.amount_cents)) {
      body.amount_cents = Math.round(extra.amount_cents);
    }

    send(body);
  } catch {
    /* never throw */
  }
}
