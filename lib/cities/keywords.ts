/**
 * keywords.ts
 * Peptide keyword clusters for local SEO city landing pages.
 */

export interface KeywordCluster {
  primary: string;
  secondary: string[];
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

/**
 * Featured peptides shown on city landing pages.
 * image: path relative to /public/images/products/
 * These match exactly what is in the products store.
 */
export interface FeaturedPeptide {
  name: string;
  popularName: string;    // well-known brand/common name
  slug: string;           // links to /research/[slug]
  category: string;
  description: string;
  image: string;          // /images/products/[filename]
  size?: string;
  price?: number;
}

export const FEATURED_PEPTIDES: FeaturedPeptide[] = [
  {
    name: 'BPC-157',
    popularName: 'Body Protection Compound',
    slug: 'bpc-157',
    category: 'Healing & Recovery',
    description: 'One of the most studied peptides for tissue repair, gut health, and recovery research.',
    image: '/images/products/bpc-157.png',
    size: '10mg Vials',
    price: 14.50,
  },
  {
    name: 'Semaglutide',
    popularName: 'Ozempic / Wegovy',
    slug: 'semaglutide',
    category: 'Metabolic Health',
    description: 'GLP-1 receptor agonist widely studied for metabolic regulation and weight management research.',
    image: '/images/products/semaglutide.png',
    size: '5mg Vials',
    price: 18.00,
  },
  {
    name: 'TB-500',
    popularName: 'Thymosin Beta-4',
    slug: 'tb-500',
    category: 'Recovery & Performance',
    description: 'Thymosin Beta-4 fragment studied for cellular recovery, tissue regeneration, and angiogenesis.',
    image: '/images/products/tb-500.png',
    size: '10mg Vials',
    price: 16.00,
  },
  {
    name: 'Tirzepatide',
    popularName: 'Mounjaro / Zepbound',
    slug: 'tirzepatide',
    category: 'Metabolic Health',
    description: 'Dual GIP/GLP-1 receptor agonist. Cutting-edge metabolic and weight regulation research compound.',
    image: '/images/products/tirzepatide.png',
    size: '10mg Vials',
    price: 22.00,
  },
  {
    name: 'Ipamorelin',
    popularName: 'GH Secretagogue',
    slug: 'ipamorelin',
    category: 'Growth & Longevity',
    description: 'Selective growth hormone secretagogue widely used in anti-aging and longevity peptide research.',
    image: '/images/products/ipamorelin.png',
    size: '5mg Vials',
    price: 11.00,
  },
  {
    name: 'CJC-1295 + Ipamorelin',
    popularName: 'The GH Stack',
    slug: 'cjc-1295',
    category: 'Growth & Longevity',
    description: 'GHRH analogue blend studied for sustained growth hormone pulse amplification and recovery research.',
    image: '/images/products/cjc-1295-ipamorelin.png',
    size: '10mg Vials',
    price: 19.00,
  },
  {
    name: 'Sermorelin',
    popularName: 'GHRH Analogue',
    slug: 'sermorelin',
    category: 'Growth & Longevity',
    description: 'First-generation GHRH analogue with a long research safety profile. Widely studied for GH stimulation.',
    image: '/images/products/sermorelin.png',
    size: '5mg Vials',
    price: 13.50,
  },
  {
    name: 'PT-141',
    popularName: 'Bremelanotide',
    slug: 'pt-141',
    category: 'Sexual Health',
    description: 'Melanocortin receptor agonist studied for sexual function and libido research protocols.',
    image: '/images/products/pt-141.png',
    size: '10mg Vials',
    price: 15.00,
  },
  {
    name: 'GHK-Cu',
    popularName: 'Copper Peptide',
    slug: 'ghk-cu',
    category: 'Skin, Hair & Cosmetic',
    description: 'Naturally occurring copper complex studied for wound healing, collagen synthesis, and skin regeneration.',
    image: '/images/products/ghk-cu.png',
    size: '50mg Vials',
    price: 9.50,
  },
  {
    name: 'Epithalon',
    popularName: 'Youth Peptide',
    slug: 'epithalon',
    category: 'Anti-Aging & Longevity',
    description: 'Tetrapeptide studied for telomere elongation, melatonin regulation, and longevity research protocols.',
    image: '/images/products/epithalon.png',
    size: '10mg Vials',
    price: 17.50,
  },
];
