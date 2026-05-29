/**
 * Pep Nation Lab — Vial Image Mapping
 * Priority: individual product → category → default
 *
 * Rules (enforced in every image):
 *  - Cap color = label stripe color = PN logo color
 *  - Background: seamless near-black studio, dark reflective surface
 *  - Most fluids: crystal clear/colorless
 *  - B12 exception: deep red/crimson liquid
 *  - NAD+ exception: pale golden yellow liquid
 */

// ─── Individual product name → image path ────────────────────────────────────
// Key: lowercase product name (trimmed). Add new entries here as images are generated.
const PRODUCT_IMAGE_MAP: Record<string, string> = {
  // ── Weight Loss & Metabolism — RED cap ──────────────────────────────────────
  'tirzepatide':                              '/images/products/tirzepatide.png',
  'semaglutide':                              '/images/products/semaglutide.png',
  'ozempic':                                  '/images/products/semaglutide.png',
  'wegovy':                                   '/images/products/semaglutide.png',
  'retatrutide':                              '/images/products/retatrutide.png',
  'lemon bottle':                             '/images/products/lemon-bottle.png',
  'l-carnitine blend':                        '/images/products/l-carnitine-blend.png',
  'l-carnitine':                              '/images/products/l-carnitine.png',
  'l carnitine blend':                        '/images/products/l-carnitine-blend.png',
  'l carnitine':                              '/images/products/l-carnitine.png',
  'lcarnitine':                               '/images/products/l-carnitine.png',
  'aod-9604':                                 '/images/products/aod-9604.png',
  'aod 9604':                                 '/images/products/aod-9604.png',
  'aod9604':                                  '/images/products/aod-9604.png',
  'hgh fragment 176-191':                     '/images/products/hgh-fragment-176-191.png',
  'hgh frag 176-191':                         '/images/products/hgh-fragment-176-191.png',
  'hgh fragment':                             '/images/products/hgh-fragment-176-191.png',
  'fragment 176-191':                         '/images/products/hgh-fragment-176-191.png',
  'cagrilintide':                             '/images/products/cagrilintide.png',
  'liraglutide':                              '/images/products/liraglutide.png',
  'victoza':                                  '/images/products/liraglutide.png',
  '5-amino-1mq':                              '/images/products/5-amino-1mq.png',
  '5 amino 1mq':                              '/images/products/5-amino-1mq.png',
  'lipo-c':                                   '/images/products/lipo-c.png',
  'lipo c':                                   '/images/products/lipo-c.png',
  'cagrilintide and semaglutide':             '/images/products/cagrilintide-sema.png',
  'cagri / sema':                             '/images/products/cagrilintide-sema.png',
  'cagri sema':                               '/images/products/cagrilintide-sema.png',
  'cagri+sema':                               '/images/products/cagrilintide-sema.png',

  // ── Healing & Recovery — TEAL cap ───────────────────────────────────────────
  'bpc-157':                                  '/images/products/bpc-157.png',
  'bpc 157':                                  '/images/products/bpc-157.png',
  'bpc157':                                   '/images/products/bpc-157.png',
  'pentadecapeptide':                         '/images/products/bpc-157.png',
  'tb-500':                                   '/images/products/tb-500.png',
  'tb500':                                    '/images/products/tb-500.png',
  'thymosin beta 4 acetate':                  '/images/products/tb-500.png',
  'thymosin beta-4':                          '/images/products/tb-500.png',
  'bpc 10mg + tb 10mg':                       '/images/products/bpc-tb-blend.png',
  'bpc-157 and tb-500':                       '/images/products/bpc-tb-blend.png',
  'bpc10 + tb10':                             '/images/products/bpc-tb-blend.png',
  'bpc/tb':                                   '/images/products/bpc-tb-blend.png',
  'bpc + tb':                                 '/images/products/bpc-tb-blend.png',
  'kpv':                                      '/images/products/kpv.png',
  'thymosin alpha-1':                         '/images/products/thymosin-alpha-1.png',
  'thymosin alpha 1':                         '/images/products/thymosin-alpha-1.png',
  'thymosin a1':                              '/images/products/thymosin-alpha-1.png',
  'll-37':                                    '/images/products/ll-37.png',
  'll37':                                     '/images/products/ll-37.png',
  'dsip':                                     '/images/products/dsip.png',
  'delta sleep inducing peptide':             '/images/products/dsip.png',
  'larazotide':                               '/images/products/larazotide.png',
  'larazotide acetate':                       '/images/products/larazotide.png',

  // ── Growth Hormone Peptides — GOLD cap ──────────────────────────────────────
  'hmg':                                      '/images/products/hmg.png',
  'human menopausal gonadotropin':            '/images/products/hmg.png',
  'sermorelin':                               '/images/products/sermorelin.png',
  'sermorelin acetate':                       '/images/products/sermorelin-acetate.png',
  'cjc-1295 without dac 5mg + ipa 5mg':       '/images/products/cjc-1295-ipa.png',
  'cjc-1295 / ipa':                           '/images/products/cjc-1295-ipa.png',
  'cjc-1295 and ipamorelin':                  '/images/products/cjc-1295-ipa.png',
  'cjc1295 ipa':                              '/images/products/cjc-1295-ipa.png',
  'cjc-1295 + ipamorelin':                    '/images/products/cjc-1295-ipa.png',
  'cjc 1295 ipa':                             '/images/products/cjc-1295-ipa.png',
  'cjc-1295 with dac':                        '/images/products/cjc-1295-dac.png',
  'cjc-1295 dac':                             '/images/products/cjc-1295-dac.png',
  'cjc1295dac':                               '/images/products/cjc-1295-dac.png',
  'ipamorelin':                               '/images/products/ipamorelin.png',
  'tesamorelin':                              '/images/products/tesamorelin.png',
  'ghrp-2':                                   '/images/products/ghrp-2.png',
  'ghrp2':                                    '/images/products/ghrp-2.png',
  'ghrp-6':                                   '/images/products/ghrp-6.png',
  'ghrp6':                                    '/images/products/ghrp-6.png',
  'hexarelin':                                '/images/products/hexarelin.png',
  'mod grf 1-29':                             '/images/products/mod-grf-1-29.png',
  'mod grf':                                  '/images/products/mod-grf-1-29.png',
  'modgrf':                                   '/images/products/mod-grf-1-29.png',
  'humanin':                                  '/images/products/humanin.png',
  'mots-c':                                   '/images/products/mots-c.png',
  'mots c':                                   '/images/products/mots-c.png',

  // ── Muscle Growth & Performance — ROYAL BLUE cap ────────────────────────────
  'igf-1 lr3':                                '/images/products/igf-1-lr3.png',
  'igf1 lr3':                                 '/images/products/igf-1-lr3.png',
  'igf-1':                                    '/images/products/igf-1-lr3.png',
  'peg-mgf':                                  '/images/products/peg-mgf.png',
  'pegmgf':                                   '/images/products/peg-mgf.png',
  'mgf':                                      '/images/products/mgf.png',
  'mechano growth factor':                    '/images/products/mgf.png',
  'follistatin 344':                          '/images/products/follistatin-344.png',
  'follistatin-344':                          '/images/products/follistatin-344.png',
  'follistatin':                              '/images/products/follistatin-344.png',

  // ── Sexual Health & Hormones — DEEP PURPLE cap ──────────────────────────────
  'pt-141':                                   '/images/products/pt-141.png',
  'pt141':                                    '/images/products/pt-141.png',
  'bremelanotide':                            '/images/products/pt-141.png',
  'oxytocin':                                 '/images/products/oxytocin.png',
  'kisspeptin-10':                            '/images/products/kisspeptin-10.png',
  'kisspeptin 10':                            '/images/products/kisspeptin-10.png',
  'kisspeptin':                               '/images/products/kisspeptin-10.png',

  // ── Anti-Aging & Longevity — ROSE GOLD cap ──────────────────────────────────
  'ghk-cu':                                   '/images/products/ghk-cu.png',
  'ghk cu':                                   '/images/products/ghk-cu.png',
  'copper peptide':                           '/images/products/ghk-cu.png',
  'epithalon':                                '/images/products/epithalon.png',
  'epitalon':                                 '/images/products/epithalon.png',
  'nad+':                                     '/images/products/nad-plus.png',
  'nad plus':                                 '/images/products/nad-plus.png',
  'nad':                                      '/images/products/nad-plus.png',
  'glutathione':                              '/images/products/glutathione.png',
  'vitamin b12':                              '/images/products/vitamin-b12.png',
  'vitamin b-12':                             '/images/products/vitamin-b12.png',
  'methylcobalamin':                          '/images/products/vitamin-b12.png',
  'b12':                                      '/images/products/vitamin-b12.png',
  'pinealon':                                 '/images/products/pinealon.png',
  'vilon':                                    '/images/products/vilon.png',

  // ── Skin, Hair & Cosmetics — EMERALD GREEN cap ──────────────────────────────
  'mt-2':                                     '/images/products/mt-2.png',
  'mt2':                                      '/images/products/mt-2.png',
  'melanotan ii':                             '/images/products/mt-2.png',
  'melanotan 2':                              '/images/products/mt-2.png',
  'glow blend':                               '/images/products/glow-blend.png',
  'klow blend':                               '/images/products/klow-blend.png',
  'snap-8':                                   '/images/products/snap-8.png',
  'snap8':                                    '/images/products/snap-8.png',

  // ── Nootropics & Cognitive — SILVER/CHROME cap ──────────────────────────────
  'selank':                                   '/images/products/selank.png',
  'semax':                                    '/images/products/semax.png',
  'dihexa':                                   '/images/products/dihexa.png',
};

// ─── Category → base vial image (fallback when no individual image exists) ───
const CATEGORY_IMAGE_MAP: Record<string, string> = {
  'Weight Loss & Metabolism':    '/images/vial_weight_loss.png',
  'Muscle Growth & Performance': '/images/vial_muscle_growth.png',
  'Healing & Recovery':          '/images/vial_healing.png',
  'Skin, Hair & Cosmetics':      '/images/vial_skin_hair.png',
  'Anti-Aging & Longevity':      '/images/vial_anti_aging.png',
  'Sexual Health & Hormones':    '/images/vial_sexual_health.png',
  'Growth Hormone Peptides':     '/images/vial_growth_hormone.png',
  'Growth Hormone':              '/images/vial_growth_hormone.png',
  'Nootropics':                  '/images/vial_nootropics.png',
};

const DEFAULT_IMAGE = '/images/vial_healing.png';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeProductName(name: string): string {
  return name.toLowerCase().trim();
}

export function getProductVialImage(productName: string): string | null {
  const key = normalizeProductName(productName);
  // Exact match
  if (PRODUCT_IMAGE_MAP[key]) return PRODUCT_IMAGE_MAP[key];
  // Partial match — check if any key is contained in the product name
  for (const [mapKey, img] of Object.entries(PRODUCT_IMAGE_MAP)) {
    if (key.includes(mapKey) || mapKey.includes(key)) return img;
  }
  return null;
}

export function getCategoryVialImage(category: string): string {
  if (!category) return DEFAULT_IMAGE;
  if (CATEGORY_IMAGE_MAP[category]) return CATEGORY_IMAGE_MAP[category];
  const lower = category.toLowerCase();
  if (lower.includes('weight') || lower.includes('metabolism') || lower.includes('glp') || lower.includes('sema') || lower.includes('tirz')) return '/images/vial_weight_loss.png';
  if (lower.includes('muscle') || lower.includes('performance') || lower.includes('anabolic')) return '/images/vial_muscle_growth.png';
  if (lower.includes('heal') || lower.includes('recover') || lower.includes('repair')) return '/images/vial_healing.png';
  if (lower.includes('skin') || lower.includes('hair') || lower.includes('cosmetic') || lower.includes('beauty')) return '/images/vial_skin_hair.png';
  if (lower.includes('anti-aging') || lower.includes('anti aging') || lower.includes('longev') || lower.includes('ghk')) return '/images/vial_anti_aging.png';
  if (lower.includes('sexual') || lower.includes('hormone') || lower.includes('libido')) return '/images/vial_sexual_health.png';
  if (lower.includes('growth') || lower.includes('sermorelin') || lower.includes('ipamorelin') || lower.includes('cjc')) return '/images/vial_growth_hormone.png';
  if (lower.includes('nootropic') || lower.includes('cognitive') || lower.includes('brain')) return '/images/vial_nootropics.png';
  return DEFAULT_IMAGE;
}

// ─── Title Case helper ───────────────────────────────────────────────────────
// Converts any product name to Title Case (first letter of each word capitalised).
// Preserves known acronyms and special tokens in any context:
//   • Full word:  "BPC" → "BPC"
//   • Hyphenated: "CJC-1295" → "CJC-1295"  (each part checked individually)
//   • Suffixed:   "TB500"   → "TB500"       (alpha prefix checked)
//   • Prefixed:   "1MQ"     → "1MQ"         (all-alpha content checked)
const PRESERVE_UPPERCASE = new Set([
  // GLP-1 / weight-loss
  'GLP', 'AOD', 'HGH', 'GHK',
  // Healing / recovery
  'BPC', 'TB', 'KPV', 'LL',
  // Growth hormone peptides
  'CJC', 'IPA', 'DAC', 'GRF', 'MOD', 'GHRP', 'HMG', 'GH',
  // Muscle / IGF
  'IGF', 'PEG', 'MGF', 'LR',
  // Anti-aging
  'NAD', 'GHK-CU',
  // Sexual health
  'PT', 'HCG',
  // Skin / cosmetics
  'MT', 'SNAP',
  // Nootropics
  'MK', 'VIP', 'SS',
  // Blends
  'GLOW', 'KLOW',
  // Other acronyms
  'DSIP', 'MOTS', 'MQ', 'AHK', 'AICAR', 'FOXO', 'DRI', 'LR3',
  // Numbers embedded in names (all-alpha portion)
  'MQ',   // 1MQ in 5-Amino-1MQ
  'AA',   // 191AA in HGH 191AA
]);

export function toTitleCase(name: string): string {
  if (!name) return name;

  return name
    .split(' ')
    .map(word => {
      // Fully parenthetical suffix e.g. "(Somatropin)" — leave as-is
      if (word.startsWith('(') && word.endsWith(')')) return word;

      // Whole-word exact match (e.g. "BPC", "GLOW", "NAD+" stripped)
      const upper = word.replace(/[^A-Za-z]/g, '').toUpperCase();
      if (upper && PRESERVE_UPPERCASE.has(upper)) {
        // Re-compose preserving non-alpha chars like "+" in "NAD+"
        return word.toUpperCase();
      }

      // Split on hyphens, process each segment individually
      return word
        .split('-')
        .map(part => {
          if (!part) return part;

          // 1. Whole part exact match (e.g. "CJC", "DAC", "1295" skips)
          if (PRESERVE_UPPERCASE.has(part.toUpperCase())) return part.toUpperCase();

          // 2. Leading-alpha prefix check — covers "CJC" in "CJC-1295",
          //    "TB" in "TB500", "GHRP" in "GHRP-2"
          const leadAlpha = (part.match(/^[A-Za-z]+/)?.[0] ?? '').toUpperCase();
          if (leadAlpha && PRESERVE_UPPERCASE.has(leadAlpha)) return part.toUpperCase();

          // 3. All-alpha content check — covers "1MQ" (alpha = "MQ"),
          //    "191AA" (alpha = "AA")
          const allAlpha = part.replace(/[^A-Za-z]/g, '').toUpperCase();
          if (allAlpha.length >= 2 && PRESERVE_UPPERCASE.has(allAlpha)) return part.toUpperCase();

          // 4. Standard title-case: capitalise first letter, lower the rest
          return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
        })
        .join('-');
    })
    .join(' ');
}

/**
 * Main resolver: product name takes priority over category.
 * Pass explicit imageUrl if the product has a custom one in the database.
 */
export function getProductImage(
  imageUrl: string | null | undefined,
  category: string,
  productName?: string,
): string {
  if (imageUrl && imageUrl.trim() !== '') return imageUrl;
  if (productName) {
    const specific = getProductVialImage(productName);
    if (specific) return specific;
  }
  return getCategoryVialImage(category);
}
