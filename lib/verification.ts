// Email verification codes for public registration.
//
// Codes are 6-digit numeric, single-use, short-lived, and stored ONLY as a
// salted SHA-256 hash in public.email_verification_codes. The plaintext code
// exists only in the delivered email. Verification is rate-limited (per IP) and
// attempt-limited (per code row) to defeat brute force (10^6 space, 5 tries,
// 10-minute window).

import { createHash, randomInt } from 'crypto';

export const CODE_TTL_MINUTES = 10;
export const MAX_CODE_ATTEMPTS = 5;
export const CODE_PURPOSE_SIGNUP = 'signup';
export const CODE_PURPOSE_VERIFY_EMAIL = 'verify_email';

/** Generate a zero-padded 6-digit numeric code (cryptographically random). */
export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/** Normalize an email for hashing + storage comparisons. */
export function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

/**
 * Hash a code bound to its email so a leaked hash from one address can't be
 * replayed against another. Peppered with a server secret (service role key is
 * always present in prod); codes are short-lived and attempt-limited regardless.
 */
export function hashCode(code: string, email: string): string {
  const pepper =
    process.env.EMAIL_CODE_PEPPER ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'pnl-verification-pepper';
  return createHash('sha256')
    .update(`${normalizeEmail(email)}:${String(code).trim()}:${pepper}`)
    .digest('hex');
}

/** Basic RFC-5322-ish email validation, capped length. */
export function isValidEmail(email: string): boolean {
  const e = String(email || '').trim();
  if (e.length < 5 || e.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export function codeExpiryDate(): Date {
  return new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);
}
