/**
 * comparisons.ts
 * Curated, high-search-intent compound comparison matchups ("X vs Y").
 *
 * These power the /research/compare/[matchup] landing pages, which target
 * comparison queries the individual monographs do not (e.g. "BPC-157 vs
 * TB-500", "Semaglutide vs Tirzepatide"). Each page is a genuine, data-rich
 * side-by-side built from the compound database — not thin templated content.
 *
 * Slugs MUST exist in the compounds database. Pairs are canonical and curated
 * (a fixed set), so the routes are a controlled, high-quality collection rather
 * than an open combinatorial explosion of thin pages.
 */

export interface ComparisonPair {
  a: string; // compound slug
  b: string; // compound slug
  angle: string; // short, unique framing used in intro copy + meta description
}

export const COMPARISON_PAIRS: ComparisonPair[] = [
  { a: 'bpc-157', b: 'tb-500', angle: 'the two most-studied research peptides for tissue repair and recovery' },
  { a: 'semaglutide', b: 'tirzepatide', angle: 'single GLP-1 versus dual GLP-1/GIP incretin agonists in metabolic research' },
  { a: 'tirzepatide', b: 'retatrutide', angle: 'dual versus triple incretin receptor agonists in weight-research models' },
  { a: 'semaglutide', b: 'retatrutide', angle: 'a GLP-1 agonist versus a triple-agonist incretin in metabolic research' },
  { a: 'cjc-1295-dac', b: 'ipamorelin', angle: 'a GHRH analog versus a selective ghrelin-receptor secretagogue' },
  { a: 'ipamorelin', b: 'sermorelin', angle: 'a ghrelin-receptor secretagogue versus a GHRH analog for growth-hormone research' },
  { a: 'sermorelin', b: 'tesamorelin', angle: 'two GHRH analogs studied on the growth-hormone axis' },
  { a: 'ghrp-2', b: 'ghrp-6', angle: 'the two first-generation growth-hormone releasing peptides' },
  { a: 'cagrilintide', b: 'semaglutide', angle: 'an amylin analog versus a GLP-1 agonist in metabolic research' },
  { a: 'mots-c', b: 'aod9604', angle: 'a mitochondrial-derived peptide versus an HGH fragment in metabolic research' },
  { a: 'pt-141', b: 'kisspeptin-10', angle: 'melanocortin versus kisspeptin pathways in reproductive research' },
  { a: 'epithalon', b: 'nad-plus', angle: 'a telomerase-pathway peptide versus NAD+ metabolism in longevity research' },
  { a: 'hexarelin', b: 'ipamorelin', angle: 'a potent versus a highly selective ghrelin-receptor secretagogue' },
  { a: 'cjc-1295-dac', b: 'tesamorelin', angle: 'two GHRH analogs with contrasting half-life profiles' },
  { a: 'igf-1-lr3', b: 'ipamorelin', angle: 'a direct IGF-1 analog versus a growth-hormone secretagogue' },
];

export function matchupSlug(a: string, b: string): string {
  return `${a}-vs-${b}`;
}

export function findPair(matchup: string): ComparisonPair | null {
  return COMPARISON_PAIRS.find((p) => matchupSlug(p.a, p.b) === matchup) ?? null;
}
