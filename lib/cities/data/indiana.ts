import type { City } from '../cities-data';

// Indiana — 4 cities
const CITIES_INDIANA: City[] = [
  { name: 'Carmel', slug: 'carmel', state: 'Indiana', stateSlug: 'indiana', stateAbbr: 'IN', population: 100000, medianIncome: 105000, tier: 2, region: 'Greater Indianapolis' },
  { name: 'Zionsville', slug: 'zionsville', state: 'Indiana', stateSlug: 'indiana', stateAbbr: 'IN', population: 29000, medianIncome: 120000, tier: 2, region: 'Greater Indianapolis' },
  { name: 'Indianapolis', slug: 'indianapolis', state: 'Indiana', stateSlug: 'indiana', stateAbbr: 'IN', population: 887000, medianIncome: 52000, tier: 2 },
  { name: 'Fort Wayne', slug: 'fort-wayne', state: 'Indiana', stateSlug: 'indiana', stateAbbr: 'IN', population: 268000, medianIncome: 50000, tier: 3 },
];

export default CITIES_INDIANA;
