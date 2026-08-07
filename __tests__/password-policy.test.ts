/**
 * PASSWORD POLICY REGRESSION GUARD
 * ---------------------------------------------------------------------------
 * The bug this exists to prevent, in full, so nobody re-introduces it:
 *
 *   The forced first-login page (/account/change-password) told a newly
 *   provisioned agent their password had to be "At Least 12 Characters".
 *   The API it posts to (/api/auth/change-password) rejected anything that was
 *   not EXACTLY 8. /signup, /reset-password, /invite/[token] and every admin /
 *   agent provisioning form each carried their own literal too, and
 *   lib/schemas/auth.ts backed the whole platform with z.string().length(8) --
 *   an EQUALITY check. The result: an agent literally could not set a password.
 *   The page refused the short ones, the API refused the long ones.
 *
 * The root cause was not any single wrong number. It was that the number was
 * written down in ~20 places, so the copies drifted. lib/password-policy.ts is
 * now the ONE definition, and these tests fail the build if a raw length
 * literal or a stale rule string comes back into a password surface.
 *
 * If you are here because this test failed: do not "fix" it by adding your file
 * to an allow-list. Import MIN_PASSWORD_LENGTH / MAX_PASSWORD_LENGTH /
 * PASSWORD_RULE_TEXT / PASSWORD_TOO_SHORT_ERROR / validatePassword from
 * lib/password-policy instead.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
  PASSWORD_RULE_TEXT,
  PASSWORD_TOO_SHORT_ERROR,
  validatePassword,
} from '@/lib/password-policy';
import { PasswordSchema } from '@/lib/schemas/auth';

/* ------------------------------------------------------------------ policy */

describe('password policy', () => {
  it('is a MINIMUM of 8, not an equality', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
    expect(MAX_PASSWORD_LENGTH).toBeGreaterThanOrEqual(64);
  });

  it('accepts any password at or above the minimum', () => {
    expect(validatePassword('abcd1234')).toBeNull();          // exactly 8
    expect(validatePassword('abcd12345')).toBeNull();         // 9
    expect(validatePassword('correct horse battery staple')).toBeNull();
    expect(validatePassword('x'.repeat(MAX_PASSWORD_LENGTH))).toBeNull();
  });

  it('rejects only what it should', () => {
    expect(validatePassword('abc1234')).toBe(PASSWORD_TOO_SHORT_ERROR);  // 7
    expect(validatePassword('')).toBe(PASSWORD_TOO_SHORT_ERROR);
    expect(validatePassword(12345678 as unknown)).toBe(PASSWORD_TOO_SHORT_ERROR); // not a string
    expect(validatePassword(null)).toBe(PASSWORD_TOO_SHORT_ERROR);
    expect(validatePassword('x'.repeat(MAX_PASSWORD_LENGTH + 1))).not.toBeNull();
  });

  it('never advertises an exact length', () => {
    expect(PASSWORD_RULE_TEXT).not.toMatch(/exactly/i);
    expect(PASSWORD_TOO_SHORT_ERROR).not.toMatch(/exactly/i);
    expect(PASSWORD_RULE_TEXT).toMatch(/at least/i);
  });
});

describe('PasswordSchema (lib/schemas/auth) follows the policy', () => {
  it('accepts a longer-than-minimum password', () => {
    // This is the assertion that would have caught the platform-wide bug:
    // the schema was z.string().length(8), so every account-creation route
    // rejected this.
    expect(PasswordSchema.safeParse('correct-horse-battery').success).toBe(true);
    expect(PasswordSchema.safeParse('abcd12345').success).toBe(true);
  });

  it('still rejects too-short, over-long and non-string values', () => {
    expect(PasswordSchema.safeParse('short').success).toBe(false);
    expect(PasswordSchema.safeParse('a'.repeat(MAX_PASSWORD_LENGTH + 1)).success).toBe(false);
    expect(PasswordSchema.safeParse(12345678).success).toBe(false);
  });
});

/* ------------------------------------------------------- source-tree sweep */

const ROOT = process.cwd();
const SCAN_DIRS = ['app', 'components', 'lib'];
const EXTS = ['.ts', '.tsx'];

/** lib/password-policy.ts is the one file allowed to state the numbers. */
const POLICY_FILE = join('lib', 'password-policy.ts');

/** Not compiled / not shipped. */
const SKIP_DIR = new Set(['node_modules', '.next', '__tests__', 'i18n']);

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (SKIP_DIR.has(name)) continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(full, out);
    else if (EXTS.some((e) => name.endsWith(e))) out.push(full);
  }
  return out;
}

const FILES = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)))
  .map((f) => relative(ROOT, f))
  .filter((f) => f !== POLICY_FILE);

/**
 * Copy that states a rule other than "at least 8". Every one of these strings
 * shipped to a real user at some point.
 */
const BANNED_COPY: Array<[RegExp, string]> = [
  [/Exactly\s+8\s+Characters/i, 'says "Exactly 8 Characters"'],
  [/At\s+Least\s+12\s+Characters/i, 'says "At Least 12 Characters"'],
  [/Between\s+8\s+And\s+128\s+Characters/i, 'restates the 8-128 bound'],
  [/Password\s+Must\s+Be\s+Exactly/i, 'says a password must be an exact length'],
];

/** Enforcement written as a raw literal instead of importing the policy. */
const BANNED_CODE: Array<[RegExp, string]> = [
  [/password[A-Za-z0-9_]*\.length\s*!==\s*\d+/i, 'compares a password length with !== (equality rule)'],
  [/password[A-Za-z0-9_]*\.length\s*===\s*\d+/i, 'compares a password length with === (equality rule)'],
  [/\bpw[A-Za-z0-9_]*\.length\s*[!=]==\s*\d+/i, 'compares a password length with an equality rule'],
  [/z\s*\.\s*string\s*\(\s*\)\s*\.\s*length\s*\(\s*\d+/i, 'zod .length(N) on a password-ish schema'],
];

function read(f: string): string {
  try {
    return readFileSync(join(ROOT, f), 'utf8');
  } catch {
    return '';
  }
}

describe('no password-length literal has drifted back into the source tree', () => {
  it('scans a non-trivial number of files (guard against a broken walk)', () => {
    expect(FILES.length).toBeGreaterThan(50);
  });

  it('states no password rule other than the policy', () => {
    const offenders: string[] = [];
    for (const f of FILES) {
      const src = read(f);
      if (!/password/i.test(src)) continue;
      for (const [re, why] of BANNED_COPY) {
        if (re.test(src)) offenders.push(`${f} — ${why}`);
      }
    }
    expect(offenders, `Import PASSWORD_RULE_TEXT / PASSWORD_TOO_SHORT_ERROR from lib/password-policy:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('enforces no password rule with a hardcoded literal', () => {
    const offenders: string[] = [];
    for (const f of FILES) {
      const src = read(f);
      if (!/password/i.test(src)) continue;
      for (const [re, why] of BANNED_CODE) {
        if (re.test(src)) offenders.push(`${f} — ${why}`);
      }
    }
    expect(offenders, `Use validatePassword() or MIN_PASSWORD_LENGTH from lib/password-policy:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('never caps a password input at the minimum (maxLength must not equal 8)', () => {
    // maxLength={8} on a password field is how "at least 8" silently became
    // "exactly 8" in the UI even where the validator was correct.
    const offenders: string[] = [];
    for (const f of FILES) {
      const src = read(f);
      if (!/type="password"|autoComplete="new-password"|autoComplete="current-password"/.test(src)) continue;
      if (/maxLength=\{8\}/.test(src)) offenders.push(`${f} — maxLength={8} on a password input`);
    }
    expect(offenders, `Use maxLength={MAX_PASSWORD_LENGTH}:\n${offenders.join('\n')}`).toEqual([]);
  });
});
