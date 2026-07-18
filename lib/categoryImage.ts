/**
 * Pep Nation Lab - Vial Image Mapping
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
  // ── Custom Stacks ───────────────────────────────────────────────────────────
  'appetite crusher':                         '/images/pep-nation-flattened/cagrisema-combo.png',
  'furnace stack':                            '/images/pep-nation-flattened/l-carnitine-blend.png',
  'skinny shot':                              '/images/pep-nation-flattened/lipo-c.png',
  'lipolysis stack':                          '/images/pep-nation-flattened/lemon-bottle.png',
  'gh synergy':                               '/images/pep-nation-flattened/cjc-1295-ipa.png',
  'wolverine stack':                          '/images/pep-nation-flattened/bpc-tb-combo.png',
  'shred stack':                              '/images/pep-nation-flattened/shred-stack.png',
  'limitless stack':                          '/images/pep-nation-flattened/limitless-stack.png',
  
  // ── Weight Loss & Metabolism - RED cap ──────────────────────────────────────
  'tirzepatide':                              '/images/pep-nation-flattened/tirzepatide.png',
  'semaglutide':                              '/images/pep-nation-flattened/semaglutide.png',
  'ozempic':                                  '/images/pep-nation-flattened/semaglutide.png',
  'wegovy':                                   '/images/pep-nation-flattened/semaglutide.png',
  'retatrutide':                              '/images/pep-nation-flattened/retatrutide.png',
  'lemon bottle':                             '/images/pep-nation-flattened/lemon-bottle.png',
  'l-carnitine blend':                        '/images/pep-nation-flattened/l-carnitine-blend.png',
  'l-carnitine':                              '/images/pep-nation-flattened/l-carnitine.png',
  'l carnitine blend':                        '/images/pep-nation-flattened/l-carnitine-blend.png',
  'l carnitine':                              '/images/pep-nation-flattened/l-carnitine.png',
  'lcarnitine':                               '/images/pep-nation-flattened/l-carnitine.png',
  'aod-9604':                                 '/images/pep-nation-flattened/aod-9604.png',
  'aod 9604':                                 '/images/pep-nation-flattened/aod-9604.png',
  'aod9604':                                  '/images/pep-nation-flattened/aod-9604.png',
  'hgh fragment 176-191':                     '/images/pep-nation-flattened/hgh-fragment-176-191.png',
  'hgh frag 176-191':                         '/images/pep-nation-flattened/hgh-fragment-176-191.png',
  'hgh fragment':                             '/images/pep-nation-flattened/hgh-fragment-176-191.png',
  'fragment 176-191':                         '/images/pep-nation-flattened/hgh-fragment-176-191.png',
  'cagrilintide':                             '/images/pep-nation-flattened/cagrilintide.png',
  'liraglutide':                              '/images/pep-nation-flattened/liraglutide.png',
  'victoza':                                  '/images/pep-nation-flattened/liraglutide.png',
  '5-amino-1mq':                              '/images/pep-nation-flattened/5-amino-1mq.png',
  '5 amino 1mq':                              '/images/pep-nation-flattened/5-amino-1mq.png',
  'lipo-c':                                   '/images/pep-nation-flattened/lipo-c.png',
  'lipo c':                                   '/images/pep-nation-flattened/lipo-c.png',
  'cagrilintide and semaglutide':             '/images/pep-nation-flattened/cagrisema-combo.png',
  'cagri / sema':                             '/images/pep-nation-flattened/cagrisema-combo.png',
  'cagri sema':                               '/images/pep-nation-flattened/cagrisema-combo.png',
  'cagri+sema':                               '/images/pep-nation-flattened/cagrisema-combo.png',

  // ── Healing & Recovery - TEAL cap ───────────────────────────────────────────
  'bpc-157':                                  '/images/pep-nation-flattened/bpc-157.png',
  'bpc 157':                                  '/images/pep-nation-flattened/bpc-157.png',
  'bpc157':                                   '/images/pep-nation-flattened/bpc-157.png',
  'pentadecapeptide':                         '/images/pep-nation-flattened/bpc-157.png',
  'tb-500':                                   '/images/pep-nation-flattened/tb-500.png',
  'tb500':                                    '/images/pep-nation-flattened/tb-500.png',
  'thymosin beta 4 acetate':                  '/images/pep-nation-flattened/tb-500.png',
  'thymosin beta-4':                          '/images/pep-nation-flattened/tb-500.png',
  'bpc 10mg + tb 10mg':                       '/images/pep-nation-flattened/bpc-tb-combo.png',
  'bpc-157 and tb-500':                       '/images/pep-nation-flattened/bpc-tb-combo.png',
  'bpc10 + tb10':                             '/images/pep-nation-flattened/bpc-tb-combo.png',
  'bpc/tb':                                   '/images/pep-nation-flattened/bpc-tb-combo.png',
  'bpc + tb':                                 '/images/pep-nation-flattened/bpc-tb-combo.png',
  'kpv':                                      '/images/pep-nation-flattened/kpv.png',
  'thymosin alpha-1':                         '/images/pep-nation-flattened/thymosin-alpha-1.png',
  'thymosin alpha 1':                         '/images/pep-nation-flattened/thymosin-alpha-1.png',
  'thymosin a1':                              '/images/pep-nation-flattened/thymosin-alpha-1.png',
  'll-37':                                    '/images/pep-nation-flattened/ll-37.png',
  'll37':                                     '/images/pep-nation-flattened/ll-37.png',
  'dsip':                                     '/images/pep-nation-flattened/dsip.png',
  'delta sleep inducing peptide':             '/images/pep-nation-flattened/dsip.png',
  'larazotide':                               '/images/pep-nation-flattened/larazotide.png',
  'larazotide acetate':                       '/images/pep-nation-flattened/larazotide.png',

  // ── Growth Hormone Peptides - GOLD cap ──────────────────────────────────────
  'hmg':                                      '/images/pep-nation-flattened/hmg.png',
  'human menopausal gonadotropin':            '/images/pep-nation-flattened/hmg.png',
  'sermorelin':                               '/images/pep-nation-flattened/sermorelin.png',
  'sermorelin acetate':                       '/images/pep-nation-flattened/sermorelin-acetate.png',
  'cjc-1295 without dac 5mg + ipa 5mg':       '/images/pep-nation-flattened/cjc-1295-ipa.png',
  'cjc-1295 / ipa':                           '/images/pep-nation-flattened/cjc-1295-ipa.png',
  'cjc-1295 and ipamorelin':                  '/images/pep-nation-flattened/cjc-1295-ipa.png',
  'cjc1295 ipa':                              '/images/pep-nation-flattened/cjc-1295-ipa.png',
  'cjc-1295 + ipamorelin':                    '/images/pep-nation-flattened/cjc-1295-ipa.png',
  'cjc 1295 ipa':                             '/images/pep-nation-flattened/cjc-1295-ipa.png',
  'cjc-1295 with dac':                        '/images/pep-nation-flattened/cjc-1295-dac.png',
  'cjc-1295 dac':                             '/images/pep-nation-flattened/cjc-1295-dac.png',
  'cjc1295dac':                               '/images/pep-nation-flattened/cjc-1295-dac.png',
  'ipamorelin':                               '/images/pep-nation-flattened/ipamorelin.png',
  'tesamorelin':                              '/images/pep-nation-flattened/tesamorelin.png',
  'ghrp-2':                                   '/images/pep-nation-flattened/ghrp-2.png',
  'ghrp2':                                    '/images/pep-nation-flattened/ghrp-2.png',
  'ghrp-6':                                   '/images/pep-nation-flattened/ghrp-6.png',
  'ghrp6':                                    '/images/pep-nation-flattened/ghrp-6.png',
  'hexarelin':                                '/images/pep-nation-flattened/hexarelin.png',
  'mod grf 1-29':                             '/images/pep-nation-flattened/mod-grf-1-29.png',
  'mod grf':                                  '/images/pep-nation-flattened/mod-grf-1-29.png',
  'modgrf':                                   '/images/pep-nation-flattened/mod-grf-1-29.png',
  'humanin':                                  '/images/pep-nation-flattened/humanin.png',
  'mots-c':                                   '/images/pep-nation-flattened/mots-c.png',
  'mots c':                                   '/images/pep-nation-flattened/mots-c.png',

  // ── Muscle Growth & Performance - ROYAL BLUE cap ────────────────────────────
  'igf-1 lr3':                                '/images/pep-nation-flattened/igf-1-lr3.png',
  'igf1 lr3':                                 '/images/pep-nation-flattened/igf-1-lr3.png',
  'igf-1':                                    '/images/pep-nation-flattened/igf-1-lr3.png',
  'peg-mgf':                                  '/images/pep-nation-flattened/peg-mgf.png',
  'pegmgf':                                   '/images/pep-nation-flattened/peg-mgf.png',
  'mgf':                                      '/images/pep-nation-flattened/mgf.png',
  'mechano growth factor':                    '/images/pep-nation-flattened/mgf.png',
  'follistatin 344':                          '/images/pep-nation-flattened/follistatin-344.png',
  'follistatin-344':                          '/images/pep-nation-flattened/follistatin-344.png',
  'follistatin':                              '/images/pep-nation-flattened/follistatin-344.png',

  // ── Sexual Health & Hormones - DEEP PURPLE cap ──────────────────────────────
  'pt-141':                                   '/images/pep-nation-flattened/pt-141.png',
  'pt141':                                    '/images/pep-nation-flattened/pt-141.png',
  'bremelanotide':                            '/images/pep-nation-flattened/pt-141.png',
  'oxytocin':                                 '/images/pep-nation-flattened/oxytocin.png',
  'kisspeptin-10':                            '/images/pep-nation-flattened/kisspeptin-10.png',
  'kisspeptin 10':                            '/images/pep-nation-flattened/kisspeptin-10.png',
  'kisspeptin':                               '/images/pep-nation-flattened/kisspeptin-10.png',

  // ── Anti-Aging & Longevity - ROSE GOLD cap ──────────────────────────────────
  'ghk-cu':                                   '/images/pep-nation-flattened/ghk-cu.png',
  'ghk cu':                                   '/images/pep-nation-flattened/ghk-cu.png',
  'copper peptide':                           '/images/pep-nation-flattened/ghk-cu.png',
  'epithalon':                                '/images/pep-nation-flattened/epithalon.png',
  'epitalon':                                 '/images/pep-nation-flattened/epithalon.png',
  'nad+':                                     '/images/pep-nation-flattened/nad-plus.png',
  'nad plus':                                 '/images/pep-nation-flattened/nad-plus.png',
  'nad':                                      '/images/pep-nation-flattened/nad-plus.png',
  'glutathione':                              '/images/pep-nation-flattened/glutathione.png',
  'vitamin b12':                              '/images/pep-nation-flattened/vitamin-b12.png',
  'vitamin b-12':                             '/images/pep-nation-flattened/vitamin-b12.png',
  'methylcobalamin':                          '/images/pep-nation-flattened/vitamin-b12.png',
  'b12':                                      '/images/pep-nation-flattened/vitamin-b12.png',
  'pinealon':                                 '/images/pep-nation-flattened/pinealon.png',
  'vilon':                                    '/images/pep-nation-flattened/vilon.png',

  // ── Skin, Hair & Cosmetics - EMERALD GREEN cap ──────────────────────────────
  'glow blend':                               '/images/pep-nation-flattened/glow-blend.png',
  'glow stack':                               '/images/pep-nation-flattened/glow-blend.png',
  'klow blend':                               '/images/pep-nation-flattened/klow-blend.png',
  'klow stack':                               '/images/pep-nation-flattened/klow-blend.png',
  'snap-8':                                   '/images/pep-nation-flattened/snap-8.png',
  'snap8':                                    '/images/pep-nation-flattened/snap-8.png',

  // ── Nootropics & Cognitive - SILVER/CHROME cap ──────────────────────────────
  'selank':                                   '/images/pep-nation-flattened/selank.png',
  'semax':                                    '/images/pep-nation-flattened/semax.png',
  'dihexa':                                   '/images/pep-nation-flattened/dihexa.png',

  // ── Curated Stacks ─────────────────────────────────────────────────────────
  'gh synergy stack':                         '/images/pep-nation-flattened/cjc-1295-ipa.png',

  // ── Missing Compounds added from Audit ─────────────────────────────────────
  'hcg':                                      '/images/pep-nation-flattened/hcg-g5k.png',
  'ss-31':                                    '/images/pep-nation-flattened/ss-31-2s50.png',
  'survodutide':                              '/images/pep-nation-flattened/survodutide-sur10.png',
  'cerebrolysin':                             '/images/pep-nation-flattened/cerebrolysin-cbl60.png',
  'aicar':                                    '/images/pep-nation-flattened/aicar-ar50.png',
  'thymalin':                                 '/images/pep-nation-flattened/thymalin-ty10.png',
  'melatonin':                                '/images/pep-nation-flattened/melatonin-mt10.png',
  'mt-1':                                     '/images/pep-nation-flattened/mt-1-mt1.png',
  'vip':                                      '/images/pep-nation-flattened/vip-vp10.png',
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
  // Partial match - check if any key is contained in the product name
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
  'SNAP',
  // Nootropics
  'MK', 'VIP', 'SS',
  // Blends
  'GLOW', 'KLOW',
  // Other acronyms
  'DSIP', 'MOTS', 'MQ', 'AHK', 'AICAR', 'FOXO', 'DRI', 'LR3',
  // Numbers embedded in names (all-alpha portion)
  'MQ',   // 1MQ in 5-Amino-1MQ
]);

export function toTitleCase(name: string): string {
  if (!name) return name;

  const formatted = name
    .split(' ')
    .map(word => {
      // Fully parenthetical suffix e.g. "(Somatropin)" - leave as-is
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

          // 2. Leading-alpha prefix check - covers "CJC" in "CJC-1295",
          //    "TB" in "TB500", "GHRP" in "GHRP-2"
          const leadAlpha = (part.match(/^[A-Za-z]+/)?.[0] ?? '').toUpperCase();
          if (leadAlpha && PRESERVE_UPPERCASE.has(leadAlpha)) return part.toUpperCase();

          // 3. All-alpha content check - covers "1MQ" (alpha = "MQ"),
          //    "191AA" (alpha = "AA")
          const allAlpha = part.replace(/[^A-Za-z]/g, '').toUpperCase();
          if (allAlpha.length >= 2 && PRESERVE_UPPERCASE.has(allAlpha)) return part.toUpperCase();

          // 4. Standard title-case: capitalise first letter, lower the rest
          return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
        })
        .join('-');
    })
    .join(' ');

  return formatted.replace(/\b(Klow|KLOW)\s+Stack\b/g, 'KLOW STACK');
}

/**
 * Main resolver: product name takes priority over category.
 * Pass explicit imageUrl if the product has a custom one in the database.
 *
 * @param allowBrandSpecific - Set true when imageUrl comes from agent_products.custom_image_url
 *   (agent-level override). Brand-specific paths like /images/savage-brands/ are valid there.
 *   Leave false (default) when imageUrl comes from the shared products table — brand-specific
 *   paths must never leak from that table into other storefronts.
 */
export function getProductImage(
  imageUrl: string | null | undefined,
  category: string,
  productName?: string,
  allowBrandSpecific?: boolean,
): string {
  // SAFETY GUARD: The shared `products` table must ONLY contain generic platform
  // image paths (Supabase CDN or /images/pep-nation-flattened/).
  // Brand-specific paths like /images/savage-brands/ must NEVER appear here —
  // if one sneaks in, treat it as null so the correct PepNation vials are shown.
  // Exception: agent_products.custom_image_url is agent-scoped and may contain
  // brand-specific paths — callers set allowBrandSpecific=true for those.
  const safeUrl =
    imageUrl && imageUrl.trim() !== '' &&
    (allowBrandSpecific || !imageUrl.includes('/images/savage-brands/'))
      ? imageUrl
      : null;

  if (safeUrl) return safeUrl;
  if (productName) {
    const specific = getProductVialImage(productName);
    if (specific) return specific;
  }
  return getCategoryVialImage(category);
}
