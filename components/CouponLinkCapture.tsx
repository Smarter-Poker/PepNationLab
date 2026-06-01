'use client';

import { useEffect } from 'react';

/**
 * Lightweight client capture for ?coupon= URL parameters on a storefront
 * page. When present, stashes the code in localStorage so the checkout
 * form can auto-apply it. Invisible at render time — pure side-effect.
 *
 * Lifetime: cleared after the checkout form picks it up, or after 30 days
 * if the user never finishes checkout.
 */

const STORAGE_KEY = 'pnl_pending_coupon';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export default function CouponLinkCapture() {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('coupon');
      if (!code) return;
      const cleaned = code.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24);
      if (!/^[A-Z0-9-]{3,24}$/.test(cleaned)) return;
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ code: cleaned, savedAt: Date.now() })
      );
      // Strip the param from the URL so a refresh doesn't keep re-asserting it.
      const url = new URL(window.location.href);
      url.searchParams.delete('coupon');
      window.history.replaceState({}, '', url.toString());
    } catch {
      // Storage may be unavailable in private-mode or restricted contexts.
    }
  }, []);

  // Best-effort GC of stale entries.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { code?: string; savedAt?: number };
      if (!parsed?.savedAt || Date.now() - parsed.savedAt > MAX_AGE_MS) {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }, []);

  return null;
}
