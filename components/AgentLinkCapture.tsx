'use client';

import { useEffect } from 'react';

/**
 * AgentLinkCapture - invisible client component that saves the current
 * agent's slug to localStorage when an unauthenticated visitor browses
 * a storefront.
 *
 * This ensures that when the guest signs up (via /signup), their new account
 * is automatically linked to the agent they were browsing - not the default
 * house store.
 *
 * Storage key:  pnl_referral_agent
 * Storage shape: { slug: string, savedAt: number }
 * Lifetime:     30 days (cleared on successful signup)
 *
 * Only writes if the visitor is NOT already logged in (avoids overwriting
 * referring_agent_id for existing researchers who browse other storefronts).
 */

const STORAGE_KEY = 'pnl_referral_agent';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

interface Props {
  // When omitted (landing page) the slug is read from ?agent in the URL.
  agentSlug?: string;
}

export default function AgentLinkCapture({ agentSlug }: Props) {
  useEffect(() => {
    let slug = agentSlug || '';
    if (!slug) {
      try { slug = new URLSearchParams(window.location.search).get('agent') || ''; } catch { slug = ''; }
    }
    if (!slug || !/^[a-z0-9-]{1,60}$/i.test(slug)) return;
    try {
      // Don't overwrite if there's already a fresh entry from a DIFFERENT agent
      // that was stored more recently than 10 minutes ago.
      // This respects the "first touch" attribution model.
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const existing = JSON.parse(raw) as { slug?: string; savedAt?: number };
        const age = Date.now() - (existing.savedAt ?? 0);
        if (existing.slug && existing.slug !== slug && age < 10 * 60 * 1000) {
          // There's a fresh attribution to a different agent - don't overwrite.
          return;
        }
      }

      // Also capture a `?sa=<sub-agent-id>` attribution param when present, so a
      // guest who arrives via a sub-agent's share link is credited to that
      // sub-agent (not only the parent agent) at signup. Preserve a previously
      // captured sa for the same agent when the current URL omits it.
      let sa: string | null = null;
      try {
        const p = new URLSearchParams(window.location.search).get('sa');
        if (p && /^[0-9a-f-]{36}$/i.test(p)) sa = p;
      } catch { /* ignore */ }
      if (!sa && raw) {
        try {
          const prev = JSON.parse(raw) as { slug?: string; sa?: string };
          if (prev.slug === slug && prev.sa) sa = prev.sa;
        } catch { /* ignore */ }
      }
      const entry: { slug: string; sa?: string; savedAt: number } = { slug, savedAt: Date.now() };
      if (sa) entry.sa = sa;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
    } catch {
      // localStorage unavailable (private mode, etc.) - fail silently.
    }

    // GC: remove stale entries older than 30 days
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { savedAt?: number };
      if (!parsed.savedAt || Date.now() - parsed.savedAt > MAX_AGE_MS) {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch { /* ignore */ }
  }, [agentSlug]);

  return null;
}
