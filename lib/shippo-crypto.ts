/**
 * lib/shippo-crypto.ts
 *
 * AES-256-GCM helpers for at-rest encryption of Shippo API tokens and
 * webhook signing secrets. The encryption key comes from the
 * SHIPPO_ENCRYPTION_KEY env var as a base64-encoded 32-byte value.
 *
 * Storage shape (BYTEA columns in platform_shippo_credentials):
 *   api_key_ciphertext, api_key_iv (12 bytes), api_key_tag (16 bytes)
 *   webhook_secret_ciphertext, webhook_secret_iv, webhook_secret_tag
 *
 * Used by:
 *   lib/shippo.ts  ->  getActiveKey() decrypts the active row
 *   app/api/admin/shippo/connect/route.ts  -> encryptSecret() on insert
 *   app/api/admin/shippo/rotate/route.ts   -> encryptSecret() on rotation
 *   app/api/webhooks/shippo/route.ts       -> safeCompare() for HMAC
 *
 * Notes:
 *   - Authenticated encryption: tag is verified on decrypt; tampering throws.
 *   - We use Node's `crypto` module (not Web Crypto) because this code only
 *     runs server-side (route handlers, cron, server actions). No browser path.
 *   - Last-4 helper is provided so the admin UI can display "sk_..a7c2" without
 *     ever needing to decrypt the live key.
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32; // AES-256
const IV_BYTES = 12; // GCM standard
const TAG_BYTES = 16;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Output of encryptSecret. The three Buffers map directly to the
 * `*_ciphertext`, `*_iv`, and `*_tag` BYTEA columns.
 */
export interface EncryptedSecret {
  ciphertext: Buffer;
  iv: Buffer;
  tag: Buffer;
}

// ---------------------------------------------------------------------------
// Key resolution
// ---------------------------------------------------------------------------

let cachedKey: Buffer | null = null;

/**
 * Returns the 32-byte master encryption key, cached per Node process.
 *
 * Reads SHIPPO_ENCRYPTION_KEY (base64) at first call and verifies it decodes
 * to exactly 32 bytes. Any setup error throws immediately so the admin UI
 * surfaces a clear "encryption key misconfigured" message instead of silently
 * storing garbage.
 *
 * To generate a fresh key:
 *   openssl rand -base64 32
 */
function getKey(): Buffer {
  if (cachedKey) return cachedKey;

  const raw = process.env.SHIPPO_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'SHIPPO_ENCRYPTION_KEY is not set. Generate with `openssl rand -base64 32` and set it in Vercel env.',
    );
  }

  let buf: Buffer;
  try {
    buf = Buffer.from(raw, 'base64');
  } catch {
    throw new Error('SHIPPO_ENCRYPTION_KEY is not valid base64.');
  }

  if (buf.length !== KEY_BYTES) {
    throw new Error(
      `SHIPPO_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes; got ${buf.length}. Generate with \`openssl rand -base64 32\`.`,
    );
  }

  cachedKey = buf;
  return buf;
}

/**
 * Test helper - clears the cached key so subsequent calls re-read the env.
 * Not used in production code paths; safe to keep for future tests.
 */
export function _resetKeyCacheForTests(): void {
  cachedKey = null;
}

// ---------------------------------------------------------------------------
// Encrypt / decrypt
// ---------------------------------------------------------------------------

/**
 * Encrypt a UTF-8 string (an API token, a webhook signing secret).
 * Returns `{ciphertext, iv, tag}` ready to write into BYTEA columns.
 *
 * Throws if `plaintext` is empty - empty secrets are a configuration bug,
 * not a valid state.
 */
export function encryptSecret(plaintext: string): EncryptedSecret {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new Error('encryptSecret: plaintext must be a non-empty string');
  }

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  if (tag.length !== TAG_BYTES) {
    // Should be impossible with GCM defaults but guard just in case.
    throw new Error(
      `encryptSecret: unexpected auth tag length ${tag.length}, expected ${TAG_BYTES}`,
    );
  }

  return { ciphertext, iv, tag };
}

/**
 * Decrypt a `{ciphertext, iv, tag}` triple back to the original UTF-8 string.
 *
 * Throws if the tag does not verify - that means the row was tampered with
 * or the SHIPPO_ENCRYPTION_KEY changed since the row was written. In either
 * case the caller MUST NOT use a returned partial plaintext (Node's GCM
 * decipher throws before any partial bytes leak, but we wrap with a
 * defensive message regardless).
 */
export function decryptSecret(input: {
  ciphertext: Buffer | Uint8Array;
  iv: Buffer | Uint8Array;
  tag: Buffer | Uint8Array;
}): string {
  const ciphertext = Buffer.from(input.ciphertext);
  const iv = Buffer.from(input.iv);
  const tag = Buffer.from(input.tag);

  if (iv.length !== IV_BYTES) {
    throw new Error(`decryptSecret: bad iv length ${iv.length}, expected ${IV_BYTES}`);
  }
  if (tag.length !== TAG_BYTES) {
    throw new Error(`decryptSecret: bad tag length ${tag.length}, expected ${TAG_BYTES}`);
  }
  if (ciphertext.length === 0) {
    throw new Error('decryptSecret: empty ciphertext');
  }

  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);

  try {
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return plaintext.toString('utf8');
  } catch {
    // Don't echo the underlying error to the caller - it may contain crypto
    // internals that look like leak vectors. Generic message; the caller's
    // own logger picks up Sentry breadcrumb.
    throw new Error('decryptSecret: authentication failed (tampered ciphertext or wrong key)');
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the last 4 characters of an API token - used for the admin UI's
 * "sk_..a7c2" pill so we never round-trip the live key through the browser.
 *
 * Padded with leading dots if the token is shorter than 4 chars (shouldn't
 * happen for real Shippo keys, but guard anyway).
 */
export function lastFour(token: string): string {
  if (!token) return '----';
  if (token.length <= 4) return token.padStart(4, '.');
  return token.slice(-4);
}

/**
 * Constant-time string compare for HMAC signature verification.
 * Wraps Node's `timingSafeEqual` with the length pre-check it requires.
 */
export function safeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}
