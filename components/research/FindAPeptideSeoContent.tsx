/**
 * FindAPeptideSeoContent - SERVER component (no 'use client').
 *
 * /find-a-peptide renders only the dynamic goal-selector artwork
 * (DiscoveryHero), which carries no crawlable text. This block renders the
 * page's real semantic content - an H1, an intro, every research-goal area,
 * how the match engine works, and an FAQ - into the initial HTML, visually
 * hidden via the site-wide clip-rect pattern (crawler- and screen-reader-
 * accessible; it mirrors the tool's real function, NOT hidden keyword
 * stuffing). Title Case on headings/labels. No emojis. Do not remove.
 */

import Link from 'next/link';
import { RESEARCH_AREAS } from '@/lib/compounds';
import { DEFAULT_STORE_SLUG } from '@/lib/default-store';

export const FIND_A_PEPTIDE_FAQS: { q: string; a: string }[] = [
  {
    q: 'What does the peptide match engine do?',
    a: 'It ranks Pep Nation Lab’s research-grade compound catalog against a stated research goal, evidence-tier comfort, and risk tolerance, then returns the best-matched candidate compounds for in vitro laboratory research. It is an educational suggestion tool, not medical advice.',
  },
  {
    q: 'How is the match score calculated?',
    a: 'Each compound receives a transparent, additive score out of 100: an exact research-area match, cumulative goal-keyword relevance, an evidence-tier gradient (stronger human evidence ranks higher), class synergy, and research interest derived from citation and active-trial counts, with optional budget shaping. The full breakdown is shown on each result.',
  },
  {
    q: 'What is evidence-tier comfort?',
    a: 'It sets how much human evidence you require: approved drugs only, investigational or better, preclinical or better, or any level. Compounds below your chosen threshold are excluded from the results entirely.',
  },
  {
    q: 'What does risk tolerance control?',
    a: 'It hard-excludes compounds above your chosen research-risk classification. You can allow low risk only, low or moderate risk, or any risk level.',
  },
  {
    q: 'Are the results medical advice?',
    a: 'No. The engine restates cataloged laboratory facts for research framing only. Every compound is Research Use Only and is not for human or animal consumption, ingestion, or injection.',
  },
];

const POPULAR_COMPOUNDS: [string, string][] = [
  ['bpc-157', 'BPC-157'],
  ['tb-500', 'TB-500'],
  ['semaglutide', 'Semaglutide'],
  ['tirzepatide', 'Tirzepatide'],
  ['ghk-cu', 'GHK-Cu'],
  ['ipamorelin', 'Ipamorelin'],
  ['cjc-1295-dac', 'CJC-1295'],
  ['retatrutide', 'Retatrutide'],
  ['nad-plus', 'NAD+'],
  ['epithalon', 'Epithalon'],
];

export default function FindAPeptideSeoContent() {
  const areas = Object.entries(RESEARCH_AREAS) as [string, { label: string; blurb: string }][];

  return (
    <section
      aria-label="Find A Peptide By Your Research Goal"
      style={{
        position: 'absolute',
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}
    >
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <h1>Find A Peptide By Your Research Goal</h1>

        <p>
          The Pep Nation Lab Peptide Match Engine Helps Qualified Researchers Discover The Most Relevant
          Research-Grade Compounds By Research Goal, Evidence Tier, And Research-Risk Tolerance. Choose A
          Research Area - Weight Management And Fat Loss, Tissue Repair, Healing And Recovery, Performance
          And Muscle, Skin And Hair, Cognitive, Pain And Inflammation, And More - Or Describe Your Goal In
          Plain Language, And The Engine Ranks The Best-Matched Candidate Peptides From The 300+ Compound
          Research Library.
        </p>

        <p>
          Everything On This Page Is Provided Strictly For In Vitro Laboratory Research Use Only And Is Not
          For Human Consumption, Diagnosis, Or Treatment. See The{' '}
          <Link href="/disclaimer">Full Research Disclaimer</Link>,{' '}
          <Link href="/compliance">Compliance Policy</Link>, And{' '}
          <Link href="/terms">Terms Of Service</Link>.
        </p>

        <h2>Match Peptides By Research Goal</h2>
        <ul>
          {areas.map(([slug, meta]) => (
            <li key={slug}>
              <Link href={`/research/area/${slug}`}>{meta.label} Peptides</Link>
              <p>{meta.blurb}</p>
            </li>
          ))}
        </ul>

        <h2>How The Match Engine Works</h2>
        <p>
          The Pep Nation Lab Match Engine Is A Deterministic, Explainable Ranking Tool For The Research-Grade
          Compound Catalog. You Describe A Primary Research Goal, How Much Human Evidence You Require, And
          Your Research-Risk Tolerance; The Engine Hard-Excludes Compounds That Fall Outside Your Constraints,
          Then Ranks The Rest With A Transparent, Additive Score Out Of 100. Every Result Shows Exactly How
          Its Score Was Built.
        </p>
        <h3>Goal Relevance</h3>
        <p>
          An Exact Research-Area Tag Is The Strongest Signal, With Additional Credit For Cumulative
          Goal-Keyword Mentions Across A Compound Mechanism, Class, And Studied-For Entries.
        </p>
        <h3>Evidence Tier</h3>
        <p>
          Stronger Human Evidence Ranks Higher On A Gradient From Approved Drugs Down Through Investigational,
          Preclinical, Research-Compound, And Cosmetic Tiers.
        </p>
        <h3>Research Interest</h3>
        <p>
          Cataloged Citation And Active-Trial Counts Separate Heavily Studied Compounds From Obscure Ones At
          The Same Evidence Tier, So The Ranking Reflects Real Research Depth.
        </p>

        <h2>Frequently Asked Questions</h2>
        {FIND_A_PEPTIDE_FAQS.map((f) => (
          <div key={f.q}>
            <h3>{f.q}</h3>
            <p>{f.a}</p>
          </div>
        ))}

        <h2>Continue Your Research</h2>
        <ul>
          <li><Link href="/research">Peptide Research Library</Link></li>
          <li><Link href="/research/match">Match Me To A Peptide</Link></li>
          <li><Link href="/research/compare">Compare Compounds</Link></li>
          <li><Link href="/research/calculators">Reconstitution Calculators</Link></li>
          <li><Link href="/peptide-101">Peptide 101 Research Academy</Link></li>
          <li><Link href={`/${DEFAULT_STORE_SLUG}`}>Browse The Pep Nation Research Store</Link></li>
        </ul>

        <h2>Popular Research Compounds</h2>
        <ul>
          {POPULAR_COMPOUNDS.map(([slug, name]) => (
            <li key={slug}>
              <Link href={`/research/${slug}`}>{name} Research</Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
