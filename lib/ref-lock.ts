// lib/ref-lock.ts
//
// Signed QR-referral lock. One helper, two runtimes: this file is imported by
// the EDGE middleware (proxy.ts) and by NODE route handlers, so it may only
// use Web Crypto + standard globals. No `node:crypto`, no Buffer.
//
// THREAT MODEL
//   The lock decides which agent gets paid for a signup and which storefront a
//   logged-out guest is confined to. A visitor who can forge one can credit
//   themselves for every researcher on the platform. It is therefore HMAC-
//   signed with a server-only secret, compared in constant time, and versioned
//   so the payload shape can change without honouring stale forgeries.

import { STORE_SLUG_RE } from '@/lib/store-slug';

export const REF_LOCK_COOKIE = 'pnl_ref_lock';
export const REF_DISPLAY_COOKIE = 'pnl_ref_display';
export const REF_LOCK_MAX_AGE = 60 * 60 * 24 * 90; // 90 days, seconds

/**
 * Payload schema version. Bump when the MEANING of a field changes. verify
 * rejects anything NEWER than this build understands; a MISSING `v` is
 * accepted as legacy (v0) so cookies minted before versioning existed keep
 * working for their full 90 days instead of logging every locked guest out.
 */
export const REF_LOCK_VERSION = 1;

/** Tolerance for a client clock running ahead of the server. */
const CLOCK_SKEW_MS = 5 * 60 * 1000;

export interface RefLock {
  /** Referral code — profiles.username / profiles.referral_code namespace. */
  c: string;
  /** Storefront owner's profile id (agent_profiles.id === profiles.id). */
  a: string;
  /** agent_profiles.slug of the storefront to confine guests to, if any. */
  s: string | null;
  /** Sub-agent profile id when the scanned code belonged to a sub-agent. */
  sa: string | null;
  /** Mint time, epoch ms. */
  t: number;
  /**
   * How the lock was minted.
   *   'qr'  (or absent, legacy) — scanned/followed an explicit ?ref= link.
   *                               HARD: first scan wins, never overwritten.
   *   'url' — minted because the visitor typed a storefront URL.
   *                               SOFT: a later real QR scan replaces it.
   */
  k?: 'qr' | 'url';
  /** Payload version. Absent === legacy v0. */
  v?: number;
}

export function isSoftLock(lock: RefLock | null | undefined): boolean {
  return lock?.k === 'url';
}

/**
 * Referral codes live in the profiles username / referral_code namespace.
 * sanitizeUsername() permits [a-z0-9_], and referral_code additionally allows
 * hyphens and mixed case. 80 chars matches the bound used by the signup and
 * OAuth resolvers, so a code that is accepted there can never be silently
 * dropped here.
 */
export const REF_CODE_RE = /^[A-Za-z0-9_-]{2,80}$/;

/** Loose uuid shape check for `sa` — cheap, and keeps junk out of DB filters. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The signing secret. FAILS CLOSED.
 *
 * This deliberately does NOT fall back to NEXT_PUBLIC_SUPABASE_ANON_KEY. That
 * key is shipped to every browser, so signing with it means any visitor can
 * mint a lock crediting themselves for every signup — the signature would
 * prove nothing. It also does not fall back to '': an empty HMAC key is a
 * valid key, so that path silently produced verifiable-by-anyone locks.
 *
 * Returning null makes signRefLock/verifyRefLock return null, which every
 * caller already treats as "no lock" — degraded attribution, never forged
 * attribution.
 *
 * Preferred: REF_LOCK_SECRET (dedicated, rotatable independently).
 * Accepted:  SUPABASE_SERVICE_ROLE_KEY (server-only, always present).
 */
function secret(): string | null {
  const s = (process.env.REF_LOCK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return s.length >= 16 ? s : null;
}

/**
 * crypto.subtle.importKey is an async, non-trivial call and this runs on the
 * critical path of every middleware-handled request. Memoise the CryptoKey per
 * secret value (the guard means a rotated secret re-imports rather than
 * silently signing with the old key).
 */
let cachedKey: { secret: string; key: Promise<CryptoKey> } | null = null;

function getKey(sec: string): Promise<CryptoKey> {
  if (cachedKey && cachedKey.secret === sec) return cachedKey.key;
  const key = crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(sec),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  cachedKey = { secret: sec, key };
  return key;
}

function b64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decode base64url back to BYTES. The previous implementation returned the
 * latin-1 string straight out of atob() and JSON.parse'd that, so any payload
 * containing a multi-byte UTF-8 character (an accented storefront name, say)
 * round-tripped to mojibake and failed verification. Decoding to bytes and
 * running TextDecoder makes verify the exact inverse of sign.
 */
function b64urlToBytes(value: string): Uint8Array {
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(data: string): Promise<string | null> {
  const sec = secret();
  if (!sec) return null;
  try {
    const key = await getKey(sec);
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
    return b64url(new Uint8Array(sig));
  } catch {
    // A failed importKey would otherwise poison the cache with a rejected
    // promise for the life of the isolate.
    cachedKey = null;
    return null;
  }
}

/**
 * Sign a lock. Returns null when no usable secret is configured — callers MUST
 * check, and skip setting the cookie rather than writing an unsigned value.
 */
export async function signRefLock(lock: RefLock): Promise<string | null> {
  const stamped: RefLock = { ...lock, v: REF_LOCK_VERSION };
  const payload = b64url(new TextEncoder().encode(JSON.stringify(stamped)));
  const sig = await hmac(payload);
  if (!sig) return null;
  return `${payload}.${sig}`;
}

/**
 * Verify + parse a lock cookie. Returns null for anything that is not a
 * currently-valid, currently-understood, unexpired lock. Every rejection path
 * is silent by design: a bad cookie must behave exactly like no cookie.
 */
export async function verifyRefLock(value: string | undefined | null): Promise<RefLock | null> {
  if (!value) return null;
  const dot = value.lastIndexOf('.');
  if (dot <= 0) return null;

  const payload = value.slice(0, dot);
  const sig = value.slice(dot + 1);

  try {
    const expected = await hmac(payload);
    if (!expected) return null;

    // Constant-time compare. Length is compared first only because the loop
    // needs equal lengths; signature length is not secret.
    if (sig.length !== expected.length) return null;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
    if (diff !== 0) return null;

    const lock = JSON.parse(new TextDecoder().decode(b64urlToBytes(payload))) as RefLock;
    if (!lock || typeof lock !== 'object') return null;

    // Version: reject payloads newer than this build. Absent === legacy v0.
    if (lock.v != null) {
      if (typeof lock.v !== 'number' || !Number.isFinite(lock.v) || lock.v > REF_LOCK_VERSION) {
        return null;
      }
    }

    if (typeof lock.c !== 'string' || !REF_CODE_RE.test(lock.c)) return null;
    if (typeof lock.a !== 'string' || lock.a.length < 10) return null;

    // Storefront slug must be routable. An `s` that the middleware's slug
    // matcher would never accept can only ever bounce the guest in a loop
    // between a redirect target and the gate that produced it.
    if (lock.s != null) {
      if (typeof lock.s !== 'string' || !STORE_SLUG_RE.test(lock.s)) return null;
    }
    if (lock.sa != null) {
      if (typeof lock.sa !== 'string' || !UUID_RE.test(lock.sa)) return null;
    }
    if (lock.k != null && lock.k !== 'qr' && lock.k !== 'url') return null;

    // Expiry. The cookie's own maxAge already does this in a cooperating
    // browser; this is the server-side enforcement, because a cookie value can
    // be replayed from a jar long after its declared expiry.
    if (typeof lock.t !== 'number' || !Number.isFinite(lock.t)) return null;
    const age = Date.now() - lock.t;
    if (age > REF_LOCK_MAX_AGE * 1000) return null;
    if (age < -CLOCK_SKEW_MS) return null;

    return lock;
  } catch {
    return null;
  }
}
