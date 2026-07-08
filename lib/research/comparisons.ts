/**
 * comparisons.ts
 * Curated, high-search-intent compound comparison matchups ("X vs Y").
 *
 * These power the /research/compare/[matchup] landing pages, which target
 * comparison queries the individual monographs do not (e.g. "BPC-157 vs
 * TB-500", "Semaglutide vs Tirzepatide"). Each page is a genuine, data-rich
 * side-by-side built from the compound database - not thin templated content.
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
  // Additional curated, high-intent pairs (all slugs verified in the compounds DB).
  { a: 'cjc-1295-dac', b: 'cjc-1295-no-dac', angle: 'the DAC versus non-DAC forms of the CJC-1295 GHRH analog' },
  { a: 'selank', b: 'semax', angle: 'two Russian-developed nootropic and anxiolytic research peptides' },
  { a: 'ss-31', b: 'mots-c', angle: 'two mitochondrial-targeted peptides in cellular-energy research' },
  { a: 'thymosin-alpha-1', b: 'll-37', angle: 'two immune-modulating research peptides with distinct mechanisms' },
  { a: 'aod9604', b: 'hgh-fragment-176-191', angle: 'two HGH-fragment analogs studied for fat-metabolism research' },
  { a: 'retatrutide', b: 'survodutide', angle: 'next-generation multi-receptor incretin agonists in metabolic research' },
  // Wave 2 curated pairs (all slugs verified in the compounds DB) - high-intent
  // category matchups that expand the indexable comparison surface.
  { a: 'bpc-157', b: 'ghk-cu', angle: 'two leading tissue-repair peptides with distinct healing mechanisms' },
  { a: 'tb-500', b: 'ghk-cu', angle: 'a systemic repair peptide versus a copper peptide for tissue and skin research' },
  { a: 'tesamorelin', b: 'ipamorelin', angle: 'a GHRH analog versus a selective ghrelin-receptor secretagogue on the GH axis' },
  { a: 'tirzepatide', b: 'cagrilintide', angle: 'a dual incretin agonist versus an amylin analog in metabolic research' },
  { a: 'retatrutide', b: 'cagrilintide', angle: 'a triple incretin agonist versus an amylin analog in weight research' },
  { a: 'mots-c', b: '5-amino-1mq', angle: 'two metabolic research compounds targeting mitochondrial and NNMT pathways' },
  { a: 'nad-plus', b: 'mots-c', angle: 'NAD+ metabolism versus a mitochondrial-derived peptide in longevity research' },
  { a: 'ghk-cu', b: 'ahk-cu', angle: 'two copper research peptides studied for skin and hair' },
  { a: 'cjc-1295-dac', b: 'sermorelin', angle: 'a long-acting versus a short-acting GHRH analog' },
  { a: 'ipamorelin', b: 'ghrp-6', angle: 'a selective versus a first-generation ghrelin-receptor secretagogue' },
  { a: 'semaglutide', b: 'cagrisema', angle: 'a GLP-1 agonist versus a GLP-1/amylin combination in metabolic research' },
  { a: 'bpc-157', b: 'kpv', angle: 'two peptides studied for gut and mucosal repair' },
  { a: 'pt-141', b: 'oxytocin', angle: 'melanocortin versus oxytocin pathways in intimacy and libido research' },
  { a: 'thymosin-alpha-1', b: 'thymalin', angle: 'two thymic immune-modulating research peptides' },
  { a: 'selank', b: 'dsip', angle: 'an anxiolytic nootropic versus a sleep-associated research peptide' },
  { a: 'igf-1-lr3', b: 'follistatin', angle: 'direct IGF-1 signaling versus myostatin inhibition in muscle research' },
  { a: 'ss-31', b: 'nad-plus', angle: 'a mitochondrial-targeted peptide versus NAD+ in cellular-energy research' },
];

export function matchupSlug(a: string, b: string): string {
  return `${a}-vs-${b}`;
}

export function findPair(matchup: string): ComparisonPair | null {
  return COMPARISON_PAIRS.find((p) => matchupSlug(p.a, p.b) === matchup) ?? null;
}
