import type { City } from '../cities-data';

// South Carolina - 4 cities
const CITIES_SOUTH_CAROLINA: City[] = [
  { name: 'Hilton Head', slug: 'hilton-head', state: 'South Carolina', stateSlug: 'south-carolina', stateAbbr: 'SC', population: 40000, medianIncome: 72000, tier: 2 },
  { name: 'Mount Pleasant', slug: 'mount-pleasant', state: 'South Carolina', stateSlug: 'south-carolina', stateAbbr: 'SC', population: 95000, medianIncome: 87000, tier: 2, region: 'Greater Charleston' },
  { name: 'Charleston', slug: 'charleston', state: 'South Carolina', stateSlug: 'south-carolina', stateAbbr: 'SC', population: 150000, medianIncome: 60000, tier: 2, region: 'Greater Charleston' },
  { name: 'Columbia', slug: 'columbia', state: 'South Carolina', stateSlug: 'south-carolina', stateAbbr: 'SC', population: 136000, medianIncome: 48000, tier: 3 },
];

export default CITIES_SOUTH_CAROLINA;
