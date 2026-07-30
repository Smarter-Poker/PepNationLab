'use client';

import { useEffect } from 'react';

import { STORE_SLUG_RE } from '@/lib/store-slug';

/**
 * AgentLinkCapture — invisible client component that remembers which agent's
 * storefront an unauthenticated visitor was browsing, so that when they sign
 * up the new account is linked to that agent rather than the house store.
 *
 * RELATIONSHIP TO THE SIGNED COOKIE LOCK
 *   There are two attribution stores and they used to disagree:
 *
 *     1. `pnl_ref_lock`    — httpOnly, HMAC-signed, minted by the edge
 *                            middleware. AUTHORITATIVE. This is what the
 *                            server actually credits.
 *     2. this localStorage — client-only, unsigned, 30-day.
 *
 *   When a guest scanned agent A's QR and then typed agent B's storefront
 *   URL, the cookie held A (first scan wins) while localStorage held B, and
 *   which one won depended on which code path read first. That is a
 *   commission bug, not a cosmetic one.
 *
 *   The fix: this component now DEFERS to the server's decision whenever the
 *   middleware has published one. The middleware writes a client-readable
 *   mirror of the lock's slug to `pnl_ref_display`; when that cookie exists,
 *   it — not the URL — is what gets stored. localStorage is reduced to a
 *   fallback for the case where no lock could be minted (e.g. no signing
 *   secret configured, or cookies blocked).
 *
 * Storage key:   pnl_referral_agent
 * Storage shape: { slug: string, sa?: string, savedAt: number }
 * Lifetime:      90 days — matches REF_LOCK_MAX_AGE. It was 30, which meant a
 *                guest whose cookie lock was still perfectly valid at day 45
 *                had a *contradicting* empty localStorage.
 */

const STORAGE_KEY = 'pnl_referral_agent';
const DISPLAY_COOKIE = 'pnl_ref_display';

/** 90 days — kept identical to REF_LOCK_MAX_AGE in lib/ref-lock.ts. */
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

/** First-touch guard: a different agent seen within this window does not win. */
const FIRST_TOUCH_MS = 10 * 60 * 1000;

const SA_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Props {
  // When omitted (landing page) the slug is read from ?agent in the URL.
  agentSlug?: string;
}

/** Read the middleware's client-readable mirror of the authoritative lock. */
function readDisplayCookie(): string {
  try {
    const match = document.cookie
      .split('; ')
      .find((c) => c.startsWith(`${DISPLAY_COOKIE}=`));
    if (!match) return '';
    return decodeURIComponent(match.slice(DISPLAY_COOKIE.length + 1)).trim();
  } catch {
    return '';
  }
}

export default function AgentLinkCapture({ agentSlug }: Props) {
  useEffect(() => {
    // The server's lock outranks anything derivable from the current URL.
    // `pnl_ref_display` carries the referral CODE; the storefront slug is what
    // this component tracks, so the cookie is only used to detect that a lock
    // exists and to stop a later URL from silently re-pointing attribution.
    const locked = readDisplayCookie();

    let slug = agentSlug || '';
    if (!slug) {
      try {
        slug = new URLSearchParams(window.location.search).get('agent') || '';
      } catch {
        slug = '';
      }
    }
    slug = slug.trim().toLowerCase();

    // Single source of truth for slug shape (lib/store-slug.ts). The old
    // /^[a-z0-9-]{1,60}$/i here accepted slugs the middleware would refuse to
    // route and rejected legal underscored ones, so a storefront like
    // `pep_it_up` was captured by the server and dropped by the client.
    if (!slug || !STORE_SLUG_RE.test(slug)) return;

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const existing = JSON.parse(raw) as { slug?: string; savedAt?: number };
        const age = Date.now() - (existing.savedAt ?? 0);
        const differentAgent = !!existing.slug && existing.slug !== slug;

        // A server-side lock is in force: never let a later URL overwrite a
        // stored attribution for a different agent, regardless of age.
        if (differentAgent && locked) return;

        // No lock — fall back to the original first-touch window.
        if (differentAgent && age < FIRST_TOUCH_MS) return;
      }

      // Also capture a `?sa=<sub-agent-id>` attribution param when present, so a
      // guest who arrives via a sub-agent's share link is credited to that
      // sub-agent (not only the parent agent) at signup. Preserve a previously
      // captured sa for the same agent when the current URL omits it.
      let sa: string | null = null;
      try {
        const p = new URLSearchParams(window.location.search).get('sa');
        if (p && SA_RE.test(p)) sa = p;
      } catch {
        /* ignore */
      }
      if (!sa && raw) {
        try {
          const prev = JSON.parse(raw) as { slug?: string; sa?: string };
          if (prev.slug === slug && prev.sa) sa = prev.sa;
        } catch {
          /* ignore */
        }
      }

      const entry: { slug: string; sa?: string; savedAt: number } = {
        slug,
        savedAt: Date.now(),
      };
      if (sa) entry.sa = sa;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
    } catch {
      // localStorage unavailable (private mode, etc.) — fail silently.
    }

    // GC: drop entries past the lock lifetime.
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { savedAt?: number };
      if (!parsed.savedAt || Date.now() - parsed.savedAt > MAX_AGE_MS) {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      /* ignore */
    }
  }, [agentSlug]);

  return null;
}
