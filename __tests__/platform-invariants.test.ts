/**
 * PLATFORM INVARIANTS — the general form of the bug that keeps recurring.
 * ---------------------------------------------------------------------------
 * Every incident below is the SAME bug wearing a different hat: one platform
 * rule, written down in several files, and the copies drifted apart. Nothing
 * throws when they drift. The build is green, the types check, the page
 * renders — and a real person hits a wall that the code says cannot exist.
 *
 *   PASSWORD LENGTH   The forced first-login page demanded "At Least 12
 *                     Characters" while the API it posts to rejected anything
 *                     not EXACTLY 8. No overlap: a new agent could not set a
 *                     password at all. The number lived in ~20 files.
 *
 *   ATTRIBUTION TTL   The signed referral cookie lasted 90 days; the signup
 *                     page's copy of that window said 30. A guest who scanned
 *                     an agent's QR and returned on day 45 was silently
 *                     credited to the house store. Lost commission, no error,
 *                     nothing for the agent to dispute.
 *
 *   SLUG SHAPE        The client's slug regex accepted slugs the middleware
 *                     refused to route, so a storefront was captured by the
 *                     server and dropped by the client.
 *
 * The fix in each case was the same: ONE definition, imported everywhere. This
 * file is what keeps it that way. It is deliberately cheap — no network, no
 * database, no build — so it can run on every push without anyone waiting.
 *
 * WHEN THIS TEST FAILS, DO NOT SUPPRESS IT. Import the shared constant. The
 * failure message names the file and the rule.
 *
 * ADDING A NEW PLATFORM RULE: if a number, regex or piece of user-facing rule
 * copy has to be true in more than one file, export it from a module under
 * lib/ and add it to OWNED_CONSTANTS below. That is the whole process.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import {
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
  validatePassword,
} from '@/lib/password-policy';
import { PasswordSchema } from '@/lib/schemas/auth';
import { REF_LOCK_MAX_AGE } from '@/lib/ref-lock';
import { STORE_SLUG_RE, DB_SLUG_RE } from '@/lib/store-slug';

/* ------------------------------------------------------------------ sweep */

const ROOT = process.cwd();
const SCAN_DIRS = ['app', 'components', 'lib'];
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
    else if (name.endsWith('.ts') || name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

const FILES = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d))).map((f) => relative(ROOT, f));

function read(f: string): string {
  try {
    return readFileSync(join(ROOT, f), 'utf8');
  } catch {
    return '';
  }
}

/**
 * Each shared rule, the ONE module allowed to define it, and why it matters.
 * A re-declaration anywhere else is the drift, caught before it ships.
 */
const OWNED_CONSTANTS: Array<{ name: string; owner: string; why: string }> = [
  { name: 'MIN_PASSWORD_LENGTH', owner: 'lib/password-policy.ts', why: 'password rule' },
  { name: 'MAX_PASSWORD_LENGTH', owner: 'lib/password-policy.ts', why: 'password rule' },
  { name: 'PASSWORD_RULE_TEXT', owner: 'lib/password-policy.ts', why: 'password rule copy' },
  { name: 'PASSWORD_TOO_SHORT_ERROR', owner: 'lib/password-policy.ts', why: 'password rule copy' },
  { name: 'REF_LOCK_MAX_AGE', owner: 'lib/ref-lock.ts', why: 'referral attribution lifetime' },
  { name: 'STORE_SLUG_RE', owner: 'lib/store-slug.ts', why: 'storefront slug shape' },
  { name: 'DB_SLUG_RE', owner: 'lib/store-slug.ts', why: 'storefront slug shape at creation' },
  { name: 'DEFAULT_STORE_SLUG', owner: 'lib/default-store.ts', why: 'house storefront identity' },
];

describe('every shared platform rule has exactly one definition', () => {
  it('walks a real source tree (guard against a silently broken walk)', () => {
    expect(FILES.length).toBeGreaterThan(50);
  });

  for (const { name, owner, why } of OWNED_CONSTANTS) {
    it(`${name} is defined only in ${owner}`, () => {
      // A declaration, not a use: `const X =` / `let X =` / `export const X =`.
      const decl = new RegExp(String.raw`(?:^|\n)\s*(?:export\s+)?(?:const|let|var)\s+${name}\s*[:=]`);
      const offenders = FILES.filter((f) => f !== owner && decl.test(read(f)));
      expect(
        offenders,
        `${name} (${why}) must be imported from ${owner}, not re-declared in:\n${offenders.join('\n')}`
      ).toEqual([]);
    });
  }
});

/* ------------------------------------------- cross-module agreement checks */

describe('the rules agree with each other at runtime', () => {
  it('PasswordSchema accepts exactly what validatePassword accepts', () => {
    // The bug this catches: lib/schemas/auth.ts backed every account-creation
    // route with z.string().length(8) while the policy said "at least 8". Both
    // files looked correct in isolation.
    for (const len of [0, 1, 7, 8, 9, 12, 32, MAX_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH + 1]) {
      const pw = 'a'.repeat(len);
      const policyOk = validatePassword(pw) === null;
      const schemaOk = PasswordSchema.safeParse(pw).success;
      expect(schemaOk, `length ${len}: policy=${policyOk} schema=${schemaOk}`).toBe(policyOk);
    }
  });

  it('the client attribution window equals the signed cookie lifetime', () => {
    // components/AgentLinkCapture.tsx expires its localStorage capture; the
    // edge middleware expires the signed cookie. If those disagree, referral
    // credit is lost in the gap and nobody finds out. The component works in
    // milliseconds and REF_LOCK_MAX_AGE is in SECONDS, so this asserts the
    // CONVERSION as well as the value — dropping the *1000 would expire
    // attribution after 90 seconds instead of 90 days.
    const src = read('components/AgentLinkCapture.tsx');
    expect(src).toContain('REF_LOCK_MAX_AGE');
    const m = src.match(/const\s+MAX_AGE_MS\s*=\s*([^;]+);/);
    expect(m, 'AgentLinkCapture must define MAX_AGE_MS from REF_LOCK_MAX_AGE').toBeTruthy();
    const expr = (m?.[1] ?? '').trim();
    expect(expr, 'MAX_AGE_MS must be derived from REF_LOCK_MAX_AGE, not a literal').toContain(
      'REF_LOCK_MAX_AGE'
    );
    // eslint-disable-next-line no-new-func
    const value = Function('REF_LOCK_MAX_AGE', `return (${expr});`)(REF_LOCK_MAX_AGE);
    expect(value, 'seconds/milliseconds mismatch between the two windows').toBe(
      REF_LOCK_MAX_AGE * 1000
    );
  });

  it('every slug the DB will accept is one the router can route', () => {
    // DB_SLUG_RE guards creation, STORE_SLUG_RE is what proxy.ts matches on an
    // incoming /<slug>. A slug that passes creation but fails routing is a
    // printed QR code pointing at a dead page.
    const samples = [
      'savagebrands', 'a1', 'pep-nation', 'x'.repeat(30), 'store-1',
      'agent-store-name', '0abc', 'z9',
    ];
    for (const s of samples) {
      if (DB_SLUG_RE.test(s)) {
        expect(STORE_SLUG_RE.test(s), `"${s}" is creatable but not routable`).toBe(true);
      }
    }
  });
});

/* ------------------------------------------------ UI/server contradiction */

/**
 * Return just the `<input ... />` elements that are password fields.
 *
 * Scoping matters: an earlier version of this test scanned the whole FILE for
 * `maxLength={N}` whenever the file contained a password input anywhere, and
 * happily flagged the 6-digit MFA code field and the 254-char email field. A
 * guard that cries wolf gets deleted, and then it guards nothing.
 */
function passwordInputs(src: string): string[] {
  const out: string[] = [];
  let i = src.indexOf('type="password"');
  while (i !== -1) {
    const start = src.lastIndexOf('<input', i);
    // Attribute values contain `=>` (arrow functions), so scan for the element
    // terminator rather than assuming no `>` appears inside the tag.
    const end = src.indexOf('/>', i);
    if (start !== -1 && end !== -1) out.push(src.slice(start, end + 2));
    i = src.indexOf('type="password"', i + 1);
  }
  return out;
}

describe('no form advertises a rule the server does not enforce', () => {
  it('no password input is capped at the minimum length', () => {
    // maxLength={8} is how "at least 8" silently became "exactly 8" in the UI
    // even where the validator was right: the field simply refused the 9th
    // keystroke, with no message at all.
    const cap = new RegExp(`maxLength=\\{${MIN_PASSWORD_LENGTH}\\}`);
    const offenders = FILES.filter((f) => passwordInputs(read(f)).some((el) => cap.test(el)));
    expect(
      offenders,
      `Use maxLength={MAX_PASSWORD_LENGTH} from lib/password-policy:\n${offenders.join('\n')}`
    ).toEqual([]);
  });

  it('no password input hardcodes its bounds as number literals', () => {
    const offenders: string[] = [];
    for (const f of FILES) {
      const hits = new Set<string>();
      for (const el of passwordInputs(read(f))) {
        for (const m of el.match(/(?:min|max)Length=\{\d+\}/g) ?? []) hits.add(m);
      }
      if (hits.size) offenders.push(`${f} — ${[...hits].join(', ')}`);
    }
    expect(
      offenders,
      `Password field bounds come from lib/password-policy:\n${offenders.join('\n')}`
    ).toEqual([]);
  });
});
