// lib/attribution-log.ts
//
// Best-effort audit trail for referral attribution decisions.
//
// WHY THIS EXISTS
//   Before this, the only record that "agent X got credit for researcher Y"
//   was the final `referring_agent_id` column on the profile row. If
//   attribution went to the wrong agent there was no way to answer *why* —
//   was it a QR scan, a typed storefront URL, a form field, an OAuth
//   callback? Was there a signed lock at all, and when was it minted?
//   Commission disputes were unresolvable.
//
// DESIGN RULES
//   1. NEVER throws. Attribution logging failing must never fail a signup.
//      Every call site awaits this, so a rejected promise here would 500 a
//      user whose auth account has already been created.
//   2. Service-role only. The table has RLS enabled with no policies, so it
//      is invisible to anon/authenticated clients; only an admin client can
//      write to it.
//   3. Awaited, not floating. A serverless function can be frozen the instant
//      its response is returned, so a fire-and-forget promise may never
//      flush. This is one insert on an append-only table.
//
// Mirrors the `referral_attribution_events` table.

import type { createAdminClient } from '@/lib/supabase/server';

type AdminClient = ReturnType<typeof createAdminClient>;

export type AttributionChannel =
  | 'storefront_register'
  | 'oauth_callback'
  | 'signup_promo'
  | 'other';

/**
 * Where the attribution decision came from.
 *   'qr'             — a hard lock minted from an explicit ?ref= scan.
 *   'storefront_url' — a soft lock minted by typing a storefront URL.
 *   'form'           — no lock; whatever the signup form itself carried.
 *   'oauth'          — resolved during the OAuth callback.
 */
export type AttributionSource = 'qr' | 'storefront_url' | 'form' | 'oauth';

export interface AttributionEvent {
  event: string;
  channel: AttributionChannel;
  source: AttributionSource;
  user_id?: string | null;
  agent_id?: string | null;
  sub_agent_id?: string | null;
  ref_code?: string | null;
  store_slug?: string | null;
  /** Lock mint time as ISO — null when there was no lock. */
  lock_minted_at?: string | null;
  detail?: Record<string, unknown> | null;
}

/** Text columns here are unbounded; junk input should not be. */
function trim(value: string | null | undefined, max: number): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v) return null;
  return v.length > max ? v.slice(0, max) : v;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * uuid columns reject malformed input at the DB level, and one bad id would
 * fail the WHOLE insert — losing the audit row we are trying to keep. Filter
 * first so a malformed id degrades to a null column instead.
 */
function uuid(value: string | null | undefined): string | null {
  return typeof value === 'string' && UUID_RE.test(value) ? value : null;
}

/**
 * Record one attribution decision. Resolves true when the row landed, false
 * when it did not. NEVER rejects.
 */
export async function recordAttributionEvent(
  admin: AdminClient,
  event: AttributionEvent,
): Promise<boolean> {
  try {
    const { error } = await admin.from('referral_attribution_events').insert({
      event: trim(event.event, 80) ?? 'unknown',
      channel: trim(event.channel, 40) ?? 'other',
      source: trim(event.source, 40) ?? 'form',
      user_id: uuid(event.user_id),
      agent_id: uuid(event.agent_id),
      sub_agent_id: uuid(event.sub_agent_id),
      ref_code: trim(event.ref_code, 120),
      store_slug: trim(event.store_slug, 120),
      lock_minted_at: event.lock_minted_at ?? null,
      detail: event.detail ?? null,
    });
    if (error) {
      console.error('[attribution-log] insert failed:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[attribution-log] unexpected error:', err);
    return false;
  }
}
