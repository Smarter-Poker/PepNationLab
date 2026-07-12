import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';

// Server-side auth lifecycle event recorder (login, logout, failed login,
// password reset/change). Privacy-minimal by design: raw usernames/emails and
// raw IPs are never stored -- attempted identifiers and IPs are salted-hashed so
// brute-force velocity can be analyzed without holding PII. Best-effort: never
// throws, never blocks the auth flow.

export type AuthEventType =
  | 'login'
  | 'logout'
  | 'login_failed'
  | 'password_reset_requested'
  | 'password_reset_completed'
  | 'password_changed';

const DAY = () => new Date().toISOString().slice(0, 10);

/**
 * Salted daily hash. Fails closed: with no AUTH_EVENT_SALT configured we store
 * null rather than a weakly-salted (brute-forceable) hash.
 */
function saltedHash(value: string | null | undefined): string | null {
  if (!value) return null;
  const salt = process.env.AUTH_EVENT_SALT || process.env.FAQ_CLICK_SALT;
  if (!salt) return null;
  return crypto.createHash('sha256').update(`${value}|${salt}-${DAY()}`).digest('hex').slice(0, 32);
}

export interface RecordAuthEventInput {
  event_type: AuthEventType;
  user_id?: string | null;
  /** Attempted username/email (failed logins) -- hashed, never stored raw. */
  identifier?: string | null;
  /** Client IP -- hashed, never stored raw. */
  ip?: string | null;
  user_agent?: string | null;
}

export async function recordAuthEvent(input: RecordAuthEventInput): Promise<void> {
  try {
    const svc = await createServiceClient();
    await svc.from('auth_events').insert({
      event_type: input.event_type,
      user_id: input.user_id ?? null,
      identifier_hash: saltedHash(input.identifier),
      ip_hash: saltedHash(input.ip),
      user_agent: input.user_agent ? input.user_agent.slice(0, 240) : null,
    });
  } catch (e) {
    console.error('[auth-events] record failed:', e instanceof Error ? e.message : String(e));
  }
}
