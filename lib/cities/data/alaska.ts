import type { City } from '../cities-data';

// Alaska - 5 cities
const CITIES_ALASKA: City[] = [
  { name: 'Anchorage', slug: 'anchorage', state: 'Alaska', stateSlug: 'alaska', stateAbbr: 'AK', population: 291000, medianIncome: 90000, tier: 2, region: 'Southcentral Alaska', county: 'Anchorage', zips: ['99501', '99503', '99508'], localBlurb: 'Anchorage is home to Providence Alaska Medical Center, the state\'s largest hospital, and the Alaska Native Medical Center campus.' },
  { name: 'Juneau', slug: 'juneau', state: 'Alaska', stateSlug: 'alaska', stateAbbr: 'AK', population: 32000, medianIncome: 90000, tier: 3, region: 'Southeast Alaska', county: 'Juneau', zips: ['99801'], localBlurb: 'Juneau, the state capital, is anchored by Bartlett Regional Hospital on the Gastineau Channel.' },
  { name: 'Fairbanks', slug: 'fairbanks', state: 'Alaska', stateSlug: 'alaska', stateAbbr: 'AK', population: 32000, medianIncome: 65000, tier: 3, region: 'Interior Alaska', county: 'Fairbanks North Star', zips: ['99701', '99709'], localBlurb: 'Fairbanks hosts the University of Alaska Fairbanks, the state\'s flagship research university and its Geophysical Institute.' },
  { name: 'Wasilla', slug: 'wasilla', state: 'Alaska', stateSlug: 'alaska', stateAbbr: 'AK', population: 10000, medianIncome: 78000, tier: 3, region: 'Mat-Su Valley', county: 'Matanuska-Susitna', zips: ['99654'], localBlurb: 'Wasilla is served by Mat-Su Regional Medical Center in Alaska\'s fastest-growing borough.' },
  { name: 'Sitka', slug: 'sitka', state: 'Alaska', stateSlug: 'alaska', stateAbbr: 'AK', population: 8500, medianIncome: 75000, tier: 3, region: 'Southeast Alaska', county: 'Sitka', zips: ['99835'], localBlurb: 'Sitka is home to SEARHC\'s Mount Edgecumbe Medical Center, the hub hospital for Southeast Alaska.' },
];

export default CITIES_ALASKA;
