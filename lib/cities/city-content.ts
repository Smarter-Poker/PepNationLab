/**
 * city-content.ts
 * Template engine for generating unique, city-specific copy.
 * Multiple intro + FAQ variants prevent duplicate-content penalties.
 */

import type { City } from './cities-data';

// ─── Regional flavor labels ───────────────────────────────────────────────
const REGION_FALLBACKS: Record<string, string> = {
  illinois: 'Midwest',
  texas: 'Lone Star State',
  california: 'Golden State',
  florida: 'Sunshine State',
  'new-york': 'Empire State',
  connecticut: 'Constitution State',
  georgia: 'Peach State',
  colorado: 'Centennial State',
  washington: 'Pacific Northwest',
  nevada: 'Silver State',
  'new-jersey': 'Garden State',
  massachusetts: 'Bay State',
  virginia: 'Old Dominion',
  maryland: 'Old Line State',
  pennsylvania: 'Keystone State',
  ohio: 'Buckeye State',
  michigan: 'Great Lakes State',
  minnesota: 'Land of 10,000 Lakes',
  'north-carolina': 'Tar Heel State',
  tennessee: 'Volunteer State',
  kansas: 'Sunflower State',
  missouri: 'Show-Me State',
  indiana: 'Hoosier State',
  utah: 'Beehive State',
  oregon: 'Beaver State',
  wisconsin: 'Badger State',
  'south-carolina': 'Palmetto State',
  louisiana: 'Pelican State',
  alabama: 'Heart of Dixie',
  nebraska: 'Cornhusker State',
  iowa: 'Hawkeye State',
  oklahoma: 'Sooner State',
  arkansas: 'Natural State',
  'new-mexico': 'Land of Enchantment',
  hawaii: 'Aloha State',
  arizona: 'Grand Canyon State',
};

export function getRegionLabel(city: City): string {
  return city.region ?? REGION_FALLBACKS[city.stateSlug] ?? city.state;
}

// ─── Intro variants (rotated by city tier to add uniqueness) ─────────────
const INTRO_VARIANTS = [
  (city: City) =>
    `Pep Nation Lab is the trusted wholesale source for research-grade peptides serving researchers in ${city.name}, ${city.stateAbbr} and across the ${getRegionLabel(city)}. Our curated catalog of 300+ pharmaceutical-grade compounds is backed by rigorous QA and full documentation — available exclusively to qualified scientific institutions and licensed researchers.`,
  (city: City) =>
    `The research community in ${city.name}, ${city.stateAbbr} demands quality. Pep Nation Lab delivers — offering one of the nation's largest selections of high-purity, research-grade peptides shipped directly to qualified labs and research professionals in the ${getRegionLabel(city)} region.`,
  (city: City) =>
    `Researchers in ${city.name}, ${city.state} and the surrounding ${getRegionLabel(city)} area rely on Pep Nation Lab for wholesale access to 300+ research peptides, growth factors, and bioactive compounds. Every product is batch-tested, fully documented, and available with priority fulfillment for verified accounts.`,
];

export function getCityIntro(city: City): string {
  const idx = (city.slug.length + city.tier) % INTRO_VARIANTS.length;
  return INTRO_VARIANTS[idx](city);
}

// ─── FAQ generators ──────────────────────────────────────────────────────
export interface FAQ {
  question: string;
  answer: string;
}

export function getCityFAQs(city: City): FAQ[] {
  const region = getRegionLabel(city);
  return [
    {
      question: `How do researchers in ${city.name}, ${city.stateAbbr} access Pep Nation Lab's products?`,
      answer: `Qualified researchers in ${city.name} can create a verified account at PepNationLab.com. After identity and credential verification, you gain immediate access to our full catalog of 300+ research-grade peptides at wholesale pricing, with fast nationwide shipping directly to your lab or research facility.`,
    },
    {
      question: `What peptides are most researched in the ${region} area?`,
      answer: `Research trends in the ${region} region mirror national patterns: BPC-157, Semaglutide, and Tirzepatide consistently rank among the highest-demand compounds. Recovery peptides like TB-500 and longevity peptides like Ipamorelin and CJC-1295 also see strong research interest from ${city.state} institutions.`,
    },
    {
      question: `Does Pep Nation Lab ship research peptides to ${city.name}, ${city.stateAbbr}?`,
      answer: `Yes. Pep Nation Lab ships to all 50 states, including ${city.state}. Orders placed by verified researchers in ${city.name} and surrounding areas are typically processed same-day and shipped with discrete, lab-appropriate packaging and full chain-of-custody documentation.`,
    },
    {
      question: `What is the difference between research peptides and pharmaceutical peptides?`,
      answer: `Research peptides sold by Pep Nation Lab are strictly for in vitro laboratory use — analytical research, cell studies, and scientific inquiry. They are NOT pharmaceutical drugs, are not FDA-approved for human or animal use, and must only be handled by qualified researchers in appropriate lab settings. This distinction is critical for regulatory compliance in ${city.state}.`,
    },
    {
      question: `Is there an agent or representative near ${city.name}?`,
      answer: `Pep Nation Lab operates through a nationwide agent network. You may find a verified PNL agent serving the ${region} area through our Become an Agent program. Agents offer localized support, education, and account management for research institutions in ${city.name} and nearby cities.`,
    },
  ];
}

// ─── Value props ──────────────────────────────────────────────────────────
export interface ValueProp {
  icon: string;  // icon key for SVG lookup map in CityPage
  title: string;
  body: string;
}

export const VALUE_PROPS: ValueProp[] = [
  {
    icon: 'Dna',
    title: 'Pharmaceutical-Grade Purity',
    body: 'Every compound is batch-tested with full COA documentation. We source only from certified synthesis facilities.',
  },
  {
    icon: 'Zap',
    title: 'Same-Day Fulfillment',
    body: 'Orders placed by verified researchers before 3PM CT ship same day. Cold-chain and standard shipping available.',
  },
  {
    icon: 'BadgeDollarSign',
    title: 'True Wholesale Pricing',
    body: '3-tier agent structure means researchers access prices unavailable anywhere else. No retail markup.',
  },
  {
    icon: 'FlaskConical',
    title: '300+ Compounds',
    body: 'One of the largest catalogs in the industry. BPC-157, Semaglutide, Tirzepatide, TB-500, and hundreds more.',
  },
  {
    icon: 'Shield',
    title: 'Verified Researchers Only',
    body: 'Every account is manually reviewed. We protect the integrity of our network and ensure compliance with all applicable laws.',
  },
  {
    icon: 'Package',
    title: 'Nationwide Shipping',
    body: 'Shipping to all 50 states with discrete, lab-appropriate packaging and full documentation.',
  },
];
