import { describe, it, expect } from 'vitest';
import { runComplianceGate, isCompliant } from '../compliance';

/**
 * The compliance gate is the single guard that keeps the brand's social
 * accounts from being banned. Peptides are heavily moderated: one post that
 * reads like human-use promotion is an account ban / FTC exposure.
 *
 * These tests lock in BOTH directions:
 *  - it must block dosing, benefit claims, human-use and commerce language
 *  - it must NOT false-positive on legitimate research phrasing (a gate that
 *    blocks everything is silently useless, because every post ends up
 *    'blocked' and nothing ever ships)
 */

describe('runComplianceGate - blocks non-compliant captions', () => {
  const mustBlock: [string, string][] = [
    ['dosing', 'Recommended dose is 250mcg twice weekly.'],
    ['dosage', 'Check the dosage chart before starting.'],
    ['mg/kg', 'Administer 2 mg/kg in the model.'],
    ['how to take', 'How to take BPC-157 for best results.'],
    ['protocol', 'The 8 week protocol everyone is running.'],
    ['stack', 'A classic stack for recovery.'],
    ['inject', 'Inject subcutaneously each morning.'],
    ['cure', 'This will cure your gut issues.'],
    ['treat', 'Used to treat inflammation.'],
    ['lose weight', 'Lose weight fast with this peptide.'],
    ['burn fat', 'Burn fat while you sleep.'],
    ['build muscle', 'Build muscle in half the time.'],
    ['buy now', 'Buy now while supplies last.'],
    ['discount', 'Use this discount at checkout.'],
    ['human use', 'Approved for human use.'],
    ['boost your', 'Boost your recovery overnight.'],
  ];

  it.each(mustBlock)('blocks %s', (_label, caption) => {
    const res = runComplianceGate(caption);
    expect(res.ok).toBe(false);
    expect(res.blocked.length).toBeGreaterThan(0);
    expect(res.notes).toContain('blocked');
  });

  it('reports every distinct offending term, not just the first', () => {
    const res = runComplianceGate('Buy now and lose weight fast.');
    expect(res.ok).toBe(false);
    expect(res.blocked).toEqual(expect.arrayContaining(['buy now', 'lose weight']));
  });

  it('is case-insensitive', () => {
    expect(runComplianceGate('RECOMMENDED DOSE IS 250MCG').ok).toBe(false);
    expect(runComplianceGate('Buy Now').ok).toBe(false);
  });

  it('also scans the link, not just the caption', () => {
    const res = runComplianceGate(
      'Molecular reference for a research compound.',
      'https://example.com/buy-now',
    );
    expect(res.ok).toBe(false);
  });
});

describe('runComplianceGate - allows compliant research captions', () => {
  const mustPass: string[] = [
    'BPC-157 at a glance (research reference). Molecular facts, not claims. Studied in tissue-repair models. For in vitro laboratory research use only.',
    'What actually IS a peptide? A short chain of amino acids, studied in vitro. For in vitro laboratory research use only.',
    'Half-life, explained simply: the time for half of a substance to be gone. Research context only.',
    'Evidence tiers, explained: from Approved Drug to Research Compound. For in vitro laboratory research use only.',
    'How to read a COA: identity, purity, batch traceability. For in vitro laboratory research use only.',
    'Reconstitution science for the lab: lyophilized powder, gentle diluent addition, swirl - do not shake.',
  ];

  it.each(mustPass)('passes: %s', (caption) => {
    const res = runComplianceGate(caption);
    expect(res.ok).toBe(true);
    expect(res.blocked).toEqual([]);
  });
});

describe('runComplianceGate - word-boundary correctness (no false positives)', () => {
  // A gate that trips on substrings inside innocent words would block almost
  // every real caption. These are the traps.
  const innocent: [string, string][] = [
    ['endorse contains "dose"', 'We do not endorse that interpretation of the data.'],
    ['endoscope contains "dose"', 'Endoscope imaging in the gastric model.'],
    ['strategy contains "rat"', 'Our research strategy is evidence-led.'],
    ['curecumin-like word', 'Curcumin is a separate compound entirely.'],
    ['treaty contains "treat"', 'The treaty governs research imports.'],
    ['stackable is not "stack"', 'The vials are stackable in cold storage.'],
    ['injectable-free phrasing', 'Reconstitution is a laboratory preparation step.'],
  ];

  it.each(innocent)('does not block when %s', (_label, caption) => {
    const res = runComplianceGate(caption);
    expect(res.ok).toBe(true);
  });

  /**
   * Deliberately fail CLOSED: the gate is a keyword guard, not a semantic one,
   * so a negated phrase ("we do not endorse any human use") still blocks. That
   * is the safe direction - a human rewrites the caption, nothing gets banned.
   */
  it('blocks banned phrases even inside a negating sentence (fails closed)', () => {
    const res = runComplianceGate('We do not endorse any human use.');
    expect(res.ok).toBe(false);
    expect(res.blocked).toContain('human use');
  });
});

describe('runComplianceGate - RUO signal reporting', () => {
  it('notes when an RUO phrase is present', () => {
    const res = runComplianceGate('Molecular identity reference. For in vitro laboratory research use only.');
    expect(res.ok).toBe(true);
    expect(res.notes).toBe('passed');
  });

  it('still passes but flags captions with no explicit RUO phrase', () => {
    const res = runComplianceGate('Molecular weight is measured in daltons.');
    expect(res.ok).toBe(true);
    expect(res.notes).toContain('no explicit RUO phrase');
  });
});

describe('isCompliant helper', () => {
  it('mirrors runComplianceGate.ok', () => {
    expect(isCompliant('For in vitro laboratory research use only.')).toBe(true);
    expect(isCompliant('Buy now.')).toBe(false);
  });
});
