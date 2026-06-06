/**
 * Server-side helpers for the v2 availability endpoint. Pure TypeScript so
 * the helpers are unit-test friendly and the route handler stays small.
 *
 * Used by:
 * - app/api/availability/route.ts (the live uniqueness probe)
 * - app/api/availability/suggest/route.ts (alternative-name endpoint)
 * - app/api/agent/storefront-slug/route.ts (server-side guard)
 * - app/api/storefront/register/route.ts  (server-side guard)
 */

/* ── Normalization ───────────────────────────────────────────────────────── */

/**
 * NFKC fold + trim. Lowercases for slug / username paths (caller decides).
 * Crucially folds full-width latin (e.g., 'ｍｉｄｗａｙ') to plain ASCII so a
 * single canonical form goes to the DB.
 */
export function normalizeNfkc(raw: string): string {
  return String(raw ?? '').normalize('NFKC').trim();
}

/* ── Homoglyph / mixed-script guard ──────────────────────────────────────── */

/**
 * Block scripts mixed into a Latin-base slug. We use a small confusable map
 * (Cyrillic + Greek lookalikes) because the long tail produces false positives
 * on legitimate non-Latin names - but mixed-script slugs are always suspicious.
 *
 * Detection: if the string contains ANY codepoint above the Basic Latin range
 * AND the field is 'slug' or 'username', reject. Display_name is more
 * permissive - we still flag mixed-script + Latin-base, but allow purely
 * non-Latin display names through.
 */
export function isMixedScriptLatinSuspect(s: string): boolean {
  // ASCII letters present?
  let hasLatin = false;
  let hasNonAscii = false;
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    if ((code >= 0x41 && code <= 0x5A) || (code >= 0x61 && code <= 0x7A)) hasLatin = true;
    if (code > 0x7F) hasNonAscii = true;
    if (hasLatin && hasNonAscii) return true;
  }
  return false;
}

/**
 * Cheap confusable check - does the string contain a Cyrillic / Greek code
 * point that visually resembles a Latin letter? Useful for usernames where
 * we allow some Unicode but want to reject homoglyph attacks.
 */
const CONFUSABLE_CODEPOINTS = new Set<number>([
  0x0430, 0x0435, 0x043E, 0x0440, 0x0441, 0x0443, 0x0445, 0x0451, // а е о р с у х ё
  0x0410, 0x0415, 0x041E, 0x0420, 0x0421, 0x0425, 0x0422, 0x041D, // А Е О Р С Х Т Н
  0x03B1, 0x03B5, 0x03BF, 0x03C1, 0x03C5, 0x03BD, // α ε ο ρ υ ν
  0x03A1, 0x03A4, 0x0391, 0x0392, 0x0395, 0x03A5, // Ρ Τ Α Β Ε Υ
]);

export function containsConfusableCodepoint(s: string): boolean {
  for (const ch of s) {
    if (CONFUSABLE_CODEPOINTS.has(ch.codePointAt(0)!)) return true;
  }
  return false;
}

/* ── Edit distance + similar-name detection ─────────────────────────────── */

/**
 * Levenshtein with early termination at maxDist + 1 - O(m*n) worst case but
 * we bail as soon as we know the answer is > maxDist.
 */
export function levenshtein(a: string, b: string, maxDist = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > maxDist) return maxDist + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/**
 * Returns true when the candidate is visually close enough to the existing
 * name that we should surface a soft "similar to existing" warning. Tuned
 * conservatively - false positives here are annoying.
 *
 * Rule:
 *   - exact match: not similar (it's already a collision, caller handles)
 *   - Levenshtein ≤ 2: similar
 *   - shared leading-prefix ≥ 4 chars AND length delta ≤ 2: similar
 */
export function isSimilarName(candidate: string, existing: string): boolean {
  if (candidate === existing) return false;
  const dist = levenshtein(candidate, existing, 2);
  if (dist <= 2) return true;
  const shared = sharedPrefixLength(candidate, existing);
  if (shared >= 4 && Math.abs(candidate.length - existing.length) <= 2) return true;
  return false;
}

function sharedPrefixLength(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a.charCodeAt(i) === b.charCodeAt(i)) i++;
  return i;
}

/* ── Suggestion generators ──────────────────────────────────────────────── */

/**
 * Given a colliding slug, generate up to 8 candidate alternatives. The
 * caller is expected to filter these against the DB and return the first 5
 * that are actually free.
 */
export function generateSlugSuggestions(slug: string): string[] {
  const base = slug.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!base) return [];
  const out = new Set<string>();
  // Year + numeric suffixes
  out.add(`${base}-lab`);
  out.add(`${base}-research`);
  out.add(`${base}-2`);
  out.add(`${base}-3`);
  out.add(`${base}-x`);
  out.add(`${base}-pep`);
  // Dehyphen / rehyphen variants
  const dehy = base.replace(/-/g, '');
  if (dehy !== base && dehy.length >= 3) out.add(dehy);
  const splitH = base.split(/(?<=[a-z])(?=[0-9])|(?<=[0-9])(?=[a-z])/);
  if (splitH.length > 1) out.add(splitH.join('-'));
  // Drop trailing 's'
  if (base.endsWith('s') && base.length >= 4) out.add(base.slice(0, -1));
  // Add leading 'the-' if it would still be ≤ 30 chars
  if (base.length + 4 <= 30) out.add(`the-${base}`);
  return Array.from(out).filter((s) => s !== base && s.length >= 3 && s.length <= 30).slice(0, 8);
}

/**
 * Given a colliding display name, generate up to 8 candidate alternatives.
 */
export function generateDisplayNameSuggestions(name: string): string[] {
  const trimmed = name.trim();
  if (!trimmed) return [];
  const out = new Set<string>();
  out.add(`${trimmed} Lab`);
  out.add(`${trimmed} Research`);
  out.add(`${trimmed} 2`);
  out.add(`${trimmed} II`);
  out.add(`${trimmed} Group`);
  out.add(`${trimmed} Co`);
  out.add(`The ${trimmed}`);
  out.add(`${trimmed} Studio`);
  return Array.from(out).filter((s) => s !== trimmed && s.length >= 2 && s.length <= 60).slice(0, 8);
}

/* ── Profanity / brand cheap check ──────────────────────────────────────── */

/**
 * Tiny embedded substring blocklist. The authoritative list lives in the
 * reserved_slugs DB table; this is just the cheap "reject before DB" check
 * so the most common shock-attempts don't burn a round-trip.
 */
const EMBEDDED_PROFANITY = [
  'fuck', 'shit', 'cunt', 'porn', 'xxx', 'nazi', 'hitler', 'rape', 'kkk', 'nigger',
];

export function containsProfanity(s: string): boolean {
  const lower = s.toLowerCase();
  return EMBEDDED_PROFANITY.some((bad) => lower.includes(bad));
}

/* ── Constants exported for the route ───────────────────────────────────── */

export const POLITELY_REJECT_REASON = 'That Name Is Reserved By The Platform.';
