import type { City } from '../cities-data';

// Nevada — 13 cities (Las Vegas Valley + Reno/statewide)
const CITIES_NEVADA: City[] = [
  { name: 'Henderson', slug: 'henderson', state: 'Nevada', stateSlug: 'nevada', stateAbbr: 'NV', population: 320000, medianIncome: 84000, tier: 1, region: 'Las Vegas Valley', county: 'Clark', zips: ['89011', '89012', '89052', '89074'], localBlurb: 'From Green Valley to Anthem, Henderson research groups source our high-purity peptides for recovery, metabolic, and longevity studies with full third-party COAs.' },
  { name: 'Summerlin', slug: 'summerlin', state: 'Nevada', stateSlug: 'nevada', stateAbbr: 'NV', population: 100000, medianIncome: 100000, tier: 1, region: 'Las Vegas Valley', county: 'Clark', zips: ['89135', '89138'], localBlurb: 'Summerlin laboratories on the west side of the valley rely on our lot-traceable compounds and comprehensive certificates of analysis.' },
  { name: 'Las Vegas', slug: 'las-vegas', state: 'Nevada', stateSlug: 'nevada', stateAbbr: 'NV', population: 646000, medianIncome: 66000, tier: 2, region: 'Las Vegas Valley', county: 'Clark', zips: ['89101', '89109', '89117', '89128'] },
  { name: 'North Las Vegas', slug: 'north-las-vegas', state: 'Nevada', stateSlug: 'nevada', stateAbbr: 'NV', population: 262000, medianIncome: 68000, tier: 3, region: 'Las Vegas Valley', county: 'Clark', zips: ['89030', '89031', '89032'] },
  { name: 'Boulder City', slug: 'boulder-city', state: 'Nevada', stateSlug: 'nevada', stateAbbr: 'NV', population: 15000, medianIncome: 72000, tier: 2, region: 'Las Vegas Valley', county: 'Clark', zips: ['89005'] },
  { name: 'Mesquite', slug: 'mesquite', state: 'Nevada', stateSlug: 'nevada', stateAbbr: 'NV', population: 20000, medianIncome: 56000, tier: 3, region: 'Southern Nevada', county: 'Clark', zips: ['89027'] },
  { name: 'Reno', slug: 'reno', state: 'Nevada', stateSlug: 'nevada', stateAbbr: 'NV', population: 264000, medianIncome: 68000, tier: 2, region: 'Northern Nevada', county: 'Washoe', zips: ['89501', '89509', '89511'] },
  { name: 'Sparks', slug: 'sparks', state: 'Nevada', stateSlug: 'nevada', stateAbbr: 'NV', population: 108000, medianIncome: 70000, tier: 3, region: 'Northern Nevada', county: 'Washoe', zips: ['89431', '89434', '89436'] },
  { name: 'Carson City', slug: 'carson-city', state: 'Nevada', stateSlug: 'nevada', stateAbbr: 'NV', population: 58000, medianIncome: 62000, tier: 3, region: 'Northern Nevada', county: 'Carson City', zips: ['89701', '89703'] },
  { name: 'Elko', slug: 'elko', state: 'Nevada', stateSlug: 'nevada', stateAbbr: 'NV', population: 20000, medianIncome: 78000, tier: 3, region: 'Northeastern Nevada', county: 'Elko', zips: ['89801'] },
  { name: 'Fernley', slug: 'fernley', state: 'Nevada', stateSlug: 'nevada', stateAbbr: 'NV', population: 22000, medianIncome: 68000, tier: 3, region: 'Northern Nevada', county: 'Lyon', zips: ['89408'] },
  { name: 'Pahrump', slug: 'pahrump', state: 'Nevada', stateSlug: 'nevada', stateAbbr: 'NV', population: 44000, medianIncome: 50000, tier: 3, region: 'Southern Nevada', county: 'Nye', zips: ['89048'] },
  { name: 'Winnemucca', slug: 'winnemucca', state: 'Nevada', stateSlug: 'nevada', stateAbbr: 'NV', population: 8000, medianIncome: 66000, tier: 3, region: 'Northern Nevada', county: 'Humboldt', zips: ['89445'] },
];

export default CITIES_NEVADA;
