/**
 * keywords.ts
 * Peptide keyword clusters for local SEO city landing pages.
 */

export interface KeywordCluster {
  primary: string;       // Primary keyword template (use {city}, {state})
  secondary: string[];   // Secondary keyword variants
  intent: 'commercial' | 'informational' | 'local';
  searchVolumeTier: 'high' | 'medium' | 'low';
}

export const KEYWORD_CLUSTERS: KeywordCluster[] = [
  {
    primary: 'peptide therapy {city}',
    secondary: ['peptide therapy near {city}', 'peptide therapy {city} {state}', 'peptide clinics {city}'],
    intent: 'local',
    searchVolumeTier: 'high',
  },
  {
    primary: 'research peptides {city}',
    secondary: ['buy research peptides {city}', 'peptide research {city} {state}', 'research grade peptides {city}'],
    intent: 'commercial',
    searchVolumeTier: 'high',
  },
  {
    primary: 'semaglutide {city}',
    secondary: ['semaglutide near {city}', 'semaglutide {state}', 'semaglutide peptide {city}'],
    intent: 'local',
    searchVolumeTier: 'high',
  },
  {
    primary: 'BPC-157 {city}',
    secondary: ['BPC 157 {city}', 'BPC-157 research {city}', 'BPC-157 {state}'],
    intent: 'commercial',
    searchVolumeTier: 'medium',
  },
  {
    primary: 'tirzepatide {city}',
    secondary: ['tirzepatide near {city}', 'tirzepatide peptide {city}', 'tirzepatide research {city}'],
    intent: 'local',
    searchVolumeTier: 'high',
  },
  {
    primary: 'TB-500 {city}',
    secondary: ['TB500 {city}', 'TB-500 research {city}', 'TB-500 peptide {state}'],
    intent: 'commercial',
    searchVolumeTier: 'medium',
  },
  {
    primary: 'weight loss peptides {city}',
    secondary: ['peptides for weight loss {city}', 'metabolic peptides {city}', 'GLP-1 peptides {city}'],
    intent: 'local',
    searchVolumeTier: 'high',
  },
  {
    primary: 'anti-aging peptides {city}',
    secondary: ['longevity peptides {city}', 'peptide anti-aging research {city}'],
    intent: 'informational',
    searchVolumeTier: 'medium',
  },
  {
    primary: 'peptide clinic {city}',
    secondary: ['peptide wellness {city}', 'peptide center {city}', 'peptide lab {city}'],
    intent: 'local',
    searchVolumeTier: 'medium',
  },
  {
    primary: 'ipamorelin CJC-1295 {city}',
    secondary: ['growth hormone peptides {city}', 'GHRP peptides {city}'],
    intent: 'commercial',
    searchVolumeTier: 'low',
  },
];

/** Featured peptides shown on city landing pages */
export interface FeaturedPeptide {
  name: string;
  slug: string;           // links to /research/[slug]
  category: string;
  tagline: string;
  icon: string;           // emoji shorthand for the card icon
  badge?: string;
}

export const FEATURED_PEPTIDES: FeaturedPeptide[] = [
  {
    name: 'BPC-157',
    slug: 'bpc-157',
    category: 'Healing & Recovery',
    tagline: 'Body Protection Compound — one of the most studied peptides for tissue repair research.',
    icon: '🧬',
    badge: 'Most Researched',
  },
  {
    name: 'Semaglutide',
    slug: 'semaglutide',
    category: 'Metabolic Health',
    tagline: 'GLP-1 receptor agonist widely studied for metabolic and weight regulation research.',
    icon: '⚗️',
    badge: 'High Demand',
  },
  {
    name: 'TB-500',
    slug: 'tb-500',
    category: 'Recovery & Performance',
    tagline: 'Thymosin Beta-4 fragment studied for cellular recovery and tissue regeneration.',
    icon: '💉',
  },
  {
    name: 'Tirzepatide',
    slug: 'tirzepatide',
    category: 'Metabolic Health',
    tagline: 'Dual GIP/GLP-1 agonist — cutting-edge metabolic research compound.',
    icon: '🔬',
    badge: 'Trending',
  },
  {
    name: 'Ipamorelin',
    slug: 'ipamorelin',
    category: 'Growth & Longevity',
    tagline: 'Selective growth hormone secretagogue — widely used in longevity research.',
    icon: '🧪',
  },
  {
    name: 'CJC-1295',
    slug: 'cjc-1295',
    category: 'Growth & Longevity',
    tagline: 'GHRH analogue studied for growth hormone pulse amplification.',
    icon: '🔭',
  },
  {
    name: 'Sermorelin',
    slug: 'sermorelin',
    category: 'Growth & Longevity',
    tagline: 'First-generation GHRH analogue with a long safety research profile.',
    icon: '🌡️',
  },
  {
    name: 'PT-141',
    slug: 'pt-141',
    category: 'Sexual Health',
    tagline: 'Melanocortin receptor agonist studied for sexual function and libido research.',
    icon: '💊',
  },
];
