import { describe, it, expect } from 'vitest';
import { readIdempotencyKey } from '@/lib/idempotency';

/**
 * Tests for lib/idempotency.ts header reader.
 *
 * withIdempotency() itself depends on the live Supabase admin client and
 * is exercised by the integration suite. These tests cover the pure
 * helper paths so a malformed header / case folding / oversized key
 * regression fails CI before it reaches production.
 */

function req(headers: Record<string, string>): Request {
  return new Request('http://localhost/x', { method: 'POST', headers });
}

describe('readIdempotencyKey', () => {
  it('reads the canonical Idempotency-Key header', () => {
    expect(readIdempotencyKey(req({ 'Idempotency-Key': 'abc-123' }))).toBe('abc-123');
  });

  it('reads the lowercase variant', () => {
    expect(readIdempotencyKey(req({ 'idempotency-key': 'lower-1' }))).toBe('lower-1');
  });

  it('reads the X-Idempotency-Key variant', () => {
    expect(readIdempotencyKey(req({ 'X-Idempotency-Key': 'xk-1' }))).toBe('xk-1');
  });

  it('returns null when no header is sent', () => {
    expect(readIdempotencyKey(req({}))).toBeNull();
  });

  it('rejects an empty header value', () => {
    expect(readIdempotencyKey(req({ 'Idempotency-Key': '' }))).toBeNull();
  });

  it('rejects an oversized key (> 200 chars) to defend against denial-of-service via huge cache keys', () => {
    const big = 'a'.repeat(201);
    expect(readIdempotencyKey(req({ 'Idempotency-Key': big }))).toBeNull();
  });

  it('accepts exactly 200 chars', () => {
    const k = 'b'.repeat(200);
    expect(readIdempotencyKey(req({ 'Idempotency-Key': k }))).toBe(k);
  });

  it('preserves case of the value (only header name is case-folded)', () => {
    expect(readIdempotencyKey(req({ 'Idempotency-Key': 'MixedCASE-Key' }))).toBe('MixedCASE-Key');
  });
});
