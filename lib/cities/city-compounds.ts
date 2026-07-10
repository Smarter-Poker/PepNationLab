/**
 * city-compounds.ts
 *
 * Curated flagship compound list for the compound-city landing page layer
 * (URL pattern: /peptides/{stateSlug}/{citySlug}/{compoundSlug}, e.g.
 * /peptides/illinois/oak-lawn/bpc-157).
 *
 * Each entry is a high-search-volume compound that exists in BOTH systems:
 *   1. the research library (`compounds.slug` -> /research/{slug} monograph), and
 *   2. the live house storefront (`researchstore`), matched by the store
 *      product's `products.compound_slug`.
 *
 * For every compound below, the research-library slug and the store
 * `compound_slug` are identical, so a single `slug` field drives the URL, the
 * monograph deep link, and the live price lookup. (PT-141 was intentionally
 * excluded: it exists in the research library but is not sold in the live
 * store, so it would fail the both-systems requirement.)
 *
 * Pure data module - no server imports, safe to import anywhere. Positioning
 * copy is authored in Title Case, research-use-only framing, no medical claims.
 */

export interface CityCompound {
  /** Research library slug AND store compound_slug (identical for all entries).
   *  Drives the [compoundSlug] URL segment, the /research/{slug} monograph link,
   *  and the live store price match. */
  slug: string;
  /** Display name for the H1 and cards, e.g. "BPC-157". */
  displayName: string;
  /** Common / popular alias shown as a supporting tag, e.g. "Body Protection Compound". */
  popularName: string;
  /** Two-to-three-sentence unique positioning copy (Title Case, RUO framing). */
  positioning: string;
}

export const CITY_COMPOUNDS: CityCompound[] = [
  {
    slug: 'bpc-157',
    displayName: 'BPC-157',
    popularName: 'Body Protection Compound',
    positioning:
      'BPC-157 Is Among The Most Requested Research Peptides In Our Catalog, Studied Extensively For Its Role In Cellular Repair And Angiogenesis Pathways. Independent Laboratories Reference It Across Tissue-Repair And Cytoprotection Research Models. Every Vial Ships Research-Grade With Full Batch COA Documentation, For In Vitro Laboratory Use Only.',
  },
  {
    slug: 'tb-500',
    displayName: 'TB-500',
    popularName: 'Thymosin Beta-4',
    positioning:
      'TB-500 Is A Synthetic Fragment Of The Thymosin Beta-4 Protein, Widely Referenced In Actin-Regulation And Cell-Migration Research. It Is Frequently Paired With BPC-157 In Recovery-Focused Laboratory Study Designs. Supplied Strictly For In Vitro Research, With Certificate-Of-Analysis Documentation On Every Batch.',
  },
  {
    slug: 'semaglutide',
    displayName: 'Semaglutide',
    popularName: 'GLP-1 Receptor Agonist',
    positioning:
      'Semaglutide Is A GLP-1 Receptor Agonist That Anchors Modern Metabolic And Appetite-Signaling Research. It Remains One Of The Most Studied Compounds In Its Class, With Thousands Of Published Citations. Pep Nation Lab Supplies It As A Research-Grade Compound For In Vitro Laboratory Work Only.',
  },
  {
    slug: 'tirzepatide',
    displayName: 'Tirzepatide',
    popularName: 'Dual GIP And GLP-1 Agonist',
    positioning:
      'Tirzepatide Is A Dual GIP And GLP-1 Receptor Co-Agonist That Has Become A Cornerstone Of Incretin Research. Its Twin-Receptor Mechanism Makes It A Frequent Reference Point In Comparative Metabolic Studies. Every Order Is Research-Grade, Batch-Tested, And Intended Strictly For In Vitro Use.',
  },
  {
    slug: 'retatrutide',
    displayName: 'Retatrutide',
    popularName: 'Triple Receptor Agonist',
    positioning:
      'Retatrutide Is An Investigational Triple Agonist Targeting The GIP, GLP-1, And Glucagon Receptors, Placing It At The Frontier Of Metabolic Research. Its Three-Pathway Design Draws Strong Interest From Independent Laboratories. Supplied Research-Grade For In Vitro Analysis Only, With Full Batch Documentation.',
  },
  {
    slug: 'cjc-1295-no-dac',
    displayName: 'CJC-1295 Without DAC',
    popularName: 'Mod GRF 1-29',
    positioning:
      'CJC-1295 Without DAC Is A Short-Acting GHRH Analog Studied For Its Role In Pulsatile Growth-Hormone Signaling Research. It Is Commonly Referenced Alongside Ipamorelin In Growth-Axis Laboratory Models. Provided As A Research-Grade Compound For In Vitro Use, With Batch COA On Every Vial.',
  },
  {
    slug: 'ipamorelin',
    displayName: 'Ipamorelin',
    popularName: 'Selective GHRP',
    positioning:
      'Ipamorelin Is A Highly Selective Growth-Hormone Secretagogue Prized In Research For Its Clean Receptor Profile. It Appears Frequently In Growth-Axis And Recovery Study Designs Across Independent Labs. Every Vial Ships Research-Grade And Is Intended Strictly For In Vitro Laboratory Research.',
  },
  {
    slug: 'ghk-cu',
    displayName: 'GHK-Cu',
    popularName: 'Copper Peptide',
    positioning:
      'GHK-Cu Is A Naturally Occurring Copper-Binding Tripeptide Central To Skin, Matrix-Remodeling, And Regenerative Research. Its Documented Role In Extracellular-Matrix Studies Makes It A Laboratory Staple. Supplied Research-Grade With Certificate-Of-Analysis Documentation, For In Vitro Use Only.',
  },
  {
    slug: 'nad-plus',
    displayName: 'NAD+',
    popularName: 'Nicotinamide Coenzyme',
    positioning:
      'NAD+ Is An Essential Cellular Coenzyme At The Heart Of Longevity, Mitochondrial, And Redox Research. With Tens Of Thousands Of Citations, It Is One Of The Most Studied Molecules In Aging Science. Pep Nation Lab Provides It Research-Grade For In Vitro Laboratory Work Only.',
  },
  {
    slug: 'sermorelin',
    displayName: 'Sermorelin',
    popularName: 'GHRH 1-29',
    positioning:
      'Sermorelin Is A Synthetic Fragment Of Growth-Hormone-Releasing Hormone, Referenced Broadly In Endocrine And Growth-Axis Research. Its Well-Characterized Mechanism Makes It A Common Baseline In Comparative Studies. Every Batch Ships Research-Grade With Full COA, Strictly For In Vitro Use.',
  },
  {
    slug: 'epithalon',
    displayName: 'Epithalon',
    popularName: 'Pineal Tetrapeptide',
    positioning:
      'Epithalon Is A Synthetic Pineal Tetrapeptide Studied For Its Role In Telomere And Circadian Longevity Research. It Remains A Frequently Cited Compound In Independent Aging-Science Literature. Supplied Research-Grade For In Vitro Laboratory Analysis Only, With Batch Documentation.',
  },
];

/** Fast lookup by compound slug. */
const CITY_COMPOUND_BY_SLUG: Record<string, CityCompound> = Object.fromEntries(
  CITY_COMPOUNDS.map((c) => [c.slug, c])
);

/** Returns a single curated compound by slug, or undefined if it is not a
 *  compound-city landing target. */
export function getCityCompound(slug: string): CityCompound | undefined {
  return CITY_COMPOUND_BY_SLUG[slug];
}

/** All compound slugs (used for sitemap fan-out and sibling links). */
export const CITY_COMPOUND_SLUGS: string[] = CITY_COMPOUNDS.map((c) => c.slug);
