import type { City } from '../cities-data';

// Utah — 5 cities
const CITIES_UTAH: City[] = [
  { name: 'Park City', slug: 'park-city', state: 'Utah', stateSlug: 'utah', stateAbbr: 'UT', population: 8500, medianIncome: 105000, tier: 1 },
  { name: 'Draper', slug: 'draper', state: 'Utah', stateSlug: 'utah', stateAbbr: 'UT', population: 50000, medianIncome: 100000, tier: 2, region: 'Greater Salt Lake City' },
  { name: 'South Jordan', slug: 'south-jordan', state: 'Utah', stateSlug: 'utah', stateAbbr: 'UT', population: 75000, medianIncome: 92000, tier: 2, region: 'Greater Salt Lake City' },
  { name: 'Salt Lake City', slug: 'salt-lake-city', state: 'Utah', stateSlug: 'utah', stateAbbr: 'UT', population: 200000, medianIncome: 58000, tier: 2 },
  { name: 'Provo', slug: 'provo', state: 'Utah', stateSlug: 'utah', stateAbbr: 'UT', population: 117000, medianIncome: 48000, tier: 3 },
];

export default CITIES_UTAH;
