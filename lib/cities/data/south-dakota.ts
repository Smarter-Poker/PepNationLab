import type { City } from '../cities-data';

// South Dakota - 5 cities
const CITIES_SOUTH_DAKOTA: City[] = [
  { name: 'Sioux Falls', slug: 'sioux-falls', state: 'South Dakota', stateSlug: 'south-dakota', stateAbbr: 'SD', population: 192000, medianIncome: 66000, tier: 2, region: 'Sioux Empire', county: 'Minnehaha', zips: ['57104', '57105', '57108'], localBlurb: 'Sioux Falls is the twin headquarters of Sanford Health and Avera Health, anchored by the Sanford USD Medical Center.' },
  { name: 'Rapid City', slug: 'rapid-city', state: 'South Dakota', stateSlug: 'south-dakota', stateAbbr: 'SD', population: 75000, medianIncome: 58000, tier: 3, region: 'Black Hills', county: 'Pennington', zips: ['57701', '57702'], localBlurb: 'Rapid City is served by Monument Health Rapid City Hospital, the Black Hills regional referral center.' },
  { name: 'Aberdeen', slug: 'aberdeen', state: 'South Dakota', stateSlug: 'south-dakota', stateAbbr: 'SD', population: 28000, medianIncome: 55000, tier: 3, region: 'Northeastern South Dakota', county: 'Brown', zips: ['57401'], localBlurb: 'Aberdeen is anchored by Avera St. Luke\'s Hospital in the state\'s northeast hub city.' },
  { name: 'Brookings', slug: 'brookings', state: 'South Dakota', stateSlug: 'south-dakota', stateAbbr: 'SD', population: 24000, medianIncome: 52000, tier: 3, region: 'Eastern South Dakota', county: 'Brookings', zips: ['57006'], localBlurb: 'Brookings is home to South Dakota State University and its growing research park.' },
  { name: 'Pierre', slug: 'pierre', state: 'South Dakota', stateSlug: 'south-dakota', stateAbbr: 'SD', population: 14000, medianIncome: 62000, tier: 3, region: 'Central South Dakota', county: 'Hughes', zips: ['57501'], localBlurb: 'Pierre, the state capital, is served by Avera St. Mary\'s Hospital on the Missouri River.' },
];

export default CITIES_SOUTH_DAKOTA;
