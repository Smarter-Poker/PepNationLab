/**
 * Unit tests for the Match Me To A Peptide scoring engine.
 *
 * Pure in-memory tests. No DB, no network. We build synthetic Compound rows
 * to exercise the hard gates (evidence comfort, WADA, risk) and the ranking
 * + result-cap behavior.
 */

import { describe, it, expect } from 'vitest';
import type { Compound } from '@/lib/compounds';
import { scoreCompounds, type MatchInput } from '@/lib/match-engine';

function makeCompound(overrides: Partial<Compound> & { slug: string; display_name: string }): Compound {
  const base: Compound = {
    slug: 'placeholder',
    display_name: 'Placeholder',
    aliases: [],
    category: null,
    evidence_tier: 'preclinical',
    compound_class: null,
    molecular_target: null,
    identity: {},
    mechanism: null,
    studied_for: [],
    research_areas: [],
    benefits: null,
    side_effects: null,
    warnings: null,
    handling: {},
    regulatory: null,
    wada_status: 'permitted',
    sources: [],
    plain_summary: null,
    is_temp_sensitive: false,
    is_pro_angiogenic: false,
    is_glp1: false,
    is_stack: false,
    stack_components: [],
    stack_rationale: null,
    risk_level: 'low',
    risk_reasons: [],
    recommended_action: 'keep',
    reconstitution_shelf_days: null,
    half_life: null,
    pk_summary: null,
  };
  return { ...base, ...overrides };
}

const baseInput: MatchInput = {
  goal: 'metabolic',
  evidenceComfort: 'any',
  wadaConstraint: 'no_constraint',
  riskTolerance: 'any',
};

describe('scoreCompounds — evidence-comfort gate', () => {
  it('strict_human_only filters out preclinical and research_chemical compounds', () => {
    const compounds: Compound[] = [
      makeCompound({
        slug: 'approved',
        display_name: 'Approved Drug',
        evidence_tier: 'approved_drug',
        research_areas: ['metabolic'],
      }),
      makeCompound({
        slug: 'preclin',
        display_name: 'Preclinical Compound',
        evidence_tier: 'preclinical',
        research_areas: ['metabolic'],
      }),
      makeCompound({
        slug: 'rc',
        display_name: 'Research Chemical Compound',
        evidence_tier: 'research_chemical',
        research_areas: ['metabolic'],
      }),
    ];

    const { matches: results } = scoreCompounds(
      { ...baseInput, evidenceComfort: 'strict_human_only' },
      compounds,
    );

    expect(results.map((r) => r.slug)).toEqual(['approved']);
    expect(results.find((r) => r.slug === 'preclin')).toBeUndefined();
    expect(results.find((r) => r.slug === 'rc')).toBeUndefined();
  });

  it('investigational_ok includes approved + investigational and excludes preclinical', () => {
    const compounds: Compound[] = [
      makeCompound({
        slug: 'approved',
        display_name: 'Approved',
        evidence_tier: 'approved_drug',
        research_areas: ['metabolic'],
      }),
      makeCompound({
        slug: 'invest',
        display_name: 'Investigational',
        evidence_tier: 'investigational',
        research_areas: ['metabolic'],
      }),
      makeCompound({
        slug: 'preclin',
        display_name: 'Preclinical',
        evidence_tier: 'preclinical',
        research_areas: ['metabolic'],
      }),
    ];

    const { matches: results } = scoreCompounds(
      { ...baseInput, evidenceComfort: 'investigational_ok' },
      compounds,
    );

    const slugs = results.map((r) => r.slug).sort();
    expect(slugs).toEqual(['approved', 'invest']);
  });
});

describe('scoreCompounds — WADA gate', () => {
  it('wada_permitted_only filters out WADA-prohibited compounds', () => {
    const compounds: Compound[] = [
      makeCompound({
        slug: 'clean',
        display_name: 'Clean Compound',
        wada_status: 'permitted',
        research_areas: ['metabolic'],
      }),
      makeCompound({
        slug: 'banned',
        display_name: 'Banned Compound',
        wada_status: 'prohibited',
        research_areas: ['metabolic'],
      }),
      makeCompound({
        slug: 'banned-males',
        display_name: 'Banned Males Compound',
        wada_status: 'prohibited_males',
        research_areas: ['metabolic'],
      }),
      makeCompound({
        slug: 'unlisted',
        display_name: 'Unlisted Compound',
        wada_status: 'not_listed',
        research_areas: ['metabolic'],
      }),
    ];

    const { matches: results } = scoreCompounds(
      { ...baseInput, wadaConstraint: 'wada_permitted_only' },
      compounds,
    );

    const slugs = results.map((r) => r.slug).sort();
    expect(slugs).toEqual(['clean', 'unlisted']);
    expect(results.find((r) => r.slug === 'banned')).toBeUndefined();
    expect(results.find((r) => r.slug === 'banned-males')).toBeUndefined();
  });

  it('no_constraint keeps WADA-prohibited compounds in the running', () => {
    const compounds: Compound[] = [
      makeCompound({
        slug: 'banned',
        display_name: 'Banned Compound',
        wada_status: 'prohibited',
        research_areas: ['metabolic'],
      }),
    ];

    const { matches: results } = scoreCompounds(
      { ...baseInput, wadaConstraint: 'no_constraint' },
      compounds,
    );

    expect(results.map((r) => r.slug)).toEqual(['banned']);
  });
});

describe('scoreCompounds — risk gate', () => {
  it('low_only excludes any compound with risk_level=high', () => {
    const compounds: Compound[] = [
      makeCompound({
        slug: 'low',
        display_name: 'Low Risk',
        risk_level: 'low',
        research_areas: ['metabolic'],
      }),
      makeCompound({
        slug: 'mod',
        display_name: 'Moderate Risk',
        risk_level: 'moderate',
        research_areas: ['metabolic'],
      }),
      makeCompound({
        slug: 'high',
        display_name: 'High Risk',
        risk_level: 'high',
        research_areas: ['metabolic'],
      }),
      makeCompound({
        slug: 'crit',
        display_name: 'Critical Risk',
        risk_level: 'critical',
        research_areas: ['metabolic'],
      }),
    ];

    const { matches: results } = scoreCompounds(
      { ...baseInput, riskTolerance: 'low_only' },
      compounds,
    );

    expect(results.map((r) => r.slug)).toEqual(['low']);
    expect(results.find((r) => r.slug === 'high')).toBeUndefined();
  });

  it('moderate_ok excludes high and critical but keeps moderate and low', () => {
    const compounds: Compound[] = [
      makeCompound({ slug: 'low', display_name: 'Low Risk', risk_level: 'low', research_areas: ['metabolic'] }),
      makeCompound({
        slug: 'mod',
        display_name: 'Moderate Risk',
        risk_level: 'moderate',
        research_areas: ['metabolic'],
      }),
      makeCompound({
        slug: 'high',
        display_name: 'High Risk',
        risk_level: 'high',
        research_areas: ['metabolic'],
      }),
    ];

    const { matches: results } = scoreCompounds(
      { ...baseInput, riskTolerance: 'moderate_ok' },
      compounds,
    );

    const slugs = results.map((r) => r.slug).sort();
    expect(slugs).toEqual(['low', 'mod']);
  });
});

describe('scoreCompounds — ranking and cap', () => {
  it('returns results sorted by score descending', () => {
    const compounds: Compound[] = [
      // No research_areas hit, only keyword match -> +20 + comfort
      makeCompound({
        slug: 'weak',
        display_name: 'Weak Match',
        evidence_tier: 'preclinical',
        category: 'Metabolic Adjacent',
      }),
      // research_areas exact + keyword + glp1 nudge -> 50 + 20 + 15 + 5
      makeCompound({
        slug: 'strong',
        display_name: 'Strong Match',
        evidence_tier: 'preclinical',
        category: 'Metabolic',
        research_areas: ['metabolic'],
        is_glp1: true,
      }),
      // research_areas exact only -> +50 + +15 (comfort) = 65
      makeCompound({
        slug: 'mid',
        display_name: 'Mid Match',
        evidence_tier: 'preclinical',
        research_areas: ['metabolic'],
      }),
    ];

    const { matches: results } = scoreCompounds(
      { ...baseInput, evidenceComfort: 'preclinical_ok' },
      compounds,
    );

    expect(results.length).toBeGreaterThanOrEqual(2);
    // Top score should be 'strong'
    expect(results[0].slug).toBe('strong');
    // Scores must be in non-increasing order.
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it('returns at most 5 results', () => {
    const compounds: Compound[] = [];
    for (let i = 0; i < 12; i++) {
      compounds.push(
        makeCompound({
          slug: `c-${i}`,
          display_name: `Compound ${i}`,
          evidence_tier: 'preclinical',
          research_areas: ['metabolic'],
        }),
      );
    }

    const { matches: results } = scoreCompounds(baseInput, compounds);
    expect(results.length).toBe(5);
  });

  it('drops compounds that match no goal signal at all', () => {
    const compounds: Compound[] = [
      makeCompound({
        slug: 'no-signal',
        display_name: 'No Signal Compound',
        evidence_tier: 'approved_drug',
        // research_areas empty, no metabolic keyword anywhere
      }),
      makeCompound({
        slug: 'with-signal',
        display_name: 'With Signal Compound',
        evidence_tier: 'approved_drug',
        research_areas: ['metabolic'],
      }),
    ];

    const { matches: results } = scoreCompounds(baseInput, compounds);
    expect(results.map((r) => r.slug)).toEqual(['with-signal']);
  });
});
