/**
 * keywords.ts
 * Peptide keyword clusters for local SEO city landing pages.
 */


// (Removed unused KEYWORD_CLUSTERS export - no keyword <meta> is emitted on
// city pages by design; kept FEATURED_PEPTIDES which is used as the Top-10
// fallback list.)

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
    // Must match the compounds table slug - 'cjc-1295' does not exist and
    // 404'd the "View Research" link on every city landing page.
    slug: 'cjc-ipamorelin',
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
