// __tests__/ref-lock.test.ts
//
// Guards the ref-lock unit constants and the expiry path in verifyRefLock.
//
// WHY THESE TESTS EXIST
//   During wiring of the attribution check a near-miss bug was caught before
//   shipping: MAX_AGE_MS was assigned REF_LOCK_MAX_AGE directly (seconds),
//   which would have expired referral attribution after 90 seconds instead of
//   90 days, silently, costing agents commission.  The fix is already live
//   (verifyRefLock line: `if (age > REF_LOCK_MAX_AGE * 1000) return null`),
//   but "it looked right" is not a defence.  These tests assert the CONVERSION
//   — not just the constant's name — so any future copy-paste repeats the
//   same class of mistake and fails loudly here.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { REF_LOCK_MAX_AGE, signRefLock, verifyRefLock, REF_LOCK_COOKIE } from '@/lib/ref-lock';

// ---------------------------------------------------------------------------
// Environment setup — verifyRefLock/signRefLock require a signing secret.
// ---------------------------------------------------------------------------

const TEST_SECRET = 'test-secret-at-least-16-chars-long';

beforeEach(() => {
  process.env.REF_LOCK_SECRET = TEST_SECRET;
});

afterEach(() => {
  delete process.env.REF_LOCK_SECRET;
});

// ---------------------------------------------------------------------------
// Unit constant guard — the most important test in this file.
// ---------------------------------------------------------------------------

describe('REF_LOCK_MAX_AGE unit assertion', () => {
  it('is expressed in SECONDS — must be at least 1 day and at most 1 year', () => {
    const ONE_DAY_S = 60 * 60 * 24;
    const ONE_YEAR_S = ONE_DAY_S * 365;

    // If someone mistakenly set this to milliseconds the value would be >=
    // 1 day * 1000 = 86_400_000, which is well above ONE_YEAR_S (31_536_000).
    // This assertion fails that scenario and documents the intended unit.
    expect(REF_LOCK_MAX_AGE).toBeGreaterThanOrEqual(ONE_DAY_S);
    expect(REF_LOCK_MAX_AGE).toBeLessThanOrEqual(ONE_YEAR_S);
  });

  it('equals exactly 90 days in seconds', () => {
    expect(REF_LOCK_MAX_AGE).toBe(60 * 60 * 24 * 90);
  });

  it('REF_LOCK_MAX_AGE * 1000 equals 90 days in milliseconds', () => {
    // This documents the intended usage in verifyRefLock:
    //   if (age > REF_LOCK_MAX_AGE * 1000) return null;
    // The multiplication is what makes the comparison correct.
    const NINETY_DAYS_MS = 60 * 60 * 24 * 90 * 1000;
    expect(REF_LOCK_MAX_AGE * 1000).toBe(NINETY_DAYS_MS);
  });
});

// ---------------------------------------------------------------------------
// signRefLock / verifyRefLock round-trip and expiry behaviour.
// ---------------------------------------------------------------------------

const BASE_LOCK = {
  c: 'testcode',
  a: 'agent-profile-id-1234567890',
  s: 'my-store',
  sa: null,
  t: Date.now(),
  k: 'qr' as const,
};

describe('signRefLock + verifyRefLock round-trip', () => {
  it('verifies a freshly signed lock', async () => {
    const token = await signRefLock(BASE_LOCK);
    expect(token).not.toBeNull();

    const result = await verifyRefLock(token!);
    expect(result).not.toBeNull();
    expect(result!.c).toBe('testcode');
    expect(result!.a).toBe('agent-profile-id-1234567890');
  });

  it('rejects a tampered token', async () => {
    const token = await signRefLock(BASE_LOCK);
    expect(token).not.toBeNull();
    const tampered = token!.replace(/.$/, 'X');
    expect(await verifyRefLock(tampered)).toBeNull();
  });

  it('rejects null / undefined', async () => {
    expect(await verifyRefLock(null)).toBeNull();
    expect(await verifyRefLock(undefined)).toBeNull();
    expect(await verifyRefLock('')).toBeNull();
  });
});

describe('verifyRefLock expiry — the unit-conversion guard', () => {
  it('rejects a lock whose mint time is older than 90 days in MILLISECONDS', async () => {
    // Simulate a lock minted 91 days ago.
    const NINETY_ONE_DAYS_MS = 91 * 24 * 60 * 60 * 1000;
    const oldLock = { ...BASE_LOCK, t: Date.now() - NINETY_ONE_DAYS_MS };

    const token = await signRefLock(oldLock);
    expect(token).not.toBeNull();

    // Must be null — the lock is expired.
    const result = await verifyRefLock(token!);
    expect(result).toBeNull();
  });

  it('accepts a lock minted 89 days ago', async () => {
    const EIGHTY_NINE_DAYS_MS = 89 * 24 * 60 * 60 * 1000;
    const recentLock = { ...BASE_LOCK, t: Date.now() - EIGHTY_NINE_DAYS_MS };

    const token = await signRefLock(recentLock);
    expect(token).not.toBeNull();

    const result = await verifyRefLock(token!);
    expect(result).not.toBeNull();
    expect(result!.c).toBe('testcode');
  });

  it('documents the near-miss bug: MAX_AGE_MS = REF_LOCK_MAX_AGE (no * 1000) misreads the unit', () => {
    // The near-miss: `MAX_AGE_MS = REF_LOCK_MAX_AGE` then `age > MAX_AGE_MS`.
    //
    // REF_LOCK_MAX_AGE = 7,776,000 seconds.
    // A 90-second-old lock has age_ms = 90_000.
    // 90_000 > 7_776_000 is FALSE — so a 90-second-old lock passes: it never expires.
    //
    // That means every referral attribution lock would be permanent, never cleaned
    // up, and agents would never lose stale locks they should lose after 90 days.
    //
    // The CORRECT comparison is: age_ms > REF_LOCK_MAX_AGE * 1000 (converting to ms).
    //
    // This test asserts the arithmetic that makes the correct path right:
    const NINETY_SECONDS_MS = 90 * 1000;
    const WRONG_THRESHOLD_IF_NO_CONVERSION = REF_LOCK_MAX_AGE; // seconds, used as ms
    // 90 seconds in ms is much less than 90 days in seconds — the comparison never fires:
    expect(NINETY_SECONDS_MS).toBeLessThan(WRONG_THRESHOLD_IF_NO_CONVERSION);

    // And the correct version — 91 days in ms must exceed REF_LOCK_MAX_AGE * 1000:
    const NINETY_ONE_DAYS_MS = 91 * 24 * 60 * 60 * 1000;
    expect(NINETY_ONE_DAYS_MS).toBeGreaterThan(REF_LOCK_MAX_AGE * 1000);
  });
});

describe('REF_LOCK_COOKIE export', () => {
  it('is a non-empty string', () => {
    expect(typeof REF_LOCK_COOKIE).toBe('string');
    expect(REF_LOCK_COOKIE.length).toBeGreaterThan(0);
  });
});
