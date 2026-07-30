// lib/ref-lock.ts
//
// QR referral lock.
//
// When a visitor lands on any page with ?ref=<code> (the URL encoded in an
// agent's referral QR code), proxy.ts resolves the code to the referring
// agent and sets a signed, httpOnly cookie. From that point on:
//   - "Continue As Guest" browses ONLY that agent's storefront (proxy gate)
//   - account creation records that agent as the referrer server-side,
//     regardless of what the signup form submits
// The cookie is HMAC-signed so it cannot be forged or edited client-side,
// and httpOnly so scripts cannot read or change it. First scan wins: an
// existing valid lock is never overwritten by a later ?ref=.
//
// Edge-safe: Web Crypto only (runs in proxy middleware and Node routes).

export const REF_LOCK_COOKIE = 'pnl_ref_lock';       // httpOnly signed payload (authoritative)
export const REF_DISPLAY_COOKIE = 'pnl_ref_display'; // client-readable code (UI only, never trusted)
export const REF_LOCK_MAX_AGE = 60 * 60 * 24 * 90;   // 90 days

export interface RefLock {
  /** referral code as scanned (profiles.username or referral_code) */
  c: string;
  /** storefront owner profiles.id (for sub-agent codes: the parent agent) */
  a: string;
  /** agent_profiles.slug guests may browse (null = referrer has no storefront) */
  s: string | null;
  /** sub-agent profiles.id when the scanned code belongs to a sub-agent */
  sa: string | null;
  /** capture time (epoch ms) */
  t: number;
  /**
   * How the lock was acquired.
   *   'qr'  — explicit ?ref=<code> (an agent's QR / share link). HARD: first
   *           scan wins, never overwritten while it is valid.
   *   'url' — visitor typed or followed pepnationlab.com/<agent-slug> while
   *           logged out. SOFT: replaceable by a later real QR scan, or by
   *           typing a different storefront URL. Without this distinction an
   *           accidental visit to any store URL would permanently block the
   *           referral credit of a QR the visitor scans afterwards.
   * Absent on locks issued before this field existed — treated as 'qr'.
   */
  k?: 'qr' | 'url';
}

/** A lock is soft (replaceable) only when it came from direct URL entry. */
export function isSoftLock(lock: RefLock | null | undefined): boolean {
  return lock?.k === 'url';
}

export const REF_CODE_RE = /^[A-Za-z0-9_-]{2,50}$/;

function secret(): string {
  return (
    process.env.REF_LOCK_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''
  );
}

function b64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(value: string): string {
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  return atob(b64 + pad);
}

async function hmac(data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return b64url(new Uint8Array(sig));
}

export async function signRefLock(lock: RefLock): Promise<string> {
  const payload = b64url(new TextEncoder().encode(JSON.stringify(lock)));
  return `${payload}.${await hmac(payload)}`;
}

export async function verifyRefLock(value: string | undefined | null): Promise<RefLock | null> {
  if (!value) return null;
  const dot = value.lastIndexOf('.');
  if (dot <= 0) return null;
  const payload = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  try {
    const expected = await hmac(payload);
    if (sig.length !== expected.length) return null;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
    if (diff !== 0) return null;
    const lock = JSON.parse(b64urlDecode(payload)) as RefLock;
    if (!lock || typeof lock.c !== 'string' || !REF_CODE_RE.test(lock.c)) return null;
    if (typeof lock.a !== 'string' || lock.a.length < 10) return null;
    if (lock.s != null && typeof lock.s !== 'string') return null;
    if (lock.sa != null && typeof lock.sa !== 'string') return null;
    if (lock.k != null && lock.k !== 'qr' && lock.k !== 'url') return null;
    return lock;
  } catch {
    return null;
  }
}
