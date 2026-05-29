/**
 * Maps a product category string to its color-coded, labeled Pep Nation Lab
 * vial image. Each category has a distinct cap color and matching label stripe
 * so researchers can visually identify the compound type at a glance.
 */

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

const FALLBACK_IMAGE = '/images/vial_healing.png';

export function getCategoryVialImage(category: string): string {
  if (!category) return FALLBACK_IMAGE;
  if (CATEGORY_IMAGE_MAP[category]) return CATEGORY_IMAGE_MAP[category];
  const lower = category.toLowerCase();
  if (lower.includes('weight') || lower.includes('metabolism') || lower.includes('glp') || lower.includes('sema') || lower.includes('tirz')) return '/images/vial_weight_loss.png';
  if (lower.includes('muscle') || lower.includes('performance') || lower.includes('anabolic')) return '/images/vial_muscle_growth.png';
  if (lower.includes('heal') || lower.includes('recover') || lower.includes('repair') || lower.includes('bpc') || lower.includes('tb-5')) return '/images/vial_healing.png';
  if (lower.includes('skin') || lower.includes('hair') || lower.includes('cosmetic') || lower.includes('beauty')) return '/images/vial_skin_hair.png';
  if (lower.includes('anti-aging') || lower.includes('anti aging') || lower.includes('longev') || lower.includes('ghk')) return '/images/vial_anti_aging.png';
  if (lower.includes('sexual') || lower.includes('hormone') || lower.includes('libido') || lower.includes('pt-141')) return '/images/vial_sexual_health.png';
  if (lower.includes('growth') || lower.includes('sermorelin') || lower.includes('ipamorelin') || lower.includes('cjc')) return '/images/vial_growth_hormone.png';
  if (lower.includes('nootropic') || lower.includes('cognitive') || lower.includes('brain')) return '/images/vial_nootropics.png';
  return FALLBACK_IMAGE;
}

export function getProductImage(imageUrl: string | null | undefined, category: string): string {
  if (imageUrl && imageUrl.trim() !== '') return imageUrl;
  return getCategoryVialImage(category);
}
