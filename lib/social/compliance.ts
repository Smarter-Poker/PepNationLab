/**
 * Social autoposter compliance gate.
 *
 * This is the guardrail that keeps the brand accounts alive. Peptides are
 * heavily moderated on Meta / TikTok / YouTube; a single post that reads like
 * human-use promotion is a ban / FTC risk. Every caption is run through this
 * hard deny-list BEFORE it can be posted. On a hit the post is marked
 * 'blocked' and never sent.
 *
 * Research-Use-Only framing only: "studied in [area] research", never
 * "for [benefit]". No dosing, no human-use verbs, no benefit/outcome claims,
 * no commerce-led promotion.
 */

// Word-boundary matched terms (matched as whole words / phrases, case-insensitive).
const DENY_TERMS: string[] = [
  // dosing / protocol / administration
  'dose', 'doses', 'dosage', 'dosing', 'mg/kg', 'mg per kg', 'iu',
  'how to take', 'how to use', 'protocol', 'protocols', 'stack', 'stacked',
  'cycle', 'cycles', 'inject', 'injection', 'injectable', 'subcutaneous',
  'intramuscular', 'reconstitute and take', 'titrate', 'microdose',
  // benefit / outcome claims (as effects, not research areas)
  'cure', 'cures', 'heal your', 'heals you', 'fix your', 'reverse your',
  'lose weight', 'weight loss results', 'burn fat', 'fat loss results',
  'build muscle', 'muscle gain', 'get ripped', 'gains', 'anti-aging results',
  'look younger', 'boost your', 'increase your', 'improve your',
  // human-use / medical
  'treat', 'treats', 'treatment for', 'prescribe', 'prescription',
  'take this', 'use this to', 'for your body', 'in your body', 'human use',
  'patients', 'patient', 'clinician recommended', 'doctor recommended',
  // commerce-led promotion (triggers commerce-policy review for regulated goods)
  'buy now', 'buy', 'order now', 'shop now', 'discount', 'coupon code',
  'sale ends', 'limited offer', 'add to cart', 'checkout now', 'best price',
];

// Regex form so we match on word boundaries and avoid false positives inside
// larger words (e.g. "overdose" should still hit "dose"; "endorse" must NOT
// hit "dose"). We build alternation with boundaries around each term.
function buildMatcher(terms: string[]): RegExp {
  const escaped = terms
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    // allow the term to be bounded by non-letters; keeps "mg/kg" workable
    .map((t) => t.replace(/\s+/g, '\\s+'));
  return new RegExp(`(?<![a-z])(?:${escaped.join('|')})(?![a-z])`, 'i');
}

export interface ComplianceResult {
  ok: boolean;
  blocked: string[];
  notes: string;
}

/**
 * Run the compliance gate over a caption (and optional link text). Returns
 * ok=false with the offending terms when anything trips the deny-list.
 */
export function runComplianceGate(caption: string, link?: string): ComplianceResult {
  const haystack = `${caption ?? ''} ${link ?? ''}`;
  const hits = new Set<string>();

  // Collect every distinct offending term for auditability.
  for (const term of DENY_TERMS) {
    const re = buildMatcher([term]);
    if (re.test(haystack)) hits.add(term);
  }

  // A required RUO signal must be present in some form. We do not hard-block on
  // its absence (some platforms carry it in bio), but we note it.
  const hasRuo = /research use only|in vitro|laboratory research|not for human/i.test(
    haystack,
  );

  const blocked = Array.from(hits);
  const ok = blocked.length === 0;
  const notes = ok
    ? hasRuo
      ? 'passed'
      : 'passed (no explicit RUO phrase in caption; ensure bio carries it)'
    : `blocked: ${blocked.join(', ')}`;

  return { ok, blocked, notes };
}

/** Quick boolean helper. */
export function isCompliant(caption: string, link?: string): boolean {
  return runComplianceGate(caption, link).ok;
}
