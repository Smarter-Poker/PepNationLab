'use client';

import { useEffect } from 'react';

/**
 * Anonymous acquisition attribution capture.
 *
 * Mounted globally. On each page load it:
 *   1. Ensures a stable per-browser visitor_id (localStorage, first-party).
 *   2. Reads utm_* params + document.referrer + landing path.
 *   3. POSTs them to /api/attribution, which upserts one row per visitor
 *      keyed on visitor_id: first-touch is immutable, last-touch is updated.
 *
 * No PII is captured here. The visitor_id is a random UUID, not tied to any
 * identity until the same browser later authenticates (at which point an
 * authenticated POST lets the server stamp user_id onto the row).
 *
 * Deliberately client-side and side-effect only (renders null), matching the
 * existing CouponLinkCapture / AgentLinkCapture pattern. There is no
 * middleware.ts in this app and adding one would run on every request; a
 * lazy client capture is the lower-risk equivalent.
 *
 * No ad-platform pixels: a Meta/Google pixel on a research-peptide storefront
 * is itself a policy and privacy liability. Attribution is first-party only.
 */

const VISITOR_KEY = 'pnl_visitor_id';
const SENT_KEY = 'pnl_attr_last_sent';
// Re-post at most once every 30 minutes of activity to avoid hammering the
// endpoint on client-side navigations while still refreshing last-touch.
const RESEND_INTERVAL_MS = 30 * 60 * 1000;

const UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
] as const;

function getOrCreateVisitorId(): string | null {
  try {
    let id = window.localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `v_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

export default function UtmCapture() {
  useEffect(() => {
    try {
      const visitorId = getOrCreateVisitorId();
      if (!visitorId) return;

      const params = new URLSearchParams(window.location.search);
      const utm: Record<string, string> = {};
      for (const k of UTM_KEYS) {
        const v = params.get(k);
        if (v) utm[k] = v.slice(0, 200);
      }

      const hasUtm = Object.keys(utm).length > 0;

      // Throttle: skip if we posted recently AND this visit carries no new
      // campaign params. A UTM-tagged landing always posts (it's the whole
      // point); organic navigations coalesce.
      let lastSent = 0;
      try {
        lastSent = Number(window.localStorage.getItem(SENT_KEY)) || 0;
      } catch {
        /* ignore */
      }
      if (!hasUtm && Date.now() - lastSent < RESEND_INTERVAL_MS) return;

      const payload = {
        visitor_id: visitorId,
        landing_path: window.location.pathname.slice(0, 300),
        referrer: (document.referrer || '').slice(0, 300),
        ...utm,
      };

      // keepalive so the beacon survives an immediate navigation.
      fetch('/api/attribution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      })
        .then((res) => {
          // Only stamp the throttle on success: a 429/500 response used to
          // suppress retries for 30 minutes, silently losing the touch.
          if (!res.ok) return;
          try {
            window.localStorage.setItem(SENT_KEY, String(Date.now()));
          } catch {
            /* ignore */
          }
        })
        .catch(() => {
          /* best-effort; attribution is non-blocking */
        });

      // Strip utm_* from the visible URL so a refresh/share doesn't re-assert
      // them and they don't leak into downstream analytics or bookmarks.
      if (hasUtm) {
        const url = new URL(window.location.href);
        for (const k of UTM_KEYS) url.searchParams.delete(k);
        window.history.replaceState({}, '', url.toString());
      }
    } catch {
      // Storage/URL APIs may be unavailable in private or embedded contexts.
    }
  }, []);

  return null;
}
