'use strict';

// ============================================================================
// Webhook signature verification.
// ----------------------------------------------------------------------------
// Every inbound webhook is signed by its source with a shared secret. The
// sender computes an HMAC-SHA256 over the raw request body and sends it in a
// header; this module recomputes that HMAC and compares it in constant time.
//
// When a source has no secret configured (local development), verification is
// skipped and the caller is told so it can log a warning - it must never be
// skipped silently in production.
// ============================================================================

const crypto = require('crypto');

// Compute the hex HMAC-SHA256 of a raw body buffer with a secret.
function computeHmac(rawBody, secret) {
  const buffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody || ''));
  return crypto.createHmac('sha256', secret).update(buffer).digest('hex');
}

// Constant-time comparison of two signature strings.
function safeEqual(a, b) {
  const bufferA = Buffer.from(String(a || ''), 'utf8');
  const bufferB = Buffer.from(String(b || ''), 'utf8');
  if (bufferA.length !== bufferB.length) return false;
  return crypto.timingSafeEqual(bufferA, bufferB);
}

// Verify a webhook signature.
//   rawBody          the exact request body buffer (req.rawBody)
//   providedSignature the signature header value the sender supplied
//   secret           the shared secret for this source, or '' when unset
// Returns one of: 'verified', 'invalid', 'unconfigured'.
function verifySignature(rawBody, providedSignature, secret) {
  if (!secret) return 'unconfigured';
  if (!providedSignature) return 'invalid';
  const expected = computeHmac(rawBody, secret);
  return safeEqual(expected, providedSignature) ? 'verified' : 'invalid';
}

module.exports = {
  computeHmac: computeHmac,
  safeEqual: safeEqual,
  verifySignature: verifySignature,
};
