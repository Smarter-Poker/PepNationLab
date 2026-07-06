'use client';

import { useEffect } from 'react';

/**
 * AgentLinkCapture — invisible client component that saves the current
 * agent's slug to localStorage when an unauthenticated visitor browses
 * a storefront.
 *
 * This ensures that when the guest signs up (via /signup), their new account
 * is automatically linked to the agent they were browsing — not the default
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
  agentSlug: string;
}

export default function AgentLinkCapture({ agentSlug }: Props) {
  useEffect(() => {
    if (!agentSlug) return;
    try {
      // Don't overwrite if there's already a fresh entry from a DIFFERENT agent
      // that was stored more recently than 10 minutes ago.
      // This respects the "first touch" attribution model.
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const existing = JSON.parse(raw) as { slug?: string; savedAt?: number };
        const age = Date.now() - (existing.savedAt ?? 0);
        if (existing.slug && existing.slug !== agentSlug && age < 10 * 60 * 1000) {
          // There's a fresh attribution to a different agent — don't overwrite.
          return;
        }
      }

      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ slug: agentSlug, savedAt: Date.now() })
      );
    } catch {
      // localStorage unavailable (private mode, etc.) — fail silently.
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
