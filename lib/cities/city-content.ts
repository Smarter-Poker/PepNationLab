/**
 * city-content.ts
 * Template engine for generating unique, city-specific copy.
 *
 * Uniqueness strategy (doorway-page mitigation):
 * - 10 intro variants selected by a per-city hash, several of which weave in
 *   real data points (population, region) so pages differ in substance, not
 *   just the city token.
 * - A pool of 18 FAQs from which 6 are deterministically selected per city;
 *   two compliance-critical FAQs (shipping + RUO distinction) always appear.
 * - All copy uses "research-grade" (never "pharmaceutical-grade") to stay
 *   consistent with the platform's RUO compliance posture.
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

/**
 * Region label safe to follow with the noun "area" - avoids doubling when the
 * label already ends in "area"/"Area" (e.g. "Chicagoland area", "Bay Area").
 * "Greater Orlando" -> "Greater Orlando area"; "Bay Area" -> "Bay Area".
 */
export function getRegionArea(region: string): string {
  return /area$/i.test(region.trim()) ? region : `${region} area`;
}

// ─── Deterministic per-city hash ──────────────────────────────────────────
function cityHash(city: City): number {
  let h = city.tier;
  for (let i = 0; i < city.slug.length; i++) h = (h * 31 + city.slug.charCodeAt(i)) >>> 0;
  return h;
}

function formatPopulation(population: number): string {
  if (population >= 1000000) return `${(population / 1000000).toFixed(1)} million`;
  if (population >= 1000) return `${Math.round(population / 1000).toLocaleString()},000`;
  return `${population}`;
}

// ─── Intro variants (selected by per-city hash) ───────────────────────────
const INTRO_VARIANTS = [
  (city: City) =>
    `Pep Nation Lab is the trusted wholesale source for research-grade peptides serving researchers in ${city.name}, ${city.stateAbbr} and across the ${getRegionLabel(city)}. Our curated catalog of 100+ research-grade compounds is backed by rigorous QA and full documentation, available exclusively to qualified scientific institutions and verified researchers.`,
  (city: City) =>
    `The research community in ${city.name}, ${city.stateAbbr} demands quality. Pep Nation Lab delivers one of the nation's largest selections of high-purity, research-grade peptides shipped directly to qualified labs and research professionals across the ${getRegionArea(getRegionLabel(city))}.`,
  (city: City) =>
    `Researchers in ${city.name}, ${city.state} and the surrounding ${getRegionArea(getRegionLabel(city))} rely on Pep Nation Lab for wholesale access to 100+ research peptides, growth factors, and bioactive compounds. Every product is batch-tested, fully documented, and available with priority fulfillment for verified accounts.`,
  (city: City) =>
    `Home to roughly ${formatPopulation(city.population)} residents, ${city.name}, ${city.stateAbbr} sits within the ${getRegionLabel(city)} - a region with an active independent research community. Pep Nation Lab supplies that community with batch-tested, research-grade peptides at wholesale pricing, shipped directly to verified labs with full documentation.`,
  (city: City) =>
    `From ${city.name} to the wider ${getRegionLabel(city)}, verified researchers turn to Pep Nation Lab for dependable access to research-grade peptides. Same-day fulfillment on qualifying orders, full COA documentation on every batch, and a 100+ compound catalog built for in vitro laboratory work.`,
  (city: City) =>
    `${city.name} anchors ${city.county ? `${city.county} County` : `the ${getRegionLabel(city)}`} and its independent research base. Pep Nation Lab ships research-grade peptides - BPC-157, TB-500, GHK-Cu and 100+ more - to verified labs here with same-day processing and full batch COAs.`,
  (city: City) =>
    `Verified accounts in ${city.name}, ${city.stateAbbr} draw from a 100+ compound catalog spanning metabolic, recovery, longevity, and cognitive research. Pep Nation Lab fulfills every ${getRegionArea(getRegionLabel(city))} order at wholesale pricing with independent third-party purity testing.`,
  (city: City) =>
    `Private and institutional labs across ${city.name} and the ${getRegionLabel(city)} rely on Pep Nation Lab for direct wholesale peptides. Each lot is HPLC- and mass-spec-verified and ships with a certificate of analysis for in vitro laboratory work.`,
  (city: City) =>
    `Research teams in ${city.name}, ${city.stateAbbr} choose Pep Nation Lab for lot-to-lot consistency: transparent COAs, identical purity specs, and a 100+ peptide catalog. Orders ship nationwide from one verified account with priority handling across the ${getRegionLabel(city)}.`,
  (city: City) =>
    `Serving ${formatPopulation(city.population)}-resident ${city.name} and the wider ${getRegionLabel(city)}, Pep Nation Lab keeps ${city.state} research teams supplied with cold-chain-handled, research-grade peptides, wholesale pricing tiers, and full lot documentation on every order.`,
];

export function getCityIntro(city: City): string {
  return INTRO_VARIANTS[cityHash(city) % INTRO_VARIANTS.length](city);
}

// ─── FAQ generators ──────────────────────────────────────────────────────
export interface FAQ {
  question: string;
  answer: string;
}

/**
 * Full FAQ pool. Two compliance-critical entries (shipping, RUO distinction)
 * are always included; four more rotate in deterministically per city so (16 in the rotating pool)
 * neighboring pages do not carry identical FAQ sets.
 */
function faqPool(city: City): { core: FAQ[]; rotating: FAQ[] } {
  const region = getRegionLabel(city);
  return {
    core: [
      {
        question: `Does Pep Nation Lab ship research peptides to ${city.name}, ${city.stateAbbr}?`,
        answer: `Yes. Pep Nation Lab ships to all 50 states, including ${city.state}. Orders placed by verified researchers in ${city.name} and surrounding areas are typically processed same-day and shipped with discrete, lab-appropriate packaging and full chain-of-custody documentation.`,
      },
      {
        question: `What is the difference between research peptides and pharmaceutical peptides?`,
        answer: `Research peptides sold by Pep Nation Lab are strictly for in vitro laboratory use: analytical research, cell studies, and scientific inquiry. They are NOT pharmaceutical drugs, are not FDA-approved for human or animal use, and must only be handled by qualified researchers in appropriate lab settings. This distinction is critical for regulatory compliance in ${city.state}.`,
      },
    ],
    rotating: [
      {
        question: `How do researchers in ${city.name}, ${city.stateAbbr} access Pep Nation Lab's products?`,
        answer: `Qualified researchers in ${city.name} can create a verified account at PepNationLab.com. After identity and credential verification, you gain immediate access to our full catalog of 100+ research-grade peptides at wholesale pricing, with fast nationwide shipping directly to your lab or research facility.`,
      },
      {
        question: `What peptides are most researched in the ${getRegionArea(region)}?`,
        answer: `Research trends in the ${getRegionArea(region)} mirror national patterns: BPC-157, Semaglutide, and Tirzepatide consistently rank among the highest-demand compounds. Recovery peptides like TB-500 and longevity-focused compounds like Ipamorelin and CJC-1295 also see strong research interest from ${city.state} institutions.`,
      },
      {
        question: `Is there an agent or representative near ${city.name}?`,
        answer: `Pep Nation Lab operates through a nationwide agent network. You may find a verified PNL agent serving the ${getRegionArea(region)} through our Become An Agent program. Agents offer localized support, education, and account management for research institutions in ${city.name} and nearby cities.`,
      },
      {
        question: `How is purity verified on peptides shipped to ${city.name}?`,
        answer: `Every batch in the Pep Nation Lab catalog is sourced from certified synthesis facilities and ships with certificate-of-analysis (COA) documentation. Researchers in ${city.name}, ${city.stateAbbr} can review batch documentation before use to confirm identity and purity for their laboratory protocols.`,
      },
      {
        question: `How fast do orders arrive in ${city.name}, ${city.stateAbbr}?`,
        answer: `Verified researcher orders are typically processed same-day when placed before the fulfillment cutoff, then shipped nationwide. Transit to ${city.name} follows standard carrier timelines for ${city.state}, and tracking is provided on every shipment.`,
      },
      {
        question: `What does "Research Use Only" mean for buyers in ${city.state}?`,
        answer: `Research Use Only (RUO) means every product is intended exclusively for in vitro laboratory research. Products are not for human or animal consumption, ingestion, or injection, and are not FDA-approved. Purchasers in ${city.state} are responsible for compliance with all applicable local, state, and federal regulations.`,
      },
      {
        question: `Does Pep Nation Lab offer wholesale pricing to labs in ${city.name}?`,
        answer: `Yes. Pep Nation Lab operates on a wholesale distribution model with tiered agent pricing. Verified research accounts in ${city.name}, ${city.stateAbbr} access wholesale rates on the full 100+ compound catalog without retail markup.`,
      },
      {
        question: `Which research areas does the Pep Nation Lab catalog cover for ${region} researchers?`,
        answer: `The catalog spans metabolic health, tissue repair and recovery, growth and longevity, cognitive research, and skin and cosmetic science - including BPC-157, Semaglutide, Tirzepatide, TB-500, GHK-Cu, and Epithalon. Researchers in ${city.name} can browse the full research library at PepNationLab.com/research.`,
      },
      {
        question: `Do you provide HPLC and Mass Spectrometry reports with orders shipped to ${city.name}?`,
        answer: `Yes. Every peptide lot is subjected to rigorous third-party analytical testing, including High-Performance Liquid Chromatography (HPLC) and Mass Spectrometry (MS). Verified researchers in ${city.stateAbbr} can review these detailed reports to guarantee purity and molecular weight before beginning their assays.`,
      },
      {
        question: `How are temperature-sensitive peptides shipped to ${city.state}?`,
        answer: `Most of our lyophilized peptides are stable at ambient temperatures during transit. However, for specific temperature-sensitive compounds, we utilize advanced cold-chain logistics and insulated packaging to ensure the integrity of the product upon arrival at your ${city.name} laboratory.`,
      },
      {
        question: `How should peptides be stored after delivery in ${city.stateAbbr}?`,
        answer: `Upon arrival in ${city.name}, lyophilized (freeze-dried) peptides should be stored in a freezer at -20°C or below for long-term stability. Once reconstituted for research use, they must be kept refrigerated at 2°C to 8°C and utilized within the timeframe specified in the compound's documentation.`,
      },
      {
        question: `Are your peptides tested in US-based analytical laboratories?`,
        answer: `Absolutely. While we source high-quality raw materials globally, all analytical testing, verification, and lot certification are performed by independent, accredited third-party laboratories within the United States. This guarantees that researchers in ${city.state} receive compounds meeting stringent domestic quality standards.`,
      },
      {
        question: `What payment methods are accepted for verified accounts in ${city.state}?`,
        answer: `Verified research institutions and independent investigators in ${city.name} can utilize multiple secure payment methods, including major credit cards, bank transfers, and specialized institutional payment gateways designed for laboratory procurement.`,
      },
      {
        question: `What is the standard shelf life of lyophilized peptides upon arrival in ${city.name}?`,
        answer: `When properly stored in a frozen state (-20°C or below) away from light and moisture, lyophilized peptides maintain their stability and purity for several years. We recommend ${city.state} researchers strictly follow the handling guidelines provided with each batch.`,
      },
      {
        question: `What is the reconstitution process for Pep Nation Lab products?`,
        answer: `Reconstitution protocols vary by compound and specific research application. Generally, researchers in ${city.name} utilize bacteriostatic water or sterile saline. We provide comprehensive handling guidelines, but investigators are responsible for determining the appropriate diluent and volume for their specific in vitro assays.`,
      },
      {
        question: `Do you offer bulk or institutional discounts for research facilities in ${city.name}?`,
        answer: `Yes. Our agent-based wholesale distribution model inherently provides significant savings. For large-scale studies or high-volume institutional procurement in ${city.state}, we offer specialized pricing tiers and dedicated account management to ensure a consistent, cost-effective supply chain.`,
      },
    ],
  };
}

export function getCityFAQs(city: City): FAQ[] {
  const { core, rotating } = faqPool(city);
  const h = cityHash(city);
  const picks: FAQ[] = [];
  // Pick 4 of the rotating pool, offset by hash, stepping to vary combinations.
  const start = h % rotating.length;
  const step = (h % 3) + 1;
  const used = new Set<number>();
  let i = start;
  while (picks.length < 4) {
    if (!used.has(i % rotating.length)) {
      used.add(i % rotating.length);
      picks.push(rotating[i % rotating.length]);
    }
    i += step;
  }
  return [...core.slice(0, 1), ...picks.slice(0, 2), core[1], ...picks.slice(2)];
}

// ─── At-a-glance facts (AEO: dense, quotable, self-contained) ─────────────
export interface CityFact {
  label: string;
  value: string;
}

export function getCityFacts(city: City): CityFact[] {
  const facts: CityFact[] = [
    { label: 'Service Area', value: `${city.name}, ${city.stateAbbr} (${getRegionLabel(city)})` },
    { label: 'Population', value: `Approximately ${formatPopulation(city.population)} Residents` },
  ];
  if (city.county) {
    facts.push({ label: 'County', value: `${city.county} County, ${city.state}` });
  }
  if (city.zips && city.zips.length > 0) {
    facts.push({ label: 'ZIP Codes Served', value: city.zips.join(', ') });
  }
  facts.push({ label: 'Median Household Income', value: `~$${city.medianIncome.toLocaleString()}` });
  facts.push(
    { label: 'Shipping', value: `Nationwide To All 50 States, Including ${city.state}` },
    { label: 'Catalog', value: '100+ Research-Grade Peptides And Compounds' },
    { label: 'Documentation', value: 'Batch COA Included With Every Order' },
    { label: 'Access', value: 'Verified Researcher Accounts Only' },
    { label: 'Intended Use', value: 'In Vitro Laboratory Research Only - Not For Human Or Animal Use' },
  );
  return facts;
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
    title: 'Research-Grade Purity',
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
    title: '100+ Compounds',
    body: 'One of the largest catalogs in the industry. BPC-157, Semaglutide, Tirzepatide, TB-500, and dozens more.',
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
