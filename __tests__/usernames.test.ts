import { describe, it, expect } from 'vitest';
import { sanitizeUsername, validateUsername } from '@/lib/usernames';

/**
 * Username sanitizer + validator tests.
 *
 * These are the single source of truth used by every account entry
 * point: admin create-agent, agent create-researcher, storefront
 * self-register, and AccountForm. A regression here silently breaks
 * lookups via the synthetic `${username}@internal.auth` Supabase
 * identity, which is unrecoverable without manual DB intervention.
 */

describe('sanitizeUsername', () => {
  it('lowercases ASCII letters', () => {
    expect(sanitizeUsername('JohnDoe')).toBe('johndoe');
  });

  it('preserves digits and underscores', () => {
    expect(sanitizeUsername('agent_42')).toBe('agent_42');
  });

  it('strips spaces, punctuation, and unicode', () => {
    expect(sanitizeUsername('jane d-oe@x')).toBe('janedoex');
    expect(sanitizeUsername('user.name+tag')).toBe('usernametag');
    expect(sanitizeUsername('café')).toBe('caf'); // é dropped
  });

  it('returns empty string for null-ish input', () => {
    expect(sanitizeUsername('')).toBe('');
    // @ts-expect-error — defensive: production callers may pass undefined
    expect(sanitizeUsername(undefined)).toBe('');
    // @ts-expect-error — defensive: production callers may pass null
    expect(sanitizeUsername(null)).toBe('');
  });

  it('idempotent — sanitize(sanitize(x)) === sanitize(x)', () => {
    const samples = ['Mixed_Case123', 'agent  42', '!!!!', 'ALLCAPS'];
    for (const s of samples) {
      expect(sanitizeUsername(sanitizeUsername(s))).toBe(sanitizeUsername(s));
    }
  });
});

describe('validateUsername', () => {
  it('accepts simple lowercase usernames', () => {
    expect(validateUsername('agent42')).toEqual({ valid: true });
  });

  it('accepts mixed input that sanitizes to a valid username', () => {
    expect(validateUsername('Agent_42')).toEqual({ valid: true });
  });

  it('rejects empty / unsanitizable input', () => {
    expect(validateUsername('').valid).toBe(false);
    expect(validateUsername('!!!').valid).toBe(false);
  });

  it('rejects too-short usernames (< 3 chars after sanitization)', () => {
    const r = validateUsername('ab');
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/3 Characters/i);
  });

  it('accepts 3-char minimum', () => {
    expect(validateUsername('abc')).toEqual({ valid: true });
  });

  it('rejects too-long usernames (> 30 chars after sanitization)', () => {
    const long = 'a'.repeat(31);
    const r = validateUsername(long);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/30 Characters/i);
  });

  it('accepts the 30-char maximum exactly', () => {
    expect(validateUsername('a'.repeat(30))).toEqual({ valid: true });
  });

  it('all error messages use Title Case to match the platform style guide', () => {
    const cases = ['', 'ab', 'a'.repeat(31)];
    for (const c of cases) {
      const r = validateUsername(c);
      if (!r.valid && r.error) {
        // Every word starts with capital
        const words = r.error.replace(/[^a-zA-Z ]/g, '').split(/\s+/).filter(Boolean);
        for (const w of words) {
          expect(w[0]).toBe(w[0].toUpperCase());
        }
      }
    }
  });
});
