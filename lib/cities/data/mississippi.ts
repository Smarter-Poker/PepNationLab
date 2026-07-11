import type { City } from '../cities-data';

// Mississippi - 7 cities
const CITIES_MISSISSIPPI: City[] = [
  { name: 'Jackson', slug: 'jackson', state: 'Mississippi', stateSlug: 'mississippi', stateAbbr: 'MS', population: 150000, medianIncome: 40000, tier: 3, region: 'Jackson Metro', county: 'Hinds', zips: ['39202', '39211', '39216'], localBlurb: 'Jackson is home to the University of Mississippi Medical Center, the state\'s only academic health science center.' },
  { name: 'Madison', slug: 'madison', state: 'Mississippi', stateSlug: 'mississippi', stateAbbr: 'MS', population: 27000, medianIncome: 110000, tier: 1, region: 'Jackson Metro', county: 'Madison', zips: ['39110'], localBlurb: 'Madison is the Jackson metro\'s wealthiest suburb, minutes from the capital\'s Baptist and St. Dominic hospital campuses.' },
  { name: 'Ridgeland', slug: 'ridgeland', state: 'Mississippi', stateSlug: 'mississippi', stateAbbr: 'MS', population: 24000, medianIncome: 65000, tier: 2, region: 'Jackson Metro', county: 'Madison', zips: ['39157'], localBlurb: 'Ridgeland runs along the Highland Colony Parkway corporate corridor north of Jackson\'s medical district.' },
  { name: 'Gulfport', slug: 'gulfport', state: 'Mississippi', stateSlug: 'mississippi', stateAbbr: 'MS', population: 72000, medianIncome: 48000, tier: 3, region: 'Mississippi Gulf Coast', county: 'Harrison', zips: ['39501', '39507'], localBlurb: 'Gulfport is anchored by Memorial Hospital at Gulfport on the Mississippi Sound.' },
  { name: 'Biloxi', slug: 'biloxi', state: 'Mississippi', stateSlug: 'mississippi', stateAbbr: 'MS', population: 49000, medianIncome: 50000, tier: 3, region: 'Mississippi Gulf Coast', county: 'Harrison', zips: ['39530', '39531'], localBlurb: 'Biloxi is served by Merit Health Biloxi and the Keesler Medical Center on the Gulf Coast.' },
  { name: 'Hattiesburg', slug: 'hattiesburg', state: 'Mississippi', stateSlug: 'mississippi', stateAbbr: 'MS', population: 48000, medianIncome: 42000, tier: 3, region: 'Pine Belt', county: 'Forrest', zips: ['39401', '39402'], localBlurb: 'Hattiesburg hosts the University of Southern Mississippi and Forrest General Hospital.' },
  { name: 'Oxford', slug: 'oxford', state: 'Mississippi', stateSlug: 'mississippi', stateAbbr: 'MS', population: 28000, medianIncome: 55000, tier: 2, region: 'North Mississippi', county: 'Lafayette', zips: ['38655'], localBlurb: 'Oxford is home to the University of Mississippi and Baptist Memorial Hospital-North Mississippi.' },
];

export default CITIES_MISSISSIPPI;
