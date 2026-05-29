/**
 * Pep Nation Lab — Vial Image Mapping
 * Priority: individual product → category → default
 *
 * Rules (enforced in every image):
 *  - Cap color = label stripe color = PN logo color
 *  - Background: seamless near-black studio, dark reflective surface
 *  - Most fluids: crystal clear/colorless  
 *  - GHK-Cu exception: pale blue (copper complex)
 */

// ─── Individual product name → image path ────────────────────────────────────
// Key: lowercase product name (trimmed). Add new entries here as images are generated.
const PRODUCT_IMAGE_MAP: Record<string, string> = {
  // Weight Loss & Metabolism — RED cap + RED label
  'tirzepatide':                              '/images/products/tirzepatide.png',
  'semaglutide':                              '/images/products/semaglutide.png',
  'retatrutide':                              '/images/products/retatrutide.png',

  // Healing & Recovery — TEAL cap + TEAL label
  'bpc-157':                                  '/images/products/bpc-157.png',
  'bpc 157':                                  '/images/products/bpc-157.png',
  'bpc157':                                   '/images/products/bpc-157.png',
  'tb-500':                                   '/images/products/tb-500.png',
  'tb500':                                    '/images/products/tb-500.png',
  'thymosin beta 4 acetate':                  '/images/products/tb-500.png',
  'bpc 10mg + tb 10mg':                       '/images/products/bpc-tb-blend.png',
  'bpc-157 and tb-500':                       '/images/products/bpc-tb-blend.png',
  'bpc10 + tb10':                             '/images/products/bpc-tb-blend.png',

  // Growth Hormone Peptides — GOLD cap + GOLD label
  'sermorelin':                               '/images/products/sermorelin.png',
  'cjc-1295 without dac 5mg + ipa 5mg':       '/images/products/cjc-1295-ipa.png',
  'cjc-1295 / ipa':                           '/images/products/cjc-1295-ipa.png',
  'cjc-1295 and ipamorelin':                  '/images/products/cjc-1295-ipa.png',
  'cjc1295 ipa':                              '/images/products/cjc-1295-ipa.png',

  // Anti-Aging & Longevity — ROSE GOLD cap + ROSE GOLD label
  'ghk-cu':                                   '/images/products/ghk-cu.png',
  'ghk cu':                                   '/images/products/ghk-cu.png',
  'copper peptide':                           '/images/products/ghk-cu.png',
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
